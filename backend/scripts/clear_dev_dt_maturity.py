# -*- coding: utf-8 -*-
"""개발 DB 의 성숙도 자료를 **비운다** — 운영에서 처음 열었을 때의 화면을 보려고. **개발 전용.**

왜 있나
    운영에 올리면 이 모듈은 **아무것도 없는 상태**로 시작한다. 그 화면(빈 목록·「아직 없습니다」·
    샘플 뷰만 자료가 있는 모습)을 개발에서 그대로 보려면 씨앗을 걷어내야 한다.
    샘플 뷰는 정적 JSON(sample-data.json)이라 이걸 지워도 그대로 남는다.

무엇을 지우나 (사업부에 매인 것 전부 + 전사 사전 중 씨앗이 넣은 것)
    시험 항목 · 시뮬레이션 · 연계 · 평가 · 이력 · 해석 활용 기록
    구간 · 조직 · 연계 개발 기록 · 시스템 사전(비시스템 매개까지)
    스레드·표준 구간 정의는 **코드가 처음 열 때 다시 넣는 것**이라(threads.ensure_defaults)
    운영에서도 있는 것이므로 남긴다. 설정(문턱값·재평가 기간)도 남긴다.

되돌리기
    cd backend && python scripts/seed_dev_dt_maturity.py       (씨앗을 다시 넣는다)

돌리기
    cd backend && python scripts/clear_dev_dt_maturity.py
"""
import logging
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(_HERE))
logging.disable(logging.INFO)

from app import create_app                                                   # noqa: E402
from app.extensions import db                                                # noqa: E402
from app.modules.dev_dt_maturity.models import (                             # noqa: E402
    MaturityAgent, MaturityReviewCase, MaturitySubject,
    ThreadCase, ThreadOrg, ThreadSegment, ThreadSystem,
)


def _guard(app):
    uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
    if not any(h in uri for h in ('localhost', '127.0.0.1')) and os.environ.get('DT_MATURITY_DEV_SEED') != '1':
        print('로컬 DB 가 아닙니다. 개발 전용이라 멈춥니다. (강제: DT_MATURITY_DEV_SEED=1)')
        sys.exit(2)


def main():
    app = create_app()
    app.config['SQLALCHEMY_ECHO'] = False
    _guard(app)
    with app.app_context():
        counts = {}
        # 구간이 먼저다 — 대상(subject)을 지우면 구간이 고아가 된다
        counts['구간'] = ThreadSegment.query.delete(synchronize_session=False)
        counts['연계 개발 기록'] = ThreadCase.query.delete(synchronize_session=False)
        counts['조직'] = ThreadOrg.query.delete(synchronize_session=False)
        counts['시스템'] = ThreadSystem.query.delete(synchronize_session=False)
        counts['해석 활용 기록'] = MaturityReviewCase.query.delete(synchronize_session=False)
        # 연계·평가·이력은 대상/수단에 매달려 함께 간다(cascade)
        counts['시험 항목'] = MaturitySubject.query.delete(synchronize_session=False)
        counts['시뮬레이션'] = MaturityAgent.query.delete(synchronize_session=False)
        db.session.commit()
        print('비웠습니다 —', ' · '.join(f'{k} {v}' for k, v in counts.items()))
        print('스레드·표준 구간 정의와 설정은 남겼습니다(운영에서도 코드가 넣는 것입니다).')
        print('되돌리려면: python scripts/seed_dev_dt_maturity.py')


if __name__ == '__main__':
    main()
