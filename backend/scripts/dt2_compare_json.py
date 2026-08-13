"""
내보낸 JSON 파일 두 개를 대조한다 (V1 로 받은 것 ↔ V2 로 받은 것)

왜 필요한가
    파일을 텍스트로 비교하면 **줄 수부터 다르게 나온다.** 하지만 그건
    데이터가 다르다는 뜻이 아니다.
        - JSON 객체는 키 순서에 의미가 없는데 텍스트 비교는 다르다고 본다
        - V2 는 파생 캐시(linkedProjects)를 싣지 않는다 — 화면이 직접 계산한다
        - 이관이 지어낸 createdAt 은 원본에 없던 값이라 내보내지 않는다
        - 9 와 9.0 처럼 표기만 다른 경우가 있다

    그래서 uuid 로 짝지어 **키 단위**로, dt2_compare_api.py 와 같은 규칙으로 본다.

사용법
    python scripts\\dt2_compare_json.py V1로받은.json V2로받은.json
    python scripts\\dt2_compare_json.py a.json b.json --detail
    python scripts\\dt2_compare_json.py a.json b.json --strict   # linkedProjects 도 본다

무엇을 쓰지 않나
    파일만 읽는다. DB 에 접속하지 않는다.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 비교 규칙은 응답 대조기와 **같은 것**을 쓴다. 규칙이 갈리면 결론이 갈린다.
from dt2_compare_api import same, _absent_equiv, DERIVED_KEYS   # noqa: E402


def pick(obj, *names):
    """내보내기 형식이 조금씩 달라 배열이 어디 있든 찾아낸다."""
    if isinstance(obj, list):
        return obj
    if not isinstance(obj, dict):
        return []
    for n in names:
        if isinstance(obj.get(n), list):
            return obj[n]
    for key in ('data', 'dashboardData', 'result'):
        inner = obj.get(key)
        if isinstance(inner, dict):
            got = pick(inner, *names)
            if got:
                return got
    return []


def compare(label, a_list, b_list, strict, detail):
    print(f"\n── {label} ──")
    a_by = {x.get('uuid'): x for x in a_list if isinstance(x, dict) and x.get('uuid')}
    b_by = {x.get('uuid'): x for x in b_list if isinstance(x, dict) and x.get('uuid')}
    print(f"  A {len(a_list):,}건 / B {len(b_list):,}건")

    only_a = set(a_by) - set(b_by)
    only_b = set(b_by) - set(a_by)
    print(f"  **A 에만 있음** : **{len(only_a):,}건**")
    print(f"  **B 에만 있음** : **{len(only_b):,}건**")

    diff, miss_b, extra_b = Counter(), Counter(), Counter()
    skipped = Counter()
    bad_rows = []

    for uid in set(a_by) & set(b_by):
        a, b = a_by[uid], b_by[uid]
        row = []
        for k in set(a) | set(b):
            if k in DERIVED_KEYS and not strict:
                if k in a or k in b:
                    skipped[k] += 1
                continue
            av, bv = a.get(k), b.get(k)
            if k not in b and _absent_equiv(av):
                continue
            if k not in a and _absent_equiv(bv):
                continue
            if same(av, bv):
                continue
            (miss_b if k not in b else extra_b if k not in a else diff)[k] += 1
            row.append(k)
        if row:
            bad_rows.append((a.get('id') or uid[:8], row))

    print(f"  대조한 항목       : {len(set(a_by) & set(b_by)):,}건")
    print(f"  **값이 다른 키**  : **{sum(diff.values()):,}개**")
    print(f"  **B 에 없는 키**  : **{sum(miss_b.values()):,}개**")
    print(f"  **B 에만 있는 키**: **{sum(extra_b.values()):,}개**")
    if skipped:
        print("  (제외) 파생 캐시 : "
              + ", ".join(f"{k} {v:,}건" for k, v in skipped.items()))
    for title, ctr in (('값 불일치', diff), ('B 누락', miss_b), ('B 추가', extra_b)):
        if ctr:
            print(f"    [{title}] " + ", ".join(f"{k}({v})" for k, v in ctr.most_common(15)))

    if detail and bad_rows:
        print(f"\n  [상세] 어긋난 항목 {len(bad_rows):,}건 (값은 출력하지 않음)")
        for code, keys in bad_rows[:40]:
            print(f"    - {code}: {', '.join(sorted(keys))}")
        if len(bad_rows) > 40:
            print(f"    ... 외 {len(bad_rows)-40:,}건")

    return (not only_a and not only_b and not diff and not miss_b and not extra_b)


def main():
    ap = argparse.ArgumentParser(description='내보낸 JSON 두 개를 대조 (파일만 읽음)')
    ap.add_argument('file_a', help='기준 파일 (보통 V1 으로 받은 것)')
    ap.add_argument('file_b', help='비교 파일 (보통 V2 로 받은 것)')
    ap.add_argument('--detail', action='store_true')
    ap.add_argument('--strict', action='store_true',
                    help='linkedProjects(파생 캐시)도 차이로 센다')
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    def load(p):
        if not os.path.exists(p):
            print(f'[FAIL] 파일이 없습니다: {p}')
            sys.exit(1)
        with open(p, encoding='utf-8-sig') as fh:
            return json.load(fh)

    A, B = load(args.file_a), load(args.file_b)

    print('=' * 72)
    print(' 내보낸 JSON 대조')
    print('=' * 72)
    print(f'  A : {args.file_a}')
    print(f'  B : {args.file_b}')
    print('  줄 수·파일 크기 차이는 판정 근거가 아니다. 키 단위로 본다.')

    ok_p = compare('과제', pick(A, 'projects', '과제목록'), pick(B, 'projects', '과제목록'),
                   args.strict, args.detail)
    ok_f = compare('성과', pick(A, 'performances', '성과목록', 'globalPerformances'),
                   pick(B, 'performances', '성과목록', 'globalPerformances'),
                   args.strict, args.detail)

    print('\n' + '=' * 72)
    if ok_p and ok_f:
        print(' 결과: [OK] 두 파일의 내용이 같습니다.')
        print('=' * 72)
        sys.exit(0)
    print(' 결과: [FAIL] 차이가 있습니다. --detail 로 어느 항목인지 확인하세요.')
    print('=' * 72)
    sys.exit(1)


if __name__ == '__main__':
    main()
