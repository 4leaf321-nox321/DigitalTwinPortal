"""
개인 액세스 토큰(Personal Access Token) — 발급 · 검증 · 폐기.

MCP 서버 등 외부 클라이언트가 `Authorization: Bearer dtp_...` 로 쓴다.
평문은 발급 시 1회만 돌려주고 DB 엔 sha256 해시만 둔다.
인증 경로(`app/shared/auth.py`)가 **접두사로 JWT 와 구분해** `resolve_token` 을 부른다.

왜 JWT 가 아닌가 (models.PersonalAccessToken 주석과 같은 이유)
    MCP 등록은 헤더에 토큰을 박아넣어 갱신이 안 되는데 JWT 는 12시간이면 만료된다.
    그리고 JWT 는 stateless 라 **폐기할 수단이 없다.** PAT 은 행을 지우면 즉시 무효다.

참고 구현: ReportArchive `backend/app/modules/users/pat.py` (접두사 `rat_`).
"""
from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta

from app.extensions import db
from app.modules.auth.models import PersonalAccessToken, User

# Digital Twin Personal token — JWT 와 구분되는 접두사.
# 인증 경로가 이 접두사만 보고 갈래를 정하므로 **바꾸면 기존 토큰이 전부 죽는다.**
TOKEN_PREFIX = 'dtp_'

DEFAULT_EXPIRES_DAYS = 90
MAX_EXPIRES_DAYS = 365

# last_used_at 을 매 요청 갱신하면 인증 경로마다 쓰기가 생긴다. 10분 간격으로만 찍는다.
_TOUCH_INTERVAL = timedelta(minutes=10)


def _hash(plaintext: str) -> str:
    return hashlib.sha256(plaintext.encode('utf-8')).hexdigest()


def create_token(user_id: int, name: str, expires_days: int | None = DEFAULT_EXPIRES_DAYS):
    """
    새 토큰 발급. `(행, 평문)` 을 돌려준다.

    **평문은 호출부가 사용자에게 딱 한 번 보여주고 버려야 한다.** 여기서도, DB 에도
    남기지 않는다.
    """
    if expires_days is not None:
        expires_days = max(1, min(int(expires_days), MAX_EXPIRES_DAYS))

    plaintext = TOKEN_PREFIX + secrets.token_urlsafe(32)
    now = datetime.utcnow()
    row = PersonalAccessToken(
        user_id=user_id,
        name=(name or 'MCP 토큰').strip()[:100],
        token_prefix=plaintext[:12],          # 표시용 — dtp_ + 앞 8자
        token_hash=_hash(plaintext),
        expires_at=(now + timedelta(days=expires_days)) if expires_days else None,
    )
    db.session.add(row)
    db.session.commit()
    return row, plaintext


def list_tokens(user_id: int):
    """내 **살아 있는** 토큰만, 최신순. 폐기한 것은 목록에서 사라진다."""
    return (PersonalAccessToken.query
            .filter(PersonalAccessToken.user_id == user_id,
                    PersonalAccessToken.revoked_at.is_(None))
            .order_by(PersonalAccessToken.id.desc())
            .all())


def delete_token(user_id: int, token_id: int) -> bool:
    """폐기 — 행을 지운다(즉시 무효). 남의 토큰이거나 없으면 False."""
    row = PersonalAccessToken.query.get(token_id)
    if row is None or row.user_id != user_id:
        return False
    db.session.delete(row)
    db.session.commit()
    return True


def resolve_token(plaintext: str):
    """
    평문 토큰 → `User`. 폐기·만료·비활성·미존재면 `None`.

    ⚠️ **해시로만 찾는다.** 평문을 DB 에 두지 않으므로 역방향 조회는 불가능하고,
       그게 의도다.
    """
    if not plaintext or not plaintext.startswith(TOKEN_PREFIX):
        return None

    row = PersonalAccessToken.query.filter_by(token_hash=_hash(plaintext)).first()
    if row is None or row.revoked_at is not None:
        return None

    now = datetime.utcnow()
    if row.expires_at is not None and row.expires_at <= now:
        return None

    user = User.query.get(row.user_id)
    if user is None or not user.is_active:
        return None

    # 인증 경로라 쓰기를 아낀다 — 10분에 한 번만 찍는다.
    if row.last_used_at is None or (now - row.last_used_at) > _TOUCH_INTERVAL:
        row.last_used_at = now
        db.session.commit()

    return user
