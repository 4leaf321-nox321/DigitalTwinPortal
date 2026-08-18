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

# ── AX-5R 게이트 — 같은 다섯 축, 다른 시제 ─────────────────────────────────
#
# ④ 솔루션에서 솔루션을 하나 낼 때마다 묻는 다섯 질문이다. 축은 위 조직 역량과
# **똑같은 다섯 개**이고, 그래서 여기서 새로 나열하지 않고 위 정의에서 끌어온다 —
# 한 가지를 두 곳에 적으면 언젠가 갈라진다.
#
# ⚠️ **다른 것은 시제다.**
#       진단  "지금 되어 있는가"          — 조직의 현재 상태
#       게이트 "이 솔루션을 하면 어떻게 되는가" — 이 솔루션의 실행 조건
#    그래서 질문 문장만 따로 둔다. 진단 문장을 그대로 쓰면 "준비도가 3단계"라는
#    답이 게이트에도 들어오고, 그건 이 솔루션에 대해 아무것도 말해주지 않는다.
#
# 다섯이 다 안 채워진 솔루션은 화면에서 **미완성으로 표시**된다. 막지는 않는다 —
# "그럴듯한 전략"과 "실행 가능한 전략"을 가르는 표시일 뿐, 관문이 아니다.
GATE_QUESTIONS = {
    'readiness': '데이터·인력·인프라가 되는가',
    'redesign': '평소 일하는 과정 안에 어떻게 들어가는가',
    'role': '누가 책임지는가',
    'risk': '실패하면 무엇이 깨지는가',
    'return': '무엇으로 좋아졌다고 말할 것인가',
}

assert GATE_QUESTIONS.keys() == {d['key'] for d in ORGANIZATION_DIMENSIONS}, \
    '게이트와 조직 역량 축이 갈라졌습니다. 같은 다섯이어야 합니다.'

GATES = [
    {'key': d['key'], 'label': d['label'], 'question': GATE_QUESTIONS[d['key']]}
    for d in ORGANIZATION_DIMENSIONS
]

GATE_KEYS = [g['key'] for g in GATES]

# 게이트의 답 상태. '해당 없음'도 **이유를 적어야** 남긴다 — 이유 없는 해당 없음은
# 안 답한 것과 구별이 안 되면서 다 채운 것처럼 보인다.
GATE_STATUSES = ('answered', 'na')


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
#
# ⚠️ 진행률·완료율은 넣지 않는다.
#    시간이 지나면 어차피 100% 로 수렴하므로, 연말에 보면 모든 사업부가 비슷해진다.
#    "지금 몇 %인가"는 시점의 함수일 뿐 전략적 판단 근거가 못 된다.
#
#    대신 **시간이 지나도 저절로 해결되지 않는 구조적 문제**를 잰다. 성과를
#    정의하지 않고 진행하는 과제, KPI 에 걸리지 않은 과제, 소수 부서 집중,
#    특정 시기 일정 쏠림 같은 것들이다. 이런 것은 놔두면 그대로 남는다.
METRICS = [
    {
        'key': 'project_count',
        'label': '과제 수',
        'unit': '건',
        'detail': '해당 연도에 등록된 과제 수. 규모를 보는 값이며 좋고 나쁨의 대상이 아니다.',
        'direction': 'neutral',
    },
    {
        'key': 'dept_spread',
        'label': '참여 부서',
        'unit': '개',
        'detail': '과제에 이름을 올린 부서 수. 몇 곳이 참여하는지만 본다.',
        'direction': 'higher',
    },
    {
        # 개수만으로는 "부서 5개인데 그중 한 곳이 80%" 를 못 잡는다.
        # 이름만 여럿이고 실제로는 한 부서가 다 하는 상태를 가려낸다.
        'key': 'dept_concentration',
        'label': '부서 편중도',
        'unit': '%',
        'detail': '가장 많은 과제를 가진 부서 한 곳이 차지하는 비율. '
                  '참여 부서가 많아도 이 값이 높으면 실제로는 한 곳이 다 하는 것이다.',
        'direction': 'lower',
    },
    {
        'key': 'no_performance_rate',
        'label': '성과 미정의 비율',
        'unit': '%',
        'detail': '무엇을 이루려는지 적지 않은 채 진행 중인 과제의 비율. '
                  '끝나도 무엇이 좋아졌는지 말할 수 없다.',
        'direction': 'lower',
    },
    {
        'key': 'no_kpi_link_rate',
        'label': 'KPI 미연결 비율',
        'unit': '%',
        'detail': '어느 지표에도 걸려 있지 않은 과제의 비율. 전략과 실행이 끊긴 지점이다.',
        'direction': 'lower',
    },
    {
        'key': 'unclassified_link_rate',
        'label': '연결 등급 미지정',
        'unit': '%',
        'detail': 'KPI 에 걸었지만 어떻게 기여하는지(주/보조/간접) 정하지 않은 연결의 비율. '
                  '연결이 전부 동등해 보이면 아무것도 읽을 수 없다.',
        'direction': 'lower',
    },
    {
        # 등급을 매긴 연결 중 '주기여'가 얼마나 되는가.
        # 낮으면 지표를 직접 밀어붙이는 과제 없이 기반만 쌓고 있다는 뜻이다.
        #
        # ⚠️ 등급은 순서척도라 주=3·보조=2 처럼 점수로 합치면 안 된다
        #    (Dt2ProjectKpi.relation_type 주석). 그래서 평균이 아니라 비율로 본다.
        'key': 'primary_link_rate',
        'label': '주기여 연결 비율',
        'unit': '%',
        'detail': '등급이 매겨진 KPI 연결 중 주기여의 비율. 낮으면 지표를 직접 '
                  '밀어붙이는 과제 없이 기반·간접 기여만 쌓고 있는 것이다.',
        'direction': 'higher',
    },
    {
        'key': 'pl_concentration',
        'label': 'PL 집중도',
        'unit': '%',
        'detail': '가장 많은 과제를 맡은 PL 한 명이 차지하는 비율. 사람에 묶인 조직은 취약하다.',
        'direction': 'lower',
    },
    {
        'key': 'deadline_crowding',
        'label': '일정 쏠림',
        'unit': '%',
        'detail': '종료가 같은 분기에 몰린 과제의 비율. 검증 부하가 한꺼번에 닥친다.',
        'direction': 'lower',
    },
    {
        'key': 'isolated_rate',
        'label': '고립 과제 비율',
        'unit': '%',
        'detail': '선행·후속 어느 쪽과도 연결되지 않은 과제의 비율. '
                  '따로 도는 과제가 많으면 축적이 되지 않는다.',
        'direction': 'lower',
    },
    {
        'key': 'kpi_achievement',
        'label': 'KPI 달성률',
        'unit': '%',
        'detail': '목표 대비 실적.',
        'direction': 'higher',
    },
]

METRIC_KEYS = [m['key'] for m in METRICS]


# 관측 지표 ↔ 임계값. 이름이 비슷하지만 같지 않아서 짝을 명시한다.
#
# 이 표가 있어야 **기준이 한 곳에서만 관리된다.** 없으면 화면이 색칠할 기준을
# 따로 들고 있게 되고, 설정에서 임계값을 바꿔도 표의 색은 안 따라간다 —
# 발견 사항에서는 사라졌는데 칸은 계속 붉은 상태가 된다.
#
# project_count 는 규모를 보는 값이라 좋고 나쁨이 없다. 그래서 짝이 없다.
METRIC_THRESHOLD_KEY = {
    'dept_spread': 'spread_concentrated',
    'dept_concentration': 'dept_concentration',
    'no_performance_rate': 'no_performance',
    'no_kpi_link_rate': 'no_kpi_link',
    'unclassified_link_rate': 'unclassified_link',
    'primary_link_rate': 'primary_link_low',
    'pl_concentration': 'pl_concentration',
    'deadline_crowding': 'deadline_crowding',
    'isolated_rate': 'isolated',
    'kpi_achievement': 'kpi_shortfall',
}

# 화면이 /meta 로 받아 쓴다. 지표 정의에 붙여 보내면 프론트가 짝을 다시
# 만들 필요가 없다.
for _m in METRICS:
    _m['threshold_key'] = METRIC_THRESHOLD_KEY.get(_m['key'])

# 지표를 새로 넣고 짝을 잊으면 그 칸만 조용히 색이 안 칠해진다.
# 여기서 바로 터뜨려 배포 전에 알게 한다.
_unmatched = [
    m['key'] for m in METRICS
    if m['direction'] != 'neutral' and not m['threshold_key']
]
assert not _unmatched, f'임계값 짝이 없는 지표: {_unmatched}'


# ── ③ 분석이 설문에 물을 것 ────────────────────────────────────────────────
#
# S·W 는 포탈 데이터에서 나오지만 **O·T 는 포탈에 없다.** 그 자리를 설문이
# 메운다 — 「3년 안에 마주할 가장 큰 위협은?」은 설문 문항이다.
#
# ⚠️ 이렇게 모은 것은 **현장이 인식하는** 기회·위협이지 시장 그 자체가 아니다.
#    화면이 그 한계를 적어야 한다(ANALYSIS_PLAN 3절).
CATEGORY_ANALYSIS = 'analysis'

ANALYSIS_LINKS = [
    {'key': 'opportunity', 'label': '기회', 'element_kind': 'O',
     'question': '앞으로 우리에게 열릴 수 있는 것은 무엇인가'},
    {'key': 'threat', 'label': '위협', 'element_kind': 'T',
     'question': '앞으로 우리를 막을 수 있는 것은 무엇인가'},
]

ANALYSIS_KIND_BY_KEY = {a['key']: a['element_kind'] for a in ANALYSIS_LINKS}


# ── 진단 임계값 ────────────────────────────────────────────────────────────
# 여기 값은 **기본값**이다. 운영에서 화면으로 덮어쓸 수 있다(ModuleSettings).
#
# 코드에만 두면 조정할 때마다 배포가 필요한데, 어느 값이 맞는지는 실제 데이터를
# 봐야 알 수 있다. 개발에서 운영 데이터를 볼 수 없는 이상 튜닝은 운영에서
# 이뤄져야 한다 — PLAN.md 4절의 프롬프트와 같은 이유다.
MODULE_KEY = 'digital_twin_strategy'
THRESHOLD_SETTINGS_KEY = 'finding_thresholds'

THRESHOLDS = [
    {'key': 'no_performance', 'label': '성과 미정의 비율', 'unit': '%', 'default': 30.0, 'max': 100,
     'detail': '이 비율을 넘으면 짚는다. 성과를 적지 않은 과제가 얼마나 되는가.'},
    {'key': 'no_kpi_link', 'label': 'KPI 미연결 비율', 'unit': '%', 'default': 30.0, 'max': 100,
     'detail': '어느 지표에도 걸리지 않은 과제 비율.'},
    {'key': 'unclassified_link', 'label': '연결 등급 미지정', 'unit': '%', 'default': 40.0, 'max': 100,
     'detail': '주·보조·간접을 정하지 않은 연결의 비율.'},
    {'key': 'primary_link_low', 'label': '주기여 비율 하한', 'unit': '%', 'default': 20.0, 'max': 100,
     'detail': '등급 연결 중 주기여가 이 아래면 짚는다. 낮을수록 덜 민감해진다.'},
    {'key': 'pl_concentration', 'label': 'PL 집중도', 'unit': '%', 'default': 25.0, 'max': 100,
     'detail': '한 사람이 맡은 과제 비율이 이 위면 짚는다.'},
    {'key': 'dept_concentration', 'label': '부서 편중도', 'unit': '%', 'default': 50.0, 'max': 100,
     'detail': '한 부서가 차지하는 비율이 이 위면 짚는다.'},
    {'key': 'deadline_crowding', 'label': '일정 쏠림', 'unit': '%', 'default': 50.0, 'max': 100,
     'detail': '한 분기에 종료가 몰린 비율.'},
    {'key': 'isolated', 'label': '고립 과제 비율', 'unit': '%', 'default': 50.0, 'max': 100,
     'detail': '선후 관계가 없는 과제 비율.'},
    {'key': 'kpi_shortfall', 'label': 'KPI 달성률 하한', 'unit': '%', 'default': 80.0, 'max': 100,
     'detail': '달성률이 이 아래면 미달로 본다.'},
    {'key': 'process_thin_share', 'label': '프로세스 과제 하한', 'unit': '%', 'default': 5.0, 'max': 100,
     'detail': '전체 과제 중 이 비율에 못 미치는 프로세스는 짚는다. '
               '단계는 있는데 손대는 과제가 거의 없다는 뜻이다.'},
    {'key': 'spread_concentrated', 'label': '참여 부서 하한', 'unit': '개', 'default': 4, 'max': 50,
     'detail': '참여 부서가 이 이하면 확산이 안 된 것으로 본다.'},

    # ── 설문 근거 (LINK_PLAN) ──────────────────────────────────────────
    # ⚠️ 이 넷은 **실제 분포를 보기 전에는 맞는 값을 모른다.** 보수적으로
    #    시작한다 — 너무 많이 짚으면 아무도 안 읽고, 그러면 안 짚는 것과 같다.
    {'key': 'survey_min_sample', 'label': '설문 표본 하한', 'unit': '명', 'default': 5, 'max': 50,
     'detail': '한 칸의 응답자가 이 아래면 제안도 안 하고 짚지도 않는다. '
               '표본이 한둘로 내려가면 익명 응답이 사실상 지목이 된다.'},
    {'key': 'survey_role_gap', 'label': '역할 간 인식 격차', 'unit': '점', 'default': 0.8, 'max': 4,
     'detail': '같은 축을 역할별로 이만큼 다르게 보면 짚는다. 정보가 위아래로 '
               '안 흐른다는 뜻이다.'},
    {'key': 'survey_division_gap', 'label': '사업부 간 격차', 'unit': '점', 'default': 1.0, 'max': 4,
     'detail': '한 축에서 최고와 최저 사업부의 차이가 이만큼이면 짚는다.'},
    {'key': 'survey_low_level', 'label': '전사 공통 저점', 'unit': '점', 'default': 2.5, 'max': 5,
     'detail': '모든 사업부가 이 아래면 사업부가 아니라 전사 문제로 짚는다.'},
    {'key': 'survey_choice_share', 'label': '객관식 쏠림', 'unit': '%', 'default': 50.0, 'max': 100,
     'detail': '한 보기에 이 비율 넘게 몰리면 짚는다. 사람들이 직접 지목한 것이다.'},
    {'key': 'survey_choice_lead', 'label': '객관식 1·2위 격차', 'unit': '%', 'default': 15.0, 'max': 100,
     'detail': '1위가 2위를 이만큼 앞서야 짚는다. 35% 대 33% 를 "압도적 1위"로 '
               '읽게 두지 않으려는 것이다.'},

    # ── ③ 분석 (SWOT 후보) ────────────────────────────────────────────
    # ⚠️ 양쪽을 대칭으로 두지 않았다. 약점은 2단계도 약점이지만, 강점은 4단계면
    #    "보통보다 낫다" 정도라 전략 요소로 세우기엔 약하다 — '준비도 4단계' 는
    #    사실이지 ④ 에서 조합할 수 있는 강점 서술이 아니다. 4로 두면 개발 DB
    #    에서만 후보가 31건이 나왔고, 그 목록은 안 읽힌다.
    #
    #    다만 **실제 진단값 분포를 보기 전에는 5가 맞는지 모른다.** 그래서
    #    코드에 박아 두지 않고 여기 둔다.
    {'key': 'element_strong_at', 'label': '강점으로 볼 레벨', 'unit': '단계', 'default': 5, 'max': 5,
     'detail': '진단 레벨이 이 이상이면 ③ 분석의 강점 후보로 낸다. '
               '낮출수록 후보가 늘어난다.'},
    {'key': 'element_weak_at', 'label': '약점으로 볼 레벨', 'unit': '단계', 'default': 2, 'max': 5,
     'detail': '진단 레벨이 이 이하면 약점 후보로 낸다. 올릴수록 후보가 늘어난다.'},

    # ── ② 이슈 ────────────────────────────────────────────────────────
    #
    # ⚠️ **기본값 2 가 약속을 깨고 있었다.** 사람은 목표를 「올해 한 단계」로
    #    잡는데, 그러면 격차가 늘 1 이라 이슈 후보가 **하나도 안 나온다.**
    #    「진단을 채우면 이슈 후보가 뜬다」가 이 모듈의 핵심 약속인데 기본
    #    사용법에서 안 지켜졌다(2026-08-17 한 사이클 실측).
    #
    #    그렇다고 1 이 늘 옳은 것도 아니다 — 한 단계 차이는 대부분의 조직에 늘
    #    있어서, 1 로 두면 목록이 스물다섯 줄이 되고 아무도 안 읽는다. 그래서
    #    **운영에서 정할 값**으로 내놓는다. 기본은 1 이다 — 후보가 너무 많은
    #    것이 하나도 없는 것보다 낫다.
    {'key': 'issue_gap_min', 'label': '이슈 후보 최소 격차', 'unit': '단계',
     'default': 1, 'max': 5,
     'detail': '진단 격차가 이 단계 이상이면 이슈 후보로 낸다. 올리면 '
               '목록이 짧아지지만, 목표를 한 단계씩 잡는 조직에서는 '
               '2 이상이면 후보가 아예 안 나온다.'},

    # ── ④ 솔루션 ──────────────────────────────────────────────────────
    #
    # 다 1순위면 순위를 안 정한 것과 같다. 몇 건까지가 "먼저"인지는 조직이
    # 한 해에 실제로 해내는 양이라, 운영에서만 알 수 있다.
    {'key': 'solution_now_max', 'label': '「먼저 한다」 최대 건수', 'unit': '건',
     'default': 5, 'max': 50,
     'detail': '영향·실행가능성이 둘 다 높은 솔루션이 이보다 많으면 짚는다. '
               '다 1순위면 순위를 안 정한 것과 같다.'},
    {'key': 'solution_unlinked_share', 'label': '전략 미연결 과제 비율', 'unit': '%',
     'default': 70, 'max': 100,
     'detail': '어느 솔루션에도 안 걸린 과제가 이 비율을 넘으면 짚는다. '
               '전략과 실행이 따로 도는 정도를 본다.'},
]

DEFAULT_THRESHOLDS = {t['key']: t['default'] for t in THRESHOLDS}
THRESHOLD_KEYS = set(DEFAULT_THRESHOLDS)

# 항목마다 상한이 다르다. **비율만 있는 것이 아니다** — 척도 격차는 1~5 점
# 척도에서 나오므로 4점을 넘을 수 없고, 표본 하한은 명 수다. 전부 '100 이하'로
# 보던 때는 '역할 간 격차 99점' 이 그대로 저장됐고, 그러면 그 규칙이 조용히
# 죽는다. 설정에서 값을 넣었는데 왜 아무것도 안 짚히는지 알 방법이 없다.
THRESHOLD_MAX = {t['key']: t['max'] for t in THRESHOLDS}

_no_max = [t['key'] for t in THRESHOLDS if 'max' not in t]
assert not _no_max, f'상한을 안 적은 임계값: {_no_max}'

# 지표가 가리키는 임계값이 실재하는지. 오타 하나면 그 칸만 색이 안 칠해지고
# 아무 오류도 안 난다 — 눈으로는 못 잡는다.
_missing = sorted(set(METRIC_THRESHOLD_KEY.values()) - THRESHOLD_KEYS)
assert not _missing, f'METRIC_THRESHOLD_KEY 가 없는 임계값을 가리킴: {_missing}'


def get_thresholds():
    """기본값 위에 운영에서 저장한 값을 덮어쓴다.

    저장된 것이 없으면 기본값이 그대로 쓰인다. 값 하나만 바꿔 두어도 나머지는
    기본값을 따라가므로, 배포로 기본값이 바뀌면 손대지 않은 항목은 새 기본값을
    받는다.
    """
    from app.modules.digital_twin_dashboard.models import ModuleSettings

    values = dict(DEFAULT_THRESHOLDS)
    row = ModuleSettings.query.filter_by(
        module_name=MODULE_KEY, settings_key=THRESHOLD_SETTINGS_KEY
    ).first()
    if row and isinstance(row.settings_data, dict):
        for key, value in row.settings_data.items():
            if key in THRESHOLD_KEYS and isinstance(value, (int, float)):
                values[key] = value
    return values


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
