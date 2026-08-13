"""
MCP 사용 안내(Agent Skill)가 **정본과 어긋나지 않는지** 검사한다.

왜 이 검사가 필요한가
    `SKILL.md` 는 규칙을 **산문으로 다시 적은 것**이다 — 필드 위험도도, 도구 이름도,
    절차도 전부 사본이다. 사본은 갈린다. 누가 필드 위험도를 바꾸거나 도구를 늘렸는데
    안내를 안 고치면 **AI 는 옛 규칙대로 움직이면서 사용자에게는 확신 있게 답한다.**
    (`dt3_test_describe.py` 가 `describe_fields` 안내에 대해 하는 일과 같다.)

    그래서 안내가 말하는 것을 **전부 정본에 대고 확인**한다:
      · 필드 위험도  → `permissions` 분류표에서 만들어진 `describe_fields`
      · 도구 이름    → `mcp_server/server.py` 의 `@mcp.tool()`
      · 파일 자체    → 화면이 내려주는 것이 **그 파일 그대로**인가

    이 검사가 깨지면 **안내를 고치라는 뜻**이지 검사를 고치라는 뜻이 아니다.

실행: python scripts\\dt3_test_skill.py
"""
from __future__ import annotations

import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app                                          # noqa: E402
from app.modules.auth.models import User                            # noqa: E402
from app.modules.digital_twin_dashboard.ai_tools import (           # noqa: E402
    describe_fields,
    describe_performance_fields,
)
# 경로를 여기서 다시 쓰지 않는다 — 엔드포인트가 읽는 **그 상수**를 그대로 가져온다.
# 복제하면 한쪽만 옮겨졌을 때 검사가 통과하면서 화면은 404 가 된다.
from app.modules.digital_twin_dashboard.routes_v2 import _SKILL_PATH  # noqa: E402
from flask_jwt_extended import create_access_token                  # noqa: E402

fails = []


def check(desc, ok, extra=''):
    print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}" + (f'   {extra}' if not ok and extra else ''))
    if not ok:
        fails.append(desc)


# 안내가 **이름을 대며 말하는** 필드와 그때 주장하는 위험도.
#
# 양쪽으로 검사한다 —
#   ① 정본(`describe_fields`)에 그 위험도로 실제 있는가  → 안내가 거짓말을 안 하는가
#   ② 안내 본문에 그 키가 진짜 나오는가                  → 이 표가 안내와 안 갈렸는가
# ②가 없으면 이 표만 남고 안내에서 문장이 사라져도 검사가 통과한다.
CLAIMS = {
    '진행률': 'low',
    '이슈목록': 'low',
    '액션아이템목록': 'low',
    '월간진척현황': 'low',
    '진행상태': 'core',
    '사업부': 'core',
    '과제구분': 'core',
    '과제영역': 'core',
    '프로세스': 'core',
    '시작': 'core',
    '종료': 'core',
    '과제년도': 'core',
    # 2026-08-05: 셋 다 금지에서 풀렸다.
    #   담당자·과제참여인력 → **파생**(참여인력목록의 표시용 사본)
    #   소유자             → 금지가 아니라 **admin 전용**(int id 라 사람은 특정된다)
    '과제참여인력': 'derived',
    '담당자': 'derived',
    '담당부서': 'derived',
    # 2026-08-02 에 금지에서 풀렸다 — knoxId 를 필수로 거는 쪽으로 바뀌었다.
    # (원래 막은 이유가 권한이 아니라 '이름만으로는 누구인지 못 가린다' 였다.)
    # 이 표가 `forbidden` 으로 남아 있어 08-05 까지 FAIL 이었다.
    '과제참여인력목록': 'core',
    '과제PL_knoxId': 'core',
    '관리자': 'immutable',        # 과제PL 의 사본. 서버가 파생시킨다
    '성과목록': 'relation',
    '선행과제목록': 'unsupported',
}

# 성과 안내가 주장하는 위험도. **과제와 표가 다르다**(PERF_*) — 안내가 과제 기준을
# 성과에 갖다 붙이면 AI 는 403 인 필드를 202 인 줄 알고 `confirm_change` 를 찾는다.
PERF_CLAIMS = {
    '실적수준': 'low',
    '조치사항': 'low',
    '성과평가': 'low',
    '보고현황목록': 'low',
    '성과항목': 'core',
    '대분류': 'core',
    '소분류': 'core',
    '목표수준': 'core',
    '현재수준': 'core',
    # 2026-08-05: 단위는 **소분류가 정한다**(파생). 보내도 안 들어간다.
    # 화면이 이미 그렇게 다루는데(입력 잠금) 서버만 자유 컬럼이라 112건 중 35건이
    # 어긋나 있었다. core 로 되돌리면 그 상태로 되돌아간다.
    '단위': 'derived',
    'isAchievementType': 'derived',
}

# 안내에서 **빠지면 안 되는 절차 문구**. 전부 실측에서 값비싸게 배운 것들이라,
# 편집하다 한 줄 지우면 그 사고가 그대로 돌아온다.
MUST_SAY = [
    ('고치기 전에 describe_fields 를 먼저 부르라',
     lambda t: 'describe_fields' in t and '먼저' in t),
    ('묻지 않고 confirm_change 를 부르지 말라',
     lambda t: re.search(r'묻지 않고 (바로 )?`?confirm_change', t) is not None),
    ('배열 필드는 통째로 교체된다',
     lambda t: '통째로 교체' in t and '액션아이템목록' in t),
    ('핵심과 저위험을 섞어 보내지 말라',
     lambda t: '섞어 보내지 않는다' in t or '섞어 보내지 말' in t),
    ('ignored 를 사용자에게 알리라',
     lambda t: 'ignored' in t and '조용히 넘기지' in t),
    ('409 는 덮어쓰지 말고 사용자와 다시 정하라',
     lambda t: '409' in t and '다시 정한다' in t),
]


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    print('── 파일 ──')
    check(f'SKILL.md 가 엔드포인트가 읽는 자리에 있다 ({_SKILL_PATH.name})',
          _SKILL_PATH.exists(), str(_SKILL_PATH))
    if not _SKILL_PATH.exists():
        print('\n[FAIL] 파일이 없어 더 볼 수 없다.')
        return 1

    text = _SKILL_PATH.read_text(encoding='utf-8')

    # 앞머리(frontmatter). 이게 깨지면 Claude Code 가 스킬을 **아예 안 읽는다** —
    # 그런데 화면에서는 설치가 성공한 것처럼 보인다.
    head = text.split('---')[1] if text.startswith('---') else ''
    check('앞머리에 name: digitaltwin', re.search(r'^name:\s*digitaltwin\s*$', head, re.M) is not None)
    check('앞머리에 description 이 있다', re.search(r'^description:\s*\S', head, re.M) is not None)
    check('앞머리에 allowed-tools: mcp__digitaltwin__*',
          re.search(r'^allowed-tools:\s*mcp__digitaltwin__\*\s*$', head, re.M) is not None)

    print('\n── 도구 이름 (server.py 와 대조) ──')
    server_py = _SKILL_PATH.parents[2] / 'server.py'
    check(f'server.py 를 찾았다 ({server_py.name})', server_py.exists(), str(server_py))
    real_tools = set()
    if server_py.exists():
        real_tools = set(re.findall(r'@mcp\.tool\(\)\s*\n\s*async def (\w+)',
                                    server_py.read_text(encoding='utf-8')))

    # 안내의 '## 도구' 표에 적힌 이름만 뽑는다. 다른 표에도 백틱 토큰이 있어서
    # 문서 전체에서 긁으면 `changes` 같은 것이 도구로 잡힌다.
    sec = re.search(r'\n## 도구\n(.*?)\n## ', text, re.S)
    listed = set(re.findall(r'^\|\s*`([a-z_]+)`\s*\|', sec.group(1), re.M)) if sec else set()

    check('안내에 도구 표가 있다', bool(listed), '「## 도구」 절을 못 찾았다')
    check(f'실제 도구 {len(real_tools)}개가 모두 안내에 있다',
          bool(real_tools) and not (real_tools - listed), f'빠진 도구: {sorted(real_tools - listed)}')
    check('안내에만 있는 유령 도구가 없다',
          not (listed - real_tools), f'유령 도구: {sorted(listed - real_tools)}')

    print('\n── 필드 위험도 (describe_fields 와 대조) ──')
    app = create_app()
    with app.app_context():
        by_key = {f['key']: f for f in describe_fields()['fields']}

        wrong, absent = [], []
        for key, claimed in CLAIMS.items():
            if key not in by_key:
                absent.append(key)
            elif by_key[key]['risk'] != claimed:
                wrong.append((key, f"안내={claimed}", f"정본={by_key[key]['risk']}"))
        check(f'안내가 이름을 댄 필드 {len(CLAIMS)}개가 정본에 다 있다',
              not absent, f'없는 키: {absent}')
        check('안내가 말한 위험도가 정본과 같다', not wrong, f'{wrong[:5]}')

        # 이 표가 안내와 갈리지 않았는가 (위 주석 ②)
        unspoken = [k for k in CLAIMS if k not in text]
        check('이 검사표의 키가 안내 본문에 실제로 나온다',
              not unspoken, f'안내에 없는 키: {unspoken}')

        print('\n── 성과 필드 위험도 (describe_performance_fields 와 대조) ──')
        perf_by_key = {f['key']: f for f in describe_performance_fields()['fields']}
        p_wrong, p_absent = [], []
        for key, claimed in PERF_CLAIMS.items():
            if key not in perf_by_key:
                p_absent.append(key)
            elif perf_by_key[key]['risk'] != claimed:
                p_wrong.append((key, f'안내={claimed}',
                                f"정본={perf_by_key[key]['risk']}"))
        check(f'안내가 이름을 댄 성과 필드 {len(PERF_CLAIMS)}개가 정본에 다 있다',
              not p_absent, f'없는 키: {p_absent}')
        check('안내가 말한 성과 위험도가 정본과 같다', not p_wrong, f'{p_wrong[:5]}')
        p_unspoken = [k for k in PERF_CLAIMS if k not in text]
        check('성과 검사표의 키가 안내 본문에 실제로 나온다',
              not p_unspoken, f'안내에 없는 키: {p_unspoken}')

        print('\n── 빠지면 안 되는 절차 문구 ──')
        for desc, ok in MUST_SAY:
            check(desc, ok(text))

        print('\n── 엔드포인트 ──')
        u = User.query.filter_by(role='admin').first() or User.query.first()
        if u is None:
            check('사용자가 있어 엔드포인트를 시험할 수 있다', False, 'users 비어 있음')
        else:
            token = create_access_token(identity=str(u.id))
            with app.test_client() as c:
                r = c.get('/api/dt-v2/skill/digitaltwin',
                          headers={'Authorization': f'Bearer {token}'})
                check('GET /dt-v2/skill/digitaltwin 200', r.status_code == 200,
                      f'실제 {r.status_code}')
                check('마크다운으로 내려준다',
                      'text/markdown' in (r.headers.get('Content-Type') or ''),
                      r.headers.get('Content-Type'))
                # **사본이 아니라 그 파일이어야 한다.** 프론트나 서버가 본문을 따로
                # 들고 있으면 여기서 갈린다 — 그게 이 설계에서 막으려는 것 자체다.
                check('내려준 본문이 파일과 완전히 같다',
                      r.get_data(as_text=True) == text)

                r2 = c.get('/api/dt-v2/skill/digitaltwin')
                check('토큰 없으면 401', r2.status_code in (401, 422),
                      f'실제 {r2.status_code}')

    print(f"\n  [정보] 안내 {len(text)}자 · 도구 {len(real_tools)}개 · "
          f"검사한 필드 과제 {len(CLAIMS)}개 · 성과 {len(PERF_CLAIMS)}개")

    print()
    if fails:
        print(f'[FAIL] {len(fails)}건 — 안내를 정본에 맞추세요: {fails}')
        return 1
    print('[OK] 전부 통과')
    return 0


if __name__ == '__main__':
    sys.exit(main())
