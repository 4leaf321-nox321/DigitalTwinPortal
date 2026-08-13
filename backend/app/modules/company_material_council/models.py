"""
Company Material Council Models
전사 물성 협의체 데이터 모델
"""

from app import db
from app.shared.models import BaseModel
from app.shared.timeutil import iso_kst


class MaterialCouncilSettings(BaseModel):
    """Settings for Material Council (tabs configuration)"""
    __tablename__ = 'material_council_settings'

    key = db.Column(db.String(100), unique=True, nullable=False)  # 'default' for main settings
    tabs_data = db.Column(db.Text, nullable=True)  # JSON string of tabsData
    tab_order = db.Column(db.Text, nullable=True)  # JSON string of tabOrder

    def to_dict(self):
        import json
        return {
            'id': self.id,
            'key': self.key,
            'tabsData': json.loads(self.tabs_data) if self.tabs_data else None,
            'tabOrder': json.loads(self.tab_order) if self.tab_order else None,
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }


class Material(BaseModel):
    """Material (물성) model"""
    __tablename__ = 'materials'

    # Material data stored as JSON
    data = db.Column(db.Text, nullable=True)  # JSON string containing all material fields

    # Relationships
    tests = db.relationship('MaterialTest', backref='material', lazy='dynamic',
                           cascade='all, delete-orphan')

    def to_dict(self, include_tests=True):
        import json
        result = {
            'id': str(self.id),  # Frontend uses string IDs
            'data': json.loads(self.data) if self.data else {},
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }

        if include_tests:
            # Group tests by test_type
            tests_by_type = {}
            for test in self.tests.order_by(MaterialTest.created_at).all():
                test_type = test.test_type
                if test_type not in tests_by_type:
                    tests_by_type[test_type] = []
                tests_by_type[test_type].append(test.to_dict())
            result['tests'] = tests_by_type

        return result


class MaterialTest(BaseModel):
    """Material Test (시험 데이터) model"""
    __tablename__ = 'material_tests'

    material_id = db.Column(db.Integer, db.ForeignKey('materials.id'), nullable=False)
    test_type = db.Column(db.String(100), nullable=False)  # 'tensile-test', 'dma-strain-sweep', 'dma-freq-temp-sweep'
    data = db.Column(db.Text, nullable=True)  # JSON string containing all test fields

    def to_dict(self):
        import json
        return {
            'id': str(self.id),  # Frontend uses string IDs
            'data': json.loads(self.data) if self.data else {},
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }


class TestMethod(BaseModel):
    """Test Method (시험 방법) model"""
    __tablename__ = 'test_methods'

    test_name = db.Column(db.String(200), nullable=False)  # 시험명
    equipment = db.Column(db.String(200), nullable=True)  # 사용 장비
    equipment_location = db.Column(db.String(200), nullable=True)  # 장비 위치
    thumbnail = db.Column(db.Text, nullable=True)  # 대표 이미지 (Base64)
    description = db.Column(db.Text, nullable=True)  # 시험 방법 설명 (HTML)
    files = db.Column(db.Text, nullable=True)  # JSON string of attached files

    def to_dict(self):
        import json
        return {
            'id': str(self.id),
            'testName': self.test_name,
            'equipment': self.equipment,
            'equipmentLocation': self.equipment_location,
            'thumbnail': self.thumbnail,
            'description': self.description,
            'files': json.loads(self.files) if self.files else [],
            'createdAt': iso_kst(self.created_at) if self.created_at else None,
            'updatedAt': iso_kst(self.updated_at) if self.updated_at else None,
        }
