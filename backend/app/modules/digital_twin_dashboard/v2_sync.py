"""
V1 저장 직후 dt2_* 를 따라 맞춘다 (실행계획 7.5-3)

왜 필요한가
    화면은 페이지 진입 때마다 서버 데이터를 받아 로컬을 덮어쓴다
    (DigitalTwinDashboardApp.jsx:197). V2 가 배치로만 갱신되는 상태에서
    읽기를 V2 로 넘기면, 저장 직후 새로고침할 때 **그 수정이 사라져 보인다.**
    이 파일이 그 간극을 없앤다.

설계 — 지켜야 할 세 가지
    1. **사용자의 저장을 절대 방해하지 않는다.**
       V1 커밋이 끝난 뒤에, 별도 커넥션으로, 백그라운드에서 돈다.
       실패해도 저장은 이미 성공한 상태이고 V1 이 정본이다.
       dt2 는 배치 이관(dt2_import.py)으로 언제든 복구된다.

    2. **저장을 느리게 만들지 않는다.**
       전체 동기화가 1초 남짓인데, 저장 응답에 그대로 붙이면 체감이 나빠진다.
       원래 이 작업의 출발점이 "저장이 느려졌다" 였다. 그래서 응답 후에 돈다.

    3. **로직을 새로 만들지 않는다.**
       변환 규칙이 두 곳에 생기면 반드시 갈린다 (이미 해시·SKIP_KEYS·필드맵에서
       세 번 겪었다). scripts/dt2_import.py 의 함수를 그대로 불러 쓴다.

동시성
    한 번에 하나만 돈다. 도는 중에 또 요청이 오면 '한 번 더' 표시만 해두고 반환한다.
    동기화는 요청 본문이 아니라 **dashboard_data 를 다시 읽어서** 하므로,
    중간 요청을 건너뛰어도 마지막 한 번이 최신 상태를 반영한다.
"""

from __future__ import annotations

import importlib.util
import os
import threading
import traceback
from datetime import datetime

# 이 파일: backend/app/modules/digital_twin_dashboard/v2_sync.py
# → backend 까지 올라가려면 dirname 이 **네 번** 필요하다.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))))
_SCRIPTS_DIR = os.path.join(_BACKEND_DIR, 'scripts')
assert os.path.basename(_BACKEND_DIR) == 'backend' or os.path.isdir(_SCRIPTS_DIR), (
    f'scripts 폴더를 찾지 못했습니다: {_SCRIPTS_DIR}')

_lock = threading.Lock()          # 동기화 1개만 돌게 한다
_state_lock = threading.Lock()    # 아래 플래그 보호
_running = False
_pending = False
_last = {'at': None, 'ok': None, 'detail': '', 'ms': None}


class _QuietLog:
    """dt2_import 의 Log 자리에 끼우는 최소 구현. 파일 대신 메모리에 모은다."""

    def __init__(self):
        self.lines = []

    def __call__(self, msg=''):
        self.lines.append(msg)

    def close(self):
        pass

    def tail(self, n=6):
        meaningful = [l.strip() for l in self.lines if l.strip()]
        return ' | '.join(meaningful[-n:])


def _load_importer():
    """
    scripts/dt2_import.py 를 파일 경로로 읽어온다.

    앱 패키지가 scripts 를 import 하는 건 방향이 어색하지만,
    변환 규칙을 복제하는 것보다 훨씬 낫다. 규칙은 한 곳에만 있어야 한다.
    """
    path = os.path.join(_SCRIPTS_DIR, 'dt2_import.py')
    if not os.path.exists(path):
        raise FileNotFoundError(f'dt2_import.py 를 찾을 수 없습니다: {path}')
    import sys
    if _SCRIPTS_DIR not in sys.path:
        sys.path.insert(0, _SCRIPTS_DIR)      # dt_scan 을 같이 찾을 수 있게
    spec = importlib.util.spec_from_file_location('dt2_import_runtime', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _sync_once():
    """실제 동기화 1회. 예외를 밖으로 내보내지 않는다."""
    started = datetime.utcnow()
    log = _QuietLog()
    try:
        M = _load_importer()
        import psycopg

        dsn = M.load_dsn(None)
        conn = psycopg.connect(dsn)
        try:
            cur = conn.cursor()
            cur.execute(
                "SELECT version, projects, performances FROM dashboard_data "
                " ORDER BY id LIMIT 1")
            row = cur.fetchone()
            if row is None:
                return False, 'dashboard_data 에 행이 없습니다'
            version, projects, performances = row
            projects = [p for p in (M.as_obj(projects) or []) if isinstance(p, dict)]
            performances = [f for f in (M.as_obj(performances) or []) if isinstance(f, dict)]

            refs = M.load_refs(cur, log)
            hist = M.load_history_state(cur)
            phist = M.load_project_history_state(cur)

            # 순서는 배치 이관과 같아야 한다 — 성과가 먼저 있어야 연결 FK 가 선다
            M.import_performances(cur, performances, log, False,
                                  hist_state=hist, source='save')
            M.import_projects(cur, projects, refs, log, False,
                              hist_state=phist, source='save')
            M.import_links(cur, projects, performances, log, False)
            M.import_dependencies(cur, projects, log, False)
            M.import_attachments(cur, projects, log, False)

            conn.commit()
            ms = int((datetime.utcnow() - started).total_seconds() * 1000)
            return True, f'v{version} 동기화 {ms}ms'
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    except Exception as exc:
        detail = f'{type(exc).__name__}: {exc}'
        print(f'[V2Sync] 실패 — {detail}')
        print(traceback.format_exc())
        if log.lines:
            print(f'[V2Sync] 진행 상황: {log.tail()}')
        return False, detail


def _worker():
    global _running, _pending
    while True:
        ok, detail = _sync_once()
        started = datetime.utcnow()
        with _state_lock:
            _last.update({'at': started, 'ok': ok, 'detail': detail})
            if not _pending:
                _running = False
                return
            _pending = False       # 도는 동안 들어온 요청 — 한 번 더 돈다


def _cutover_done() -> bool:
    """
    V2 쓰기가 열려 있는가 = 컷오버가 끝났는가.

    끝났다면 정본은 V2 다. 그때도 이 동기화가 돌면 V1 을 기준으로 dt2 를 덮어써
    **방금 V2 에 쓴 값이 사라진다.** 그래서 둘을 코드 차원에서 상호배타로 만든다 —
    런북에서 사람이 "둘을 같이 뒤집는" 일 자체를 없앤다.

    ★ 판단할 수 없으면 **동기화하지 않는다** (2026-08-01 에 방향을 뒤집었다)
        예전에는 앱 컨텍스트 밖이면 "컷오버 전" 으로 보고 동기화하는 쪽으로 뒀다.
        컷오버 전에는 그게 맞았다 — 동기화를 빠뜨리면 V2 가 뒤처지니까.

        컷오버가 끝난 지금은 손실의 방향이 반대다:
          · 잘못 안 하면  dt2 가 잠깐 뒤처진다 (다음 저장이나 배치가 따라잡는다)
          · 잘못 하면    **V2 에만 있는 데이터가 V1 기준으로 덮여 사라진다**
                        (KPI 연결처럼 V1 에 원본이 없는 것은 복구 불가)
        모르면 안 하는 쪽이 안전하다.
    """
    try:
        from flask import current_app
        return bool(current_app.config.get('DT2_WRITE_ENABLED', False))
    except Exception:
        # 판단 불가 = 안 한다. 로그는 남긴다 — 조용히 안 도는 것도 그것대로 나쁘다.
        print('[V2Sync] 앱 컨텍스트 밖이라 컷오버 상태를 알 수 없습니다 — '
              '동기화를 건너뜁니다 (안전한 쪽).')
        return True


def request_sync(reason: str = ''):
    """
    저장 커밋 **직후** 호출한다. 즉시 반환하며 절대 예외를 던지지 않는다.

    이미 동기화가 돌고 있으면 '한 번 더' 표시만 남긴다. 동기화는 요청 본문이 아니라
    dashboard_data 를 다시 읽어서 하므로, 중간 요청을 합쳐도 결과가 같다.

    컷오버 후(V2 쓰기 활성)에는 아무것도 하지 않는다 — 위 `_cutover_done` 참조.
    """
    global _running, _pending
    if _cutover_done():
        with _state_lock:
            _last.update({
                'at': datetime.utcnow(), 'ok': None,
                'detail': 'V2 쓰기 활성(컷오버 완료) — V1→V2 동기화를 하지 않습니다',
            })
        return
    try:
        with _state_lock:
            if _running:
                _pending = True
                return
            _running = True
        t = threading.Thread(target=_worker, name='dt2-v2-sync', daemon=True)
        t.start()
    except Exception as exc:
        # 동기화를 못 걸었다고 저장이 실패해선 안 된다
        print(f'[V2Sync] 시작 실패 (저장에는 영향 없음) — {type(exc).__name__}: {exc}')
        with _state_lock:
            _running = False


def sync_status() -> dict:
    with _state_lock:
        return {
            'running': _running,
            'pending': _pending,
            'lastAt': _last['at'].isoformat() + 'Z' if _last['at'] else None,
            'lastOk': _last['ok'],
            'lastDetail': _last['detail'],
        }
