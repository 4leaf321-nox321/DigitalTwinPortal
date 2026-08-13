"""
Meeting Management Models
협의체/회의체/보고 관리를 위한 모델
"""
import os
from datetime import datetime
import uuid
from app.extensions import db
from app.shared.models import BaseModel
from app.shared.timeutil import iso_kst

# Upload folder path
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'uploads', 'meeting-management')


class MeetingGroup(BaseModel):
    """
    회의체 그룹 모델
    - 협의체, 회의체, 보고 등의 상위 그룹
    """
    __tablename__ = 'meeting_groups'

    name = db.Column(db.String(200), nullable=False)  # 회의체 이름
    meeting_type = db.Column(db.String(50), nullable=False)  # 유형: council(협의체), meeting(회의체), report(보고)
    cycle = db.Column(db.String(50))  # 주기: weekly, biweekly, monthly, quarterly, irregular
    description = db.Column(db.Text)  # 설명
    participants = db.Column(db.Text)  # 참여자/부서 (콤마로 구분)
    color = db.Column(db.String(20), default='#3b82f6')  # 표시 색상
    is_active = db.Column(db.Boolean, default=True)
    order = db.Column(db.Integer, default=0)  # 정렬 순서

    # Relationships
    sessions = db.relationship('MeetingSession', backref='group', lazy='dynamic', cascade='all, delete-orphan',
                               order_by='desc(MeetingSession.session_date)')

    def to_dict(self, include_sessions=False):
        result = {
            'id': self.id,
            'name': self.name,
            'meetingType': self.meeting_type,
            'cycle': self.cycle,
            'description': self.description,
            'participants': self.participants,
            'color': self.color,
            'isActive': self.is_active,
            'order': self.order,
            'sessionCount': self.sessions.count(),
            'latestSession': None,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }

        # 최신 회차 정보
        latest = self.sessions.first()
        if latest:
            result['latestSession'] = {
                'id': latest.id,
                'sessionNumber': latest.session_number,
                'sessionDate': iso_kst(latest.session_date) if latest.session_date else None,
            }

        if include_sessions:
            result['sessions'] = [session.to_dict() for session in self.sessions]

        return result


class MeetingSession(BaseModel):
    """
    회의 회차 모델
    - 각 회의체의 개별 회차
    - 연도별로 회차 번호 관리 (매년 1회차부터 시작)
    """
    __tablename__ = 'meeting_sessions'

    group_id = db.Column(db.Integer, db.ForeignKey('meeting_groups.id'), nullable=False)
    year = db.Column(db.Integer, nullable=False)  # 연도
    session_number = db.Column(db.Integer, nullable=False)  # 회차 번호 (연도별)
    session_date = db.Column(db.Date, nullable=False)  # 회의 일시
    session_time = db.Column(db.String(50))  # 시간 (예: "14:00~16:00")
    location = db.Column(db.String(200))  # 장소
    summary = db.Column(db.Text)  # 회의 결과 요약

    # Relationships
    agenda_items = db.relationship('MeetingAgendaItem', backref='session', lazy='dynamic',
                                   cascade='all, delete-orphan', order_by='MeetingAgendaItem.order')
    attachments = db.relationship('MeetingAttachment', backref='session', lazy='dynamic',
                                  cascade='all, delete-orphan')

    __table_args__ = (
        db.UniqueConstraint('group_id', 'year', 'session_number', name='unique_group_year_session'),
    )

    def to_dict(self, include_items=True):
        result = {
            'id': self.id,
            'groupId': self.group_id,
            'year': self.year,
            'sessionNumber': self.session_number,
            'sessionDate': iso_kst(self.session_date) if self.session_date else None,
            'sessionTime': self.session_time,
            'location': self.location,
            'summary': self.summary,
            'agendaCount': self.agenda_items.count(),
            'attachmentCount': self.attachments.count(),
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }

        if include_items:
            result['agendaItems'] = [item.to_dict() for item in self.agenda_items]
            result['attachments'] = [att.to_dict() for att in self.attachments]

        return result


class MeetingAgendaItem(BaseModel):
    """
    회의 안건 모델
    - 각 회차의 안건 항목
    """
    __tablename__ = 'meeting_agenda_items'

    session_id = db.Column(db.Integer, db.ForeignKey('meeting_sessions.id'), nullable=False)
    title = db.Column(db.String(500), nullable=False)  # 안건 제목
    content = db.Column(db.Text)  # 안건 내용
    order = db.Column(db.Integer, default=0)  # 정렬 순서

    def to_dict(self):
        return {
            'id': self.id,
            'sessionId': self.session_id,
            'title': self.title,
            'content': self.content or '',
            'order': self.order,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
        }


class MeetingAttachment(BaseModel):
    """
    회의 첨부파일 모델
    - 회차에 첨부된 파일 (회의록, 발표자료 등)
    """
    __tablename__ = 'meeting_attachments'

    session_id = db.Column(db.Integer, db.ForeignKey('meeting_sessions.id'), nullable=False)
    original_filename = db.Column(db.String(500), nullable=False)
    stored_filename = db.Column(db.String(500), nullable=False)
    file_size = db.Column(db.Integer)
    mime_type = db.Column(db.String(100))
    file_type = db.Column(db.String(50))  # 파일 분류: minutes(회의록), presentation(발표자료), etc(기타)

    def to_dict(self):
        return {
            'id': self.id,
            'sessionId': self.session_id,
            'originalFilename': self.original_filename,
            'storedFilename': self.stored_filename,
            'fileSize': self.file_size,
            'mimeType': self.mime_type,
            'fileType': self.file_type,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
        }

    @staticmethod
    def generate_stored_filename(original_filename):
        """Generate a unique filename for storage."""
        ext = os.path.splitext(original_filename)[1]
        return f"{uuid.uuid4().hex}{ext}"


# ============== Report Plan Models ==============

class ReportPlanRound(BaseModel):
    """
    보고 계획 회차 모델
    - 탭(ceo/cfo)별 회차 관리
    """
    __tablename__ = 'report_plan_rounds'

    tab_key = db.Column(db.String(50), nullable=False)  # 'ceo' or 'cfo'
    round_number = db.Column(db.Integer, nullable=False)
    schedule = db.Column(db.String(20))  # 날짜 (YYYY-MM-DD)
    time_start = db.Column(db.String(10))  # 시작 시간 (HH:MM)
    time_end = db.Column(db.String(10))  # 종료 시간 (HH:MM)
    status = db.Column(db.String(20), default='미정')  # 완료, 안건 확정, 계획, 미정

    # Relationships
    items = db.relationship('ReportPlanItem', backref='round', lazy='dynamic',
                            cascade='all, delete-orphan', order_by='ReportPlanItem.order')

    def to_dict(self):
        return {
            'id': self.id,
            'tabKey': self.tab_key,
            'roundNumber': self.round_number,
            'schedule': self.schedule or '',
            'timeStart': self.time_start or '',
            'timeEnd': self.time_end or '',
            'status': self.status or '미정',
            'items': [item.to_dict() for item in self.items],
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }


class ReportPlanItem(BaseModel):
    """
    보고 계획 항목 모델
    - 각 회차 내 개별 행 (구분, Agenda, 주요 내용, 담당 사업부)
    """
    __tablename__ = 'report_plan_items'

    round_id = db.Column(db.Integer, db.ForeignKey('report_plan_rounds.id'), nullable=False)
    category = db.Column(db.Text, default='')  # 구분
    divisions = db.Column(db.Text, default='')  # 담당 사업부 (콤마 구분 id)
    agenda = db.Column(db.Text, default='')  # Agenda 구성
    content = db.Column(db.Text, default='')  # 주요 내용
    order = db.Column(db.Integer, default=0)  # 정렬 순서
    category_merged = db.Column(db.Boolean, default=True)  # 구분 셀 병합 여부
    linked_id = db.Column(db.String(100), nullable=True)  # 협의체-주간회의 간 연결 ID

    def to_dict(self):
        result = {
            'id': self.id,
            'roundId': self.round_id,
            'category': self.category or '',
            'divisions': self.divisions.split(',') if self.divisions else [],
            'agenda': self.agenda or '',
            'content': self.content or '',
            'order': self.order,
            'categoryMerged': self.category_merged if self.category_merged is not None else True,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
        }
        if self.linked_id:
            result['linkedId'] = self.linked_id
        return result


class ReportPlanMeta(db.Model):
    """
    보고 계획 탭별 메타 정보 (낙관적 잠금용)
    """
    __tablename__ = 'report_plan_meta'

    tab_key = db.Column(db.String(50), primary_key=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            'tabKey': self.tab_key,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }


class ReportPlanComment(BaseModel):
    """
    보고 계획 의견/코멘트 모델
    - 탭(ceo/cfo)별 독립적인 의견 스레드
    """
    __tablename__ = 'report_plan_comments'

    tab_key = db.Column(db.String(50), nullable=False)  # 'ceo' or 'cfo'
    author = db.Column(db.String(100), nullable=False)  # 작성자
    content = db.Column(db.Text, nullable=False)  # 의견 내용
    parent_id = db.Column(db.Integer, db.ForeignKey('report_plan_comments.id'), nullable=True)  # 답글 대상
    status = db.Column(db.String(20), default='')  # '' (미정), '채택', '보류'

    # Self-referential relationship for replies
    replies = db.relationship('ReportPlanComment', backref=db.backref('parent', remote_side='ReportPlanComment.id'),
                               lazy='dynamic', cascade='all, delete-orphan')

    def to_dict(self, include_replies=True):
        result = {
            'id': self.id,
            'tabKey': self.tab_key,
            'author': self.author,
            'content': self.content,
            'parentId': self.parent_id,
            'status': self.status or '',
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }
        if include_replies and not self.parent_id:
            result['replies'] = [r.to_dict(include_replies=False) for r in
                                  self.replies.order_by(ReportPlanComment.created_at)]
        return result


class ReportPlanNotice(BaseModel):
    """
    보고계획 공지 모델
    - scope: 'all'(전체), 'ceo'(대표이사 협의체), 'cfo'(CFO 주간회의)
    """
    __tablename__ = 'report_plan_notices'

    title = db.Column(db.String(300), nullable=False)
    content = db.Column(db.Text, nullable=False)
    scope = db.Column(db.String(20), nullable=False, default='all')  # all, ceo, cfo
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    author_name = db.Column(db.String(100), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    author = db.relationship('User', backref=db.backref('report_plan_notices', lazy='dynamic'))

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'scope': self.scope,
            'authorId': self.author_id,
            'authorName': self.author_name,
            'isActive': self.is_active,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }
