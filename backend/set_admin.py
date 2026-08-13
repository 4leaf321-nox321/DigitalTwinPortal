"""
Set user as admin
Usage: python set_admin.py <email>
"""
import sys
import os

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.extensions import db
from app.modules.auth.models import User, UserRole

def set_admin(email):
    """Set user as admin by email."""
    app = create_app()

    with app.app_context():
        user = User.query.filter_by(email=email.lower()).first()

        if not user:
            print(f"Error: User with email '{email}' not found.")
            return False

        user.role = UserRole.ADMIN
        user.is_admin = True
        db.session.commit()

        print(f"Success: User '{user.name}' ({user.email}) is now an Admin.")
        print(f"  - Role: {user.role}")
        print(f"  - is_admin: {user.is_admin}")
        return True

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python set_admin.py <email>")
        print("Example: python set_admin.py yjtwin.park@samsung.com")
        sys.exit(1)

    email = sys.argv[1]
    success = set_admin(email)
    sys.exit(0 if success else 1)
