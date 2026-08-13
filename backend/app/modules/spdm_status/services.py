"""
SPDM Status Services
SPDM 현황 관리 서비스
"""
import os
import json
from datetime import datetime
from app.extensions import db
from app.modules.spdm_status.models import (
    SpdmGroup, SpdmIssue, SpdmIssueHistory, SpdmIssueAttachment, UPLOAD_FOLDER,
    SpdmScheduleDepartment, SpdmScheduleItem,
    SpdmModule, SpdmSpecKeySuggestion
)


class SpdmGroupService:
    """Service for SpdmGroup operations."""

    @staticmethod
    def get_all():
        """Get all groups."""
        return SpdmGroup.query.order_by(SpdmGroup.order, SpdmGroup.name).all()

    @staticmethod
    def get_by_id(group_id):
        """Get a group by ID."""
        return SpdmGroup.query.get(group_id)

    @staticmethod
    def create(name, color='#3b82f6', description=None, order=0):
        """Create a new group."""
        group = SpdmGroup(
            name=name,
            color=color,
            description=description,
            order=order
        )
        db.session.add(group)
        db.session.commit()
        return group

    @staticmethod
    def update(group_id, **kwargs):
        """Update a group."""
        group = SpdmGroup.query.get(group_id)
        if not group:
            return None

        if 'name' in kwargs:
            group.name = kwargs['name']
        if 'color' in kwargs:
            group.color = kwargs['color']
        if 'description' in kwargs:
            group.description = kwargs['description']
        if 'order' in kwargs:
            group.order = kwargs['order']

        db.session.commit()
        return group

    @staticmethod
    def delete(group_id):
        """Delete a group and all its issues."""
        group = SpdmGroup.query.get(group_id)
        if not group:
            return False

        # Delete attached files from disk
        for issue in group.issues:
            for attachment in issue.attachments:
                file_path = os.path.join(UPLOAD_FOLDER, attachment.stored_filename)
                if os.path.exists(file_path):
                    os.remove(file_path)

        db.session.delete(group)
        db.session.commit()
        return True


class SpdmIssueService:
    """Service for SpdmIssue operations."""

    @staticmethod
    def get_all():
        """Get all issues."""
        return SpdmIssue.query.order_by(SpdmIssue.created_at.desc()).all()

    @staticmethod
    def get_by_group(group_id):
        """Get all issues for a group."""
        return SpdmIssue.query.filter_by(group_id=group_id)\
            .order_by(SpdmIssue.created_at.desc()).all()

    @staticmethod
    def get_by_id(issue_id):
        """Get an issue by ID."""
        return SpdmIssue.query.get(issue_id)

    @staticmethod
    def create(group_id, title, assignee, description=None, status='registered',
               due_date=None, departments=None):
        """Create a new issue."""
        issue = SpdmIssue(
            group_id=group_id,
            title=title,
            description=description,
            status=status,
            assignee=assignee,
            due_date=due_date,
            departments=','.join(str(d) for d in departments) if departments else None
        )
        db.session.add(issue)
        db.session.flush()

        # Add creation history
        history = SpdmIssueHistory(
            issue_id=issue.id,
            history_type='created',
            content='이슈가 등록되었습니다.',
            author=assignee,
            department_id=departments[0] if departments else None
        )
        db.session.add(history)
        db.session.commit()

        return issue

    @staticmethod
    def update(issue_id, **kwargs):
        """Update an issue."""
        issue = SpdmIssue.query.get(issue_id)
        if not issue:
            return None

        if 'groupId' in kwargs:
            issue.group_id = kwargs['groupId']
        if 'title' in kwargs:
            issue.title = kwargs['title']
        if 'description' in kwargs:
            issue.description = kwargs['description']
        if 'status' in kwargs:
            issue.status = kwargs['status']
        if 'assignee' in kwargs:
            issue.assignee = kwargs['assignee']
        if 'dueDate' in kwargs:
            issue.due_date = kwargs['dueDate']
        if 'departments' in kwargs:
            departments = kwargs['departments']
            issue.departments = ','.join(str(d) for d in departments) if departments else None

        db.session.commit()
        return issue

    @staticmethod
    def change_status(issue_id, new_status, author='시스템'):
        """Change issue status and add history."""
        issue = SpdmIssue.query.get(issue_id)
        if not issue:
            return None

        old_status = issue.status
        issue.status = new_status

        # Add status change history
        history = SpdmIssueHistory(
            issue_id=issue_id,
            history_type='status-change',
            content=f'상태가 "{old_status}"에서 "{new_status}"으로 변경되었습니다.',
            author=author
        )
        db.session.add(history)
        db.session.commit()

        return issue

    @staticmethod
    def delete(issue_id):
        """Delete an issue and all its data."""
        issue = SpdmIssue.query.get(issue_id)
        if not issue:
            return False

        # Delete attached files from disk
        for attachment in issue.attachments:
            file_path = os.path.join(UPLOAD_FOLDER, attachment.stored_filename)
            if os.path.exists(file_path):
                os.remove(file_path)

        db.session.delete(issue)
        db.session.commit()
        return True


class SpdmIssueHistoryService:
    """Service for SpdmIssueHistory operations."""

    @staticmethod
    def get_by_issue(issue_id):
        """Get all history for an issue."""
        return SpdmIssueHistory.query.filter_by(issue_id=issue_id)\
            .order_by(SpdmIssueHistory.created_at.desc()).all()

    @staticmethod
    def get_by_id(history_id):
        """Get a history entry by ID."""
        return SpdmIssueHistory.query.get(history_id)

    @staticmethod
    def create(issue_id, history_type, content, author, department_id=None, attachment=None):
        """Create a new history entry."""
        history = SpdmIssueHistory(
            issue_id=issue_id,
            history_type=history_type,
            content=content,
            author=author,
            department_id=department_id,
            attachment=attachment
        )
        db.session.add(history)

        # Update issue's updated_at
        issue = SpdmIssue.query.get(issue_id)
        if issue:
            # ⚠️ `db.func.now()` 를 쓰면 안 된다. 그건 **Postgres 의 now()** 이고
            #    이 DB 의 TimeZone 은 Asia/Seoul 이라 KST 를 돌려준다. 그런데
            #    BaseModel 의 created_at/updated_at 은 `datetime.utcnow`(naive UTC)다.
            #    같은 컬럼에 두 기준이 섞이면 이 행만 **9시간 미래**로 기록되어
            #    최신순 정렬이 뒤집힌다. (2026-08-02 실측: DB now()=05:17+09:00 vs
            #    utcnow()=20:17 전날)
            issue.updated_at = datetime.utcnow()

        db.session.commit()
        return history

    @staticmethod
    def delete(history_id):
        """Delete a history entry."""
        history = SpdmIssueHistory.query.get(history_id)
        if not history:
            return False

        db.session.delete(history)
        db.session.commit()
        return True


class SpdmAttachmentService:
    """Service for SpdmIssueAttachment operations."""

    @staticmethod
    def ensure_upload_folder():
        """Ensure upload folder exists."""
        if not os.path.exists(UPLOAD_FOLDER):
            os.makedirs(UPLOAD_FOLDER)

    @staticmethod
    def get_by_id(attachment_id):
        """Get an attachment by ID."""
        return SpdmIssueAttachment.query.get(attachment_id)

    @staticmethod
    def get_by_issue(issue_id):
        """Get all attachments for an issue."""
        return SpdmIssueAttachment.query.filter_by(issue_id=issue_id).all()

    @staticmethod
    def create(issue_id, file):
        """Create a new attachment."""
        SpdmAttachmentService.ensure_upload_folder()

        original_filename = file.filename
        stored_filename = SpdmIssueAttachment.generate_stored_filename(original_filename)
        file_path = os.path.join(UPLOAD_FOLDER, stored_filename)

        # Save file to disk
        file.save(file_path)

        # Get file size
        file_size = os.path.getsize(file_path)

        # Create attachment record
        attachment = SpdmIssueAttachment(
            issue_id=issue_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            file_size=file_size,
            mime_type=file.content_type
        )
        db.session.add(attachment)
        db.session.commit()

        return attachment

    @staticmethod
    def delete(attachment_id):
        """Delete an attachment and its file."""
        attachment = SpdmIssueAttachment.query.get(attachment_id)
        if not attachment:
            return False

        # Delete file from disk
        file_path = os.path.join(UPLOAD_FOLDER, attachment.stored_filename)
        if os.path.exists(file_path):
            os.remove(file_path)

        # Delete record
        db.session.delete(attachment)
        db.session.commit()
        return True

    @staticmethod
    def get_file_path(attachment):
        """Get the file path for an attachment."""
        return os.path.join(UPLOAD_FOLDER, attachment.stored_filename)


# ============== Schedule Services ==============

class SpdmScheduleDepartmentService:
    """Service for SpdmScheduleDepartment operations."""

    @staticmethod
    def get_all():
        """Get all schedule departments with their schedules."""
        return SpdmScheduleDepartment.query.order_by(SpdmScheduleDepartment.order, SpdmScheduleDepartment.id).all()

    @staticmethod
    def get_by_id(dept_id):
        """Get a schedule department by ID."""
        return SpdmScheduleDepartment.query.get(dept_id)

    @staticmethod
    def create(name, color='#8b5cf6', order=None):
        """Create a new schedule department."""
        if order is None:
            max_order = db.session.query(db.func.max(SpdmScheduleDepartment.order)).scalar() or 0
            order = max_order + 1

        dept = SpdmScheduleDepartment(
            name=name,
            color=color,
            order=order
        )
        db.session.add(dept)
        db.session.commit()
        return dept

    @staticmethod
    def update(dept_id, **kwargs):
        """Update a schedule department."""
        dept = SpdmScheduleDepartment.query.get(dept_id)
        if not dept:
            return None

        if 'name' in kwargs:
            dept.name = kwargs['name']
        if 'color' in kwargs:
            dept.color = kwargs['color']
        if 'order' in kwargs:
            dept.order = kwargs['order']

        db.session.commit()
        return dept

    @staticmethod
    def delete(dept_id):
        """Delete a schedule department and all its schedules."""
        dept = SpdmScheduleDepartment.query.get(dept_id)
        if not dept:
            return False

        db.session.delete(dept)
        db.session.commit()
        return True

    @staticmethod
    def reorder(dept_ids):
        """Reorder departments by list of IDs."""
        for i, dept_id in enumerate(dept_ids):
            dept = SpdmScheduleDepartment.query.get(dept_id)
            if dept:
                dept.order = i
        db.session.commit()
        return True


class SpdmScheduleItemService:
    """Service for SpdmScheduleItem operations."""

    @staticmethod
    def get_all():
        """Get all schedule items."""
        return SpdmScheduleItem.query.order_by(SpdmScheduleItem.order).all()

    @staticmethod
    def get_by_department(dept_id):
        """Get all schedule items for a department."""
        return SpdmScheduleItem.query.filter_by(department_id=dept_id)\
            .order_by(SpdmScheduleItem.order).all()

    @staticmethod
    def get_by_id(item_id):
        """Get a schedule item by ID."""
        return SpdmScheduleItem.query.get(item_id)

    @staticmethod
    def create(department_id, phase, title, start_date, end_date, status='planned', contents=None, order=None):
        """Create a new schedule item."""
        if order is None:
            max_order = db.session.query(db.func.max(SpdmScheduleItem.order))\
                .filter(SpdmScheduleItem.department_id == department_id).scalar() or 0
            order = max_order + 1

        # Parse dates if they're strings
        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        if isinstance(end_date, str):
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()

        # Convert contents to JSON string if it's a list
        contents_json = None
        if contents:
            if isinstance(contents, list):
                contents_json = json.dumps(contents, ensure_ascii=False)
            elif isinstance(contents, str):
                contents_json = contents

        item = SpdmScheduleItem(
            department_id=department_id,
            phase=phase,
            title=title,
            start_date=start_date,
            end_date=end_date,
            status=status,
            order=order,
            contents=contents_json
        )
        db.session.add(item)
        db.session.commit()
        return item

    @staticmethod
    def update(item_id, **kwargs):
        """Update a schedule item."""
        item = SpdmScheduleItem.query.get(item_id)
        if not item:
            return None

        if 'phase' in kwargs:
            item.phase = kwargs['phase']
        if 'title' in kwargs:
            item.title = kwargs['title']
        if 'startDate' in kwargs:
            start_date = kwargs['startDate']
            if isinstance(start_date, str):
                start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            item.start_date = start_date
        if 'endDate' in kwargs:
            end_date = kwargs['endDate']
            if isinstance(end_date, str):
                end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
            item.end_date = end_date
        if 'status' in kwargs:
            item.status = kwargs['status']
        if 'order' in kwargs:
            item.order = kwargs['order']
        if 'contents' in kwargs:
            contents = kwargs['contents']
            if isinstance(contents, list):
                item.contents = json.dumps(contents, ensure_ascii=False)
            elif isinstance(contents, str):
                item.contents = contents
            else:
                item.contents = None

        db.session.commit()
        return item

    @staticmethod
    def delete(item_id):
        """Delete a schedule item."""
        item = SpdmScheduleItem.query.get(item_id)
        if not item:
            return False

        db.session.delete(item)
        db.session.commit()
        return True

    @staticmethod
    def reorder(dept_id, item_ids):
        """Reorder schedule items within a department."""
        for i, item_id in enumerate(item_ids):
            item = SpdmScheduleItem.query.get(item_id)
            if item and item.department_id == dept_id:
                item.order = i
        db.session.commit()
        return True


# ============== Module Status Services ==============

class SpdmModuleService:
    """Service for SpdmModule operations."""

    @staticmethod
    def get_all(division_id=None):
        """Get all modules, optionally filtered by division.
        When filtering by division, also include company-wide modules (division_id='__all__').
        """
        query = SpdmModule.query
        if division_id:
            query = query.filter(
                db.or_(
                    SpdmModule.division_id == division_id,
                    SpdmModule.division_id == '__all__'
                )
            )
        return query.order_by(SpdmModule.order, SpdmModule.name).all()

    @staticmethod
    def get_by_id(module_id):
        """Get a module by ID."""
        return SpdmModule.query.get(module_id)

    @staticmethod
    def create(name, division_id, categories=None, system_type=None, links=None, description=None, specs=None, order=None, **kwargs):
        """Create a new module."""
        if order is None:
            max_order = db.session.query(db.func.max(SpdmModule.order))\
                .filter(SpdmModule.division_id == division_id).scalar() or 0
            order = max_order + 1

        resolved_links = links or []
        module = SpdmModule(
            name=name,
            division_id=division_id,
            categories=categories or [],
            system_type=system_type,
            is_linked=len(resolved_links) > 0,
            links=resolved_links,
            description=description,
            specs=specs or [],
            order=order
        )
        db.session.add(module)
        db.session.commit()

        # Update spec key suggestions
        if specs:
            SpdmSpecKeySuggestionService.update_from_specs(specs)

        return module

    @staticmethod
    def update(module_id, **kwargs):
        """Update a module."""
        module = SpdmModule.query.get(module_id)
        if not module:
            return None

        if 'name' in kwargs:
            module.name = kwargs['name']
        if 'divisionId' in kwargs:
            module.division_id = kwargs['divisionId']
        if 'categories' in kwargs:
            module.categories = kwargs['categories'] or []
        if 'systemType' in kwargs:
            module.system_type = kwargs['systemType']
        if 'links' in kwargs:
            module.links = kwargs['links'] or []
            module.is_linked = len(module.links) > 0
        if 'description' in kwargs:
            module.description = kwargs['description']
        if 'specs' in kwargs:
            module.specs = kwargs['specs']
            # Update spec key suggestions
            SpdmSpecKeySuggestionService.update_from_specs(kwargs['specs'])
        if 'order' in kwargs:
            module.order = kwargs['order']

        db.session.commit()
        return module

    @staticmethod
    def delete(module_id):
        """Delete a module."""
        module = SpdmModule.query.get(module_id)
        if not module:
            return False

        db.session.delete(module)
        db.session.commit()
        return True

    @staticmethod
    def reorder(module_ids):
        """Reorder modules by list of IDs."""
        for i, module_id in enumerate(module_ids):
            module = SpdmModule.query.get(module_id)
            if module:
                module.order = i
        db.session.commit()
        return True


class SpdmSpecKeySuggestionService:
    """Service for SpdmSpecKeySuggestion operations."""

    @staticmethod
    def search(query='', limit=20):
        """Search spec keys by prefix."""
        q = SpdmSpecKeySuggestion.query
        if query:
            q = q.filter(SpdmSpecKeySuggestion.key.ilike(f'%{query}%'))
        return q.order_by(SpdmSpecKeySuggestion.usage_count.desc()).limit(limit).all()

    @staticmethod
    def update_from_specs(specs):
        """Extract keys from spec tree and update suggestions."""
        keys = set()
        SpdmSpecKeySuggestionService._extract_keys(specs, keys)

        for key in keys:
            existing = SpdmSpecKeySuggestion.query.filter_by(key=key).first()
            if existing:
                existing.usage_count += 1
            else:
                suggestion = SpdmSpecKeySuggestion(key=key, usage_count=1)
                db.session.add(suggestion)

        db.session.commit()

    @staticmethod
    def _extract_keys(nodes, keys):
        """Recursively extract keys from spec tree nodes."""
        if not nodes:
            return
        for node in nodes:
            if isinstance(node, dict) and 'key' in node:
                keys.add(node['key'])
                if 'children' in node:
                    SpdmSpecKeySuggestionService._extract_keys(node['children'], keys)
