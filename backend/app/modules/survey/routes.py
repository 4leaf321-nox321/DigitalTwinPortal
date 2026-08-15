"""
설문 API.

**`routes.py` 와 파일을 나눈 이유는 권한 기준이 다르기 때문이다.** 그쪽은 모든
엔드포인트에 `office_required` 가 걸려 있는데, 설문 응답은 전사 대상이라 로그인만
요구한다. 같은 파일에 두면 데코레이터를 실수로 붙이거나 빠뜨렸을 때 조용히
막히거나 조용히 열린다.

    admin_bp   /api/digital-twin-strategy/...   사무국·관리자 — 만들기·집계
    respond_bp /api/surveys/...                 전원 — 내가 받은 설문에 응답

계획서: frontend/src/modules/digital-twin-strategy/SURVEY_PLAN.md
"""
from datetime import datetime
from functools import wraps

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.extensions import db
from app.modules.auth.models import User
from app.modules.auth.models import UserRole
from .importer import (
    MAX_AXIS_VALUE, MAX_LINK_KEY, MAX_SECTION, MAX_TEXT,
    TableFormatError, all_errors, parse_table, rows_to_questions,
)
from .models import (
    Survey, SurveyQuestion, SurveyResponse, SurveyAnswer, SurveyAccessLog,
)
from .roles import (
    SURVEY_ROLES, derive_roles, office_head_ids, process_names,
    set_office_head_ids,
)

# 만드는 쪽과 답하는 쪽을 경로로 가른다. 만들기는 /manage 아래, 응답은 그 위.
admin_bp = Blueprint('survey_manage', __name__, url_prefix='/api/surveys/manage')
respond_bp = Blueprint('survey_respond', __name__, url_prefix='/api/surveys')

MANAGER_ROLES = (UserRole.ADMIN, UserRole.DT_OFFICE_MEMBER)


def _error(message, status=500):
    return jsonify({'success': False, 'message': message}), status


def manager_required(fn):
    """설문을 만들고 집계를 보는 사람.

    전략 모듈의 office_required 를 import 하지 않는다 — 그러면 설문이 다시
    전략에 매인다. 같은 역할을 쓰지만 판단은 이 모듈이 한다.
    """
    @wraps(fn)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user = User.query.get(int(get_jwt_identity()))
        if not user or user.role not in MANAGER_ROLES:
            return jsonify({
                'success': False,
                'message': '설문 관리는 사무국/관리자만 접근할 수 있습니다.'
            }), 403
        return fn(*args, **kwargs)
    return wrapper


QTYPES = {'scale', 'choice', 'multi', 'rank', 'text'}
TARGET_TYPES = {'all', 'department', 'role', 'user'}
STATUSES = {'draft', 'open', 'closed'}

# 역할·프로세스를 안 고른 응답을 담는 칸 이름.
#
# ⚠️ **조용히 아무 역할에나 넣지 않는다.** 넣으면 그 역할의 평균이 조용히
#    바뀌고, 표본이 몇인지도 알 수 없게 된다. 모르는 것은 모르는 자리에 센다.
UNSET_BUCKET = '미지정'


def _object_particle(word):
    """받침에 따라 을/를. 전략 모듈에도 같은 것이 있지만 import 하지 않는다 —
    그러면 설문이 다시 전략에 매인다. 열 줄짜리 규칙이라 옮겨 두는 편이 싸다."""
    if not word:
        return '를'
    code = ord(word[-1])
    if 0xAC00 <= code <= 0xD7A3:              # 한글 음절
        return '을' if (code - 0xAC00) % 28 else '를'
    return '을' if word[-1].isdigit() else '를'


def allowed_axis_values(field):
    """이 축에 쓸 수 있는 값. **서버가 아는 것만이다.**

    자유 텍스트를 허용하면 오타 하나로 '개발'과 '개발 '이 다른 대상이 되어
    한쪽 문항이 아무에게도 안 보이고, 응답자는 자기 역할을 마음대로 고를 수
    있게 되어 역할별 집계가 의미를 잃는다.

    프로세스는 대시보드의 마스터를 그대로 쓴다 — 설문이 자기 목록을 따로 들면
    조직이 프로세스를 바꿔도 안 따라간다.
    """
    return list(SURVEY_ROLES) if field == 'roles' else process_names()


def _axis_list(value, label, allowed=None):
    """역할/프로세스 목록을 정규화한다. 돌려주는 값은 (목록, 오류메시지).

    빈 값·None·리스트 아닌 값 모두 **빈 목록**으로 떨어진다. 빈 목록의 뜻은
    한 곳에서만 정한다 — '제한 없음'이다(models.SurveyQuestion 주석 참조).

    allowed 를 주면 **그 안의 값만** 받는다. 모르는 값은 조용히 버리지 않고
    오류로 낸다 — 버리면 표를 넣은 사람은 자기가 적은 역할이 사라진 줄 모르고,
    그 역할을 고른 응답자에게만 문항이 안 보이는 상태가 된다.
    """
    if value is None or value == '':
        return [], None
    if not isinstance(value, list):
        return None, f'{label} 은(는) 목록이어야 합니다.'
    out = []
    for item in value:
        token = str(item).strip()
        if not token:
            continue
        if len(token) > MAX_AXIS_VALUE:
            return None, f'{label} 이름이 너무 깁니다({MAX_AXIS_VALUE}자까지): {token}'
        if allowed is not None and token not in allowed:
            # 라벨이 '3번 문항의 대상 역할' 처럼 길어서 "알 수 없는 …입니다" 에
            # 끼우면 말이 꼬인다. 라벨을 앞에 세운다.
            return None, (f"{label}{_object_particle(label)} 알 수 없습니다: {token} "
                          f"(쓸 수 있는 값: {', '.join(allowed) or '없음'})")
        if token not in out:
            out.append(token)
    return out, None


# ── 문항이 이 응답자에게 해당하는가 ────────────────────────────────────────
#
# ⚠️ **이 함수 하나만 쓴다.** is_target() 과 같은 이유다. 화면과 서버가 각자
#    판정하면 "화면에는 안 보이는데 서버는 요구하는" 문항이 생기고, 그러면
#    그 역할의 사람은 이유도 모른 채 영영 제출을 못 한다.
#
# ⚠️ **빈 배열은 전원이다.** 비어 있는 것을 '아무도'로 읽으면 임포트 한 번
#    잘못해서 아무도 답 못 하는 설문이 만들어진다.

def question_applies(question, role, process):
    """이 문항이 이 역할·프로세스의 응답자에게 해당하는가."""
    roles = question.audience_roles or []
    processes = question.audience_processes or []
    if roles and role not in roles:
        return False
    if processes and process not in processes:
        return False
    return True


def _pick_axis(value, allowed, label):
    """응답자가 고른 역할·프로세스를 검증한다. 돌려주는 값은 (값, 오류메시지).

    설문이 그 축을 안 물으면(allowed 가 비면) 무엇이 와도 None 으로 버린다 —
    묻지도 않은 축이 응답에 남으면 집계에 없는 칸이 생긴다.

    ⚠️ 묻는 축이면 **반드시 아는 값이어야 한다.** 아무 문자열이나 받아주면
       그 값에 걸린 문항이 전부 '해당 없음'이 되어, 오타 하나로 필수 검증이
       통째로 사라진다.
    """
    token = (value or '').strip() if isinstance(value, str) else None
    if not allowed:
        return None, None
    if not token:
        return None, f'{label}을(를) 골라 주세요.'
    if token not in allowed:
        return None, f"알 수 없는 {label}입니다: {token} (가능: {', '.join(allowed)})"
    return token, None


def question_lock_reason(survey):
    """문항을 바꿀 수 없는 이유. 바꿔도 되면 None.

    ⚠️ **판단은 여기 한 곳에서만 한다.** 교체(편집기)와 덧붙이기(표)가 각자
    판단하면 기준이 갈린다 — 실제로 한쪽은 '응답 수', 다른 쪽은 '상태'를 보고
    있었다.

    **응답이 0건이어도 배포된 설문은 잠근다.** 응답 수만 보면 status='open'
    이고 아직 아무도 안 낸 설문에 문항을 더할 수 있는데, 그 순간 폼을 열어 둔
    사람은 **다른 설문에 답한 것**이 된다. 이 잠금이 막으려던 바로 그 결과다.
    화면에 "응답 0건" 이라 떠 있어도 마찬가지다.

    되돌리는 길은 있다 — 마감(closed)했다가 draft 로 내리면 고칠 수 있다.
    그때는 이미 받은 응답을 어떻게 할지 사람이 알고 결정하는 것이다.
    """
    if survey.responses.count() > 0:
        return ('이미 응답이 있어 문항을 바꿀 수 없습니다. 받는 도중에 문항이 '
                '바뀌면 먼저 답한 사람과 나중에 답한 사람이 서로 다른 설문에 '
                '답한 것이 됩니다.')
    if survey.status != 'draft':
        return ('배포된 설문은 문항을 바꿀 수 없습니다. 지금 응답 화면을 열어 둔 '
                '사람이 있을 수 있습니다. 먼저 마감한 뒤 작성 중으로 되돌리세요.')
    return None


def unreachable_questions(survey):
    """아무도 볼 수 없는 문항을 찾는다.

    문항이 가리키는 역할·프로세스를 **설문이 묻지 않으면** 그 문항은 누구에게도
    안 보인다. 표를 잘못 만들었을 때 실제로 나오는 모양이다 — 역할 열에 'PL'을
    적었는데 설문의 역할 목록에는 'PL(과제리더)'로 들어간 경우 같은 것.

    빈 audience 는 전원이므로 여기 걸리지 않는다. 걸리는 것은 **명시했는데
    가리키는 곳이 없는** 경우뿐이다. 배포 직전에 한 번 보는 이유는, 응답이
    들어오기 시작하면 문항이 잠겨서 못 고치기 때문이다.
    """
    roles = set(survey.roles or [])
    processes = set(survey.processes or [])
    dead = []
    for q in survey.questions.all():
        q_roles = set(q.audience_roles or [])
        q_processes = set(q.audience_processes or [])
        if (q_roles and not q_roles & roles) or \
           (q_processes and not q_processes & processes):
            dead.append(q)
    return dead


def _has_answer(value):
    """답이 실제로 들어 있는가.

    키만 있으면 답한 것으로 보던 옛 판정은 `null`·`""`·`[]` 를 그대로 통과
    시켰다. 그렇게 들어온 척도 답은 value_number 가 None 이라 집계에서 조용히
    빠지고, **"제출은 됐는데 분모에는 없는" 답**이 된다. 그게 제일 잡기 어렵다.
    응답 화면(QuestionField.jsx 의 hasAnswer)과 같은 규칙이다.
    """
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ''
    if isinstance(value, (list, dict)):
        return len(value) > 0
    return True


# ── 대상자 판정 ────────────────────────────────────────────────────────────
#
# ⚠️ **이 함수 하나만 쓴다.** 목록·조회·제출 세 곳에 판정을 흩어 쓰면, 목록에는
#    안 뜨는데 URL 로는 제출되는 구멍이 생긴다. 화면에서 가리는 것은 방어가
#    아니다 — 막는 곳은 여기 한 곳이다.

def is_target(user, survey):
    """이 사용자가 이 설문의 대상인가."""
    refs = survey.target_refs or []

    if survey.target_type == 'all':
        return True
    if survey.target_type == 'role':
        return user.role in refs
    if survey.target_type == 'user':
        # JSON 에서 온 값이라 문자열일 수 있다. 숫자로 맞춰 비교한다 —
        # 비교가 어긋나면 '아무도 대상이 아닌 설문'이 조용히 만들어진다.
        return user.id in {int(r) for r in refs if str(r).lstrip('-').isdigit()}
    if survey.target_type == 'department':
        # 부서는 이름으로 맞춘다. users.department 가 비어 있으면 대상이 아니다.
        return bool(user.department) and user.department in refs
    return False


def target_user_ids(survey):
    """대상자 id 목록. 응답률을 말하려면 분모가 있어야 한다.

    "3.2점"만 보여주는 집계는 몇 명이 답했는지 모르는 평균이라 판단에 못 쓴다.
    """
    users = User.query.filter_by(is_active=True).all()
    return [u.id for u in users if is_target(u, survey)]


def resolve_division(user):
    """응답자의 사업부 — **계정에서만 정한다.** (division_id, 이름, 출처)

    users.department → departments.division_id → divisions.name 으로 잇는다.
    운영은 계정마다 소속그룹이 있고 그룹마다 사업부가 정의되어 있어 이것만으로
    정해진다(2026-08-16 확인).

    ⚠️ **응답자에게 묻지 않는다.** 물으면 소속이 자칭이 되어, 사업부별 집계가
       "이 사업부 사람들이 이렇게 답했다"가 아니라 "이 사업부라고 고른 사람들이
       이렇게 답했다"가 된다. 역할을 유도하는 이유와 같다(roles.py). 게다가
       고를 수 있으면 익명 설문에서 **남의 사업부로 답을 흘려 넣을 수 있다.**

    판별이 안 되면 (None, None, 'unknown') — **미상으로 남긴다.** 모르는 것을
    아무 사업부에나 넣으면 집계가 거짓말을 한다. 미상은 따로 세어진다
    (unknown_division_count). 개발 DB 는 users.department 와
    departments.division_id 가 비어 있어 거의 전부 미상이다 — 개발에서 미상만
    보이는 것은 데이터 탓이다.
    """
    name = (user.department or '').strip()
    if not name:
        return None, None, 'unknown'
    try:
        from app.modules.digital_twin_dashboard.models import Department, Division
        # 부서 이름은 유일하지 않다 — 같은 이름의 비활성 옛 행이 남아 있다.
        # 사업부가 붙은 행만 보고, 활성을 먼저 고른다. filter_by(name=...) 로
        # 그냥 first() 를 쓰면 어느 행이 걸리는지가 그때그때 달라진다.
        base = Department.query.filter(
            db.func.lower(db.func.btrim(Department.name)) == name.lower(),
            Department.division_id.isnot(None),
        )
        row = (base.filter(Department.is_active.is_(True))
               .order_by(Department.id).first()
               or base.order_by(Department.id).first())
        if not row:
            return None, None, 'unknown'
        division = Division.query.get(row.division_id)
    except Exception:
        # 대시보드 표를 못 읽어도 설문은 받아야 한다. 그때는 미상이다.
        return None, None, 'unknown'
    return row.division_id, (division.name if division else None), 'profile'


# ── 직렬화 ────────────────────────────────────────────────────────────────
#
# ⚠️ **응답을 내보내는 곳은 이 함수 하나뿐이다.** 라우트마다 user_id 를 지우는
#    코드를 쓰면 한 곳만 빠뜨려도 신원이 샌다. 기본값이 '가린다' 인 것이 요점 —
#    깜빡하면 가려지는 쪽으로 실패해야 한다.

def serialize_response(response, reveal=False, user_names=None):
    """응답 한 벌을 화면에 보낼 모양으로. reveal=True 는 관리자 확인용이다."""
    data = {
        'id': response.id,
        'department_name': response.department_name,
        'division_id': response.division_id,
        'division_source': response.division_source,
        'submitted_at': response.submitted_at.isoformat() if response.submitted_at else None,
        'answers': [
            {
                'question_id': a.question_id,
                'value_number': a.value_number,
                'value_text': a.value_text,
                'value_json': a.value_json,
            }
            for a in response.answers.all()
        ],
    }
    if reveal:
        data['user_id'] = response.user_id
        data['user_name'] = (user_names or {}).get(response.user_id)
        # 역할·프로세스는 reveal 쪽에만 둔다. 부서 + 역할 + 프로세스가 겹치면
        # 한 사람으로 좁혀지는 조합이 실제로 나온다 — 신원을 밝히는 화면에만
        # 실어야 그 조합이 익명 열람에 섞여 나가지 않는다.
        data['respondent_role'] = response.respondent_role
        data['respondent_process'] = response.respondent_process
    return data


def _survey_dict(survey, with_questions=False, counts=None):
    d = {
        'id': survey.id,
        'title': survey.title,
        'description': survey.description,
        'context_type': survey.context_type,
        'context_id': survey.context_id,
        'context_tag': survey.context_tag,
        'target_type': survey.target_type,
        'target_refs': survey.target_refs or [],
        # 응답자에게 물을 축. 비어 있으면 화면이 그 선택을 아예 안 띄운다.
        'roles': survey.roles or [],
        'processes': survey.processes or [],
        'status': survey.status,
        'closes_at': survey.closes_at.isoformat() if survey.closes_at else None,
    }
    if counts:
        d.update(counts)
    if with_questions:
        d['questions'] = [_question_dict(q) for q in survey.questions.all()]
    return d


def _question_dict(q):
    return {
        'id': q.id,
        'order': q.order,
        'section': q.section,
        'text': q.text,
        'help_text': q.help_text,
        'qtype': q.qtype,
        'required': q.required,
        'options': q.options or {},
        # 빈 배열이면 전원이 본다. 화면이 이 값으로 문항을 걸러 그린다.
        'audience_roles': q.audience_roles or [],
        'audience_processes': q.audience_processes or [],
        'link_type': q.link_type,
        'link_key': q.link_key,
    }


def _accepting(survey, now=None):
    """지금 응답을 받는 상태인가. 상태와 마감시각을 **둘 다** 본다."""
    now = now or datetime.utcnow()
    if survey.status != 'open':
        return False
    if survey.closes_at and now > survey.closes_at:
        return False
    return True


# ── 문항을 넣는 두 길 ──────────────────────────────────────────────────────
#
# ⚠️ **지우는 길과 더하는 길을 이름으로 가른다.**
#
#    `_replace_questions` 는 기존 문항을 **전부 지우고** 다시 만든다.
#    `_append_questions` 는 **하나도 지우지 않고** 뒤에 이어 붙인다.
#
#    한 함수에 플래그로 합쳐 두면 부르는 쪽에서 어느 쪽인지 안 보이고, 그러면
#    "제목만 고쳤는데 문항이 전부 사라졌다" 가 난다. 실제로 문항은 응답이
#    들어오면 잠기므로, 잘못 지운 것을 되돌릴 방법이 없다.
#
#    실제로 만드는 일은 `_add_questions` 하나가 한다 — 검증 규칙이 둘로 갈리면
#    "새로 만들 때는 통과하는데 덧붙일 때는 실패" 가 생긴다.

def _add_questions(survey, items, order_base=None):
    """items 를 검증해 문항으로 **더한다.** 돌려주는 값은 오류 메시지(None 이면 통과).

    ⚠️ 이 함수는 **아무것도 지우지 않는다.** 지우는 것은 `_replace_questions`
       한 곳에서만 한다.

    order_base 가 None 이면 넘어온 order 를 그대로 쓴다(교체 경로 — 화면이
    순서를 정해 보낸다). 숫자면 그 번호부터 차례로 매긴다(덧붙이기 경로 —
    표에는 order 열이 없어서 0 부터 다시 매겨지는데, 그대로 두면 기존 문항
    사이에 새 문항이 끼어들어 순서가 섞인다).
    """
    for i, item in enumerate(items or []):
        text = (item.get('text') or '').strip()
        if not text:
            return f'{i + 1}번 문항의 내용이 비어 있습니다.'
        qtype = item.get('qtype') or 'scale'
        if qtype not in QTYPES:
            return f'{i + 1}번 문항의 유형을 알 수 없습니다: {qtype}'

        # ⚠️ 길이를 여기서 막는다.
        #
        # 표 경로는 파서가 미리 잡아 "몇 행이 문제"라고 말해 주는데, 편집기
        # 경로는 검사가 없어 같은 입력이 commit 에서 터졌다. 그때 사용자가 보는
        # 것은 **raw SQL 과 바인딩된 값이 통째로 실린 500** 이다 — 무엇이
        # 문제인지도, 어느 문항인지도 알 수 없다.
        section = (item.get('section') or '').strip() or None
        link_key = item.get('link_key') or None
        for value, limit, label in (
            (text, MAX_TEXT, '내용이'),
            (section, MAX_SECTION, '섹션이'),
            (link_key, MAX_LINK_KEY, '연결키가'),
        ):
            if value and len(value) > limit:
                return f'{i + 1}번 문항의 {label} 너무 깁니다({limit}자까지).'

        # 문항의 대상도 **아는 값만** 받는다. 여기가 뚫리면 설문의 목록에는
        # 없는 이름을 가리키는 문항이 만들어지고, 그 문항은 아무에게도 안 보인다.
        audience_roles, error = _axis_list(
            item.get('audience_roles'), f'{i + 1}번 문항의 대상 역할',
            allowed_axis_values('roles'))
        if error:
            return error
        audience_processes, error = _axis_list(
            item.get('audience_processes'), f'{i + 1}번 문항의 대상 프로세스',
            allowed_axis_values('processes'))
        if error:
            return error

        order = item.get('order', i) if order_base is None else order_base + i
        section = (item.get('section') or '').strip() or None
        db.session.add(SurveyQuestion(
            survey=survey,
            order=order,
            section=section,
            text=text,
            help_text=item.get('help_text'),
            qtype=qtype,
            required=bool(item.get('required', True)),
            options=item.get('options') or {},
            # 빈 목록으로 떨어지는 것이 기본이다 = 전원이 본다.
            audience_roles=audience_roles,
            audience_processes=audience_processes,
            link_type=item.get('link_type'),
            link_key=item.get('link_key'),
        ))
    return None


def _replace_questions(survey, items):
    """문항을 통째로 교체한다. **기존 문항은 사라진다.**

    돌려주는 값은 오류 메시지이며 None 이면 통과. 부르기 전에 응답이 없는지
    확인해야 한다 — 응답이 있는 설문에서 문항을 갈아치우면 이미 받은 답이
    무엇에 대한 답이었는지 알 수 없게 된다.
    """
    if not isinstance(items, list):
        return 'questions 는 목록이어야 합니다.'

    for q in survey.questions.all():
        db.session.delete(q)

    return _add_questions(survey, items)


def _next_order(survey):
    """덧붙일 문항이 시작할 order.

    기존 문항이 0..4 인데 덧붙이는 문항을 0 부터 매기면, order 로 정렬하는
    응답 화면에서 새 문항이 옛 문항 사이에 끼어들어 섞인다. 그래서 **기존
    최대값 다음**부터 매긴다. 문항이 하나도 없으면 0.
    """
    orders = [q.order or 0 for q in survey.questions.all()]
    return max(orders) + 1 if orders else 0


def _append_questions(survey, items):
    """기존 문항 **뒤에** 문항을 덧붙인다. 하나도 지우지 않는다.

    돌려주는 값은 오류 메시지이며 None 이면 통과.
    """
    if not isinstance(items, list):
        return 'questions 는 목록이어야 합니다.'

    return _add_questions(survey, items, order_base=_next_order(survey))


def _apply_axes(survey, payload):
    """설문이 물을 역할·프로세스를 payload 에서 받아 반영한다.

    돌려주는 값은 오류 메시지이며 None 이면 통과. 생성·수정·임포트 세 경로가
    같은 함수를 쓴다 — 한 곳만 빠뜨리면 그 경로로 만든 설문만 축을 안 묻는다.
    """
    for field, label in (('roles', '역할'), ('processes', '프로세스')):
        if field not in payload:
            continue
        values, error = _axis_list(payload[field], label,
                                   allowed_axis_values(field))
        if error:
            return error
        setattr(survey, field, values)
    return None


def _extend_axes(survey, table_axes, payload):
    """설문이 물을 역할·프로세스를 **넓히기만 한다**(합집합). 덧붙이기 전용.

    ⚠️ **좁히지 않는다.** 이미 그 역할로 답한 사람이 있을 수 있고, 목록에서
       빼면 그 응답은 집계에서 갈 곳을 잃는다(응답의 respondent_role 은 남아
       있는데 설문은 그 역할을 모르는 상태가 된다).

    ⚠️ 표에서 유도만 하지 않는다. 전용 문항이 없는 역할(사무국장처럼)은 표의
       역할 열에 아예 나타나지 않는데, 설문 목록에 없으면 그 사람은 역할을
       고를 수 없어 제출 자체가 막힌다. 그래서 payload 가 명시한 값도 함께
       더한다.

    순서는 기존 값 → 표에 나온 값 → payload 가 명시한 값. 화면의 선택지 순서가
    덧붙일 때마다 뒤바뀌면 응답자가 헷갈린다.
    """
    for field, label in (('roles', '역할'), ('processes', '프로세스')):
        allowed = allowed_axis_values(field)
        explicit, error = _axis_list(payload.get(field), label, allowed)
        if error:
            return error
        # 표에서 나온 값도 아는 것만 더한다. 문항 검증이 이미 막지만, 여기서
        # 한 번 더 거르지 않으면 설문 목록에 모르는 이름이 들어앉는다.
        from_table = [v for v in (table_axes.get(field) or []) if v in allowed]
        merged = []
        for source in (getattr(survey, field) or [], from_table, explicit):
            for value in source:
                if value not in merged:
                    merged.append(value)
        setattr(survey, field, merged)
    return None


# ══ 관리자용 ═══════════════════════════════════════════════════════════════

@admin_bp.route('/options', methods=['GET'])
@manager_required
def survey_options():
    """설문을 만들 때 **고를 수 있는 값**과 설정.

    화면이 자기 목록을 하드코딩하면 서버가 받는 값과 갈린다 — 화면에는 있는데
    저장하면 400 이 나거나, 반대로 화면에 없는 값이 표로는 들어간다.
    목록의 정본은 서버다.
    """
    heads = office_head_ids()
    users = User.query.filter_by(is_active=True).order_by(User.name, User.id).all()
    return jsonify({'success': True, 'data': {
        'roles': list(SURVEY_ROLES),
        'processes': process_names(),
        # 사무국장은 권한으로 구분되지 않아 사람을 직접 지정한다.
        'office_head_user_ids': heads,
        'users': [
            {'id': u.id, 'name': u.name or u.email, 'email': u.email, 'role': u.role}
            for u in users
        ],
    }})


@admin_bp.route('/options/office-heads', methods=['PUT'])
@manager_required
def set_office_heads():
    """사무국장 지정. 실재하는 활성 사용자만 남는다."""
    try:
        payload = request.get_json() or {}
        ids = payload.get('user_ids')
        if not isinstance(ids, list):
            return _error('user_ids 가 필요합니다.', 400)
        saved = set_office_head_ids(ids)
        db.session.commit()
        return jsonify({'success': True, 'data': {'office_head_user_ids': saved}})
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


@admin_bp.route('', methods=['GET'])
@manager_required
def list_surveys():
    """설문 목록. context 로 좁힐 수 있다.

    ?context_type=strategy_plan&context_id=12 처럼 부르면 그 전략의 설문만
    나온다. 안 주면 전부 나온다 — 설문은 전략 전용이 아니다.
    """
    query = Survey.query
    context_type = request.args.get('context_type')
    context_id = request.args.get('context_id', type=int)
    if context_type:
        query = query.filter_by(context_type=context_type)
    if context_id is not None:
        query = query.filter_by(context_id=context_id)

    surveys = query.order_by(Survey.id.desc()).all()
    out = []
    for s in surveys:
        targets = target_user_ids(s)
        out.append(_survey_dict(s, counts={
            'target_count': len(targets),
            'response_count': s.responses.filter(
                SurveyResponse.submitted_at.isnot(None)
            ).count(),
            'question_count': s.questions.count(),
        }))
    return jsonify({'success': True, 'data': out})


@admin_bp.route('', methods=['POST'])
@manager_required
def create_survey():
    try:
        payload = request.get_json() or {}
        title = (payload.get('title') or '').strip()
        if not title:
            return _error('title 이 필요합니다.', 400)

        target_type = payload.get('target_type') or 'all'
        if target_type not in TARGET_TYPES:
            return _error(f'알 수 없는 대상 구분입니다: {target_type}', 400)

        survey = Survey(
            title=title,
            description=payload.get('description'),
            # 어디에 매달린 설문인지는 부르는 쪽이 정한다. 비워도 된다.
            context_type=payload.get('context_type'),
            context_id=payload.get('context_id'),
            context_tag=payload.get('context_tag'),
            target_type=target_type,
            target_refs=payload.get('target_refs') or [],
            created_by=int(get_jwt_identity()),
        )
        db.session.add(survey)
        db.session.flush()

        error = _apply_axes(survey, payload) or \
            _replace_questions(survey, payload.get('questions') or [])
        if error:
            db.session.rollback()
            return _error(error, 400)

        db.session.commit()
        return jsonify({'success': True, 'data': _survey_dict(survey, with_questions=True)}), 201
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


# ── 표 일괄 입력 ──────────────────────────────────────────────────────────
#
# **운영 서버에서는 코드를 못 고친다.** 그래서 문항 정의를 표로 받는다.
# 미리보기와 생성이 `importer.parse_table` **하나**를 부른다 — 파서가 둘로
# 갈리면 "미리보기는 통과했는데 생성은 실패"가 생기고, 그때 사용자는 자기
# 표의 어디가 틀렸는지 알 방법이 없다.

@admin_bp.route('/import/preview', methods=['POST'])
@manager_required
def import_preview():
    """붙여넣은 표를 읽어만 본다. **아무것도 저장하지 않는다.**

    저장 전에 눈으로 확인할 자리를 만드는 것이 요점이다. 수십 문항짜리 표를
    확인 없이 넣으면, 틀린 것을 응답이 들어온 뒤에야 알게 된다 —
    그때는 문항을 못 고친다(응답이 있으면 잠긴다).
    """
    payload = request.get_json() or {}
    text = payload.get('text') or ''
    if not isinstance(text, str):
        return _error('text 는 문자열이어야 합니다.', 400)
    # ⚠️ survey_id 가 와도 **무시한다.** 미리보기는 어느 설문에 붙일 표든 읽기만
    #    한다 — 확인하려고 눌렀을 뿐인데 문항이 늘어나면 안 된다.
    try:
        return jsonify({'success': True, 'data': parse_table(text)})
    except TableFormatError as e:
        # 표 구조가 깨져 행 단위로 말할 수 없는 경우. 잡지 않으면 메시지 없는
        # 500 이 나가고, 사용자는 자기 표의 어디가 문제인지 알 방법이 없다.
        return _error(str(e), 400)


def _parse_or_reject(payload, refusal):
    """표를 읽는다. 돌려주는 값은 (결과, 오류응답) — 오류응답이 있으면 그대로 반환.

    ⚠️ **DB 를 건드리기 전에 부른다.** 오류가 한 줄이라도 있으면 아무것도
       만들지도, 덧붙이지도 않는다. 반쯤 반영된 설문이 남는 것이 가장 나쁘다.

    refusal 은 "그래서 무엇을 안 했는지"다. 새로 만드는 길과 덧붙이는 길이
    같은 문구를 쓰면, 사용자는 기존 문항이 날아갔는지 아닌지 알 수 없다.
    """
    text = payload.get('text') or ''
    if not isinstance(text, str):
        return None, _error('text 는 문자열이어야 합니다.', 400)
    try:
        result = parse_table(text)
    except TableFormatError as e:
        return None, _error(f'{e} {refusal}', 400)
    if not result['rows']:
        return None, _error('표에서 문항을 하나도 읽지 못했습니다. '
                            '첫 줄은 머리글로 보고 건너뜁니다.', 400)
    if result['error_count']:
        # 오류를 그대로 실어 보낸다. 개수만 알려주면 사용자는 미리보기를
        # 다시 불러야 하고, 그 사이 표를 고쳤으면 줄 번호가 어긋난다.
        return None, (jsonify({
            'success': False,
            'message': f"{result['error_count']}개 행에 오류가 있어 {refusal}",
            'errors': all_errors(result),
            'data': result,
        }), 400)
    return result, None


def _append_target(payload):
    """payload 의 survey_id 로 덧붙일 설문을 찾는다.

    돌려주는 값은 (설문, 오류응답). **둘 다 None 이면 survey_id 가 없다** =
    지금까지처럼 새 설문을 만드는 길이다.
    """
    raw = payload.get('survey_id')
    if raw is None or raw == '':
        return None, None

    try:
        survey_id = int(raw)
    except (TypeError, ValueError):
        return None, _error(f'survey_id 는 숫자여야 합니다: {raw}', 400)

    survey = Survey.query.get(survey_id)
    if not survey:
        return None, _error('설문을 찾을 수 없습니다.', 404)

    # 문항 수정을 막는 것과 같은 이유다. 응답을 받는 도중에 문항이 늘면 먼저
    # 답한 사람과 나중에 답한 사람이 **서로 다른 설문에 답한 것**이 되고,
    # 나중에 집계에서 새 문항의 분모가 몇인지 아무도 설명할 수 없게 된다.
    reason = question_lock_reason(survey)
    if reason:
        return None, _error(reason, 409)

    return survey, None


@admin_bp.route('/import', methods=['POST'])
@manager_required
def import_survey():
    """표를 설문으로. survey_id 유무로 **길이 갈린다.**

        survey_id 없음  → 표에서 설문을 통째로 새로 만든다
        survey_id 있음  → 그 설문 **뒤에 문항을 덧붙인다**(기존 문항은 남는다)

    덧붙이기가 필요한 이유: 운영에서 AI 로 역할별 표를 여러 벌 만들어 온다.
    첫 표로 설문을 만든 뒤 나머지를 같은 설문에 이어 붙여야 하는데, 그 길이
    없으면 표를 다시 붙여넣을 때마다 설문이 하나씩 더 생긴다.

    ⚠️ **오류가 한 줄이라도 있으면 아무것도 만들지도 덧붙이지도 않는다.**
       반쯤 반영된 설문이 남는 것이 가장 나쁘다 — 목록에는 보이는데 문항이
       빠져 있고, 고치려는 사이 누가 답해 버리면 문항이 잠긴다.
    """
    try:
        payload = request.get_json() or {}
        survey, refusal = _append_target(payload)
        if refusal:
            return refusal
        if survey is not None:
            return _import_append(survey, payload)
        return _import_create(payload)
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


def _import_create(payload):
    """표에서 설문을 새로 만든다. 지금까지의 동작 그대로다."""
    title = (payload.get('title') or '').strip()
    if not title:
        return _error('title 이 필요합니다.', 400)

    target_type = payload.get('target_type') or 'all'
    if target_type not in TARGET_TYPES:
        return _error(f'알 수 없는 대상 구분입니다: {target_type}', 400)

    result, refusal = _parse_or_reject(payload, '설문을 만들지 않았습니다.')
    if refusal:
        return refusal

    survey = Survey(
        title=title,
        description=payload.get('description'),
        context_type=payload.get('context_type'),
        context_id=payload.get('context_id'),
        context_tag=payload.get('context_tag'),
        target_type=target_type,
        target_refs=payload.get('target_refs') or [],
        created_by=int(get_jwt_identity()),
    )
    db.session.add(survey)
    db.session.flush()

    # 축을 따로 안 주면 **표에 등장한 것**을 그대로 쓴다. 표에 PL 문항이
    # 있는데 설문이 PL 을 안 물으면 그 문항은 아무에게도 안 보인다.
    axes = {
        'roles': payload.get('roles', result['roles']),
        'processes': payload.get('processes', result['processes']),
    }
    # 새 설문이라 지울 문항이 없다. 교체 경로를 쓰는 것이 안전하다.
    error = _apply_axes(survey, axes) or _replace_questions(
        survey, rows_to_questions(result, link_type=payload.get('link_type'))
    )
    if error:
        db.session.rollback()
        return _error(error, 400)

    db.session.commit()
    return jsonify({
        'success': True,
        'data': _survey_dict(survey, with_questions=True),
    }), 201


def _import_append(survey, payload):
    """기존 설문에 표의 문항을 **덧붙인다.**

    ⚠️ title/description/target_* 은 **건드리지 않는다.** 덧붙이기는 문항을
       더하는 일이지 설문을 다시 정의하는 일이 아니다. payload 에 와도 무시한다 —
       두 번째 표를 넣다가 제목이 바뀌면 사무국이 어느 설문인지 잃어버린다.
    """
    result, refusal = _parse_or_reject(payload, '문항을 덧붙이지 않았습니다.')
    if refusal:
        return refusal

    before = survey.questions.count()

    # 축은 **넓히기만** 한다(합집합). 좁히면 이미 그 역할로 답한 응답이 갈 곳을
    # 잃는다 — 지금은 응답이 없어야 여기 오지만, 규칙을 경로마다 다르게 두면
    # 나중에 그 전제가 풀렸을 때 조용히 데이터가 어긋난다.
    table_axes = {'roles': result['roles'], 'processes': result['processes']}
    error = _extend_axes(survey, table_axes, payload) or _append_questions(
        survey, rows_to_questions(result, link_type=payload.get('link_type'))
    )
    if error:
        db.session.rollback()
        return _error(error, 400)

    db.session.commit()
    data = _survey_dict(survey, with_questions=True)
    # 몇 개가 붙었는지 화면이 바로 말해 줄 수 있어야 한다. 개수를 안 돌려주면
    # 사용자는 문항 목록을 세어 보는 수밖에 없고, 수십 문항이면 세지 않는다.
    # **저장된 결과에서 센다** — 넣으려던 개수를 세면, 어긋났을 때 그 사실이
    # 숫자에 안 나타난다.
    data['question_count'] = len(data['questions'])
    data['appended_count'] = data['question_count'] - before
    return jsonify({'success': True, 'data': data}), 200


@admin_bp.route('/<int:survey_id>', methods=['GET', 'PUT', 'DELETE'])
@manager_required
def modify_survey(survey_id):
    try:
        survey = Survey.query.get(survey_id)
        if not survey:
            return _error('설문을 찾을 수 없습니다.', 404)

        if request.method == 'GET':
            # 잠금 사유를 **서버가 계산해서 준다.** 화면이 응답 수를 보고 따로
            # 판단하면 기준이 갈린다 — 목록의 response_count 는 제출된 것만
            # 세는데 잠금은 모든 응답 행을 보므로, 화면은 "응답 0건" 이라
            # 말하면서 저장은 409 가 나는 일이 생긴다.
            return jsonify({'success': True, 'data': _survey_dict(
                survey, with_questions=True,
                counts={
                    'target_count': len(target_user_ids(survey)),
                    'response_count': survey.responses.filter(
                        SurveyResponse.submitted_at.isnot(None)
                    ).count(),
                    'question_lock_reason': question_lock_reason(survey),
                },
            )})

        if request.method == 'DELETE':
            db.session.delete(survey)
            db.session.commit()
            return jsonify({'success': True})

        payload = request.get_json() or {}

        # 응답이 들어온 뒤 문항을 바꾸면 이미 받은 답이 무엇에 대한 답이었는지
        # 알 수 없게 된다. 제목·설명은 고칠 수 있어도 문항은 잠근다.
        lock = question_lock_reason(survey)
        if 'questions' in payload and lock:
            return _error(lock, 409)

        if 'title' in payload:
            title = (payload['title'] or '').strip()
            if not title:
                return _error('title 은 비울 수 없습니다.', 400)
            survey.title = title
        if 'target_type' in payload:
            if payload['target_type'] not in TARGET_TYPES:
                return _error(f"알 수 없는 대상 구분입니다: {payload['target_type']}", 400)
            survey.target_type = payload['target_type']
        for field in ('description', 'target_refs',
                      'context_type', 'context_id', 'context_tag'):
            if field in payload:
                setattr(survey, field, payload[field])

        error = _apply_axes(survey, payload)
        if error:
            db.session.rollback()
            return _error(error, 400)

        if 'questions' in payload:
            # 통째로 교체하는 길이다. 위에서 응답 유무를 이미 막아 두었다.
            error = _replace_questions(survey, payload['questions'])
            if error:
                db.session.rollback()
                return _error(error, 400)

        db.session.commit()
        return jsonify({'success': True, 'data': _survey_dict(survey, with_questions=True)})
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


@admin_bp.route('/<int:survey_id>/status', methods=['PUT'])
@manager_required
def set_survey_status(survey_id):
    """배포(open)·마감(close). 되돌리는 것도 여기서 한다."""
    try:
        survey = Survey.query.get(survey_id)
        if not survey:
            return _error('설문을 찾을 수 없습니다.', 404)

        payload = request.get_json() or {}
        status = payload.get('status')
        if status not in STATUSES:
            return _error(f'알 수 없는 상태입니다: {status}', 400)

        # 문항 없는 설문을 배포하면 받는 사람이 빈 화면을 본다.
        if status == 'open' and survey.questions.count() == 0:
            return _error('문항이 없는 설문은 배포할 수 없습니다.', 400)

        # 아무도 볼 수 없는 문항이 섞인 채로 배포하면, 그 문항은 조용히 없는
        # 것이 된다. 응답이 들어온 뒤에는 문항이 잠겨 못 고치므로 **여기서**
        # 막는다. 배포 전이면 표를 고쳐 다시 넣으면 그만이다.
        if status == 'open':
            dead = unreachable_questions(survey)
            if dead:
                names = ', '.join(q.text[:30] for q in dead[:3])
                more = f' 외 {len(dead) - 3}건' if len(dead) > 3 else ''
                return _error(
                    f'설문이 묻지 않는 역할·프로세스만 가리키는 문항이 '
                    f'{len(dead)}개 있어 아무에게도 보이지 않습니다: {names}{more}. '
                    '설문의 역할·프로세스 목록을 확인해 주세요.', 400)

        if 'closes_at' in payload:
            value = payload['closes_at']
            survey.closes_at = datetime.fromisoformat(value) if value else None

        survey.status = status
        db.session.commit()
        return jsonify({'success': True, 'data': _survey_dict(survey)})
    except ValueError:
        db.session.rollback()
        return _error('closes_at 형식이 올바르지 않습니다.', 400)
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


@admin_bp.route('/<int:survey_id>/results', methods=['GET'])
@manager_required
def survey_results(survey_id):
    """집계. **응답자 신원은 실리지 않는다.**

    응답 수를 항상 같이 낸다. 몇 명이 답했는지 모르는 평균은 숫자 구경이다.
    소속을 모르는 응답도 따로 센다 — 숨기면 그럴듯한 사업부별 평균이 나오는데
    실은 절반이 어디 것인지 모르는 상태가 된다.
    """
    survey = Survey.query.get(survey_id)
    if not survey:
        return _error('설문을 찾을 수 없습니다.', 404)

    responses = survey.responses.filter(
        SurveyResponse.submitted_at.isnot(None)
    ).all()
    questions = survey.questions.all()

    by_question = {}
    for q in questions:
        entry = {
            'question_id': q.id, 'text': q.text, 'qtype': q.qtype,
            'section': q.section,
            # ⚠️ 이 두 칸이 없으면 집계 화면의 **'묻지 않은 문항'** 표시가
            #    통째로 죽는다. 그러면 그 역할에게 안 보인 문항이 '응답 0' 과
            #    같은 모양으로 찍혀서, 아무도 안 답한 것으로 읽힌다.
            'audience_roles': q.audience_roles or [],
            'audience_processes': q.audience_processes or [],
            'link_type': q.link_type, 'link_key': q.link_key,
            'answer_count': 0,
        }
        if q.qtype == 'scale':
            entry.update({'average': None, 'distribution': {}, 'by_division': {}})
        else:
            entry['values'] = []
        by_question[q.id] = entry

    # 답을 한 번에 읽는다.
    #
    # 예전에는 `for r in responses: for a in r.answers.all()` 라 **응답 수만큼
    # 질의가 나갔다.** 문항 5개짜리 설문에서는 티가 안 나지만, 표로 수십 문항을
    # 넣은 설문에 수백 명이 답하면 그 자리에서 집계 화면이 멈춘다.
    answers_by_response = {}
    if responses:
        for a in SurveyAnswer.query.filter(
            SurveyAnswer.response_id.in_([r.id for r in responses])
        ).all():
            answers_by_response.setdefault(a.response_id, []).append(a)

    def _slice_add(slice_, question, value_number):
        """역할·프로세스 칸에 답 하나를 더한다."""
        # 키를 문자열로 둔다 — JSON 으로 나가면 어차피 문자열이 된다.
        cell = slice_['questions'].setdefault(str(question.id), {
            'answer_count': 0,
            **({'average': None, 'distribution': {}, '_sum': 0.0}
               if question.qtype == 'scale' else {}),
        })
        cell['answer_count'] += 1
        if question.qtype == 'scale' and value_number is not None:
            cell['_sum'] += value_number
            key = str(int(value_number))
            cell['distribution'][key] = cell['distribution'].get(key, 0) + 1

    role_slices, process_slices = {}, {}
    totals = {}              # 전체 평균
    division_totals = {}     # 사업부별
    question_by_id = {q.id: q for q in questions}

    for r in responses:
        # 축을 안 고른 응답은 '미지정'에 센다. 아무 역할에나 넣으면 그 역할의
        # 평균이 조용히 바뀌고, 표본이 몇인지도 알 수 없게 된다.
        rslice = role_slices.setdefault(
            r.respondent_role or UNSET_BUCKET, {'count': 0, 'questions': {}})
        rslice['count'] += 1
        pslice = process_slices.setdefault(
            r.respondent_process or UNSET_BUCKET, {'count': 0, 'questions': {}})
        pslice['count'] += 1

        for a in answers_by_response.get(r.id, []):
            entry = by_question.get(a.question_id)
            if entry is None:
                continue
            q = question_by_id[a.question_id]
            if entry['qtype'] == 'scale':
                if a.value_number is None:
                    continue
                entry['answer_count'] += 1
                key = str(int(a.value_number))
                entry['distribution'][key] = entry['distribution'].get(key, 0) + 1

                agg = totals.setdefault(a.question_id, {'sum': 0.0, 'n': 0})
                agg['sum'] += a.value_number
                agg['n'] += 1

                bucket = division_totals.setdefault(a.question_id, {})
                # 사업부를 모르면 'unknown' 으로 따로 모은다. 아무 데나 넣지 않는다.
                dkey = str(r.division_id) if r.division_id else 'unknown'
                dagg = bucket.setdefault(dkey, {'sum': 0.0, 'n': 0})
                dagg['sum'] += a.value_number
                dagg['n'] += 1

                _slice_add(rslice, q, a.value_number)
                _slice_add(pslice, q, a.value_number)
            else:
                entry['answer_count'] += 1
                # 자유서술이면 원문, 객관식·순위면 JSON. 둘 다 원자료 그대로 둔다 —
                # 집계만 남기면 AI 요약에 근거를 달 수 없다.
                entry['values'].append(
                    a.value_text if a.value_text is not None else a.value_json
                )
                _slice_add(rslice, q, None)
                _slice_add(pslice, q, None)

    # ⚠️ 전체 평균은 **사업부 집계와 따로** 낸다. 예전에는 사업부 루프 안에서
    #    나오는 부산물이었다. 그 상태로 축을 하나 더 붙이면, 축을 손댈 때마다
    #    전체 평균이 조용히 같이 움직인다. 두 관심사를 갈라 둔다.
    for qid, agg in totals.items():
        by_question[qid]['average'] = round(agg['sum'] / agg['n'], 2) if agg['n'] else None
    for qid, buckets in division_totals.items():
        by_question[qid]['by_division'] = {
            k: {'average': round(v['sum'] / v['n'], 2), 'count': v['n']}
            for k, v in buckets.items() if v['n']
        }

    def _finish(slices):
        """누적기(_sum)를 평균으로 바꾸고 내부 칸을 지운다."""
        for slice_ in slices.values():
            for cell in slice_['questions'].values():
                if '_sum' in cell:
                    n = cell['answer_count']
                    cell['average'] = round(cell['_sum'] / n, 2) if n else None
                    del cell['_sum']
        return slices

    targets = target_user_ids(survey)
    unknown = sum(1 for r in responses if not r.division_id)
    return jsonify({'success': True, 'data': {
        'survey': _survey_dict(survey),
        'target_count': len(targets),
        'response_count': len(responses),
        'unknown_division_count': unknown,
        'questions': [by_question[q.id] for q in questions],
        # 역할·프로세스별 집계.
        #
        # ⚠️ 여기에는 **원문(values)을 싣지 않는다.** 역할로 한 번 더 자르면
        #    표본이 한 명까지 내려가는 칸이 나온다. 그 칸에 서술형 원문을
        #    실으면 "그 역할의 그 사람"이 되어 사실상 기명 응답이 된다.
        #    원문이 필요하면 위의 questions[] 를 본다.
        'by_role': _finish(role_slices),
        'by_process': _finish(process_slices),
    }})


@admin_bp.route('/<int:survey_id>/export', methods=['GET'])
@manager_required
def export_responses(survey_id):
    """응답 원자료를 CSV 로. 한 응답이 한 줄이다.

    운영에서 집계를 따로 돌리거나 보고서에 붙이려면 화면 밖으로 꺼낼 수 있어야
    한다. 화면에서 눈으로 옮겨 적게 두면 반드시 틀린다.

    ⚠️ **응답자 이름·계정은 넣지 않는다.** 내보낸 파일은 메일로 돌아다니고
       누가 열지 통제할 수 없다. 신원이 필요하면 화면의 '응답자 확인'을 쓰고,
       그건 열람 기록이 남는다. 여기서 한 줄 넣어 두면 그 통제가 통째로
       무의미해진다.

    ⚠️ 엑셀이 UTF-8 CSV 를 cp949 로 열어 한글이 깨지므로 **BOM 을 붙인다.**
       파일을 열자마자 깨져 보이면 아무도 두 번 쓰지 않는다.
    """
    import csv as _csv
    import io as _io
    from flask import Response

    survey = Survey.query.get(survey_id)
    if not survey:
        return _error('설문을 찾을 수 없습니다.', 404)

    questions = survey.questions.all()
    responses = survey.responses.filter(
        SurveyResponse.submitted_at.isnot(None)
    ).order_by(SurveyResponse.id).all()

    divisions = {}
    try:
        from app.modules.digital_twin_dashboard.models import Division
        divisions = {d.id: d.name for d in Division.query.all()}
    except Exception:
        pass

    buf = _io.StringIO()
    writer = _csv.writer(buf)
    writer.writerow(
        ['응답번호', '제출시각', '수정시각', '역할', '역할판정', '프로세스',
         '부서', '사업부']
        + [f'{q.section + " / " if q.section else ""}{q.text}' for q in questions]
    )

    for r in responses:
        by_q = {}
        for a in r.answers.all():
            if a.value_number is not None:
                by_q[a.question_id] = a.value_number
            elif a.value_text is not None:
                by_q[a.question_id] = a.value_text
            elif a.value_json is not None:
                # 목록형은 사람이 읽을 수 있게 편다. JSON 그대로 두면 엑셀에서
                # 세로로 못 센다.
                v = a.value_json
                by_q[a.question_id] = ' | '.join(str(x) for x in v)                     if isinstance(v, list) else str(v)
        writer.writerow([
            r.id,
            r.submitted_at.isoformat(sep=' ', timespec='minutes') if r.submitted_at else '',
            r.updated_at.isoformat(sep=' ', timespec='minutes') if r.updated_at else '',
            r.respondent_role or '',
            r.role_source or '',
            r.respondent_process or '',
            r.department_name or '',
            divisions.get(r.division_id, '') if r.division_id else '',
        ] + [by_q.get(q.id, '') for q in questions])

    db.session.add(SurveyAccessLog(
        survey_id=survey.id,
        viewer_id=int(get_jwt_identity()),
        action='export',
    ))
    db.session.commit()

    body = '﻿' + buf.getvalue()
    name = f'survey_{survey.id}_responses.csv'
    return Response(body, mimetype='text/csv; charset=utf-8', headers={
        'Content-Disposition': f'attachment; filename="{name}"',
    })


@admin_bp.route('/<int:survey_id>/identities', methods=['GET'])
@manager_required
def survey_identities(survey_id):
    """응답자 확인. **고지한 대로 감사 로그를 남긴다.**

    남기지 않으면 "관리자는 확인할 수 있습니다"라는 고지가 면피 문구가 된다.
    """
    try:
        survey = Survey.query.get(survey_id)
        if not survey:
            return _error('설문을 찾을 수 없습니다.', 404)

        responses = survey.responses.filter(
            SurveyResponse.submitted_at.isnot(None)
        ).all()
        names = {
            u.id: (u.name or u.email)
            for u in User.query.filter(
                User.id.in_([r.user_id for r in responses] or [0])
            ).all()
        }

        db.session.add(SurveyAccessLog(
            survey_id=survey.id,
            viewer_id=int(get_jwt_identity()),
            action='list_identities',
        ))
        db.session.commit()

        return jsonify({'success': True, 'data': [
            serialize_response(r, reveal=True, user_names=names) for r in responses
        ]})
    except Exception as e:
        db.session.rollback()
        return _error(str(e))


# ══ 응답자용 ═══════════════════════════════════════════════════════════════
#
# 로그인만 요구한다. 역할은 보지 않는다 — 설문은 전사 대상이다.
# 대신 **대상자인지는 반드시 본다.** 그 판정은 is_target() 한 곳에서만 한다.

def _current_user():
    return User.query.get(int(get_jwt_identity()))


def _my_open_surveys(user):
    """내가 받은, 지금 응답 가능한 설문."""
    now = datetime.utcnow()
    surveys = Survey.query.filter_by(status='open').all()
    return [s for s in surveys if _accepting(s, now) and is_target(user, s)]


@respond_bp.route('/mine', methods=['GET'])
@jwt_required()
def my_surveys():
    user = _current_user()
    if not user:
        return _error('사용자를 찾을 수 없습니다.', 404)

    answered = {
        r.survey_id for r in SurveyResponse.query.filter_by(user_id=user.id)
        .filter(SurveyResponse.submitted_at.isnot(None)).all()
    }
    out = []
    for s in _my_open_surveys(user):
        out.append({
            'id': s.id,
            'title': s.title,
            'description': s.description,
            'closes_at': s.closes_at.isoformat() if s.closes_at else None,
            'question_count': s.questions.count(),
            'answered': s.id in answered,
        })
    # 미응답을 먼저 보여준다.
    out.sort(key=lambda x: (x['answered'], x['id']))
    return jsonify({'success': True, 'data': out})


@respond_bp.route('/mine/count', methods=['GET'])
@jwt_required()
def my_pending_count():
    """홈 카드 배지용. 미응답 건수만 센다."""
    user = _current_user()
    if not user:
        return jsonify({'success': True, 'data': {'pending': 0}})

    answered = {
        r.survey_id for r in SurveyResponse.query.filter_by(user_id=user.id)
        .filter(SurveyResponse.submitted_at.isnot(None)).all()
    }
    pending = sum(1 for s in _my_open_surveys(user) if s.id not in answered)
    return jsonify({'success': True, 'data': {'pending': pending}})


def _my_answers(response):
    """내가 낸 답을 {문항id: 값} 으로. 화면이 그대로 폼에 채운다.

    유형마다 값이 담긴 칸이 다르므로(models.SurveyAnswer) 여기서 하나로 편다.
    화면이 세 칸을 다 뒤지게 두면 그 규칙이 두 곳으로 갈린다.
    """
    if response is None:
        return {}
    out = {}
    for a in response.answers.all():
        if a.value_number is not None:
            out[str(a.question_id)] = a.value_number
        elif a.value_text is not None:
            out[str(a.question_id)] = a.value_text
        elif a.value_json is not None:
            out[str(a.question_id)] = a.value_json
    return out


@respond_bp.route('/<int:survey_id>/form', methods=['GET'])
@jwt_required()
def survey_form(survey_id):
    """응답 화면이 쓸 문항. **대상자가 아니면 존재 자체를 알려주지 않는다.**

    ⚠️ **역할·프로세스로 문항을 미리 걸러 보내지 않는다.** 응답자는 역할을
       바꿔가며 볼 수 있어야 하는데, 서버가 걸러 보내면 고를 때마다 다시
       불러야 하고 그 사이 적어 둔 답이 날아간다. **거르는 것은 화면이 하고,
       검증은 서버가 한다**(submit_response 의 question_applies).
       문항 목록 자체는 숨길 것이 아니다 — 숨길 것은 대상자 판정이고, 그건
       위에서 이미 막았다.
    """
    user = _current_user()
    survey = Survey.query.get(survey_id)
    if not survey or not user or not is_target(user, survey):
        return _error('설문을 찾을 수 없습니다.', 404)
    if not _accepting(survey):
        return _error('지금은 응답을 받지 않는 설문입니다.', 409)

    existing = SurveyResponse.query.filter_by(
        survey_id=survey.id, user_id=user.id
    ).first()
    division_id, division_name, source = resolve_division(user)

    # 이 사람이 실제로 해당하는 역할. 설문이 묻는 목록과 겹치는 것만 준다 —
    # 설문이 안 묻는 역할을 기본값으로 주면 제출이 막힌다(_pick_axis).
    asked_roles = survey.roles or []
    derived = [r for r in derive_roles(user) if r in asked_roles]

    return jsonify({'success': True, 'data': {
        **_survey_dict(survey, with_questions=True),
        'already_answered': bool(existing and existing.submitted_at),
        # 사업부는 **읽기 전용**이다. 화면은 이 값을 보여 주기만 하고 되돌려
        # 보내지 않는다. 이름까지 주는 것은 화면이 사업부 목록을 따로 받아
        # 번호를 이름으로 바꾸지 않게 하려는 것이다 — 그 목록은 응답자에게
        # 필요 없고, 있으면 고를 수 있는 것처럼 보인다.
        'division_id': division_id,
        'division_name': division_name,
        'division_source': source,
        'department_name': user.department,
        # ⚠️ 역할은 **데이터에서 유도한다.** 자유롭게 고르게 두면 역할별 집계가
        #    자칭이 되어 의미를 잃는다. 다만 knoxId 가 안 채워진 과제가 많아
        #    유도가 안 되는 사람이 실제로 많으므로(SURVEY_PLAN 7절), 그때는
        #    고르게 하고 **고른 것인지 유도된 것인지를 응답에 남긴다.**
        'derived_roles': derived,
        'role_source': 'derived' if derived else 'picked',
        # 이미 낸 답. **마감 전이면 고칠 수 있으므로 되돌려 준다** — 안 주면
        # 고치려는 사람이 처음부터 다시 적어야 하고, 그러면 대충 적거나 아예
        # 안 고친다. 고친 값만 보내는 것이 아니라 통째로 다시 내는 구조라
        # (답을 갈아끼운다) 이전 답이 화면에 있어야 한다.
        'my_answers': _my_answers(existing),
        'my_role': existing.respondent_role if existing else None,
        'my_process': existing.respondent_process if existing else None,
    }})


@respond_bp.route('/<int:survey_id>/responses', methods=['POST'])
@jwt_required()
def submit_response(survey_id):
    """응답 제출. 1인 1회.

    답을 통째로 한 트랜잭션에 담는다. 일부만 저장되면 집계가 조용히 틀어진다.
    """
    try:
        user = _current_user()
        survey = Survey.query.get(survey_id)
        if not survey or not user or not is_target(user, survey):
            return _error('설문을 찾을 수 없습니다.', 404)
        if not _accepting(survey):
            return _error('지금은 응답을 받지 않는 설문입니다.', 409)

        # ⚠️ **마감 전이면 고칠 수 있다.**
        #
        # 예전에는 한 번 내면 끝이라 오타 하나에도 손쓸 방법이 없었다. 그러면
        # 사람들은 확신이 설 때까지 안 내고 미루거나, 잘못 낸 채로 둔다 —
        # 둘 다 응답 품질을 떨어뜨린다. 받는 중(_accepting)이면 다시 낸 것으로
        # 갈아끼운다. 마감 뒤에는 위에서 이미 막혔다.
        #
        # 새로 만들지 않고 **같은 행을 고친다.** (survey_id, user_id) 유니크가
        # 걸려 있어 새로 만들면 터지고, 무엇보다 응답이 여러 벌 쌓이면 어느
        # 것이 정본인지 갈린다.
        response = SurveyResponse.query.filter_by(
            survey_id=survey.id, user_id=user.id
        ).first()
        editing = response is not None

        payload = request.get_json() or {}
        answers = payload.get('answers')
        if not isinstance(answers, dict):
            return _error('answers 가 필요합니다.', 400)

        # ── 응답자가 고른 축 ─────────────────────────────────────────────
        #
        # 설문이 묻는 축이면 반드시 받는다. 안 받으면 그 축이 걸린 필수 문항이
        # 전부 '해당 없음'이 되어, 아무것도 안 고르는 것만으로 필수 검증을
        # 통째로 건너뛸 수 있다.
        role, error = _pick_axis(payload.get('respondent_role'),
                                 survey.roles or [], '역할')
        if error:
            return _error(error, 400)
        # 고른 역할이 데이터로 뒷받침되는가. 화면이 보낸 말을 믿지 않고
        # **서버가 다시 유도해서** 판정한다 — 화면 값을 그대로 저장하면
        # 자칭 PL 이 'derived' 로 기록될 수 있다.
        role_source = None
        if role:
            role_source = 'derived' if role in derive_roles(user) else 'picked'
        process, error = _pick_axis(payload.get('respondent_process'),
                                    survey.processes or [], '프로세스')
        if error:
            return _error(error, 400)

        questions = {q.id: q for q in survey.questions.all()}
        # 이 응답자가 실제로 받은 문항. **필수 판정은 이 집합에 대해서만 한다** —
        # 설문 전체로 판정하면 PL 용 필수 문항 때문에 과제 멤버가 영영 제출을
        # 못 한다. 화면에는 안 보이는 문항을 서버가 요구하는 꼴이라, 사용자는
        # 왜 막혔는지 알 방법도 없다.
        asked = {qid: q for qid, q in questions.items()
                 if question_applies(q, role, process)}

        # ⚠️ 받을 문항이 하나도 없으면 **받지 않는다.**
        #
        # 그냥 통과시키면 빈 응답이 201 로 저장되고, (survey, user) 유니크
        # 때문에 그 사람의 '1인 1회'가 소진된다. 표를 고쳐 문항을 붙여도 그
        # 사람은 영영 못 낸다. 화면은 애초에 제출을 막으므로, 여기까지 온 것은
        # 설문 구성이 잘못됐다는 뜻이다 — 그 사실을 말해 준다.
        if not asked:
            picked = ' / '.join(x for x in (role, process) if x)
            return _error(
                f'{picked or "선택하신 조건"}에 해당하는 문항이 없습니다. '
                '설문 구성을 확인해 달라고 담당자에게 알려 주세요.', 409)
        for qid, q in asked.items():
            if q.required and not _has_answer(
                answers.get(str(qid), answers.get(qid))
            ):
                return _error(f'필수 문항에 답하지 않았습니다: {q.text}', 400)

        # ⚠️ **DB 를 건드리기 전에 전부 검증한다.** 넣으면서 검사하면 중간에
        #    걸렸을 때 앞부분이 이미 들어가 있고, 되돌리는 것을 한 번만 빠뜨려도
        #    답이 일부만 남는다. 그런 데이터는 집계를 조용히 틀어뜨려서
        #    가장 잡기 어렵다.
        #
        # qid 로 모아 둔다. 같은 문항이 두 번 실려 오면 유니크 제약이 commit
        # 시점에 터지고, 사용자는 400 이 아니라 DB 원문이 섞인 500 을 본다.
        prepared = {}
        for key, value in answers.items():
            try:
                qid = int(key)
            except (TypeError, ValueError):
                return _error(f'문항 번호가 올바르지 않습니다: {key}', 400)
            q = questions.get(qid)
            if q is None:
                return _error(f'이 설문의 문항이 아닙니다: {qid}', 400)
            if qid not in asked:
                # 해당 없는 문항의 답은 **조용히 버린다. 오류가 아니다.**
                # 화면에서 역할을 바꾸면 앞서 적은 답이 남아 있을 수 있는데,
                # 그걸 400 으로 막으면 사용자는 이유를 모른 채 제출이 안 된다.
                continue
            if q.qtype == 'scale' and value is not None:
                try:
                    value = float(value)
                except (TypeError, ValueError):
                    return _error(f'척도 문항에는 숫자가 필요합니다: {q.text}', 400)
                # ⚠️ 범위를 여기서 막는다.
                #
                # 안 막으면 평균은 그 값을 넣어 계산하는데 분포 막대는 1~5 만
                # 그리므로, **평균과 막대가 서로 다른 이야기**를 한다. 합계가
                # 응답 수와 안 맞는데 화면 어디에도 그 사실이 안 나온다.
                # 범위는 문항이 정한다(options.min/max), 없으면 1~5.
                opts = q.options or {}
                low = opts.get('min', 1)
                high = opts.get('max', 5)
                try:
                    low, high = float(low), float(high)
                except (TypeError, ValueError):
                    low, high = 1.0, 5.0
                if not (low <= value <= high):
                    return _error(
                        f'척도 문항의 답이 범위를 벗어났습니다({low:g}~{high:g}): '
                        f'{value:g} — {q.text}', 400)
            prepared[qid] = (q, value)

        # ⚠️ payload 의 division_id 는 **일부러 무시한다.** 소속은 계정에서만
        #    정한다(resolve_division 의 설명). 예전 화면은 응답자가 고른 값을
        #    여기로 보냈고 서버는 그것을 그대로 믿었다 — 그 경로를 없앤다.
        #    옛 화면이 브라우저 캐시에 남아 계속 보낼 수 있으므로, 400 으로
        #    막지 말고 조용히 버린다. 막으면 새 창을 열기 전까지 제출이 안 된다.
        division_id, _division_name, source = resolve_division(user)

        if editing:
            # 답을 통째로 갈아끼운다. 남겨 두면 이번에 해당 없는 문항의 옛 답이
            # 남아, 역할을 바꿔 다시 낸 사람의 응답에 두 역할의 답이 섞인다.
            for old_answer in response.answers.all():
                db.session.delete(old_answer)
            response.department_name = user.department
            response.division_id = division_id
            response.division_source = source
            response.respondent_role = role
            response.respondent_process = process
            response.role_source = role_source
            # submitted_at 은 **처음 낸 때**로 둔다. 고친 시각은 updated_at 이
            # 들고 있으므로, 덮어쓰면 "언제 처음 답했나"를 잃는다.
            if response.submitted_at is None:
                response.submitted_at = datetime.utcnow()
        else:
            response = SurveyResponse(
                survey_id=survey.id,
                user_id=user.id,
                department_name=user.department,
                division_id=division_id,
                division_source=source,
                respondent_role=role,
                respondent_process=process,
                role_source=role_source,
                submitted_at=datetime.utcnow(),
            )
            db.session.add(response)
        db.session.flush()

        for q, value in prepared.values():
            answer = SurveyAnswer(response_id=response.id, question_id=q.id)
            if q.qtype == 'scale':
                answer.value_number = value
            elif q.qtype == 'text':
                answer.value_text = value
            else:
                answer.value_json = value
            db.session.add(answer)

        db.session.commit()
        return jsonify({'success': True, 'data': {'id': response.id}}), 201
    except Exception as e:
        db.session.rollback()
        return _error(str(e))
