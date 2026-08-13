"""
입력 형식 검증·정규화 확인. (2026-08-03)

`applied` 로 성공이 돌아가는데 **화면에서만 어긋나던** 조합들을 서버가 잡는지 본다.
탐침(dt3_probe_mcp_input_risks.py)에서 전부 통과해 버렸던 것들이다.

  A  시작/종료 월 범위 밖은 400 ★
  B  시작 > 종료(역전)는 400 ★
  C  날짜가 YYYY-MM-DD 가 아니면 400 (액션아이템·이슈·세부항목) ★
  D  빈 날짜는 허용 — 미완료·미해결 표시다
  E  월간진척 키가 "1"~"12" 가 아니면 400 ★
  F  이슈: 미해결이면 해결일이 비워진다 (액션아이템과 같은 규칙) ★
  G  정상 입력은 그대로 통과 (과잉 차단이 아닌지)
  H  기존 100건이 새 규칙을 전부 통과한다 ★★

실행:  venv/Scripts/python.exe scripts/dt3_test_input_shapes.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                    # noqa: E402

from app import create_app                                            # noqa: E402
from app.extensions import db                                         # noqa: E402
from app.modules.auth.models import User                              # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import (            # noqa: E402
    Dt2Project, Dt2ProjectChange, Dt2ProjectHistory, Dt2ProjectPerformance,
)
from app.modules.digital_twin_dashboard.routes_v2 import (            # noqa: E402
    _validate_shapes, normalize_issues,
)

FAIL, MADE = [], []


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

        def mk(fields):
            r = c.post('/api/dt-v2/projects', headers=H, json={
                'fields': {'과제명': '[형식검증] 과제', '과제년도': 2026, **fields},
                'actor_mode': 'ai', 'ignore_unknown': True, 'reason': '형식 검증'})
            d = (r.get_json() or {}).get('data', {})
            if r.status_code == 201 and d.get('uuid'):
                MADE.append(d['uuid'])
            return r, d

        def msg(r):
            return (r.get_json() or {}).get('message', '')

        print('A  시작/종료 월 범위 ★')
        r, _ = mk({'시작': 0, '종료': 99})
        check('400', r.status_code, 400)
        check_true('무엇이 틀렸는지 알려준다', '1~12' in msg(r))
        check('0/99 는 안 만들어졌다', Dt2Project.query.filter(
            Dt2Project.start_month == 0).count(), 0)

        print('B  시작 > 종료 ★')
        r, _ = mk({'시작': 11, '종료': 3})
        check('400', r.status_code, 400)
        check_true('역전을 지목한다', '뒤입니다' in msg(r))

        print('C  날짜 형식 ★')
        r, _ = mk({'액션아이템목록': [
            {'id': 'a1', '제목': 'x', '목표일': '2026/03/31', '완료여부': False,
             '완료일': '', '세부항목목록': []}]})
        check('목표일 슬래시 → 400', r.status_code, 400)
        # 세부항목이 있으면 상위 완료일은 **파생값이라** 보낸 값이 버려진다.
        # 그래서 상위에 이상한 날짜를 넣어도 저장되지 않는다 — 400 이 아니라
        # 정규화로 막히는 것이 맞다. (normalize_action_items 가 먼저 돈다)
        r, d = mk({'액션아이템목록': [
            {'id': 'a1', '제목': 'x', '목표일': '2026-03-31', '완료여부': True,
             '완료일': '3월 20일',
             '세부항목목록': [{'id': 1, '내용': 'y', '완료여부': True,
                              '완료일': '2026-03-20'}]}]})
        check('세부항목 있으면 상위 완료일은 파생으로 덮인다',
              (d.get('actionItems') or [{}])[0].get('완료일'), '2026-03-20')

        # 세부항목이 없으면 상위 완료일이 정본이라 파생이 안 된다 → 검증이 잡아야 한다
        r, _ = mk({'액션아이템목록': [
            {'id': 'a1', '제목': 'x', '목표일': '2026-03-31', '완료여부': True,
             '완료일': '3월 20일', '세부항목목록': []}]})
        check('세부항목 없으면 상위 완료일 검증 → 400', r.status_code, 400)
        r, _ = mk({'액션아이템목록': [
            {'id': 'a1', '제목': 'x', '목표일': '2026-03-31', '완료여부': True,
             '완료일': '2026-03-20',
             '세부항목목록': [{'id': 1, '내용': 'y', '완료여부': True,
                              '완료일': '20260320'}]}]})
        check('세부항목 날짜도 본다 → 400', r.status_code, 400)
        r, _ = mk({'이슈목록': [
            {'id': 1, '제목': 'x', '코멘트': 'y', '등록일': '6/1',
             '해결여부': False, '해결일': ''}]})
        check('이슈 등록일 → 400', r.status_code, 400)

        print('D  빈 날짜는 허용 (미완료 표시)')
        r, d = mk({'액션아이템목록': [
            {'id': 'a1', '제목': 'x', '목표일': '2026-03-31', '완료여부': False,
             '완료일': '', '세부항목목록': [
                 {'id': 1, '내용': 'y', '완료여부': False, '완료일': ''}]}]})
        check('201', r.status_code, 201)

        print('E  월간진척 키 ★')
        r, _ = mk({'월간진척현황': {'13': 'x'}})
        check('13월 → 400', r.status_code, 400)
        r, _ = mk({'월간진척현황': {'2026-01': 'x'}})
        check('날짜 키 → 400', r.status_code, 400)
        check_true('잘못된 키를 지목한다', "'2026-01'" in msg(r))
        r, d = mk({'월간진척현황': {'1': 'x', '12': 'y'}})
        check('1·12 는 통과', r.status_code, 201)

        print('F  이슈 정규화 — 미해결이면 해결일을 비운다 ★')
        r, d = mk({'이슈목록': [
            {'id': 1, '제목': 'x', '코멘트': 'y', '등록일': '2026-06-01',
             '해결여부': False, '해결일': '2026-07-01'}]})
        check('201', r.status_code, 201)
        check('해결일이 비워짐', (d.get('issues') or [{}])[0].get('해결일'), '')
        # 해결된 건은 날짜를 지우지 않는다
        r, d = mk({'이슈목록': [
            {'id': 1, '제목': 'x', '코멘트': 'y', '등록일': '2026-06-01',
             '해결여부': True, '해결일': '2026-07-01'}]})
        check('해결된 건은 보존', (d.get('issues') or [{}])[0].get('해결일'),
              '2026-07-01')
        # 함수 단위로도 확인
        out = normalize_issues([{'해결여부': False, '해결일': '2026-01-01'}])
        check('normalize_issues 단위', out[0]['해결일'], '')

        print('G  정상 입력은 그대로 통과 (과잉 차단이 아닌지)')
        r, d = mk({'시작': 1, '종료': 12,
                   '액션아이템목록': [
                       {'id': 'a1', '제목': 'x', '목표일': '2026-06-30',
                        '완료여부': True, '완료일': '2026-06-20',
                        '세부항목목록': [{'id': 1, '내용': 'y', '완료여부': True,
                                          '완료일': '2026-06-20'}]}],
                   '이슈목록': [{'id': 1, '제목': 'x', '코멘트': 'y',
                                 '등록일': '2026-06-01', '해결여부': False,
                                 '해결일': ''}],
                   '월간진척현황': {'1': 'a', '7': 'b'}})
        check('201', r.status_code, 201)
        check('진행률 파생', d.get('progress'), 100)

        print('H  기존 2026 과제 100건이 새 규칙을 통과한다 ★★')
        bad = []
        for p in Dt2Project.query.filter(
                Dt2Project.year == 2026, Dt2Project.is_deleted.is_(False)).all():
            probe = {'start_month': p.start_month, 'end_month': p.end_month,
                     'action_items_json': p.action_items_json or [],
                     'issues_json': p.issues_json or [],
                     'monthly_progress_json': p.monthly_progress_json or {}}
            if _validate_shapes(probe, {}) is not None:
                bad.append(p.code)
        check('규칙 위반 과제', len(bad), 0)
        if bad:
            print('        ', bad[:10])

        print('정리')
        for u in MADE:
            Dt2ProjectPerformance.query.filter_by(project_uuid=u).delete()
            Dt2ProjectChange.query.filter_by(project_uuid=u).delete()
            Dt2ProjectHistory.query.filter_by(project_uuid=u).delete()
        Dt2Project.query.filter(Dt2Project.uuid.in_(MADE)).delete(
            synchronize_session=False)
        db.session.commit()
        check('테스트 데이터 정리', Dt2Project.query.filter(
            Dt2Project.title.like('[형식검증]%')).count(), 0)

    print()
    if FAIL:
        print(f'실패 {len(FAIL)}건: {", ".join(FAIL)}')
        return 1
    print('전부 통과')
    return 0


if __name__ == '__main__':
    sys.exit(main())
