"""
Modules Registration
"""


def register_all_blueprints(app):
    """Register all module blueprints with the Flask app."""

    # Authentication (must be first)
    from app.modules.auth import bp as auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')

    # Digital Twin Dashboard
    from app.modules.digital_twin_dashboard import bp as digital_twin_dashboard_bp
    app.register_blueprint(digital_twin_dashboard_bp, url_prefix='/api/digital-twin-dashboard')

    # Digital Twin Dashboard V2 (Phase 3 — 과제별 쓰기 API)
    # 기존 화면은 이 URL 을 부르지 않는다. 컷오버 전까지 아무 영향이 없다.
    from app.modules.digital_twin_dashboard import bp_v2 as dt_v2_bp
    app.register_blueprint(dt_v2_bp, url_prefix='/api/dt-v2')

    # Digital Twin Strategy (연도별 전략 기획 — 사무국/관리자 전용)
    from app.modules.digital_twin_strategy import bp as digital_twin_strategy_bp
    app.register_blueprint(digital_twin_strategy_bp)
    # 설문은 블루프린트가 둘이다. 응답용은 **역할을 안 보고 로그인만** 요구하므로
    # 위 블루프린트에 섞지 않는다 (survey_routes.py 머리말 참고).
    from app.modules.digital_twin_strategy import (
        survey_admin_bp, survey_respond_bp,
    )
    app.register_blueprint(survey_admin_bp)
    app.register_blueprint(survey_respond_bp)

    # Digital Twin Solution
    from app.modules.digital_twin_solution import bp as digital_twin_solution_bp
    app.register_blueprint(digital_twin_solution_bp, url_prefix='/api/digital-twin-solution')

    # DX Work Process (Knowledge Graph)
    from app.modules.dx_work_process import bp as dx_work_process_bp
    app.register_blueprint(dx_work_process_bp, url_prefix='/api/dx-work-process')

    # Gantt Chart
    from app.modules.gantt_chart import bp as gantt_chart_bp
    app.register_blueprint(gantt_chart_bp, url_prefix='/api/gantt-chart')

    # Knowledge Graph (Original)
    from app.modules.knowledge_graph import bp as knowledge_graph_bp
    app.register_blueprint(knowledge_graph_bp, url_prefix='/api/knowledge-graph')

    # Swimlane Chart
    from app.modules.swimlane_chart import bp as swimlane_chart_bp
    app.register_blueprint(swimlane_chart_bp, url_prefix='/api/swimlane-chart')

    # Tech Archive
    from app.modules.tech_archive import bp as tech_archive_bp
    app.register_blueprint(tech_archive_bp, url_prefix='/api/tech-archive')

    # Tech Radar
    from app.modules.tech_radar import bp as tech_radar_bp
    app.register_blueprint(tech_radar_bp, url_prefix='/api/tech-radar')

    # Dev Manufacturing Process
    from app.modules.dev_manufacturing_process.routes import bp as dev_manufacturing_process_bp
    app.register_blueprint(dev_manufacturing_process_bp)

    # Digital Twin Tech Level
    from app.modules.digital_twin_tech_level.routes import bp as digital_twin_tech_level_bp
    app.register_blueprint(digital_twin_tech_level_bp)

    # Portal (메인 화면 설정) — 모듈 상태를 코드가 아니라 DB 에서 읽는다
    from app.modules.portal import bp as portal_bp
    app.register_blueprint(portal_bp, url_prefix='/api/portal')

    # Office Management
    from app.modules.office_management import bp as office_management_bp
    app.register_blueprint(office_management_bp, url_prefix='/api/office-management')

    # Meeting Management
    from app.modules.meeting_management import bp as meeting_management_bp
    app.register_blueprint(meeting_management_bp, url_prefix='/api/meeting-management')

    # Collaboration Board
    from app.modules.collaboration_board import bp as collaboration_board_bp
    app.register_blueprint(collaboration_board_bp, url_prefix='/api/collaboration-board')

    # Company Material Council
    from app.modules.company_material_council import bp as company_material_council_bp
    app.register_blueprint(company_material_council_bp, url_prefix='/api/company-material-council')

    # Digital Twin Reference
    from app.modules.digital_twin_reference import bp as digital_twin_reference_bp
    app.register_blueprint(digital_twin_reference_bp, url_prefix='/api/digital-twin-reference')

    # SPDM Status
    from app.modules.spdm_status import bp as spdm_status_bp
    app.register_blueprint(spdm_status_bp, url_prefix='/api/spdm-status')

    # Auto Document
    from app.modules.auto_document import bp as auto_document_bp
    app.register_blueprint(auto_document_bp, url_prefix='/api/auto-document')

    # Auto Document Verify
    from app.modules.auto_document_verify import bp as auto_document_verify_bp
    app.register_blueprint(auto_document_verify_bp, url_prefix='/api/auto-document-verify')

    # Digital Twin SW Resource
    from app.modules.digital_twin_sw_resource import bp as digital_twin_sw_resource_bp
    app.register_blueprint(digital_twin_sw_resource_bp, url_prefix='/api/digital-twin-sw-resource')

    # AI Context
    from app.modules.ai_context import bp as ai_context_bp
    app.register_blueprint(ai_context_bp, url_prefix='/api/ai')

    # DX KPI Management
    from app.modules.dx_kpi_management import bp as dx_kpi_management_bp
    app.register_blueprint(dx_kpi_management_bp, url_prefix='/api/dx-kpi-management')

    # Digital Twin Task Management
    from app.modules.digital_twin_task_management import bp as digital_twin_task_management_bp
    app.register_blueprint(digital_twin_task_management_bp, url_prefix='/api/digital-twin-task-management')
