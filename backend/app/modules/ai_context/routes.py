"""
AI Context API - Returns structured context data for AI assistant per page
Includes intent classification, server-side analysis, and FAQ support.
"""
import json
import re
from datetime import datetime, date
from flask import request, jsonify
from app.modules.ai_context import bp
from app.extensions import db


PLATFORM_INTRO = """당신은 "디지털 트윈 포털"의 AI 어시스턴트입니다.
이 플랫폼은 전사 디지털 트윈 통합 정보 공유 포탈로, 과제 관리, 지식 그래프, 문서 자동 작성, 회의 관리, 협업 게시판 등 다양한 모듈을 제공합니다.
한국어로 친절하게 답변하세요. 모르는 내용은 모른다고 솔직히 말하세요."""

LIGHT_SYSTEM_PROMPT = """당신은 "디지털 트윈 포털"의 AI 어시스턴트입니다.
아래 분석 결과를 기반으로 한국어로 친절하고 정확하게 답변하세요.
분석 결과에 없는 내용은 추측하지 마세요."""


# ─── Project Field Accessor ───────────────────────────────────
# Actual data uses Korean field names. Helper to access with fallback.

def _pf(p, field):
    """Get project field value, trying Korean name first then English fallback."""
    FIELD_MAP = {
        'name': ['과제명', 'name'],
        'division': ['사업부', 'division'],
        'department': ['담당부서목록', 'department'],
        'status': ['진행상태', 'status'],
        'process': ['프로세스', 'process'],
        'year': ['과제년도', 'year'],
        'start': ['시작', 'start'],
        'end': ['종료', 'end'],
        'startDate': ['startDate'],
        'endDate': ['endDate'],
        'manager': ['과제PL', 'manager'],
        'description': ['과제상세설명', 'description'],
        'classification': ['과제구분', 'classification'],
        'progress_rate': ['progress'],
        'is_poc': ['PoC과제여부'],
        'is_key': ['중점과제여부'],
        'author': ['작성자'],
        'performances': ['성과목록'],
        'action_items': ['액션아이템목록'],
        'participants': ['과제참여인력목록'],
    }
    keys = FIELD_MAP.get(field, [field])
    for k in keys:
        val = p.get(k)
        if val is not None:
            return val
    return None


# ─── FAQ Database ──────────────────────────────────────────────

DASHBOARD_FAQ = {
    '과제 추가': {
        'keywords': ['과제 추가', '과제 등록', '과제를 추가', '새 과제', '과제 만들', '과제 생성'],
        'answer': '과제를 추가하려면:\n1. 대시보드 상단의 "과제 추가" 버튼을 클릭하세요.\n2. 과제명, 부문, 부서, 공정, 상태, 시작/종료일 등을 입력하세요.\n3. "저장" 버튼을 눌러 완료합니다.\n\n여러 과제를 한 번에 추가하려면 "일괄 추가" 기능을 이용하세요.'
    },
    '엑셀 내보내기': {
        'keywords': ['엑셀', 'excel', '내보내기', '다운로드', 'export', '데이터 추출'],
        'answer': '데이터를 엑셀로 내보내려면:\n1. 대시보드 우측 상단의 내보내기 버튼을 클릭하세요.\n2. "엑셀 다운로드"를 선택합니다.\n3. 현재 과제/성과 데이터가 .xlsx 파일로 다운로드됩니다.\n\nJSON 형식으로도 내보낼 수 있습니다.'
    },
    '간트 차트': {
        'keywords': ['간트', 'gantt', '차트', '일정 시각화', '일정 보기'],
        'answer': '간트 차트를 확인하려면:\n1. 대시보드 하단의 "간트 차트" 탭을 클릭하세요.\n2. 각 과제의 시작일~종료일이 막대 형태로 표시됩니다.\n3. 마우스를 올리면 상세 정보를 확인할 수 있습니다.'
    },
    '데이터 가져오기': {
        'keywords': ['가져오기', 'import', '업로드', '데이터 입력', '파일 올리기'],
        'answer': '데이터를 가져오려면:\n1. 대시보드 우측 상단의 가져오기 버튼을 클릭하세요.\n2. JSON 또는 엑셀 파일을 선택합니다.\n3. 데이터가 자동으로 파싱되어 기존 데이터에 추가됩니다.\n\n기존 데이터와 병합하거나 교체할 수 있습니다.'
    },
    '성과 관리': {
        'keywords': ['성과 추가', '성과 등록', '성과 관리', '성과 입력', 'KPI 입력'],
        'answer': '성과 항목을 관리하려면:\n1. "성과 관리" 탭으로 이동하세요.\n2. "성과 추가" 버튼을 눌러 새 항목을 등록합니다.\n3. 카테고리, 세부 카테고리, 값, 단위를 입력합니다.\n4. 특정 과제와 연계할 수도 있습니다.'
    },
    '동기화': {
        'keywords': ['동기화', '서버 저장', '서버 동기화', '클라우드', '저장'],
        'answer': '서버 동기화 방법:\n1. 우측 상단의 "서버 동기화" 버튼을 클릭하세요.\n2. 현재 로컬 데이터가 서버에 저장됩니다.\n3. 다른 기기에서도 동일한 데이터를 확인할 수 있습니다.\n\n자동 저장은 데이터 변경 시 자동으로 이루어집니다.'
    },
    '스냅샷': {
        'keywords': ['스냅샷', 'snapshot', '백업', '복원', '이전 버전'],
        'answer': '스냅샷(버전 관리) 기능:\n1. "스냅샷 저장"을 누르면 현재 상태가 저장됩니다.\n2. "스냅샷 목록"에서 이전 버전을 확인할 수 있습니다.\n3. 원하는 시점으로 복원할 수 있습니다.\n\n중요 변경 전에 스냅샷을 저장해두면 안전합니다.'
    },
    '보고서': {
        'keywords': ['보고서', '리포트', 'report', '자동 생성', '보고서 작성'],
        'answer': '보고서 자동 생성 기능:\n1. 대시보드 상단의 "보고서" 버튼을 클릭하세요.\n2. 현재 과제/성과 데이터를 기반으로 보고서가 자동 생성됩니다.\n3. 생성된 보고서를 다운로드하거나 편집할 수 있습니다.'
    },
    '과제 수정': {
        'keywords': ['과제 수정', '과제 편집', '과제를 수정', '과제 변경', '과제 업데이트'],
        'answer': '과제를 수정하려면:\n1. 과제 목록에서 수정할 과제를 클릭하세요.\n2. 편집 모드에서 필요한 항목을 수정합니다.\n3. "저장" 버튼을 눌러 변경사항을 반영합니다.'
    },
    '과제 삭제': {
        'keywords': ['과제 삭제', '과제 제거', '과제를 삭제', '과제 지우기'],
        'answer': '과제를 삭제하려면:\n1. 과제 목록에서 삭제할 과제를 선택하세요.\n2. 삭제 버튼(휴지통 아이콘)을 클릭합니다.\n3. 확인 대화상자에서 "삭제"를 눌러 완료합니다.\n\n삭제된 과제는 복구할 수 없으니 주의하세요.'
    },
}

# ─── Intent Patterns for Dashboard ─────────────────────────────

INTENT_PATTERNS = {
    'delayed_projects': {
        'keywords': ['지연', '늦은', '마감 초과', '마감 지난', 'delay', '기한 초과', '오버', '미완료.*기한'],
        'description': '지연된 과제 분석'
    },
    'project_stats': {
        'keywords': ['현황', '통계', '요약', '상태별', '현재 상태'],
        'description': '과제 통계/현황'
    },
    'project_search': {
        'keywords': ['찾아', '검색', '어떤 과제', '관련 과제', '이름이', '라는 과제', '에 대해'],
        'description': '과제 검색'
    },
    'division_analysis': {
        'keywords': ['사업부', '부서', '부문', '부서별', '부문별', '팀별', '조직별', '부서 현황', '부문 현황'],
        'description': '부서/부문별 분석'
    },
    'manager_search': {
        'keywords': ['담당자', '담당', '누가', '맡은', '관리자', '책임자'],
        'description': '담당자별 검색'
    },
    'kpi_analysis': {
        'keywords': ['KPI', 'kpi', '성과', '실적', '달성률', '달성', '목표 대비', '성과지표'],
        'description': 'KPI/성과 분석'
    },
    'timeline_analysis': {
        'keywords': ['일정', '스케줄', '기간', '이번 달', '이번달', '이번 주', '이번주', '완료된', '완료 예정', '시작 예정'],
        'description': '일정 분석'
    },
    'year_search': {
        'keywords': [r'\d{4}년', r'\d{4}년도'],
        'description': '연도별 과제 검색'
    },
    'progress_analysis': {
        'keywords': ['진행률', '진행 상황', '진척', '진척률', '완료율', '얼마나'],
        'description': '진행률 분석'
    },
    'count_query': {
        'keywords': ['몇 건', '몇건', '몇개', '몇 개', '개수', '총'],
        'description': '개수 조회'
    },
    'comparison': {
        'keywords': ['비교', '대비', '차이', 'vs', 'VS'],
        'description': '과제 비교'
    },
    'recent_activity': {
        'keywords': ['최근', '활동', '로그', '변경', '업데이트', '수정 이력'],
        'description': '최근 활동'
    },
}


@bp.route('/context', methods=['GET'])
def get_ai_context():
    """Get AI context for a specific page"""
    page = request.args.get('page', 'main')

    try:
        builders = {
            'main': _build_main_context,
            'dashboard': _build_dashboard_context,
            'auto-document': _build_auto_document_context,
            'dx-work-process': _build_dx_work_process_context,
            'meeting-management': _build_meeting_context,
            'collaboration-board': _build_collaboration_context,
            'office-management': _build_office_context,
            'spdm-status': _build_spdm_context,
            'digital-twin-tech-level': _build_tech_level_context,
            'digital-twin-reference': _build_reference_context,
            'dev-manufacturing-process': _build_dev_process_context,
            'company-material-council': _build_material_context,
        }

        builder = builders.get(page, _build_generic_context)
        context = builder()

        return jsonify({'success': True, 'context': context})
    except Exception as e:
        # Fallback context on error
        return jsonify({
            'success': True,
            'context': f"{PLATFORM_INTRO}\n\n현재 페이지: {page}\n(상세 데이터를 불러오는 중 오류가 발생했습니다: {str(e)})"
        })


# ─── Smart Analyze Endpoint ────────────────────────────────────

@bp.route('/analyze', methods=['POST'])
def analyze_query():
    """
    Analyze user query: classify intent, run server-side analysis,
    and return structured result. Reduces LLM burden significantly.

    Request: { page, query }
    Response: { type: 'faq'|'analysis'|'llm', answer?, analysis?, context? }
    """
    data = request.get_json() or {}
    page = data.get('page', 'main')
    query = data.get('query', '').strip()

    if not query:
        return jsonify({'type': 'llm', 'context': PLATFORM_INTRO})

    try:
        # Step 1: Check FAQ first (no LLM needed)
        if page == 'dashboard':
            faq_answer = _match_faq(query, DASHBOARD_FAQ)
            if faq_answer:
                return jsonify({'type': 'faq', 'answer': faq_answer})

        # Step 2: Intent classification + server-side analysis
        if page == 'dashboard':
            # Check if query mentions a known division name → force division_analysis
            intent = _classify_intent(query)

            # Auto-detect division name in query even without "사업부" keyword
            if not intent or intent == 'count_query':
                known_divisions = _get_known_divisions()
                query_upper = query.upper()
                for div_name in known_divisions:
                    if div_name.upper() in query_upper:
                        intent = 'division_analysis'
                        break

            if intent:
                analysis = _run_dashboard_analysis(intent, query)
                if analysis:
                    return jsonify({
                        'type': 'analysis',
                        'intent': intent,
                        'analysis': analysis['result'],
                        'context': f"{LIGHT_SYSTEM_PROMPT}\n\n## 사용자 질문\n\"{query}\"\n\n## 분석 결과 (서버에서 계산됨)\n{analysis['result']}\n\n위 내용을 기반으로만 자연스럽게 답변하세요."
                    })

        # Step 3: Fallback - use full context so LLM can answer freely
        # (no intent matched, so give the LLM the complete page data)
        return jsonify({'type': 'llm', 'context': None})

    except Exception as e:
        return jsonify({
            'type': 'llm',
            'context': f"{PLATFORM_INTRO}\n\n현재 페이지: {page}\n(분석 중 오류: {str(e)})"
        })


def _get_known_divisions():
    """Get unique division names from actual project data"""
    try:
        from app.modules.digital_twin_dashboard.models import DashboardData
        dashboard = DashboardData.query.order_by(DashboardData.updated_at.desc()).first()
        if not dashboard:
            return set()
        projects = dashboard.projects or []
        divisions = set()
        for p in projects:
            if p.get('_deleted') or p.get('_permanentlyDeleted'):
                continue
            div = _pf(p, 'division')
            if div:
                divisions.add(div)
        return divisions
    except Exception:
        return set()


def _match_faq(query, faq_db):
    """Match query against FAQ database using keyword matching"""
    query_lower = query.lower()
    best_match = None
    best_score = 0

    for key, item in faq_db.items():
        score = 0
        for kw in item['keywords']:
            if kw.lower() in query_lower:
                score += len(kw)  # longer keyword = higher confidence
        if score > best_score:
            best_score = score
            best_match = item['answer']

    # Only return if we have a reasonable match (at least 2 chars matched)
    return best_match if best_score >= 2 else None


def _classify_intent(query):
    """Classify user query intent using keyword patterns.
    When multiple intents match, combines them (e.g. division + count = division-specific count).
    """
    query_lower = query.lower()
    matched_intents = {}

    for intent, config in INTENT_PATTERNS.items():
        score = 0
        for kw in config['keywords']:
            if re.search(kw, query_lower):
                score += len(kw)
        if score >= 2:
            matched_intents[intent] = score

    if not matched_intents:
        return None

    # If both division_analysis and count_query matched, it's a division-specific question
    # e.g. "MX 사업부 과제는 몇개야?" → division_analysis (not count_query)
    if 'division_analysis' in matched_intents and 'count_query' in matched_intents:
        return 'division_analysis'

    # If both year_search and count_query matched, it's a year-specific question
    if 'year_search' in matched_intents and 'count_query' in matched_intents:
        return 'year_search'

    # If year_search matched at all, prioritize it
    if 'year_search' in matched_intents:
        return 'year_search'

    # If division matched at all, prioritize it
    if 'division_analysis' in matched_intents:
        return 'division_analysis'

    # Otherwise pick highest score
    return max(matched_intents, key=matched_intents.get)


def _run_dashboard_analysis(intent, query):
    """Run server-side analysis based on classified intent.
    Uses _pf() helper to access fields with Korean/English fallback.
    """
    from app.modules.digital_twin_dashboard.models import (
        DashboardData, DashboardActivityLog, KPICategory, KPI
    )

    dashboard = DashboardData.query.order_by(DashboardData.updated_at.desc()).first()
    if not dashboard:
        return {'result': '현재 등록된 과제 데이터가 없습니다.'}

    projects = dashboard.projects or []
    performances = dashboard.performances or []
    active_projects = [p for p in projects if not p.get('_deleted') and not p.get('_permanentlyDeleted')]
    today = date.today()

    if intent == 'delayed_projects':
        delayed = []
        for p in active_projects:
            status = _pf(p, 'status') or ''
            if status == '완료':
                continue
            # Check status text for delay
            if status == '지연':
                name = _pf(p, 'name') or '(제목없음)'
                year = _pf(p, 'year') or ''
                end_month = _pf(p, 'end')
                manager = _pf(p, 'manager') or '-'
                dept_list = _pf(p, 'department')
                dept = ', '.join(dept_list) if isinstance(dept_list, list) else (dept_list or '-')
                period = f"{year}년 {_pf(p, 'start') or '?'}월~{end_month or '?'}월"
                delayed.append(
                    f"- {name}"
                    f" | 사업부: {_pf(p, 'division') or '-'}"
                    f" | 기간: {period}"
                    f" | 상태: {status}"
                    f" | 과제PL: {manager}"
                )
        if delayed:
            ratio = f"{len(delayed)}/{len(active_projects)}"
            return {'result': f"지연된 과제: {len(delayed)}건 (전체 대비 {ratio})\n" + '\n'.join(delayed)}
        return {'result': '현재 "지연" 상태인 과제가 없습니다.'}

    elif intent == 'project_stats':
        status_counts = {}
        division_counts = {}
        process_counts = {}
        for p in active_projects:
            s = _pf(p, 'status') or '미정'
            status_counts[s] = status_counts.get(s, 0) + 1
            d = _pf(p, 'division') or '미정'
            division_counts[d] = division_counts.get(d, 0) + 1
            proc = _pf(p, 'process') or '미정'
            process_counts[proc] = process_counts.get(proc, 0) + 1

        lines = [
            f"전체 과제: {len(active_projects)}건",
            f"\n상태별:",
        ]
        for k, v in sorted(status_counts.items(), key=lambda x: -x[1]):
            lines.append(f"  - {k}: {v}건")
        lines.append(f"\n사업부별:")
        for k, v in sorted(division_counts.items(), key=lambda x: -x[1]):
            lines.append(f"  - {k}: {v}건")
        lines.append(f"\n프로세스별:")
        for k, v in sorted(process_counts.items(), key=lambda x: -x[1]):
            lines.append(f"  - {k}: {v}건")
        return {'result': '\n'.join(lines)}

    elif intent == 'project_search':
        search_terms = re.sub(r'(찾아|줘|검색|해줘|알려줘|과제|관련|어떤|에 대해|보여줘)', '', query).strip()
        if not search_terms:
            return None
        matches = []
        for p in active_projects:
            name = _pf(p, 'name') or ''
            desc = _pf(p, 'description') or ''
            classification = _pf(p, 'classification') or ''
            if search_terms.lower() in name.lower() or search_terms.lower() in desc.lower() or search_terms.lower() in classification.lower():
                matches.append(
                    f"- {name}"
                    f" | 사업부: {_pf(p, 'division') or '-'}"
                    f" | 프로세스: {_pf(p, 'process') or '-'}"
                    f" | 상태: {_pf(p, 'status') or '-'}"
                    f" | 과제PL: {_pf(p, 'manager') or '-'}"
                )
        if matches:
            return {'result': f'"{search_terms}" 검색 결과: {len(matches)}건\n' + '\n'.join(matches)}
        return {'result': f'"{search_terms}"와 일치하는 과제를 찾지 못했습니다.'}

    elif intent == 'division_analysis':
        # Build division data
        divisions = {}
        for p in active_projects:
            div = _pf(p, 'division') or '미정'
            if div not in divisions:
                divisions[div] = {'total': 0, 'statuses': {}, 'projects': []}
            divisions[div]['total'] += 1
            s = _pf(p, 'status') or '미정'
            divisions[div]['statuses'][s] = divisions[div]['statuses'].get(s, 0) + 1
            divisions[div]['projects'].append(p)

        # Extract potential division name from query
        search_term = re.sub(
            r'(사업부|부문|부서|부서별|부문별|팀별|조직별|과제|는|은|의|에|몇개|몇 개|몇건|몇 건|개수|총|알려|줘|해줘|보여줘|있어|어때|현황|\?)',
            '', query
        ).strip().upper()

        # Try to match specific division
        if search_term:
            matched_div = None
            matched_info = None
            for div_name, info in divisions.items():
                if search_term in div_name.upper() or div_name.upper() in search_term:
                    matched_div = div_name
                    matched_info = info
                    break

            if matched_div and matched_info:
                status_str = ', '.join(f"{k}: {v}건" for k, v in matched_info['statuses'].items())
                lines = [
                    f"{matched_div} 과제 현황:",
                    f"- 총 과제: {matched_info['total']}건",
                    f"- 상태별: {status_str}",
                ]
                if matched_info['total'] <= 15:
                    lines.append(f"\n과제 목록:")
                    for p in matched_info['projects']:
                        lines.append(
                            f"  - {_pf(p, 'name') or '-'}"
                            f" | 상태: {_pf(p, 'status') or '-'}"
                            f" | 프로세스: {_pf(p, 'process') or '-'}"
                            f" | 과제PL: {_pf(p, 'manager') or '-'}"
                        )
                else:
                    lines.append(f"\n과제 목록 (상위 15건):")
                    for p in matched_info['projects'][:15]:
                        lines.append(
                            f"  - {_pf(p, 'name') or '-'}"
                            f" | 상태: {_pf(p, 'status') or '-'}"
                            f" | 프로세스: {_pf(p, 'process') or '-'}"
                        )
                    lines.append(f"  ... 외 {matched_info['total'] - 15}건")
                return {'result': '\n'.join(lines)}

        # No specific division found - show all divisions summary
        lines = ['사업부별 과제 현황:']
        for div, info in sorted(divisions.items(), key=lambda x: -x[1]['total']):
            status_str = ', '.join(f"{k}: {v}건" for k, v in info['statuses'].items())
            lines.append(f"- {div}: {info['total']}건 ({status_str})")

        if search_term:
            lines.append(f"\n\"{search_term}\"와 일치하는 사업부를 찾지 못했습니다.")
            lines.append(f"등록된 사업부: {', '.join(sorted(divisions.keys()))}")

        return {'result': '\n'.join(lines)}

    elif intent == 'manager_search':
        search = re.sub(r'(담당자|담당|누가|맡은|관리자|책임자|과제PL|PL|과제|의|은|는|이|가)', '', query).strip()
        managers = {}
        for p in active_projects:
            mgr = _pf(p, 'manager') or ''
            if mgr:
                if mgr not in managers:
                    managers[mgr] = []
                managers[mgr].append(p)

        if search:
            matched = {k: v for k, v in managers.items() if search in k}
            if matched:
                lines = []
                for mgr, projs in matched.items():
                    lines.append(f"{mgr} 담당 과제: {len(projs)}건")
                    for p in projs:
                        lines.append(f"  - {_pf(p, 'name') or '-'} | 상태: {_pf(p, 'status') or '-'} | 사업부: {_pf(p, 'division') or '-'}")
                return {'result': '\n'.join(lines)}
            return {'result': f'"{search}" 담당자를 찾지 못했습니다.\n\n등록된 과제PL: ' + ', '.join(sorted(managers.keys()))}
        else:
            lines = ['과제PL별 현황:']
            for mgr, projs in sorted(managers.items(), key=lambda x: -len(x[1])):
                lines.append(f"- {mgr}: {len(projs)}건")
            return {'result': '\n'.join(lines)}

    elif intent == 'kpi_analysis':
        try:
            categories = KPICategory.query.filter_by(is_active=True).order_by(KPICategory.order).all()
            if not categories:
                return {'result': '등록된 KPI가 없습니다.'}
            lines = ['KPI 현황:']
            low_achievement = []
            for cat in categories:
                kpis = KPI.query.filter_by(category_id=cat.id, is_active=True).order_by(KPI.order).all()
                for kpi in kpis:
                    target = kpi.target_value
                    actual = kpi.actual_value
                    unit = kpi.unit or ''
                    achievement = ''
                    if target and actual:
                        try:
                            t_val = float(target)
                            a_val = float(actual)
                            if t_val > 0:
                                pct = (a_val / t_val) * 100
                                achievement = f" (달성률: {pct:.1f}%)"
                                if pct < 80:
                                    low_achievement.append(f"  - [{cat.name}] {kpi.name}: {pct:.1f}%")
                        except (ValueError, TypeError):
                            pass
                    lines.append(f"- [{cat.name}] {kpi.name}: 목표 {target or '-'} / 실적 {actual or '-'} {unit}{achievement}")
            if low_achievement:
                lines.append("\n달성률 80% 미만 항목:")
                lines.extend(low_achievement)
            return {'result': '\n'.join(lines)}
        except Exception:
            return {'result': 'KPI 데이터를 조회하는 중 오류가 발생했습니다.'}

    elif intent == 'timeline_analysis':
        # Use 과제년도 (year) + 시작/종료 (month numbers)
        query_lower = query.lower()
        now = today
        current_month = now.month

        if '이번 달' in query_lower or '이번달' in query_lower:
            target_month = current_month
            range_label = f"{now.year}년 {current_month}월"
        else:
            target_month = current_month
            range_label = f"{now.year}년 {current_month}월"

        active_this_month = []
        starting_this_month = []
        ending_this_month = []

        for p in active_projects:
            name = _pf(p, 'name') or '(제목없음)'
            start_m = _pf(p, 'start')
            end_m = _pf(p, 'end')
            p_year = _pf(p, 'year')
            try:
                start_m = int(start_m) if start_m else None
                end_m = int(end_m) if end_m else None
            except (ValueError, TypeError):
                continue
            if start_m and end_m:
                if start_m <= target_month <= end_m:
                    active_this_month.append(f"  - {name} | 사업부: {_pf(p, 'division') or '-'} | 상태: {_pf(p, 'status') or '-'}")
                if start_m == target_month:
                    starting_this_month.append(f"  - {name}")
                if end_m == target_month:
                    ending_this_month.append(f"  - {name} | 상태: {_pf(p, 'status') or '-'}")

        lines = [f"{range_label} 일정 현황:"]
        lines.append(f"\n진행 중인 과제: {len(active_this_month)}건")
        lines.extend(active_this_month[:10] or ['  (없음)'])
        if len(active_this_month) > 10:
            lines.append(f"  ... 외 {len(active_this_month) - 10}건")
        lines.append(f"\n이번 달 시작: {len(starting_this_month)}건")
        lines.extend(starting_this_month or ['  (없음)'])
        lines.append(f"\n이번 달 종료: {len(ending_this_month)}건")
        lines.extend(ending_this_month or ['  (없음)'])
        return {'result': '\n'.join(lines)}

    elif intent == 'progress_analysis':
        # 성과목록 based analysis
        has_perf = []
        no_perf = []
        for p in active_projects:
            name = _pf(p, 'name') or '(제목없음)'
            perfs = _pf(p, 'performances') or []
            if perfs:
                has_perf.append((name, perfs, p))
            else:
                no_perf.append(name)

        lines = [f"과제 성과 현황 (전체 {len(active_projects)}건):"]
        lines.append(f"\n성과 등록 과제: {len(has_perf)}건")
        for name, perfs, p in has_perf[:10]:
            perf_summary = ', '.join(pf.get('성과항목', '') for pf in perfs[:3])
            lines.append(f"  - {name} | 성과 {len(perfs)}건 ({perf_summary})")
        if len(has_perf) > 10:
            lines.append(f"  ... 외 {len(has_perf) - 10}건")
        lines.append(f"\n성과 미등록 과제: {len(no_perf)}건")
        return {'result': '\n'.join(lines)}

    elif intent == 'year_search':
        year_match = re.search(r'(\d{4})', query)
        if not year_match:
            return None
        target_year = int(year_match.group(1))

        matched = []
        for p in active_projects:
            p_year = _pf(p, 'year')
            try:
                if int(p_year) == target_year:
                    matched.append(p)
            except (ValueError, TypeError):
                pass

        if matched:
            status_counts = {}
            division_counts = {}
            for p in matched:
                s = _pf(p, 'status') or '미정'
                status_counts[s] = status_counts.get(s, 0) + 1
                d = _pf(p, 'division') or '미정'
                division_counts[d] = division_counts.get(d, 0) + 1

            status_str = ', '.join(f"{k}: {v}건" for k, v in sorted(status_counts.items(), key=lambda x: -x[1]))
            div_str = ', '.join(f"{k}: {v}건" for k, v in sorted(division_counts.items(), key=lambda x: -x[1]))

            lines = [
                f"{target_year}년 과제: {len(matched)}건",
                f"- 상태별: {status_str}",
                f"- 사업부별: {div_str}",
                f"\n과제 목록:"
            ]
            for p in matched[:20]:
                lines.append(
                    f"  - {_pf(p, 'name') or '-'}"
                    f" | 사업부: {_pf(p, 'division') or '-'}"
                    f" | 상태: {_pf(p, 'status') or '-'}"
                    f" | 기간: {_pf(p, 'start') or '?'}월~{_pf(p, 'end') or '?'}월"
                    f" | 과제PL: {_pf(p, 'manager') or '-'}"
                )
            if len(matched) > 20:
                lines.append(f"  ... 외 {len(matched) - 20}건")
            return {'result': '\n'.join(lines)}
        else:
            # Show available years
            years = set()
            for p in active_projects:
                y = _pf(p, 'year')
                if y:
                    years.add(str(y))
            year_info = f"\n등록된 과제년도: {', '.join(sorted(years))}" if years else ""
            return {'result': f'{target_year}년에 해당하는 과제를 찾지 못했습니다.{year_info}'}

    elif intent == 'count_query':
        status_counts = {}
        for p in active_projects:
            s = _pf(p, 'status') or '미정'
            status_counts[s] = status_counts.get(s, 0) + 1
        status_str = ', '.join(f"{k}: {v}건" for k, v in sorted(status_counts.items(), key=lambda x: -x[1]))
        return {'result': f"전체 활성 과제: {len(active_projects)}건\n상태별: {status_str}"}

    elif intent == 'comparison':
        # Try to extract two project names
        return None  # Let LLM handle complex comparisons

    elif intent == 'recent_activity':
        try:
            recent_logs = DashboardActivityLog.query.order_by(
                DashboardActivityLog.created_at.desc()
            ).limit(15).all()
            if not recent_logs:
                return {'result': '최근 활동 기록이 없습니다.'}
            lines = ['최근 활동 로그:']
            for log in recent_logs:
                lines.append(
                    f"- [{log.created_at.strftime('%m/%d %H:%M')}] "
                    f"{log.user_name}: {log.summary or log.action}"
                )
            return {'result': '\n'.join(lines)}
        except Exception:
            return {'result': '활동 로그를 조회하는 중 오류가 발생했습니다.'}

    return None


def _build_light_context(page, query):
    """Build a lightweight context for LLM - only essential info, not full dump"""
    builders = {
        'main': _build_main_context,
        'dashboard': _build_light_dashboard_context,
        'auto-document': _build_auto_document_context,
        'dx-work-process': _build_dx_work_process_context,
        'meeting-management': _build_meeting_context,
        'collaboration-board': _build_collaboration_context,
        'office-management': _build_office_context,
        'spdm-status': _build_spdm_context,
        'digital-twin-tech-level': _build_tech_level_context,
        'digital-twin-reference': _build_reference_context,
        'dev-manufacturing-process': _build_dev_process_context,
        'company-material-council': _build_material_context,
    }
    builder = builders.get(page)
    if builder:
        try:
            return builder() if page != 'dashboard' else builder(query)
        except Exception:
            pass
    return f"{PLATFORM_INTRO}\n\n현재 페이지: {page}"


def _build_light_dashboard_context(query=''):
    """Lightweight dashboard context - summary only, no full project list"""
    from app.modules.digital_twin_dashboard.models import DashboardData

    dashboard = DashboardData.query.order_by(DashboardData.updated_at.desc()).first()
    if not dashboard:
        return f"{PLATFORM_INTRO}\n\n## 현재 페이지: 디지털 트윈 과제 대시보드\n(데이터 없음)"

    projects = dashboard.projects or []
    active_projects = [p for p in projects if not p.get('_deleted') and not p.get('_permanentlyDeleted')]

    status_counts = {}
    division_counts = {}
    for p in active_projects:
        s = _pf(p, 'status') or '미정'
        status_counts[s] = status_counts.get(s, 0) + 1
        d = _pf(p, 'division') or '미정'
        division_counts[d] = division_counts.get(d, 0) + 1
    status_text = ', '.join(f"{k}: {v}건" for k, v in status_counts.items()) or '없음'
    division_text = ', '.join(f"{k}: {v}건" for k, v in division_counts.items()) or '없음'

    return f"""{PLATFORM_INTRO}

## 현재 페이지: 디지털 트윈 과제 대시보드
- 활성 과제: {len(active_projects)}건
- 상태별: {status_text}
- 사업부별: {division_text}

## 주요 기능
과제 관리, 성과 관리, 간트 차트, 데이터 가져오기/내보내기, 서버 동기화, 스냅샷, 보고서 생성

사용자의 질문에 위 정보를 바탕으로 답변하세요."""


# ─── Original Context Builders (unchanged) ─────────────────────

def _build_main_context():
    """Main dashboard page context"""
    from app.modules.auth.models import Notice, User
    from app.modules.digital_twin_dashboard.models import DashboardData

    # Active notices
    notices = Notice.query.filter_by(is_active=True).order_by(
        Notice.priority.desc(), Notice.created_at.desc()
    ).limit(10).all()
    notice_text = '\n'.join(
        f"- [{n.priority}순위] {n.title}: {n.content[:100]}" for n in notices
    ) or '(등록된 공지사항 없음)'

    # User stats
    total_users = User.query.filter_by(is_active=True).count()

    # Project stats from dashboard
    project_summary = _get_project_summary()

    # Module list
    modules = """## 플랫폼 모듈 목록
- 지식 그래프 모듈: 데이터 계층화/시각화 (/dx-work-process)
- 디지털 트윈 과제 대시보드: 과제 정보 취합 (/digital-twin-dashboard)
- 사무국 운영: 디지털 트윈 사무국 주간 업무 (/office-management)
- 데이터/프로세스 가시화: 데이터/프로세스 관리 (/dev-manufacturing-process)
- 협의체/회의체/보고: 협의체, 회의체, 보고 관리 (/meeting-management)
- 협업 게시판: 팀 간 협업 및 소통 게시판 (/collaboration-board)
- 전사 물성 협의체: 전사 물성 협의체 관리 (/company-material-council)
- 디지털 트윈 메가 과제 기획: 메가 과제 기획 관리 (/digital-twin-tech-level)
- 플랫폼 현황: SPDM 현황 관리 (/spdm-status)
- 개발 디지털 트윈 로드맵 정보: 로드맵 정보 관리 (/digital-twin-reference)
- 제조 디지털 트윈 과제 관리: 과제 관리 (/digital-twin-task-management)
- 문서 자동 작성: 문서 자동 작성 및 관리 (/auto-document)"""

    return f"""{PLATFORM_INTRO}

## 현재 페이지: 메인 대시보드

## 공지사항
{notice_text}

## 플랫폼 통계
- 활성 사용자 수: {total_users}명
{project_summary}

{modules}

## 안내 지침
- 사용자가 특정 모듈에 대해 물으면, 해당 모듈의 이름, 설명, 접근 경로를 알려주세요.
- 플랫폼 사용법이나 기능에 대한 질문에 친절하게 답변하세요."""


def _build_dashboard_context():
    """Digital Twin Dashboard page context - uses Korean field names from actual data"""
    from app.modules.digital_twin_dashboard.models import (
        DashboardData, Division, Department, ProcessCategory,
        PerformanceCategory, PerformanceSubcategory, DashboardActivityLog,
        KPICategory, KPI
    )

    # Get project/performance data
    dashboard = DashboardData.query.order_by(DashboardData.updated_at.desc()).first()
    projects = []
    performances = []
    if dashboard:
        projects = dashboard.projects or []
        performances = dashboard.performances or []

    active_projects = [p for p in projects if not p.get('_deleted') and not p.get('_permanentlyDeleted')]

    # Detailed project info using Korean field names
    project_details = []
    for p in active_projects[:30]:
        name = _pf(p, 'name') or '(제목없음)'
        detail = f"- **{name}**"
        div = _pf(p, 'division')
        if div: detail += f" | 사업부: {div}"
        status = _pf(p, 'status')
        if status: detail += f" | 상태: {status}"
        proc = _pf(p, 'process')
        if proc: detail += f" | 프로세스: {proc}"
        year = _pf(p, 'year')
        start_m = _pf(p, 'start')
        end_m = _pf(p, 'end')
        if year: detail += f" | 년도: {year}"
        if start_m and end_m: detail += f" | 기간: {start_m}월~{end_m}월"
        classification = _pf(p, 'classification')
        if classification: detail += f" | 구분: {classification}"
        desc = _pf(p, 'description')
        if desc: detail += f"\n  설명: {str(desc)[:150]}"
        manager = _pf(p, 'manager')
        if manager: detail += f"\n  과제PL: {manager}"
        project_details.append(detail)

    project_text = '\n'.join(project_details) or '(등록된 과제 없음)'

    # Status summary
    status_counts = {}
    division_counts = {}
    for p in active_projects:
        s = _pf(p, 'status') or '미정'
        status_counts[s] = status_counts.get(s, 0) + 1
        d = _pf(p, 'division') or '미정'
        division_counts[d] = division_counts.get(d, 0) + 1

    status_text = ', '.join(f"{k}: {v}건" for k, v in status_counts.items()) or '없음'
    division_text = ', '.join(f"{k}: {v}건" for k, v in division_counts.items()) or '없음'

    # Divisions & departments (from settings DB)
    divisions = Division.query.filter_by(is_active=True).order_by(Division.order).all()
    div_dept_text = ''
    for div in divisions:
        depts = Department.query.filter_by(division_id=div.id, is_active=True).order_by(Department.order).all()
        dept_names = ', '.join(d.name for d in depts)
        div_dept_text += f"- {div.name}: {dept_names or '(부서 없음)'}\n"

    # Process categories
    processes = ProcessCategory.query.filter_by(is_active=True).order_by(ProcessCategory.order).all()
    process_text = ', '.join(p.name for p in processes) or '없음'

    # KPI data
    kpi_text = _get_kpi_summary()

    # Recent activity
    recent_logs = DashboardActivityLog.query.order_by(
        DashboardActivityLog.created_at.desc()
    ).limit(10).all()
    activity_text = '\n'.join(
        f"- [{l.created_at.strftime('%m/%d %H:%M')}] {l.user_name}: {l.summary or l.action}"
        for l in recent_logs
    ) or '(최근 활동 없음)'

    return f"""{PLATFORM_INTRO}

## 현재 페이지: 디지털 트윈 과제 대시보드

## 과제 현황 요약
- 전체 과제: {len(projects)}건 (활성: {len(active_projects)}건)
- 상태별: {status_text}
- 사업부별: {division_text}

## 조직 구조 (부문/부서)
{div_dept_text}
## 프로세스 분류
{process_text}

{kpi_text}

## 과제 상세 목록
{project_text}

## 최근 활동 로그
{activity_text}

## 주요 기능
- 과제 추가/수정/삭제 및 일괄 추가
- 성과 항목 관리 (과제별 연계)
- 간트 차트로 일정 시각화
- 대시보드에서 현황/통계/분석 확인
- 데이터 가져오기/내보내기 (JSON, 엑셀)
- 서버 동기화 및 지식 그래프 연동
- 스냅샷 저장/복원, 보고서 자동 생성

## 안내 지침
- 과제 관리 방법이나 기능 사용법을 물으면 친절하게 안내하세요.
- 현재 과제 현황에 대한 질문에 위 데이터를 기반으로 답변하세요.
- 특정 과제에 대해 물으면 상세 정보를 찾아 답변하세요."""


def _build_auto_document_context():
    """Auto Document page context"""
    import os
    import glob

    template_dir_ppt = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
                                     'templates', 'document_type_ppt')
    template_dir_word = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
                                      'templates', 'document_type_word')

    templates = []
    for d, ext, doc_type in [(template_dir_ppt, '*.pptx', 'PPT'), (template_dir_word, '*.docx', 'Word')]:
        if os.path.exists(d):
            for f in glob.glob(os.path.join(d, ext)):
                templates.append(f"- {os.path.basename(f)} ({doc_type})")

    template_text = '\n'.join(templates) or '(등록된 템플릿 없음)'

    # Load presets
    preset_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
                                'data', 'auto_document_presets.json')
    preset_text = '(프리셋 없음)'
    if os.path.exists(preset_file):
        try:
            with open(preset_file, 'r', encoding='utf-8') as f:
                presets = json.load(f)
            if presets:
                preset_text = '\n'.join(f"- {p.get('name', '이름없음')} (모드: {p.get('mode', '?')})" for p in presets[:10])
        except Exception:
            pass

    return f"""{PLATFORM_INTRO}

## 현재 페이지: 문서 자동 작성 (Auto Document)
이 페이지는 템플릿 기반으로 문서(PPT, Word)를 자동 생성하는 도구입니다.

## 작동 방식
3단계 워크플로로 진행됩니다:
1. **템플릿 선택** - 사전 등록된 PPT/Word 템플릿 중 하나를 선택
2. **데이터 매핑** - 템플릿의 플레이스홀더({{{{필드명}}}})에 실제 데이터를 연결
3. **문서 생성** - 매핑된 데이터를 바탕으로 문서를 자동 생성 및 다운로드

## 두 가지 모드
- **단일 문서 생성**: 데이터 소스에서 항목을 선택해 개별 문서 생성 (일괄 생성 가능)
- **통계 보고서 생성**: 연도별 통계 데이터를 기반으로 보고서 생성

## 등록된 템플릿
{template_text}

## 저장된 프리셋
{preset_text}

## 주요 기능
- 프리셋 저장/불러오기: 매핑 설정을 저장해 재사용 가능
- 자동 매핑: 플레이스홀더와 데이터 필드를 자동으로 연결
- AI 매핑: LLM을 활용한 의미 기반 자동 매핑
- 일괄 생성: 여러 항목을 선택해 한 번에 문서 생성

## 안내 지침
- 사용자가 문서 생성 방법을 물으면 3단계 워크플로를 안내하세요.
- 템플릿이나 매핑 관련 질문에 친절하게 답변하세요."""


def _build_dx_work_process_context():
    """DX Work Process (Knowledge Graph) page context"""
    from app.modules.dx_work_process.models import Graph, Node, Edge

    graphs = Graph.query.order_by(Graph.updated_at.desc()).all()
    graph_details = []
    for g in graphs[:15]:
        node_count = Node.query.filter_by(graph_id=g.id).count()
        edge_count = Edge.query.filter_by(graph_id=g.id).count()
        detail = f"- **{g.name}** (노드: {node_count}, 엣지: {edge_count}, 공개: {'예' if g.is_public else '아니오'})"
        if g.description:
            detail += f"\n  설명: {g.description[:100]}"
        graph_details.append(detail)

    graph_text = '\n'.join(graph_details) or '(등록된 그래프 없음)'
    total_nodes = Node.query.count()
    total_edges = Edge.query.count()

    return f"""{PLATFORM_INTRO}

## 현재 페이지: 지식 그래프 모듈 (DX Work Process)
데이터를 노드와 엣지로 시각화하여 계층 구조와 관계를 표현하는 모듈입니다.

## 통계
- 전체 그래프: {len(graphs)}개
- 전체 노드: {total_nodes}개
- 전체 엣지: {total_edges}개

## 등록된 그래프 목록
{graph_text}

## 주요 기능
- 노드 추가/수정/삭제: 다양한 유형의 노드를 추가하고 속성을 관리
- 엣지(관계) 관리: 노드 간 관계를 정의하고 시각화
- 노드/엣지 유형 커스터마이징: 색상, 아이콘, 라벨 등을 설정
- 그래프 공유: 공개/비공개 설정으로 팀원과 공유
- 가져오기/내보내기: JSON 형식으로 그래프 데이터를 교환

## 안내 지침
- 그래프 생성 방법, 노드/엣지 관리 방법을 안내하세요.
- 특정 그래프에 대해 물으면 목록에서 찾아 답변하세요."""


def _build_meeting_context():
    """Meeting Management page context"""
    from app.modules.meeting_management.models import MeetingGroup, MeetingSession

    groups = MeetingGroup.query.filter_by(is_active=True).order_by(MeetingGroup.order).all()
    group_details = []
    for g in groups:
        session_count = MeetingSession.query.filter_by(group_id=g.id).count()
        latest = MeetingSession.query.filter_by(group_id=g.id).order_by(
            MeetingSession.session_date.desc()
        ).first()
        latest_date = latest.session_date.strftime('%Y-%m-%d') if latest and latest.session_date else '없음'
        detail = f"- **{g.name}** (유형: {g.meeting_type}, 주기: {g.cycle}, 회차: {session_count}회, 최근: {latest_date})"
        if g.description:
            detail += f"\n  설명: {g.description[:100]}"
        group_details.append(detail)

    group_text = '\n'.join(group_details) or '(등록된 회의체 없음)'

    return f"""{PLATFORM_INTRO}

## 현재 페이지: 협의체/회의체/보고 관리
협의체, 회의체, 보고 등 다양한 회의를 관리하는 모듈입니다.

## 등록된 회의체/협의체
{group_text}

## 주요 기능
- 회의체 생성 및 관리 (협의체/회의체/보고 유형)
- 회차별 회의 기록 관리 (일시, 장소, 요약)
- 안건 등록 및 관리
- 첨부 파일 관리 (회의록, 발표자료 등)

## 안내 지침
- 회의체 생성, 회차 추가, 안건 관리 방법을 안내하세요.
- 특정 회의체에 대해 물으면 상세 정보를 답변하세요."""


def _build_collaboration_context():
    """Collaboration Board page context"""
    from app.modules.collaboration_board.models import BoardCategory, BoardPost, Survey

    categories = BoardCategory.query.filter_by(is_active=True).order_by(BoardCategory.order).all()
    cat_details = []
    for c in categories:
        post_count = BoardPost.query.filter_by(category_id=c.id, is_active=True).count()
        cat_details.append(f"- **{c.name}**: {c.description or ''} (게시글 {post_count}건)")

    cat_text = '\n'.join(cat_details) or '(카테고리 없음)'

    # Recent posts
    recent_posts = BoardPost.query.filter_by(is_active=True).order_by(
        BoardPost.is_pinned.desc(), BoardPost.created_at.desc()
    ).limit(10).all()
    post_details = []
    for p in recent_posts:
        pin = '[고정] ' if p.is_pinned else ''
        post_details.append(f"- {pin}{p.title} (조회 {p.view_count}회, {p.created_at.strftime('%m/%d')})")
    post_text = '\n'.join(post_details) or '(게시글 없음)'

    # Surveys
    surveys = Survey.query.filter_by(is_active=True).order_by(Survey.created_at.desc()).limit(5).all()
    survey_text = '\n'.join(
        f"- {s.title} ({s.start_date} ~ {s.end_date})" for s in surveys
    ) or '(설문 없음)'

    return f"""{PLATFORM_INTRO}

## 현재 페이지: 협업 게시판
팀 간 협업 및 소통을 위한 게시판입니다.

## 카테고리
{cat_text}

## 최근 게시글
{post_text}

## 진행 중인 설문
{survey_text}

## 주요 기능
- 카테고리별 게시판 운영
- 게시글 작성/수정/삭제, 댓글 및 대댓글
- 파일 첨부, 공지 고정
- 설문조사 생성 및 참여

## 안내 지침
- 게시판 사용법, 게시글 작성, 설문 참여 방법을 안내하세요."""


def _build_office_context():
    """Office Management page context"""
    from app.modules.office_management.models import Week, Agenda

    weeks = Week.query.order_by(Week.year.desc(), Week.week.desc()).limit(10).all()
    week_details = []
    for w in weeks:
        agenda_count = Agenda.query.filter_by(week_id=w.id).count()
        agendas = Agenda.query.filter_by(week_id=w.id).all()
        titles = ', '.join(a.title for a in agendas[:5])
        week_details.append(f"- {w.year}년 {w.week}주차 (안건 {agenda_count}건): {titles}")

    week_text = '\n'.join(week_details) or '(주간 업무 없음)'

    return f"""{PLATFORM_INTRO}

## 현재 페이지: 사무국 운영
디지털 트윈 사무국의 주간 업무를 관리하는 모듈입니다.

## 최근 주간 업무
{week_text}

## 주요 기능
- 주차별 업무 관리 (연도/주차)
- 안건 등록 및 관리
- 연관 안건 연결
- 첨부 파일 관리
- 업무 연락처 관리

## 안내 지침
- 주간 업무 등록, 안건 관리 방법을 안내하세요."""


def _build_spdm_context():
    """SPDM Status page context"""
    from app.modules.spdm_status.models import SpdmGroup, SpdmIssue, SpdmModule, SpdmScheduleDepartment, SpdmScheduleItem

    # Issues
    groups = SpdmGroup.query.order_by(SpdmGroup.order).all()
    issue_details = []
    for g in groups:
        issues = SpdmIssue.query.filter_by(group_id=g.id).all()
        status_counts = {}
        for i in issues:
            status_counts[i.status] = status_counts.get(i.status, 0) + 1
        status_str = ', '.join(f"{k}: {v}" for k, v in status_counts.items())
        issue_details.append(f"- **{g.name}**: 이슈 {len(issues)}건 ({status_str})")

    issue_text = '\n'.join(issue_details) or '(이슈 그룹 없음)'

    # Modules
    modules = SpdmModule.query.order_by(SpdmModule.order).all()
    module_text = '\n'.join(
        f"- {m.name} (시스템: {m.system_type or '-'}, 연동: {'예' if m.is_linked else '아니오'})"
        for m in modules[:15]
    ) or '(모듈 없음)'

    # Schedule
    depts = SpdmScheduleDepartment.query.order_by(SpdmScheduleDepartment.order).all()
    schedule_text = ''
    for d in depts:
        items = SpdmScheduleItem.query.filter_by(department_id=d.id).order_by(SpdmScheduleItem.order).all()
        item_str = ', '.join(f"{i.title}({i.status})" for i in items[:5])
        schedule_text += f"- {d.name}: {item_str or '(항목없음)'}\n"

    return f"""{PLATFORM_INTRO}

## 현재 페이지: 플랫폼 현황 (SPDM Status)
SPDM(Simulation & Product Data Management) 플랫폼의 현황을 관리하는 모듈입니다.

## 이슈 현황
{issue_text}

## SPDM 모듈 목록
{module_text}

## 일정 현황
{schedule_text}
## 주요 기능
- 이슈 그룹 및 이슈 관리 (등록/진행중/완료/보류)
- 이슈 이력 및 코멘트 관리
- SPDM 모듈 정의 및 연동 관리
- 부서별 일정 관리

## 안내 지침
- 이슈 관리, 모듈 현황, 일정 확인 방법을 안내하세요."""


def _build_tech_level_context():
    """Digital Twin Tech Level page context"""
    from app.modules.digital_twin_tech_level.models import TechLevelData

    records = TechLevelData.query.order_by(TechLevelData.updated_at.desc()).all()
    record_details = []
    for r in records[:10]:
        goals = r.goals if isinstance(r.goals, list) else []
        components = r.components if isinstance(r.components, list) else []
        record_details.append(
            f"- **{r.name}** (목표: {len(goals)}개, 구성요소: {len(components)}개, "
            f"공개: {'예' if r.is_public else '아니오'}, 작성자: {r.created_by_name or '-'})"
        )
        if r.description:
            record_details.append(f"  설명: {r.description[:150]}")

    record_text = '\n'.join(record_details) or '(데이터 없음)'

    return f"""{PLATFORM_INTRO}

## 현재 페이지: 디지털 트윈 메가 과제 기획
디지털 트윈 메가 과제의 기획 및 기술 수준을 관리하는 모듈입니다.

## 등록된 데이터
{record_text}

## 주요 기능
- 메가 과제 기획서 작성
- 목표 및 구성요소 정의
- 기술 수준 평가 및 카테고리 분류
- 사업부별 분류 및 시각화

## 안내 지침
- 과제 기획 방법, 데이터 입력 방법을 안내하세요."""


def _build_reference_context():
    """Digital Twin Reference page context"""
    from app.modules.digital_twin_reference.models import DtReferenceTask

    tasks = DtReferenceTask.query.order_by(DtReferenceTask.order).all()
    task_details = []
    for t in tasks[:20]:
        detail = f"- **{t.name}** (분류: {t.category or '-'}, 상태: {t.status or '-'}, 연도: {t.year or '-'})"
        if t.test_item:
            detail += f"\n  시험항목: {t.test_item}"
        if t.description:
            detail += f"\n  설명: {t.description[:100]}"
        task_details.append(detail)

    task_text = '\n'.join(task_details) or '(등록된 로드맵 없음)'

    return f"""{PLATFORM_INTRO}

## 현재 페이지: 개발 디지털 트윈 로드맵 정보
개발 디지털 트윈 관련 로드맵 및 참조 과제를 관리하는 모듈입니다.

## 등록된 로드맵/과제
{task_text}

## 주요 기능
- 로드맵 과제 등록 및 관리
- 시험항목, 분류, 상태 관리
- 연계 과제 연결
- 제품군별 분류

## 안내 지침
- 로드맵 관리 방법, 과제 검색 방법을 안내하세요."""


def _build_dev_process_context():
    """Dev Manufacturing Process page context"""
    from app.modules.dev_manufacturing_process.models import ProcessDiagramData

    diagrams = ProcessDiagramData.query.order_by(ProcessDiagramData.updated_at.desc()).all()
    diagram_details = []
    for d in diagrams[:15]:
        nodes = d.nodes if isinstance(d.nodes, list) else []
        edges = d.edges if isinstance(d.edges, list) else []
        diagram_details.append(
            f"- **{d.name}** (노드: {len(nodes)}, 엣지: {len(edges)}, "
            f"공개: {'예' if d.is_public else '아니오'}, 작성자: {d.created_by_name or '-'})"
        )
        if d.description:
            diagram_details.append(f"  설명: {d.description[:100]}")

    diagram_text = '\n'.join(diagram_details) or '(등록된 다이어그램 없음)'

    return f"""{PLATFORM_INTRO}

## 현재 페이지: 데이터/프로세스 가시화
제조 공정의 데이터와 프로세스를 플로우 다이어그램으로 시각화하는 모듈입니다.

## 등록된 다이어그램
{diagram_text}

## 주요 기능
- 프로세스 다이어그램 작성 (노드/엣지 편집)
- 노드 유형별 시각화 (시작, 종료, 작업, 분기 등)
- 다이어그램 공유 (공개/비공개)
- JSON 가져오기/내보내기

## 안내 지침
- 다이어그램 생성, 노드 편집, 공유 방법을 안내하세요."""


def _build_material_context():
    """Company Material Council page context"""
    from app.modules.company_material_council.models import Material, TestMethod

    materials = Material.query.order_by(Material.updated_at.desc()).all()
    material_count = len(materials)

    # Parse material details
    material_details = []
    for m in materials[:15]:
        try:
            data = json.loads(m.data) if isinstance(m.data, str) else (m.data or {})
            name = data.get('name', data.get('material_name', f'ID:{m.id}'))
            material_details.append(f"- {name}")
        except Exception:
            material_details.append(f"- (ID:{m.id})")

    material_text = '\n'.join(material_details) or '(등록된 물성 없음)'

    test_methods = TestMethod.query.all()
    method_text = '\n'.join(
        f"- {t.test_name} (장비: {t.equipment or '-'}, 위치: {t.equipment_location or '-'})"
        for t in test_methods[:10]
    ) or '(등록된 시험법 없음)'

    return f"""{PLATFORM_INTRO}

## 현재 페이지: 전사 물성 협의체
전사 물성 관련 데이터와 시험법을 관리하는 모듈입니다.

## 등록된 물성 데이터 ({material_count}건)
{material_text}

## 등록된 시험법
{method_text}

## 주요 기능
- 물성 데이터 등록 및 관리
- 시험 결과 기록 (인장시험, DMA 등)
- 시험법 문서화 (장비, 위치, 절차)
- 탭 기반 커스텀 데이터 관리

## 안내 지침
- 물성 데이터 입력, 시험법 확인 방법을 안내하세요."""


def _build_generic_context():
    """Generic fallback context"""
    return f"""{PLATFORM_INTRO}

## 현재 페이지 정보를 특정할 수 없습니다.
플랫폼의 일반적인 질문에 답변하세요."""


# ─── Helper Functions ───────────────────────────────────────────

def _get_project_summary():
    """Get project summary from dashboard data"""
    try:
        from app.modules.digital_twin_dashboard.models import DashboardData
        dashboard = DashboardData.query.order_by(DashboardData.updated_at.desc()).first()
        if not dashboard:
            return "- 과제 데이터 없음"

        projects = dashboard.projects or []
        performances = dashboard.performances or []
        active = [p for p in projects if not p.get('_deleted')]

        return f"""- 디지털 트윈 과제 수: {len(active)}건
- 성과 항목 수: {len(performances)}건"""
    except Exception:
        return "- 과제 데이터 조회 실패"


def _get_kpi_summary():
    """Get KPI summary"""
    try:
        from app.modules.digital_twin_dashboard.models import KPICategory, KPI
        categories = KPICategory.query.filter_by(is_active=True).order_by(KPICategory.order).all()
        if not categories:
            return ""

        lines = ["## KPI 현황"]
        for cat in categories:
            kpis = KPI.query.filter_by(category_id=cat.id, is_active=True).order_by(KPI.order).all()
            for kpi in kpis:
                target = kpi.target_value or '-'
                actual = kpi.actual_value or '-'
                lines.append(f"- [{cat.name}] {kpi.name}: 목표 {target} / 실적 {actual} {kpi.unit or ''}")

        return '\n'.join(lines) if len(lines) > 1 else ""
    except Exception:
        return ""
