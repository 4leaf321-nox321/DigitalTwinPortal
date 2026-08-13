"""
Authentication Services
"""
import re
from datetime import datetime, timedelta
from flask import current_app
from flask_jwt_extended import create_access_token, create_refresh_token, get_jwt_identity
from app.extensions import db
from app.modules.auth.models import User, RefreshToken


class AuthService:
    """Service for authentication operations."""

    @staticmethod
    def validate_email(email):
        """Validate email format."""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None

    @staticmethod
    def validate_password(password):
        """
        Validate password strength.
        Returns (is_valid, error_message)
        """
        if len(password) < 8:
            return False, '비밀번호는 최소 8자 이상이어야 합니다.'
        if not re.search(r'[A-Za-z]', password):
            return False, '비밀번호는 영문자를 포함해야 합니다.'
        if not re.search(r'\d', password):
            return False, '비밀번호는 숫자를 포함해야 합니다.'
        return True, None

    @staticmethod
    def register(email, password, name, department=None, position=None, phone=None):
        """
        Register a new user.
        Returns (user, error_message)
        """
        # Validate email format
        if not AuthService.validate_email(email):
            return None, '유효하지 않은 이메일 형식입니다.'

        # Check if email already exists
        if User.query.filter_by(email=email.lower()).first():
            return None, '이미 등록된 이메일입니다.'

        # Validate password
        is_valid, error_msg = AuthService.validate_password(password)
        if not is_valid:
            return None, error_msg

        # Create user
        user = User(
            email=email.lower(),
            name=name,
            department=department,
            position=position,
            phone=phone
        )
        user.set_password(password)

        db.session.add(user)
        db.session.commit()

        return user, None

    @staticmethod
    def login(email, password, user_agent=None, ip_address=None):
        """
        Authenticate user and return tokens.
        Returns (tokens_dict, error_message)
        """
        # Find user
        user = User.query.filter_by(email=email.lower()).first()

        if not user:
            return None, '이메일 또는 비밀번호가 올바르지 않습니다.'

        if not user.is_active:
            return None, '비활성화된 계정입니다. 관리자에게 문의하세요.'

        if not user.check_password(password):
            return None, '이메일 또는 비밀번호가 올바르지 않습니다.'

        # Update last login
        user.update_last_login()

        # Create tokens (identity must be string for Flask-JWT-Extended)
        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))

        # Store refresh token in database
        expires_at = datetime.utcnow() + current_app.config['JWT_REFRESH_TOKEN_EXPIRES']
        token_record = RefreshToken(
            user_id=user.id,
            token=refresh_token,
            expires_at=expires_at,
            user_agent=user_agent,
            ip_address=ip_address
        )
        db.session.add(token_record)
        db.session.commit()

        return {
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user.to_dict()
        }, None

    @staticmethod
    def refresh_access_token(refresh_token_str):
        """
        Refresh access token using refresh token.
        Returns (new_access_token, error_message)
        """
        # Find refresh token in database
        token_record = RefreshToken.query.filter_by(token=refresh_token_str).first()

        if not token_record:
            return None, '유효하지 않은 리프레시 토큰입니다.'

        if not token_record.is_valid():
            return None, '만료되었거나 취소된 토큰입니다.'

        # Create new access token (identity must be string)
        access_token = create_access_token(identity=str(token_record.user_id))

        return {'access_token': access_token}, None

    @staticmethod
    def logout(refresh_token_str):
        """Revoke refresh token (logout)."""
        token_record = RefreshToken.query.filter_by(token=refresh_token_str).first()
        if token_record:
            token_record.revoke()
            return True
        return False

    @staticmethod
    def logout_all(user_id):
        """Revoke all refresh tokens for a user (logout from all devices)."""
        RefreshToken.query.filter_by(user_id=user_id, is_revoked=False).update({'is_revoked': True})
        db.session.commit()


class UserService:
    """Service for user management operations."""

    @staticmethod
    def get_by_id(user_id):
        """Get user by ID."""
        return User.query.get(user_id)

    @staticmethod
    def get_by_email(email):
        """Get user by email."""
        return User.query.filter_by(email=email.lower()).first()

    @staticmethod
    def get_all(include_inactive=False):
        """Get all users."""
        query = User.query
        if not include_inactive:
            query = query.filter_by(is_active=True)
        return query.order_by(User.created_at.desc()).all()

    @staticmethod
    def update_profile(user_id, **kwargs):
        """Update user profile."""
        user = User.query.get(user_id)
        if not user:
            return None, '사용자를 찾을 수 없습니다.'

        # Fields that can be updated
        allowed_fields = ['name', 'department', 'position', 'phone', 'profile_image']

        for field in allowed_fields:
            if field in kwargs:
                setattr(user, field, kwargs[field])

        db.session.commit()
        return user, None

    @staticmethod
    def change_password(user_id, current_password, new_password):
        """Change user password."""
        user = User.query.get(user_id)
        if not user:
            return None, '사용자를 찾을 수 없습니다.'

        if not user.check_password(current_password):
            return None, '현재 비밀번호가 올바르지 않습니다.'

        # Validate new password
        is_valid, error_msg = AuthService.validate_password(new_password)
        if not is_valid:
            return None, error_msg

        user.set_password(new_password)
        db.session.commit()

        # Revoke all refresh tokens (logout from all devices)
        AuthService.logout_all(user_id)

        return user, None

    @staticmethod
    def deactivate(user_id):
        """Deactivate a user account."""
        user = User.query.get(user_id)
        if user:
            user.is_active = False
            db.session.commit()
            AuthService.logout_all(user_id)
            return True
        return False

    @staticmethod
    def activate(user_id):
        """Activate a user account."""
        user = User.query.get(user_id)
        if user:
            user.is_active = True
            db.session.commit()
            return True
        return False

    @staticmethod
    def update_role(user_id, new_role):
        """Update user role."""
        from app.modules.auth.models import UserRole

        user = User.query.get(user_id)
        if not user:
            return None, '사용자를 찾을 수 없습니다.'

        if new_role not in UserRole.ALL_ROLES:
            return None, '유효하지 않은 권한입니다.'

        user.role = new_role
        # 하위 호환성을 위해 is_admin도 업데이트
        user.is_admin = (new_role == UserRole.ADMIN)
        db.session.commit()

        return user, None
