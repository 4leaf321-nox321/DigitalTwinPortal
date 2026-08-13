"""
V1 `/data` ↔ V2 `/api/dt-v2/data` 응답 대조 (Phase 2-4) — 읽기 전용

무엇을 증명하나
    "화면을 V2 로 옮겨도 같은 것을 본다."

    Phase 2 의 dt2_verify.py 는 **테이블이 원본과 같은가**를 봤다.
    이 스크립트는 **화면이 받는 형태로 되돌렸을 때 같은가**를 본다. 다른 질문이다.
    실제로 첫 시도에서 `성과목록` 원소의 참조 키 이름이 모자란 것이 여기서 드러났다.

어떻게 비교하나
    Flask test_client 로 두 엔드포인트를 직접 호출한다(HTTP 포트 불필요).
    과제·성과를 uuid 로 짝지어 **키 단위**로 대조하고, dt2_verify 와 같은
    정규화 규칙을 쓴다(빈문자열 ↔ None, 숫자 오차, 타임스탬프 1초 이내 등).

의도적으로 다른 것
    linkedProjects   파생 캐시. V2 는 담지 않는다. 화면이 직접 계산한다.
                     --strict 를 주면 이것도 차이로 센다.

무엇을 쓰지 않나
    **아무것도 쓰지 않는다.** 두 엔드포인트 모두 GET 이다.

사용법
    python scripts\\dt2_compare_api.py
    python scripts\\dt2_compare_api.py --detail    # 어긋난 키를 과제별로 나열
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app                                        # noqa: E402
from app.modules.auth.models import User, UserRole                # noqa: E402
from flask_jwt_extended import create_access_token                # noqa: E402

# 비교 규칙은 dt2_verify 와 **같은 것**을 쓴다. 규칙이 갈리면 대조가 무의미하다.
from dt2_verify import norm_scalar, cmp_num, cmp_ts, v2_write_enabled   # noqa: E402

# 파생 캐시. 이관하지 않기로 한 것이라 기본적으로 차이에서 뺀다.
DERIVED_KEYS = {'linkedProjects'}


class Log:
    def __init__(self, path):
        self.path = path
        self.fh = open(path, 'w', encoding='utf-8')

    def __call__(self, msg=''):
        print(msg)
        self.fh.write(msg + '\n')
        self.fh.flush()

    def close(self):
        self.fh.close()


def _absent_equiv(v):
    """
    키가 아예 없는 것과 같다고 볼 값들.

    0 은 넣지 않는다 — 진행률 0 과 '진행률 없음' 은 다른 뜻일 수 있어
    그것까지 같다고 보면 진짜 차이를 놓친다.
    """
    return v is None or v is False or v == '' or v == [] or v == {}


def same(a, b):
    """dt2_verify 와 같은 관대함으로 두 값을 비교한다."""
    na, nb = norm_scalar(a), norm_scalar(b)
    if na is None and nb is None:
        return True
    if na is None or nb is None:
        return False

    if isinstance(na, bool) or isinstance(nb, bool):
        return bool(na) == bool(nb)

    if isinstance(na, (int, float)) or isinstance(nb, (int, float)):
        try:
            return cmp_num(na, nb)
        except Exception:
            pass

    if isinstance(na, (dict, list)) or isinstance(nb, (dict, list)):
        return json.dumps(na, ensure_ascii=False, sort_keys=True, default=str) == \
               json.dumps(nb, ensure_ascii=False, sort_keys=True, default=str)

    sa, sb = str(na), str(nb)
    if sa == sb:
        return True
    # 타임스탬프 표기 차이 (Z 유무·마이크로초 자릿수)
    if 'T' in sa and 'T' in sb:
        try:
            return cmp_ts(sa, datetime.fromisoformat(sb.replace('Z', '')))
        except Exception:
            pass
    # 숫자를 문자열로 들고 있는 경우 ('9' vs 9)
    try:
        return cmp_num(sa, sb)
    except Exception:
        return False


def compare_entities(label, v1_list, v2_list, log, detail, strict):
    log(f"\n── {label} ──")
    v1_by = {x.get('uuid'): x for x in v1_list if isinstance(x, dict) and x.get('uuid')}
    v2_by = {x.get('uuid'): x for x in v2_list if isinstance(x, dict) and x.get('uuid')}

    log(f"  V1 {len(v1_list):,}건 / V2 {len(v2_list):,}건 "
        f"(uuid 있는 것 {len(v1_by):,} / {len(v2_by):,})")

    only_v1 = set(v1_by) - set(v2_by)
    only_v2 = set(v2_by) - set(v1_by)
    log(f"  **V1 에만 있음** : **{len(only_v1):,}건**")
    log(f"  **V2 에만 있음** : **{len(only_v2):,}건**")

    key_diff = Counter()
    missing_in_v2 = Counter()
    extra_in_v2 = Counter()
    bad_rows = []
    derived_skipped = Counter()

    for uid in set(v1_by) & set(v2_by):
        a, b = v1_by[uid], v2_by[uid]
        row_bad = []
        for k in set(a) | set(b):
            if k in DERIVED_KEYS and not strict:
                if k in a:
                    derived_skipped[k] += 1
                continue
            av, bv = a.get(k), b.get(k)
            # '키가 없음' 과 '거짓·빈값' 은 화면에서 같게 동작한다.
            # (V1 은 _deleted 를 참일 때만 싣지만 거짓으로 명시된 행도 있다)
            if k not in b and _absent_equiv(av):
                continue
            if k not in a and _absent_equiv(bv):
                continue
            if same(av, bv):
                continue
            if k not in b:
                missing_in_v2[k] += 1
            elif k not in a:
                extra_in_v2[k] += 1
            else:
                key_diff[k] += 1
            row_bad.append(k)
        if row_bad:
            bad_rows.append((a.get('id') or uid[:8], row_bad))

    total_bad = sum(key_diff.values()) + sum(missing_in_v2.values()) + sum(extra_in_v2.values())
    log(f"  대조한 항목       : {len(set(v1_by) & set(v2_by)):,}건")
    log(f"  **값이 다른 키**  : **{sum(key_diff.values()):,}개**")
    log(f"  **V2 에 없는 키** : **{sum(missing_in_v2.values()):,}개**")
    log(f"  **V2 에만 있는 키**: **{sum(extra_in_v2.values()):,}개**")
    if derived_skipped:
        log("  (제외) 파생 캐시 : "
            + ", ".join(f"{k} {v:,}건" for k, v in derived_skipped.items()))

    for title, ctr in (('값 불일치', key_diff), ('V2 누락', missing_in_v2),
                       ('V2 추가', extra_in_v2)):
        if ctr:
            log(f"    [{title}] " + ", ".join(f"{k}({v})" for k, v in ctr.most_common(15)))

    if detail and bad_rows:
        log(f"\n  [상세] 어긋난 항목 {len(bad_rows):,}건 (값은 출력하지 않음)")
        for code, keys in bad_rows[:40]:
            log(f"    - {code}: {', '.join(sorted(keys))}")
        if len(bad_rows) > 40:
            log(f"    ... 외 {len(bad_rows)-40:,}건")

    return (len(only_v1) == 0 and len(only_v2) == 0 and total_bad == 0)


def main():
    ap = argparse.ArgumentParser(description='V1 ↔ V2 응답 대조 (읽기 전용)')
    ap.add_argument('--detail', action='store_true', help='어긋난 키를 항목별로 나열')
    ap.add_argument('--strict', action='store_true',
                    help='linkedProjects(파생 캐시)도 차이로 센다')
    ap.add_argument('--out')
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    here = os.path.dirname(os.path.abspath(__file__))
    outdir = args.out or os.path.join(here, 'out')
    os.makedirs(outdir, exist_ok=True)
    stamp = datetime.now().strftime('%Y%m%d_%H%M')
    log = Log(os.path.join(outdir, f'dt2_compare_api_{stamp}.log'))

    log('=' * 72)
    log(' V1 /data  ↔  V2 /api/dt-v2/data  응답 대조 (읽기 전용)')
    log('=' * 72)
    log(f' 로그 : {log.path}')
    log(' 두 엔드포인트 모두 GET 입니다. 아무것도 쓰지 않습니다.')

    app = create_app()
    ok = False
    with app.app_context():
        # 필드 맵은 field_maps.py 가 **단일 출처**다 (2026-07-30 통합).
        # 예전에는 스크립트(dt2_import)와 앱(models_v2)이 사본을 따로 들고 있어서,
        # 갈리면 조용히 필드가 사라졌다. 지금은 사본이 다시 생기지 않았는지 본다.
        import dt2_import as _S
        from app.modules.digital_twin_dashboard import field_maps as _FM
        from app.modules.digital_twin_dashboard import assemble as _ASM

        names = ('PROJECT_FIELD_MAP', 'PERFORMANCE_FIELD_MAP',
                 'PROJECT_RELATION_KEYS', 'PERFORMANCE_RELATION_KEYS',
                 'PERFORMANCE_SKIP_KEYS', 'IMAGE_SLOTS')
        log('\n── 필드 맵 단일 출처 확인 (이관 · 재조립) ──')

        # ① 값이 같은가 — 누가 사본을 다시 만들어 값이 갈렸으면 여기서 잡힌다
        drift = [n for n in names if getattr(_S, n, None) != getattr(_FM, n, None)]
        # ② 이관 스크립트가 정말 그 파일을 읽고 있는가 — 사본을 만들고 이름만
        #    맞춰두면 ①을 통과할 수 있다. 로더가 가리키는 실제 경로를 확인한다.
        loaded = getattr(getattr(_S, 'FM', None), '__file__', None)
        if loaded is None or os.path.abspath(loaded) != os.path.abspath(_FM.__file__):
            drift.append(f'dt2_import 가 field_maps.py 를 읽지 않음 (loaded={loaded})')
        # ③ 재조립도 같은 파일을 쓰는가 (여기는 둘 다 정상 import 라 동일 객체여야 한다)
        if _ASM.PROJECT_FIELD_MAP is not _FM.PROJECT_FIELD_MAP:
            drift.append('assemble.PROJECT_FIELD_MAP')

        if drift:
            log(f'  [FAIL] field_maps.py 를 쓰지 않는 사본이 있습니다: {", ".join(drift)}')
            log('         field_maps.py 한 곳만 보도록 고친 뒤 다시 실행하세요.')
            log.close()
            sys.exit(1)
        log(f'  매핑 {len(names)}개 + 재조립 전부 field_maps.py 를 그대로 사용')

        client = app.test_client()
        admin = User.query.filter_by(role=UserRole.ADMIN, is_active=True).first()
        if admin is None:
            log('[FAIL] admin 사용자가 없어 조회할 수 없습니다.')
            log.close()
            sys.exit(1)
        hdr = {'Authorization': f'Bearer {create_access_token(identity=str(admin.id))}'}

        r1 = client.get('/api/digital-twin-dashboard/data', headers=hdr)
        r2 = client.get('/api/dt-v2/data', headers=hdr)
        if r1.status_code != 200 or r2.status_code != 200:
            log(f'[FAIL] 조회 실패 — V1 {r1.status_code} / V2 {r2.status_code}')
            log.close()
            sys.exit(1)

        d1 = r1.get_json()['data']
        d2 = r2.get_json()['data']

        log(f"\n── 머리 정보 ──")
        log(f"  version : V1 {d1.get('version')} / V2 {d2.get('version')}")
        ver_ok = d1.get('version') == d2.get('version')
        log(f"  metadata 동일 : {same(d1.get('metadata'), d2.get('metadata'))}")

        ok_p = compare_entities('과제', d1.get('projects') or [], d2.get('projects') or [],
                                log, args.detail, args.strict)
        ok_f = compare_entities('성과', d1.get('performances') or [],
                                d2.get('performances') or [], log, args.detail, args.strict)
        ok = ok_p and ok_f and ver_ok

    # ⚠️ app.config 를 보면 안 된다 — 이 스크립트는 .env 를 읽지 않고 create_app 을
    #    부르므로 늘 False 가 나온다. 실제 서버가 어떻게 떠 있는지는 .env 가 답이다.
    write_enabled = v2_write_enabled()

    log('\n' + '=' * 72)
    if ok:
        log(' 결과: [OK] V2 응답이 V1 과 같습니다. 화면 읽기를 옮겨도 됩니다.')
    elif write_enabled:
        # dt2_verify 와 같은 이유다. 판정은 그대로 두고 원인만 먼저 알린다 —
        # 모르고 보면 이관이 깨진 줄 안다(2026-07-30 실제로 그렇게 보였다).
        log(' 결과: [FAIL] 차이가 있습니다 — 다만 **DT2_WRITE_ENABLED 가 켜져 있습니다.**')
        log('')
        log('        이 상태에서는 V1 이 멈추고 dt2 만 앞서가므로 차이가 **정상**입니다.')
        log('        V2 로 만들거나 고친 것은 V1 에 반영되지 않습니다(v2_sync 도 멈춰 있습니다).')
        log('        이 대조는 컷오버 **전** 도구입니다 — V1 이 정본일 때만 판정이 성립합니다.')
        log('        이관 자체를 다시 확인하려면 그 값을 끄고 재기동해 동기화를 되살리세요.')
        log('')
        log('        ※ **"V2 에만 있는 키" 가 0개**라면 응답 **형태**는 그대로라는 뜻입니다.')
        log('           건수·값 차이는 V2 로 저장한 내용이고, 형태 차이가 진짜 회귀입니다.')
    else:
        log(' 결과: [FAIL] 차이가 있습니다. **이 상태로 화면을 옮기지 마세요.**')
        log('        --detail 로 다시 실행하면 어떤 항목의 어떤 키인지 볼 수 있습니다.')
    log('=' * 72)
    log.close()
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
