"""
진단 기준 정의.

진단은 세 겹이다. 기술 수준만 재면 "만들어놓고 아무도 안 쓰는" 상태를 잡아내지
못한다. 기술이 4단계여도 활용이 바닥이면 전략적으로는 실패다.

    A. 기술 성숙도   사업부 × 5차원, 사람이 매김        (시스템이 모르는 것)
    B. 활용과 성과   사업부별, 포탈 데이터로 자동 산출   (시스템이 아는 것)
    C. 조직 역량     사업부 × 5축, 설문 위주            (사람에게 물어야 하는 것)

A 와 C 는 같은 표(strategy_assessment)에 category 로 구분해 담는다. 둘 다
1~5 로 매기지만 **레벨의 뜻이 다르다** — 기술은 무엇을 할 수 있는가, 조직은
얼마나 자리잡았는가를 잰다.

B 는 사람이 매기지 않는다. 계산된 관측값이다.

정의를 코드에 둔다. 없으면 사람마다 다르게 매기고 격차 숫자가 의미를 잃는다.
화면이 이 값을 툴팁으로 띄운다 — 문서에만 두면 아무도 읽지 않는다.
나중에 DB 로 옮겨 운영에서 편집하게 만든다(PLAN.md 4절).
"""

CATEGORY_TECHNICAL = 'technical'
CATEGORY_ORGANIZATION = 'organization'


# ── A. 기술 성숙도 ─────────────────────────────────────────────────────────
# 아래에서 위로 쌓인다. 데이터가 약한데 분석만 높을 수는 없다.
# 이 순서 자체가 "어디부터 손대야 하는가"를 알려준다.
TECHNICAL_DIMENSIONS = [
    {
        'key': 'data',
        'label': '데이터',
        'question': '현실의 값을 얼마나 확보하고 연결하고 있는가',
        'detail': '설비·공정·제품 데이터가 자동으로 쌓이는가, 아니면 수기로 모으는가.',
    },
    {
        'key': 'model',
        'label': '모델',
        'question': '대상을 얼마나 정밀하게 모사하는가',
        'detail': '형상만 있는가, 물리 거동까지 재현하는가.',
    },
    {
        'key': 'integration',
        'label': '통합',
        'question': '모델과 시스템이 서로 연결돼 있는가',
        'detail': 'PLM·MES·시뮬레이션 툴이 따로 노는가, 이어져 있는가.',
    },
    {
        'key': 'analysis',
        'label': '분석',
        'question': '무엇을 알아낼 수 있는가',
        'detail': '결과 확인에 그치는가, 예측·최적화까지 하는가.',
    },
    {
        'key': 'application',
        'label': '응용',
        'question': '실제 의사결정에 쓰이는가',
        'detail': '보고용인가, 업무 판단에 실제로 쓰이는가.',
    },
]

TECHNICAL_LEVELS = [
    {'value': 1, 'label': '없음 / 수기', 'detail': '체계가 없다. 필요할 때 사람이 직접 만든다.'},
    {'value': 2, 'label': '부분 디지털화', 'detail': '일부는 디지털이지만 개별적으로만 쓴다.'},
    {'value': 3, 'label': '연계 / 표준화', 'detail': '서로 이어져 있고 따르는 절차가 있다.'},
    {'value': 4, 'label': '예측 / 최적화', 'detail': '앞을 내다보고 더 나은 안을 찾는 데 쓴다.'},
    {'value': 5, 'label': '자동 반영 / 폐루프', 'detail': '결과가 현실에 자동으로 되돌아간다.'},
]


# ── C. 조직 역량 ───────────────────────────────────────────────────────────
# AX-5R(Systems, 2026)의 다섯 설계 기능을 진단 축으로 옮긴 것이다. 그 논문의
# 요지가 "도구만 주고 업무 재설계·책임·리스크·성과측정을 안 해서 전환이
# 실패한다"이므로, 솔루션을 검증할 때만이 아니라 **진단에서 먼저 물어야 한다.**
#
# 이 축들은 시스템이 알 수 없다. 설문으로 채우는 것이 정석이라
# survey_recommended 로 표시해 둔다 — 설문 모듈이 붙을 자리다.
ORGANIZATION_DIMENSIONS = [
    {
        'key': 'readiness',
        'label': '준비도',
        'question': '할 수 있는 여건이 되는가',
        'detail': '데이터·인력·인프라가 갖춰져 있는가.',
        'survey_recommended': True,
    },
    {
        # AX-5R 의 redesign 축이지만 '업무 재설계'로 부르지 않는다. AX 맥락에서
        # 그 말은 인력 감축 뉘앙스를 달고 다녀서, 그렇게 읽히면 답변 자체가
        # 왜곡된다. 묻는 것은 조직 축소가 아니라 '실제 업무에 녹아들었는가'다.
        'key': 'redesign',
        'label': '업무 정착',
        'question': '실제 업무 흐름에 녹아 있는가',
        'detail': '따로 돌리는 별도 활동인가, 평소 일하는 과정 안에 들어와 있는가.',
        'survey_recommended': True,
    },
    {
        'key': 'role',
        'label': '역할·책임',
        'question': '누가 책임지는지 정해져 있는가',
        'detail': '누가 만들고 누가 쓰고 누가 결정하는지 분명한가.',
        'survey_recommended': True,
    },
    {
        'key': 'risk',
        'label': '리스크 관리',
        'question': '틀렸을 때의 대비가 있는가',
        'detail': '모델이 현실과 어긋났을 때 무엇이 깨지고 어떻게 되돌리는가.',
        'survey_recommended': True,
    },
    {
        'key': 'return',
        'label': '성과 측정',
        'question': '효과를 재고 있는가',
        'detail': '무엇으로 좋아졌다고 말할 수 있는가. 재는 방법이 정해져 있는가.',
        'survey_recommended': True,
    },
]

# 조직 축은 "무엇을 할 수 있는가"가 아니라 "얼마나 자리잡았는가"를 잰다.
# 기술 레벨 문구를 그대로 쓰면 뜻이 어긋난다.
ORGANIZATION_LEVELS = [
    {'value': 1, 'label': '없음', 'detail': '정해진 것이 없다.'},
    {'value': 2, 'label': '개인 차원', 'detail': '일부 사람이 알아서 한다. 사람이 바뀌면 끊긴다.'},
    {'value': 3, 'label': '부서 표준', 'detail': '부서 안에서는 정해진 방식이 있다.'},
    {'value': 4, 'label': '전사 표준', 'detail': '전사에 공통 기준이 있고 지켜진다.'},
    {'value': 5, 'label': '지속 개선', 'detail': '기준이 돌아가고 주기적으로 다듬어진다.'},
]


CATEGORIES = [
    {
        'key': CATEGORY_TECHNICAL,
        'label': '기술 성숙도',
        'hint': '무엇을 할 수 있는가. 시스템이 알 수 없어 사람이 판단한다.',
        'dimensions': TECHNICAL_DIMENSIONS,
        'levels': TECHNICAL_LEVELS,
    },
    {
        'key': CATEGORY_ORGANIZATION,
        'label': '조직 역량',
        'hint': '얼마나 자리잡았는가. 설문으로 채우는 것이 정석이다.',
        'dimensions': ORGANIZATION_DIMENSIONS,
        'levels': ORGANIZATION_LEVELS,
    },
]

# (category, dimension) 조합이 유효한지 확인할 때 쓴다.
DIMENSION_KEYS_BY_CATEGORY = {
    c['key']: [d['key'] for d in c['dimensions']] for c in CATEGORIES
}
ALL_ASSESSMENT_SLOTS = [
    (c['key'], d['key']) for c in CATEGORIES for d in c['dimensions']
]

LEVEL_MIN = 1
LEVEL_MAX = 5


# ── B. 활용과 성과 ─────────────────────────────────────────────────────────
# 사람이 매기지 않는다. 포탈 데이터로 계산되는 관측값이다.
#
# 진단 화면에서 A 옆에 놓인다. "기술은 4단계인데 활용은 바닥"이 한눈에 보여야
# 이슈 후보로 이어진다. target 은 선택이다 — 넣으면 격차가 생긴다.
METRICS = [
    {
        'key': 'project_count',
        'label': '과제 수',
        'unit': '건',
        'detail': '해당 연도에 등록된 과제 수.',
        'direction': 'higher',
    },
    {
        'key': 'dept_spread',
        'label': '참여 부서',
        'unit': '개',
        'detail': '과제에 이름을 올린 부서 수. 한두 부서에 몰려 있으면 확산이 안 된 것이다.',
        'direction': 'higher',
    },
    {
        'key': 'avg_progress',
        'label': '평균 진행률',
        'unit': '%',
        'detail': '진행 중인 과제의 평균 진행률.',
        'direction': 'higher',
    },
    {
        'key': 'completion_rate',
        'label': '완료 비율',
        'unit': '%',
        'detail': '완료로 표시된 과제의 비율.',
        'direction': 'higher',
    },
    {
        'key': 'kpi_achievement',
        'label': 'KPI 달성률',
        'unit': '%',
        'detail': '목표 대비 실적. 100% 를 넘으면 목표를 넘긴 것이다.',
        'direction': 'higher',
    },
]

METRIC_KEYS = [m['key'] for m in METRICS]


def get_target_divisions():
    """진단 대상 사업부.

    KPI 를 직접 관리하는 사업부만 진단한다. GTR·SR·CS 는 기능조직이라 자기 지표가
    없고 위 사업부들을 지원하므로 같은 잣대로 재기 어렵다 —
    digital_twin_dashboard/models.py 의 is_kpi_owner 주석 참고.

    이름을 코드에 박지 않는다. 조직이 바뀌면 이 목록도 따라 바뀌어야 한다.
    """
    from app.modules.digital_twin_dashboard.models import Division

    return (
        Division.query
        .filter_by(is_kpi_owner=True, is_active=True)
        .order_by(Division.order, Division.id)
        .all()
    )
