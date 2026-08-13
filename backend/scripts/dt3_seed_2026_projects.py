"""
2026년도 과제 일괄 생성 — MX·VD·DA·NW·의료기기·GTR 6개 사업부. (2026-08-02)

MCP `create_project` 와 **같은 경로**를 지난다 (POST /api/dt-v2/projects,
actor_mode='ai'). 변경 이력의 source 도 'ai' 로 남는다. 도구를 94번 부르는 대신
한 번에 도는 것뿐이고, 서버가 보는 것은 완전히 같다.

지키는 규칙
  · 담당부서는 **departments 테이블에 실재하는 9개**만 쓴다. 지어내지 않는다.
  · 사업부내공개여부는 **보내지 않는다** — 기본값 false(전체 공개)로 만들어진다.
  · 과제PL·참여인력은 **users 테이블에 실재하는 8개 계정**만 knoxId 로 넣는다.
  · 상세정보 한 줄은 39자 제한(공백 0.5자) — 넘으면 만들기 전에 경고한다.

실행:  venv/Scripts/python.exe scripts/dt3_seed_2026_projects.py [--dry-run]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                    # noqa: E402

from app import create_app                                            # noqa: E402
from app.modules.auth.models import User                              # noqa: E402

DRY = '--dry-run' in sys.argv

# 실재하는 계정만. (users 테이블, knoxId = 이메일 로컬파트)
PEOPLE = [
    ('yjtwin.park', '박용진'), ('gukjin.park', '박국진'),
    ('mihee.park', '박미희'), ('ilkwon.kim', '김일권'),
    ('sunsoo.han', '한선수'), ('hyunsung.lee', '이현성'),
    ('kyungho.kim', '김경호'), ('nox321', '박세현'),
]

# 실재하는 부서만. (departments 테이블, is_active=true)
DEPTS = {
    'MX':    ['CAE그룹(MX)', 'Digital Twin사무국(MX)'],
    'VD':    ['Mecha그룹(VD)', 'Digital Twin사무국(VD)'],
    'DA':    ['CAE그룹(DA)', 'Digital Twin사무국(DA)'],
    'NW':    ['Digital Twin사무국(네트워크)'],
    '의료기기': ['Digital Twin사무국(의료기기)'],
    'GTR':   ['Digital Twin사무국(생기연)'],
}

# 이미 만든 6건 다음부터 사람을 돌린다 (MX-26-006 이 6번째 = 이현성).
ROTATION_START = 6


def width(s):
    """화면 입력 제한과 같은 셈 — 공백은 0.5자."""
    return sum(0.5 if ch == ' ' else 1 for ch in s)


def build(idx, spec):
    """압축 명세를 서버가 받는 fields 로 편다."""
    div = spec['div']
    depts = DEPTS[div]
    pl_id, pl_name = PEOPLE[(ROTATION_START + idx) % len(PEOPLE)]
    members = [PEOPLE[(ROTATION_START + idx + k) % len(PEOPLE)] for k in range(3)]

    s, e, prog = spec['s'], spec['e'], spec['prog']
    content = spec['content']
    n = len(content)

    # 액션아이템 = 상세내용의 단계들.
    #
    # `prog` 는 **어디까지 진행됐는지 고르는 데만** 쓴다. 세부항목(액티비티)이 정본이고,
    # 상위 완료여부와 진행률은 거기서 나온다 — 서버가 그렇게 파생시킨다
    # (routes_v2.normalize_action_items / derive_progress).
    #
    # 예전에는 진행률을 먼저 정해 필드로 보내고 그것으로 완료 여부를 역산했다. 파생과
    # 방향이 반대라, 시드를 돌릴 때마다 진행률이 액션아이템과 어긋난 데이터가 생겼다.
    actions = []
    for i, (head, subs) in enumerate(content):
        title = head.split('. ', 1)[-1]
        due_m = min(12, s + int((e - s + 1) * (i + 1) / n))
        stage_done = prog >= (i + 1) / n * 100
        done_m = max(s, due_m - 1)

        sub_rows = []
        for j, sub in enumerate(subs):
            sub_done = stage_done or (j == 0 and prog >= i / n * 100 + 15)
            sub_rows.append({
                'id': 1785600000000 + idx * 100 + i * 10 + j,
                '내용': sub,
                '완료여부': sub_done,
                '완료일': f'2026-{done_m:02d}-12' if sub_done else '',
            })

        # 상위는 세부항목에서 파생한다. 서버가 어차피 다시 계산하지만, 여기서 맞춰
        # 두어야 스크립트만 읽어도 무엇이 저장될지 알 수 있다.
        all_done = bool(sub_rows) and all(r['완료여부'] for r in sub_rows)
        done_dates = [r['완료일'] for r in sub_rows if r['완료일']]
        actions.append({
            'id': f"action_{spec['code']}_{i + 1}",
            '제목': title,
            '목표일': f'2026-{due_m:02d}-{28 if due_m != 2 else 26}',
            '완료여부': all_done,
            '완료일': max(done_dates) if (all_done and done_dates) else '',
            '월별내용': {},
            '세부항목목록': sub_rows,
        })

    # 월간진척 = 착수월부터 7월(현재)까지. 단계 진행을 그대로 적는다.
    #
    # ⚠️ `res`·`out` 원소는 문자열이거나 (제목, [하위줄]) 튜플이다. 그대로 f-string 에
    #    넣으면 튜플이 통째로 찍힌다 — 실제로 그렇게 새어 나간 적이 있다.
    def head_of(item):
        return item if isinstance(item, str) else item[0]

    monthly = {}
    last = min(7, e)
    for m in range(s, last + 1):
        pos = (m - s) / max(1, last - s)
        phase = content[min(n - 1, int(pos * n))]
        if m == s:
            monthly[str(m)] = f"□ 과제 착수 및 실행계획 수립\n  - {spec['bg'][0]}\n  - 추진 항목 정의"
        elif m == last:
            tail = f"\n  - {spec['issues'][0][0]}" if spec['issues'] else ''
            monthly[str(m)] = f"□ {head_of(phase[0]).split('. ', 1)[-1]} 진행\n  - {head_of(spec['res'][0])}{tail}"
        else:
            # 같은 단계가 두 달에 걸치면 하위 줄을 번갈아 적어 같은 문장이 반복되지 않게 한다.
            subs = phase[1] or [head_of(spec['ov'][0])]
            monthly[str(m)] = f"□ {phase[0].split('. ', 1)[-1]}\n  - {subs[(m - s - 1) % len(subs)]}"

    issues = [
        {'id': 1785600000000 + idx * 100 + 90 + k, '제목': t, '코멘트': c,
         '등록일': d, '해결여부': solved, '해결일': ('2026-%02d-25' % min(12, int(d[5:7]) + 1)) if solved else ''}
        for k, (t, c, d, solved) in enumerate(spec['issues'])
    ]

    def sec(items, parent_only=False):
        return {'enabled': True, 'items': [
            {'text': it, 'children': []} if parent_only or isinstance(it, str)
            else {'text': it[0], 'children': [{'text': x} for x in it[1]]}
            for it in items]}

    return {
        '과제명': spec['title'], 'id': spec['code'], '사업부': div,
        '과제년도': 2026, '진행상태': spec['st'], '프로세스': spec['proc'],
        '과제구분': spec['cat'], '과제영역': spec['dom'],
        '담당부서': depts[0], '담당부서목록': depts,
        '과제PL': pl_name, '과제PL_knoxId': pl_id,
        '과제참여인력목록': [
            {'knoxId': k, '이름': nm, '부서': depts[i % len(depts)]}
            for i, (k, nm) in enumerate(members)],
        # `진행률` 은 보내지 않는다 — 서버가 액션아이템에서 계산한다.
        # 보내 봐야 파생값으로 덮이고, 남아 있으면 시드가 정하는 값처럼 보인다.
        '시작': s, '종료': e,
        '중점과제여부': spec.get('key', False), 'PoC과제여부': spec.get('poc', False),
        '작성자': '박용진', '상세정보_입력완료': True,
        # ⚠️ `이미지_그룹N_카테고리` 는 **보내지 않는다** (2026-08-08 수정).
        #
        # 🐞 예전에는 `spec['img']`(예: '방사 패턴', '모델 구조')를 넣었다. 이름만 보면
        #    그림 제목 같지만, 이 필드는 **그림 슬롯 키**다 — 화면이 `이미지_<값>` 으로
        #    업로드 위치를 정한다. 쓸 수 있는 값은 `개요그림·상세내용그림·향후계획그림`
        #    셋뿐이라, 자유 텍스트가 들어간 과제는 **이미지를 올려도 저장이 조용히
        #    사라졌다**(저장·조립 양쪽이 정해진 슬롯만 안다). 개발 100건이 그 상태였다.
        #    지금은 서버도 이 값을 검사해 400 을 내므로, 넣으면 시드가 아예 실패한다.
        #    그림 설명이 필요하면 이미지의 `caption` 에 쓴다.
        '과제상세설명': spec['desc'],
        '상세정보_추진배경': sec(spec['bg'], True),
        '상세정보_과제개요': sec(spec['ov'], True),
        '상세정보_과제목표': sec(spec['goal'], True),
        '상세정보_상세내용': sec(content),
        '상세정보_산출물': sec(spec['out']),
        '상세정보_성과': sec(spec['res']),
        '상세정보_향후계획': sec(spec['plan']),
        '액션아이템목록': actions,
        '월간진척현황': monthly,
        '이슈목록': issues,
    }


from dt3_seed_2026_data import SPECS                                  # noqa: E402


def main():
    # 39자 제한 사전 점검 — 넘으면 화면에서 잘린다. 만들기 전에 잡는다.
    long_lines = []
    for spec in SPECS:
        for key in ('bg', 'ov', 'goal', 'out', 'res', 'plan'):
            for it in spec[key]:
                t = it if isinstance(it, str) else it[0]
                if width(t) > 39:
                    long_lines.append((spec['code'], key, t))
                if not isinstance(it, str):
                    for x in it[1]:
                        if width(x) > 39:
                            long_lines.append((spec['code'], key, x))
        for head, subs in spec['content']:
            if width(head) > 39:
                long_lines.append((spec['code'], 'content', head))
            for x in subs:
                if width(x) > 39:
                    long_lines.append((spec['code'], 'content', x))
    if long_lines:
        print(f'39자 초과 {len(long_lines)}줄 — 만들지 않고 중단')
        for c, k, t in long_lines[:20]:
            print(f'  {c} {k}: {t} ({width(t)}자)')
        return 1

    codes = [s['code'] for s in SPECS]
    if len(set(codes)) != len(codes):
        print('과제코드 중복 있음 — 중단')
        return 1
    print(f'검사 통과: {len(SPECS)}건, 39자 초과 없음, 코드 중복 없음')
    if DRY:
        print('--dry-run 이라 만들지 않는다')
        return 0

    app = create_app()
    with app.app_context():
        admin = User.query.filter_by(email='yjtwin.park@samsung.com').first()
        token = create_access_token(identity=str(admin.id))
        H = {'Authorization': f'Bearer {token}'}
        c = app.test_client()

        ok, fail = 0, []
        for idx, spec in enumerate(SPECS):
            fields = build(idx, spec)
            r = c.post('/api/dt-v2/projects', headers=H, json={
                'fields': fields, 'actor_mode': 'ai', 'ignore_unknown': True,
                'reason': '2026년도 사업부별 디지털트윈 과제 등록 (사용자 요청)',
            })
            j = r.get_json() or {}
            d = j.get('data', j)
            if r.status_code == 201:
                ok += 1
                ign = d.get('ignored') or []
                mark = f'  ⚠ ignored={ign}' if ign else ''
                print(f"  [{ok + len(fail):>2}/94] {spec['code']:<11} {spec['title'][:34]}{mark}")
            else:
                fail.append((spec['code'], r.status_code, j.get('message')))
                print(f"  [{ok + len(fail):>2}/94] {spec['code']:<11} 실패 {r.status_code} {j.get('message')}")

    print()
    print(f'생성 {ok}건 / 실패 {len(fail)}건')
    for code, st, msg in fail:
        print(f'  {code}: {st} {msg}')
    return 1 if fail else 0


if __name__ == '__main__':
    sys.exit(main())
