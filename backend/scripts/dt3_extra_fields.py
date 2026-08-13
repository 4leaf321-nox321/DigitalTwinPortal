"""
`extra_fields` 에 무엇이 들어 있는지 확인 (읽기 전용).

무엇을 보나
    이관은 **매핑에 없는 키를 버리지 않고** `extra_fields` 에 통째로 보관한다
    (원칙: extra_fields 만으로 원본을 복원할 수 있어야 한다).
    그런데 `extra_fields` 는 **IMMUTABLE 이다** — 어떤 경로로도 PATCH 를 받지 않는다
    (`permissions.IMMUTABLE_FIELDS`).

    그래서 이런 상태가 가능하다:

        화면에 값이 보인다  →  사람이 고친다  →  저장을 누른다
        →  서버가 그 키를 건너뛴다(응답 `ignored`)
        →  **화면엔 성공이라 뜨고, 경고는 콘솔에만 찍힌다**
        →  새로고침하면 옛 값이 돌아온다

    운영 이관에서 매핑 밖 키 12종이 보존됐다(2026-07-29). 개발 DB 에는 없을 수 있는,
    **운영에만 있는 위험**이다. 그래서 컷오버 전에 무엇이 들어 있는지 눈으로 봐 둔다.

무엇을 판단해야 하나
    출력된 키 이름을 보고 **"이게 편집 화면에 입력칸으로 나오는가"** 를 판단한다.
      · 안 나온다  → 사람이 고칠 수 없으므로 문제되지 않는다 (대부분 여기 해당)
      · 나온다     → 고쳐도 저장이 안 된다. 컷오버 전에 필드 맵에 추가하거나
                     입력칸을 읽기 전용으로 바꿔야 한다
                     (필드를 추가할 때 손댈 곳 4군데: models_v2 · alembic ·
                      field_maps · permissions 의 LOW_RISK/CORE 등록)

    DB 만 봐서는 화면에 나오는지 알 수 없다. 그래서 **키 이름과 값 예시**를 찍는다.

⚠️ 값 예시에 사람 이름·과제명이 섞일 수 있어 **화면에만 찍고 로그 파일을 만들지 않는다.**

사용법
    python scripts\\dt3_extra_fields.py
    python scripts\\dt3_extra_fields.py --values     # 각 키의 값 예시까지
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter

try:
    import psycopg
except ImportError:
    print('[FAIL] psycopg 를 찾을 수 없습니다. venv 를 활성화했는지 확인하세요.')
    sys.exit(1)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from dt_scan import load_dsn, mask_dsn, enforce_read_only
except ImportError as exc:
    print(f'[FAIL] 같은 폴더의 dt_scan.py 를 찾을 수 없습니다: {exc}')
    sys.exit(1)

# extra_fields 를 가진 테이블. models_v2.py 기준.
# 네 번째 값은 **그 테이블에서 extra_fields 가 위험한가**에 대한 안내다 —
# 테이블마다 성격이 다른데, 모르면 숫자만 보고 놀라게 된다.
TARGETS = [
    ('dt2_projects', '과제', 'NOT is_deleted AND NOT is_permanently_deleted',
     '⚠️ **여기가 진짜 확인 대상이다.** 편집창의 입력칸과 이름이 겹치는 키가 있으면\n'
     '     고쳐도 저장되지 않는다. `_` 로 시작하는 것은 화면 내부 표식이라 무해하다.'),
    ('dt2_performances', '성과', 'NOT is_deleted',
     '⚠️ 과제와 같은 기준으로 본다. `isEditing`·`_idChanged` 는 UI 임시값이라 무해하다.'),
    ('dt2_project_performance', '과제-성과 연결', None,
     '✅ **여기는 원래 이렇게 설계돼 있다.** 연결 원소의 원본을 통째로 보관하는 자리이고\n'
     '     (models_v2: "원본 원소를 그대로 담는다"), 연결 API(PUT …/performances)가\n'
     '     원소를 통째로 다시 쓰면서 이 값을 이어받는다. 키가 많아도 정상이다.'),
    ('dt2_project_dependencies', '선행과제', None,
     'ℹ️ 선행과제 편집 UI 는 2026-07-31 컷오버에서 숨겼다. 사람이 고칠 수 없으므로\n'
     '     여기 무엇이 들어 있든 조용한 무시 문제는 생기지 않는다.'),
]

SAMPLE_MAX = 90


def describe(value):
    if value is None:
        return 'null', ''
    if isinstance(value, bool):
        return 'bool', str(value)
    if isinstance(value, (int, float)):
        return type(value).__name__, str(value)
    if isinstance(value, list):
        return 'list', f'{len(value)}건'
    if isinstance(value, dict):
        text = json.dumps(value, ensure_ascii=False)
        return 'dict', (text[:SAMPLE_MAX] + '…') if len(text) > SAMPLE_MAX else text
    text = str(value)
    if text == '':
        return 'str', '(빈 문자열)'
    return 'str', (text[:SAMPLE_MAX] + '…') if len(text) > SAMPLE_MAX else text


def main():
    ap = argparse.ArgumentParser(
        description='extra_fields 내용 확인 (읽기 전용 · 화면 출력만)')
    ap.add_argument('--dsn')
    ap.add_argument('--values', action='store_true', help='각 키의 값 예시까지 보인다')
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    dsn = load_dsn(args.dsn)
    print('=' * 78)
    print(' extra_fields 내용 확인 (읽기 전용)')
    print('=' * 78)
    print(f' 접속 : {mask_dsn(dsn)}')
    print(' 성격 : extra_fields 는 IMMUTABLE 이다 — 여기 담긴 키는 PATCH 로 못 고친다')

    conn = psycopg.connect(dsn, autocommit=True)
    if not enforce_read_only(conn):
        print('[FAIL] 읽기 전용 보호를 걸지 못했습니다. 중단합니다.')
        sys.exit(1)

    total_keys = 0
    try:
        cur = conn.cursor()
        for table, label, where, note in TARGETS:
            cur.execute("SELECT to_regclass(%s)", (f'public.{table}',))
            if cur.fetchone()[0] is None:
                print(f'\n── {label} ({table}) ──')
                print('  테이블이 없습니다.')
                continue

            sql = f'SELECT extra_fields FROM {table}'
            if where:
                sql += f' WHERE {where}'
            cur.execute(sql)
            rows = cur.fetchall()

            key_rows = Counter()      # 키가 등장한 행 수
            key_nonempty = Counter()  # 그중 값이 비어 있지 않은 행 수
            key_types = {}
            key_sample = {}

            for (extra,) in rows:
                if not isinstance(extra, dict):
                    continue
                for key, value in extra.items():
                    key_rows[key] += 1
                    kind, sample = describe(value)
                    key_types.setdefault(key, Counter())[kind] += 1
                    empty = (value is None or value == '' or value == []
                             or value == {} )
                    if not empty:
                        key_nonempty[key] += 1
                        key_sample.setdefault(key, sample)

            print(f'\n── {label} ({table}) — {len(rows)}행 ──')
            print(f'  {note}')
            if not key_rows:
                print('  extra_fields 가 비어 있습니다. (매핑 밖 키 없음)')
                continue

            total_keys += len(key_rows)
            print(f'  매핑 밖 키 **{len(key_rows)}종**')
            width = max(len(k) for k in key_rows)
            for key, n in key_rows.most_common():
                kinds = '/'.join(k for k, _ in key_types[key].most_common(2))
                nonempty = key_nonempty[key]
                mark = '  ← 값이 있다' if nonempty else '  (전부 비어 있음)'
                print(f'    {key:<{width}}  {n:>5}행 중 값 있음 {nonempty:>5}  [{kinds}]{mark}')
                if args.values and key in key_sample:
                    print(f'    {"":<{width}}    예: {key_sample[key]}')

        print('\n' + '=' * 78)
        if total_keys == 0:
            print(' 결과: [OK] extra_fields 에 담긴 키가 없습니다. 확인할 것이 없습니다.')
        else:
            print(f' 결과: [확인] 매핑 밖 키가 모두 {total_keys}종 있습니다.')
            print('        **값이 있는** 키 이름을 보고, 그것이 편집 화면에 입력칸으로')
            print('        나오는지 판단하세요.')
            print('          · 안 나온다 → 사람이 고칠 수 없으므로 문제 없음')
            print('          · 나온다    → 고쳐도 저장이 안 된다(조용히 무시).')
            print('                        컷오버 전에 필드 맵에 넣거나 읽기 전용으로 바꾼다')
            print('        컷오버 후에는 콘솔의 `[DT] 서버가 건너뛴 키` 경고로도 드러난다.')
        print('=' * 78)
        return 0
    finally:
        conn.close()


if __name__ == '__main__':
    sys.exit(main())
