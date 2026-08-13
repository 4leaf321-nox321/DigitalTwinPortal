"""
dt2_* 현재 상태 한눈에 보기 (읽기 전용)

무엇에 쓰나
    "새 이관 로직이 실제로 반영됐는가" 를 판정한다.
    긴 psql 한 줄을 복사할 필요 없이 이 파일만 배포하고 실행하면 된다.

    python scripts\\dt2_state.py

무엇을 보나
    position          이번에 추가한 컬럼. 새 이관이 돌았다면 반드시 채워져 있다.
    isEditing         extra_fields 로 보존하도록 바꾼 키.
    _synthesizedTs    이관이 지어낸 타임스탬프 표식.
    _unlinkedPerfRefs 연결 못 한 성과목록 원소 보관함.

    넷 다 0 이면 **옛 이관 결과**다. 파일을 배포한 뒤 재이관하면 된다.

아무것도 쓰지 않는다.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    import psycopg
except ImportError:
    print("[FAIL] psycopg 를 찾을 수 없습니다. venv 를 활성화했는지 확인하세요.")
    sys.exit(1)

try:
    from dt_scan import load_dsn, mask_dsn
except ImportError:
    print("[FAIL] dt_scan.py 를 같은 폴더에서 찾을 수 없습니다.")
    sys.exit(1)


QUERIES = [
    ("성과목록 순서(position) 채워짐",
     "SELECT count(*) FROM dt2_project_performance WHERE position IS NOT NULL"),
    ("  전체 연결 수",
     "SELECT count(*) FROM dt2_project_performance"),
    ("isEditing 보존된 성과",
     "SELECT count(*) FROM dt2_performances WHERE extra_fields ? 'isEditing'"),
    ("_idChanged 보존된 성과",
     "SELECT count(*) FROM dt2_performances WHERE extra_fields ? '_idChanged'"),
    ("지어낸 타임스탬프 표식 — 과제",
     "SELECT count(*) FROM dt2_projects WHERE extra_fields ? '_synthesizedTs'"),
    ("지어낸 타임스탬프 표식 — 성과",
     "SELECT count(*) FROM dt2_performances WHERE extra_fields ? '_synthesizedTs'"),
    ("연결 못 한 원소 보관 과제",
     "SELECT count(*) FROM dt2_projects WHERE extra_fields ? '_unlinkedPerfRefs'"),
]


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    dsn = load_dsn(None)
    print("=" * 60)
    print(" dt2_* 상태 — 새 이관 로직 반영 여부")
    print("=" * 60)
    print(f" 접속 : {mask_dsn(dsn)}")
    print("-" * 60)

    conn = psycopg.connect(dsn)
    cur = conn.cursor()
    values = {}
    for label, sql in QUERIES:
        cur.execute(sql)
        n = cur.fetchone()[0]
        values[label] = n
        print(f" {label:34} {n:>8,}")
    conn.close()

    pos = values["성과목록 순서(position) 채워짐"]
    total = values["  전체 연결 수"]
    marks = (values["isEditing 보존된 성과"]
             + values["지어낸 타임스탬프 표식 — 과제"]
             + values["연결 못 한 원소 보관 과제"])

    print("-" * 60)
    if pos == 0 and marks == 0:
        print(" 판정: **옛 이관 결과입니다.**")
        print("       새 파일을 배포한 뒤 재이관하세요:")
        print("         python scripts\\dt2_import.py --commit")
        code = 2
    elif pos < total:
        print(f" 판정: 일부만 반영됐습니다 (position {pos:,}/{total:,}).")
        print("       재이관을 한 번 더 돌리세요.")
        code = 2
    else:
        print(" 판정: [OK] 새 이관 로직이 반영돼 있습니다.")
        print("       그래도 대조가 실패한다면 진짜 버그입니다 — 로그를 보내주세요.")
        code = 0
    print("=" * 60)
    sys.exit(code)


if __name__ == "__main__":
    main()
