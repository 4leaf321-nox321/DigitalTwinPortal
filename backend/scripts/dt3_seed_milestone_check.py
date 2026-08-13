"""마일스톤이 많은 **눈으로 볼 시험용 과제**를 하나 만든다. (2026-08-11)

왜 필요한가
    액션아이템이 많아져 자리가 모자라면 점줄과 이름줄이 어긋나는 문제를 고쳤다
    (`ProjectMilestones.jsx` — 격자를 하나로 합쳤다). 그런데 이 환경에는 헤드리스
    브라우저가 없어 **픽셀 정렬을 잴 수가 없다.** 사람이 눈으로 봐야 한다.
    개발 데이터에는 액션아이템이 10개 넘는 과제가 없어서, 볼 것을 만들어 둔다.

무엇을 일부러 어렵게 만드나 — 정렬이 깨진다면 여기서 깨진다
    · **14개** — 한 화면에 안 들어가 가로로 넘어간다
    · 제목 길이를 **뒤섞는다** (3자 ~ 30자). 칸마다 최소폭이 달라야 옛 버그가 드러난다
    · 날짜 꼬리표를 **섞는다** — 목표만·목표+완료·아무것도 없음
      (꼬리표는 안 줄어드는 물건이라 칸 폭 계산에서 제일 말썽이었다)

⚠️ **시험용이다.** 과제코드가 `ZZTEST-` 로 시작하니 다 보고 나면 지우면 된다.
   `--delete` 로 이 스크립트가 만든 것만 지운다.

⚠️ 다른 시드와 같은 길을 지난다 — `POST /api/dt-v2/projects`. 모델에 직접 쓰면
   서버가 하는 파생(진행률·액션아이템 정규화)을 건너뛰어 **화면과 다른 데이터**가 된다.

실행:
    venv/Scripts/python.exe scripts/dt3_seed_milestone_check.py
    venv/Scripts/python.exe scripts/dt3_seed_milestone_check.py --delete
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                    # noqa: E402

from app import create_app                                            # noqa: E402
from app.modules.auth.models import User                              # noqa: E402

CODE = 'ZZTEST-MS14'
DIVISION = 'MX'
YEAR = 2026

# (제목, 목표월, 완료 여부, 완료월 or None)
#   완료월이 None 이고 완료여부가 True 면 **완료일 없는 완료** — 실제 데이터에 11% 있다.
STEPS = [
    ('착수',                                   2, True,  1),
    ('요구 조건 정의서 작성 및 관련 부서 합의', 2, True,  2),
    ('해석 모델 단순화 기준 수립',              3, True,  2),
    ('메쉬',                                   3, True,  3),
    ('경계 조건 표준화',                        4, True,  3),
    ('낙하 26방향 시나리오 자동 생성 파이프라인', 4, True,  4),
    ('1차 검증',                               5, True,  None),
    ('실측 상관 분석 및 오차 요인 분해',        6, True,  6),
    ('보정',                                   6, False, None),
    ('설계자 대상 사용성 시험 및 피드백 반영',   7, False, None),
    ('리포트 자동 생성 서식 확정',              8, False, None),
    ('전사 배포',                              9, False, None),
    ('교육',                                  10, False, None),
    ('운영 이관 및 유지보수 체계 수립',        11, False, None),
]


def build_actions():
    actions = []
    for i, (title, due_m, done, done_m) in enumerate(STEPS):
        # 세부항목이 정본이다 — 상위 완료여부·진행률은 서버가 여기서 파생시킨다.
        subs = []
        for j in range(2):
            subs.append({
                'id': 1786000000000 + i * 10 + j,
                '내용': f'{title} 세부 {j + 1}',
                '완료여부': done,
                '완료일': f'{YEAR}-{done_m:02d}-15' if (done and done_m) else '',
            })
        actions.append({
            'id': f'action_{CODE}_{i + 1}',
            '제목': title,
            '목표일': f'{YEAR}-{due_m:02d}-{28 if due_m != 2 else 26}',
            '완료여부': done,
            '완료일': f'{YEAR}-{done_m:02d}-15' if (done and done_m) else '',
            '세부항목목록': subs,
        })
    return actions


def main():
    app = create_app()
    with app.app_context():
        admin = User.query.filter_by(email='yjtwin.park@samsung.com').first()
        if not admin:
            print('관리자 계정을 못 찾았습니다 (yjtwin.park@samsung.com).')
            return 1
        token = create_access_token(identity=str(admin.id))
        H = {'Authorization': f'Bearer {token}'}
        c = app.test_client()

        # ── 지우기 ──────────────────────────────────────────────────────
        if '--delete' in sys.argv:
            from app.modules.digital_twin_dashboard.models_v2 import Dt2Project
            from app.extensions import db
            rows = Dt2Project.query.filter(Dt2Project.code.like('ZZTEST-%')).all()
            if not rows:
                print('지울 시험 과제가 없습니다.')
                return 0
            for p in rows:
                print(f'  지움: {p.code} {p.title}')
                db.session.delete(p)
            db.session.commit()
            print(f'{len(rows)}건 지웠습니다.')
            return 0

        # ── 만들기 ──────────────────────────────────────────────────────
        actions = build_actions()
        done = sum(1 for a in actions if a['완료여부'])
        fields = {
            '과제명': '[시험] 마일스톤 정렬 확인용 과제',
            'id': CODE,
            '사업부': DIVISION,
            '과제년도': YEAR,
            '진행상태': '정상진행',
            '담당부서': 'CAE그룹(MX)',
            '담당부서목록': ['CAE그룹(MX)'],
            '과제PL': '박용진',
            '과제PL_knoxId': 'yjtwin.park',
            '시작': 2, '종료': 11,
            '작성자': '박용진',
            '과제상세설명': (
                '마일스톤 타임라인의 점과 이름이 어긋나지 않는지 눈으로 보려고 만든 '
                '시험 과제입니다. 액션아이템 14개 · 제목 길이와 날짜 꼬리표를 일부러 '
                '뒤섞었습니다. 확인이 끝나면 지워도 됩니다.'),
            '액션아이템목록': actions,
        }

        r = c.post('/api/dt-v2/projects', headers=H, json={
            'fields': fields, 'ignore_unknown': True,
            'reason': '마일스톤 정렬 확인용 시험 과제 (사용자 요청)',
        })
        j = r.get_json() or {}
        if r.status_code != 201:
            print(f'실패 {r.status_code}: {j.get("message")}')
            print(j)
            return 1

        d = j.get('data', j)
        print(f'만들었습니다 — {CODE} · 액션아이템 {len(actions)}개 (완료 {done}개)')
        print(f'  uuid   {d.get("uuid") or d.get("id")}')
        print(f'  사업부  {DIVISION} · {YEAR}년')
        print()
        print('보는 곳: 디지털 트윈 대시보드 ▸ 모든 과제 현황 ▸ "[시험] 마일스톤 정렬 확인용 과제"')
        print('        (결과 보고서 화면도 같은 그림을 씁니다)')
        print()
        print('다 보고 나면: venv/Scripts/python.exe scripts/dt3_seed_milestone_check.py --delete')
        return 0


if __name__ == '__main__':
    sys.exit(main())
