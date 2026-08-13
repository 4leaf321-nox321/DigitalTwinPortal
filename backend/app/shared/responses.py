"""
Standard API Response Functions
"""
from flask import jsonify


def success_response(data=None, message=None, status_code=200):
    """
    Create a success response.

    Args:
        data: Response data
        message: Optional success message
        status_code: HTTP status code (default: 200)

    Returns:
        Flask response object
    """
    response = {
        'success': True,
        'data': data
    }
    if message:
        response['message'] = message

    return jsonify(response), status_code


def error_response(message, errors=None, status_code=400):
    """
    Create an error response.

    Args:
        message: Error message
        errors: Optional list of detailed errors
        status_code: HTTP status code (default: 400)

    Returns:
        Flask response object
    """
    response = {
        'success': False,
        'message': message
    }
    if errors:
        response['errors'] = errors

    return jsonify(response), status_code


def created_response(data=None, message='Created successfully'):
    """Create a 201 Created response."""
    return success_response(data, message, 201)


def no_content_response():
    """Create a 204 No Content response."""
    return '', 204


def not_found_response(message='Resource not found'):
    """Create a 404 Not Found response."""
    return error_response(message, status_code=404)


def validation_error_response(errors):
    """Create a 422 Validation Error response."""
    return error_response('Validation failed', errors, 422)


def conflict_response(message='Resource has been modified by another user', data=None):
    """Create a 409 Conflict response for optimistic locking."""
    response = {
        'success': False,
        'message': message,
        'conflict': True
    }
    if data:
        response['data'] = data
    return jsonify(response), 409
