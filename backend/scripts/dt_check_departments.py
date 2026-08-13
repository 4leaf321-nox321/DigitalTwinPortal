"""
부서·사업부 설정 점검 — **읽기 전용**. 운영에서 돌려도 안전하다.

왜 필요한가
    설정 저장 경로(`_sync_departments`)는 **숫자가 아닌 id 를 새 항목으로 본다.**
    번들 기본값(sampleData.js)은 `id: 'vd_mecha_solution'`, `divisionId: 'vd'` 처럼
    문자열이라, 서버 설정이 빈 상태에서 저장하면
      ① 전체가 새로 만들어지고(이전 세대는 비활성으로 쌓임)
      ② `divisionId` 가 숫자가 아니라서 **사업부 연결이 통째로 None 이 된다**
    개발서버 실측(2026-08-02): 부서 91개 중 88개가 사업부 없음, 설정 테이블 전체가 3벌.

    ②가 조용한 쪽이다. 집계는 과제가 들고 있는 문자열로 그룹을 만들기 때문에
    **총계는 맞고**, 사업부로 접을 때만 '공통' 으로 샌다. 게다가 그 부서에 사람이
    없으면 '공통' 자체가 화면에서 빠져(`totalCount > 0` 필터) 아무 증상도 안 보인다.
    그래서 **화면이 멀쩡해 보여도 데이터는 깨져 있을 수 있다.** 이 스크립트가 그걸 본다.

무엇을 보나
    1. 활성 부서인데 사업부가 없는 것          → 사람이 배정되면 '공통' 으로 샌다
    2. 활성 부서 이름 중복                     → actor_division_id 가 확정 못 해 None (권한 닫힘)
    3. 사용자 부서가 사업부로 안 풀리는 계정    → 그 manager 는 자기 사업부 과제를 못 고친다
    4. 과제/참여인력이 쓰는 부서명 중 설정에 없는 것
    5. 설정 테이블의 세대 중복(비활성 잔재) 규모

사용법
    python scripts\\dt_check_departments.py
"""

from __future__ import annotations

import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    # 개발 설정의 SQL 로그가 결과를 덮는다. **엔진을 만들기 전에** 꺼야 한다.
    # 운영(ProductionConfig)에는 원래 꺼져 있으므로 없어도 그만이다.
    from app.config import DevelopmentConfig                        # noqa: E402
    DevelopmentConfig.SQLALCHEMY_ECHO = False
except Exception:
    pass

import sqlalchemy as sa                                             # noqa: E402
from app import create_app                                          # noqa: E402
from app.extensions import db                                       # noqa: E402
from app.modules.auth.models import User                            # noqa: E402
from app.modules.digital_twin_dashboard import permissions as P     # noqa: E402
from app.modules.digital_twin_dashboard.models import (             # noqa: E402
    Division, Department,
)
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project  # noqa: E402

findings = []


def head(t):
    print('\n' + '─' * 78)
    print(' ' + t)
    print('─' * 78)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        divs = Division.query.filter_by(is_active=True).order_by(Division.order).all()
        deps = Department.query.filter_by(is_active=True).order_by(Department.order).all()
        div_name = {d.id: d.name for d in divs}

        print('=' * 78)
        print(' 부서·사업부 설정 점검   (활성 사업부 %d · 활성 부서 %d)' % (len(divs), len(deps)))
        print('=' * 78)

        # ── 1. 사업부 없는 활성 부서
        head('1. 활성 부서인데 소속 사업부가 없는 것')
        orphan = [d for d in deps if d.division_id is None or d.division_id not in div_name]
        if orphan:
            findings.append(f'사업부 없는 활성 부서 {len(orphan)}개')
            for d in orphan:
                print(f'   - {d.name}   (id={d.id})')
            print(f'\n   → {len(orphan)}개. 여기 사람이 배정되면 인력현황에서 "공통" 으로 샌다.')
        else:
            print('   없음. 활성 부서가 전부 사업부에 붙어 있다.')

        # ── 2. 활성 부서 이름 중복
        head('2. 활성 부서 이름 중복')
        dup = [n for n, c in Counter(d.name.strip() for d in deps).items() if c > 1]
        if dup:
            findings.append(f'이름이 겹치는 활성 부서 {len(dup)}종')
            for n in dup:
                same = [d for d in deps if d.name.strip() == n]
                print(f'   - {n}: {len(same)}개 → 사업부 {[div_name.get(d.division_id) for d in same]}')
            print('\n   → 이름이 겹치면 actor_division_id 가 확정을 못 해 None 을 준다(권한 닫힘).')
        else:
            print('   없음.')

        # ── 3. 사용자 부서 해석
        head('3. 사용자 부서 → 사업부 해석')
        users = User.query.filter_by(is_active=True).all()
        blank, unresolved, ok = [], [], 0
        can_resolve = hasattr(P, 'actor_division_id')
        if not can_resolve:
            print('   (이 서버의 permissions.py 에 actor_division_id 가 없다 — 건너뜀)')
        for u in users:
            if not (u.department or '').strip():
                blank.append(u)
                continue
            if not can_resolve:
                continue
            if P.actor_division_id(u) is None:
                unresolved.append(u)
            else:
                ok += 1
        print(f'   활성 계정 {len(users)}명 — 해석됨 {ok} · 부서 비어있음 {len(blank)} · 못 풂 {len(unresolved)}')
        if unresolved:
            findings.append(f'부서가 사업부로 안 풀리는 계정 {len(unresolved)}명')
            for u in unresolved[:20]:
                print(f'   - {u.name} ({u.email})  부서="{u.department}"  role={u.role}')
            if len(unresolved) > 20:
                print(f'   ... 외 {len(unresolved) - 20}명')
            print('\n   → 이 중 manager 는 자기 사업부 과제를 편집할 수 없다(fail closed).')
        mgr_blocked = [u for u in unresolved if u.role == 'manager']
        if mgr_blocked:
            findings.append(f'★ 권한이 막히는 manager {len(mgr_blocked)}명')
            print(f'\n   ★ 그중 manager: {", ".join(u.name for u in mgr_blocked)}')

        # ── 4. 과제/인력이 쓰는 부서명
        head('4. 과제·참여인력이 쓰는 부서명 중 설정에 없는 것')
        active_names = {d.name.strip() for d in deps}

        # ⚠️ `Dt2Project.query.all()` 로 행 전체를 읽으면 안 된다. 보고서 이미지가
        #    base64 로 인라인된 컬럼이 있어 운영에서는 수백 MB 를 끌어올 수 있다.
        #    **필요한 두 컬럼만** 뽑는다.
        used = Counter()
        for dept_name, members in db.session.query(
                Dt2Project.dept_name, Dt2Project.members_json
        ).filter(Dt2Project.is_deleted.isnot(True)):
            for raw in (dept_name or '').split(','):
                if raw.strip():
                    used[raw.strip()] += 1
            for m in (members or []):
                if isinstance(m, dict) and (m.get('부서') or '').strip():
                    used[m['부서'].strip()] += 1

        unknown = {n: c for n, c in used.items() if n not in active_names}
        if unknown:
            findings.append(f'설정에 없는 부서명 {len(unknown)}종')
            for n, c in sorted(unknown.items(), key=lambda x: -x[1])[:25]:
                print(f'   - {n:<40} {c}회')
            if len(unknown) > 25:
                print(f'   ... 외 {len(unknown) - 25}종')
            print(f'\n   → {len(unknown)}종. 집계 총계는 맞지만 사업부로 접을 때 "공통" 으로 간다.')
        else:
            print('   없음. 쓰이는 부서명이 전부 설정에 있다.')

        # ── 4.5 ★ 과제가 가리키는 사업부가 살아 있는가 (가장 중요)
        head('4.5 ★ 과제의 사업부 번호가 활성인가  ← manager 권한이 여기 달렸다')
        print('   can_edit_project 는 `사용자 사업부 번호 == 과제 사업부 번호` 로 비교한다.')
        print('   설정을 저장할 때마다 사업부가 한 벌씩 새로 생겼으므로(세대 중복),')
        print('   과제가 **옛 세대 번호**를 든 채 남아 있으면 이름이 같아도 비교가 어긋난다.\n')

        rows = db.session.execute(sa.text("""
            SELECT d.id, d.name, d.is_active, count(*) AS n
              FROM dt2_projects p
              JOIN divisions d ON d.id = p.division_id
             WHERE p.is_deleted IS NOT TRUE
             GROUP BY d.id, d.name, d.is_active
             ORDER BY d.is_active, d.id
        """)).fetchall()
        stale = [r for r in rows if not r.is_active]
        for r in rows:
            mark = '   ← ★ 비활성! 이 과제들은 manager 가 못 고친다' if not r.is_active else ''
            print('   div id=%-5s %-10s active=%-6s : 과제 %d건%s'
                  % (r.id, r.name, r.is_active, r.n, mark))
        n_null = db.session.execute(sa.text(
            'SELECT count(*) FROM dt2_projects'
            ' WHERE is_deleted IS NOT TRUE AND division_id IS NULL')).scalar()
        print(f'   (사업부 번호가 없는 과제: {n_null}건 — 이쪽은 비교 자체를 건너뛴다)')

        if stale:
            total = sum(r.n for r in stale)
            findings.append(f'★★ 옛 세대 사업부를 가리키는 과제 {total}건')
            print(f'\n   ★★ {total}건이 비활성 사업부를 가리킨다. 보정이 필요하다:')
            for r in stale:
                act = next((x for x in divs if x.name.strip() == (r.name or '').strip()), None)
                print('       UPDATE dt2_projects SET division_id = %s'
                      ' WHERE division_id = %s;   -- %s (%d건)'
                      % (act.id if act else '?', r.id, r.name, r.n))
        else:
            print('\n   → 전부 활성. 이 항목은 이상 없다.')

        # ── 5. 세대 중복(비활성 잔재)
        head('5. 설정 테이블 세대 중복 (비활성 잔재)')
        print('   %-26s %8s %8s %8s' % ('테이블', '전체', '활성', '고유이름'))
        for t in ('divisions', 'departments', 'process_categories', 'project_domains',
                  'task_categories', 'task_statuses', 'performance_categories'):
            try:
                r = db.session.execute(sa.text(
                    f'SELECT count(*) n, count(*) FILTER (WHERE is_active) a,'
                    f' count(DISTINCT name) u FROM "{t}"')).fetchone()
            except Exception:
                db.session.rollback()
                continue
            flag = '  ← 세대 중복' if r.n >= r.a * 2 and r.a else ''
            print('   %-26s %8d %8d %8d%s' % (t, r.n, r.a, r.u, flag))
        print('\n   비활성 잔재는 조회에서 걸러지므로 집계를 틀리게 하지는 않는다.')

        # ── 요약
        print('\n' + '=' * 78)
        if findings:
            print(' 결과: 확인 필요 %d건' % len(findings))
            for f in findings:
                print('   · ' + f)
        else:
            print(' 결과: 이상 없음')
        print('=' * 78)
        return 0


if __name__ == '__main__':
    sys.exit(main())
