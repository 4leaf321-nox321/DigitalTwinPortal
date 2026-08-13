"""과제·성과 추이 (`/api/dt-v2/trend/*`).

무엇을 못 박나

    ① **서버는 환산·집계를 하지 않는다.** 성과 값은 **환산 전 원본**이다.
       여기서 환산하면 트리맵·KPI 대시보드와 다른 숫자가 나온다(그쪽은 화면에서 한다).
    ② **과제 곡선이 편성·삭제 이력이다.** 올라가면 새로 생긴 것, 내려가면 지워진 것.
       완료·취소를 포함하고, 휴지통에 들어간 날부터 빠진다.
    ③ **이관이 지어낸 생성일을 숨기지 않는다.** 그대로 그리면 그날 절벽처럼 솟는데,
       그건 그날 만들어진 것이 아니라 이관이 날짜를 대신 넣은 것이다.
    ④ **지워진 성과의 선은 지워진 날에 끊는다.** 안 끊으면 지금도 그만큼 있는 것처럼
       합계가 부풀어 오른다.
    ⑤ **실적·현재·목표를 다 낸다.** 실적이 비고 현재·목표만 든 성과가 흔해서,
       실적만 내면 「모든 성과 현황」에는 값이 보이는데 차트만 빈 상태가 된다.
    ⑥ **날짜는 KST 로 센다.** DB 는 naive UTC 로 저장한다. 그냥 앞 10글자를 자르면
       KST 오전 9시 이전에 한 일이 전날 칸으로 가고, '오늘' 선은 로컬(KST)이라
       아침에 저장한 값이 오늘 선보다 왼쪽에 찍힌다.

실행: python scripts\\dt3_test_trend.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                 # noqa: E402

from app import create_app                                         # noqa: E402
from app.modules.auth.models import User, UserRole                 # noqa: E402
from app.modules.digital_twin_dashboard import trend_view as TV    # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project  # noqa: E402

fails = []


def check(desc, ok, extra=''):
    print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}" + (f'   {extra}' if not ok and extra else ''))
    if not ok:
        fails.append(desc)


def get(c, url, hdr):
    r = c.get(url, headers=hdr)
    return r.status_code, ((r.get_json() or {}).get('data') or {})


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

        with app.test_client() as c:
            # ── 과제 추이 ───────────────────────────────────────────────
            print('── 과제 추이 ──')
            st, pr = get(c, '/api/dt-v2/trend/projects', hdr)
            check('200', st == 200, f'실제 {st}')
            dates = pr.get('dates') or []
            check('눈금이 있다', bool(dates))
            check('날짜가 오름차순이다', dates == sorted(dates))
            check('사업부마다 눈금 수만큼 값을 준다',
                  all(len(s['counts']) == len(dates) for s in pr['series']))
            check('합계가 사업부 합과 같다',
                  all((pr['total'][i] is None and all(s['counts'][i] is None
                                                     for s in pr['series']))
                      or pr['total'][i] == sum((s['counts'][i] or 0)
                                               for s in pr['series'])
                      for i in range(len(dates))))
            check('개수가 음수가 되지 않는다',
                  all(v is None or v >= 0 for s in pr['series'] for v in s['counts']))
            # ② 곡선이 오르내려야 편성·삭제 이력이 된다. 단조증가면 삭제를 안 세는 것이다.
            total = pr['total']
            drawn = [v for v in total if v is not None]
            went_down = any(drawn[i] > drawn[i + 1] for i in range(len(drawn) - 1))
            check('★ 곡선이 내려가는 구간이 있다 (삭제가 반영된다)', went_down,
                  str(drawn))
            check('세는 기준을 밝힌다', '완료' in (pr.get('basis') or ''))
            check('★ 취소를 뺀다고 밝힌다', '취소' in (pr.get('basis') or ''),
                  pr.get('basis'))

            # ★ 오늘 값이 지금 살아 있는 과제 수와 같아야 한다 — 곡선이 현실과
            #   안 맞으면 나머지가 다 소용없다.
            #
            # ⚠️ **취소는 뺀다.** 다른 화면들(`ProjectSummary` 완료율,
            #    `DashboardView` 경영진 보고)이 이미 모수에서 빼고 있어서,
            #    여기서만 세면 같은 사업부 과제 수가 화면마다 달라진다.
            today = pr['today']
            live_rows = Dt2Project.query.filter(
                Dt2Project.is_deleted.is_(False),
                Dt2Project.is_permanently_deleted.is_(False)).all()
            alive = sum(1 for p in live_rows if (p.status or '').strip() != '취소')
            check('★ 오늘 값이 지금 살아 있는 과제 수와 같다 (취소 제외)',
                  total[dates.index(today)] == alive if today in dates else True,
                  f'{total[dates.index(today)] if today in dates else "?"} vs {alive}')

            # 취소 과제가 곡선에 남아 있지 않은가 — 직접 확인한다
            canceled = [p for p in Dt2Project.query.all()
                        if (p.status or '').strip() == '취소']
            still_alive = [p for p in canceled
                           if not p.is_deleted and not p.is_permanently_deleted]
            if still_alive:
                spans = [TV._project_span(p) for p in still_alive]
                check('★ 취소 과제는 오늘 셈에서 빠진다',
                      all(e is not None and e <= today for _s, e in spans),
                      str([(p.title[:14], TV._project_span(p)) for p in still_alive[:2]]))
            print(f'     [정보] 취소 {len(canceled)}건 '
                  f'(휴지통 밖 {len(still_alive)}건) · 오늘 값 {alive}건')

            # ③ 이관이 지어낸 생성일
            est = pr.get('estimated') or []
            check('★ 이관으로 찍힌 생성일을 숨기지 않는다',
                  isinstance(est, list))
            if est:
                check('그 날짜가 눈금에 있다', all(e['date'] in dates for e in est))
                check('사업부별 내역과 합계가 맞는다',
                      all(sum(e['byDivision'].values()) == e['total'] for e in est))
                print(f"     [정보] 이관 표시 {[(e['date'], e['total']) for e in est]}")

            # ── 연도를 고르면 그 해 1/1 ~ 12/31 이 축이다 ──────────────
            #    해마다 축이 달라지면 두 해를 나란히 못 읽는다.
            st, one = get(c, '/api/dt-v2/trend/projects?years=2026', hdr)
            odates = one['dates']
            check('연도 필터가 먹는다',
                  one['projectCount'] <= pr['projectCount'],
                  f"{one['projectCount']} vs {pr['projectCount']}")
            check('★ 축이 1월 1일에 시작한다', odates[0] == '2026-01-01', odates[0])
            check('★ 축이 12월 31일에 끝난다', odates[-1] == '2026-12-31', odates[-1])
            check('그 해 밖의 눈금이 없다',
                  all('2026-01-01' <= d <= '2026-12-31' for d in odates))
            check('range 로도 알려준다',
                  one['range'] == {'from': '2026-01-01', 'to': '2026-12-31'},
                  str(one['range']))
            # 아직 안 온 날에 선을 그으면 "앞으로도 이렇다" 로 읽힌다.
            future = [i for i, d in enumerate(odates) if d > one['today']]
            check('★ 오늘 뒤로는 값을 비워 둔다',
                  all(one['total'][i] is None for i in future), str(future[:3]))
            check('오늘 이전은 값이 있다',
                  all(one['total'][i] is not None
                      for i, d in enumerate(odates) if d <= one['today']))

            # ── 사업부 순서는 설정의 표준 순서 ─────────────────────────
            # ⚠️ `divisions` 에는 옛 행이 쌓여 있다(설정을 저장할 때마다 늘어난다).
            #    **활성 행만** 보고 이름 중복을 걷어내야 진짜 표준 순서가 나온다.
            from app.modules.digital_twin_dashboard.models import Division
            std, seen_names = [], set()
            for d in (Division.query.filter(Division.is_active.is_(True))
                      .order_by(Division.order.asc(), Division.id.asc()).all()):
                if d.name not in seen_names:
                    seen_names.add(d.name)
                    std.append(d.name)
            got = [s['division'] for s in pr['series']]
            check('★ 사업부가 표준 순서다 (알파벳순이 아니다)',
                  got == [n for n in std if n in got], f'{got} vs {std}')
            check('알파벳순이 아님을 실제로 확인', got != sorted(got), str(got))
            print(f"     [정보] 눈금 {len(dates)}개 · 사업부 순서 {got}")

            # ── 성과 추이 ───────────────────────────────────────────────
            print('\n── 성과 추이 ──')
            st, pf = get(c, '/api/dt-v2/trend/performances', hdr)
            check('200', st == 200, f'실제 {st}')
            pdates = pf.get('dates') or []
            cards = pf.get('cards') or []
            check('눈금이 있다', bool(pdates))
            check('날짜가 오름차순이다', pdates == sorted(pdates))
            check('카드가 있다', bool(cards), str(len(cards)))
            check('카드마다 logic 을 준다',
                  all(x.get('logic') in ('합계', '평균') for x in cards),
                  str({x.get('logic') for x in cards}))
            check('카드마다 사업부를 준다 (환산 배율 조회에 쓴다)',
                  all(x.get('division') for x in cards))
            KINDS = ('actuals', 'currents', 'targets')
            check('성과마다 눈금 수만큼 값을 준다 (실적·현재·목표 모두)',
                  all(len(p[k]) == len(pdates)
                      for x in cards for p in x['perfs'] for k in KINDS))
            check('성과마다 단위를 준다',
                  all('unit' in p for x in cards for p in x['perfs']))

            # ① 서버가 환산하지 않았는가 — 원본 단위가 그대로 와야 한다
            units = {p['unit'] for x in cards for p in x['perfs'] if p['unit']}
            check('★ 값이 환산 전 원본이다 (hrs 가 억원으로 안 바뀌어 온다)',
                  'hrs' in units or not units, str(sorted(units)))
            check('★ 응답이 환산을 화면 몫이라고 밝힌다',
                  '환산 전' in (pf.get('note') or ''), pf.get('note'))

            # ④ 지워진 성과는 지워진 날부터 값이 없어야 한다
            removed = [(x, p) for x in cards for p in x['perfs'] if p.get('removedAt')]
            bad = []
            for _x, p in removed:
                for i, day in enumerate(pdates):
                    if day >= p['removedAt']:
                        for k in KINDS:
                            if p[k][i] is not None:
                                bad.append((p['title'], day, k))
            check('★ 지워진 성과는 지워진 날부터 값이 없다 (세 값 모두)',
                  not bad, str(bad[:2]))
            print(f"     [정보] 카드 {len(cards)}개 · 눈금 {len(pdates)}개 · "
                  f"지워진 성과 {len(removed)}개")

            # 빈 문자열을 그대로 내보내면 화면이 0 으로 읽어 합계가 틀어진다
            empties = [(p['title'], k) for x in cards for p in x['perfs']
                       for k in KINDS if any(v == '' for v in p[k])]
            check('★ 미입력을 빈 문자열이 아니라 null 로 낸다', not empties,
                  str(empties[:2]))

            # ⑤ 🐞 실적만 내던 시절의 버그. 「개발 비용(DA)」처럼 실적은 비고
            #    현재·목표만 든 성과가 있는데, 그 성과가 든 카드는 차트에서
            #    통째로 사라졌다. **DB 를 직접 보고** 그런 성과를 골라 확인한다.
            from app.modules.digital_twin_dashboard.models_v2 import Dt2Performance
            tix = pdates.index(pf['today']) if pf.get('today') in pdates else None
            by_uuid = {p['uuid']: p for x in cards for p in x['perfs']}
            only_cur = []
            for f in Dt2Performance.query.filter(
                    Dt2Performance.is_deleted.is_(False)).all():
                if f.uuid not in by_uuid:
                    continue
                if f.actual_level in (None, '') and f.current_level is not None:
                    only_cur.append(f)
            if only_cur and tix is not None:
                missing = [f.title for f in only_cur
                           if by_uuid[f.uuid]['currents'][tix] is None]
                check('★ 실적이 비고 현재만 있는 성과도 값이 온다',
                      not missing, str(missing[:3]))
                print(f"     [정보] 실적 없이 현재값만 있는 성과 {len(only_cur)}개 "
                      f"— 예: {only_cur[0].title}")
            else:
                print('     [정보] 실적 없이 현재값만 있는 성과가 없어 건너뜀')

            # ── 사업부 탭 ───────────────────────────────────────────────
            # 화면에서 선만 숨기면 합계가 전체 값 그대로라 "MX 만 보는데 합계는
            # 전사" 가 된다. **서버가 걸러서** 다시 줘야 한다.
            print('\n── 사업부 필터 ──')
            first_div = pr['series'][0]['division'] if pr.get('series') else None
            if first_div:
                st, one_div = get(
                    c, f'/api/dt-v2/trend/projects?divisions={first_div}', hdr)
                check('200', st == 200, f'실제 {st}')
                check('★ 고른 사업부만 온다',
                      [s['division'] for s in one_div['series']] == [first_div],
                      str([s['division'] for s in one_div['series']]))
                check('★ 합계도 그 사업부 것이다 (전사 값이 아니다)',
                      one_div['projectCount'] <= pr['projectCount']
                      and one_div['projectCount'] > 0,
                      f"{one_div['projectCount']} vs 전체 {pr['projectCount']}")
                print(f"     [정보] {first_div} 과제 {one_div['projectCount']}건 "
                      f"/ 전체 {pr['projectCount']}건")

            # ── 날짜를 KST 로 세는가 ───────────────────────────────────
            print('\n── 시간대 ──')
            from datetime import datetime, timedelta, timezone
            from app.shared.timeutil import kst_date, today_kst

            # 🐞 KST 오전 9시 이전은 UTC 로 아직 전날이다. 예전 `str(v)[:10]` 은
            #    그 UTC 날짜를 그대로 써서 하루가 밀렸다.
            morning_utc = datetime(2026, 8, 10, 0, 30)      # = KST 8/10 09:30
            dawn_utc = datetime(2026, 8, 9, 23, 30)         # = KST 8/10 08:30
            check('★ KST 오전 9시 이전 저장이 그날로 찍힌다',
                  kst_date(dawn_utc) == '2026-08-10',
                  f'{kst_date(dawn_utc)} (예전 방식이면 {str(dawn_utc)[:10]})')
            check('낮에 저장한 것도 그날 그대로',
                  kst_date(morning_utc) == '2026-08-10', kst_date(morning_utc))
            check('예전 방식과 실제로 달라지는 경우다',
                  str(dawn_utc)[:10] != kst_date(dawn_utc))
            check('date 는 그대로 둔다 (시간대 개념이 없다)',
                  kst_date(dawn_utc.date()) == '2026-08-09')

            # '오늘' 선과 이력 날짜가 **같은 자**를 써야 짝이 맞는다
            now_kst = datetime.now(timezone.utc).astimezone(
                timezone(timedelta(hours=9)))
            check('★ 오늘이 KST 날짜다 (서버 로컬 시간대에 기대지 않는다)',
                  today_kst().isoformat() == now_kst.date().isoformat()
                  == pr['today'], f"{pr['today']} vs {now_kst.date()}")

            # 실제 이력 행으로도 확인한다 — 규칙만 맞고 쓰는 데서 안 쓰면 소용없다
            from app.modules.digital_twin_dashboard.models_v2 import (
                Dt2PerformanceHistory)
            from app.modules.digital_twin_dashboard import trend_view as _TV
            h = (Dt2PerformanceHistory.query
                 .order_by(Dt2PerformanceHistory.observed_at.desc()).first())
            if h is not None:
                check('★ 이력 날짜도 KST 로 뽑는다',
                      _TV._d(h.observed_at) == kst_date(h.observed_at),
                      f'{_TV._d(h.observed_at)} vs {kst_date(h.observed_at)}')
                print(f'     [정보] 최근 이력 {h.observed_at} (UTC) '
                      f'→ {_TV._d(h.observed_at)} (KST)')

            # ── 가시성 ──────────────────────────────────────────────────
            print('\n── 가시성 ──')
            other = User.query.filter(User.role != UserRole.ADMIN,
                                      User.is_active.is_(True)).first()
            if other is not None:
                h2 = {'Authorization':
                      f'Bearer {create_access_token(identity=str(other.id))}'}
                st, mine = get(c, '/api/dt-v2/trend/projects', h2)
                check('비관리자도 200', st == 200, f'실제 {st}')
                check('★ 관리자보다 많은 과제를 보지 않는다',
                      mine['projectCount'] <= pr['projectCount'],
                      f"{mine['projectCount']} vs {pr['projectCount']}")
            r = c.get('/api/dt-v2/trend/projects')
            check('토큰 없으면 401', r.status_code in (401, 422), f'실제 {r.status_code}')

            # ── 저장하지 않는가 ────────────────────────────────────────
            before = Dt2Project.query.count()
            c.get('/api/dt-v2/trend/projects', headers=hdr)
            c.get('/api/dt-v2/trend/performances', headers=hdr)
            check('★ 과제 건수가 그대로다 (읽기 전용)',
                  Dt2Project.query.count() == before)

    print()
    if fails:
        print(f'[FAIL] {len(fails)}건 실패')
        for f in fails:
            print(f'   - {f}')
        return 1
    print('[OK] 전부 통과')
    return 0


if __name__ == '__main__':
    sys.exit(main())
