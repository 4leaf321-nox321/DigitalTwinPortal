"""
Authentication Models
"""
from datetime import datetime, timezone, timedelta
from app.extensions import db, bcrypt

_KST = timezone(timedelta(hours=9))
from app.shared.models import BaseModel
from app.shared.timeutil import iso_kst


# 권한 레벨 상수
class UserRole:
    ADMIN = 'admin'                    # 관리자 - 모든 권한
    MANAGER = 'manager'                # 매니저 - 관리 권한
    DT_OFFICE_MEMBER = 'dt_office'     # 디지털 트윈 사무국 멤버
    USER = 'user'                      # 사용자 - 일반 권한
    VIEWER = 'viewer'                  # 뷰어 - 읽기 전용

    ALL_ROLES = [ADMIN, MANAGER, DT_OFFICE_MEMBER, USER, VIEWER]

    @staticmethod
    def get_level(role):
        """권한 레벨 반환 (높을수록 높은 권한)"""
        levels = {
            UserRole.ADMIN: 100,
            UserRole.DT_OFFICE_MEMBER: 70,
            UserRole.MANAGER: 50,
            UserRole.USER: 20,
            UserRole.VIEWER: 10
        }
        return levels.get(role, 0)


class User(BaseModel):
    """User model for authentication."""
    __tablename__ = 'users'

    # Basic Info
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(100), nullable=False)

    # Profile
    department = db.Column(db.String(100))  # 부서
    position = db.Column(db.String(100))    # 직책
    phone = db.Column(db.String(20))
    profile_image = db.Column(db.String(500))

    # Status & Role
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    role = db.Column(db.String(20), default=UserRole.USER, server_default='user', nullable=False)  # admin, manager, user, viewer
    is_admin = db.Column(db.Boolean, default=False, nullable=False)  # 하위 호환성 유지

    # Timestamps
    last_login_at = db.Column(db.DateTime)
    password_changed_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, password):
        """Hash and set the password."""
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')
        self.password_changed_at = datetime.utcnow()

    def check_password(self, password):
        """Check if the provided password matches."""
        return bcrypt.check_password_hash(self.password_hash, password)

    def update_last_login(self):
        """Update last login timestamp."""
        self.last_login_at = datetime.utcnow()
        db.session.commit()

    def has_role(self, role):
        """Check if user has specific role."""
        return self.role == role

    def has_permission(self, required_role):
        """Check if user has permission level >= required role."""
        return UserRole.get_level(self.role) >= UserRole.get_level(required_role)

    def is_admin_user(self):
        """Check if user is admin."""
        return self.role == UserRole.ADMIN

    def is_manager_or_above(self):
        """Check if user is manager or admin."""
        return self.role in [UserRole.ADMIN, UserRole.MANAGER]

    def to_dict(self, include_sensitive=False):
        """Convert user to dictionary."""
        data = {
            'id': self.id,
            'email': self.email,
            'name': self.name,
            'department': self.department,
            'position': self.position,
            'phone': self.phone,
            'profile_image': self.profile_image,
            'is_active': self.is_active,
            'is_admin': self.is_admin or self.role == UserRole.ADMIN,
            'role': self.role,
            'created_at': iso_kst(self.created_at) if self.created_at else None,
            'updated_at': iso_kst(self.updated_at) if self.updated_at else None,
            'last_login_at': iso_kst(self.last_login_at) if self.last_login_at else None
        }

        if include_sensitive:
            data['password_changed_at'] = iso_kst(self.password_changed_at) if self.password_changed_at else None

        return data

    def __repr__(self):
        return f'<User {self.email}>'


class RefreshToken(BaseModel):
    """Refresh Token model for JWT refresh."""
    __tablename__ = 'refresh_tokens'

    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.String(500), unique=True, nullable=False, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_revoked = db.Column(db.Boolean, default=False, nullable=False)

    # Device/Client info (optional)
    user_agent = db.Column(db.String(500))
    ip_address = db.Column(db.String(50))

    # Relationship - cascade delete when user is deleted
    user = db.relationship('User', backref=db.backref('refresh_tokens', lazy='dynamic', cascade='all, delete-orphan'))

    def is_valid(self):
        """Check if token is valid (not expired and not revoked)."""
        return not self.is_revoked and self.expires_at > datetime.utcnow()

    def revoke(self):
        """Revoke this token."""
        self.is_revoked = True
        db.session.commit()


class PersonalAccessToken(BaseModel):
    """
    개인 액세스 토큰 — MCP 등 **외부 클라이언트**가 쓰는 장기 토큰.

    왜 JWT 를 안 쓰나
        MCP 등록은 헤더에 토큰을 **박아넣는** 방식이라(`claude mcp add --header ...`)
        갱신이 안 된다. 그런데 JWT 액세스 토큰은 **12시간**이면 만료된다(config).
        게다가 JWT 는 stateless 라 **발급한 것을 되돌릴 방법이 없다** —
        유출되면 `JWT_SECRET_KEY` 를 갈아야 하고 그러면 전원 재로그인이다.

        그래서 GitHub PAT 과 같은 방식을 쓴다: 랜덤 문자열을 발급하고 **DB 에는 해시만**
        둔다. 행을 지우면 **즉시 무효**다.

    ⚠️ **평문은 발급 응답에서 딱 한 번만** 내보낸다. 여기 저장하지 않는다 —
       DB 가 새도 토큰이 새지 않아야 한다.
    """
    __tablename__ = 'personal_access_tokens'

    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)      # 사람이 알아볼 이름
    token_prefix = db.Column(db.String(16), nullable=False)   # 표시용 (dtp_ + 앞 8자)
    token_hash = db.Column(db.String(64), unique=True, nullable=False, index=True)

    expires_at = db.Column(db.DateTime)                   # None 이면 무기한
    revoked_at = db.Column(db.DateTime)
    last_used_at = db.Column(db.DateTime)

    user = db.relationship('User', foreign_keys=[user_id])

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'tokenPrefix': self.token_prefix,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'expiresAt': iso_kst(self.expires_at) if self.expires_at else None,
            'lastUsedAt': iso_kst(self.last_used_at) if self.last_used_at else None,
        }

    def __repr__(self):
        return f'<PersonalAccessToken {self.token_prefix}… user={self.user_id}>'


class Notice(BaseModel):
    """공지사항 모델"""
    __tablename__ = 'notices'

    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    priority = db.Column(db.Integer, default=0)  # 높을수록 상위 노출

    # 작성자 정보
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    author = db.relationship('User', backref=db.backref('notices', lazy='dynamic'))

    def to_dict(self, include_content=True):
        """Convert notice to dictionary."""
        data = {
            'id': self.id,
            'title': self.title,
            'is_active': self.is_active,
            'priority': self.priority,
            'author_id': self.author_id,
            'author_name': self.author.name if self.author else None,
            'created_at': iso_kst(self.created_at) if self.created_at else None,
            'updated_at': iso_kst(self.updated_at) if self.updated_at else None
        }
        if include_content:
            data['content'] = self.content
        return data

    def __repr__(self):
        return f'<Notice {self.title}>'


class AccessLog(BaseModel):
    """사용자 접속 이력 모델"""
    __tablename__ = 'access_logs'

    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    user_email = db.Column(db.String(255), nullable=False)
    user_name = db.Column(db.String(100), nullable=False)
    action = db.Column(db.String(50), nullable=False)  # LOGIN, LOGOUT, MODULE_ACCESS
    module = db.Column(db.String(100))  # 접근한 모듈 경로
    module_name = db.Column(db.String(100))  # 모듈 표시명
    ip_address = db.Column(db.String(50))
    user_agent = db.Column(db.String(500))

    user = db.relationship('User', backref=db.backref('access_logs', lazy='dynamic'))

    def _to_kst(self, dt):
        """UTC naive datetime → KST ISO 문자열 (규칙은 shared/timeutil 한 곳에)"""
        return iso_kst(dt)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_email': self.user_email,
            'user_name': self.user_name,
            'action': self.action,
            'module': self.module,
            'module_name': self.module_name,
            'ip_address': self.ip_address,
            'user_agent': self.user_agent,
            'created_at': self._to_kst(self.created_at),
        }

    def __repr__(self):
        return f'<AccessLog {self.user_email} {self.action}>'
