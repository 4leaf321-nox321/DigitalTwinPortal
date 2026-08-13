"""
Company Material Council Routes
전사 물성 협의체 API 엔드포인트
"""

from flask import jsonify, request
from app.modules.company_material_council import bp
from app.modules.company_material_council.services import (
    MaterialService,
    MaterialTestService,
    MaterialCouncilSettingsService,
    TestMethodService
)


# ============== Health Check ==============

@bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'module': 'company-material-council'
    })


# ============== Settings Routes ==============

@bp.route('/settings', methods=['GET'])
def get_settings():
    """Get settings (tabs configuration)"""
    try:
        key = request.args.get('key', 'default')
        settings = MaterialCouncilSettingsService.get_settings(key)

        if settings:
            return jsonify({
                'success': True,
                'data': settings.to_dict()
            })
        else:
            return jsonify({
                'success': True,
                'data': None
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/settings', methods=['POST'])
def save_settings():
    """Save settings (tabs configuration)"""
    try:
        data = request.get_json()
        key = data.get('key', 'default')
        tabs_data = data.get('tabsData')
        tab_order = data.get('tabOrder')

        settings = MaterialCouncilSettingsService.save_settings(tabs_data, tab_order, key)

        return jsonify({
            'success': True,
            'data': settings.to_dict()
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


# ============== Material Routes ==============

@bp.route('/materials', methods=['GET'])
def get_materials():
    """Get all materials with their tests"""
    try:
        materials = MaterialService.get_all()
        return jsonify({
            'success': True,
            'data': materials
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/materials/<int:material_id>', methods=['GET'])
def get_material(material_id):
    """Get a single material by ID"""
    try:
        material = MaterialService.get_by_id(material_id)
        if material:
            return jsonify({
                'success': True,
                'data': material
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Material not found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/materials', methods=['POST'])
def create_material():
    """Create a new material"""
    try:
        data = request.get_json()
        material_data = data.get('data', {})
        material = MaterialService.create(material_data)
        return jsonify({
            'success': True,
            'data': material
        }), 201
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/materials/bulk', methods=['POST'])
def bulk_create_materials():
    """Create multiple materials at once"""
    try:
        data = request.get_json()
        materials_data = data.get('materials', [])
        materials = MaterialService.bulk_create(materials_data)
        return jsonify({
            'success': True,
            'data': materials
        }), 201
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/materials/<int:material_id>', methods=['PUT'])
def update_material(material_id):
    """Update a material"""
    try:
        data = request.get_json()
        material_data = data.get('data', {})
        material = MaterialService.update(material_id, material_data)

        if material:
            return jsonify({
                'success': True,
                'data': material
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Material not found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/materials/<int:material_id>', methods=['DELETE'])
def delete_material(material_id):
    """Delete a material and all its tests"""
    try:
        success = MaterialService.delete(material_id)
        if success:
            return jsonify({
                'success': True,
                'message': 'Material deleted successfully'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Material not found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


# ============== Material Test Routes ==============

@bp.route('/materials/<int:material_id>/tests', methods=['GET'])
def get_material_tests(material_id):
    """Get all tests for a material, grouped by type"""
    try:
        tests = MaterialTestService.get_by_material(material_id)
        return jsonify({
            'success': True,
            'data': tests
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/materials/<int:material_id>/tests', methods=['POST'])
def create_test(material_id):
    """Create a new test for a material"""
    try:
        data = request.get_json()
        test_type = data.get('testType')
        test_data = data.get('data', {})

        if not test_type:
            return jsonify({
                'success': False,
                'message': 'testType is required'
            }), 400

        test = MaterialTestService.create(material_id, test_type, test_data)
        return jsonify({
            'success': True,
            'data': test
        }), 201
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/materials/<int:material_id>/tests/bulk', methods=['POST'])
def bulk_create_tests(material_id):
    """Create multiple tests at once"""
    try:
        data = request.get_json()
        test_type = data.get('testType')
        tests_data = data.get('tests', [])

        if not test_type:
            return jsonify({
                'success': False,
                'message': 'testType is required'
            }), 400

        tests = MaterialTestService.bulk_create(material_id, test_type, tests_data)
        return jsonify({
            'success': True,
            'data': tests
        }), 201
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/materials/<int:material_id>/tests/replace', methods=['PUT'])
def replace_tests(material_id):
    """Replace all tests for a material (used for import)"""
    try:
        data = request.get_json()
        tests_by_type = data.get('tests', {})
        tests = MaterialTestService.replace_all(material_id, tests_by_type)
        return jsonify({
            'success': True,
            'data': tests
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/tests/<int:test_id>', methods=['GET'])
def get_test(test_id):
    """Get a single test by ID"""
    try:
        test = MaterialTestService.get_by_id(test_id)
        if test:
            return jsonify({
                'success': True,
                'data': test
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Test not found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/tests/<int:test_id>', methods=['PUT'])
def update_test(test_id):
    """Update a test"""
    try:
        data = request.get_json()
        test_data = data.get('data', {})
        test = MaterialTestService.update(test_id, test_data)

        if test:
            return jsonify({
                'success': True,
                'data': test
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Test not found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/tests/<int:test_id>', methods=['DELETE'])
def delete_test(test_id):
    """Delete a test"""
    try:
        success = MaterialTestService.delete(test_id)
        if success:
            return jsonify({
                'success': True,
                'message': 'Test deleted successfully'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Test not found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


# ============== Test Method Routes ==============

@bp.route('/test-methods', methods=['GET'])
def get_test_methods():
    """Get all test methods"""
    try:
        methods = TestMethodService.get_all()
        return jsonify({
            'success': True,
            'data': methods
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/test-methods/<int:method_id>', methods=['GET'])
def get_test_method(method_id):
    """Get a single test method by ID"""
    try:
        method = TestMethodService.get_by_id(method_id)
        if method:
            return jsonify({
                'success': True,
                'data': method
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Test method not found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/test-methods', methods=['POST'])
def create_test_method():
    """Create a new test method"""
    try:
        data = request.get_json()
        method = TestMethodService.create(data)
        return jsonify({
            'success': True,
            'data': method
        }), 201
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/test-methods/<int:method_id>', methods=['PUT'])
def update_test_method(method_id):
    """Update a test method"""
    try:
        data = request.get_json()
        method = TestMethodService.update(method_id, data)

        if method:
            return jsonify({
                'success': True,
                'data': method
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Test method not found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500


@bp.route('/test-methods/<int:method_id>', methods=['DELETE'])
def delete_test_method(method_id):
    """Delete a test method"""
    try:
        success = TestMethodService.delete(method_id)
        if success:
            return jsonify({
                'success': True,
                'message': 'Test method deleted successfully'
            })
        else:
            return jsonify({
                'success': False,
                'message': 'Test method not found'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500
