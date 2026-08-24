"""
Digital Twin Task Management Routes
- 과제 관리 설정 (법인, 액티비티 분류, 솔루션, 라인/제품) CRUD
- 과제 데이터 저장/조회/업서트 (버전 관리 + Optimistic Locking)
"""
from flask import request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy.orm.attributes import flag_modified
from app.modules.digital_twin_task_management import bp
from app.modules.digital_twin_dashboard.models import ModuleSettings
from app.modules.digital_twin_task_management.models import TaskManagementData
from app.extensions import db
from app.shared.responses import success_response, error_response, conflict_response
from app.shared.timeutil import now_utc_iso_z
from app.shared.models import BaseModel

MODULE_NAME = 'digital_twin_task_management'
SETTINGS_KEY = 'task_settings'


# ============================================
# 설정 API
# ============================================

@bp.route('/settings', methods=['GET'])
@jwt_required()
def get_task_settings():
    """과제 관리 설정 조회"""
    try:
        record = ModuleSettings.query.filter_by(
            module_name=MODULE_NAME,
            settings_key=SETTINGS_KEY
        ).first()

        if record:
            return success_response(record.settings_data)

        # 기본값 반환
        return success_response({
            'corporations': [],
            'activityCategories': [],
            'activitySubcategories': [],
            'solutions': [],
            'lineProducts': [],
        })
    except Exception as e:
        return error_response(f'설정 조회 실패: {str(e)}', status_code=500)


@bp.route('/settings', methods=['PUT'])
@jwt_required()
def update_task_settings():
    """과제 관리 설정 저장"""
    try:
        data = request.get_json()
        if not data:
            return error_response('요청 데이터가 없습니다.')

        existing = ModuleSettings.query.filter_by(
            module_name=MODULE_NAME,
            settings_key=SETTINGS_KEY
        ).first()

        if existing:
            existing.settings_data = data
            flag_modified(existing, 'settings_data')
        else:
            new_setting = ModuleSettings(
                module_name=MODULE_NAME,
                settings_key=SETTINGS_KEY,
                settings_data=data,
                description='과제 관리 설정 (법인, 액티비티, 솔루션, 라인/제품)'
            )
            db.session.add(new_setting)

        db.session.commit()
        return success_response(data, message='설정이 저장되었습니다.')
    except Exception as e:
        db.session.rollback()
        return error_response(f'설정 저장 실패: {str(e)}', status_code=500)


# ============================================
# 과제 데이터 API (버전 관리 + Optimistic Locking)
# ============================================

@bp.route('/data', methods=['GET'])
@jwt_required()
def get_task_data():
    """과제 데이터 조회 (버전 정보 포함)"""
    try:
        server_data = TaskManagementData.query.first()
        if not server_data:
            return success_response({
                'version': 0,
                'tasks': [],
                'metadata': {},
            })

        return success_response(server_data.to_dict())
    except Exception as e:
        return error_response(f'데이터 조회 실패: {str(e)}', status_code=500)


@bp.route('/data/upsert', methods=['POST'])
@jwt_required()
def upsert_task_data():
    """
    과제 데이터 업서트 (업데이트 또는 추가)
    - uuid 기준으로 기존 데이터 업데이트 또는 신규 추가
    - updatedAt 타임스탬프를 비교하여 최신 데이터만 반영
    - 기존 데이터를 삭제하지 않고 병합함
    """
    try:
        user_id = get_jwt_identity()
        from app.modules.auth.models import User
        user = User.query.get(user_id)
        user_name = user.name if user else 'Unknown'

        req_data = request.get_json()
        if not req_data:
            return error_response('요청 데이터가 없습니다.', status_code=400)

        new_tasks = req_data.get('tasks', [])
        metadata = req_data.get('metadata', {})

        # 현재 서버 데이터 조회
        server_data = TaskManagementData.query.first()
        existing_tasks = server_data.tasks if server_data and server_data.tasks else []

        # uuid -> task 맵 구성
        task_uuid_map = {}
        for t in existing_tasks:
            uid = t.get('uuid')
            if uid:
                task_uuid_map[uid] = t

        updated_count = 0
        added_count = 0
        skipped_count = 0

        for task in new_tasks:
            task_uuid = task.get('uuid')
            if not task_uuid:
                # uuid 없으면 신규로 간주하되 스킵 (프론트에서 반드시 uuid 부여)
                skipped_count += 1
                continue

            if task_uuid in task_uuid_map:
                existing = task_uuid_map[task_uuid]

                # 삭제된 과제 처리
                if existing.get('_deleted'):
                    deleted_at = existing.get('_deletedAt') or ''
                    new_updated = task.get('updatedAt') or ''
                    if deleted_at >= new_updated:
                        skipped_count += 1
                        continue

                # updatedAt 비교 - 더 최신인 경우만 업데이트
                existing_updated = existing.get('updatedAt') or ''
                new_updated = task.get('updatedAt') or ''

                if new_updated >= existing_updated:
                    task_uuid_map[task_uuid] = task
                    updated_count += 1
                else:
                    skipped_count += 1
            else:
                # 신규 과제 추가
                task_uuid_map[task_uuid] = task
                added_count += 1

        # 병합된 과제 목록 구성
        merged_tasks = list(task_uuid_map.values())

        # 서버 데이터 저장
        if server_data:
            server_data.tasks = merged_tasks
            server_data.data_metadata = metadata
            server_data.version = server_data.version + 1
            server_data.last_modified_by = user_id
            server_data.last_modified_by_name = user_name
            flag_modified(server_data, 'tasks')
            flag_modified(server_data, 'data_metadata')
        else:
            server_data = TaskManagementData(
                version=1,
                tasks=merged_tasks,
                data_metadata=metadata,
                last_modified_by=user_id,
                last_modified_by_name=user_name,
            )
            db.session.add(server_data)

        db.session.commit()

        return success_response({
            'version': server_data.version,
            'tasks': server_data.tasks,
            'stats': {
                'added': added_count,
                'updated': updated_count,
                'skipped': skipped_count,
            }
        }, message=f'동기화 완료: 추가 {added_count}, 업데이트 {updated_count}, 스킵 {skipped_count}')

    except Exception as e:
        db.session.rollback()
        return error_response(f'데이터 업서트 실패: {str(e)}', status_code=500)


@bp.route('/task/<string:task_uuid>/delete', methods=['POST'])
@jwt_required()
def soft_delete_task(task_uuid):
    """과제 소프트 삭제 (서버 데이터에서 _deleted 마킹)"""
    try:
        from datetime import datetime
        user_id = get_jwt_identity()
        from app.modules.auth.models import User
        user = User.query.get(user_id)
        user_name = user.name if user else 'Unknown'

        server_data = TaskManagementData.query.first()
        if not server_data or not server_data.tasks:
            return error_response('서버에 데이터가 없습니다.', status_code=404)

        tasks = list(server_data.tasks)
        found = False
        for i, task in enumerate(tasks):
            if task.get('uuid') == task_uuid:
                tasks[i] = {
                    **task,
                    '_deleted': True,
                    '_deletedAt': now_utc_iso_z(),
                    '_deletedBy': user_name,
                }
                found = True
                break

        if not found:
            return error_response('해당 과제를 찾을 수 없습니다.', status_code=404)

        server_data.tasks = tasks
        server_data.version = server_data.version + 1
        server_data.last_modified_by = user_id
        server_data.last_modified_by_name = user_name
        flag_modified(server_data, 'tasks')
        db.session.commit()

        return success_response({
            'version': server_data.version,
        }, message='과제가 삭제되었습니다.')

    except Exception as e:
        db.session.rollback()
        return error_response(f'과제 삭제 실패: {str(e)}', status_code=500)
