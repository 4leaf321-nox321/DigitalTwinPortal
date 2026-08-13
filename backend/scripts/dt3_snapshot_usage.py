"""
스냅샷을 **사람이 실제로 쓰고 있는가** 확인 (읽기 전용).

왜 필요한가
    컷오버 후 '스냅샷' 을 어떻게 할지 정해야 한다(실행계획 7.5-6).
    지금 방식은 `dashboard_data` JSON 을 통째로 복사하는 것인데, V2 가 정본이 되면
    그 JSON 은 더 이상 정본이 아니다.

    개발 DB 를 보면 **사람이 만든 스냅샷(manual)이 8개월째 0건**이고, 자동 생성분은
    Phase 1 에서 이미 껐다. 그래서 "화면 스냅샷 폐지" 를 제안했는데,
    **개발 수치로 운영을 판단하면 안 된다** — 이 프로젝트는 전에 그걸로 한 번 틀렸다
    (실행계획 2-0 의 '보유 과제수' 가 개발 DB 수치였던 건).

    그래서 운영에서 이 스크립트를 돌려 사실을 확인한다.

반출 안전
    **숫자·타입·날짜만 출력한다.** 스냅샷 내용도, 만든 사람 이름도 찍지 않는다
    (사람 수만 센다). 결과를 그대로 복사해 와도 된다.

사용법
    python scripts\\dt3_snapshot_usage.py
    python scripts\\dt3_snapshot_usage.py --days 180     # '최근' 기준 바꾸기
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    import psycopg
except ImportError:
    print('[FAIL] psycopg 를 찾을 수 없습니다. venv 를 활성화했는지 확인하세요.')
    sys.exit(1)

try:
    from dt_scan import load_dsn, mask_dsn
except ImportError:
    print('[FAIL] dt_scan.py 를 같은 폴더에서 찾을 수 없습니다.')
    sys.exit(1)

# 사람이 **의도해서** 만든 스냅샷. auto/upsert 는 시스템이 만든 것이라 제외한다.
HUMAN_TYPES = ('manual', 'upload')


def main():
    ap = argparse.ArgumentParser(description='스냅샷 사용 실태 확인 (읽기 전용)')
    ap.add_argument('--dsn')
    ap.add_argument('--days', type=int, default=90,
                    help="'최근' 의 기준 일수 (기본 90)")
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    dsn = load_dsn(args.dsn)
    print('=' * 72)
    print(' 스냅샷 사용 실태 (읽기 전용 · 숫자만 출력)')
    print('=' * 72)
    print(f' 대상 : {mask_dsn(dsn)}')
    print(f' 기준 : 최근 {args.days}일')

    conn = psycopg.connect(dsn)
    try:
        cur = conn.cursor()

        cur.execute("SELECT to_regclass('public.dashboard_snapshots')")
        if cur.fetchone()[0] is None:
            print('\n  dashboard_snapshots 테이블이 없습니다.')
            print('\n 결과: [OK] 스냅샷 기능이 쓰이지 않습니다 (테이블 없음).')
            return 0

        print('\n── 타입별 ──')
        cur.execute("""
            SELECT snapshot_type, count(*),
                   pg_size_pretty(sum(pg_column_size(snapshot_data))::bigint),
                   to_char(min(created_at), 'YYYY-MM-DD'),
                   to_char(max(created_at), 'YYYY-MM-DD')
              FROM dashboard_snapshots
             GROUP BY snapshot_type ORDER BY count(*) DESC
        """)
        rows = cur.fetchall()
        if not rows:
            print('  (한 건도 없음)')
        for t, n, size, first, last in rows:
            mark = ' ← 사람이 만든 것' if t in HUMAN_TYPES else ''
            print(f'  {str(t):10} {n:6}건  {str(size):>10}  {first} ~ {last}{mark}')

        cur.execute("""
            SELECT count(*), pg_size_pretty(sum(pg_column_size(snapshot_data))::bigint)
              FROM dashboard_snapshots
        """)
        total_n, total_size = cur.fetchone()
        print(f'  ── 전체 {total_n}건 / {total_size}')

        cur.execute("""
            SELECT pg_size_pretty(pg_total_relation_size('dashboard_snapshots'))
        """)
        print(f'  테이블 디스크 사용량 {cur.fetchone()[0]}')

        # ── 판정에 쓰는 값 ────────────────────────────────────────────────
        # created_at 은 **naive UTC** 다(BaseModel). SQL now() 는 KST 라
        # 그대로 비교하면 9시간 어긋나 항상 0건이 나온다.
        cur.execute("""
            SELECT count(*), count(DISTINCT created_by)
              FROM dashboard_snapshots
             WHERE snapshot_type = ANY(%s)
               AND created_at >= (now() AT TIME ZONE 'UTC') - (%s || ' days')::interval
        """, (list(HUMAN_TYPES), args.days))
        recent_n, recent_people = cur.fetchone()

        cur.execute("""
            SELECT count(*), to_char(max(created_at), 'YYYY-MM-DD')
              FROM dashboard_snapshots WHERE snapshot_type = ANY(%s)
        """, (list(HUMAN_TYPES),))
        human_n, human_last = cur.fetchone()

        print(f'\n── 사람이 만든 스냅샷 ({"/".join(HUMAN_TYPES)}) ──')
        print(f'  전체        : {human_n}건 (마지막 {human_last or "없음"})')
        print(f'  최근 {args.days}일 : {recent_n}건, 만든 사람 {recent_people}명')

        cur.execute("""
            SELECT count(*) FROM dashboard_snapshots
             WHERE created_at >= (now() AT TIME ZONE 'UTC') - (%s || ' days')::interval
        """, (args.days,))
        print(f'  (참고) 최근 {args.days}일 전체 스냅샷 : {cur.fetchone()[0]}건')

        print('\n' + '=' * 72)
        if recent_n == 0:
            print(' 결과: [OK] 최근 사람이 만든 스냅샷이 없습니다.')
            print('        → 화면 스냅샷 기능을 폐지해도 됩니다.')
            print('        되돌리기는 dt2_project_changes(필드 단위 이력),')
            print('        재해 복구는 DB 덤프가 담당합니다.')
        else:
            print(f' 결과: [FAIL] 최근 {args.days}일에 사람이 만든 스냅샷이 {recent_n}건 있습니다.')
            print('        → 실제로 쓰이고 있습니다. 폐지 전에 대안을 정해야 합니다.')
            print('        누가 어떤 상황에서 쓰는지 확인하세요.')
        print('=' * 72)
        return 0 if recent_n == 0 else 1
    finally:
        conn.close()


if __name__ == '__main__':
    sys.exit(main())
