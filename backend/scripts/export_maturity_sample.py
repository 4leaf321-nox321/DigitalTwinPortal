# -*- coding: utf-8 -*-
"""개발 DB 의 성숙도 자료를 「샘플 뷰」용 JSON 으로 뽑는다. (2026-08-28)

왜: 기획 단계라 운영 서버에서 「자료가 이렇게 채워진다」를 보고해야 하는데 운영 DB 에 가짜 자료를
넣을 수는 없다. 그래서 화면이 API 대신 읽는 **목업 한 판**을 개발 DB 에서 뽑아 프런트에 넣는다.
샘플 뷰는 관리자·사무국만 켤 수 있고, 저장은 막힌다.

  python backend/scripts/export_maturity_sample.py
  → frontend/src/modules/dev-dt-maturity/sample/sample-data.json

키는 프런트 maturityApi 가 만드는 경로 그대로(`/board?division_id=all&sector=simulation` …).
화면이 새 경로를 쓰게 되면 여기도 같이 늘려야 한다 — 없는 키는 빈 답으로 떨어진다.
"""
import io
import json
import logging
import os
import sys
from datetime import date

logging.disable(logging.INFO)
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
OUT = os.path.join(os.path.dirname(HERE), '..', 'frontend', 'src', 'modules', 'dev-dt-maturity', 'sample', 'sample-data.json')


def main():
    from app import create_app
    from app.modules.dev_dt_maturity import definitions as D
    from app.modules.dev_dt_maturity import reviews as R
    from app.modules.dev_dt_maturity import services as S
    from app.modules.dev_dt_maturity import importer as I
    from app.modules.dev_dt_maturity.models import MaturityAgent, MaturityPair, MaturitySubject, ThreadSegment
    from app.modules.digital_twin_dashboard.models import Division

    app = create_app()
    out = {}
    with app.app_context():
        hidden = D.get_hidden_divisions()
        divs = [d for d in Division.query.filter_by(is_active=True).order_by(Division.order, Division.id).all() if d.id not in hidden]
        kpi = [d for d in divs if d.is_kpi_owner]
        ids = [d.id for d in kpi]

        out['/definitions'] = {
            'sectors': [{**s, 'active': D.sector_is_active(s['key'])} for s in D.SECTORS],
            'axes': {k: D.get_axes(k) for k in D.SECTOR_KEYS},
            'model_kinds': D.MODEL_KINDS, 'accuracy_rules': sorted(D.ACCURACY_RULES),
            'import_columns': D.IMPORT_COLUMNS, 'stale_days': D.get_stale_days(),
            'review': D.review_definitions(), 'thread': D.thread_definitions(), 'can_curate': True, 'my_division_id': None,
        }
        rows = [{'id': d.id, 'name': d.name, 'deny_reason': None, 'hidden': False} for d in divs]
        out['/divisions'] = rows
        out['/divisions?all=1'] = rows
        out['/settings'] = {k: D._setting(k) for k in D.SETTINGS_KEYS}
        out['/tool-names'] = S.tool_names() if hasattr(S, 'tool_names') else []
        out['/tool-catalog'] = S.tool_catalog() if hasattr(S, 'tool_catalog') else []

        board_all = S.board_all('simulation')
        out['/board?division_id=all&sector=simulation'] = board_all
        years = sorted({y for d in ids for y in R.years(d)}, reverse=True) or [date.today().year]
        out['/reviews/years?division_id='] = years
        for y in years:
            st = []
            for d in kpi:
                s = R.stats(d.id, y)
                s['division_name'] = d.name
                st.append(s)
            out[f'/reviews/stats?division_id=all&year={y}'] = {'year': y, 'divisions': st}

        subjects_all, agents_all, deps_all = [], [], {}
        for d in kpi:
            did = d.id
            out[f'/board?division_id={did}&sector=simulation'] = S.board(did, 'simulation')
            for days in (365, 730, 1825):
                out[f'/changes?division_id={did}&sector=simulation&days={days}'] = S.recent_changes(did, 'simulation', days)
            subs = [s.to_dict() for s in MaturitySubject.query.filter_by(division_id=did).order_by(MaturitySubject.order, MaturitySubject.id).all()]
            ags = [a.to_dict() for a in MaturityAgent.query.filter_by(division_id=did).order_by(MaturityAgent.name).all()]
            out[f'/subjects?division_id={did}'] = subs
            out[f'/agents?division_id={did}'] = ags
            subjects_all += subs
            agents_all += ags
            deps = S.departments_of(did)
            out[f'/departments?division_id={did}'] = deps
            deps_all[str(did)] = deps
            out[f'/family-catalog?division_id={did}'] = S.family_catalog(did) if hasattr(S, 'family_catalog') else []
            try:
                out[f'/reconcile?division_id={did}'] = I.reconcile(did)
            except Exception:
                out[f'/reconcile?division_id={did}'] = {'missing_here': [], 'only_here': []}
            out[f'/reviews/years?division_id={did}'] = R.years(did)
            for y in years:
                out[f'/reviews/stats?division_id={did}&year={y}'] = R.stats(did, y)
                for kind in ('', 'spec', 'cause'):
                    key = f'/reviews?division_id={did}&year={y}' + (f'&kind={kind}' if kind else '')
                    out[key] = [r.to_dict() for r in R.list_cases(did, y, kind or None)]
            for p in MaturityPair.query.join(MaturitySubject, MaturityPair.subject_id == MaturitySubject.id).filter(MaturitySubject.division_id == did).all():
                dct = S.pair_dict(p, with_changes=True)
                dct['deny_reason'] = None
                out[f'/pairs/{p.id}'] = dct
        # 디지털 스레드
        from app.modules.dev_dt_maturity import threads as T
        out['/threads'] = T.list_threads()
        out['/threads?all=1'] = T.list_threads(active_only=False)
        out['/systems'] = T.list_systems()
        out['/board?division_id=all&sector=digital_thread'] = S.board_all('digital_thread')
        for b in out['/board?division_id=all&sector=digital_thread'].get('boards', []):
            T.decorate_board(b)
        out['/systems/hubs?division_id=all'] = T.system_hubs(ids)
        out['/threads/stats?division_id=all'] = {'divisions': [{**T.thread_stats(d.id), 'division_name': d.name} for d in kpi]}
        for d in kpi:
            did = d.id
            out[f'/board?division_id={did}&sector=digital_thread'] = T.decorate_board(S.board(did, 'digital_thread'))
            for days in (365, 730, 1825):
                out[f'/changes?division_id={did}&sector=digital_thread&days={days}'] = S.recent_changes(did, 'digital_thread', days)
            out[f'/segments?division_id={did}'] = T.list_segments(did)
            out[f'/orgs?division_id={did}'] = T.list_orgs(did)
            out[f'/orgs/from-departments?division_id={did}'] = T.departments_as_orgs(did)
            out[f'/threads/stats?division_id={did}'] = T.thread_stats(did)
            out[f'/threads/org-matrix?division_id={did}'] = T.org_matrix(did)
            out[f'/systems/hubs?division_id={did}'] = T.system_hubs([did])
            for seg in ThreadSegment.query.filter_by(division_id=did).all():
                for p in seg.subject.pairs:
                    dct = S.pair_dict(p, with_changes=True)
                    dct['deny_reason'] = None
                    out[f'/pairs/{p.id}'] = dct
        out['/subjects?division_id=all'] = subjects_all
        out['/agents?division_id=all'] = agents_all
        out['/departments?division_id=all'] = deps_all

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with io.open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'), default=str)
    print(f'키 {len(out)}개 · {os.path.getsize(OUT) // 1024} KB → {os.path.normpath(OUT)}')


if __name__ == '__main__':
    main()
