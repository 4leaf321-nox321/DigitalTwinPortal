"""
진단 기준 정의.

차원과 레벨의 뜻을 코드에 둔다. 정의가 없으면 사람마다 다르게 매기고, 그러면
격차 숫자가 의미를 잃는다. 화면이 이 값을 툴팁으로 띄운다 — 문서에만 두면
아무도 읽지 않는다.

나중에 방법론 정의처럼 DB 로 옮겨 운영에서 편집하게 만든다(PLAN.md 4절).
지금은 코드에 두고 쓰면서 문구를 다듬는다.
"""

# 아래에서 위로 쌓인다. 데이터가 약한데 분석만 높을 수는 없다.
# 이 순서 자체가 "어디부터 손대야 하는가"를 알려준다.
DIMENSIONS = [
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

LEVELS = [
    {'value': 1, 'label': '없음 / 수기', 'detail': '체계가 없다. 필요할 때 사람이 직접 만든다.'},
    {'value': 2, 'label': '부분 디지털화', 'detail': '일부는 디지털이지만 개별적으로만 쓴다.'},
    {'value': 3, 'label': '연계 / 표준화', 'detail': '서로 이어져 있고 따르는 절차가 있다.'},
    {'value': 4, 'label': '예측 / 최적화', 'detail': '앞을 내다보고 더 나은 안을 찾는 데 쓴다.'},
    {'value': 5, 'label': '자동 반영 / 폐루프', 'detail': '결과가 현실에 자동으로 되돌아간다.'},
]

DIMENSION_KEYS = [d['key'] for d in DIMENSIONS]
LEVEL_MIN = LEVELS[0]['value']
LEVEL_MAX = LEVELS[-1]['value']


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
