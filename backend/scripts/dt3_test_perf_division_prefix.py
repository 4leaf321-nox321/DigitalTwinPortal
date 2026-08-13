"""
성과 이름의 `[사업부]` 접두어 강제 검증. (2026-08-03)

왜 강제하나
    성과에는 사업부 컬럼이 **없다.** 화면은 이름 앞 대괄호로 사업부를 가르고,
    없으면 '모든 성과 현황' 에서 통째로 `미분류` 로 떨어진다.
    안내(`shape`)만으로는 안 막혔다 — 실제로 접두어 없는 성과 100건이
    그대로 만들어졌다. 그래서 서버가 잡는다.

방침: **미분류를 만들지 않는다.** 사업부를 모르면 `[공통]` 을 붙인다.

  A  올바른 접두어는 그대로 통과
  B  접두어가 없으면 `[공통]` 이 붙고 **응답이 그 사실을 알린다** ★
  C  모르는 접두어(`[무선]`)는 400 — 오타가 새 사업부 그룹을 만들면 안 된다 ★
  D  대괄호 안 공백은 다듬어진다
  E  `공통` 도 유효한 접두어다
  F  PATCH 로 이름을 바꿔도 같은 규칙이 적용된다 ★
  G  안내(describe)와 서버 동작이 일치한다

실행:  venv/Scripts/python.exe scripts/dt3_test_perf_division_prefix.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                    # noqa: E402

from app import create_app                                            # noqa: E402
from app.extensions import db                                         # noqa: E402
from app.modules.auth.models import User                              # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import (            # noqa: E402
    Dt2Performance, Dt2PerformanceHistory,
)

FAIL = []
MADE = []
URL = '/api/dt-v2/performances'


def check(name, got, want):
    ok = got == want
    print(f"  {'OK  ' if ok else 'FAIL'}  {name}: got={got!r} want={want!r}")
    if not ok:
        FAIL.append(name)


def check_true(name, got):
    ok = bool(got)
    print(f"  {'OK  ' if ok else 'FAIL'}  {name}: {got!r}")
    if not ok:
        FAIL.append(name)


def main():
    app = create_app()
    with app.app_context():
        c = app.test_client()
        admin = User.query.filter_by(email='yjtwin.park@samsung.com').first()
        H = {'Authorization': f'Bearer {create_access_token(identity=str(admin.id))}'}

        def create(title, mode='ai'):
            r = c.post(URL, headers=H, json={
                'fields': {'성과항목': title, '대분류': '품질향상',
                           '소분류': '예측 정확도', '성과년도': 2026, '단위': '%'},
                'actor_mode': mode, 'reason': '접두어 강제 검증',
            })
            d = (r.get_json() or {}).get('data', {})
            if r.status_code == 201 and d.get('uuid'):
                MADE.append(d['uuid'])
            return r, d

        print('A  올바른 접두어는 그대로 통과')
        r, d = create('[MX] 접두어검증 정상')
        check('201', r.status_code, 201)
        check('제목 보존', d.get('title'), '[MX] 접두어검증 정상')
        check('손대지 않음', 'normalized' in d, False)

        print('B  접두어가 없으면 [공통] 이 붙고 응답이 알린다 ★')
        r, d = create('접두어검증 접두어없음')
        check('201', r.status_code, 201)
        check('공통이 붙는다', d.get('title'), '[공통] 접두어검증 접두어없음')
        check_true('normalized 로 알린다', d.get('normalized'))
        check_true('메시지에도 담긴다',
                   '공통' in ((r.get_json() or {}).get('message') or ''))

        print('C  모르는 접두어는 400 ★')
        r, d = create('[무선] 접두어검증 오타')
        check('400', r.status_code, 400)
        check_true('쓸 수 있는 값을 알려준다',
                   'MX' in ((r.get_json() or {}).get('message') or ''))
        check('만들어지지 않았다', Dt2Performance.query.filter(
            Dt2Performance.title.like('%접두어검증 오타%')).count(), 0)

        print('D  대괄호 안 공백은 다듬어진다')
        r, d = create('[ VD ]   접두어검증 공백')
        check('201', r.status_code, 201)
        check('정규화', d.get('title'), '[VD] 접두어검증 공백')

        print('E  공통도 유효한 접두어다')
        r, d = create('[공통] 접두어검증 공통')
        check('201', r.status_code, 201)
        check('제목 보존', d.get('title'), '[공통] 접두어검증 공통')
        check('손대지 않음', 'normalized' in d, False)

        print('F  PATCH 로 이름을 바꿔도 같은 규칙 ★')
        # 사람 경로 — AI 는 title 이 핵심이라 403 이다.
        target = MADE[0]
        r = c.patch(f'{URL}/{target}', headers=H, json={
            'patch': {'성과항목': '접두어검증 패치로제거'}, 'reason': '검증'})
        d = (r.get_json() or {}).get('data', {})
        check('200', r.status_code, 200)
        db.session.expire_all()
        check('공통이 붙는다',
              Dt2Performance.query.filter_by(uuid=target).first().title,
              '[공통] 접두어검증 패치로제거')
        check_true('normalized 로 알린다', d.get('normalized'))

        r = c.patch(f'{URL}/{target}', headers=H, json={
            'patch': {'성과항목': '[무선] 접두어검증 패치오타'}, 'reason': '검증'})
        check('모르는 접두어는 400', r.status_code, 400)

        # 2026-08-05: AI 도 title 을 고칠 수 있게 됐다(403 → 202, 확인 후 반영).
        # 여기서 볼 것은 **접두어 규칙이 AI 경로에서도 유지되는가** 다 —
        # 규칙이 느슨해지면 AI 가 만든 성과가 화면에서 `미분류` 로 떨어진다.
        r = c.patch(f'{URL}/{target}', headers=H, json={
            'patch': {'성과항목': '[무선] 접두어검증 AI오타'},
            'actor_mode': 'ai', 'reason': '검증'})
        check('AI 도 모르는 접두어는 400 (제안 만들기 전에)', r.status_code, 400)
        r = c.patch(f'{URL}/{target}', headers=H, json={
            'patch': {'성과항목': '[MX] 접두어검증 AI시도'},
            'actor_mode': 'ai', 'reason': '검증'})
        check('올바른 접두어면 202 (확인 대기)', r.status_code, 202)
        _pid = ((r.get_json() or {}).get('data') or {}).get('proposalId')
        if _pid:
            c.post(f'/api/dt-v2/proposals/{_pid}/reject', headers=H, json={'note': '검증 정리'})

        print('G  안내와 서버 동작이 일치한다')
        from app.modules.digital_twin_dashboard.ai_tools import (
            describe_performance_fields as desc)
        note = next(f for f in desc()['fields']
                    if f['key'] == '성과항목')['shape']['note']
        check_true('강제한다고 적혀 있다', '강제' in note)
        check_true('공통 폴백을 알린다', '공통' in note)
        check_true('400 을 알린다', '400' in note)

        print('정리')
        Dt2PerformanceHistory.query.filter(
            Dt2PerformanceHistory.performance_uuid.in_(MADE)).delete(
                synchronize_session=False)
        Dt2Performance.query.filter(Dt2Performance.uuid.in_(MADE)).delete(
            synchronize_session=False)
        db.session.commit()
        left = Dt2Performance.query.filter(
            Dt2Performance.title.like('%접두어검증%')).count()
        check('테스트 데이터 정리', left, 0)

    print()
    if FAIL:
        print(f'실패 {len(FAIL)}건: {", ".join(FAIL)}')
        return 1
    print('전부 통과')
    return 0


if __name__ == '__main__':
    sys.exit(main())
