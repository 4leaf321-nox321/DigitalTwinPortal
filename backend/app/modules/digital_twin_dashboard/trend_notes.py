"""과제 곡선의 **날짜 메모** — 그날 왜 늘고 줄었는지.

곡선은 *무엇이* 바뀌었는지는 말해도 *왜* 바뀌었는지는 말하지 못한다.
"7/15 에 MX 가 5건 줄었다" 까지는 데이터가 알지만, "상반기 정리로 3건 이월" 은
사람만 안다. 그 한 줄을 날짜에 붙여 두는 곳이다.

⚠️ **그날 무슨 일이 있었는지는 사람에게 묻지 않는다.** `day_changes()` 가
   그날 들어오고 나간 과제를 직접 뽑아 준다(`_project_span` 과 **같은 기준**).
   메모 창은 그걸 먼저 보여 주고, 사람은 **이유만** 적는다 — 석 달 전 일을
   기억해 내라고 하면 메모는 결국 안 쌓인다.

저장 위치
    `ModuleSettings('digital_twin_dashboard', 'trendNotes')` 의 JSON 한 덩이.
    모양은 `{ "2026": [ {id, date, division, text, ...}, ... ] }` 로,
    `issueSecretariatComments` 가 쓰는 것과 **같은 방식**이다.

    왜 별도 테이블이 아닌가: 메모는 한 해에 수십 건이고, 이 방식은
    **마이그레이션이 필요 없어** 폴더 압축 반입만으로 운영에 올라간다.
    대신 JSON 한 덩이라 **두 사람이 동시에 저장하면 나중 것이 이긴다** —
    편집이 잦아지면 그때 테이블로 옮길 것.
"""
from __future__ import annotations

import uuid as _uuid
from collections import defaultdict

from sqlalchemy.orm.attributes import flag_modified

from app.extensions import db
from app.shared.timeutil import now_kst_iso
from app.modules.digital_twin_dashboard import permissions as P
from app.modules.digital_twin_dashboard.models import ModuleSettings
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project
from app.modules.digital_twin_dashboard.trend_view import _project_span

MODULE = 'digital_twin_dashboard'
KEY = 'trendNotes'
DESC = '과제·성과 추이 — 날짜별 변동 사유 메모'

# 전사 메모. 사업부를 고르지 않으면 이 값으로 저장하고, 어느 탭에서도 보인다.
ALL = '전체'

TEXT_MAX = 500


def _row():
    return ModuleSettings.query.filter_by(
        module_name=MODULE, settings_key=KEY).first()


def _load() -> dict:
    row = _row()
    data = (row.settings_data if row else None) or {}
    # 옛 행이 리스트나 엉뚱한 모양일 수 있다. 읽기가 터지면 화면 전체가 죽는다.
    return data if isinstance(data, dict) else {}


def _save(data: dict):
    row = _row()
    if row is None:
        db.session.add(ModuleSettings(
            module_name=MODULE, settings_key=KEY,
            settings_data=data, description=DESC))
    else:
        row.settings_data = data
        row.description = DESC
        # JSON 컬럼은 **통째로 바꿔도** SQLAlchemy 가 못 알아챈다. 이걸 빠뜨리면
        # 저장이 조용히 안 된다 (`_save_module_setting` 도 같은 이유로 부른다).
        flag_modified(row, 'settings_data')


def _year_of(date_str: str) -> str:
    return str(date_str or '')[:4]


def list_notes(years=None, divisions=None) -> list:
    """
    메모 목록. 날짜 오름차순.

    사업부를 고르면 **그 사업부 것과 전사 것**을 함께 준다 — 전사 메모는
    어느 탭에서 봐도 그날의 설명이라 숨기면 탭마다 다른 이야기가 된다.
    """
    data = _load()
    wanted_years = {str(y) for y in (years or []) if str(y).isdigit()}
    wanted_divs = {str(d) for d in (divisions or []) if d}

    out = []
    for year, items in data.items():
        if wanted_years and str(year) not in wanted_years:
            continue
        for it in (items or []):
            if not isinstance(it, dict):
                continue
            div = it.get('division') or ALL
            if wanted_divs and div != ALL and div not in wanted_divs:
                continue
            out.append(it)
    return sorted(out, key=lambda n: (n.get('date') or '', n.get('createdAt') or ''))


def save_note(actor, payload: dict):
    """
    메모 추가·수정. `id` 가 있으면 그 메모를 고치고, 없으면 새로 만든다.

    돌려주는 값은 `(메모, 오류메시지)`. 오류가 있으면 메모는 None 이다.
    """
    if actor is None or actor.role not in P.GLOBAL_EDIT_ROLES:
        return None, '메모를 쓸 권한이 없습니다. (사무국·관리자만)'

    date = str(payload.get('date') or '').strip()[:10]
    if len(date) != 10 or date[4] != '-' or date[7] != '-':
        return None, "날짜를 'YYYY-MM-DD' 로 주세요."
    text = str(payload.get('text') or '').strip()
    if not text:
        return None, '내용을 적어 주세요.'
    if len(text) > TEXT_MAX:
        return None, f'내용은 {TEXT_MAX}자까지입니다.'
    division = str(payload.get('division') or '').strip() or ALL

    data = _load()
    note_id = str(payload.get('id') or '').strip()
    now = now_kst_iso()

    # 고치는 경우 — **날짜가 바뀌면 연도 칸도 옮겨야 한다.** 안 옮기면 옛 해에
    # 남아 그 연도를 볼 때만 보이는 유령이 된다.
    if note_id:
        for year, items in data.items():
            for i, it in enumerate(items or []):
                if isinstance(it, dict) and it.get('id') == note_id:
                    note = {**it, 'date': date, 'division': division, 'text': text,
                            'updatedAt': now, 'updatedBy': actor.name or actor.email}
                    items.pop(i)
                    data.setdefault(_year_of(date), []).append(note)
                    data[year] = items
                    _save(data)
                    return note, None
        return None, '그 메모를 찾을 수 없습니다. 이미 지워졌을 수 있습니다.'

    note = {
        'id': _uuid.uuid4().hex,
        'date': date,
        'division': division,
        'text': text,
        'createdAt': now,
        'createdBy': actor.name or actor.email,
        'updatedAt': now,
        'updatedBy': actor.name or actor.email,
    }
    data.setdefault(_year_of(date), []).append(note)
    _save(data)
    return note, None


def delete_note(actor, note_id: str):
    """메모 삭제. `(지웠나, 오류메시지)`."""
    if actor is None or actor.role not in P.GLOBAL_EDIT_ROLES:
        return False, '메모를 지울 권한이 없습니다. (사무국·관리자만)'
    data = _load()
    for year, items in data.items():
        for i, it in enumerate(items or []):
            if isinstance(it, dict) and it.get('id') == note_id:
                items.pop(i)
                data[year] = items
                _save(data)
                return True, None
    return False, '그 메모를 찾을 수 없습니다.'


def day_changes(actor, date: str, years=None, divisions=None, limit=40) -> dict:
    """
    그날 **들어온 과제와 빠진 과제**. 메모 창이 먼저 보여 줄 재료다.

    기준은 곡선과 **똑같이** `_project_span` 이다 — 여기서 따로 세면
    "곡선은 5건 줄었다는데 목록은 3건" 같은 어긋남이 생긴다.

    ⚠️ **연도·사업부 필터를 곡선과 똑같이 건다.** `project_trend` 가 그렇게 세기
       때문이다. 🐞 처음엔 연도를 안 걸었더니, 2026년 차트에서 8/5 을 눌렀을 때
       그 곡선을 **1건도 움직이지 않은** 2025년 과제 200건이 목록에 떴다
       (이관으로 생성일이 그날로 찍힌 것들이다).

    빠진 이유(`why`)까지 함께 낸다. 휴지통·영구삭제·취소가 곡선에서는
    똑같이 '내려감' 으로 보이지만, 메모를 쓰는 사람에게는 전혀 다른 일이다.
    """
    date = str(date or '')[:10]
    if len(date) != 10:
        return {'date': date, 'added': [], 'removed': [], 'error': '날짜가 올바르지 않습니다.'}

    q = Dt2Project.query
    if years:
        nums = [int(y) for y in years if str(y).isdigit()]
        if nums:
            q = q.filter(Dt2Project.year.in_(nums))
    if divisions:
        q = q.filter(Dt2Project.division.in_(divisions))
    projects = [p for p in q.all() if P.can_view_project(actor, p)]

    # 곡선은 `start <= 그날 < end` 인 과제를 센다. 그러니 이 목록도 **그 셈이
    # 실제로 달라진 것만** 담아야 한다. 날짜만 맞다고 넣으면 곡선과 어긋난다.
    #
    # 🐞 처음엔 `start == date` / `end == date` 만 봤다. 그런데 개발 DB 에는
    #    **지워진 뒤의 날짜로 생성일이 찍힌** 과제 200건이 있다(이관이 지어낸
    #    createdAt 이 8/5 인데 휴지통에 들어간 날은 8/2). 이것들은 곡선에 한 번도
    #    오른 적이 없는데 "8/2 에 200건 빠짐" 으로 목록에 떴다 —
    #    곡선은 +87 인데 목록은 −113 이었다.
    added, removed = [], []
    for p in projects:
        start, end = _project_span(p)
        item = {'uuid': p.uuid, 'title': p.title,
                'division': (p.division or '(미지정)').strip() or '(미지정)',
                'status': p.status}
        # 들어옴 — 그날 생겼고, **그날 실제로 세어졌다**(당일 지워진 것은 제외).
        if start == date and (end is None or date < end):
            added.append(item)
        # 빠짐 — 그날 빠졌고, **그 전에 세어지고 있었다**(start < end 여야 한다).
        if end == date and start is not None and start < date:
            # 곡선에서 사라진 까닭. 순서가 곧 우선순위다(`_project_span` 과 같다).
            if p.is_permanently_deleted:
                why = '영구삭제'
            elif p.is_deleted:
                why = '휴지통'
            else:
                why = '취소'
            removed.append({**item, 'why': why})

    def by_div(rows):
        c = defaultdict(int)
        for r in rows:
            c[r['division']] += 1
        return dict(c)

    return {
        'date': date,
        'added': added[:limit],
        'removed': removed[:limit],
        'addedCount': len(added),
        'removedCount': len(removed),
        'addedByDivision': by_div(added),
        'removedByDivision': by_div(removed),
        # 잘라서 보냈으면 **반드시 알린다.** 조용히 자르면 목록이 곧 전부로 읽힌다.
        'truncated': len(added) > limit or len(removed) > limit,
    }
