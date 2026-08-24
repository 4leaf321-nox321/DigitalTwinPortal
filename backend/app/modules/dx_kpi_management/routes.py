"""
DX 부문 KPI 관리 - API Routes
"""
import os
import io
import zipfile
from flask import request, send_file
from app.modules.dx_kpi_management import bp
from app.modules.dx_kpi_management.models import KpiRecord, KpiTarget, KpiCriteria, KpiAttachment, KpiDefinition, WeeklyTrend, KpiImportAlias, UPLOAD_FOLDER
from app.extensions import db
from app.shared.responses import success_response, error_response, created_response, not_found_response
from app.modules.dx_kpi_management import importer
from app.modules.dx_kpi_management import name_ai

# 사업부 정본 — 화면(`DxKpiManagementApp.DIVISIONS`)과 **같은 목록**이어야 한다.
# 여기가 어긋나면 붙여넣기가 사업부를 못 알아본다.
DX_DIVISIONS = [
    {'id': 'mx', 'name': 'MX'},
    {'id': 'vd', 'name': 'VD'},
    {'id': 'da', 'name': 'DA'},
    {'id': 'nw', 'name': 'NW'},
    {'id': 'medical', 'name': '의료기기'},
]


# ============== KPI Definitions ==============

# 초기 시드 데이터 (DB가 비어있을 때만 한 번 적재)
SEED_KPI_DEFINITIONS = [
    {'label': '가상 검증률', 'category': '개발', 'unit': '%', 'valueType': 'single', 'divisions': []},
    {'label': 'One Time Pass율', 'category': '개발', 'unit': '%', 'valueType': 'single', 'divisions': []},
    {'label': '시험 완료 Lead Time', 'category': '개발', 'unit': '일', 'valueType': 'single', 'divisions': []},
    {'label': 'Action Item 진척률', 'category': '개발', 'unit': '%', 'valueType': 'single', 'divisions': []},
    {'label': 'SPDM 연계율', 'category': '개발', 'unit': '%', 'valueType': 'single', 'divisions': ['mx']},
    {'label': '가상검증 평균 소요시간', 'category': '개발', 'unit': 'Hr', 'valueType': 'single', 'divisions': ['mx']},
    {'label': '물성 DB 확보 진척률', 'category': '개발', 'unit': '%', 'valueType': 'single', 'divisions': ['vd']},
    {'label': '장기수명 가상검증과제 진척률', 'category': '개발', 'unit': '%', 'valueType': 'single', 'divisions': ['da']},
    {'label': 'SPDM 구축률', 'category': '개발', 'unit': '%', 'valueType': 'single', 'divisions': ['nw', 'medical']},
    {'label': '디지털 인체 팬텀 개발률', 'category': '개발', 'unit': '%', 'valueType': 'single', 'divisions': ['medical']},
    {'label': '데이터 연결률', 'category': '제조', 'unit': '%', 'valueType': 'single', 'divisions': []},
    {'label': '라인 유실률 (대표 법인)', 'category': '제조', 'unit': '%', 'valueType': 'single', 'divisions': []},
    {'label': '라인 유실율 (전법인)', 'category': '제조', 'unit': '%', 'valueType': 'single', 'divisions': []},
    {'label': '인당생산대수', 'category': '제조', 'unit': '대', 'valueType': 'single', 'divisions': []},
    {'label': 'ASR (Annual Service Ratio)', 'category': '품질', 'unit': '', 'valueType': 'single', 'divisions': []},
]


def seed_definitions_if_empty():
    if KpiDefinition.query.count() > 0:
        return
    for idx, item in enumerate(SEED_KPI_DEFINITIONS):
        db.session.add(KpiDefinition(
            label=item['label'],
            category=item['category'],
            unit=item.get('unit', ''),
            value_type=item.get('valueType', 'single'),
            divisions=item.get('divisions', []),
            sort_order=idx,
        ))
    db.session.commit()


@bp.route('/kpi-definitions', methods=['GET'])
def get_kpi_definitions():
    """
    KPI 항목 목록. **기본으로 `kind='metric'` 만** 준다.

    왜 거르나
        'plaform' 종류(플랫폼 구축)는 측정값이 없다 — 목표도 실적도 세울 수 없다.
        이 API 를 쓰는 화면들(DX KPI 관리 종합표·목표 설정·전체 요약)은 전부
        **목표 대비 실적**을 다루는 곳이라, 거기 끼면 영원히 빈 행이 하나 생기고
        "목표를 세우라" 고 잘못 안내한다.

        디지털 트윈 대시보드의 KPI 연결·매트릭스는 이 API 를 쓰지 않고 모델을
        직접 읽으므로(routes_v2) 영향이 없다. 필요하면 ?kind=all 로 전부 받는다.
    """
    seed_definitions_if_empty()
    q = KpiDefinition.query
    if (request.args.get('kind') or 'metric') != 'all':
        q = q.filter(KpiDefinition.kind == request.args.get('kind', 'metric'))
    items = q.order_by(KpiDefinition.sort_order.asc(), KpiDefinition.id.asc()).all()
    return success_response([d.to_dict() for d in items])


@bp.route('/kpi-definitions', methods=['POST'])
def create_kpi_definition():
    data = request.get_json() or {}
    label = (data.get('label') or '').strip()
    if not label:
        return error_response('label is required.')
    if KpiDefinition.query.filter_by(label=label).first():
        return error_response('이미 존재하는 KPI 항목입니다.')

    max_order = db.session.query(db.func.max(KpiDefinition.sort_order)).scalar() or 0
    direction = data.get('direction', 'higher')
    if direction not in ('higher', 'lower'):
        direction = 'higher'
    item = KpiDefinition(
        label=label,
        category=data.get('category', ''),
        unit=data.get('unit', ''),
        value_type=data.get('valueType', 'single'),
        divisions=data.get('divisions', []) or [],
        sort_order=data.get('order', max_order + 1),
        show_raw_data=bool(data.get('showRawData', True)),
        direction=direction,
    )
    db.session.add(item)
    db.session.commit()
    return created_response(item.to_dict())


@bp.route('/kpi-definitions/<int:definition_id>', methods=['PUT'])
def update_kpi_definition(definition_id):
    item = KpiDefinition.query.get(definition_id)
    if not item:
        return not_found_response('KPI 항목을 찾을 수 없습니다.')
    data = request.get_json() or {}

    new_label = data.get('label')
    if new_label is not None and new_label != item.label:
        new_label = new_label.strip()
        if not new_label:
            return error_response('label은 비워둘 수 없습니다.')
        if KpiDefinition.query.filter(KpiDefinition.label == new_label, KpiDefinition.id != definition_id).first():
            return error_response('이미 존재하는 KPI 항목입니다.')
        old_label = item.label
        item.label = new_label
        # 기존 레코드/목표/산출기준/첨부파일의 KPI 라벨도 동기화
        KpiRecord.query.filter_by(kpi=old_label).update({KpiRecord.kpi: new_label})
        KpiTarget.query.filter_by(kpi=old_label).update({KpiTarget.kpi: new_label})
        KpiCriteria.query.filter_by(kpi=old_label).update({KpiCriteria.kpi: new_label})
        KpiAttachment.query.filter_by(kpi=old_label).update({KpiAttachment.kpi: new_label})

    if 'category' in data:
        item.category = data['category'] or ''
    if 'unit' in data:
        item.unit = data['unit'] or ''
    if 'valueType' in data:
        item.value_type = data['valueType'] or 'single'
    if 'divisions' in data:
        item.divisions = data['divisions'] or []
    if 'order' in data and data['order'] is not None:
        item.sort_order = data['order']
    if 'showRawData' in data:
        item.show_raw_data = bool(data['showRawData'])
    if 'direction' in data:
        d = data['direction']
        if d in ('higher', 'lower'):
            item.direction = d

    db.session.commit()
    return success_response(item.to_dict())


@bp.route('/kpi-definitions/<int:definition_id>', methods=['DELETE'])
def delete_kpi_definition(definition_id):
    item = KpiDefinition.query.get(definition_id)
    if not item:
        return not_found_response('KPI 항목을 찾을 수 없습니다.')

    # 디지털 트윈 대시보드의 과제가 이 지표에 연결돼 있으면 지우지 않는다.
    #
    # DB 에도 RESTRICT 가 걸려 있어(dt2_project_kpi) 어차피 막히지만, 그러면
    # IntegrityError 가 그대로 500 으로 나가 화면에 "서버 오류" 만 뜬다.
    # 몇 건이 걸려 있는지 여기서 세어 사람이 읽을 수 있는 이유로 돌려준다.
    #
    # 모델을 함수 안에서 import 한다 — 모듈 최상단에 두면 dx_kpi_management 가
    # digital_twin_dashboard 에 로드 시점부터 묶인다. 필요한 건 이 한 곳뿐이다.
    from app.modules.digital_twin_dashboard.models_v2 import Dt2ProjectKpi

    linked = (db.session.query(db.func.count(Dt2ProjectKpi.id))
              .filter(Dt2ProjectKpi.kpi_definition_id == definition_id)
              .scalar()) or 0
    if linked > 0:
        return error_response(
            f'이 KPI 에 연결된 디지털 트윈 과제가 {linked}건 있어 삭제할 수 없습니다. '
            f'과제 편집에서 연결을 먼저 해제하세요.')

    db.session.delete(item)
    db.session.commit()
    return success_response(message='KPI 항목이 삭제되었습니다.')


@bp.route('/kpi-definitions/reorder', methods=['PUT'])
def reorder_kpi_definitions():
    """전체 순서 일괄 업데이트. body: [{id, order}, ...]"""
    data = request.get_json()
    if not isinstance(data, list):
        return error_response('배열 형태의 데이터가 필요합니다.')
    for entry in data:
        item = KpiDefinition.query.get(entry.get('id'))
        if item and entry.get('order') is not None:
            item.sort_order = entry['order']
    db.session.commit()
    return success_response(message='순서가 저장되었습니다.')


# ============== KPI Records ==============

@bp.route('/records', methods=['GET'])
def get_records():
    """Get all KPI records, optionally filtered by year."""
    year = request.args.get('year')
    query = KpiRecord.query.order_by(KpiRecord.id.desc())
    if year:
        query = query.filter(KpiRecord.base_date.like(f'{year}%'))
    records = query.all()
    return success_response([r.to_dict() for r in records])


@bp.route('/records', methods=['POST'])
def create_record():
    """Create a new KPI record."""
    data = request.get_json()
    if not data:
        return error_response('요청 데이터가 없습니다.')

    required = ['division', 'kpi', 'category', 'value', 'baseDate']
    missing = [f for f in required if not data.get(f)]
    if missing:
        return error_response(f'필수 항목 누락: {", ".join(missing)}')

    record = KpiRecord(
        division=data['division'],
        kpi=data['kpi'],
        category=data['category'],
        value=data['value'],
        unit=data.get('unit', ''),
        base_date=data['baseDate'],
        numerator=data.get('numerator'),
        denominator=data.get('denominator'),
    )
    db.session.add(record)
    db.session.commit()
    return created_response(record.to_dict())


@bp.route('/records/bulk', methods=['POST'])
def create_records_bulk():
    """Create multiple KPI records at once."""
    data = request.get_json()
    if not data or not isinstance(data, list):
        return error_response('배열 형태의 데이터가 필요합니다.')

    created = []
    for item in data:
        required = ['division', 'kpi', 'category', 'value', 'baseDate']
        missing = [f for f in required if not item.get(f)]
        if missing:
            continue
        record = KpiRecord(
            division=item['division'],
            kpi=item['kpi'],
            category=item['category'],
            value=item['value'],
            unit=item.get('unit', ''),
            base_date=item['baseDate'],
            numerator=item.get('numerator'),
            denominator=item.get('denominator'),
        )
        db.session.add(record)
        created.append(record)

    db.session.commit()
    return created_response([r.to_dict() for r in created])


@bp.route('/records/<int:record_id>', methods=['PUT'])
def update_record(record_id):
    """Update a KPI record."""
    record = KpiRecord.query.get(record_id)
    if not record:
        return not_found_response('기록을 찾을 수 없습니다.')
    data = request.get_json()
    if not data:
        return error_response('요청 데이터가 없습니다.')
    if 'division' in data:
        record.division = data['division']
    if 'kpi' in data:
        record.kpi = data['kpi']
    if 'category' in data:
        record.category = data['category']
    if 'value' in data:
        record.value = data['value']
    if 'unit' in data:
        record.unit = data['unit']
    if 'baseDate' in data:
        record.base_date = data['baseDate']
    if 'numerator' in data:
        record.numerator = data['numerator']
    if 'denominator' in data:
        record.denominator = data['denominator']
    db.session.commit()
    return success_response(record.to_dict())


@bp.route('/records/<int:record_id>', methods=['DELETE'])
def delete_record(record_id):
    """Delete a KPI record."""
    record = KpiRecord.query.get(record_id)
    if not record:
        return not_found_response('기록을 찾을 수 없습니다.')
    db.session.delete(record)
    db.session.commit()
    return success_response(message='삭제되었습니다.')


# ============== KPI Targets ==============

@bp.route('/targets', methods=['GET'])
def get_targets():
    """Get all KPI targets.
    응답 형식: { "div|year|kpi|period": {value, numerator, denominator} }
    역호환: 단일값 KPI는 value 문자열 그대로도 반환되도록 하기 위해 객체 형태로 통일.
    """
    targets = KpiTarget.query.all()
    result = {}
    for t in targets:
        key = f'{t.division}|{t.year}|{t.kpi}|{t.period}'
        result[key] = {
            'value': t.target_value or '',
            'numerator': t.target_numerator,
            'denominator': t.target_denominator,
        }
    return success_response(result)


@bp.route('/targets', methods=['PUT'])
def save_targets():
    """Bulk save/update KPI targets.
    body: { "div|year|kpi|period": value(str) | {value, numerator, denominator} }
    """
    data = request.get_json()
    if not data or not isinstance(data, dict):
        return error_response('요청 데이터가 없습니다.')

    for key, payload in data.items():
        parts = key.split('|')
        if len(parts) != 4:
            continue
        division, year_str, kpi, period = parts
        try:
            year = int(year_str)
        except ValueError:
            continue

        if isinstance(payload, dict):
            value = payload.get('value', '')
            numerator = payload.get('numerator')
            denominator = payload.get('denominator')
        else:
            value = payload
            numerator = None
            denominator = None

        existing = KpiTarget.query.filter_by(
            division=division, year=year, kpi=kpi, period=period
        ).first()

        if existing:
            existing.target_value = value
            existing.target_numerator = numerator
            existing.target_denominator = denominator
        else:
            target = KpiTarget(
                division=division,
                year=year,
                kpi=kpi,
                period=period,
                target_value=value,
                target_numerator=numerator,
                target_denominator=denominator,
            )
            db.session.add(target)

    db.session.commit()
    return success_response(message='목표치가 저장되었습니다.')


# ============== KPI Criteria ==============

@bp.route('/criteria', methods=['GET'])
def get_criteria():
    """Get all KPI criteria."""
    rows = KpiCriteria.query.all()
    result = {r.kpi: r.criteria for r in rows}
    return success_response(result)


@bp.route('/criteria', methods=['PUT'])
def save_criteria():
    """Bulk save/update KPI criteria."""
    data = request.get_json()
    if not data or not isinstance(data, dict):
        return error_response('요청 데이터가 없습니다.')

    for kpi, criteria in data.items():
        existing = KpiCriteria.query.filter_by(kpi=kpi).first()
        if existing:
            existing.criteria = criteria
        else:
            row = KpiCriteria(kpi=kpi, criteria=criteria)
            db.session.add(row)

    db.session.commit()
    return success_response(message='산출 기준이 저장되었습니다.')


# ============== KPI Attachments ==============

def ensure_upload_folder():
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)


@bp.route('/attachments', methods=['GET'])
def get_attachments():
    """Get attachments, optionally filtered by year."""
    year = request.args.get('year', type=int)
    query = KpiAttachment.query
    if year:
        query = query.filter_by(year=year)
    attachments = query.order_by(KpiAttachment.id.desc()).all()
    return success_response([a.to_dict() for a in attachments])


@bp.route('/attachments', methods=['POST'])
def upload_attachment():
    """Upload a KPI evidence file."""
    if 'file' not in request.files:
        return error_response('파일이 없습니다.')
    file = request.files['file']
    if file.filename == '':
        return error_response('파일 이름이 없습니다.')

    division = request.form.get('division')
    kpi = request.form.get('kpi')
    year = request.form.get('year', type=int)
    month = request.form.get('month')

    if not all([division, kpi, year, month]):
        return error_response('필수 항목 누락: division, kpi, year, month')

    ensure_upload_folder()

    original_filename = file.filename
    stored_filename = KpiAttachment.generate_stored_filename(original_filename)
    file_path = os.path.join(UPLOAD_FOLDER, stored_filename)
    file.save(file_path)
    file_size = os.path.getsize(file_path)

    attachment = KpiAttachment(
        division=division,
        kpi=kpi,
        year=year,
        month=month,
        original_filename=original_filename,
        stored_filename=stored_filename,
        file_size=file_size,
        mime_type=file.content_type,
    )
    db.session.add(attachment)
    db.session.commit()
    return created_response(attachment.to_dict())


@bp.route('/attachments/<int:attachment_id>', methods=['GET'])
def download_attachment(attachment_id):
    """Download attachment as ZIP."""
    attachment = KpiAttachment.query.get(attachment_id)
    if not attachment:
        return not_found_response('첨부파일을 찾을 수 없습니다.')

    file_path = os.path.join(UPLOAD_FOLDER, attachment.stored_filename)
    if not os.path.exists(file_path):
        return not_found_response('파일이 존재하지 않습니다.')

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.write(file_path, attachment.original_filename)
    zip_buffer.seek(0)

    base_name = os.path.splitext(attachment.original_filename)[0]
    return send_file(
        zip_buffer,
        as_attachment=True,
        download_name=f'{base_name}.zip',
        mimetype='application/zip'
    )


@bp.route('/attachments/<int:attachment_id>', methods=['DELETE'])
def delete_attachment(attachment_id):
    """Delete an attachment."""
    attachment = KpiAttachment.query.get(attachment_id)
    if not attachment:
        return not_found_response('첨부파일을 찾을 수 없습니다.')

    file_path = os.path.join(UPLOAD_FOLDER, attachment.stored_filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    db.session.delete(attachment)
    db.session.commit()
    return success_response(message='첨부파일이 삭제되었습니다.')


@bp.route('/attachments/download-all', methods=['GET'])
def download_all_attachments():
    """Download all attachments for a year as a single ZIP."""
    year = request.args.get('year', type=int)
    query = KpiAttachment.query
    if year:
        query = query.filter_by(year=year)
    attachments = query.all()

    if not attachments:
        return error_response('다운로드할 첨부파일이 없습니다.')

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        used_names = {}
        for att in attachments:
            file_path = os.path.join(UPLOAD_FOLDER, att.stored_filename)
            if not os.path.exists(file_path):
                continue
            # 폴더 구조: 사업부/KPI항목/월/파일명
            folder = f'{att.division}/{att.kpi}/{att.month}'
            name = f'{folder}/{att.original_filename}'
            # 중복 파일명 처리
            if name in used_names:
                used_names[name] += 1
                base, ext = os.path.splitext(att.original_filename)
                name = f'{folder}/{base}_{used_names[name]}{ext}'
            else:
                used_names[name] = 0
            zf.write(file_path, name)
    zip_buffer.seek(0)

    filename = f'KPI_근거자료_{year}년.zip' if year else 'KPI_근거자료_전체.zip'
    return send_file(
        zip_buffer,
        as_attachment=True,
        download_name=filename,
        mimetype='application/zip'
    )


# ============== Weekly Trends (주간 주요 동향) ==============

def ensure_weekly_trends_table():
    """Create kpi_weekly_trends table on demand if migrations have not run yet."""
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    if 'kpi_weekly_trends' not in inspector.get_table_names():
        WeeklyTrend.__table__.create(db.engine, checkfirst=True)


@bp.route('/weekly-trends', methods=['GET'])
def get_weekly_trends():
    """Get weekly trends, optionally filtered by year."""
    ensure_weekly_trends_table()
    year = request.args.get('year', type=int)
    query = WeeklyTrend.query
    if year:
        query = query.filter_by(year=year)
    items = query.order_by(WeeklyTrend.year.desc(), WeeklyTrend.week.desc(), WeeklyTrend.id.desc()).all()
    return success_response([t.to_dict() for t in items])


@bp.route('/weekly-trends', methods=['POST'])
def create_weekly_trend():
    """Create or update a weekly trend (upsert by division/category/year/week)."""
    ensure_weekly_trends_table()
    data = request.get_json() or {}
    division = (data.get('division') or '').strip()
    category = (data.get('category') or '').strip()
    year = data.get('year')
    week = data.get('week')
    content = data.get('content', '')

    if not division or not category or year is None or week is None:
        return error_response('필수 항목 누락: division, category, year, week')
    if category not in ('개발', '제조'):
        return error_response('category는 개발 또는 제조여야 합니다.')
    try:
        year = int(year)
        week = int(week)
    except (TypeError, ValueError):
        return error_response('year, week는 숫자여야 합니다.')

    existing = WeeklyTrend.query.filter_by(
        division=division, category=category, year=year, week=week
    ).first()

    if existing:
        existing.content = content
        db.session.commit()
        return success_response(existing.to_dict())

    trend = WeeklyTrend(
        division=division,
        category=category,
        year=year,
        week=week,
        content=content,
    )
    db.session.add(trend)
    db.session.commit()
    return created_response(trend.to_dict())


@bp.route('/weekly-trends/<int:trend_id>', methods=['PUT'])
def update_weekly_trend(trend_id):
    trend = WeeklyTrend.query.get(trend_id)
    if not trend:
        return not_found_response('주간 주요 동향을 찾을 수 없습니다.')
    data = request.get_json() or {}
    if 'division' in data:
        trend.division = data['division']
    if 'category' in data:
        if data['category'] not in ('개발', '제조'):
            return error_response('category는 개발 또는 제조여야 합니다.')
        trend.category = data['category']
    if 'year' in data:
        trend.year = int(data['year'])
    if 'week' in data:
        trend.week = int(data['week'])
    if 'content' in data:
        trend.content = data['content']
    db.session.commit()
    return success_response(trend.to_dict())


@bp.route('/weekly-trends/<int:trend_id>', methods=['DELETE'])
def delete_weekly_trend(trend_id):
    trend = WeeklyTrend.query.get(trend_id)
    if not trend:
        return not_found_response('주간 주요 동향을 찾을 수 없습니다.')
    db.session.delete(trend)
    db.session.commit()
    return success_response(message='삭제되었습니다.')


# ============== 주간보고 붙여넣기 반입 ==============
#
# 원본은 DRM 이 걸린 워드라 파일을 올려도 서버는 암호화된 덩어리만 받는다.
# 그래서 입구가 **텍스트 한 덩이**다 — 사람이 워드에서 표를 긁어 붙인다.
# 파싱 규칙은 `importer.py` 에 있고 여기서는 DB 와 붙이기만 한다.
#
# ⚠️ **미리보기와 저장을 갈라 놓는다.** preview 는 아무것도 쓰지 않는다.
#    무엇을 넣을지는 사람이 보고 고른 뒤 commit 으로 온다.

def ensure_import_alias_table():
    """별칭 표를 필요할 때 만든다 (`ensure_weekly_trends_table` 과 같은 방식).

    마이그레이션을 따로 만들지 않은 이유: 이 모듈이 이미 이 방식을 쓰고 있고,
    운영 반입이 **폴더 압축 + flask db upgrade** 라 절차를 늘리지 않는 편이 낫다.
    """
    from sqlalchemy import inspect
    if 'kpi_import_aliases' not in inspect(db.engine).get_table_names():
        KpiImportAlias.__table__.create(db.engine, checkfirst=True)


def _stored_aliases():
    """`{정규화이름: KPI label}` — 지난번에 사람이 골라 둔 답."""
    ensure_import_alias_table()
    return {a.alias_key: a.kpi_label for a in KpiImportAlias.query.all()}


def _save_aliases(items):
    """사람이 고른 답을 남긴다. 같은 이름이 다시 오면 **덮어쓴다**(고쳐 준 것이다)."""
    ensure_import_alias_table()
    saved = 0
    for it in items or []:
        raw = (it.get('alias') or '').strip()
        label = (it.get('kpi') or '').strip()
        if not raw or not label:
            continue
        key = importer._norm(raw)
        row = KpiImportAlias.query.filter_by(alias_key=key).first()
        if row:
            row.kpi_label, row.alias_raw = label, raw
        else:
            db.session.add(KpiImportAlias(alias_key=key, alias_raw=raw,
                                          kpi_label=label))
        saved += 1
    return saved


def _import_context():
    """반입에 필요한 정본 — 사업부 목록과 KPI 정의."""
    seed_definitions_if_empty()
    defs = [d.to_dict() for d in KpiDefinition.query
            .order_by(KpiDefinition.sort_order, KpiDefinition.id).all()
            if (d.kind or 'metric') == 'metric']
    return DX_DIVISIONS, defs


@bp.route('/import/preview', methods=['POST'])
def import_preview():
    """
    붙여넣은 글을 읽어 **무엇이 들어갈지** 돌려준다. DB 는 건드리지 않는다.

    본문
        text      붙여넣은 내용 (필수)
        kind      'kpi' | 'weekly' (기본 'kpi')
        baseDate  기준일 'YYYY-MM-DD' — **문서에 날짜가 없어 화면이 준다.**
                  주면 같은 날짜의 기존 값을 함께 찾아 준다(덮어쓰기 확인용).
    """
    data = request.get_json() or {}
    text = data.get('text') or ''
    kind = (data.get('kind') or 'kpi').strip()
    divisions, defs = _import_context()

    if kind == 'weekly':
        ensure_weekly_trends_table()
        out = importer.parse_weekly(text, divisions)
        year, week = data.get('year'), data.get('week')
        for s in out['sections']:
            s['existing'] = None
            if year and week:
                prev = WeeklyTrend.query.filter_by(
                    division=s['division'], category=s['category'],
                    year=int(year), week=int(week)).first()
                if prev:
                    s['existing'] = prev.content
        return success_response(out)

    out = importer.parse_kpi_table(text, divisions, defs, aliases=_stored_aliases())
    base_date = (data.get('baseDate') or '').strip()
    # 이미 값이 있으면 **나란히 보여준다.** 조용히 덮어쓰지 않기 위한 재료다.
    for row in out['rows']:
        row['existing'] = None
        if base_date:
            prev = KpiRecord.query.filter_by(
                division=row['division'], kpi=row['kpi'],
                base_date=base_date).order_by(KpiRecord.id.desc()).first()
            if prev:
                row['existing'] = prev.to_dict()
    out['baseDate'] = base_date
    return success_response(out)


@bp.route('/import/commit', methods=['POST'])
def import_commit():
    """
    미리보기에서 **사람이 고른 것만** 저장한다.

    본문 (kind='kpi')     rows[], baseDate
    본문 (kind='weekly')  sections[], year, week

    ⚠️ 값은 **미리보기가 보여준 그대로** 받는다. 여기서 다시 계산하지 않는다 —
       화면에 보인 숫자와 저장된 숫자가 달라지면 확인 절차가 무의미해진다.
    """
    data = request.get_json() or {}
    kind = (data.get('kind') or 'kpi').strip()

    if kind == 'weekly':
        ensure_weekly_trends_table()
        year, week = data.get('year'), data.get('week')
        sections = data.get('sections') or []
        if year is None or week is None:
            return error_response('연도와 주차가 필요합니다.')
        try:
            year, week = int(year), int(week)
        except (TypeError, ValueError):
            return error_response('연도·주차는 숫자여야 합니다.')
        saved = []
        for s in sections:
            division = (s.get('division') or '').strip()
            category = (s.get('category') or '').strip()
            if not division or category not in ('개발', '제조'):
                continue
            prev = WeeklyTrend.query.filter_by(
                division=division, category=category, year=year, week=week).first()
            if prev:
                prev.content = s.get('content', '')
                saved.append(prev)
            else:
                row = WeeklyTrend(division=division, category=category,
                                  year=year, week=week, content=s.get('content', ''))
                db.session.add(row)
                saved.append(row)
        db.session.commit()
        return success_response({'savedCount': len(saved),
                                 'items': [x.to_dict() for x in saved]})

    base_date = (data.get('baseDate') or '').strip()
    if not base_date:
        return error_response('기준일이 필요합니다. 주간보고에는 날짜가 없어 '
                              '화면에서 골라 주셔야 합니다.')
    # 사람이 골라 준 이름 연결을 남긴다 — **다음 주부터는 자동으로 맞는다.**
    alias_count = _save_aliases(data.get('aliases'))
    rows = data.get('rows') or []
    saved = []
    for r in rows:
        required = ('division', 'kpi', 'value')
        if any(not r.get(f) for f in required):
            continue
        rec = KpiRecord(
            division=r['division'], kpi=r['kpi'],
            category=r.get('category', ''), value=str(r['value']),
            unit=r.get('unit', ''), base_date=base_date,
            numerator=r.get('numerator'), denominator=r.get('denominator'),
        )
        db.session.add(rec)
        saved.append(rec)
    db.session.commit()
    return created_response({'savedCount': len(saved),
                             'aliasCount': alias_count,
                             'items': [x.to_dict() for x in saved]})


@bp.route('/import/suggest-names', methods=['POST'])
def import_suggest_names():
    """
    못 맞춘 KPI 이름을 **AI 에게 물어본다.** 제안만 돌려주고 저장하지 않는다.

    본문
        names  ['가상검증 적용률', ...]  — 미리보기의 `unknown` 에서 화면이 추린다

    ⚠️ **따로 부른다.** 미리보기에 끼워 넣으면 AI 가 느리거나 막혔을 때
       반입 전체가 같이 느려지거나 실패한다. 반입은 AI 없이도 끝까지 되어야 한다.
    ⚠️ 실패해도 **200 으로** `{ok: false, reason}` 을 준다 — 화면은 그 문장만 띄우고
       평소처럼 사람이 고르면 된다. 오류 화면을 띄울 일이 아니다.
    """
    data = request.get_json() or {}
    names = data.get('names') or []
    if not isinstance(names, list):
        return error_response('names 는 목록이어야 합니다.', status_code=400)

    _, defs = _import_context()
    return success_response(name_ai.suggest(names, defs))


@bp.route('/import/aliases', methods=['GET'])
def get_import_aliases():
    """지금까지 사람이 골라 둔 이름 연결. 설정 화면에서 되돌아볼 수 있게 연다."""
    ensure_import_alias_table()
    items = KpiImportAlias.query.order_by(KpiImportAlias.id.desc()).all()
    return success_response([a.to_dict() for a in items])


@bp.route('/import/aliases/<int:alias_id>', methods=['DELETE'])
def delete_import_alias(alias_id):
    """잘못 연결한 것을 지운다. 지우면 그 이름은 다시 물어본다."""
    row = KpiImportAlias.query.get(alias_id)
    if not row:
        return not_found_response('연결을 찾을 수 없습니다.')
    db.session.delete(row)
    db.session.commit()
    return success_response(message='삭제되었습니다.')
