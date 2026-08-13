"""
MCP 로 입력할 때 **조용히 잘못 들어가는 것**이 더 있는지 찔러본다. (2026-08-03)

파생·검증이 붙은 곳(진행률·완료일·진행상태)은 이미 서버가 잡는다. 여기서 보는 것은
**서버가 받아주는데 화면에서는 다르게 보이거나 안 보이는** 조합이다 —
`applied` 만 보는 AI 는 끝까지 알아채지 못하는 종류.

읽기 전용이 아니라 실제로 만들어 보고 지운다. 던지는 것마다 결과를 적는다.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                    # noqa: E402

from app import create_app                                            # noqa: E402
from app.extensions import db                                         # noqa: E402
from app.modules.auth.models import User                              # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import (            # noqa: E402
    Dt2Performance, Dt2PerformanceHistory, Dt2Project, Dt2ProjectChange,
    Dt2ProjectHistory, Dt2ProjectPerformance,
)

MADE_P, MADE_F = [], []


def show(label, verdict, detail=''):
    print(f'  {verdict:<10} {label}' + (f'\n             {detail}' if detail else ''))


def main():
    app = create_app()
    with app.app_context():
        c = app.test_client()
        admin = User.query.filter_by(email='yjtwin.park@samsung.com').first()
        H = {'Authorization': f'Bearer {create_access_token(identity=str(admin.id))}'}

        def mkproj(fields):
            r = c.post('/api/dt-v2/projects', headers=H, json={
                'fields': {'과제명': '[탐침] 입력 위험 확인', **fields},
                'actor_mode': 'ai', 'ignore_unknown': True, 'reason': '탐침'})
            d = (r.get_json() or {}).get('data', {})
            if r.status_code == 201 and d.get('uuid'):
                MADE_P.append(d['uuid'])
            return r, d

        print('1. 시작/종료 월 범위 (1~12 밖)')
        r, d = mkproj({'과제년도': 2026, '시작': 0, '종료': 99})
        show('시작=0 · 종료=99', f'HTTP {r.status_code}',
             f"저장값 시작={d.get('startMonth')} 종료={d.get('endMonth')}"
             if r.status_code == 201 else (r.get_json() or {}).get('message', '')[:90])

        print('2. 시작 > 종료 (역전)')
        r, d = mkproj({'과제년도': 2026, '시작': 11, '종료': 3})
        show('시작=11 · 종료=3', f'HTTP {r.status_code}',
             f"저장값 시작={d.get('startMonth')} 종료={d.get('endMonth')}"
             if r.status_code == 201 else '')

        print('3. 이슈: 해결여부=false 인데 해결일이 있음')
        r, d = mkproj({'과제년도': 2026, '이슈목록': [
            {'id': 1, '제목': '탐침', '코멘트': 'x', '등록일': '2026-06-01',
             '해결여부': False, '해결일': '2026-07-01'}]})
        iss = (d.get('issues') or [{}])[0]
        show('미해결인데 해결일 채움', f'HTTP {r.status_code}',
             f"저장값 해결여부={iss.get('해결여부')} 해결일={iss.get('해결일')!r}"
             " — 액션아이템과 달리 정규화가 없다")

        print('4. 월간진척현황 키가 월 번호가 아님')
        r, d = mkproj({'과제년도': 2026, '월간진척현황': {
            '13': '없는 달', '2026-01': '날짜 형식', '3': '정상'}})
        show('키 "13" · "2026-01"', f'HTTP {r.status_code}',
             f"저장값 키={sorted((d.get('monthlyProgress') or {}).keys())}")

        print('5. 액션아이템 날짜 형식이 YYYY-MM-DD 가 아님')
        r, d = mkproj({'과제년도': 2026, '액션아이템목록': [
            {'id': 'a1', '제목': '탐침', '목표일': '2026/03/31', '완료여부': True,
             '완료일': '3월 20일', '월별내용': {}, '세부항목목록': []}]})
        ai = (d.get('actionItems') or [{}])[0]
        show('목표일 "2026/03/31" · 완료일 "3월 20일"', f'HTTP {r.status_code}',
             f"저장값 목표일={ai.get('목표일')!r} 완료일={ai.get('완료일')!r}")

        print('6. 상세정보에 enabled 를 빼면')
        r, d = mkproj({'과제년도': 2026,
                       '상세정보_과제개요': {'items': [{'text': '한 줄', 'children': []}]}})
        ov = d.get('detailOverview') or {}
        show('enabled 없음', f'HTTP {r.status_code}',
             f"저장값={ov} — 화면은 이 섹션을 통째로 건너뛴다")

        print('7. 성과: 월별실적을 넣었는데 월별실적여부=false')
        r = c.post('/api/dt-v2/performances', headers=H, json={
            'fields': {'성과항목': '[공통] 탐침 월별', '대분류': '품질향상',
                       '소분류': '예측 정확도', '성과년도': 2026, '단위': '%',
                       '월별실적': [{'월': 1, '값': 10}], '월별실적여부': False},
            'actor_mode': 'ai', 'ignore_unknown': True, 'reason': '탐침'})
        d = (r.get_json() or {}).get('data', {})
        if d.get('uuid'):
            MADE_F.append(d['uuid'])
        show('월별실적 O · 여부 false', f'HTTP {r.status_code}',
             f"저장값 월별실적={d.get('monthlyValues')} 여부={d.get('isMonthly')}"
             ' — 화면은 여부가 true 일 때만 읽는다')

        print('8. 성과 실적수준 vs 연결 actualLevel — 같은 값이 두 곳에')
        r = c.post('/api/dt-v2/performances', headers=H, json={
            'fields': {'성과항목': '[공통] 탐침 실적', '대분류': '품질향상',
                       '소분류': '예측 정확도', '성과년도': 2026, '단위': '%',
                       '실적수준': '11'},
            'actor_mode': 'ai', 'ignore_unknown': True, 'reason': '탐침'})
        fd = (r.get_json() or {}).get('data', {})
        MADE_F.append(fd['uuid'])
        r2, pd = mkproj({'과제년도': 2026})
        proj = pd['uuid']
        c.put(f'/api/dt-v2/projects/{proj}/performances', headers=H, json={
            'items': [{'performanceUuid': fd['uuid'], 'contribution': '100',
                       'actualLevel': '99'}], 'reason': '탐침'})
        ln = Dt2ProjectPerformance.query.filter_by(project_uuid=proj).first()
        show('성과 실적수준=11 · 연결 actualLevel=99', 'HTTP 200',
             f'성과.실적수준={fd.get("actualLevel")!r} · 연결.actualLevel='
             f'{ln.actual_level!r} — 서로 다른 값이 그대로 공존한다')

        print('9. 기여도 합계가 100 이 아님')
        r3 = c.put(f'/api/dt-v2/projects/{proj}/performances', headers=H, json={
            'items': [{'performanceUuid': fd['uuid'], 'contribution': '40'}],
            'reason': '탐침'})
        w = ((r3.get_json() or {}).get('data') or {}).get('contributionWarnings')
        show('기여도 40 (합 40)', f'HTTP {r3.status_code}',
             f'contributionWarnings={w} — 막지 않고 경고만')

        print('정리')
        for u in MADE_P:
            Dt2ProjectPerformance.query.filter_by(project_uuid=u).delete()
            Dt2ProjectChange.query.filter_by(project_uuid=u).delete()
            Dt2ProjectHistory.query.filter_by(project_uuid=u).delete()
        Dt2Project.query.filter(Dt2Project.uuid.in_(MADE_P)).delete(
            synchronize_session=False)
        Dt2PerformanceHistory.query.filter(
            Dt2PerformanceHistory.performance_uuid.in_(MADE_F)).delete(
                synchronize_session=False)
        Dt2Performance.query.filter(Dt2Performance.uuid.in_(MADE_F)).delete(
            synchronize_session=False)
        db.session.commit()
        print(f'  과제 {len(MADE_P)}건 · 성과 {len(MADE_F)}건 삭제')
    return 0


if __name__ == '__main__':
    sys.exit(main())
