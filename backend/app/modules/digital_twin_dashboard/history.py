"""
쓰기 경로에서 이력을 남긴다 (Phase 3).

배치 이관(scripts/dt2_import.py)과 **같은 판단 기준**을 쓴다.
정규화·해시는 history_hash.py 한 곳에만 있고 양쪽이 거기서 가져다 쓴다.
기준이 갈리면 바뀌지도 않은 값에 매번 새 행이 생긴다.

컷오버 전  이력을 쌓는 건 배치 스크립트뿐이다 (해상도 = 이관 주기)
컷오버 후  이 파일이 쓰기마다 호출된다 (해상도 = 실제 변경 시점)
           change_kind 로 'import' 와 'api' 를 구분한다
"""

from __future__ import annotations

from datetime import datetime

from app.extensions import db
from app.modules.digital_twin_dashboard.models_v2 import (
    Dt2Performance, Dt2PerformanceHistory,
    Dt2Project, Dt2ProjectHistory,
)
from app.modules.digital_twin_dashboard.history_hash import (
    PERF_HISTORY_COLS, PROJECT_HISTORY_COLS,
    value_hash, changed_fields, derive_project_counts,
)


def _utcnow():
    # BaseModel 이 naive UTC 를 쓴다. SQL now() 는 KST 라 섞으면 9시간 어긋난다.
    return datetime.utcnow()


def _latest(model, uuid_col, uuid_value):
    return (model.query
            .filter(uuid_col == uuid_value)
            .order_by(model.observed_at.desc(), model.id.desc())
            .first())


def record_project_history(project: Dt2Project, source='api', flush=True):
    """
    과제 진척 이력. 값이 직전 기록과 같으면 아무것도 쓰지 않고 None 을 돌려준다.

    호출자는 이 함수를 **커밋 전에** 부른다. 같은 트랜잭션 안에 있어야
    과제 수정은 됐는데 이력만 빠지는 일이 생기지 않는다.
    """
    counts = derive_project_counts({
        'action_items_json': project.action_items_json,
        'issues_json': project.issues_json,
    })
    values = {
        'status': project.status,
        'progress': project.progress,
        'start_month': project.start_month,
        'end_month': project.end_month,
        **counts,
    }
    new_hash = value_hash(values, PROJECT_HISTORY_COLS)

    prev = _latest(Dt2ProjectHistory, Dt2ProjectHistory.project_uuid, project.uuid)
    if prev is not None and prev.value_hash == new_hash:
        return None

    prev_values = None
    if prev is not None:
        prev_values = {c: getattr(prev, c) for c in PROJECT_HISTORY_COLS}

    row = Dt2ProjectHistory(
        project_uuid=project.uuid,
        observed_at=_utcnow(),
        source_updated_at=project.updated_at,
        year=project.year,
        value_hash=new_hash,
        changed_fields=changed_fields(values, prev_values, PROJECT_HISTORY_COLS),
        change_kind='seed' if prev is None else source,
        source=source,
        **values,
    )
    db.session.add(row)
    if flush:
        db.session.flush()
    return row


def record_performance_history(perf: Dt2Performance, source='api', flush=True):
    """성과 수준값 이력. 규칙은 과제와 같다."""
    values = {c: getattr(perf, c) for c in PERF_HISTORY_COLS}
    new_hash = value_hash(values, PERF_HISTORY_COLS)

    prev = _latest(Dt2PerformanceHistory,
                   Dt2PerformanceHistory.performance_uuid, perf.uuid)
    if prev is not None and prev.value_hash == new_hash:
        return None

    prev_values = None
    if prev is not None:
        prev_values = {c: getattr(prev, c) for c in PERF_HISTORY_COLS}

    row = Dt2PerformanceHistory(
        performance_uuid=perf.uuid,
        observed_at=_utcnow(),
        source_updated_at=perf.updated_at,
        year=perf.year,
        value_hash=new_hash,
        changed_fields=changed_fields(values, prev_values, PERF_HISTORY_COLS),
        change_kind='seed' if prev is None else source,
        source=source,
        **values,
    )
    db.session.add(row)
    if flush:
        db.session.flush()
    return row
