"""
Error Handlers
"""
import os
from flask import jsonify, request, send_from_directory, current_app


def handle_400_error(error):
    """Handle 400 Bad Request errors."""
    return jsonify({
        'success': False,
        'message': 'Bad Request',
        'error': str(error)
    }), 400


# 정적 자산 확장자 — 이 파일이 없으면 index.html 로 폴백하지 않고 진짜 404 를 준다
STATIC_ASSET_EXTS = {
    '.js', '.mjs', '.css', '.map',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
    '.woff', '.woff2', '.ttf', '.eot',
    '.json', '.txt', '.wasm',
}


def is_static_asset_path(path):
    """정적 자산 요청인가? (SPA 라우트와 구분하기 위함)"""
    return path.startswith('/assets/') or os.path.splitext(path)[1].lower() in STATIC_ASSET_EXTS


def handle_404_error(error):
    """Handle 404 Not Found errors."""
    # API 요청인 경우 JSON 에러 반환
    if request.path.startswith('/api/'):
        return jsonify({
            'success': False,
            'message': 'Resource not found',
            'error': str(error)
        }), 404

    # 정적 자산(css/js/폰트/이미지)이 없으면 index.html 을 주지 않는다.
    #
    # 배경 (2026-07-28 운영 사고):
    #   운영서버에서 npm run build 가 dist/assets 권한 오류로 부분 실패해,
    #   index.html 은 새 CSS 해시를 가리키는데 그 파일이 없는 상태가 됐다.
    #   그때 아래 폴백이 CSS 요청에 index.html 을 **200 으로** 돌려줬고
    #   (send_from_directory 는 200 을 반환한다. 404 를 붙이지 않았다),
    #   브라우저는 CSS 자리에 받은 HTML 을 조용히 버렸다.
    #   → 에러 하나 없이 "헤더 서식만 사라지는" 증상이 되어 원인 파악이 오래 걸렸다.
    #     (styled-components 로 그린 부분은 JS 가 런타임에 주입하므로 멀쩡했고,
    #      CommonHeader.css 처럼 파일로 된 스타일만 사라졌다.)
    #
    #   404 로 바꾸면 브라우저 콘솔·Network 탭에 즉시 드러난다.
    if is_static_asset_path(request.path):
        return jsonify({
            'success': False,
            'message': f'정적 파일을 찾을 수 없습니다: {request.path}',
            'hint': '프론트엔드 빌드(frontend/dist)가 불완전할 수 있습니다. '
                    '백엔드 중지 → dist 삭제 → npm run build → 재시작 순으로 다시 빌드하세요.'
        }), 404

    # SPA 라우트인 경우 index.html 반환
    try:
        return send_from_directory(current_app.static_folder, 'index.html')
    except Exception:
        # index.html도 없으면 JSON 에러 반환
        return jsonify({
            'success': False,
            'message': 'Resource not found',
            'error': str(error)
        }), 404


def handle_405_error(error):
    """Handle 405 Method Not Allowed errors."""
    return jsonify({
        'success': False,
        'message': 'Method not allowed',
        'error': str(error)
    }), 405


def handle_500_error(error):
    """Handle 500 Internal Server errors."""
    return jsonify({
        'success': False,
        'message': 'Internal server error',
        'error': str(error) if error else 'An unexpected error occurred'
    }), 500


class APIError(Exception):
    """Custom API Exception."""

    def __init__(self, message, status_code=400, errors=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.errors = errors

    def to_dict(self):
        return {
            'success': False,
            'message': self.message,
            'errors': self.errors
        }
