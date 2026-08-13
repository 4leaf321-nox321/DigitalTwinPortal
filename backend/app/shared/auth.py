"""
인증 관문 — **JWT(웹 화면)와 PAT(MCP 등 외부 클라이언트)를 둘 다 받는다.**

왜 필요한가
    `@jwt_required()` 는 `Authorization: Bearer dtp_...` 를 **JWT 로 파싱하려다 401** 을
    던진다. 뷰 함수까지 도달하지 못하므로 `_actor()` 안에서 분기해도 소용이 없다
    (2026-08-01 실측). 그래서 데코레이터 자리에서 갈래를 나눠야 한다.

    ReportArchive 의 `_resolve_user_from_token` 과 같은 구조다 — 접두사로 구분하고,
    PAT 이면 해시 조회, 아니면 기존 JWT 검증.

⚠️ **웹 화면의 인증은 그대로 JWT 다.** 바꾸는 게 아니라 **한 갈래를 더 받는 것**이다.
"""
from __future__ import annotations

from functools import wraps

from flask import g, request
from flask_jwt_extended import verify_jwt_in_request

from app.modules.auth import pat
from app.shared.responses import error_response

# PAT 으로 인증된 사용자를 담아 두는 자리. `_actor()` 가 여기를 먼저 본다.
_G_KEY = '_dt_pat_user'


def bearer_token() -> str:
    """`Authorization: Bearer <값>` 의 값. 없으면 빈 문자열."""
    raw = request.headers.get('Authorization') or ''
    parts = raw.split(None, 1)
    if len(parts) == 2 and parts[0].lower() == 'bearer':
        return parts[1].strip()
    return ''


def looks_like_pat(token: str = None) -> bool:
    token = bearer_token() if token is None else token
    return bool(token) and token.startswith(pat.TOKEN_PREFIX)


def pat_user():
    """이번 요청이 PAT 으로 인증됐다면 그 사용자. 아니면 None."""
    return getattr(g, _G_KEY, None)


def authenticate():
    """
    이번 요청을 인증한다. 성공하면 `None`, 실패하면 **응답 객체**를 돌려준다.

    데코레이터와 `before_request` 훅이 같이 쓴다 — 두 곳에 규칙을 복제하지 않기 위해서다.
    """
    token = bearer_token()

    if token.startswith(pat.TOKEN_PREFIX):
        user = pat.resolve_token(token)
        if user is None:
            # 폐기·만료·미존재를 구분해 알려주지 않는다 — 유효한 토큰을 찾는 데
            # 쓸 수 있는 단서가 된다.
            return error_response('토큰이 유효하지 않거나 폐기·만료되었습니다.',
                                  status_code=401)
        setattr(g, _G_KEY, user)
        return None

    # 기존 경로 — flask_jwt_extended 가 401/422 로 답한다.
    verify_jwt_in_request()
    return None


def auth_required(fn):
    """`@jwt_required()` 자리를 대신한다. JWT 또는 PAT 을 받는다."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        failed = authenticate()
        if failed is not None:
            return failed
        return fn(*args, **kwargs)
    return wrapper
