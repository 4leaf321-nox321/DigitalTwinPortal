"""
Base Model and Common Models
"""
from datetime import datetime
from app.extensions import db
from app.shared.timeutil import iso_kst


class BaseModel(db.Model):
    """Base model with common fields."""
    __abstract__ = True

    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        """
        Convert model to dictionary.

        시각은 **KST 오프셋을 붙여** 내보낸다(`iso_kst`). 예전에는 그냥
        `.isoformat()` 이라 오프셋이 없었고, 화면(JS)이 그걸 로컬로 읽어
        **9시간 이르게** 표시했다. 자세한 내용은 app/shared/timeutil.py.
        """
        result = {}
        for column in self.__table__.columns:
            value = getattr(self, column.name)
            if isinstance(value, datetime):
                value = iso_kst(value)
            result[column.name] = value
        return result

    def update(self, **kwargs):
        """Update model fields."""
        for key, value in kwargs.items():
            if hasattr(self, key):
                setattr(self, key, value)
        return self

    @classmethod
    def create(cls, **kwargs):
        """Create and save a new instance."""
        instance = cls(**kwargs)
        db.session.add(instance)
        db.session.commit()
        return instance

    def save(self):
        """Save the current instance."""
        db.session.add(self)
        db.session.commit()
        return self

    def delete(self):
        """Delete the current instance."""
        db.session.delete(self)
        db.session.commit()
