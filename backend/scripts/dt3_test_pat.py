"""
개인 액세스 토큰(PAT) — 발급 · 인증 · 폐기 시험.

무엇을 지키려는가
    MCP 등 외부 클라이언트는 헤더에 토큰을 **박아넣어** 쓴다(갱신 불가). 그래서
    JWT(12시간 만료·폐기 불가) 대신 PAT 을 쓴다. 이 시험은 그 대체가 **웹 인증을
    망가뜨리지 않으면서** 제대로 도는지 본다.

    특히 두 가지를 못 박는다:
      · **폐기하면 즉시 무효** — JWT 로는 못 하던 것. 이게 PAT 을 쓰는 이유다
      · **평문은 발급 응답에서만** — 목록에 평문이 새면 DB 유출 = 토큰 유출이 된다

실행: python scripts\\dt3_test_pat.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app                                     # noqa: E402
from app.extensions import db                                  # noqa: E402
from app.modules.auth import pat                               # noqa: E402
from app.modules.auth.models import PersonalAccessToken, User  # noqa: E402
from flask_jwt_extended import create_access_token             # noqa: E402

fails = []


def check(desc, ok, extra=''):
    print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}" + (f'   {extra}' if not ok and extra else ''))
    if not ok:
        fails.append(desc)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        user = User.query.filter_by(is_active=True).first()
        if user is None:
            print('SKIP 활성 사용자가 없습니다.')
            return 0
        jwt = create_access_token(identity=str(user.id))
        jwt_hdr = {'Authorization': f'Bearer {jwt}'}
        made = []

        with app.test_client() as c:
            print('── 발급 ──')
            r = c.post('/api/auth/me/mcp-tokens', headers=jwt_hdr,
                       json={'name': '시험용', 'expiresDays': 7})
            check('발급 201', r.status_code == 201, f'실제 {r.status_code}')
            data = (r.get_json() or {}).get('data') or {}
            plaintext = data.get('token') or ''
            info = data.get('info') or {}
            made.append(info.get('id'))
            check('평문 토큰이 응답에 있다', plaintext.startswith(pat.TOKEN_PREFIX),
                  plaintext[:12])
            check('표시용 접두사가 온다', bool(info.get('tokenPrefix')))
            check('만료일이 설정된다', bool(info.get('expiresAt')))

            print('\n── 목록 ──')
            r = c.get('/api/auth/me/mcp-tokens', headers=jwt_hdr)
            rows = (r.get_json() or {}).get('data') or []
            check('목록 200', r.status_code == 200)
            check('발급한 토큰이 목록에 있다', any(t['id'] == info.get('id') for t in rows))
            # ★ 평문이 목록으로 새면 DB 유출이 곧 토큰 유출이 된다
            check('★ 목록에 평문이 없다',
                  all('token' not in t and plaintext not in str(t) for t in rows))

            print('\n── PAT 으로 인증 ──')
            pat_hdr = {'Authorization': f'Bearer {plaintext}'}
            r = c.get('/api/dt-v2/describe/fields', headers=pat_hdr)
            check('★ PAT 으로 dt-v2 조회 200', r.status_code == 200, f'실제 {r.status_code}')

            r = c.get('/api/dt-v2/projects?limit=1', headers=pat_hdr)
            check('PAT 으로 과제 목록 200', r.status_code == 200, f'실제 {r.status_code}')

            # 웹 경로(JWT)가 그대로 살아 있어야 한다 — 대체가 아니라 갈래 추가다
            r = c.get('/api/dt-v2/describe/fields', headers=jwt_hdr)
            check('★ JWT 경로가 그대로 동작한다', r.status_code == 200, f'실제 {r.status_code}')

            print('\n── 나쁜 토큰 ──')
            for label, tok in [('가짜 PAT', pat.TOKEN_PREFIX + 'zzzz'),
                               ('빈 Bearer', ''),
                               ('망가진 JWT', 'not.a.jwt')]:
                r = c.get('/api/dt-v2/describe/fields',
                          headers={'Authorization': f'Bearer {tok}'})
                check(f'{label} → 401/422', r.status_code in (401, 422), f'실제 {r.status_code}')

            print('\n── 폐기하면 즉시 무효 ──')
            r = c.delete(f"/api/auth/me/mcp-tokens/{info.get('id')}", headers=jwt_hdr)
            check('폐기 200', r.status_code == 200, f'실제 {r.status_code}')
            r = c.get('/api/dt-v2/describe/fields', headers=pat_hdr)
            check('★ 폐기 직후 401 (JWT 로는 불가능하던 것)', r.status_code == 401,
                  f'실제 {r.status_code}')
            r = c.get('/api/auth/me/mcp-tokens', headers=jwt_hdr)
            rows = (r.get_json() or {}).get('data') or []
            check('목록에서도 사라진다', not any(t['id'] == info.get('id') for t in rows))

            print('\n── 남의 토큰은 못 지운다 ──')
            other = User.query.filter(User.id != user.id, User.is_active.is_(True)).first()
            if other is None:
                print('  [SKIP] 사용자가 한 명뿐이라 건너뜀')
            else:
                row, _pt = pat.create_token(other.id, '남의 것', 7)
                made.append(row.id)
                r = c.delete(f'/api/auth/me/mcp-tokens/{row.id}', headers=jwt_hdr)
                check('남의 토큰 삭제 → 404', r.status_code == 404, f'실제 {r.status_code}')

            print('\n── 만료 판정 ──')
            row, expired_pt = pat.create_token(user.id, '만료시험', 1)
            made.append(row.id)
            from datetime import datetime, timedelta
            row.expires_at = datetime.utcnow() - timedelta(seconds=1)
            db.session.commit()
            r = c.get('/api/dt-v2/describe/fields',
                      headers={'Authorization': f'Bearer {expired_pt}'})
            check('만료된 토큰 → 401', r.status_code == 401, f'실제 {r.status_code}')

        # 시험이 남긴 행 정리
        for tid in made:
            row = PersonalAccessToken.query.get(tid) if tid else None
            if row is not None:
                db.session.delete(row)
        db.session.commit()
        left = PersonalAccessToken.query.filter(
            PersonalAccessToken.name.in_(['시험용', '남의 것', '만료시험'])).count()
        check('시험이 남긴 토큰을 정리했다', left == 0, f'남은 {left}건')

    print()
    if fails:
        print(f'[FAIL] {len(fails)}건: {fails}')
        return 1
    print('[OK] 전부 통과')
    return 0


if __name__ == '__main__':
    sys.exit(main())
