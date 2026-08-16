"""개발 DB 에 설문 샘플을 만든다. **개발 전용. 운영에서 돌리지 않는다.**

화면을 보려면 데이터가 있어야 하는데, 개발 DB 에는 계정이 8명뿐이라 표본 하한
(5명)을 넘는 칸이 하나도 안 나온다. 그래서 응답자를 만들어 채운다.

**모든 샘플에 표식을 단다.** 계정은 `@sample.invalid`, 설문 제목은 `[샘플]`.
표식이 없으면 며칠 뒤 이것을 진짜 데이터로 착각한다 — 개발 DB 에서 제일 흔한
사고다.

    py -3.13 scripts/make_survey_sample.py          만들기 (이미 있으면 다시 만듦)
    py -3.13 scripts/make_survey_sample.py --clean  전부 지우기

화면에 무엇이 보이게 되는지는 만들고 나서 요약해 준다.

── 무엇을 보이게 하려고 이렇게 만드는가 ──────────────────────────────────

숫자를 아무렇게나 채우면 화면은 채워지지만 **판단이 필요한 상태는 안 나온다.**
그래서 각 상태가 하나씩 나오도록 일부러 배치한다:

    표본 부족        의료기기 3명 — 제안값이 안 나오는 칸을 봐야 한다
    역할 간 격차     역할·책임을 PL 은 높게, 참여인력은 낮게 본다
    사업부 간 격차   MX 와 NW 가 벌어진다
    전사 공통 저점   성과 측정이 어디서나 낮다
    객관식 쏠림      '데이터 정합성' 으로 몰린다
    진단 대상 밖     GTR 5명 (기능조직이라 진단 안 함)
    소속 미확인      3명 (소속그룹에 사업부가 안 매인 계정)
"""
import argparse
import io
import logging
import os
import random
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from app import create_app                                    # noqa: E402
from app.extensions import db                                 # noqa: E402
from app.modules.auth.models import User, UserRole            # noqa: E402
from app.modules.survey.models import (                       # noqa: E402
    Survey, SurveyAnswer, SurveyQuestion, SurveyResponse,
)

SAMPLE_DOMAIN = '@sample.invalid'
SAMPLE_TAG = '[샘플]'

# 같은 결과가 나오게 고정한다. 돌릴 때마다 숫자가 바뀌면 "어제 본 화면"을
# 다시 못 만든다.
RNG = random.Random(20260816)

ROLE_HEAD = '사무국장'
ROLE_OFFICE = '사업부 사무국'
ROLE_PL = 'PL'
ROLE_MEMBER = '과제 참여인력'

# (부서, 인원, 성향). 성향은 그 사업부의 기본 점수대다.
#
# ⚠️ 의료기기를 일부러 3명으로 둔다. **표본 부족 칸을 화면에서 봐야** 하한이
#    왜 있는지가 눈에 들어온다.
POPULATION = [
    ('CAE그룹(MX)',                 9, 3.9),
    ('Digital Twin사무국(MX)',      4, 4.1),
    ('Mecha그룹(VD)',               8, 3.4),
    ('Digital Twin사무국(VD)',      3, 3.5),
    ('CAE그룹(DA)',                 7, 3.2),
    ('Digital Twin사무국(DA)',      3, 3.3),
    ('Digital Twin사무국(네트워크)', 7, 2.6),
    ('Digital Twin사무국(의료기기)', 3, 3.0),   # ← 표본 부족
    ('Digital Twin사무국(생기연)',   5, 3.4),   # ← GTR, 진단 대상 밖
    (None,                          3, 3.1),   # ← 소속 미확인
]

# 역할 분포. 사무국 부서는 사무국 비중을 높인다.
ROLE_MIX = [ROLE_PL, ROLE_MEMBER, ROLE_MEMBER, ROLE_MEMBER, ROLE_OFFICE]
ROLE_MIX_OFFICE = [ROLE_OFFICE, ROLE_OFFICE, ROLE_PL, ROLE_MEMBER]

BLOCKERS = ['데이터 정합성', '기준·표준 불일치', '인력 부족', '도구 미숙', '타 부서 협조']
PRIORITIES = ['데이터 표준화', '인력 충원', '교육', '도구 통합', '프로세스 정비']

# 되풀이되는 이야기가 보이도록 **몇 갈래로 모아** 적는다. 전부 다른 말이면
# 묶을 것이 없고, 전부 같은 말이면 묶기가 시험이 안 된다.
FREE_TEXT = [
    # 데이터가 두 번 들어간다
    '데이터를 두 번 입력합니다. 시스템이 이어져 있지 않아서 사람이 옮깁니다.',
    'PLM 에 넣은 값을 MES 에 또 넣습니다. 옮기다 틀리면 어디서 틀렸는지 못 찾습니다.',
    '같은 데이터를 부서마다 따로 관리해서, 어느 것이 맞는지 회의에서 정합니다.',
    # 기준이 사업부마다 다르다
    '무엇을 성과로 볼지 사업부마다 달라서, 잘했다는 말을 서로 다른 뜻으로 씁니다.',
    '기준이 사업부마다 달라 비교가 안 됩니다. 잘하고 있는지 아닌지를 모릅니다.',
    '성과 지표를 과제마다 새로 만듭니다. 끝나고 나면 비교할 수가 없습니다.',
    # 설계 변경이 늦게 온다
    '설계 변경이 제조로 넘어오는 데 시간이 걸립니다. 그 사이에 만든 모델은 이미 옛것입니다.',
    '변경 사항을 메일로 받습니다. 놓치면 그대로 잘못된 모델로 검토합니다.',
    # 배울 자리가 없다
    '도구는 있는데 쓰는 법을 배울 자리가 없습니다.',
    '교육이 한 번뿐이라, 실제로 쓸 때가 되면 다 잊어버립니다.',
    # 책임이 불분명하다
    '모델이 틀렸을 때 누구에게 말해야 하는지 모르겠습니다.',
    '과제가 끝나면 그 결과물이 어디로 가는지 알 수 없습니다.',
]


def _clamp(value):
    return max(1, min(5, int(round(value))))


def _score(base, shift=0.0, spread=0.7):
    """성향 언저리의 정수 점수. 사람마다 흔들려야 분포가 사람처럼 보인다."""
    return _clamp(RNG.gauss(base + shift, spread))


def clean():
    """샘플을 전부 지운다. 표식이 붙은 것만 건드린다."""
    surveys = Survey.query.filter(Survey.title.like(f'{SAMPLE_TAG}%')).all()
    for survey in surveys:
        db.session.delete(survey)      # 문항·응답·답은 cascade
    users = User.query.filter(User.email.like(f'%{SAMPLE_DOMAIN}')).all()
    for user in users:
        db.session.delete(user)
    db.session.commit()
    return len(surveys), len(users)


def make_users():
    """샘플 응답자. 부서를 넣어 두면 사업부는 서버가 계정에서 유도한다."""
    made = []
    seq = 0
    for department, count, mood in POPULATION:
        for _ in range(count):
            seq += 1
            user = User(
                email=f'sample{seq:03d}{SAMPLE_DOMAIN}',
                name=f'샘플·응답자{seq:03d}',
                role=UserRole.USER,
                department=department,
                is_active=True,
            )
            user.set_password('sample-only-not-for-login')
            db.session.add(user)
            made.append((user, mood))
    db.session.flush()
    return made


def _q(survey, order, section, text, qtype, **kw):
    question = SurveyQuestion(
        survey_id=survey.id, order=order, section=section, text=text,
        qtype=qtype, required=kw.pop('required', True),
        options=kw.pop('options', {}),
        help_text=kw.pop('help_text', None),
        audience_roles=kw.pop('roles', []),
        audience_processes=kw.pop('processes', []),
        link_key=kw.pop('link_key', None),
    )
    if question.link_key:
        question.link_type = 'strategy_dimension'
    db.session.add(question)
    return question


SCALE = {'min': 1, 'max': 5, 'minLabel': '없음', 'maxLabel': '지속 개선'}


def make_main_survey(plan_id, processes):
    """마감된 설문. 이것이 진단으로 들어간다."""
    survey = Survey(
        title=f'{SAMPLE_TAG} 2026 디지털 트윈 조직 역량 진단',
        description='조직이 디지털 트윈을 얼마나 자리잡게 했는지를 봅니다. '
                    '응답자 이름은 집계에 나오지 않습니다.',
        status='closed', target_type='all',
        context_type='strategy_plan', context_id=plan_id,
        roles=[ROLE_HEAD, ROLE_OFFICE, ROLE_PL, ROLE_MEMBER],
        processes=processes,
        closes_at=datetime.utcnow() - timedelta(days=3),
    )
    db.session.add(survey)
    db.session.flush()

    linked = {}
    n = 0
    # ── 공통 ──────────────────────────────────────────────────────────
    linked['ready_goal'] = _q(
        survey, n, '공통', '올해 우리 조직의 디지털 트윈 목표를 알고 있습니까?',
        'scale', options=dict(SCALE), link_key='organization:readiness',
        help_text='1=전혀 모른다, 5=명확히 안다')
    n += 1
    linked['ready_env'] = _q(
        survey, n, '공통', '일하는 데 필요한 데이터·도구·인력이 갖춰져 있습니까?',
        'scale', options=dict(SCALE), link_key='organization:readiness')
    n += 1
    linked['redesign'] = _q(
        survey, n, '공통', '디지털 트윈이 평소 업무 흐름 안에 들어와 있습니까?',
        'scale', options=dict(SCALE), link_key='organization:redesign',
        help_text='따로 돌리는 별도 활동인지, 평소 일하는 과정 안에 있는지')
    n += 1
    linked['blocker'] = _q(
        survey, n, '공통', '가장 큰 걸림돌은 무엇입니까?',
        'choice', options={'choices': list(BLOCKERS)})
    n += 1
    linked['ret_measure'] = _q(
        survey, n, '공통', '무엇으로 좋아졌다고 말할지 정해져 있습니까?',
        'scale', options=dict(SCALE), link_key='organization:return')
    n += 1

    # ── 과제 수행 (PL·참여인력) ───────────────────────────────────────
    linked['ready_data'] = _q(
        survey, n, '과제 수행', '담당 과제에 필요한 데이터가 제때 모입니까?',
        'scale', options=dict(SCALE), link_key='organization:readiness',
        roles=[ROLE_PL, ROLE_MEMBER])
    n += 1
    linked['role_clear'] = _q(
        survey, n, '과제 수행', '과제원의 역할과 책임이 분명합니까?',
        'scale', options=dict(SCALE), link_key='organization:role',
        roles=[ROLE_PL, ROLE_MEMBER])
    n += 1
    linked['risk'] = _q(
        survey, n, '과제 수행',
        '모델이 현실과 어긋났을 때 무엇이 깨지고 어떻게 되돌릴지 정해져 있습니까?',
        'scale', options=dict(SCALE), link_key='organization:risk',
        roles=[ROLE_PL, ROLE_MEMBER])
    n += 1

    # ── 과제 관리 (PL 전용) ───────────────────────────────────────────
    linked['ret_kpi'] = _q(
        survey, n, '과제 관리', '과제 성과를 KPI 로 설명할 수 있습니까?',
        'scale', options=dict(SCALE), link_key='organization:return',
        roles=[ROLE_PL])
    n += 1
    linked['priority'] = _q(
        survey, n, '과제 관리', '먼저 풀어야 할 것을 순서대로 놓으세요.',
        'rank', options={'choices': list(PRIORITIES)}, roles=[ROLE_PL],
        required=False)
    n += 1

    # ── 사무국 (사무국·사무국장) ──────────────────────────────────────
    linked['role_view'] = _q(
        survey, n, '사무국', '사업부의 디지털 트윈 활동을 한눈에 볼 수 있습니까?',
        'scale', options=dict(SCALE), link_key='organization:role',
        roles=[ROLE_OFFICE, ROLE_HEAD])
    n += 1
    linked['free'] = _q(
        survey, n, '사무국', '개선이 필요하다고 보는 것을 적어 주세요.',
        'text', roles=[ROLE_OFFICE, ROLE_HEAD], required=False)
    n += 1
    # 전원 대상 서술형. 묶어 읽기의 재료는 이쪽이 더 많다 — 사무국만 물으면
    # 현장에서 나오는 말이 안 들어온다.
    linked['free_all'] = _q(
        survey, n, '공통', '일하면서 가장 답답한 것을 한 가지만 적어 주세요.',
        'text', required=False)
    n += 1

    # ── 프로세스 분기 (연계) ──────────────────────────────────────────
    if processes:
        linked['role_link'] = _q(
            survey, n, '프로세스', '연계가 필요한 부서와 협의가 원활합니까?',
            'scale', options=dict(SCALE), link_key='organization:role',
            processes=[processes[-1]], required=False)
    return survey, linked


def answer_main(survey, linked, people, processes):
    """설계한 모양대로 응답을 채운다."""
    made = 0
    for user, mood in people:
        role = RNG.choice(
            ROLE_MIX_OFFICE if (user.department or '').startswith('Digital Twin사무국')
            else ROLE_MIX)
        process = RNG.choice(processes) if processes else None

        from app.modules.survey.routes import resolve_division
        division_id, _name, source = resolve_division(user)

        response = SurveyResponse(
            survey_id=survey.id, user_id=user.id,
            department_name=user.department,
            division_id=division_id, division_source=source,
            respondent_role=role,
            respondent_process=process,
            # 대부분은 데이터로 유도된 것으로 둔다. 운영에서 실제로 그럴 값이다.
            role_source='derived' if RNG.random() < 0.85 else 'picked',
            submitted_at=datetime.utcnow() - timedelta(days=RNG.randint(4, 20)),
        )
        db.session.add(response)
        db.session.flush()
        made += 1

        def put(question, value=None, json_value=None):
            db.session.add(SurveyAnswer(
                response_id=response.id, question_id=question.id,
                value_number=value, value_json=json_value))

        put(linked['ready_goal'], _score(mood, 0.3))
        put(linked['ready_env'], _score(mood, -0.2))
        put(linked['redesign'], _score(mood, -0.1))
        # 객관식은 '데이터 정합성' 으로 몰리게 둔다. 쏠림이 있어야 그 규칙이 보인다.
        blocker = BLOCKERS[0] if RNG.random() < 0.55 else RNG.choice(BLOCKERS[1:])
        put(linked['blocker'], json_value=[blocker])
        # ⚠️ 성과 측정은 **어디서나 낮게** 둔다 — 전사 공통 저점 규칙이 뜨는
        #    것을 화면에서 봐야 한다. 사업부 성향(mood)을 일부러 안 섞는다.
        put(linked['ret_measure'], _clamp(RNG.gauss(1.9, 0.55)))

        if role in (ROLE_PL, ROLE_MEMBER):
            put(linked['ready_data'], _score(mood, -0.3))
            # ⚠️ 역할 간 격차. PL 은 역할이 분명하다고 보고, 참여인력은 아니라고
            #    본다 — 정보가 아래로 안 흐를 때 실제로 나오는 모양이다.
            put(linked['role_clear'],
                _score(mood, 0.9 if role == ROLE_PL else -0.7))
            put(linked['risk'], _score(mood, -0.5))

        if role == ROLE_PL:
            put(linked['ret_kpi'], _clamp(RNG.gauss(2.0, 0.55)))
            order = PRIORITIES[:]
            RNG.shuffle(order)
            put(linked['priority'], json_value=order[:3])

        def put_text(question, text):
            """서술형은 value_text 에 담긴다. put 은 숫자·JSON 용이라 따로 쓴다."""
            db.session.add(SurveyAnswer(
                response_id=response.id, question_id=question.id, value_text=text))

        if role in (ROLE_OFFICE, ROLE_HEAD):
            put(linked['role_view'], _score(mood, 0.2))
            if RNG.random() < 0.8:
                put_text(linked['free'], RNG.choice(FREE_TEXT))

        # 전원이 받는 서술형. 실제 설문에서도 절반쯤은 안 적는다.
        if RNG.random() < 0.55:
            put_text(linked['free_all'], RNG.choice(FREE_TEXT))

        if 'role_link' in linked and process == processes[-1]:
            put(linked['role_link'], _score(mood, -0.4))
    return made


def make_open_survey(plan_id, processes):
    """진행 중인 설문. **응답 화면을 직접 눌러 보려면** 열려 있는 것이 하나 필요하다."""
    survey = Survey(
        title=f'{SAMPLE_TAG} 2026 상반기 디지털 트윈 활용 실태',
        description='짧게 여쭙습니다. 마감 전까지는 고쳐서 다시 내실 수 있습니다.',
        status='open', target_type='all',
        context_type='strategy_plan', context_id=plan_id,
        roles=[ROLE_HEAD, ROLE_OFFICE, ROLE_PL, ROLE_MEMBER],
        processes=processes,
    )
    db.session.add(survey)
    db.session.flush()
    _q(survey, 0, '공통', '디지털 트윈 도구를 얼마나 자주 쓰십니까?', 'choice',
       options={'choices': ['매일', '주 1~2회', '가끔', '쓰지 않음']})
    _q(survey, 1, '공통', '일하는 데 필요한 여건이 갖춰져 있습니까?', 'scale',
       options=dict(SCALE), link_key='organization:readiness')
    _q(survey, 2, '과제 수행', '담당 과제에서 막히는 것을 모두 고르세요.', 'multi',
       options={'choices': list(BLOCKERS)}, roles=[ROLE_PL, ROLE_MEMBER],
       required=False)
    _q(survey, 3, '공통', '바라는 점을 적어 주세요.', 'text', required=False)
    return survey


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--clean', action='store_true', help='샘플을 지우고 끝낸다')
    args = parser.parse_args()

    app = create_app()
    with app.app_context():
        logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)

        uri = str(db.engine.url)
        # 운영에서 돌면 가짜 계정 50여 개가 실제 사용자 목록에 섞인다.
        if 'localhost' not in uri and '127.0.0.1' not in uri:
            print(f'로컬 DB 가 아닙니다. 중단합니다: {uri}')
            return 1

        surveys, users = clean()
        print(f'기존 샘플 정리: 설문 {surveys}건, 계정 {users}명')
        if args.clean:
            return 0

        from app.modules.digital_twin_strategy.models import StrategyPlan
        from app.modules.survey.roles import process_names

        year = datetime.utcnow().year
        plan = StrategyPlan.query.filter_by(year=year).first()
        if not plan:
            plan = StrategyPlan(year=year, title=f'{year}년 디지털 트윈 전략')
            db.session.add(plan)
            db.session.flush()
            print(f'{year}년 전략이 없어 새로 만들었습니다.')

        processes = process_names()
        people = make_users()
        survey, linked = make_main_survey(plan.id, processes)
        count = answer_main(survey, linked, people, processes)
        open_survey = make_open_survey(plan.id, processes)
        db.session.commit()

        print(f'\n샘플 계정 {len(people)}명, 응답 {count}건을 만들었습니다.')
        print(f'  마감 설문  #{survey.id} {survey.title}')
        print(f'  진행 설문  #{open_survey.id} {open_survey.title}')

        # 무엇이 보이게 됐는지 그 자리에서 확인해 준다. 만들어 놓고 화면에서
        # 아무것도 안 보이면 원인을 찾느라 시간이 다 간다.
        from app.modules.digital_twin_strategy.definitions import (
            get_target_divisions, get_thresholds,
        )
        from app.modules.digital_twin_strategy.survey_link import (
            collect, derive_choice_findings, derive_survey_findings,
        )
        thresholds = get_thresholds()
        min_sample = int(thresholds.get('survey_min_sample', 5))
        evidence = collect(plan, get_target_divisions(), min_sample)

        print('\n── 진단 화면의 「설문 근거」 ─────────────────')
        for cell in evidence['cells']:
            mark = f"제안 {cell['suggested_level']}" if not cell['insufficient'] \
                else f"표본 부족({cell['respondent_count']}명)"
            print(f"  {cell['dimension_label']:<8} {cell['division_name']:<6} "
                  f"평균 {cell['average']} · {cell['respondent_count']}명 → {mark}")
        for out in evidence['out_of_scope']:
            print(f"  [대상 밖] {out['division_name']} {out['respondent_count']}명")

        print('\n── 「발견 사항」에 뜨는 설문 항목 ──────────────')
        findings = (derive_survey_findings(evidence, thresholds, min_sample)
                    + derive_choice_findings(plan, thresholds, min_sample))
        for f in findings:
            print(f"  [{f['severity']}] {f['title']}")
        if not findings:
            print('  (없음 — 임계값을 넘은 것이 없습니다)')

        print('\n지우려면: py -3.13 scripts/make_survey_sample.py --clean')
        return 0


if __name__ == '__main__':
    sys.exit(main())
