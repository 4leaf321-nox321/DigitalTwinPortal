"""
보고서 이미지가 **실제로 실릴 수 있는 상태인지** 확인 (읽기 전용).

지나온 경위
    Phase 1-2(2026-07-28)에서 보고서 이미지를 과제 JSON 의 base64(`dataUrl`) 에서
    파일 + `imageId` 참조로 바꿨다. 저장 payload 가 94% 줄어든 그 작업이다.
    그런데 **보고서(PPT·PDF) 생성기를 같이 고치지 않아서** `imageId` 만 가진
    이미지는 화면에는 보이는데 보고서에는 안 나왔다(2026-07-30 리허설에서 발견).

    2026-07-31 `hydrate_report_images` 로 고쳤다. 보고서를 만들 때 `imageId` 를
    파일에서 읽어 `dataUrl` 을 채운다. **따라서 `imageId 만` 은 이제 정상이다.**

이 스크립트가 답하는 것
    1. 이 서버에 그 수정이 들어와 있는가 (routes.py 를 직접 확인)
    2. 수정이 없다면 — 보고서에서 빠지는 장수는 몇인가
    3. 수정이 있다면 — 채우지 못할 이미지가 있는가
       (참조가 가리키는 행이 없거나, 행은 있는데 파일이 없는 경우)

반출 안전
    **건수·슬롯명·과제 code·파일 존재 여부만** 출력한다.
    이미지 내용도, 캡션도, 과제명도 찍지 않는다.

사용법
    python scripts\\dt_report_image_check.py
    python scripts\\dt_report_image_check.py --detail    # 과제 code 까지
"""

from __future__ import annotations

import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
sys.path.insert(0, HERE)

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

try:
    from dt2_verify import v2_write_enabled
except ImportError:
    def v2_write_enabled():
        return False

SLOTS = ['이미지_좌측', '이미지_우측', '이미지_개요그림',
         '이미지_상세내용그림', '이미지_향후계획그림']

UPLOAD_DIR = os.path.join(BACKEND, 'uploads', 'digital-twin-dashboard')

ROUTES_PY = os.path.join(BACKEND, 'app', 'modules', 'digital_twin_dashboard', 'routes.py')


def fix_applied():
    """이 서버 코드에 imageId → dataUrl 채우기가 들어와 있는가.

    정의만 있고 호출이 없으면 반쪽이므로 **호출 지점까지** 센다.
    (/report/ppt · /report/ppt/batch · /report/pdf/batch 세 곳)
    """
    try:
        with open(ROUTES_PY, encoding='utf-8') as fh:
            text = fh.read()
    except OSError:
        return None, 0
    if 'def hydrate_report_images' not in text:
        return False, 0
    calls = text.count('hydrate_report_images(') - 1      # 정의 한 줄 빼기
    return calls > 0, calls


def as_obj(v):
    if isinstance(v, (list, dict)):
        return v
    try:
        return json.loads(v)
    except Exception:
        return None


def main():
    ap = argparse.ArgumentParser(description='보고서 이미지 상태 확인 (읽기 전용)')
    ap.add_argument('--dsn')
    ap.add_argument('--detail', action='store_true', help='과제 code 까지 출력')
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    dsn = load_dsn(args.dsn)
    print('=' * 72)
    print(' 보고서 이미지 상태 — 이미지가 보고서에 실릴 수 있는가 (읽기 전용)')
    print('=' * 72)
    print(f' 대상 : {mask_dsn(dsn)}')

    fixed, n_calls = fix_applied()
    if fixed is None:
        print(' 코드 : [??] routes.py 를 읽지 못했습니다 — 수정 적용 여부 미확인')
    elif fixed:
        print(f' 코드 : [OK] imageId → dataUrl 채우기 적용됨 (호출 {n_calls}곳)')
    else:
        print(' 코드 : [FAIL] imageId → dataUrl 채우기가 **없습니다** — 배포가 필요합니다')

    conn = psycopg.connect(dsn)
    try:
        cur = conn.cursor()

        # 어디를 읽을 것인가.
        #   컷오버 전 : V1 dashboard_data 가 살아 있는 원본
        #   컷오버 후 : V1 은 멈춰 있다. 그걸 읽으면 옛날 숫자를 보고 [OK] 라고 한다.
        # 두 곳 모두 {슬롯: [{imageId|dataUrl, ...}]} 로 모양이 같아 세는 법은 똑같다.
        if v2_write_enabled():
            print(' 원본 : dt2_projects.image_refs_json (V2 쓰기 켜짐 — V1 은 멈춤)')
            cur.execute("""SELECT code, uuid, image_refs_json FROM dt2_projects
                            WHERE COALESCE(is_permanently_deleted, false) = false""")
            projects = []
            for code, uid, refs in cur.fetchall():
                obj = as_obj(refs)
                if isinstance(obj, dict):
                    projects.append(dict(obj, id=code or str(uid or '')[:8]))
        else:
            print(' 원본 : dashboard_data.projects (V1)')
            cur.execute('SELECT projects FROM dashboard_data ORDER BY id LIMIT 1')
            row = cur.fetchone()
            if row is None:
                print('\n [FAIL] dashboard_data 에 행이 없습니다.')
                return 1
            projects = [p for p in (as_obj(row[0]) or [])
                        if isinstance(p, dict) and not p.get('_permanentlyDeleted')]

        only_id, only_url, both, neither = [], 0, 0, []
        per_slot = {}
        total = 0
        for p in projects:
            code = p.get('id') or (p.get('uuid') or '')[:8]
            for slot in SLOTS:
                for el in (p.get(slot) or []):
                    if not isinstance(el, dict):
                        continue
                    total += 1
                    has_id = bool(el.get('imageId'))
                    has_url = bool(el.get('dataUrl'))
                    per_slot.setdefault(slot, [0, 0])
                    if has_id and has_url:
                        both += 1
                        per_slot[slot][1] += 1
                    elif has_id:
                        only_id.append((code, slot, el.get('imageId')))
                        per_slot[slot][0] += 1
                    elif has_url:
                        only_url += 1
                        per_slot[slot][1] += 1
                    else:
                        neither.append((code, slot))

        verdict_id_only = '파일에서 채워 실린다' if fixed else '**보고서에서 빠진다** ★'
        print(f'\n── 과제 {len(projects)}개(영구삭제 제외) · 이미지 원소 {total}개 ──')
        print(f'  dataUrl 만        {only_url:5}  → 실린다 (예전 방식)')
        print(f'  둘 다             {both:5}  → 실린다')
        print(f'  imageId 만        {len(only_id):5}  → {verdict_id_only}')
        print(f'  둘 다 없음        {len(neither):5}  → 참조가 깨진 원소 ★')

        if per_slot:
            print('\n── 슬롯별 (imageId 만 / dataUrl 있음) ──')
            for slot in SLOTS:
                if slot in per_slot:
                    miss, ok_ = per_slot[slot]
                    print(f'  {slot:20} {miss:4} / {ok_:4}')

        affected = sorted({c for c, _, _ in only_id})
        if only_id and not fixed:
            print(f'\n  영향받는 과제 {len(affected)}개')
            if args.detail:
                for code in affected:
                    print(f'      {code}')

        # 파일 실체 확인 — 보고서를 만들 때 서버가 이 파일을 읽는다
        missing_row, missing_file = [], []
        cur.execute("SELECT to_regclass('public.dt_report_images')")
        if cur.fetchone()[0] is not None:
            cur.execute('SELECT count(*) FROM dt_report_images')
            n_rows = cur.fetchone()[0]
            print(f'\n── dt_report_images {n_rows}행 ──')
            ids = [i for _, _, i in only_id]
            if ids:
                cur.execute(
                    'SELECT id, stored_filename FROM dt_report_images WHERE id = ANY(%s)',
                    (ids,))
                found = {r[0]: r[1] for r in cur.fetchall()}
                for i in ids:
                    if i not in found:
                        missing_row.append(i)
                    elif not os.path.exists(os.path.join(UPLOAD_DIR, found[i])):
                        missing_file.append(i)
            print(f'  참조가 가리키는 행이 없음 : {len(missing_row)}건 ★')
            print(f'  행은 있는데 파일이 없음   : {len(missing_file)}건 ★')
            print(f'  (파일 위치: {UPLOAD_DIR})')
        else:
            print('\n  dt_report_images 테이블이 없습니다 — Phase 1-2 미적용으로 보입니다.')

        # ★ 표시가 붙은 것만 진짜 문제다. imageId 만 있는 것은 수정 후에는 정상.
        broken = len(neither) + len(missing_row) + len(missing_file)

        print('\n' + '=' * 72)
        if fixed is False:
            if not only_id and not neither:
                print(' 결과: [OK] 수정 전 코드지만 빠지는 이미지가 없습니다.')
                print('        (imageId 방식 이미지가 아직 없다는 뜻입니다)')
                return 0
            print(f' 결과: [FAIL] 보고서에서 빠지는 이미지 {len(only_id)}장'
                  f' (과제 {len(affected)}개).')
            print('        화면에는 보이지만 PPT·PDF 에는 안 나옵니다.')
            print('        원인: 이 서버 코드에 imageId → dataUrl 채우기가 없습니다.')
            print('        조치: 수정된 코드를 배포하면 그대로 해결됩니다(데이터 손대지 않음).')
            return 1

        if broken == 0:
            print(' 결과: [OK] 이미지 원소가 모두 보고서에 실릴 수 있습니다.')
            if fixed is None:
                print('        단, 코드 확인은 못 했습니다 — 보고서를 한 번 뽑아 눈으로 보세요.')
            return 0

        print(f' 결과: [FAIL] 실을 수 없는 이미지 {broken}장.')
        if neither:
            print(f'        · 참조가 아예 없는 원소 {len(neither)}장')
        if missing_row:
            print(f'        · imageId 가 가리키는 행이 없음 {len(missing_row)}장')
        if missing_file:
            print(f'        · 행은 있는데 파일이 없음 {len(missing_file)}장'
                  f' — uploads 폴더를 같이 옮겼는지 확인하세요')
        print('        보고서 생성은 실패하지 않고 그 장만 빠집니다.')
        return 1
    finally:
        conn.close()


if __name__ == '__main__':
    sys.exit(main())
