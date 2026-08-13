"""
보고서 이미지 채우기 시험 — `imageId` 만 있는 이미지가 보고서에 실리는가.

배경
    Phase 1-2 에서 이미지를 파일 + `imageId` 로 분리했는데 보고서 생성기는 계속
    `dataUrl` 만 읽었다. 그래서 분리 이후의 이미지는 **화면에는 보이는데 PPT·PDF 에는
    안 나왔다**(2026-07-30 리허설에서 발견). `hydrate_report_images` 가 그 간극을 메운다.

    삽입 지점이 12곳(PPT 6 + PDF 템플릿 6)이라 각각 고치지 않고 **들어올 때 한 번**
    채우는 방식을 골랐다. 이 시험은 그 한 지점이 제대로 도는지 본다.

안전장치
    시험용 이미지 파일과 레코드를 직접 만들고 끝나면 지운다.
    기존 이미지는 건드리지 않는다. 마지막에 건수를 대조한다.

사용법
    python scripts\\dt_test_report_images.py
"""

from __future__ import annotations

import base64
import os
import sys
import uuid as uuidlib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.modules.digital_twin_dashboard.models import ReportImage, UPLOAD_FOLDER
from app.modules.digital_twin_dashboard.routes import (
    hydrate_report_images, REPORT_IMAGE_SLOTS,
)

MARK = '__dt_report_img_test__'
# 1x1 PNG
PNG = base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')

results = []


def check(desc, cond, extra=''):
    results.append((desc, bool(cond)))
    print(f"  {'[OK]  ' if cond else '[FAIL]'} {desc}" + (f'   {extra}' if not cond and extra else ''))


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    with app.app_context():
        app.config['SQLALCHEMY_ECHO'] = False
        before_count = ReportImage.query.count()

        if not os.path.exists(UPLOAD_FOLDER):
            os.makedirs(UPLOAD_FOLDER)

        stored = f'{MARK}_{uuidlib.uuid4().hex}.png'
        path = os.path.join(UPLOAD_FOLDER, stored)
        with open(path, 'wb') as fh:
            fh.write(PNG)

        row = ReportImage(project_id=MARK, slot='이미지_개요그림', position=0,
                          stored_filename=stored, mime_type='image/png',
                          file_size=len(PNG), source='upload',
                          original_filename=f'{MARK}.png')
        db.session.add(row)
        db.session.commit()
        image_id = row.id
        print(f'\n시험용 이미지 생성: id={image_id}')

        try:
            print('\n[1] imageId 만 있는 이미지에 dataUrl 이 채워진다')
            project = {'id': 'T-1', '이미지_개요그림': [{'imageId': image_id, 'caption': '설명'}]}
            filled, skipped = hydrate_report_images([project])
            el = project['이미지_개요그림'][0]
            check('★ dataUrl 이 채워진다', bool(el.get('dataUrl')))
            check('  채운 장수 1 · 건너뛴 장수 0', (filled, skipped) == (1, 0),
                  f'실제 {(filled, skipped)}')
            check('★ 내용이 원본 파일과 같다',
                  el.get('dataUrl', '').endswith(base64.b64encode(PNG).decode()),
                  'base64 가 다르다')
            check('  mime 이 앞에 붙는다', el.get('dataUrl', '').startswith('data:image/png;base64,'))
            check('  caption 은 그대로', el.get('caption') == '설명')

            print('\n[2] 이미 dataUrl 이 있으면 건드리지 않는다 (예전 데이터)')
            keep = 'data:image/png;base64,AAAA'
            project = {'이미지_좌측': [{'imageId': image_id, 'dataUrl': keep}]}
            filled, _ = hydrate_report_images([project])
            check('★ 기존 dataUrl 을 덮어쓰지 않는다',
                  project['이미지_좌측'][0]['dataUrl'] == keep)
            check('  채울 것이 없다고 센다', filled == 0, f'실제 {filled}')

            print('\n[3] 같은 이미지가 여러 번 나와도 처리된다')
            project = {
                '이미지_좌측': [{'imageId': image_id}],
                '이미지_우측': [{'imageId': image_id}, {'imageId': image_id}],
            }
            filled, _ = hydrate_report_images([project])
            check('세 원소 모두 채워진다', filled == 3, f'실제 {filled}')
            check('  값이 같다',
                  project['이미지_좌측'][0]['dataUrl'] == project['이미지_우측'][1]['dataUrl'])

            print('\n[4] 슬롯 다섯 개를 모두 본다')
            project = {slot: [{'imageId': image_id}] for slot in REPORT_IMAGE_SLOTS}
            filled, _ = hydrate_report_images([project])
            check('★ 다섯 슬롯 전부 채워진다', filled == len(REPORT_IMAGE_SLOTS),
                  f'실제 {filled} / {len(REPORT_IMAGE_SLOTS)}')

            print('\n[5] 없는 참조는 건너뛰되 보고서 생성을 막지 않는다')
            project = {'이미지_좌측': [{'imageId': 99999999}, {'imageId': image_id}]}
            filled, skipped = hydrate_report_images([project])
            check('★ 있는 것만 채우고 없는 것은 건너뛴다', (filled, skipped) == (1, 1),
                  f'실제 {(filled, skipped)}')
            check('  예외를 던지지 않는다', True)

            print('\n[6] 입력 형태를 가리지 않는다')
            single = {'이미지_좌측': [{'imageId': image_id}]}
            hydrate_report_images(single)          # 리스트가 아니라 dict 한 개
            check('dict 하나만 넘겨도 된다 (/report/ppt 경로)',
                  bool(single['이미지_좌측'][0].get('dataUrl')))
            check('빈 입력도 안전하다', hydrate_report_images([]) == (0, 0))
            check('이미지가 없는 과제도 안전하다',
                  hydrate_report_images([{'id': 'x'}]) == (0, 0))

        finally:
            ReportImage.query.filter_by(project_id=MARK).delete(synchronize_session=False)
            db.session.commit()
            if os.path.exists(path):
                os.remove(path)
            print('\n── 정리 ──')
            check('레코드 건수 원복', ReportImage.query.count() == before_count,
                  f'{before_count} → {ReportImage.query.count()}')
            check('시험 파일 삭제됨', not os.path.exists(path))

    ok = sum(1 for _, c in results if c)
    bad = len(results) - ok
    print('\n' + '=' * 72)
    print(f'결과: {ok}/{len(results)} 통과' + (f' — [FAIL] {bad}건' if bad else ' — [OK]'))
    if bad:
        for desc, c in results:
            if not c:
                print(f'  [FAIL] {desc}')
    print('=' * 72)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
