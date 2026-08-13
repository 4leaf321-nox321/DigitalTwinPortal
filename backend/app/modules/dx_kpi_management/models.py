"""
DX 부문 KPI 관리 - Database Models
"""
import uuid
import os
from app.extensions import db
from app.shared.models import BaseModel
from app.shared.timeutil import iso_kst


class KpiDefinition(BaseModel):
    """KPI 항목 정의 (사업부, 카테고리, 단위, 입력방식 등)"""
    __tablename__ = 'kpi_definitions'

    label = db.Column(db.String(200), nullable=False, unique=True)
    category = db.Column(db.String(50), nullable=False, default='')
    unit = db.Column(db.String(20), default='')
    # value_type: 'single' (단일값) 또는 'fraction' (분자/분모)
    value_type = db.Column(db.String(20), nullable=False, default='single')
    # divisions: JSON 배열, 빈 배열 또는 null이면 전 사업부 공통
    divisions = db.Column(db.JSON, default=list)
    sort_order = db.Column(db.Integer, default=0)
    # 분자/분모 입력방식에서 종합 표 등에 분자/분모 원본을 함께 표기할지 여부
    show_raw_data = db.Column(db.Boolean, nullable=False, default=True, server_default=db.true())
    # direction: 'higher' = 망대 (높을수록 좋음), 'lower' = 망소 (낮을수록 좋음)
    # 달성률 계산: higher → curNum/target, lower → target/curNum
    direction = db.Column(db.String(10), nullable=False, default='higher', server_default='higher')

    # kind: 'metric'   측정되는 DX KPI — 목표·실적·달성률이 있다
    #       'platform' 플랫폼 구축 — **측정값이 없고 연결만 한다**
    #
    # 지표를 올리는 게 아니라 시스템을 만드는 과제가 있어서 생겼다. 그런 과제에
    # 달성률 잣대를 들이대면 "기여 KPI 없음" 으로 잘못 분류된다.
    # DX KPI 관리 화면은 metric 만 받는다 — 목표를 요구하는 표에 목표가 있을 수
    # 없는 항목이 끼면 안 된다. (routes.get_kpi_definitions 가 거른다)
    kind = db.Column(db.String(20), nullable=False, default='metric',
                     server_default='metric', index=True)

    @property
    def is_metric(self):
        return (self.kind or 'metric') == 'metric'

    def to_dict(self):
        return {
            'id': self.id,
            'label': self.label,
            'category': self.category,
            'unit': self.unit,
            'valueType': self.value_type,
            'divisions': self.divisions or [],
            'order': self.sort_order,
            'showRawData': bool(self.show_raw_data),
            'direction': self.direction or 'higher',
            'kind': self.kind or 'metric',
        }


class KpiRecord(BaseModel):
    """KPI 기록 (Raw 데이터)"""
    __tablename__ = 'kpi_records'

    division = db.Column(db.String(50), nullable=False)
    kpi = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    value = db.Column(db.String(100), nullable=False)
    unit = db.Column(db.String(20), default='')
    base_date = db.Column(db.String(20), nullable=False)
    # fraction 입력시 분자/분모 보존 (단일값 KPI는 NULL)
    numerator = db.Column(db.String(100), nullable=True)
    denominator = db.Column(db.String(100), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'division': self.division,
            'kpi': self.kpi,
            'category': self.category,
            'value': self.value,
            'unit': self.unit,
            'baseDate': self.base_date,
            'numerator': self.numerator,
            'denominator': self.denominator,
            'date': iso_kst(self.created_at) if self.created_at else None,
        }


class KpiTarget(BaseModel):
    """KPI 목표치 설정"""
    __tablename__ = 'kpi_targets'
    __table_args__ = (
        db.UniqueConstraint('division', 'year', 'kpi', 'period', name='uq_kpi_target'),
    )

    division = db.Column(db.String(50), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    kpi = db.Column(db.String(200), nullable=False)
    period = db.Column(db.String(10), nullable=False)  # Q1~Q4 or 1월~12월
    target_value = db.Column(db.String(100), default='')
    # fraction 목표치 입력시 분자/분모 보존
    target_numerator = db.Column(db.String(100), nullable=True)
    target_denominator = db.Column(db.String(100), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'division': self.division,
            'year': self.year,
            'kpi': self.kpi,
            'period': self.period,
            'targetValue': self.target_value,
            'targetNumerator': self.target_numerator,
            'targetDenominator': self.target_denominator,
        }


class KpiCriteria(BaseModel):
    """KPI 산출 기준"""
    __tablename__ = 'kpi_criteria'

    kpi = db.Column(db.String(200), nullable=False, unique=True)
    criteria = db.Column(db.Text, default='')

    def to_dict(self):
        return {
            'id': self.id,
            'kpi': self.kpi,
            'criteria': self.criteria,
        }


UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'uploads', 'dx-kpi-management')


class KpiAttachment(BaseModel):
    """KPI 근거 자료 첨부파일"""
    __tablename__ = 'kpi_attachments'

    division = db.Column(db.String(50), nullable=False)
    kpi = db.Column(db.String(200), nullable=False)
    year = db.Column(db.Integer, nullable=False)
    month = db.Column(db.String(10), nullable=False)  # 1월~12월
    original_filename = db.Column(db.String(255), nullable=False)
    stored_filename = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.Integer, default=0)
    mime_type = db.Column(db.String(100))

    def to_dict(self):
        return {
            'id': self.id,
            'division': self.division,
            'kpi': self.kpi,
            'year': self.year,
            'month': self.month,
            'originalFilename': self.original_filename,
            'storedFilename': self.stored_filename,
            'fileSize': self.file_size,
            'mimeType': self.mime_type,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
        }

    @staticmethod
    def generate_stored_filename(original_filename):
        ext = os.path.splitext(original_filename)[1]
        return f"{uuid.uuid4().hex}{ext}"


class WeeklyTrend(BaseModel):
    """주간 주요 동향 - 사업부/구분(개발/제조)별 주간 코멘트"""
    __tablename__ = 'kpi_weekly_trends'
    __table_args__ = (
        db.UniqueConstraint('division', 'category', 'year', 'week', name='uq_weekly_trend'),
    )

    division = db.Column(db.String(50), nullable=False)
    category = db.Column(db.String(20), nullable=False)  # 개발 | 제조
    year = db.Column(db.Integer, nullable=False)
    week = db.Column(db.Integer, nullable=False)  # ISO 주차 1~53
    content = db.Column(db.Text, default='')

    def to_dict(self):
        return {
            'id': self.id,
            'division': self.division,
            'category': self.category,
            'year': self.year,
            'week': self.week,
            'content': self.content or '',
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }


class KpiImportAlias(BaseModel):
    """주간보고에 적힌 KPI 이름 → 화면의 KPI 정의.

    왜 필요한가
        원본 문서의 표기가 `KpiDefinition.label` 과 다르다(「설계자동화율」 vs
        「설계 자동화율」). 정확·정규화 대조로도 못 맞추는 것은 **사람이 한 번
        골라 주고**, 그 답을 여기 남긴다. 둘째 주부터는 자동으로 맞는다.

    ⚠️ 이 표가 있어서 **코드를 고치지 않고 화면에서 학습된다.** 개발 환경에
       진짜 문서가 없는(DRM) 상황에서 이게 가장 중요한 장치다 — 매칭 규칙을
       내가 미리 다 맞힐 수 없으므로, 틀린 것을 사람이 고칠 길을 열어 둔다.
    """
    __tablename__ = 'kpi_import_aliases'

    # 정규화한 이름(공백·기호 제거, 소문자). 대조는 늘 이 값으로 한다.
    alias_key = db.Column(db.String(200), nullable=False, unique=True, index=True)
    # 사람이 본 그대로의 원문 — 나중에 "왜 이렇게 연결했지" 를 되짚을 때 쓴다.
    alias_raw = db.Column(db.String(200), nullable=False, default='')
    kpi_label = db.Column(db.String(200), nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'aliasKey': self.alias_key,
            'aliasRaw': self.alias_raw,
            'kpi': self.kpi_label,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
        }
