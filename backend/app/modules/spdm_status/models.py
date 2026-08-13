"""
SPDM Status Models
SPDM 현황 관리를 위한 모델
"""
import os
import uuid
from sqlalchemy.dialects.postgresql import JSON
from app.extensions import db
from app.shared.models import BaseModel
from app.shared.timeutil import iso_kst

# Upload folder path
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'uploads', 'spdm')


class SpdmGroup(BaseModel):
    """
    이슈 그룹 모델
    - 이슈를 분류하는 그룹
    """
    __tablename__ = 'spdm_groups'

    name = db.Column(db.String(200), nullable=False)  # 그룹 이름
    color = db.Column(db.String(20), default='#3b82f6')  # 표시 색상
    description = db.Column(db.Text)  # 설명
    order = db.Column(db.Integer, default=0)  # 정렬 순서

    # Relationships
    issues = db.relationship('SpdmIssue', backref='group', lazy='dynamic',
                            cascade='all, delete-orphan')

    def to_dict(self, include_issues=False):
        result = {
            'id': self.id,
            'name': self.name,
            'color': self.color,
            'description': self.description,
            'order': self.order,
            'issueCount': self.issues.count(),
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }

        if include_issues:
            result['issues'] = [issue.to_dict() for issue in self.issues]

        return result


class SpdmIssue(BaseModel):
    """
    이슈 모델
    - SPDM 관련 이슈
    """
    __tablename__ = 'spdm_issues'

    group_id = db.Column(db.Integer, db.ForeignKey('spdm_groups.id'), nullable=False)
    title = db.Column(db.String(500), nullable=False)  # 이슈 제목
    description = db.Column(db.Text)  # 이슈 내용 (HTML)
    status = db.Column(db.String(50), default='registered')  # 상태: registered, in-progress, completed, on-hold
    assignee = db.Column(db.String(100), nullable=False)  # 개설자
    due_date = db.Column(db.Date)  # 목표 일정
    departments = db.Column(db.Text)  # 관련 사업부 ID (콤마로 구분)

    # Relationships
    histories = db.relationship('SpdmIssueHistory', backref='issue', lazy='dynamic',
                               cascade='all, delete-orphan', order_by='desc(SpdmIssueHistory.created_at)')
    attachments = db.relationship('SpdmIssueAttachment', backref='issue', lazy='dynamic',
                                  cascade='all, delete-orphan')

    def to_dict(self, include_history=False):
        result = {
            'id': self.id,
            'groupId': self.group_id,
            'title': self.title,
            'description': self.description,
            'status': self.status,
            'assignee': self.assignee,
            'dueDate': iso_kst(self.due_date) if self.due_date else None,
            'departments': self.departments.split(',') if self.departments else [],
            'historyCount': self.histories.count(),
            'attachmentCount': self.attachments.count(),
            'attachments': [att.to_dict() for att in self.attachments],
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }

        if include_history:
            result['history'] = [h.to_dict() for h in self.histories]

        return result


class SpdmIssueHistory(BaseModel):
    """
    이슈 이력 모델
    - 이슈에 대한 댓글, 상태 변경 등의 이력
    """
    __tablename__ = 'spdm_issue_histories'

    issue_id = db.Column(db.Integer, db.ForeignKey('spdm_issues.id'), nullable=False)
    history_type = db.Column(db.String(50), nullable=False)  # 유형: created, status-change, comment
    content = db.Column(db.Text, nullable=False)  # 내용
    author = db.Column(db.String(100), nullable=False)  # 작성자
    department_id = db.Column(db.String(50))  # 사업부 ID
    attachment = db.Column(db.String(500))  # 첨부파일 이름 (있는 경우)

    def to_dict(self):
        return {
            'id': self.id,
            'issueId': self.issue_id,
            'type': self.history_type,
            'content': self.content,
            'author': self.author,
            'departmentId': self.department_id,
            'attachment': self.attachment,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
        }


class SpdmIssueAttachment(BaseModel):
    """
    이슈 첨부파일 모델
    """
    __tablename__ = 'spdm_issue_attachments'

    issue_id = db.Column(db.Integer, db.ForeignKey('spdm_issues.id'), nullable=False)
    original_filename = db.Column(db.String(500), nullable=False)
    stored_filename = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer)
    mime_type = db.Column(db.String(100))

    def to_dict(self):
        return {
            'id': self.id,
            'issueId': self.issue_id,
            'originalFilename': self.original_filename,
            'storedFilename': self.stored_filename,
            'fileSize': self.file_size,
            'mimeType': self.mime_type,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
        }

    @staticmethod
    def generate_stored_filename(original_filename):
        """Generate a unique filename for storage."""
        ext = os.path.splitext(original_filename)[1]
        return f"{uuid.uuid4().hex}{ext}"


# ============== Schedule Models ==============

class SpdmScheduleDepartment(BaseModel):
    """
    일정 사업부 모델
    - 일정 관리를 위한 사업부 정보
    """
    __tablename__ = 'spdm_schedule_departments'

    name = db.Column(db.String(200), nullable=False)  # 사업부 이름
    color = db.Column(db.String(20), default='#8b5cf6')  # 표시 색상
    order = db.Column(db.Integer, default=0)  # 정렬 순서

    # Relationships
    schedules = db.relationship('SpdmScheduleItem', backref='department', lazy='dynamic',
                               cascade='all, delete-orphan', order_by='SpdmScheduleItem.order')

    def to_dict(self, include_schedules=True):
        result = {
            'departmentId': str(self.id),
            'departmentName': self.name,
            'color': self.color,
            'order': self.order,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }

        if include_schedules:
            result['schedules'] = [s.to_dict() for s in self.schedules.order_by(SpdmScheduleItem.order)]

        return result


class SpdmScheduleItem(BaseModel):
    """
    일정 항목 모델
    - 각 개발 일정 (1차, 2차 등)
    """
    __tablename__ = 'spdm_schedule_items'

    department_id = db.Column(db.Integer, db.ForeignKey('spdm_schedule_departments.id'), nullable=False)
    phase = db.Column(db.String(50), nullable=False)  # 차수 (예: 1차, 2차)
    title = db.Column(db.String(500), nullable=False)  # 일정 제목
    start_date = db.Column(db.Date, nullable=False)  # 시작일
    end_date = db.Column(db.Date, nullable=False)  # 종료일
    status = db.Column(db.String(50), default='planned')  # 상태: planned, in_progress, completed, delayed
    order = db.Column(db.Integer, default=0)  # 정렬 순서
    contents = db.Column(db.Text)  # 내용 (JSON 형태로 저장)

    def to_dict(self):
        import json
        contents = []
        if self.contents:
            try:
                contents = json.loads(self.contents)
            except json.JSONDecodeError:
                contents = []

        return {
            'id': self.id,
            'departmentId': str(self.department_id),
            'phase': self.phase,
            'title': self.title,
            'startDate': iso_kst(self.start_date) if self.start_date else None,
            'endDate': iso_kst(self.end_date) if self.end_date else None,
            'status': self.status,
            'order': self.order,
            'contents': contents,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }


# ============== Module Status Models ==============

class SpdmModule(BaseModel):
    """
    SPDM 모듈 모델
    - 사업부별 SPDM 모듈과 스펙 트리 관리
    """
    __tablename__ = 'spdm_modules'

    name = db.Column(db.String(200), nullable=False)  # 모듈 이름
    division_id = db.Column(db.String(50), nullable=False)  # 사업부 ID
    categories = db.Column(JSON, default=list)  # 모듈 구분 (복수)
    system_type = db.Column(db.String(100))  # 구현 시스템
    is_linked = db.Column(db.Boolean, default=False)  # 연계 모듈 여부 (레거시, links에서 파생)
    link_system_from = db.Column(db.String(200))  # 연계 출발 시스템 (레거시)
    link_system_to = db.Column(db.String(200))  # 연계 도착 시스템 (레거시)
    link_method = db.Column(db.String(500))  # 연계 방식 (레거시)
    links = db.Column(JSON, default=list)  # 연계 모듈 목록 [{from, to, method}, ...]
    description = db.Column(db.Text)  # 설명
    specs = db.Column(JSON, nullable=False, default=list)  # SpecNode[] 트리
    order = db.Column(db.Integer, default=0)  # 정렬 순서

    def to_dict(self):
        # links 필드 우선, 없으면 레거시 필드에서 변환
        links = self.links or []
        if not links and self.is_linked and self.link_system_from:
            links = [{'from': self.link_system_from, 'to': self.link_system_to or '', 'method': self.link_method or ''}]

        return {
            'id': self.id,
            'name': self.name,
            'divisionId': self.division_id,
            'categories': self.categories or [],
            'systemType': self.system_type,
            'isLinked': len(links) > 0,
            'links': links,
            'description': self.description,
            'specs': self.specs or [],
            'order': self.order,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }


class SpdmSpecKeySuggestion(BaseModel):
    """
    스펙 키 자동완성 추천 모델
    - 사용된 스펙 키를 저장하여 자동완성 제공
    """
    __tablename__ = 'spdm_spec_key_suggestions'

    key = db.Column(db.String(200), nullable=False, unique=True)  # 스펙 키
    usage_count = db.Column(db.Integer, default=1)  # 사용 횟수
    category = db.Column(db.String(100))  # 카테고리

    def to_dict(self):
        return {
            'id': self.id,
            'key': self.key,
            'usageCount': self.usage_count,
            'category': self.category,
        }
