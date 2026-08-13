"""
V2 응답을 **화면이 읽을 수 있는가** 검사 (읽기 전용).

왜 필요한가
    2026-07-30, V2 연결 API 가 참조 키를 `uuid` 로 썼다. 서버 쪽으로는 아무 문제가
    없었다 — 테이블도 맞고 재조립도 됐다. 그런데 화면은 참조를 `성과항목UUID || id ||
    성과항목ID` 로만 읽어서, **그 연결을 고아로 보고 지웠다.**

    dt2_verify(테이블 대조)도 dt2_compare_api(V1 응답 대조)도 이걸 못 잡는다.
    앞의 것은 화면을 모르고, 뒤의 것은 컷오버 후 V1 이 멈추면 쓸 수 없다.

    그래서 **화면의 조회 규칙을 서버에서 그대로 재현해** 확인한다.
    브라우저 없이 돌릴 수 있고, 저장 경로를 V2 로 옮길 때마다 돌리면 된다.

재현하는 화면 규칙 (frontend/src/.../utils/projectPerformanceLink.js)
    식별자 = 문자열이면 그대로, 객체면  성과항목UUID → id → 성과항목ID  순
    성과 찾기 = performances 에서  p.id === 식별자  또는  p.uuid === 식별자  (정확히 일치)
    못 찾으면 → 고아로 보고 **화면이 그 연결을 지운다**

사용법
    python scripts\\dt3_check_frontend_shape.py
    python scripts\\dt3_check_frontend_shape.py --detail    # 문제 항목 전부 출력
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.modules.digital_twin_dashboard.assemble import assemble_data

results = []


def check(desc, cond, extra=''):
    results.append((desc, bool(cond)))
    print(f"  {'[OK]  ' if cond else '[FAIL]'} {desc}" + (f"   {extra}" if not cond and extra else ''))


def frontend_identifier(ref):
    """화면이 연결 원소에서 뽑아내는 식별자. 없으면 None."""
    if isinstance(ref, str):
        return ref or None
    if not isinstance(ref, dict):
        return None
    for key in ('성과항목UUID', 'id', '성과항목ID'):
        value = ref.get(key)
        if value not in (None, ''):
            return value
    return None


def main():
    ap = argparse.ArgumentParser(description='V2 응답을 화면이 읽을 수 있는지 확인')
    ap.add_argument('--detail', action='store_true', help='문제 항목을 전부 출력')
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        app.config['SQLALCHEMY_ECHO'] = False
        data = assemble_data()
        projects = data['projects']
        performances = data['performances']

        # 이관이 **일부러 보존한** V1 고아 참조. 원본에 이미 깨져 있던 것이라
        # V2 가 만든 문제와 구분해야 한다 (섞어 놓으면 판정이 무의미해진다).
        from app.modules.digital_twin_dashboard.models_v2 import Dt2Project
        inherited_raw = set()
        for row in Dt2Project.query.all():
            for item in ((row.extra_fields or {}).get('_unlinkedPerfRefs') or []):
                raw = item.get('_raw') if isinstance(item, dict) else None
                ident = frontend_identifier(raw)
                if ident is not None:
                    inherited_raw.add((row.uuid, ident))

    print('=' * 72)
    print(' V2 응답 ↔ 화면 조회 규칙 대조 (읽기 전용)')
    print('=' * 72)
    print(f' 과제 {len(projects)}건 / 성과 {len(performances)}건')

    # 화면이 성과를 찾는 색인 — id 와 uuid 를 **그대로** 쓴다(형변환 없음)
    by_key = set()
    for f in performances:
        for key in ('id', 'uuid'):
            v = f.get(key)
            if v not in (None, ''):
                by_key.add(v)

    print('\n── 1. 성과가 조회 가능한 키를 갖고 있는가 ──')
    no_key = [f for f in performances if not f.get('id') and not f.get('uuid')]
    check('모든 성과에 id 또는 uuid 가 있다', not no_key, f'{len(no_key)}건 없음')

    print('\n── 2. 과제-성과 연결을 화면이 읽을 수 있는가 ★ ──')
    unreadable = []     # 식별자 자체를 못 뽑는 원소
    dangling = []       # 식별자는 있는데 성과를 못 찾는 원소 (V2 가 만든 것)
    inherited = []      # 이관이 보존한 V1 고아 — 원본에 이미 깨져 있었다
    total_links = 0

    for p in projects:
        for ref in (p.get('성과목록') or []):
            total_links += 1
            ident = frontend_identifier(ref)
            if ident is None:
                unreadable.append((p.get('id'), p.get('과제명'),
                                   sorted(ref) if isinstance(ref, dict) else ref))
            elif ident not in by_key:
                if (p.get('uuid'), ident) in inherited_raw:
                    inherited.append((p.get('id'), p.get('과제명'), ident))
                else:
                    dangling.append((p.get('id'), p.get('과제명'), ident))

    print(f'  연결 원소 {total_links}건 검사')
    check('★ 식별자를 뽑을 수 있다 (성과항목UUID·id·성과항목ID 중 하나)',
          not unreadable, f'{len(unreadable)}건이 키 없음 — 화면이 지운다')
    check('★ 가리키는 성과가 응답 안에 있다',
          not dangling, f'{len(dangling)}건이 고아 — 화면이 지운다')

    if inherited:
        # 판정에 넣지 않는다. V1 에도 똑같이 깨져 있고, 이관은 **일부러** 보존했다.
        # 여기서 FAIL 을 내면 진짜 회귀가 이 잡음에 묻힌다.
        print(f'  [정보] 이관이 보존한 V1 고아 {len(inherited)}건 — 원본에 이미 깨져 있던 것')
        for code, title, ident in inherited[:10]:
            print(f'         {code:12} {str(title)[:20]:22} 참조={ident!r}')

    if unreadable and (args.detail or len(unreadable) <= 10):
        print('   ── 키를 못 뽑는 원소 ──')
        for code, title, keys in unreadable[:50]:
            print(f'      {code:12} {str(title)[:20]:22} 가진 키={keys}')
    if dangling and (args.detail or len(dangling) <= 10):
        print('   ── 가리키는 성과가 없는 원소 ──')
        for code, title, ident in dangling[:50]:
            print(f'      {code:12} {str(title)[:20]:22} 참조={ident!r}')

    print('\n── 3. 과제 식별자 ──')
    no_uuid = [p for p in projects if not p.get('uuid')]
    check('모든 과제에 uuid 가 있다', not no_uuid, f'{len(no_uuid)}건 없음')
    dup = len(projects) - len({p.get('uuid') for p in projects})
    check('과제 uuid 가 고유하다', dup == 0, f'중복 {dup}건')

    print('\n── 4. 성과 식별자 ──')
    dup_f = len(performances) - len({f.get('uuid') for f in performances})
    check('성과 uuid 가 고유하다', dup_f == 0, f'중복 {dup_f}건')
    codes = [f.get('id') for f in performances if f.get('id')]
    check('성과 id 가 고유하다', len(codes) == len(set(codes)),
          f'중복 {len(codes) - len(set(codes))}건')

    ok = sum(1 for _, c in results if c)
    bad = len(results) - ok
    print('\n' + '=' * 72)
    if bad:
        print(f' 결과: [FAIL] {bad}건 — 화면이 데이터를 잃을 수 있습니다.')
        print('        연결 원소의 참조 키는 **성과항목UUID** 여야 합니다.')
    else:
        print(f' 결과: [OK] {ok}/{len(results)} — 화면이 응답을 그대로 읽을 수 있습니다.')
    print('=' * 72)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
