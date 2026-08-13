"""
Digital Twin Dashboard Models
모듈별 설정 및 데이터 저장을 위한 모델
"""
import os
import uuid
from datetime import datetime
from sqlalchemy.dialects.postgresql import JSON
from app.extensions import db
from app.shared.models import BaseModel
from app.shared.timeutil import iso_kst

# Upload folder path for project attachments
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'uploads', 'digital-twin-dashboard')


class ModuleSettings(BaseModel):
    """
    모듈별 설정 저장 테이블
    - 각 모듈의 설정을 JSON 형태로 저장
    - 향후 다른 모듈에서도 재사용 가능
    """
    __tablename__ = 'module_settings'

    module_name = db.Column(db.String(100), nullable=False, index=True)  # 모듈명 (예: digital_twin_dashboard)
    settings_key = db.Column(db.String(100), nullable=False, index=True)  # 설정 키 (예: system_settings)
    settings_data = db.Column(JSON, nullable=False, default=dict)  # JSON 형태의 설정 데이터
    description = db.Column(db.String(500))  # 설정 설명

    # 복합 유니크 제약 (같은 모듈의 같은 설정키는 하나만)
    __table_args__ = (
        db.UniqueConstraint('module_name', 'settings_key', name='uq_module_settings_key'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'module_name': self.module_name,
            'settings_key': self.settings_key,
            'settings_data': self.settings_data,
            'description': self.description,
            'created_at': iso_kst(self.created_at) if self.created_at else None,
            'updated_at': iso_kst(self.updated_at) if self.updated_at else None
        }

    def __repr__(self):
        return f'<ModuleSettings {self.module_name}:{self.settings_key}>'


class Division(BaseModel):
    """사업부 테이블"""
    __tablename__ = 'divisions'

    name = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(20), default='#64748B')
    description = db.Column(db.Text)
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)

    # 이 사업부가 **DX KPI 를 직접 관리하는가.** (2026-08-01 추가)
    #
    # MX·VD·DA·NW·의료기기 는 지표를 갖고 목표·실적을 쌓는다.
    # GTR·SR·CS 는 **기능조직**이라 자기 지표가 없고 위 사업부들을 지원한다
    # (실측 2026-08-01: kpi_records·kpi_targets 에 이 셋은 한 건도 없다).
    #
    # KPI 매트릭스의 **열이 이 값으로 정해진다.** 코드에 사업부 이름을 박으면
    # 조직이 바뀔 때 화면이 조용히 틀어지므로 데이터로 둔다.
    is_kpi_owner = db.Column(db.Boolean, nullable=False, default=True,
                             server_default=db.true())

    # Relationships
    departments = db.relationship('Department', backref='division', lazy='dynamic')

    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'color': self.color,
            'description': self.description,
            'order': self.order,
            'is_active': self.is_active,
            'isKpiOwner': bool(self.is_kpi_owner),
        }


class Department(BaseModel):
    """부서/그룹 테이블"""
    __tablename__ = 'departments'

    name = db.Column(db.String(100), nullable=False)
    division_id = db.Column(db.Integer, db.ForeignKey('divisions.id'), nullable=True)
    description = db.Column(db.Text)
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'divisionId': str(self.division_id) if self.division_id else None,
            'description': self.description,
            'order': self.order,
            'is_active': self.is_active
        }


class ProcessCategory(BaseModel):
    """프로세스 테이블"""
    __tablename__ = 'process_categories'

    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'description': self.description,
            'order': self.order,
            'is_active': self.is_active
        }


class ProjectDomain(BaseModel):
    """과제 영역 테이블"""
    __tablename__ = 'project_domains'

    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'description': self.description,
            'order': self.order,
            'is_active': self.is_active
        }


class TaskCategory(BaseModel):
    """과제 구분 테이블"""
    __tablename__ = 'task_categories'

    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'description': self.description,
            'order': self.order,
            'is_active': self.is_active
        }


class TaskStatus(BaseModel):
    """진행상태 테이블"""
    __tablename__ = 'task_statuses'

    name = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(20), default='#64748B')
    description = db.Column(db.Text)
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'color': self.color,
            'description': self.description,
            'order': self.order,
            'is_active': self.is_active
        }


class PerformanceCategory(BaseModel):
    """성과 대분류 테이블"""
    __tablename__ = 'performance_categories'

    name = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(20), default='#64748B')
    description = db.Column(db.Text)
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)

    # Relationships
    subcategories = db.relationship('PerformanceSubcategory', backref='category', lazy='dynamic')

    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'color': self.color,
            'description': self.description,
            'order': self.order,
            'is_active': self.is_active
        }


class PerformanceSubcategory(BaseModel):
    """성과 소분류 테이블"""
    __tablename__ = 'performance_subcategories'

    name = db.Column(db.String(100), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('performance_categories.id'), nullable=False)
    unit = db.Column(db.String(50))  # 단위 (예: hrs, %, 억원, 건, 대)
    description = db.Column(db.Text)
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    is_achievement_type = db.Column(db.Boolean, default=False)  # 달성형 여부 (True: 달성형, False: 비교형)

    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'categoryId': str(self.category_id),
            'unit': self.unit,
            'description': self.description,
            'order': self.order,
            'is_active': self.is_active,
            'isAchievementType': self.is_achievement_type
        }


# ============================================
# 서버 데이터 동기화 관련 모델
# ============================================

class DashboardData(BaseModel):
    """
    대시보드 메인 데이터 테이블
    - 프로젝트, 성과 데이터를 JSON으로 저장
    - 버전 관리로 동시 수정 충돌 방지 (Optimistic Locking)
    """
    __tablename__ = 'dashboard_data'

    version = db.Column(db.Integer, nullable=False, default=1)  # 버전 번호 (충돌 감지용)
    projects = db.Column(JSON, nullable=False, default=list)  # 프로젝트 목록
    performances = db.Column(JSON, nullable=False, default=list)  # 성과 목록
    data_metadata = db.Column(JSON, nullable=False, default=dict)  # 메타데이터 (metadata는 예약어)

    # 마지막 수정자 정보
    last_modified_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    last_modified_by_name = db.Column(db.String(100))  # 빠른 조회를 위해 이름도 저장

    # Relationships
    modifier = db.relationship('User', foreign_keys=[last_modified_by])

    def to_dict(self):
        return {
            'id': self.id,
            'version': self.version,
            'projects': self.projects,
            'performances': self.performances,
            'metadata': self.data_metadata,  # API 응답에서는 metadata로 반환
            'last_modified_by': self.last_modified_by,
            'last_modified_by_name': self.last_modified_by_name,
            'created_at': iso_kst(self.created_at) if self.created_at else None,
            'updated_at': iso_kst(self.updated_at) if self.updated_at else None
        }

    def __repr__(self):
        return f'<DashboardData v{self.version}>'


class DashboardSnapshot(BaseModel):
    """
    대시보드 스냅샷 테이블
    - 특정 시점의 데이터 백업
    """
    __tablename__ = 'dashboard_snapshots'

    name = db.Column(db.String(200), nullable=False)  # 스냅샷 이름
    description = db.Column(db.Text)  # 설명
    snapshot_data = db.Column(JSON, nullable=False)  # 스냅샷 데이터 (projects, performances, metadata)
    data_version = db.Column(db.Integer)  # 스냅샷 시점의 데이터 버전

    # 생성자 정보
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_by_name = db.Column(db.String(100))

    # 스냅샷 타입 (manual: 수동, auto: 자동, upload: 업로드 전)
    snapshot_type = db.Column(db.String(20), default='manual')

    # Relationships
    creator = db.relationship('User', foreign_keys=[created_by])

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'snapshot_data': self.snapshot_data,
            'data_version': self.data_version,
            'created_by': self.created_by,
            'created_by_name': self.created_by_name,
            'snapshot_type': self.snapshot_type,
            'created_at': iso_kst(self.created_at) if self.created_at else None
        }

    def __repr__(self):
        return f'<DashboardSnapshot {self.name}>'


class ProjectAttachment(BaseModel):
    """
    과제 첨부파일 테이블
    - 과제에 첨부된 파일 정보 저장
    """
    __tablename__ = 'project_attachments'

    project_id = db.Column(db.String(100), nullable=False, index=True)  # 과제 ID (UUID 문자열)
    original_filename = db.Column(db.String(255), nullable=False)  # 원본 파일명
    stored_filename = db.Column(db.String(255), nullable=False)  # 저장된 파일명 (UUID)
    file_size = db.Column(db.Integer, default=0)  # 파일 크기 (bytes)
    mime_type = db.Column(db.String(100))  # MIME 타입

    # 업로더 정보
    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    uploaded_by_name = db.Column(db.String(100))

    # Relationships
    uploader = db.relationship('User', foreign_keys=[uploaded_by])

    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'original_filename': self.original_filename,
            'stored_filename': self.stored_filename,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'uploaded_by': self.uploaded_by,
            'uploaded_by_name': self.uploaded_by_name,
            'created_at': iso_kst(self.created_at) if self.created_at else None
        }

    @staticmethod
    def generate_stored_filename(original_filename):
        """Generate a unique filename for storage."""
        import os
        ext = os.path.splitext(original_filename)[1]
        return f"{uuid.uuid4().hex}{ext}"

    def __repr__(self):
        return f'<ProjectAttachment {self.original_filename}>'


class ReportImage(BaseModel):
    """
    과제 보고서 이미지 (Phase 1-2)

    배경
        보고서 이미지가 과제 JSON 안에 base64 data URI 로 인라인 저장되고 있었다.
        운영 실측(2026-07-28): 23개 과제 / 33.9 MB / 저장 payload 의 94.4%.
        과제 하나만 수정해도 이 33.9 MB 가 통째로 왕복했다.

    구조
        파일 실체는 uploads/digital-twin-dashboard/ 에 두고(첨부파일과 동일 폴더),
        과제 JSON 에는 imageId 참조만 남긴다.

    주의
        project_id 는 과제 uuid 문자열이다. 현재 과제가 JSON 배열 안에 있어 FK 를 걸 수 없다.
        Phase 2 정규화 이후 dt2_projects.uuid 로 FK 승격 예정.
    """
    __tablename__ = 'dt_report_images'

    project_id = db.Column(db.String(100), nullable=False, index=True)   # 과제 uuid
    slot = db.Column(db.String(50), nullable=False, index=True)          # '이미지_좌측' 등 원본 키 이름
    position = db.Column(db.Integer, default=0)                          # 슬롯 내 순서

    original_filename = db.Column(db.String(255))                        # 원본 파일명 (없을 수 있음)
    stored_filename = db.Column(db.String(255), nullable=False)          # 저장 파일명 (UUID)
    caption = db.Column(db.Text)                                         # 이미지 설명
    mime_type = db.Column(db.String(100))
    file_size = db.Column(db.Integer, default=0)                         # bytes
    sha256 = db.Column(db.String(64), index=True)                        # 무결성 검증 + 중복 제거용

    uploaded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    uploaded_by_name = db.Column(db.String(100))

    # 이관 출처 추적: 'extract'(기존 base64 에서 추출) / 'upload'(신규 업로드)
    source = db.Column(db.String(20), default='upload')

    uploader = db.relationship('User', foreign_keys=[uploaded_by])

    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'slot': self.slot,
            'position': self.position,
            'original_filename': self.original_filename,
            'stored_filename': self.stored_filename,
            'caption': self.caption,
            'mime_type': self.mime_type,
            'file_size': self.file_size,
            'sha256': self.sha256,
            'uploaded_by_name': self.uploaded_by_name,
            'source': self.source,
            'created_at': iso_kst(self.created_at) if self.created_at else None,
        }

    @staticmethod
    def generate_stored_filename(mime_type=None, original_filename=None):
        """저장용 고유 파일명 생성."""
        ext = ''
        if original_filename:
            ext = os.path.splitext(original_filename)[1]
        if not ext and mime_type:
            ext = {
                'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png',
                'image/gif': '.gif', 'image/webp': '.webp', 'image/bmp': '.bmp',
            }.get(mime_type.lower(), '')
        return f"img_{uuid.uuid4().hex}{ext}"

    def __repr__(self):
        return f'<ReportImage {self.id} {self.slot} of {self.project_id}>'


class DashboardActivityLog(BaseModel):
    """
    대시보드 활동 로그 테이블
    - 모든 수정 사항 기록
    """
    __tablename__ = 'dashboard_activity_logs'

    # 활동 정보
    action = db.Column(db.String(50), nullable=False)  # CREATE, UPDATE, DELETE, UPLOAD, DOWNLOAD
    target_type = db.Column(db.String(50), nullable=False)  # PROJECT, PERFORMANCE, SETTINGS, DATA
    target_id = db.Column(db.String(100))  # 대상 ID
    target_name = db.Column(db.String(200))  # 대상 이름

    # 변경 상세
    changes = db.Column(JSON)  # 변경 내용 상세 (before/after)
    summary = db.Column(db.Text)  # 변경 요약 텍스트

    # 수행자 정보
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    user_name = db.Column(db.String(100))

    # 데이터 버전 (어떤 버전에서 발생한 변경인지)
    data_version = db.Column(db.Integer)

    # 출처 (local: 로컬, server: 서버 동기화)
    source = db.Column(db.String(20), default='local')

    # Relationships
    user = db.relationship('User', foreign_keys=[user_id])

    def to_dict(self):
        return {
            'id': self.id,
            'action': self.action,
            'target_type': self.target_type,
            'target_id': self.target_id,
            'target_name': self.target_name,
            'changes': self.changes,
            'summary': self.summary,
            'user_id': self.user_id,
            'user_name': self.user_name,
            'data_version': self.data_version,
            'source': self.source,
            'created_at': iso_kst(self.created_at) if self.created_at else None
        }

    def __repr__(self):
        return f'<DashboardActivityLog {self.action} {self.target_type}>'


# ============================================
# KPI 대시보드 관련 모델
# ============================================

class KPICategory(BaseModel):
    """KPI 대분류 카테고리 테이블"""
    __tablename__ = 'kpi_categories'

    name = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(20), default='#3b82f6')
    bg_color = db.Column(db.String(20), default='#eff6ff')
    hover_color = db.Column(db.String(20), default='#dbeafe')
    order = db.Column(db.Integer, default=0)
    year = db.Column(db.Integer, nullable=False, index=True)  # 연도별 관리
    is_active = db.Column(db.Boolean, default=True)

    # Relationships
    kpis = db.relationship('KPI', backref='category_ref', lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'color': self.color,
            'bgColor': self.bg_color,
            'hoverColor': self.hover_color,
            'order': self.order,
            'year': self.year,
            'is_active': self.is_active,
            'created_at': iso_kst(self.created_at) if self.created_at else None,
            'updated_at': iso_kst(self.updated_at) if self.updated_at else None
        }

    def __repr__(self):
        return f'<KPICategory {self.name} ({self.year})>'


class KPI(BaseModel):
    """KPI 테이블"""
    __tablename__ = 'kpis'

    name = db.Column(db.String(200), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('kpi_categories.id'), nullable=False, index=True)
    unit = db.Column(db.String(50), nullable=False)  # 단위 (억원, %, 건, 대 등)
    kpi_type = db.Column(db.String(20), nullable=False, default='monthly')  # 'monthly' or 'annual'
    target_value = db.Column(db.Float, nullable=False)  # 연간 목표
    actual_value = db.Column(db.Float, default=0)  # 연간 실적 (연간 집계용)
    monthly_values = db.Column(JSON, default=lambda: [''] * 12)  # 월별 실적 (12개월)
    direction = db.Column(db.String(20), default='higher')  # 'higher' = 높을수록 좋음, 'lower' = 낮을수록 좋음
    green_threshold = db.Column(db.Integer, default=90)  # 달성 기준 (%)
    yellow_threshold = db.Column(db.Integer, default=70)  # 주의 기준 (%)
    year = db.Column(db.Integer, nullable=False, index=True)  # 연도
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': str(self.id),
            'name': self.name,
            'category': str(self.category_id),
            'unit': self.unit,
            'type': self.kpi_type,
            'targetValue': self.target_value,
            'actualValue': self.actual_value,
            'monthlyValues': self.monthly_values or [''] * 12,
            'direction': self.direction,
            'greenThreshold': self.green_threshold,
            'yellowThreshold': self.yellow_threshold,
            'year': self.year,
            'order': self.order,
            'is_active': self.is_active,
            'created_at': iso_kst(self.created_at) if self.created_at else None,
            'updated_at': iso_kst(self.updated_at) if self.updated_at else None
        }

    def __repr__(self):
        return f'<KPI {self.name} ({self.year})>'


# ============================================
# KPI 대시보드 카드 모델 (새 KPI 대시보드용)
# ============================================

class KPIDashboardCard(BaseModel):
    """KPI 대시보드 카드 - 사용자가 추가한 KPI 카드 저장"""
    __tablename__ = 'kpi_dashboard_cards'

    name = db.Column(db.String(200), nullable=False)
    division = db.Column(db.String(50), nullable=False, default='전체')
    category = db.Column(db.String(100), nullable=False, default='전체')
    subcategories = db.Column(JSON, nullable=False, default=list)
    logic = db.Column(db.String(20), nullable=False, default='합계')  # '합계' or '평균'
    selected_perf_keys = db.Column(JSON, nullable=False, default=list)
    year = db.Column(db.Integer, nullable=False, index=True)
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    treemap_enabled = db.Column(db.Boolean, nullable=False, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'division': self.division,
            'category': self.category,
            'subcategories': self.subcategories or [],
            'logic': self.logic,
            'selectedPerfKeys': self.selected_perf_keys or [],
            'year': self.year,
            'order': self.order,
            'treemapEnabled': self.treemap_enabled if self.treemap_enabled is not None else True,
            'created_at': iso_kst(self.created_at) if self.created_at else None,
            'updated_at': iso_kst(self.updated_at) if self.updated_at else None,
        }

    def __repr__(self):
        return f'<KPIDashboardCard {self.name} ({self.year})>'
