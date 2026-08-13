"""과제 곡선의 날짜 메모 (`/api/dt-v2/trend/{notes,changes}`).

무엇을 못 박나

    ① **곡선과 같은 기준으로 센다.** 그날의 변동 목록은 `_project_span` 에서
       나온다. 여기서 따로 세면 "곡선은 5건 줄었다는데 목록은 3건" 이 된다.
    ② **쓰기는 사무국·관리자만.** 읽기는 탭을 볼 수 있는 사람 전부다.
    ③ **날짜를 고치면 연도 칸도 옮긴다.** 안 옮기면 옛 해에 남아, 그 연도를
       볼 때만 나타나는 유령 메모가 된다.
    ④ **전사 메모는 어느 사업부 탭에서도 보인다.** 그날의 설명이라 숨기면
       탭마다 다른 이야기가 된다.
    ⑤ **읽기 API 는 아무것도 쓰지 않는다.**

실행: python scripts\\dt3_test_trend_notes.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                     # noqa: E402

from app import create_app                                             # noqa: E402
from app.extensions import db                                          # noqa: E402
from app.modules.auth.models import User, UserRole                     # noqa: E402
from app.modules.digital_twin_dashboard import trend_notes as TN       # noqa: E402
from app.modules.digital_twin_dashboard import trend_view as TV        # noqa: E402
from app.modules.digital_twin_dashboard.models import ModuleSettings   # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project    # noqa: E402

fails = []
MADE = []           # 이 시험이 만든 메모 id — 끝에 반드시 지운다


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
        admin = User.query.filter_by(role=UserRole.ADMIN).first()
        if admin is None:
            check('admin 계정이 있다', False)
            return 1
        hdr = {'Authorization': f'Bearer {create_access_token(identity=str(admin.id))}'}

        # 쓰기 권한이 없는 사람 — 403 을 확인할 상대
        plain = User.query.filter(User.role.notin_(list(TN.P.GLOBAL_EDIT_ROLES)),
                                  User.is_active.is_(True)).first()

        # ⚠️ 시험 전 원본을 통째로 떠 둔다. 이 키는 **운영 데이터**라
        #    시험이 남긴 메모가 화면에 그대로 뜨면 안 된다.
        row = ModuleSettings.query.filter_by(
            module_name=TN.MODULE, settings_key=TN.KEY).first()
        backup = dict(row.settings_data or {}) if row else None

        try:
            with app.test_client() as c:
                # ── 그날 무슨 일이 있었나 ──────────────────────────────
                #
                # ① 곡선과 **같은 범위**를 봐야 한다. 차트가 필터를 걸고 있으면
                #    변동 목록도 같은 필터라야 한다.
                #
                # 🐞 처음엔 연도를 안 걸었다. 2026년 차트에서 8/5 을 누르면
                #    **그 곡선을 1건도 움직이지 않은** 2025년 과제 200건이 목록에
                #    떴다(이관으로 생성일이 그날 찍힌 것들). 그래서 필터를 건 경우와
                #    안 건 경우를 **둘 다** 대조한다.
                print('── 그날의 변동 ──')
                for label, qs in (('필터 없음', ''),
                                  ('2026년만', '&years=2026'),
                                  ('2026년 · MX', '&years=2026&divisions=MX')):
                    scope_qs = qs.lstrip('&')
                    st, pr = _get(c, f'/api/dt-v2/trend/projects?{scope_qs}', hdr)
                    check(f'과제 추이 200 ({label})', st == 200, f'실제 {st}')
                    dates, total = pr['dates'], pr['total']

                    # 곡선이 실제로 움직인 날을 **전부** 돌며 대조한다.
                    # 한 날짜만 보면 우연히 맞는 날을 고를 수 있다.
                    moved = [(dates[i], total[i] - total[i - 1])
                             for i in range(1, len(dates))
                             if total[i] is not None and total[i - 1] is not None
                             and total[i] != total[i - 1]]
                    if not moved:
                        print(f'     [정보] {label}: 움직인 구간이 없어 건너뜀')
                        continue

                    bad = []
                    for day, step in moved:
                        st, ch = _get(
                            c, f'/api/dt-v2/trend/changes?date={day}{qs}', hdr)
                        if st != 200:
                            bad.append((day, f'HTTP {st}'))
                            continue
                        # 곡선의 증감 = 그날 들어온 수 − 그날 빠진 수
                        got = ch['addedCount'] - ch['removedCount']
                        if got != step:
                            bad.append((day, f'목록 {got:+d} vs 곡선 {step:+d}'))
                    check(f'★ 곡선이 움직인 날마다 목록과 개수가 맞는다 ({label})',
                          not bad, f'{len(moved)}일 중 {len(bad)}일 어긋남 {bad[:3]}')
                    print(f'     [정보] {label}: 움직인 날 {len(moved)}일 전부 대조')

                # 마지막으로 본 범위에서 한 건 골라 세부를 확인한다
                day = moved[-1][0]
                st, ch = _get(c, f'/api/dt-v2/trend/changes?date={day}', hdr)
                check('빠진 까닭을 밝힌다',
                      all(r.get('why') in ('휴지통', '영구삭제', '취소')
                          for r in ch['removed']),
                      str({r.get('why') for r in ch['removed']}))
                check('사업부 내역 합이 총계와 같다',
                      sum(ch['removedByDivision'].values()) <= ch['removedCount'])
                check('잘라 보냈으면 알린다',
                      ch['truncated'] == (ch['removedCount'] > len(ch['removed'])
                                          or ch['addedCount'] > len(ch['added'])),
                      f"truncated={ch['truncated']} "
                      f"{len(ch['removed'])}/{ch['removedCount']}")

                # ★ 연도 필터가 **실제로 걸리는가.** 안 걸리는데 위 대조가 통과하면
                #   그건 우연일 수 있다. 그래서 "다른 해 과제가 실제로 빠지는 날"을
                #   찾아서 확인한다 — 없으면 우연 여부를 판정할 수 없으므로 그렇게 밝힌다.
                st, base = _get(c, '/api/dt-v2/trend/projects', hdr)
                diff_day = None
                for d0 in base['dates']:
                    st, a = _get(c, f'/api/dt-v2/trend/changes?date={d0}', hdr)
                    st, b = _get(c, f'/api/dt-v2/trend/changes?date={d0}&years=2026',
                                 hdr)
                    if (a['addedCount'], a['removedCount']) \
                            != (b['addedCount'], b['removedCount']):
                        diff_day = (d0, a, b)
                        break
                if diff_day:
                    d0, a, b = diff_day
                    check('★ 연도를 걸면 다른 해 과제가 목록에서 빠진다',
                          b['addedCount'] <= a['addedCount']
                          and b['removedCount'] <= a['removedCount'],
                          f"{d0}: 2026만 +{b['addedCount']}/-{b['removedCount']} vs "
                          f"전체 +{a['addedCount']}/-{a['removedCount']}")
                    print(f"     [정보] {d0}: 전체 +{a['addedCount']}/-{a['removedCount']}"
                          f" · 2026년만 +{b['addedCount']}/-{b['removedCount']}")
                else:
                    print('     [정보] 다른 해 과제가 낀 날짜가 없어 필터 대조를 건너뜀')

                check('날짜가 이상하면 400',
                      _get(c, '/api/dt-v2/trend/changes?date=abc', hdr)[0] == 400)

                # ── 쓰기 권한 ──────────────────────────────────────────
                print('\n── 권한 ──')
                if plain is not None:
                    h2 = {'Authorization':
                          f'Bearer {create_access_token(identity=str(plain.id))}'}
                    r = c.post('/api/dt-v2/trend/notes', headers=h2,
                               json={'date': '2026-07-15', 'text': '몰래 쓰기'})
                    check('★ 권한 없는 사람이 쓰면 403', r.status_code == 403,
                          f'실제 {r.status_code}')
                    check('그래도 읽기는 된다',
                          _get(c, '/api/dt-v2/trend/notes', h2)[0] == 200)
                    st, mine = _get(c, '/api/dt-v2/trend/notes', h2)
                    check('★ 화면이 편집 버튼을 감출 수 있게 알려준다',
                          mine.get('canEdit') is False, str(mine.get('canEdit')))
                else:
                    print('     [정보] 권한 없는 계정이 없어 건너뜀')

                st, mine = _get(c, '/api/dt-v2/trend/notes', hdr)
                check('관리자에게는 canEdit 이 참', mine.get('canEdit') is True)

                # ── 만들고 · 고치고 · 지우고 ──────────────────────────
                print('\n── 메모 ──')
                r = c.post('/api/dt-v2/trend/notes', headers=hdr,
                           json={'date': '2026-07-15', 'division': 'MX',
                                 'text': '상반기 과제 정리'})
                check('만들면 200', r.status_code == 200, f'실제 {r.status_code}')
                note = (r.get_json() or {}).get('data', {}).get('note') or {}
                if note.get('id'):
                    MADE.append(note['id'])
                check('id 를 준다', bool(note.get('id')))
                check('누가 썼는지 남긴다', bool(note.get('createdBy')), str(note))

                r = c.post('/api/dt-v2/trend/notes', headers=hdr,
                           json={'date': '2026-07-15', 'text': ''})
                check('내용이 비면 400', r.status_code == 400, f'실제 {r.status_code}')
                r = c.post('/api/dt-v2/trend/notes', headers=hdr,
                           json={'date': '20260715', 'text': 'x'})
                check('날짜 모양이 틀리면 400', r.status_code == 400,
                      f'실제 {r.status_code}')
                r = c.post('/api/dt-v2/trend/notes', headers=hdr,
                           json={'date': '2026-07-15', 'text': 'x' * (TN.TEXT_MAX + 1)})
                check('너무 길면 400', r.status_code == 400, f'실제 {r.status_code}')

                # ④ 전사 메모는 어느 탭에서도 보인다
                r = c.post('/api/dt-v2/trend/notes', headers=hdr,
                           json={'date': '2026-07-20', 'text': '전사 공지'})
                allnote = (r.get_json() or {}).get('data', {}).get('note') or {}
                if allnote.get('id'):
                    MADE.append(allnote['id'])
                check('사업부를 안 주면 전체로 저장한다',
                      allnote.get('division') == TN.ALL, str(allnote.get('division')))

                st, only_mx = _get(c, '/api/dt-v2/trend/notes?divisions=MX', hdr)
                ids = {n['id'] for n in only_mx['notes']}
                check('★ MX 탭에서 MX 메모가 보인다', note.get('id') in ids)
                check('★ MX 탭에서 전사 메모도 보인다', allnote.get('id') in ids)
                st, only_vd = _get(c, '/api/dt-v2/trend/notes?divisions=VD', hdr)
                vd_ids = {n['id'] for n in only_vd['notes']}
                check('★ VD 탭에서는 MX 메모가 안 보인다', note.get('id') not in vd_ids)
                check('VD 탭에서도 전사 메모는 보인다', allnote.get('id') in vd_ids)

                st, y26 = _get(c, '/api/dt-v2/trend/notes?years=2026', hdr)
                check('연도로 거른다', note.get('id') in {n['id'] for n in y26['notes']})
                st, y25 = _get(c, '/api/dt-v2/trend/notes?years=2025', hdr)
                check('다른 해에는 안 나온다',
                      note.get('id') not in {n['id'] for n in y25['notes']})
                check('날짜 오름차순이다',
                      [n['date'] for n in y26['notes']]
                      == sorted(n['date'] for n in y26['notes']))

                # ③ 해를 넘겨 고치면 연도 칸도 옮겨야 한다
                r = c.post('/api/dt-v2/trend/notes', headers=hdr,
                           json={'id': note['id'], 'date': '2025-12-30',
                                 'division': 'MX', 'text': '연도 넘겨 고침'})
                check('수정 200', r.status_code == 200, f'실제 {r.status_code}')
                st, y26 = _get(c, '/api/dt-v2/trend/notes?years=2026', hdr)
                st, y25 = _get(c, '/api/dt-v2/trend/notes?years=2025', hdr)
                check('★ 날짜를 옮기면 2026 에서 사라지고',
                      note['id'] not in {n['id'] for n in y26['notes']})
                check('★ 2025 에서 나온다 (유령 메모가 안 생긴다)',
                      note['id'] in {n['id'] for n in y25['notes']})
                check('내용도 바뀌었다',
                      next(n['text'] for n in y25['notes'] if n['id'] == note['id'])
                      == '연도 넘겨 고침')

                r = c.post('/api/dt-v2/trend/notes', headers=hdr,
                           json={'id': 'nope', 'date': '2026-01-01', 'text': 'x'})
                check('없는 메모를 고치면 400', r.status_code == 400,
                      f'실제 {r.status_code}')

                # ⑤ 읽기 API 가 아무것도 쓰지 않는가
                before = Dt2Project.query.count()
                c.get('/api/dt-v2/trend/notes', headers=hdr)
                c.get('/api/dt-v2/trend/changes?date=2026-08-04', headers=hdr)
                check('★ 읽기 API 는 과제를 건드리지 않는다',
                      Dt2Project.query.count() == before)

                # 지우기
                for nid in list(MADE):
                    r = c.delete(f'/api/dt-v2/trend/notes/{nid}', headers=hdr)
                    check(f'지우면 200 ({nid[:6]})', r.status_code == 200,
                          f'실제 {r.status_code}')
                    MADE.remove(nid)
                r = c.delete('/api/dt-v2/trend/notes/nope', headers=hdr)
                check('없는 것을 지우면 404', r.status_code == 404,
                      f'실제 {r.status_code}')

        finally:
            # 시험이 남긴 것을 **반드시** 되돌린다 — 이 키는 운영 데이터다.
            row = ModuleSettings.query.filter_by(
                module_name=TN.MODULE, settings_key=TN.KEY).first()
            if backup is None:
                if row is not None:
                    db.session.delete(row)
            elif row is not None:
                row.settings_data = backup
                from sqlalchemy.orm.attributes import flag_modified
                flag_modified(row, 'settings_data')
            db.session.commit()
            left = [n for n in TN.list_notes() if n['id'] in MADE]
            check('★ 시험이 남긴 메모가 없다', not left, str(left))

    print()
    if fails:
        print(f'[FAIL] {len(fails)}건 실패')
        for f in fails:
            print(f'   - {f}')
        return 1
    print('[OK] 전부 통과')
    return 0


def _get(c, url, hdr):
    r = c.get(url, headers=hdr)
    return r.status_code, ((r.get_json() or {}).get('data') or {})


if __name__ == '__main__':
    sys.exit(main())
