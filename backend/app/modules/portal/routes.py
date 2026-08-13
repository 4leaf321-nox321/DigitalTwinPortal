"""메인 화면의 **모듈 상태와 차례** — 운영 중 / 운영 준비 / 기획 중 / 숨김, 그리고 순서.

무엇이 문제였나
    상태가 `MainPage.jsx` 의 `STATUS_BY_ID` 에 박혀 있었다. 그래서 「이 모듈을
    운영 중으로 올리자」 같은 판단 하나에 **프론트를 다시 빌드해 반입**해야 했다.
    상태는 운영하며 자주 바뀌는 값이지 코드가 아니다.

어디에 저장하나
    `module_settings` 의 `('portal', 'moduleStatuses')` 한 줄. 그 표는 이미
    **모듈별 JSON 설정을 담는 공용 표**로 만들어져 있다(모델 주석 참조).
    새 표를 만들지 않으므로 **마이그레이션이 없고**, 폴더 압축 반입만으로 올라간다.

⚠️ **읽기는 누구나, 쓰기는 관리자만.** 이 값이 바뀌면 **모든 사람의 첫 화면**이
   바뀐다. 특히 '숨김' 은 남의 눈에서 기능을 지우는 일이라 아무나 하면 안 된다.

⚠️ **모르는 상태값을 받지 않는다.** 화면은 정해진 네 갈래로만 묶는데, 엉뚱한 값이
   들어오면 그 모듈이 어느 묶음에도 안 들어가 **조용히 사라진다.**
"""
from flask import request

from app.extensions import db
from app.modules.auth.models import UserRole
from app.modules.portal import bp
from app.modules.digital_twin_dashboard.models import ModuleSettings
from app.shared.responses import success_response, error_response

MODULE = 'portal'
KEY = 'moduleStatuses'
DESC = '메인 화면 모듈 상태 (운영 중 / 운영 준비 / 기획 중 / 숨김)'

# 화면(`MainPage.STATUS_GROUPS`)과 **같은 갈래**여야 한다. 여기가 어긋나면
# 그 상태로 저장된 모듈이 어느 묶음에도 안 들어가 화면에서 사라진다.
STATUSES = ('operating', 'developing', 'planning', 'hidden')


def _actor():
    """지금 요청한 사용자. 토큰이 없거나 죽은 계정이면 None."""
    from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
    from app.modules.auth.models import User
    try:
        verify_jwt_in_request()
    except Exception:                       # noqa: BLE001 — 없거나 상한 토큰
        return None
    ident = get_jwt_identity()
    if ident is None:
        return None
    user = User.query.get(int(ident)) if str(ident).isdigit() else None
    return user if (user and user.is_active) else None


def _is_admin(user):
    return bool(user) and (user.role == UserRole.ADMIN or getattr(user, 'is_admin', False))


def _row():
    return ModuleSettings.query.filter_by(
        module_name=MODULE, settings_key=KEY).first()


def _load():
    """
    `(상태맵, 차례)`.

    ⚠️ **옛 모양을 함께 읽는다.** 처음에는 이 칸에 상태맵만 통째로 넣었다
       (`{모듈id: 상태}`). 차례가 생기면서 `{statuses, order}` 로 감쌌는데,
       이미 저장된 줄은 옛 모양이라 그대로 읽으면 상태가 **통째로 날아간다.**
       'statuses' 열쇠가 있으면 새 모양, 없으면 옛 모양으로 본다.
    """
    row = _row()
    data = (row.settings_data if row else None) or {}
    if not isinstance(data, dict):
        return {}, []
    if 'statuses' in data or 'order' in data:
        statuses = data.get('statuses') or {}
        order = data.get('order') or []
        return (statuses if isinstance(statuses, dict) else {},
                [str(x) for x in order] if isinstance(order, list) else [])
    return data, []          # 옛 모양 — 통째로 상태맵이다


@bp.route('/module-statuses', methods=['GET'])
def get_module_statuses():
    """
    `{statuses: {모듈id: 상태}, order: [모듈id], canEdit: bool}`.

    **로그인하지 않아도 200 을 준다** — 첫 화면이 이 값을 기다리는데 401 이면
    화면이 통째로 비어 보인다. 그때는 저장된 값만 주고 `canEdit` 을 false 로 둔다.

    ⚠️ 여기 없는 모듈은 **화면의 기본값**을 따른다. 서버가 전체 목록을 들고 있지
       않기 때문이다 — 모듈이 늘어날 때마다 서버를 고쳐야 한다면 그게 더 나쁘다.
    """
    user = _actor()
    statuses, order = _load()
    return success_response({
        'statuses': statuses,
        'order': order,
        'canEdit': _is_admin(user),
    })


@bp.route('/module-statuses', methods=['PUT'])
def put_module_statuses():
    """
    모듈 상태를 통째로 저장한다. 관리자만.

    본문 `{statuses: {모듈id: 상태}, order: [모듈id]}`

    ⚠️ **통째로 덮어쓴다.** 화면이 늘 전체를 들고 있으므로 부분 갱신을 만들면
       어느 쪽이 정본인지 헷갈린다.

    ⚠️ 차례에 없는 모듈은 **뒤로 간다**(화면이 그렇게 정렬한다). 서버가 전체
       목록을 들고 있지 않으므로 여기서 빠진 것을 채워 넣을 수 없다 —
       모듈이 늘 때마다 서버를 고쳐야 한다면 그게 더 나쁘다.
    """
    user = _actor()
    if user is None:
        return error_response('로그인이 필요합니다.', status_code=401)
    if not _is_admin(user):
        return error_response('모듈 상태는 관리자만 바꿀 수 있습니다.', status_code=403)

    body = request.get_json(silent=True) or {}
    raw = body.get('statuses')
    if not isinstance(raw, dict):
        return error_response('statuses 는 {모듈id: 상태} 형태여야 합니다.')

    clean, bad = {}, []
    for mod_id, status in raw.items():
        key = str(mod_id or '').strip()
        val = str(status or '').strip()
        if not key:
            continue
        if val not in STATUSES:
            bad.append(f'{key}={val}')
            continue
        clean[key] = val
    if bad:
        return error_response(
            f"모르는 상태값입니다: {', '.join(bad[:5])}. "
            f"쓸 수 있는 값은 {', '.join(STATUSES)} 입니다.")

    raw_order = body.get('order')
    order = []
    if isinstance(raw_order, list):
        seen = set()
        for item in raw_order:
            key = str(item or '').strip()
            if key and key not in seen:      # 같은 모듈이 두 번 있으면 자리가 흔들린다
                seen.add(key)
                order.append(key)

    payload = {'statuses': clean, 'order': order}
    row = _row()
    if row is None:
        db.session.add(ModuleSettings(
            module_name=MODULE, settings_key=KEY,
            settings_data=payload, description=DESC))
    else:
        row.settings_data = payload
        row.description = DESC
        # JSON 컬럼은 통째로 바꿔도 SQLAlchemy 가 못 알아챈다. 빠뜨리면 조용히 안 써진다.
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(row, 'settings_data')
    db.session.commit()
    return success_response({'statuses': clean, 'order': order,
                             'savedCount': len(clean)})
