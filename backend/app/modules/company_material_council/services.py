"""
Company Material Council Services
전사 물성 협의체 비즈니스 로직
"""

import json
from app import db
from app.modules.company_material_council.models import Material, MaterialTest, MaterialCouncilSettings, TestMethod


class MaterialCouncilSettingsService:
    """Service for managing Material Council settings"""

    @staticmethod
    def get_settings(key='default'):
        """Get settings by key"""
        return MaterialCouncilSettings.query.filter_by(key=key).first()

    @staticmethod
    def save_settings(tabs_data, tab_order, key='default'):
        """Save or update settings"""
        settings = MaterialCouncilSettings.query.filter_by(key=key).first()

        if settings:
            settings.tabs_data = json.dumps(tabs_data) if tabs_data else None
            settings.tab_order = json.dumps(tab_order) if tab_order else None
        else:
            settings = MaterialCouncilSettings(
                key=key,
                tabs_data=json.dumps(tabs_data) if tabs_data else None,
                tab_order=json.dumps(tab_order) if tab_order else None
            )
            db.session.add(settings)

        db.session.commit()
        return settings


class MaterialService:
    """Service for managing Materials"""

    @staticmethod
    def get_all():
        """Get all materials with their tests"""
        materials = Material.query.order_by(Material.created_at.desc()).all()
        return [m.to_dict() for m in materials]

    @staticmethod
    def get_by_id(material_id):
        """Get a single material by ID"""
        material = Material.query.get(material_id)
        return material.to_dict() if material else None

    @staticmethod
    def create(data):
        """Create a new material"""
        material = Material(
            data=json.dumps(data) if data else None
        )
        db.session.add(material)
        db.session.commit()
        return material.to_dict()

    @staticmethod
    def update(material_id, data):
        """Update a material"""
        material = Material.query.get(material_id)
        if not material:
            return None

        material.data = json.dumps(data) if data else None
        db.session.commit()
        return material.to_dict()

    @staticmethod
    def delete(material_id):
        """Delete a material and all its tests"""
        material = Material.query.get(material_id)
        if not material:
            return False

        db.session.delete(material)
        db.session.commit()
        return True

    @staticmethod
    def bulk_create(materials_data):
        """Create multiple materials at once"""
        created_materials = []
        for data in materials_data:
            material = Material(
                data=json.dumps(data) if data else None
            )
            db.session.add(material)
            db.session.flush()  # Get the ID
            created_materials.append(material.to_dict(include_tests=False))

        db.session.commit()
        return created_materials


class MaterialTestService:
    """Service for managing Material Tests"""

    @staticmethod
    def get_by_material(material_id):
        """Get all tests for a material, grouped by type"""
        tests = MaterialTest.query.filter_by(material_id=material_id).order_by(MaterialTest.created_at).all()

        tests_by_type = {}
        for test in tests:
            if test.test_type not in tests_by_type:
                tests_by_type[test.test_type] = []
            tests_by_type[test.test_type].append(test.to_dict())

        return tests_by_type

    @staticmethod
    def get_by_id(test_id):
        """Get a single test by ID"""
        test = MaterialTest.query.get(test_id)
        return test.to_dict() if test else None

    @staticmethod
    def create(material_id, test_type, data):
        """Create a new test"""
        test = MaterialTest(
            material_id=material_id,
            test_type=test_type,
            data=json.dumps(data) if data else None
        )
        db.session.add(test)
        db.session.commit()
        return test.to_dict()

    @staticmethod
    def update(test_id, data):
        """Update a test"""
        test = MaterialTest.query.get(test_id)
        if not test:
            return None

        test.data = json.dumps(data) if data else None
        db.session.commit()
        return test.to_dict()

    @staticmethod
    def delete(test_id):
        """Delete a test"""
        test = MaterialTest.query.get(test_id)
        if not test:
            return False

        db.session.delete(test)
        db.session.commit()
        return True

    @staticmethod
    def bulk_create(material_id, test_type, tests_data):
        """Create multiple tests at once"""
        created_tests = []
        for data in tests_data:
            test = MaterialTest(
                material_id=material_id,
                test_type=test_type,
                data=json.dumps(data) if data else None
            )
            db.session.add(test)
            db.session.flush()
            created_tests.append(test.to_dict())

        db.session.commit()
        return created_tests

    @staticmethod
    def replace_all(material_id, tests_by_type):
        """Replace all tests for a material"""
        # Delete existing tests
        MaterialTest.query.filter_by(material_id=material_id).delete()

        # Create new tests
        for test_type, tests_data in tests_by_type.items():
            for test_data in tests_data:
                test = MaterialTest(
                    material_id=material_id,
                    test_type=test_type,
                    data=json.dumps(test_data.get('data', {})) if test_data.get('data') else None
                )
                db.session.add(test)

        db.session.commit()
        return MaterialTestService.get_by_material(material_id)


class TestMethodService:
    """Service for managing Test Methods (시험 방법)"""

    @staticmethod
    def get_all():
        """Get all test methods"""
        methods = TestMethod.query.order_by(TestMethod.created_at.desc()).all()
        return [m.to_dict() for m in methods]

    @staticmethod
    def get_by_id(method_id):
        """Get a single test method by ID"""
        method = TestMethod.query.get(method_id)
        return method.to_dict() if method else None

    @staticmethod
    def create(data):
        """Create a new test method"""
        method = TestMethod(
            test_name=data.get('testName', ''),
            equipment=data.get('equipment', ''),
            equipment_location=data.get('equipmentLocation', ''),
            thumbnail=data.get('thumbnail'),
            description=data.get('description', ''),
            files=json.dumps(data.get('files', [])) if data.get('files') else None
        )
        db.session.add(method)
        db.session.commit()
        return method.to_dict()

    @staticmethod
    def update(method_id, data):
        """Update a test method"""
        method = TestMethod.query.get(method_id)
        if not method:
            return None

        method.test_name = data.get('testName', method.test_name)
        method.equipment = data.get('equipment', method.equipment)
        method.equipment_location = data.get('equipmentLocation', method.equipment_location)
        if 'thumbnail' in data:
            method.thumbnail = data.get('thumbnail')
        method.description = data.get('description', method.description)
        if 'files' in data:
            method.files = json.dumps(data['files']) if data['files'] else None

        db.session.commit()
        return method.to_dict()

    @staticmethod
    def delete(method_id):
        """Delete a test method"""
        method = TestMethod.query.get(method_id)
        if not method:
            return False

        db.session.delete(method)
        db.session.commit()
        return True
