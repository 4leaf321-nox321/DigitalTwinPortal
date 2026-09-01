# -*- coding: utf-8 -*-
"""디지털 트윈 성숙도 — 정의의 단일 출처. (PLAN.md 3·4절)

부문(sector) · 축(axis) · 척도(ladder) · 정확도 규칙 · 가져오기 틀이 전부 여기
있다. 화면·API·시험이 이 파일 하나를 읽는다 — 정의가 두 곳이면 둘이 갈린다.

⚠️⚠️ **한 엔진, 부문별 척도 세트.** 부문마다 코드를 갈라 만들지 않는다.
   부문을 하나 더 붙이는 일이 `SECTORS` 와 척도 한 벌을 더하는 것으로 끝나야 한다.
   그렇지 않으면 3절의 설계가 틀린 것이다.

⚠️ **축은 세 종류다.** `rung`(칸을 고른다) · `value`(값을 적고 문턱으로 칸이 정해진다) ·
   `set`(선후 없는 항목을 선택·해제한다 — 자동화). 정확도가 value 다. 값과 칸이 따로 놀면
   정확도가 둘이 된다 — 칸을 바꾸려면 값을 바꿔야 한다. set 은 첫 칸(수동)이 「아무것도
   안 켬」이고 서열은 켠 개수다 — 전처리·실행·후처리에는 순서가 없다(2026-08-28).

⚠️ **척도 문구는 설정으로 갈아 끼울 수 있지만 key 는 고정이다.** 이력과 평가가
   key 로 묶여 있다. 문구를 고치는 것과 칸을 지우는 것은 다른 일이다.

⚠️ **DX KPI 와 무관하다.** 가상 검증률을 읽지도 쓰지도 않는다. 이 파일의 문턱은
   사업부 엑셀의 경계와 **맞추기 위해** 설정으로 뺀 것이지, 그 지표를 계산하려는 것이 아니다.
"""

MODULE_KEY = 'dev_dt_maturity'

# ── 부문 ───────────────────────────────────────────────────────────────────
#
# 상부 보고 구분 셋 + 디지털 스레드. 시뮬레이션만 1차로 만든다(PLAN 3-1·3-2).
# `has_agent=False` 인 부문은 「수단 없는 연계」 — 대상 하나에 직접 매긴다.
SECTORS = [
    {'key': 'simulation', 'label': '시뮬레이션', 'has_agent': True,
     'subject_label': '시험 항목', 'agent_label': '시뮬레이션', 'phase': 1},
    # ⚠️ 아래 둘은 자리만 잡아 둔다. 척도가 없으면 화면에 안 뜬다(active=False).
    #    검토안은 PLAN-automation.md — 대상·수단·축까지 적혀 있고 담당 확인만 남았다.
    {'key': 'design_automation', 'label': '설계 자동화', 'has_agent': True,
     'subject_label': '설계 업무', 'agent_label': '자동화 수단', 'phase': 2},
    {'key': 'verification_automation', 'label': '검증 자동화', 'has_agent': True,
     'subject_label': '검증 항목', 'agent_label': '검증 수단', 'phase': 2},
    # 제조 모니터링(2026-08-29, PLAN-monitoring.md) — 대상은 **라인 × 공정 단계**다.
    # 설비 개체가 아니다: 사업부마다 설비가 수백이라 목록이 폭발하고 교체 때 이력이 사라진다.
    # 같은 공정의 설비 사이 차이는 근거의 비율(「상태 8/12대」)로 받는다.
    {'key': 'manufacturing_monitoring', 'label': '모니터링', 'has_agent': True,
     'subject_label': '공정', 'agent_label': '수집 수단', 'phase': 4},
    # 공장 최적화(시뮬레이션) — 대상은 **법인 × 라인**, 수단은 공장 시뮬레이션(다섯 종류 —
    # OPTIMIZATION_KINDS). 축은 시뮬레이션 부문과 같은 뼈대(AXES, 2026-09-02 개통).
    {'key': 'factory_optimization', 'label': '공장 최적화', 'has_agent': True,
     'subject_label': '법인·라인', 'agent_label': '공장 시뮬레이션', 'phase': 4},
    {'key': 'digital_thread', 'label': '디지털 스레드', 'has_agent': False,
     'subject_label': '연계 구간', 'agent_label': None, 'phase': 3},
]
SECTOR_KEYS = [s['key'] for s in SECTORS]
SECTOR_BY_KEY = {s['key']: s for s in SECTORS}

# 시뮬레이션(수단)의 모델 종류 — 부문이 아니라 속성이다(PLAN 2절).
MODEL_KINDS = [
    {'key': 'physics', 'label': '물리 기반'},
    {'key': 'data', 'label': '데이터 기반'},
    {'key': 'hybrid', 'label': '하이브리드'},
]
MODEL_KIND_KEYS = {m['key'] for m in MODEL_KINDS}

# ── 축과 척도 — 시뮬레이션 부문 (합의됨, PLAN 4절) ───────────────────────
#
# 칸은 **낮은 것부터** 나열한다. 순서가 곧 서열이라 index 가 레벨이다.
# 첫 칸은 「아직 아무것도 아님」이 아니다 — 미평가는 칸이 없는 상태(None)로 따로 센다.
AXES = {
    'simulation': [
        {
            'key': 'accuracy', 'label': '정확도', 'kind': 'value', 'unit': '%',
            'question': '시험 결과와 얼마나 맞는가',
            'evidence': ['compared_tests', 'error_pct', 'attachment'],
            'evidence_label': '비교 시험 건수 · 오차 · 첨부',
            # ⚠️ value 축의 칸은 사람이 고르지 않는다 — 값이 문턱을 넘으면 올라간다.
            #    '미평가' 은 값이 없는 상태라 척도에 없다(None).
            'rungs': [
                # 문구는 2026-08-28 — 한 줄 막대의 세 영역. key 는 고정.
                # ⚠️ 가운데 단의 이름을 「원인 분석」에서 바꿨다(2026-09-01) — 시험 대체 축의
                #    「원인 분석」(해석의 활용 단계)과 이름이 같아 헷갈렸다. key 는 고정.
                {'key': 'trend', 'label': '경향 일치',
                 'description': '시험의 방향은 맞지만 값이 안 맞아 대안 간 우열까지는 못 가른다'},
                {'key': 'quantitative', 'label': '우열 판정',
                 'description': '값이 맞아 대안 간 우열과 문제의 원인을 시뮬레이션으로 가린다'},
                {'key': 'correlated', 'label': '현상 재현',
                 'description': '시험의 현상을 그대로 재현해 결과를 믿고 쓴다'},
            ],
        },
        {
            'key': 'automation', 'label': '자동화', 'kind': 'set',
            'question': '해석 파이프라인의 어느 단계가 사람 손 없이 도는가',
            'evidence': ['hours_per_run'], 'evidence_label': '1회 소요 시간(Hr)',
            # ⚠️ 이것은 **해석 파이프라인**의 자동화다. 「검증 자동화」 부문(로직 검증)과
            #    다른 것을 잰다 — 같은 시험에 둘 다 걸려도 겹치지 않는다(PLAN 3-1).
            # ⚠️ 척도가 아니라 **묶음**이다. 전처리·실행·후처리·보고·파이프라인은 선후가
            #    없어 따로 선택·해제한다. 「수동」은 아무것도 안 켠 상태. 서열(색)은 켠 개수다.
            'rungs': [
                {'key': 'manual', 'label': '수동', 'short': '수동', 'description': '아무 단계도 자동이 아니다 — 전 과정을 사람이 한다'},
                {'key': 'pre', 'label': '전처리 자동화', 'short': '전처리', 'description': '형상·메시·조건 준비가 자동'},
                {'key': 'run', 'label': '실행 자동화', 'short': '실행', 'description': '템플릿으로 해석이 돈다'},
                {'key': 'post', 'label': '후처리 자동화', 'short': '후처리', 'description': '결과 정리(추출·그래프)가 자동'},
                {'key': 'report', 'label': '보고서 자동화', 'short': '보고', 'description': '보고서가 자동으로 나온다'},
                {'key': 'pipeline', 'label': '파이프라인(오케스트레이션)', 'short': '파이프',
                 'description': '설계 변경이 들어오면 단계들이 이어져 결과까지 사람 없이 나온다'},
            ],
        },
        {
            'key': 'modeling', 'label': '모델링 수준', 'kind': 'matrix',
            'question': '어느 불량까지 재현하는가',
            'evidence': ['defects'], 'evidence_label': '불량 유형 표',   # 현상 태그는 뺐다(2026-08-28) — 불량 유형 표가 그 자리
            # 두 층이다(2026-08-28): 바탕(형상·거동)은 시뮬레이션 전체의 토글, 불량 재현은 **시뮬레이션의
            # 불량 유형마다** 열(시험·시장)을 켠다 — evidence.defects = {유형: {test: '2025-03', market: None}}.
            # rungs 는 판에 보이는 **서열**이다(matrix_level 이 접는다). ⚠️ base·columns 의 key 는 고정.
            'hide_empty': True,
            'base': [
                {'key': 'geometry', 'label': '형상 재현', 'description': '치수·재질·경계 조건이 실물이다'},
                {'key': 'performance', 'label': '거동 재현', 'description': '변형·온도·유동 같은 물리 거동이 시험과 같이 나온다'},
            ],
            'columns': [
                {'key': 'test', 'label': '신뢰성 시험 불량 재현', 'short': '시험', 'description': '신뢰성 시험에서 난 그 불량이 시뮬레이션에서도 난다'},
                {'key': 'market', 'label': '시장 불량 재현', 'short': '시장', 'description': '시장에서 난 불량(사용 조건·누적 이력)이 시뮬레이션에서도 난다'},
            ],
            'rungs': [
                {'key': 'none', 'label': '없음', 'description': '아직 아무것도 재현하지 않는다'},
                {'key': 'geometry', 'label': '형상 재현', 'description': '형상만 재현한다'},
                {'key': 'performance', 'label': '거동 재현', 'description': '물리 거동까지 재현한다'},
                {'key': 'test_some', 'label': '일부 불량 시험 재현', 'description': '불량 유형 일부의 시험 불량을 재현한다'},
                {'key': 'test_all', 'label': '전 유형 시험 재현', 'description': '모든 불량 유형의 시험 불량을 재현한다'},
                {'key': 'market', 'label': '시장 불량까지', 'description': '시장 불량도 재현한다'},
            ],
        },
        {
            'key': 'scope', 'label': '적용 범위', 'kind': 'rung',
            'question': '어느 개발 과제에서 도는가',
            'evidence': ['product_families'], 'evidence_label': '대상 제품군',
            # 기준은 **개발 과제 흐름** 하나다(2026-08-28) — 모델과 제품군을 섞으면 경계가 안 보였다.
            # ⚠️ key 는 고정(이력이 묶여 있다). 문구만 바뀐다.
            'rungs': [
                {'key': 'issue', 'label': '이슈 대응', 'description': '문제가 난 뒤, 그 모델에만'},
                {'key': 'basic', 'label': '대표(Basic) 모델', 'description': '제품군의 대표 모델 개발에서'},
                {'key': 'derived_some', 'label': '신규 개발 전 모델', 'description': '신규 개발 과제 전부에서'},
                {'key': 'all', 'label': '파생·지역 변형까지', 'description': '파생·지역 변형 과제까지 전부에서'},
            ],
        },
        {
            'key': 'substitution', 'label': '시험 대체', 'kind': 'set',
            'question': '시험을 어떤 자리에서 대신하는가',
            'evidence': ['tests_saved_per_year'], 'evidence_label': '줄어든 시험 횟수/년',
            # 묶음이다(2026-08-28) — 시험 병행·원인 분석·사전 검증·인증 게이트·완전 대체는 척도가 아니라
            # **쓰임새**라 겹칠 수 있다. 첫 칸 「없음」은 아무것도 안 켠 상태이고 화면엔 안 보인다(hide_empty).
            # 「완전 대체」를 선택하면 나머지가 다 켜진다(implies). 오른쪽일수록 앞선 것.
            'hide_empty': True,
            'implies': {'full': ['reference', 'cause_analysis', 'screening', 'cert_gate']},
            'rungs': [
                {'key': 'none', 'label': '없음', 'description': '시험 대체에 시뮬레이션을 쓰지 않는다'},
                {'key': 'reference', 'label': '시험 병행(참고)', 'short': '병행', 'description': '시험은 그대로, 참고만'},
                {'key': 'cause_analysis', 'label': '원인 분석', 'short': '원인', 'description': '시험에서 난 문제의 원인을 시뮬레이션으로 찾는다'},
                {'key': 'screening', 'label': '사전 검증(자주 검증)', 'short': '사전', 'description': '시험 전에 설계자가 시뮬레이션으로 먼저 걸러 시험 횟수를 줄인다'},
                {'key': 'cert_gate', 'label': '신뢰성 인증 게이트 (PLM내 CAE 항목 관리)', 'short': '인증', 'description': '신뢰성 인증의 관문을 시뮬레이션 결과로 통과한다'},
                {'key': 'full', 'label': '완전 대체', 'short': '완전', 'description': '시험을 하지 않는다'},
            ],
        },
    ],
    # 나머지 부문은 척도가 없다 — 자료 조사 뒤(PLAN 3-1) / 3차(3-2).
    'verification_automation': [],
    'design_automation': [],
    # ── 디지털 스레드(2026-08-28) — 대상은 「구간」(데이터가 조직·시스템을 건너는 자리), 수단 없음 ──
    'digital_thread': [
        # 스레드 = 데이터가 생기고(확보) → 건너고(연결) → 믿을 수 있고(품질·표준) → 쓰이는(활용) 네 고리(2026-08-28).
        # 전부 택1, 칸은 셋~넷 — 「보면 아는 것」만. 「모름」은 따로(unknown_ok) 두어 「확인 필요」로 센다.
        {
            'key': 'capture', 'label': '데이터 확보', 'kind': 'rung', 'unknown_ok': True,
            'question': '데이터가 어떻게 생기는가 — 사람 손이 얼마나 덜 드나',
            # 「일부/전부」(양)는 칸이 아니라 근거의 숫자(coverage_pct)로 받는다(2026-08-28)
            'evidence': ['coverage_pct', 'attachment'], 'evidence_label': '대상 중 확보 비율(%) · 어디서 확인했나',
            'headline_min': 'direct',
            'rungs': [
                {'key': 'none', 'label': '없음·개인 파일', 'description': '종이·머릿속이거나 담당자의 엑셀·문서에만'},
                {'key': 'upload', 'label': '사람이 취합해 올림', 'description': '엑셀로 만든 것을 나중에 시스템에 입력·업로드한다'},
                {'key': 'direct', 'label': '시스템에 직접 입력', 'description': '일이 일어나는 자리에서 시스템에 바로 기록한다'},
                {'key': 'auto', 'label': '장비·도구에서 자동 수집', 'description': '사람 없이 시스템이 받는다(설비·센서·CAE 자동 등록)'},
            ],
        },
        {
            'key': 'link_mode', 'label': '연결', 'kind': 'rung', 'unknown_ok': True,
            'question': '데이터가 어떻게 건너가는가',
            'evidence': ['attachment'], 'evidence_label': '어디서 확인했나(화면·담당자)',
            'headline_min': 'auto_transfer',
            # 매개가 「비시스템 매개」면 첫 칸만(threads.guard_assess)
            'rungs': [
                {'key': 'manual', 'label': '사람이 옮김', 'description': '구두·메일·파일로 사람이 넘긴다'},
                {'key': 'auto_transfer', 'label': '자동 전달', 'description': '정해진 배치·파일 교환으로 저절로 넘어간다'},
                {'key': 'integrated', 'label': '시스템 연동', 'description': 'API·동기로 시스템끼리 바로 잇는다'},
                {'key': 'closed_loop', 'label': '폐루프', 'description': '하류의 결과가 상류를 갱신한다'},
            ],
        },
        {
            'key': 'quality', 'label': '품질·표준', 'kind': 'rung', 'unknown_ok': True,
            'question': '건너간 데이터를 그대로 믿고 쓸 수 있는가 — 같은 코드·ID·버전인가',
            'evidence': ['attachment'], 'evidence_label': '어디서 확인했나(같은 항목을 두 시스템에서)',
            'headline_min': 'master',
            'rungs': [
                {'key': 'manual_match', 'label': '손으로 맞춤', 'description': '코드·ID 가 달라 사람이 맞춘다'},
                {'key': 'mapped', 'label': '매핑표로 맞춤', 'description': '다른 코드를 표로 맞춘다'},
                {'key': 'master', 'label': '같은 마스터·ID·버전', 'description': '같은 기준 자료를 보고 ID·리비전이 이어진다'},
            ],
        },
        {
            'key': 'usage', 'label': '활용', 'kind': 'rung', 'unknown_ok': True,
            'question': '도착 쪽이 그 데이터로 실제로 결정하는가',
            'evidence': ['attachment'], 'evidence_label': '어디서 확인했나(도착 담당자)',
            'headline_min': 'decision',
            'rungs': [
                {'key': 'reference', 'label': '참고만', 'description': '보긴 하지만 없어도 된다'},
                {'key': 'review', 'label': '검토·보고에 씀', 'description': '검토 회의·보고 자료에 들어간다'},
                {'key': 'decision', 'label': '의사결정의 근거', 'description': '승인·게이트가 이 데이터로 정해진다'},
                {'key': 'automatic', 'label': '자동 판단·트리거', 'description': '사람 없이 다음 일이 시작된다'},
            ],
        },
    ],
}

# ── 디지털 스레드의 사전 어휘 ──────────────────────────────────────────────
THREAD_STAGES = [
    {'key': 'planning', 'label': '기획'}, {'key': 'development', 'label': '개발'},
    {'key': 'mfg_eng', 'label': '제품기술'}, {'key': 'manufacturing', 'label': '제조'},
    {'key': 'quality', 'label': '품질'}, {'key': 'purchasing', 'label': '구매'},
    {'key': 'market', 'label': '시장(CS)'}, {'key': 'management', 'label': '경영'},
]
STAGE_LABELS = {s['key']: s['label'] for s in THREAD_STAGES}
SYSTEM_KINDS = [
    {'key': 'plm', 'label': 'PLM'}, {'key': 'cad', 'label': 'CAD'}, {'key': 'cae', 'label': 'CAE'}, {'key': 'spdm', 'label': 'SPDM'},
    {'key': 'requirements', 'label': '요구사항 관리'}, {'key': 'erp', 'label': 'ERP'}, {'key': 'mes', 'label': 'MES'},
    {'key': 'qms', 'label': '품질(QMS)'}, {'key': 'cost', 'label': '원가'}, {'key': 'purchase', 'label': '구매'},
    {'key': 'cs', 'label': '서비스(CS)'}, {'key': 'test', 'label': '시험 관리'}, {'key': 'hub', 'label': '데이터 허브·ESB'},
    {'key': 'informal', 'label': '비시스템 매개'}, {'key': 'other', 'label': '기타'},
]
SYSTEM_KIND_KEYS = [k['key'] for k in SYSTEM_KINDS]
# 비시스템 매개 — 시스템을 안 거치고 자료가 오가는 길. 시스템 사전에 이 이름으로 줄이 선다.
INFORMAL_ITEMS = [
    {'key': 'mail', 'label': '메일'},
    {'key': 'doc', 'label': '엑셀·문서 전달'},
    {'key': 'fileserver', 'label': '파일서버·공유폴더'},
    {'key': 'messenger', 'label': '메신저'},
    {'key': 'verbal', 'label': '구두·회의'},
]
LINK_MEANS = [{'key': 'api', 'label': 'API 있음'}, {'key': 'file', 'label': '파일 배치'}, {'key': 'none', 'label': '없음'}, {'key': 'unknown', 'label': '미확인'}]
LINK_MEANS_KEYS = [k['key'] for k in LINK_MEANS]
SYSTEM_STATUS = [{'key': 'active', 'label': '운영'}, {'key': 'adopting', 'label': '도입 중'}, {'key': 'retiring', 'label': '폐지 예정'}]
SYSTEM_STATUS_KEYS = [k['key'] for k in SYSTEM_STATUS]

# 데이터 종류 — 구간으로 무엇이 흐르나. 매기는 축이 아니라 구간의 속성(2026-08-28). 없는 것은 직접 적는다.
DATA_KINDS = [
    {'key': 'requirement', 'label': '요구사항·스펙'}, {'key': 'geometry', 'label': '설계 형상(CAD)'}, {'key': 'material', 'label': '재질·물성'},
    {'key': 'sim_model', 'label': '해석 모델'}, {'key': 'sim_result', 'label': '해석 결과'}, {'key': 'test_result', 'label': '시험 결과'},
    {'key': 'bom', 'label': 'BOM(E/M)'}, {'key': 'bop', 'label': 'BOP(공정 순서)'}, {'key': 'eco', 'label': '설계 변경(ECO)'}, {'key': 'cost', 'label': '원가·단가'},
    {'key': 'process', 'label': '공정·설비 파라미터'}, {'key': 'yield', 'label': '생산 실적·수율'}, {'key': 'inspection', 'label': '검사 결과'},
    {'key': 'defect', 'label': '불량·이슈'}, {'key': 'field', 'label': '시장 품질·CS'}, {'key': 'other', 'label': '기타'},
]
DATA_KIND_KEYS = [k['key'] for k in DATA_KINDS]
DATA_KIND_LABELS = {k['key']: k['label'] for k in DATA_KINDS}

# 표준 스레드의 첫 판 — 표가 비어 있을 때 넣는 초안. 사무국이 화면에서 고친다(key 는 고정).
THREAD_DEFAULTS = [
    {'key': 'simulation', 'name': '시뮬레이션 스레드', 'description': '요구사항에서 해석 조건·모델·결과·설계 판정·시험 비교까지', 'axes_off': [],
     'segments': [
         {'key': 'req_to_cond', 'data': ['requirement'], 'name': '요구사항 → 해석 조건', 'from': 'planning', 'to': 'development'},
         {'key': 'cad_to_model', 'data': ['geometry', 'material'], 'name': '설계 형상 → 해석 모델', 'from': 'development', 'to': 'development'},
         {'key': 'result_to_review', 'data': ['sim_result'], 'name': '해석 결과 → 설계 판정', 'from': 'development', 'to': 'development'},
         {'key': 'test_vs_result', 'data': ['test_result', 'sim_result'], 'name': '시험 결과 ↔ 해석 결과', 'from': 'quality', 'to': 'development'},
         {'key': 'eco_to_rerun', 'data': ['eco'], 'name': '설계 변경 → 해석 재수행', 'from': 'development', 'to': 'development'},
     ]},
    {'key': 'cost', 'name': '재료비 스레드', 'description': '목표 원가에서 E-BOM·예상 원가·구매 단가·실적 원가·손익까지',
     'segments': [
         {'key': 'target_to_bom', 'data': ['cost', 'bom'], 'name': '목표 원가 → E-BOM', 'from': 'planning', 'to': 'development'},
         {'key': 'bom_to_estimate', 'data': ['bom', 'cost'], 'name': 'E-BOM → 예상 원가', 'from': 'development', 'to': 'management'},
         {'key': 'estimate_to_price', 'data': ['cost'], 'name': '예상 원가 → 구매 단가', 'from': 'management', 'to': 'purchasing'},
         {'key': 'price_to_actual', 'data': ['cost'], 'name': '구매 단가 → 실적 원가', 'from': 'purchasing', 'to': 'manufacturing'},
         {'key': 'actual_to_pl', 'data': ['cost'], 'name': '실적 원가 → 손익', 'from': 'manufacturing', 'to': 'management'},
     ]},
    {'key': 'quality', 'name': '품질 스레드', 'description': '스펙에서 신뢰성 시험·양산 검사·시장 불량·원인 분석·설계 변경까지(폐루프)',
     'segments': [
         {'key': 'spec_to_test', 'data': ['requirement', 'test_result'], 'name': '스펙 → 신뢰성 시험 결과', 'from': 'development', 'to': 'quality'},
         {'key': 'test_to_inspection', 'data': ['test_result', 'inspection'], 'name': '시험 결과 → 양산 검사', 'from': 'quality', 'to': 'manufacturing'},
         {'key': 'inspection_to_field', 'data': ['inspection', 'field'], 'name': '양산 검사 → 시장 불량', 'from': 'manufacturing', 'to': 'market'},
         {'key': 'field_to_cause', 'data': ['field', 'defect'], 'name': '시장 불량 → 원인 분석', 'from': 'market', 'to': 'development'},
         {'key': 'cause_to_eco', 'data': ['defect', 'eco'], 'name': '원인 분석 → 설계 변경', 'from': 'development', 'to': 'development'},
     ]},
    {'key': 'manufacturing', 'name': '제조 스레드', 'description': '설계 형상·공차에서 공정 설계·설비 파라미터·생산 실적·설계 피드백까지',
     'segments': [
         {'key': 'design_to_process', 'data': ['geometry', 'process'], 'name': '설계 형상·공차 → 공정 설계', 'from': 'development', 'to': 'mfg_eng'},
         {'key': 'process_to_equipment', 'data': ['process'], 'name': '공정 설계 → 설비 파라미터', 'from': 'mfg_eng', 'to': 'manufacturing'},
         {'key': 'equipment_to_yield', 'data': ['process', 'yield'], 'name': '설비 파라미터 → 생산 실적·수율', 'from': 'manufacturing', 'to': 'manufacturing'},
         {'key': 'yield_to_design', 'data': ['yield', 'defect'], 'name': '생산 실적 → 설계 피드백', 'from': 'manufacturing', 'to': 'development'},
     ]},
    {'key': 'bom_change', 'name': 'BOM·BOP 스레드', 'description': 'E-BOM에서 M-BOM·BOP·구매·설계 변경 전파까지',
     'segments': [
         {'key': 'ebom_to_mbom', 'data': ['bom'], 'name': 'E-BOM → M-BOM', 'from': 'development', 'to': 'mfg_eng'},
         {'key': 'mbom_to_bop', 'data': ['bom', 'bop'], 'name': 'M-BOM → BOP', 'from': 'mfg_eng', 'to': 'mfg_eng'},
         {'key': 'bop_to_line', 'data': ['bop', 'process'], 'name': 'BOP → 라인 작업 지시', 'from': 'mfg_eng', 'to': 'manufacturing'},
         {'key': 'mbom_to_purchase', 'data': ['bom', 'cost'], 'name': 'M-BOM → 구매 요청', 'from': 'mfg_eng', 'to': 'purchasing'},
         {'key': 'eco_to_mbom', 'data': ['eco', 'bom', 'bop'], 'name': '설계 변경 → M-BOM·BOP 반영', 'from': 'development', 'to': 'mfg_eng'},
         {'key': 'eco_to_field', 'data': ['eco', 'field'], 'name': '설계 변경 → 서비스 부품 반영', 'from': 'development', 'to': 'market'},
     ]},
]


# 연계 개발 기록 — 건의 「무엇을」과 상태(2026-08-28)
THREAD_CASE_ACTIONS = [
    {'key': 'integrate', 'label': '연동'}, {'key': 'adopt', 'label': '도입'}, {'key': 'harmonize', 'label': '정합화'},
    {'key': 'automate', 'label': '자동화'}, {'key': 'retire', 'label': '폐지'}, {'key': 'other', 'label': '기타'},
]
THREAD_CASE_ACTION_KEYS = [a['key'] for a in THREAD_CASE_ACTIONS]
THREAD_CASE_STATUS = [{'key': 'planned', 'label': '계획'}, {'key': 'doing', 'label': '진행 중'}, {'key': 'done', 'label': '완료'}]
THREAD_CASE_STATUS_KEYS = [s['key'] for s in THREAD_CASE_STATUS]


def thread_definitions():
    return {'stages': vocab('thread_stages'), 'system_kinds': vocab('system_kinds'), 'informal_items': [x['label'] for x in vocab('informal_items')],
            'link_means': vocab('link_means'), 'system_status': vocab('system_status'), 'data_kinds': vocab('data_kinds'),
            'case_actions': vocab('case_actions'), 'case_status': vocab('case_status')}
AXES['manufacturing_monitoring'] = [
    # 전기·전자 제조 기준(PLAN-monitoring.md). 설비가 대개 스스로 자료를 내놓는 편이라
    # 갈림은 「수집」보다 **판단·대응**에서 난다 — 그래서 그 둘을 따로 둔다.
    {
        'key': 'basic_metrics', 'label': '기본 계측', 'kind': 'set',
        'question': '그 공정에서 무엇을 잡고 있는가',
        'evidence': ['coverage_pct', 'attachment'], 'evidence_label': '적용 설비 비율(%) · 수집 주기·보존 기간',
        # 앞의 셋(상태·C/T·알람)이 이 부문의 집계 기준이다 — 화면이 그 셋을 먼저 읽는다.
        'rungs': [
            {'key': 'none', 'label': '없음', 'short': '없음', 'description': '아무것도 자동으로 남지 않는다 — 일지·구두뿐'},
            {'key': 'state', 'label': '상태', 'short': '상태', 'description': '가동·정지·대기와 비가동 사유가 시간축으로 남는다'},
            {'key': 'ct', 'label': 'C/T', 'short': 'C/T', 'description': '사이클 타임이 사이클마다(또는 주기로) 남는다'},
            {'key': 'alarm', 'label': '알람', 'short': '알람', 'description': '설비 경보가 코드·시각과 함께 남는다'},
            {'key': 'quality', 'label': '품질', 'short': '품질', 'description': '불량·수율이 그 공정 단위로 남는다(SPI·AOI·ICT·FCT 판정 포함)'},
            {'key': 'process_var', 'label': '공정 변수', 'short': '공정변수', 'description': '리플로우 온도 프로파일·인쇄 압력·성형압 같은 공정 조건이 남는다'},
        ],
    },
    {
        'key': 'collection', 'label': '수집 방식', 'kind': 'rung',
        'question': '그 값이 어떻게 올라오는가',
        'evidence': ['coverage_pct', 'attachment'], 'evidence_label': '적용 설비 비율(%) · 수집 주기',
        'headline_min': 'periodic',
        'rungs': [
            {'key': 'manual_log', 'label': '수기·일지', 'description': '사람이 종이·엑셀에 적는다'},
            {'key': 'upload', 'label': '사람이 취합해 올림', 'description': '모아 둔 것을 나중에 시스템에 올린다'},
            {'key': 'periodic', 'label': '설비에서 주기 수집', 'description': '설비 인터페이스로 정해진 주기마다 받아 온다'},
            {'key': 'realtime', 'label': '실시간 자동 수집', 'description': '사람 없이 실시간으로 들어온다'},
        ],
    },
    {
        'key': 'judgement', 'label': '판단 수준', 'kind': 'rung',
        'question': '모은 값으로 무엇까지 판단하는가',
        'evidence': ['attachment'], 'evidence_label': '판정 규칙의 근거(관리도·모델)',
        'headline_min': 'detect',
        'rungs': [
            {'key': 'watch', 'label': '사람이 본다', 'description': '화면·보고서로 보기만 한다'},
            {'key': 'detect', 'label': '이상 판정', 'description': '기준선·관리도로 정상과 이상을 가른다'},
            {'key': 'diagnose', 'label': '원인 진단', 'description': '어느 설비·어느 조건 탓인지까지 짚는다'},
            {'key': 'predict', 'label': '예측', 'description': '고장·불량을 나기 전에 내다본다'},
            {'key': 'auto_adjust', 'label': '자동 보정', 'description': '판단이 설비 파라미터를 스스로 고친다'},
        ],
    },
    {
        'key': 'response', 'label': '대응 연결', 'kind': 'rung',
        'question': '판단이 났을 때 무엇이 일어나는가',
        'evidence': ['attachment'], 'evidence_label': '평균 대응 시간 · 조치 표준',
        'headline_min': 'standard',
        # 판단 수준과 가른 이유: 예측까지 하면서 알림이 주인 없는 대시보드에만 뜨는 일이
        # 흔하다. 합치면 그것이 「예측 단계」로 좋게 읽힌다(PLAN-monitoring 3-2).
        'rungs': [
            {'key': 'none', 'label': '알림 없음', 'description': '누가 찾아 봐야 안다'},
            {'key': 'notify', 'label': '사람에게 알림', 'description': '알림은 가지만 받는 사람·할 일이 정해져 있지 않다'},
            {'key': 'standard', 'label': '담당·조치 표준이 붙은 알림', 'description': '누가 무엇을 하는지가 알림에 함께 온다'},
            {'key': 'act', 'label': '시스템이 조치', 'description': '설비 정지·파라미터 보정을 시스템이 한다'},
            {'key': 'loop', 'label': '폐루프', 'description': '조치 결과가 다시 판단의 재료로 돌아간다'},
        ],
    },
    {
        'key': 'scope', 'label': '적용 범위', 'kind': 'rung',
        'question': '그 공정의 어디까지 적용됐는가',
        'evidence': ['coverage_pct'], 'evidence_label': '적용 설비 n/N 대',
        'headline_min': 'all_equip',
        'rungs': [
            {'key': 'pilot', 'label': '시범 1~2대', 'description': '몇 대에만 붙여 봤다'},
            {'key': 'some', 'label': '일부 설비', 'description': '주요 설비에는 붙었다'},
            {'key': 'all_equip', 'label': '그 공정 전 설비', 'description': '그 공정의 설비 전부에 붙었다'},
            {'key': 'standardized', 'label': '새 설비에도 기본 적용', 'description': '설비를 새로 들여도 저절로 붙는다 — 표준이 됐다'},
        ],
    },
    {
        'key': 'reliability', 'label': '신뢰도', 'kind': 'value', 'unit': '%',
        'question': '그 값과 판정을 믿고 쓰는가',
        'evidence': ['attachment'], 'evidence_label': '유효 데이터율 또는 알람 유효율(오경보 제외)',
        # 오경보가 잦으면 판단 수준이 높아도 아무도 안 본다 — 그것이 한 표에서 보여야 한다.
        # 문턱은 낮은 칸부터 — {rung, min}. 값이 넘는 가장 높은 칸을 고른다(rung_for_value).
        'thresholds': [{'rung': 'low', 'min': 0}, {'rung': 'mid', 'min': 70}, {'rung': 'high', 'min': 90}],
        'rungs': [
            {'key': 'low', 'label': '낮음', 'description': '70% 미만 — 오경보·결측이 잦아 손으로 다시 본다'},
            {'key': 'mid', 'label': '보통', 'description': '70~90% — 대체로 믿는다'},
            {'key': 'high', 'label': '높음', 'description': '90% 이상 — 그대로 쓴다'},
        ],
    },
]

# 표준 공정 어휘 — 전기·전자 제품 제조(PLAN-monitoring 2-4). 없는 것은 직접 적는다.
# 라인·설비 이름은 사업부마다 다르지만 **공정 이름이 같아야** 사업부끼리 비교된다.
PROCESS_STEPS = [
    {'key': 'iqc', 'label': '자재 입고 검사(IQC)', 'group': '그 밖'},
    {'key': 'print', 'label': '솔더 인쇄', 'group': 'PCBA'},
    {'key': 'smt', 'label': 'SMT 실장', 'group': 'PCBA'},
    {'key': 'reflow', 'label': '리플로우', 'group': 'PCBA'},
    {'key': 'aoi', 'label': 'SPI·AOI 검사', 'group': 'PCBA'},
    {'key': 'manual_insert', 'label': '수삽·후공정', 'group': 'PCBA'},
    {'key': 'coating', 'label': '코팅·세척', 'group': 'PCBA'},
    {'key': 'injection', 'label': '사출', 'group': '기구 부품'},
    {'key': 'press', 'label': '프레스·판금', 'group': '기구 부품'},
    {'key': 'painting', 'label': '도장·증착', 'group': '기구 부품'},
    {'key': 'machining', 'label': '후가공', 'group': '기구 부품'},
    {'key': 'module_assy', 'label': '모듈 조립', 'group': '조립·검사'},
    {'key': 'final_assy', 'label': '최종 조립', 'group': '조립·검사'},
    {'key': 'func_test', 'label': '기능 검사(ICT·FCT)', 'group': '조립·검사'},
    {'key': 'calibration', 'label': '캘리브레이션', 'group': '조립·검사'},
    {'key': 'visual', 'label': '외관 검사', 'group': '조립·검사'},
    {'key': 'reliability_test', 'label': '신뢰성 시험', 'group': '그 밖'},
    {'key': 'packing', 'label': '포장', 'group': '그 밖'},
    {'key': 'logistics', 'label': '물류', 'group': '그 밖'},
    {'key': 'utility', 'label': '유틸리티(공조·용수·전력)', 'group': '그 밖'},
]
PROCESS_STEP_KEYS = [p['key'] for p in PROCESS_STEPS]
PROCESS_STEP_LABELS = {p['key']: p['label'] for p in PROCESS_STEPS}


def monitoring_definitions():
    return {'process_steps': vocab('process_steps')}


# ── 공장 최적화 (2026-09-02 개통) ─────────────────────────────────────────
#
# 대상은 **법인 × 라인**(subject.site · subject.line). 공정 단계는 결정 단위로 너무 잘고
# 법인만은 너무 굵다 — 같은 법인 안에서도 라인마다 트윈 유무가 갈린다.
# 수단은 공장 시뮬레이션 — 다섯 **종류**(agent.kind 에 key). 종류는 축이 아니다: 시뮬레이션
# 부문에서 「낙하 해석」이 축이 아니라 수단인 것과 같다. 어느 KPI 에 닿나는 종류가 정한다.
OPTIMIZATION_KINDS = [
    {'key': 'equipment', 'label': '설비·로봇', 'description': '기구·제어SW 설계의 사전 검증'},
    {'key': 'line', 'label': '라인', 'description': '설비·로봇·작업자 배치와 생산 순서의 사전 결정'},
    {'key': 'logistics', 'label': '물류', 'description': '동선·물류 기기 대수의 사전 검증'},
    {'key': 'virtual_pilot', 'label': '가상 시생산', 'description': '생산성·조립성·작업성의 양산 전 검증'},
    {'key': 'operation', 'label': '생산중 운영', 'description': '생산 계획·보전 주기·창고 운영의 최적 수립'},
]
OPTIMIZATION_KIND_KEYS = [k['key'] for k in OPTIMIZATION_KINDS]
# 모델 충실도의 **대조 기준** — 무엇과 견주어 맞는지를 잰 값인가. 평가 근거 칸에서 고른다.
FIDELITY_BASIS = [
    {'key': 'plan_takt', 'label': '계획 택트'},
    {'key': 'actual_takt', 'label': '실적 택트'},
    {'key': 'throughput', 'label': '처리량(UPH)'},
    {'key': 'utilization', 'label': '가동률'},
    {'key': 'lead_time', 'label': '리드타임'},
    {'key': 'wip', 'label': '재공·재고'},
    {'key': 'headcount', 'label': '투입 인원'},
]

AXES['factory_optimization'] = [
    # 시뮬레이션 부문의 다섯 축과 같은 뼈대 — 그래야 「계획」 순서도에서 두 부문이 나란히 읽힌다.
    {
        'key': 'fidelity', 'label': '모델 충실도', 'kind': 'value', 'unit': '%',
        'question': '모델이 실측과 얼마나 맞는가',
        'evidence': ['fidelity_basis', 'error_pct', 'attachment'],
        'evidence_label': '대조 기준 · 오차(%) · 첨부',
        # 문턱은 낮은 칸부터 — 값이 넘는 가장 높은 칸(rung_for_value). 신뢰도 축과 같은 방식.
        'thresholds': [{'rung': 'trend', 'min': 0}, {'rung': 'ranking', 'min': 70}, {'rung': 'reproduce', 'min': 90}],
        'rungs': [
            {'key': 'trend', 'label': '경향 일치', 'description': '방향은 맞지만 값이 안 맞아 대안 간 우열까지는 못 가른다'},
            {'key': 'ranking', 'label': '우열 판정', 'description': '값이 맞아 배치·계획 대안 간 우열을 가린다'},
            {'key': 'reproduce', 'label': '실측 재현', 'description': '실적 택트·처리량을 그대로 재현해 결과를 믿고 쓴다'},
        ],
    },
    {
        'key': 'data_link', 'label': '데이터 연동', 'kind': 'set',
        'question': '모델의 입력이 어디서 오는가',
        'evidence': ['attachment'], 'evidence_label': '연동 시스템·갱신 주기',
        'rungs': [
            {'key': 'manual', 'label': '수동 입력', 'short': '수동', 'description': '레이아웃·택트를 사람이 넣는다'},
            {'key': 'layout', 'label': '레이아웃·BOM 자동 반영', 'short': '레이아웃', 'description': 'CAD·PLM 의 배치·BOM 이 모델로 들어온다'},
            {'key': 'actuals', 'label': '택트·실적 자동 입력', 'short': '실적', 'description': 'MES 의 택트·가동 실적이 모델의 입력이 된다'},
            {'key': 'realtime', 'label': '실시간 동기(운영 트윈)', 'short': '실시간', 'description': '현장 상태가 모델에 실시간으로 비친다'},
            {'key': 'report', 'label': '결과 자동 보고', 'short': '보고', 'description': '시뮬레이션 결과가 보고서·의사결정 화면으로 자동 간다'},
        ],
    },
    {
        'key': 'modeling', 'label': '모델링 범위', 'kind': 'rung',
        'question': '무엇까지 모델에 담는가',
        'evidence': ['attachment'], 'evidence_label': '모델 구성 요소 목록',
        'headline_min': 'actors',
        'rungs': [
            {'key': 'static', 'label': '정적 배치', 'description': '설비 위치와 면적만 — 흐름은 없다'},
            {'key': 'dynamic', 'label': '동적 흐름', 'description': '택트·버퍼·정지가 시간으로 돈다'},
            {'key': 'actors', 'label': '작업자·로봇 거동', 'description': '작업자 이동·로봇 동작까지 모델에 있다'},
            {'key': 'logistics', 'label': '물류·재고', 'description': '자재 공급·재공·창고까지 한 모델이다'},
            {'key': 'planning', 'label': '계획·보전 주기', 'description': '생산 계획과 보전 일정까지 모델이 돌린다'},
        ],
    },
    {
        'key': 'substitution', 'label': '검증 대체', 'kind': 'rung',
        'question': '시뮬레이션 결과가 실제 결정을 얼마나 대체하는가',
        'evidence': ['attachment'], 'evidence_label': '대체한 결정·회피한 실물 검증',
        'headline_min': 'approval_gate',
        'rungs': [
            {'key': 'none', 'label': '없음', 'description': '결정은 경험과 실물로만'},
            {'key': 'reference', 'label': '참고', 'description': '결과를 보긴 하지만 결정 근거는 아니다'},
            {'key': 'parallel', 'label': '병행 검토', 'description': '실물 검토와 나란히 본다'},
            {'key': 'pre_verify', 'label': '사전 검증', 'description': '배치·계획 확정 전에 반드시 거친다'},
            {'key': 'approval_gate', 'label': '승인 게이트', 'description': '투자·배치 승인의 근거 자료로 인정된다'},
            {'key': 'full', 'label': '완전 대체', 'description': '실물 파일럿 없이 확정한다'},
        ],
    },
    {
        'key': 'scope', 'label': '적용 범위', 'kind': 'rung',
        'question': '어느 라인까지 적용됐는가',
        'evidence': ['coverage_pct'], 'evidence_label': '적용 라인 n/N',
        'headline_min': 'new_lines',
        'rungs': [
            {'key': 'pilot', 'label': '시범 라인', 'description': '한 라인에서 해 봤다'},
            {'key': 'representative', 'label': '대표 라인', 'description': '법인의 대표 라인에는 적용됐다'},
            {'key': 'new_lines', 'label': '신규 라인 전부', 'description': '새로 세우는 라인은 다 거친다'},
            {'key': 'all_sites', 'label': '전 법인', 'description': '모든 법인·라인이 같은 방식으로 한다'},
        ],
    },
]


def factory_definitions():
    return {'optimization_kinds': vocab('optimization_kinds'), 'fidelity_basis': vocab('fidelity_basis')}


AXIS_KINDS = {'rung', 'value', 'set', 'matrix'}   # matrix: 바탕 토글 + 불량 유형 × 열 표(모델링 수준)


# ── 기준 정보 — 화면의 선택지(2026-08-30) ───────────────────────────────────
#
# 코드의 값이 **기본**이고, 설정(`vocab` 키)에 적힌 것이 있으면 그것이 이긴다.
# 사무국이 설정에서 말을 고치거나 항목을 더하고 뺄 수 있다.
#
# ⚠️ key 는 자료에 박히는 값이라 **한 번 만들면 안 바꾼다.** 화면은 label 만 고치게 한다.
#    지운 값을 이미 쓰고 있는 자료는 그대로 남고, 화면에는 key 가 그대로 보인다
#    (없는 말로 조용히 바뀌지 않게).
VOCABS = [
    {'key': 'model_kinds', 'label': '모델 종류', 'sector': 'simulation',
     'hint': '시뮬레이션이 무엇에 기대어 도는가 — 수단의 속성입니다.'},
    {'key': 'review_timing', 'label': '해석 활용 — 시점', 'sector': 'simulation', 'hint': '해석 활용 기록의 「시점」 칸.'},
    {'key': 'review_decision', 'label': '해석 활용 — 결정 반영', 'sector': 'simulation', 'hint': '해석 활용 기록의 「결정 반영」 칸.'},
    {'key': 'review_basis', 'label': '해석 활용 — 판정 근거', 'sector': 'simulation', 'hint': '해석 활용 기록의 「판정 근거」 칸.'},
    {'key': 'review_kind', 'label': '해석 활용 — 종류', 'sector': 'simulation', 'hint': '설계 스펙 검토·원인 분석처럼 무엇을 위한 해석인가.'},
    {'key': 'system_kinds', 'label': '시스템 종류', 'sector': 'digital_thread', 'hint': 'PLM·MES 처럼 시스템 사전의 갈래.'},
    {'key': 'thread_stages', 'label': '생애 단계', 'sector': 'digital_thread',
     'hint': '기획→개발→…→경영. **차례가 뜻을 갖습니다** — 위에서 아래로 흐르고, 거슬러 가면 폐루프로 셉니다.'},
    {'key': 'link_means', 'label': '연계 수단', 'sector': 'digital_thread', 'hint': '시스템이 무엇으로 이어질 수 있나(API·파일…).'},
    {'key': 'system_status', 'label': '시스템 상태', 'sector': 'digital_thread', 'hint': '운영·도입 중·폐지 예정.'},
    {'key': 'data_kinds', 'label': '데이터 종류', 'sector': 'digital_thread', 'hint': '구간으로 무엇이 흐르나.'},
    {'key': 'case_actions', 'label': '연계 개발 — 무엇을', 'sector': 'digital_thread', 'hint': '연동·도입·정합화·자동화·폐지.'},
    {'key': 'case_status', 'label': '연계 개발 — 상태', 'sector': 'digital_thread', 'hint': '계획·진행 중·완료.'},
    {'key': 'informal_items', 'label': '비시스템 매개', 'sector': 'digital_thread',
     'hint': '시스템을 거치지 않고 자료가 오가는 길 — 시스템 사전에 이 이름으로 줄이 섭니다. '
             '더한 것은 다음에 화면을 열 때 생기고, 뺀 것은 이미 선 줄을 지우지 않습니다.'},
    {'key': 'accuracy_rules', 'label': '항목 정확도 집계', 'sector': 'simulation', 'fixed': True,
     'hint': '한 시험 항목에 수단이 여럿일 때 정확도를 어떻게 낼지. 셈이 key 로 갈려 **문구만** 고칩니다.'},
    {'key': 'process_steps', 'label': '공정 단계', 'sector': 'manufacturing_monitoring',
     'hint': '전기·전자 제조의 표준 공정. 라인 이름이 갈려도 공정끼리는 사업부를 넘어 비교됩니다.'},
    {'key': 'optimization_kinds', 'label': '공장 시뮬레이션 종류', 'sector': 'factory_optimization', 'fixed': True,
     'hint': '설비·로봇 / 라인 / 물류 / 가상 시생산 / 생산중 운영 — 수단의 종류입니다. 종류가 어느 KPI 에 닿는지를 정하므로 줄은 못 박고 문구만 고칩니다.'},
    {'key': 'fidelity_basis', 'label': '모델 충실도 — 대조 기준', 'sector': 'factory_optimization',
     'hint': '모델 충실도(%)를 무엇과 견주어 잰 값인지 — 평가 근거 칸에서 고릅니다.'},
]
VOCAB_BY_KEY = {v['key']: v for v in VOCABS}


def _vocab_defaults(name):
    """코드의 기본값. 이 표가 곧 「처음 기준치」다."""
    return {
        'model_kinds': MODEL_KINDS,
        'review_timing': REVIEW_FIELDS['timing']['options'],
        'review_decision': REVIEW_FIELDS['decision']['options'],
        'review_basis': REVIEW_FIELDS['basis']['options'],
        'review_kind': REVIEW_KINDS,
        'system_kinds': SYSTEM_KINDS,
        'thread_stages': THREAD_STAGES,
        'link_means': LINK_MEANS,
        'system_status': SYSTEM_STATUS,
        'data_kinds': DATA_KINDS,
        'case_actions': THREAD_CASE_ACTIONS,
        'case_status': THREAD_CASE_STATUS,
        'process_steps': PROCESS_STEPS,
        'optimization_kinds': OPTIMIZATION_KINDS,
        'fidelity_basis': FIDELITY_BASIS,
        'informal_items': INFORMAL_ITEMS,
        'accuracy_rules': ACCURACY_RULE_LABELS,
    }.get(name, [])


def _vocab_conf():
    """설정의 `vocab` 을 **한 요청 안에서 한 번만** 읽는다.

    ⚠️ segment_dict 처럼 줄마다 부르는 자리가 있어, 그때마다 질의하면 표 하나에 수백 번 간다.
       요청이 끝나면 g 가 사라지므로 설정을 고친 다음 요청은 새 값을 본다.
    """
    try:
        from flask import g, has_app_context
        if not has_app_context():
            return _setting('vocab') or {}
        if not hasattr(g, '_dtm_vocab'):
            g._dtm_vocab = _setting('vocab') or {}
        return g._dtm_vocab
    except (ImportError, RuntimeError):
        return _setting('vocab') or {}


def forget_vocab_cache():
    """설정을 고친 뒤 같은 요청 안에서 옛 값을 보지 않도록 지운다."""
    try:
        from flask import g, has_app_context
        if has_app_context() and hasattr(g, '_dtm_vocab'):
            del g._dtm_vocab
    except (ImportError, RuntimeError):
        pass


def vocab(name):
    """그 선택지의 지금 값 — 설정에 있으면 그것, 없으면 코드의 기본.

    못 박힌(fixed) 사전은 **코드의 줄만** 남기고 문구만 덮는다 — 셈이나 이력이 key 로
    묶여 있어, 설정에서 줄이 생기고 없어지면 셈이 조용히 어긋난다.
    """
    conf = _vocab_conf()
    rows = conf.get(name) if isinstance(conf, dict) else None
    if not isinstance(rows, list) or not rows:
        return list(_vocab_defaults(name))
    if (VOCAB_BY_KEY.get(name) or {}).get('fixed'):
        words = {r['key']: r for r in rows if isinstance(r, dict) and r.get('key')}
        return [{**d, **{k: str(v) for k, v in (words.get(d['key']) or {}).items()
                         if k in ('label', 'description') and v}}
                for d in _vocab_defaults(name)]
    out = []
    for r in rows:
        if not isinstance(r, dict) or not r.get('key') or not r.get('label'):
            continue
        item = {'key': str(r['key']), 'label': str(r['label'])}
        for extra in ('description', 'short', 'group'):
            if r.get(extra):
                item[extra] = str(r[extra])
        out.append(item)
    return out or list(_vocab_defaults(name))


def vocab_keys(name):
    return {x['key'] for x in vocab(name)}


def vocab_labels(name):
    return {x['key']: x['label'] for x in vocab(name)}


def clean_vocab_payload(raw):
    """설정으로 들어오는 기준 정보를 다듬는다 — 아는 사전만, key 는 겹치지 않게, 빈 줄은 뺀다.

    ⚠️ key 는 자료에 박히는 값이다. 화면이 새 항목의 key 를 지어 보내면 그대로 쓰되,
       빈 것·겹친 것은 막는다. 하나도 안 남으면 그 사전은 **기본으로 되돌린다**(빈 선택지는
       화면을 못 쓰게 만든다).
    """
    if not isinstance(raw, dict):
        raise ValueError('기준 정보의 꼴이 아닙니다.')
    out = {}
    for name, rows in raw.items():
        if name not in VOCAB_BY_KEY or not isinstance(rows, list):
            continue
        items, seen = [], set()
        for r in rows:
            if not isinstance(r, dict):
                continue
            key = str(r.get('key') or '').strip()
            label = str(r.get('label') or '').strip()
            if not key or not label or key in seen:
                continue
            seen.add(key)
            item = {'key': key[:60], 'label': label[:100]}
            for extra in ('description', 'short', 'group'):
                if r.get(extra):
                    item[extra] = str(r[extra])[:200]
            items.append(item)
        if items:
            out[name] = items
    return out


# ── 척도 문구 — 평가할 때 고르는 칸(2026-08-30) ────────────────────────────
#
# ⚠️ 칸의 key 는 **평가와 이력이 묶여 있는 자리**다. 더하고 빼지 못하고 문구만 고친다
#    (get_axes 가 key 가 맞는 칸만 덮는다). 칸을 더하는 것은 코드의 일이다.
def ladder_all():
    """부문 × 축마다 한 벌 — 설정 화면이 축의 문구를 그린다.

    축 이름·묻는 것·근거 이름표는 글 칸으로, 칸(과 바탕·열)은 표로 고친다.
    """
    conf = _setting('ladders') or {}
    rows = lambda part: [{'key': r['key'], 'label': r['label'], 'description': r.get('description') or ''}
                         for r in part]
    out = []
    for sector in sectors():
        sk = sector['key']
        if not AXES.get(sk):
            continue
        for axis in get_axes(sk):
            saved = (conf.get(sk) or {}).get(axis['key']) if isinstance(conf, dict) else None
            extras = [{'key': p, 'label': {'base': '바탕', 'columns': '열'}[p], 'items': rows(axis[p])}
                      for p in ('base', 'columns') if axis.get(p)]
            out.append({
                'key': f"ladder:{sk}:{axis['key']}", 'store': 'ladders',
                'sector': sk, 'sector_label': sector['label'], 'axis': axis['key'],
                'label': f"척도 · {axis['label']}", 'fixed': True, 'has_description': True,
                'hint': '평가할 때 고르는 칸입니다. 축 이름과 묻는 말도 여기서 고칩니다.',
                'fields': [{'key': 'label', 'label': '축 이름', 'value': axis['label']},
                           {'key': 'question', 'label': '묻는 것', 'value': axis.get('question') or ''},
                           {'key': 'evidence_label', 'label': '근거 이름표', 'value': axis.get('evidence_label') or ''}],
                'items': rows(axis['rungs']), 'extras': extras,
                'is_custom': bool(saved),
            })
    return out


def sector_words_all():
    """부문의 말 — 화면 전체의 이름표. 한 벌로 묶어 보여 준다."""
    conf = _setting('sector_words') or {}
    items = []
    for s in sectors():
        items.append({'key': f"{s['key']}:label", 'label': s['label'], 'description': '부문 이름'})
        items.append({'key': f"{s['key']}:subject_label", 'label': s['subject_label'], 'description': f"{s['label']} — 대상"})
        if s.get('agent_label'):
            items.append({'key': f"{s['key']}:agent_label", 'label': s['agent_label'], 'description': f"{s['label']} — 수단"})
    return {
        'key': 'sector_words', 'store': 'sector_words', 'sector_label': '공통', 'fixed': True,
        'label': '부문의 말', 'has_description': False,
        'hint': '관리 창 이름·표 머리·추출 시트가 모두 이 말을 씁니다. 「시험 항목」을 「검증 항목」이라 부르면 여기서 고치세요.',
        'items': items, 'is_custom': bool(conf),
    }


def clean_ladders_payload(raw):
    """들어온 축의 문구를 다듬는다 — **아는 부문·축·줄만**, 문구만."""
    if not isinstance(raw, dict):
        raise ValueError('축 문구의 꼴이 아닙니다.')

    def _words(base_rows, rows):
        known = {r['key'] for r in base_rows}
        out = []
        for r in rows if isinstance(rows, list) else []:
            if not isinstance(r, dict) or r.get('key') not in known:
                continue
            item = {'key': r['key']}
            for f, cap in (('label', 100), ('description', 400), ('short', 40)):
                if str(r.get(f) or '').strip():
                    item[f] = str(r[f]).strip()[:cap]
            if len(item) > 1:
                out.append(item)
        return out

    out = {}
    for sk, axes in raw.items():
        if sk not in AXES or not isinstance(axes, dict):
            continue
        keep = {}
        for ak, val in axes.items():
            axis = next((a for a in AXES[sk] if a['key'] == ak), None)
            if axis is None:
                continue
            ov = _axis_override(val)
            row = {}
            for f in ('label', 'question', 'evidence_label'):
                if axis.get(f) and str(ov.get(f) or '').strip():
                    row[f] = str(ov[f]).strip()[:200]
            rungs = _words(axis['rungs'], ov.get('rungs'))
            if rungs:
                row['rungs'] = rungs
            for part in ('base', 'columns'):
                if axis.get(part):
                    got = _words(axis[part], ov.get(part))
                    if got:
                        row[part] = got
            if row:
                keep[ak] = row
        if keep:
            out[sk] = keep
    return out



def vocab_all():
    """설정 화면이 그리는 것 — 정의와 지금 값, 그리고 기본값과 다른지."""
    labels = {s['key']: s['label'] for s in SECTORS}
    out = []
    for v in VOCABS:
        items = vocab(v['key'])
        out.append({**v, 'store': 'vocab', 'sector_label': labels.get(v.get('sector'), '공통'),
                    'fixed': bool(v.get('fixed')), 'has_description': False,
                    'items': items, 'is_custom': items != list(_vocab_defaults(v['key']))})
    return out


def sectors():
    """부문 — 설정(`sector_words`)의 말을 덮은 것.

    subject_label·agent_label 은 이 화면 전체의 이름표다(관리 창 제목, 표 머리, 추출
    시트 이름…). 회사마다 「시험 항목」을 「검증 항목」이라 부르므로 고칠 수 있어야 한다.
    ⚠️ key·has_agent·phase 는 짜임이라 안 바뀐다 — **말만** 덮는다.
    """
    conf = _setting('sector_words') or {}
    if not isinstance(conf, dict):
        return list(SECTORS)
    out = []
    for s in SECTORS:
        w = conf.get(s['key'])
        if not isinstance(w, dict):
            out.append(s)
            continue
        row = dict(s)
        for f in ('label', 'subject_label', 'agent_label'):
            if s.get(f) and str(w.get(f) or '').strip():
                row[f] = str(w[f]).strip()[:40]
        out.append(row)
    return out


def sector_of(key):
    return next((s for s in sectors() if s['key'] == key), None) or SECTOR_BY_KEY.get(key) or {}


def clean_sector_words_payload(raw):
    """부문의 말 — 아는 부문의 아는 자리만, 빈 것은 버린다."""
    if not isinstance(raw, dict):
        raise ValueError('부문의 말의 꼴이 아닙니다.')
    out = {}
    for key, w in raw.items():
        base = SECTOR_BY_KEY.get(key)
        if base is None or not isinstance(w, dict):
            continue
        keep = {}
        for f in ('label', 'subject_label', 'agent_label'):
            if base.get(f) and str(w.get(f) or '').strip():
                keep[f] = str(w[f]).strip()[:40]
        if keep:
            out[key] = keep
    return out


def sector_is_active(sector_key):
    """척도가 있는 부문만 화면에 뜬다. 자리만 잡힌 부문은 안 뜬다."""
    return bool(AXES.get(sector_key))


def axis_of(sector_key, axis_key):
    for a in AXES.get(sector_key, []):
        if a['key'] == axis_key:
            return a
    return None


def rung_keys(axis):
    return [r['key'] for r in axis['rungs']]


def rung_index(axis, rung_key):
    """칸의 서열. 없는 칸이면 None — 0 으로 두면 「첫 칸」과 「미평가」가 섞인다.

    set 축은 rung 이 선택한 항목들의 묶음('pre,run,post')이고 서열은 **켠 개수**다.
    'manual'(아무것도 안 켬)은 0.
    """
    if axis.get('kind') == 'set':
        flags = set_flags(axis, rung_key)
        return None if flags is None else len(flags)
    keys = rung_keys(axis)
    return keys.index(rung_key) if rung_key in keys else None


def flag_defs(axis):
    """켤 수 있는 항목의 정의 — set 축은 첫 칸을 뺀 칸들, matrix 축은 바탕(base)."""
    return axis['base'] if axis.get('kind') == 'matrix' else axis['rungs'][1:]


def set_flag_keys(axis):
    """set 축에서 켤 수 있는 항목들 — 첫 칸(수동)을 뺀 나머지. matrix 축은 바탕 항목들."""
    return [r['key'] for r in flag_defs(axis)]


def matrix_level(axis, rung, defects, defect_types):
    """matrix 축을 판의 **서열 하나**로 접는다 — (level, {'test','market','total'}).

      0 없음 → 1 형상 → 2 거동 → 3 일부 유형의 시험 불량 재현 → 4 전 유형 시험 재현 → 5 시장 불량까지
    불량 유형은 **시뮬레이션의 목록**(agent.defect_types)이 기준이다 — 지운 유형의 기록은 안 센다.
    """
    flags = set_flags(axis, rung) or []
    level = 0
    if 'geometry' in flags:
        level = 1
    if 'performance' in flags:
        level = 2
    names = [d for d in (defect_types or []) if isinstance(d, str)]
    defects = defects if isinstance(defects, dict) else {}
    test = sum(1 for d in names if (defects.get(d) or {}).get('test'))
    market = sum(1 for d in names if (defects.get(d) or {}).get('market'))
    if test > 0:
        level = max(level, 3)
    if names and test == len(names):
        level = max(level, 4)
    if market > 0:
        level = max(level, 5)
    return level, {'test': test, 'market': market, 'total': len(names)}


def set_flags(axis, rung_key):
    """set 축의 rung 문자열 → 선택한 항목 목록. 'manual' 이나 '' 은 []. 모르는 항목이 섞이면 None."""
    if rung_key is None:
        return None
    if rung_key in ('', rung_keys(axis)[0]):
        return []
    allowed = set_flag_keys(axis)
    parts = [p for p in str(rung_key).split(',') if p]
    if any(p not in allowed for p in parts):
        return None
    return [k for k in allowed if k in parts]          # 정해진 순서로


def set_rung(axis, flags):
    """선택한 항목 목록 → 저장할 rung 문자열. 빈 묶음은 첫 칸(수동)."""
    allowed = set_flag_keys(axis)
    picked = set(flags or [])
    for key, implied in (axis.get('implies') or {}).items():     # 「완전 대체」는 나머지를 다 켠다
        if key in picked:
            picked.update(implied)
    picked = [k for k in allowed if k in picked]
    return ','.join(picked) if picked else rung_keys(axis)[0]


# ── 정확도 — 값 → 칸, 항목 집계 ───────────────────────────────────────────
#
# 문턱은 **사업부별 ⚙설정**이다. 아래는 아무 설정도 없을 때의 기본값이며 자리
# 표시일 뿐이다 — 사업부 엑셀의 경계와 맞춰야 한다(PLAN 4절·12절).
#
# ⚠️ 경계 방향(90 은 위 칸인가 아래 칸인가)은 아직 남은 결정이다. 설정 값
#    `accuracy_boundary` 로 두고 기본은 'gte'(같으면 위 칸) — 확인되면 바꾼다.
DEFAULT_ACCURACY_THRESHOLDS = [
    {'rung': 'trend', 'min': 0.0},
    {'rung': 'quantitative', 'min': 70.0},
    {'rung': 'correlated', 'min': 90.0},
]
ACCURACY_BOUNDARIES = {'gte', 'gt'}
DEFAULT_ACCURACY_BOUNDARY = 'gte'

# 항목 정확도의 집계 규칙 — 시험 항목마다 저장한다(PLAN 4절).
ACCURACY_RULES = {'auto', 'single', 'mean'}
# ⚠️ key 로 셈이 갈린다(services._item_accuracy) — 더하고 빼지 못한다. 문구만 고친다.
ACCURACY_RULE_LABELS = [
    {'key': 'auto', 'label': '자동 — 하나면 그 값, 여럿이면 평균'},
    {'key': 'mean', 'label': '평균 — 값 있는 수단의 평균'},
    {'key': 'single', 'label': '단일 — 대표 수단 하나 (여럿이면 값 없음)'},
]


def rung_for_value(value, thresholds=None, boundary=DEFAULT_ACCURACY_BOUNDARY):
    """값 → 칸 key. 값이 없으면 None(미평가).

    문턱 목록은 낮은 칸부터. 값이 넘는 **가장 높은** 칸을 고른다.
    'gte' 면 같아도 위 칸, 'gt' 면 넘어야 위 칸. 첫 칸의 min 은 보통 0 이라
    값만 있으면 최소한 첫 칸이다.
    """
    if value is None:
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    if boundary not in ACCURACY_BOUNDARIES:
        boundary = DEFAULT_ACCURACY_BOUNDARY
    chosen = None
    for t in (thresholds or DEFAULT_ACCURACY_THRESHOLDS):
        m = float(t['min'])
        if (v >= m) if boundary == 'gte' else (v > m or m == 0.0):
            chosen = t['rung']
    return chosen


def aggregate_accuracy(values, rule='auto'):
    """항목 정확도. (값, 채운 수, 전체 수)

    ⚠️ 평균은 **값 있는 것만**으로 낸다. 없는 것은 0 이 아니라 「N개 중 M개 미입력」이다.
       0 으로 넣으면 아직 재지 않은 시뮬레이션이 항목 정확도를 끌어내린다.
    'auto' 는 시뮬레이션이 하나면 single, 둘 이상이면 mean.
    'single' 인데 값이 여럿이면 — 어느 것인지 정해져 있지 않으므로 None 을 돌려
    화면이 「대표 시뮬레이션을 고르세요」를 말하게 한다.
    """
    total = len(values)
    filled = [float(v) for v in values if v is not None]
    if not filled:
        return None, 0, total
    if rule not in ACCURACY_RULES:
        rule = 'auto'
    if rule == 'auto':
        rule = 'single' if total == 1 else 'mean'
    if rule == 'single':
        return (round(filled[0], 1) if len(filled) == 1 else None), len(filled), total
    return round(sum(filled) / len(filled), 1), len(filled), total


# ── 재평가 필요 ───────────────────────────────────────────────────────────────────
DEFAULT_STALE_DAYS = 365          # 12개월(PLAN 8절). ⚙설정.

# ── 가져오기 틀 ────────────────────────────────────────────────────────────
#
# 처음 채우기(로드맵에서 뽑아 손보고 넣기)와 정확도 엑셀 가져오기가 **같은 틀**을
# 쓴다(PLAN 6절). 정확도 열은 비워도 된다. 사업부 엑셀의 형식은 알 필요가 없다.
IMPORT_COLUMNS = [
    {'key': 'division', 'label': '사업부', 'required': True},
    {'key': 'subject', 'label': '시험 항목', 'required': True},
    {'key': 'subject_detail', 'label': '세부', 'required': False},
    {'key': 'product_families', 'label': '적용 제품군', 'required': False,
     'note': '쉼표로 여럿'},
    {'key': 'agent', 'label': '시뮬레이션', 'required': True},
    {'key': 'model_kind', 'label': '모델 종류', 'required': False,
     'note': '물리 기반 / 데이터 기반 / 하이브리드'},
    {'key': 'accuracy', 'label': '정확도(%)', 'required': False},
    {'key': 'roadmap_task_id', 'label': '로드맵 항목 id', 'required': False,
     'note': '참고 링크. 뽑아낸 틀에는 채워져 나온다'},
    {'key': 'project_uuid', 'label': '대시보드 과제 uuid', 'required': False,
     'note': '참고 링크'},
]

# ── 설정 — 기본값 위에 운영 값을 덮는다 ──────────────────────────────────
#
# 전략 모듈의 get_thresholds 와 같은 방식(module_settings 표). 키:
#   ladders        {sector: {axis: [{key,label,description}…]}}   문구만 덮는다, key 는 고정
#   accuracy       {division_id|'*': {'thresholds': [...], 'boundary': 'gte'|'gt'}}
#   phenomena      {division_id: [태그…]}                            사업부별 현상 태그 사전
#   stale_days     int
#   hidden_divisions [division_id…]   이 화면에서 뺄 조직 — SR·GTR·CS 처럼 사업부가 아닌 것(2026-08-28)
#   hidden_sectors   [sector_key…]    이 화면에서 뺄 부문 — 아직 안 쓰는 부문을 토글에서 감춘다(2026-08-29)
#   vocab            {이름: [{key,label}…]}  기준 정보 — 화면의 선택지. 코드의 값이 기본, 여기 있으면 이긴다(2026-08-30)
#   sector_words     {부문: {label,subject_label,agent_label}}  부문의 말 — 화면 전체의 이름표(2026-08-30)
SETTINGS_KEYS = ('ladders', 'accuracy', 'phenomena', 'stale_days', 'hidden_divisions', 'review_promote_min',
                 'hidden_sectors', 'vocab', 'sector_words')


def _setting(key):
    from app.modules.digital_twin_dashboard.models import ModuleSettings
    row = ModuleSettings.query.filter_by(
        module_name=MODULE_KEY, settings_key=key).first()
    return row.settings_data if row and row.settings_data is not None else None


def get_axes(sector_key):
    """척도 — 기본 문구 위에 설정의 문구를 덮는다. **key 가 맞는 칸만** 덮는다.

    설정에 모르는 key 가 있어도 칸이 생기지 않는다. 칸을 더하는 것은 코드의 일이다
    — 이력과 평가가 key 로 묶여 있어, 설정에서 칸이 생기고 없어지면 이력이 미아가 된다.
    """
    base = AXES.get(sector_key, [])
    override = (_setting('ladders') or {}).get(sector_key) or {}
    out = []
    for axis in base:
        ov = _axis_override(override.get(axis['key']))
        row = {**axis, 'rungs': _overlay(axis['rungs'], ov.get('rungs'))}
        for f in ('label', 'question', 'evidence_label'):
            if axis.get(f) and str(ov.get(f) or '').strip():
                row[f] = str(ov[f]).strip()
        for part in ('base', 'columns'):      # 모델링 수준의 바탕 토글과 열
            if axis.get(part):
                row[part] = _overlay(axis[part], ov.get(part))
        out.append(row)
    return out


def _axis_override(raw):
    """저장된 꼴을 하나로 — 옛 꼴(칸 목록만)도 그대로 받는다."""
    if isinstance(raw, list):
        return {'rungs': raw}
    return raw if isinstance(raw, dict) else {}


def _overlay(base_rows, saved):
    """**key 가 맞는 줄만** 문구를 덮는다 — 줄은 늘지도 줄지도 않는다."""
    words = {r['key']: r for r in (saved or []) if isinstance(r, dict) and r.get('key')}
    return [{**r, **{k: str(v) for k, v in (words.get(r['key']) or {}).items()
                     if k in ('label', 'description', 'short') and str(v).strip()}}
            for r in base_rows]


def get_accuracy_rule(division_id=None):
    """사업부의 정확도 문턱과 경계. 사업부 값이 없으면 전사('*'), 그것도 없으면 기본."""
    conf = _setting('accuracy') or {}
    row = conf.get(str(division_id)) if division_id is not None else None
    row = row or conf.get('*') or {}
    thresholds = row.get('thresholds') if isinstance(row.get('thresholds'), list) else None
    valid_rungs = set(rung_keys(axis_of('simulation', 'accuracy')))
    if thresholds and all(isinstance(t, dict) and t.get('rung') in valid_rungs
                          and isinstance(t.get('min'), (int, float)) for t in thresholds):
        thresholds = sorted(thresholds, key=lambda t: float(t['min']))
    else:
        thresholds = DEFAULT_ACCURACY_THRESHOLDS
    boundary = row.get('boundary') if row.get('boundary') in ACCURACY_BOUNDARIES \
        else DEFAULT_ACCURACY_BOUNDARY
    return {'thresholds': thresholds, 'boundary': boundary}


def get_phenomena(division_id):
    """사업부별 현상 태그 사전. 없으면 빈 목록 — 태그는 평가하면서 자란다."""
    conf = _setting('phenomena') or {}
    tags = conf.get(str(division_id)) or []
    return [t for t in tags if isinstance(t, str) and t.strip()]


def get_hidden_divisions():
    """이 화면에서 뺀 조직의 id 집합. 설정이 깨져 있으면 아무것도 안 뺀다."""
    raw = _setting('hidden_divisions')
    if not isinstance(raw, list):
        return set()
    out = set()
    for v in raw:
        try:
            out.add(int(v))
        except (TypeError, ValueError):
            continue
    return out


def get_hidden_sectors():
    """토글에서 감출 부문 key 집합. 설정이 깨져 있으면 아무것도 안 감춘다.

    감춘 부문은 **화면에서만 사라진다** — 자료는 그대로 있고, 다시 켜면 그대로 보인다.
    """
    raw = _setting('hidden_sectors')
    if not isinstance(raw, list):
        return set()
    return {v for v in raw if isinstance(v, str) and v in SECTOR_BY_KEY}


def get_stale_days():
    v = _setting('stale_days')
    return int(v) if isinstance(v, (int, float)) and v > 0 else DEFAULT_STALE_DAYS


# ── 해석 활용 기록 — 시험과 짝이 없는 스팟성 시뮬레이션(2026-08-28) ──────────────
#
# 건(件)의 속성이다 — 척도 칸이 아니라. 같은 문구를 「이 시뮬레이션은 어느 칸」이 아니라
# 「이번 건은 이랬다」로 쓴다. 순서는 있고(오른쪽이 앞선 것), 연간 셈은 「k 이상 %」로 낸다.
REVIEW_KINDS = [
    {'key': 'spec', 'label': '설계 스펙 검토', 'item_label': '스펙 항목'},
    {'key': 'cause', 'label': '원인 분석', 'item_label': '불량 유형'},
]
REVIEW_KIND_KEYS = [k['key'] for k in REVIEW_KINDS]
REVIEW_FIELDS = {
    'timing': {'label': '시점', 'options': [
        {'key': 'after_issue', 'label': '문제 발생 후'},
        {'key': 'review_meeting', 'label': '설계 검토 단계'},
        {'key': 'before_spec', 'label': '스펙 확정 전'},
        {'key': 'concept', 'label': '컨셉 단계'},
    ]},
    'decision': {'label': '결정 반영', 'options': [
        {'key': 'reference', 'label': '참고 자료'},
        {'key': 'change_basis', 'label': '설계 변경 근거'},
        {'key': 'gate', 'label': '스펙 확정 관문'},
        {'key': 'rule', 'label': '설계 규칙 정착'},
    ]},
    'basis': {'label': '판정 근거', 'options': [
        {'key': 'trend', 'label': '경향 비교'},
        {'key': 'margin', 'label': '정량 마진 산출'},
        {'key': 'confirmed', 'label': '실측·시험 검증'},
    ]},
}
REVIEW_COLUMNS = [
    {'key': 'month', 'label': '연-월', 'required': True},
    {'key': 'kind', 'label': '종류', 'required': True},
    {'key': 'target', 'label': '대상', 'required': False},
    {'key': 'item', 'label': '항목', 'required': False},
    {'key': 'agent', 'label': '시뮬레이션', 'required': True},
    {'key': 'timing', 'label': '시점', 'required': False},
    {'key': 'decision', 'label': '결정 반영', 'required': False},
    {'key': 'basis', 'label': '판정 근거', 'required': False},
    {'key': 'lead_days', 'label': '리드타임(일)', 'required': False},
    {'key': 'note', 'label': '메모', 'required': False},
]
DEFAULT_REVIEW_PROMOTE_MIN = 3


def get_review_promote_min():
    """정착 후보 문턱 — 같은 시뮬레이션 × 항목이 한 해에 이만큼이면. 설정 review_promote_min."""
    v = _setting('review_promote_min')
    try:
        v = int(v)
    except (TypeError, ValueError):
        return DEFAULT_REVIEW_PROMOTE_MIN
    return v if v >= 1 else DEFAULT_REVIEW_PROMOTE_MIN


def review_definitions():
    # 선택지는 기준 정보를 지나서 나간다 — 설정에서 고친 말이 화면에 그대로 보이도록.
    fields = {name: {**f, 'options': vocab(f'review_{name}')} for name, f in REVIEW_FIELDS.items()}
    return {'kinds': vocab('review_kind'), 'fields': fields, 'columns': REVIEW_COLUMNS,
            'promote_min': get_review_promote_min()}


# ══ 성숙도 측정 체계 (2026-08-31) ═══════════════════════════════════════════
#
# ⚠️ **가상검증률은 여러 시뮬레이션 「정확도」의 평균이다.** 즉 성숙도 지표의 집계값이지
#    별개의 계층이 아니다. 데이터 연결율도 같다. 이 둘을 「역량형 KPI」라는 별도 층으로
#    세우면 없는 계층을 지어내는 것이 된다(2026-08-31 지적).
#
# 이 조사가 하는 일은 하나다 — **역량을 대변하는 지표를 하나에서 여럿으로 늘리고,
# 늘린 지표를 성과형 KPI 에 각각 연결한다.**
#
#     현행   정확도 ──평균──▶ 가상검증률 ──?──▶ 성과형 KPI ──?──▶ 비용
#            (나머지 역량은 어디에도 안 잡힌다)
#
#     조사   정확도    ──▶ 가상검증률
#            자동화    ──▶ 시험 리드타임
#            시험 대체 ──▶ 시험 리드타임 · 개발비용
#            모델링    ──▶ One Time Pass · ASR
#            적용 범위 ──▶ (확산)

# status — 'current' 지금 관리하는 성과 · 'new' 이번에 새로 짚는 성과.
# stage  — 'saving' 덜 쓴다 · 'growth' 더 번다. ⚠️ 성장은 절감보다 **뒤 단계**다 —
#          숫서도에서 더 오른쪽에 선다. 설비 투자 절감은 새 성과지만 쓰는 돈을
#          줄이는 것이라 절감 쪽에 남는다.
#
# ⚠️ 기존 넷은 **전부 「덜 쓴다」**였다. 매출·사업 확대 쪽이 통째로 비어 있었다.
#    새로 셋을 더한다 — 다만 **대응 KPI 가 아직 없다.** 그 사실이 요점이라 화면에서
#    회색으로 두고, 지표에서 성과로 **KPI 를 건너뛰는 점선**으로 그린다.
#        기존 넷  지표 ─▶ KPI ─▶ 성과      (경로 완성)
#        신규 셋  지표 ┄┄┄┄┄┄┄▶ 성과      (KPI 없음 — 먼저 만들어야 한다)
BUSINESS_OUTCOMES = [
    {'key': 'dev_cost', 'label': '개발비용', 'status': 'current',
     'lever': '실물 검증의 해석 대체'},
    {'key': 'dev_time', 'label': '개발시간', 'status': 'current',
     'lever': '검증 기간·대기 단축',
     # ⚠️ 개발시간 단축의 값어치는 **셋으로 갈라진다.** 인건비만 세면 가장 작은 갈래만
     #    보는 셈이다. 셋째 갈래가 사업 확대로 이어지는 고리다.
     'branches': [
         {'label': '인건비 절감', 'to': None,
          'note': '개발 인력 투입 기간 단축 — 세 갈래 중 규모 최소'},
         {'label': '조기 출시 매출', 'to': None,
          'note': '동일 제품의 조기 출시에 따른 매출 선점'},
         {'label': '개발 여력', 'to': 'new_biz',
          'note': '동일 조직의 연간 과제 소화량 증대 — 초과분의 신사업 투입'},
     ]},
    {'key': 'quality_cost', 'label': '품질비용', 'status': 'current',
     'lever': '결함의 선행 단계 제거'},
    {'key': 'mfg_cost', 'label': '제조비용', 'status': 'current',
     'lever': '이상 조기 대응·공정 최적화'},
    # 차례가 곧 순서도의 세로 차례 — 신사업은 「개발 여력」 갈래에 이어지므로 그 높이에, 제품 경쟁력은 그 아래.
    {'key': 'new_biz', 'label': '신사업·서비스 확장', 'status': 'new', 'stage': 'growth',
     'lever': '검증 체계 기반 신규 영역 진입 · 파생·지역 변형의 신속 대응 · '
              'B2B 운영 트윈(예지보전·SLA)'},
    {'key': 'product', 'label': '제품 경쟁력', 'status': 'new', 'stage': 'growth',
     'lever': '설계 마진 축소에 의한 동일 원가 성능 향상 — '
              '발열·강성·에너지 등급·방열 한계가 판매가·점유율을 결정'},
    {'key': 'capex', 'label': '설비 투자 절감', 'status': 'new',
     'lever': '라인 증설 없는 생산량 확보 — 제조비용(OPEX)과 구분되는 회계 항목'},
]

# tier — KPI 의 성격.
#   derived  성숙도 지표의 **집계값**. 별도 계층이 아니라 지표의 다른 표현이다.
#   result   업무 결과. 비용으로 바로 환산된다.
KPI_TIERS = {
    'derived': {'label': '집계 지표', 'sub': '성숙도 지표의 평균',
                'definition': '성숙도 지표의 집계값 — 현행 역량의 사실상 유일한 대변 지표'},
    'result': {'label': '성과형 KPI', 'sub': '업무 결과',
               'definition': '업무 결과 — 비용·시간으로 직접 환산'},
}
# part     어느 띠의 KPI 인가 — 순서도의 개발/제조 토글이 이것으로 거른다. any 는 양쪽.
# managed  현행 관리 KPI 인가 — 순서도에서 가상검증률과 같은 황색. 아니면 새로 제안한 것.
# ⚠️ 이 목록의 **차례가 곧 세로 차례**다 — 경유 KPI 는 제 목적지 바로 앞에 둔다.
KPI_SET = [
    {'key': 'virtual_rate', 'label': '가상검증률', 'domain': '개발', 'tier': 'derived',
     'part': 'dev', 'managed': True,
     'from_axis': '정확도', 'from_sector': 'simulation', 'from_axis_key': 'accuracy',
     'outcomes': ['dev_cost', 'dev_time'],
     'note': '시뮬레이션별 정확도의 평균 — 「정확도」 단일 관점',
     'how': {'dev_cost': '실물 검증 횟수 감소', 'dev_time': '검증 소요 기간 단축'}},
    {'key': 'data_link', 'label': '데이터 연결율', 'domain': '제조', 'tier': 'derived',
     'part': 'mfg', 'managed': True,
     'from_axis': '기본 계측', 'from_sector': 'manufacturing_monitoring',
     'from_axis_key': 'basic_metrics', 'outcomes': ['mfg_cost'],
     'note': '계측 항목 확보 현황의 집계 — 「연결 여부」 단일 관점',
     'how': {'mfg_cost': '원인 규명 소요 시간 단축'}},
    {'key': 'otp', 'label': 'One Time Pass', 'domain': '개발', 'tier': 'result',
     'part': 'dev', 'managed': True,
     'from_axis': None, 'outcomes': ['dev_cost', 'dev_time'],
     'note': '재설계 반복 없는 1회 통과 비율',
     'how': {'dev_cost': '재설계·재시험 비용 미발생', 'dev_time': '설계 반복 기간 단축'}},
    # 시험 대체의 **비용 증거**. 리드타임만으로는 무엇을 아꼈는지가 안 잡힌다.
    {'key': 'sample_cut', 'label': '개발 시료 절감', 'domain': '개발', 'tier': 'result',
     'part': 'dev', 'managed': False,
     'from_axis': None, 'outcomes': ['dev_cost', 'dev_time'],
     'note': '기준 대비 실물 시료 투입량 감축분',
     'how': {'dev_cost': '시료 제작·시험 비용 미발생',
             'dev_time': '시료 제작 대기 기간 단축'}},
    # 마진 축소의 두 갈래 중 **재는 쪽**. 나머지 한 갈래가 제품 경쟁력이다.
    # ⚠️ 재료비는 이 회사에서 개발비용으로 편성된다 — 그래서 별도 성과가 아니다.
    {'key': 'material_cut', 'label': '재료비 절감', 'domain': '개발', 'tier': 'result',
     'part': 'dev', 'managed': False,
     'from_axis': None, 'outcomes': ['dev_cost'],
     'note': '사양 변경에 의한 재료비 절감액 ÷ 기준 재료비',
     'how': {'dev_cost': '사양·재질 등급 하향에 의한 원가 절감'}},
    {'key': 'test_leadtime', 'label': '시험 리드타임', 'domain': '개발', 'tier': 'result',
     'part': 'dev', 'managed': True,
     'from_axis': None, 'outcomes': ['dev_time', 'dev_cost'],
     'note': '개발 일정의 임계 경로',
     'how': {'dev_time': '개발 임계경로 단축', 'dev_cost': '시험 물량·설비 투입 감소'}},
    {'key': 'asr', 'label': 'Annual Service Rate', 'domain': '품질', 'tier': 'result',
     'part': 'any', 'managed': True,
     'from_axis': None, 'outcomes': ['quality_cost'], 'note': '시장 결함 발생률',
     'how': {'quality_cost': '시장 대응 비용 감소'}},
    # 원인 변수를 계측한다고 곧바로 직행률이 오르지 않는다 — **산포를 잡아서** 오른다.
    {'key': 'cpk', 'label': '공정 능력 지수', 'domain': '품질', 'tier': 'result',
     'part': 'mfg', 'managed': False,
     'from_axis': None, 'outcomes': [],
     'note': '규격 대비 공정 산포의 여유도(Cpk)',
     'leads_to': {'fpy': '산포 축소에 의한 직행률 향상'}},
    # ASR 은 **시장** 불량, 이쪽은 **공정 안** 불량이다 — 겹치지 않는다.
    {'key': 'fpy', 'label': '공정 직행률', 'domain': '품질', 'tier': 'result',
     'part': 'mfg', 'managed': False,
     'from_axis': None, 'outcomes': ['quality_cost', 'mfg_cost'],
     'note': '재작업 없는 공정 통과 비율',
     'leads_to': {'output_per_head': '재작업 감소에 의한 순 산출 증대'},
     'how': {'quality_cost': '공정 내 재작업·폐기 비용 감소',
             'mfg_cost': '재작업 공수·라인 부하 감소'}},
    # 제조의 손실은 **고장 빈도 × 복구 시간**으로 갈라 본다. 아래 둘이 그 두 짝이다 —
    # 「유실이 왜 그대로인가」가 빈도 탓인지 복구 탓인지 여기서 갈린다.
    {'key': 'mtbf', 'label': '평균 고장 간격', 'domain': '제조', 'tier': 'result',
     'part': 'mfg', 'managed': False,
     'from_axis': None, 'outcomes': [],
     'note': '고장 간 평균 가동 시간',
     'leads_to': {'line_loss': '고장 빈도 감소에 의한 유실 감소'}},
    {'key': 'mttr', 'label': '평균 복구 시간', 'domain': '제조', 'tier': 'result',
     'part': 'mfg', 'managed': False,
     'from_axis': None, 'outcomes': [],
     'note': '이상 발생부터 정상 복귀까지의 평균 시간',
     # ⚠️ 원가로 직접 환산하지 않는다 — 유실율을 거쳐 간다.
     'leads_to': {'line_loss': '정지 시간 단축에 의한 유실 감소'}},
    {'key': 'line_loss', 'label': '라인 유실율', 'domain': '제조', 'tier': 'result',
     'part': 'mfg', 'managed': True,
     'from_axis': None, 'outcomes': ['mfg_cost'], 'note': '이상에 의한 생산 시간 손실',
     'leads_to': {'output_per_head': '가동 시간 확보에 의한 산출 증대'},
     'how': {'mfg_cost': '설비 정지 손실 감소'}},
    {'key': 'output_per_head', 'label': '인당 생산대수', 'domain': '제조', 'tier': 'result',
     'part': 'mfg', 'managed': True,
     'from_axis': None, 'outcomes': ['mfg_cost'], 'note': '공정 효율의 종합 결과',
     'how': {'mfg_cost': '동일 인원 기준 생산량 증대'}},
]

FOCUS_AREAS = [
    {'key': 'simulation', 'kpi': ['virtual_rate', 'test_leadtime', 'otp'],
     'role': '실물 검증을 해석으로 대체'},
    {'key': 'verification_automation', 'kpi': ['test_leadtime', 'virtual_rate'],
     'role': '검증 절차 자동화'},
    {'key': 'design_automation', 'kpi': ['otp', 'test_leadtime'],
     'role': '설계 반복 자동화'},
    {'key': 'manufacturing_monitoring', 'kpi': ['line_loss', 'data_link', 'asr'],
     'role': '설비·공정 이상 조기 검출'},
    {'key': 'factory_optimization', 'kpi': ['output_per_head', 'line_loss'],
     'role': '공정 조건 최적화'},
    {'key': 'digital_thread', 'kpi': ['data_link', 'otp'],
     'role': '부서·시스템 간 정보 연결'},
]

# 본 조사가 보강하는 공백 — 짧게. 이게 조사의 근거다.
FRAMEWORK_GAPS = [
    {'no': '1', 'title': '단일 지표에 의한 역량 대변',
     'example': '가상검증률 = 시뮬레이션별 「정확도」의 평균',
     'problem': '자동화·대체 범위·재현 범위의 측정 공백 — '
                '「가상검증률 상승에도 시험 리드타임 정체」의 원인 설명 불가.',
     'answer': '역량의 다지표 분해 조사.'},
    {'no': '2', 'title': '분해 지표와 성과 간 연계 부재',
     'example': '역량 지표 1개 : 성과형 KPI 11개',
     'problem': '단일 지표의 다수 KPI 설명 불가 — 인과 관계 미분리.',
     'answer': '지표별 대응 KPI·비용의 확정.'},
]

INDICATOR_ROLES = {
    'prereq': {'label': '선행', 'order': 1, 'definition': '미충족 시 후속 지표의 성과 미연계'},
    'driver': {'label': '동인', 'order': 2, 'definition': '성과의 직접 동인'},
    'multiplier': {'label': '확산', 'order': 3, 'definition': '효과 확산 범위의 결정'},
}

# ── 부문별 지표 ─────────────────────────────────────────────────────────────
# level     유효 수준. 여기를 넘어야 성과로 전환된다.
# change    무엇이 달라지나 (한 줄)
# metric    무엇으로 재나 (아직 대부분 안 잰다)
# kpi       어느 KPI 에 닿나
# ⚠️ 지표 → KPI 연결 기준(2026-09-01 확정) — 이것을 벗어난 선은 긋지 않는다.
#   선행  KPI 에 **직결하지 않는다** — 동인을 통해서만 기여한다(정확도만으로 One Time Pass 가
#         오르지 않는다. 모델링 수준이 서야 오른다). 집계 지표의 원본 축은 그 KPI 와 동일체이므로
#         이름을 병기하는 것으로 충분하다.
#   동인  그 지표가 **한 단계**로 움직이는 KPI — 기여 문구(how)가 기전을 한 구절로 적을 수 있어야 한다.
#         두 단계 건너는 것(예: 자동화 → 제품 경쟁력)은 긋지 않는다.
#   확산  그 부문의 동인들이 미는 KPI 중 **현행 관리 KPI 전부** — 확산이 없으면 전사 수치가
#         안 움직인다는 것이 확산의 정의이므로, 전사 집계되는 KPI 에만 건다.
# needs         **다른 부문**의 선행 지표 — (부문 키, 축 키, 어떻게). 같은 부문 안은 deps.
# fed_by        이 지표의 **입력**이 되는 업무 요소 — 작용(acts_on)의 역방향. 디지털 트윈 외 영역에서
#               받는 것이다(정확도 ← 시험·검증의 실측). 없으면 시뮬레이션이 허공에서 서는 것처럼 보인다.
# acts_on       이 지표가 **어느 업무 요소**를 바꾸나 — VALUE_CHAIN 의 요소 키.
#               ⚠️ 이것이 「디지털 트윈의 역할」이다. 없으면 지표가 허공에서 KPI 로 간다.
# deps          이 지표가 서려면 **먼저 서야 하는 축** — 같은 부문 안의 축 키.
#               ⚠️ 순서도의 가로 자리를 이것이 정한다. 선행이 없는 축이 맨 왼쪽이다.
# outcomes      어느 비용에 닿나(기존 성과) — 그 지표의 KPI 를 거쳐 간다
# new_outcomes  새로 짚는 성과 — **대응 KPI 가 아직 없어** 지표에서 바로 간다
# why       왜 이 지표를 조사하나 (한 줄)
# gate_why  왜 그 수준이 유효 수준인가 (한 줄)
MEASUREMENT_FRAMEWORK = {
    'simulation': {
        'purpose': '실물 검증의 해석 대체를 통한 개발비용·개발시간 절감',
        'indicators': [
            {'axis': 'accuracy', 'role': 'prereq', 'level': 'quantitative',
             'fed_by': [('test', '실측 대조에 의한 정확도 확정')],
             'acts_on': [('design', '설계 판정 근거 제공')],
             'change': '시험 없는 스펙 판정',
             'metric': ['예측 오차', '적중률'], 'deps': [],
             'kpi': [], 'outcomes': [],
             'why': '전사 가상검증률의 원천 축 — 나머지 네 축은 현행 체계에 미반영',
             'gate_why': '경향 일치 수준은 방향 확인까지 — 판정 근거로서 우열을 가르는 정량 마진 필요'},
            {'axis': 'automation', 'role': 'driver', 'level': 'pipeline',
             'acts_on': [('test', '검증 회전 속도 향상')],
             'change': '무인 연속 해석 실행',
             'metric': ['1회 소요 시간', '월 해석 건수'],
             'deps': [('accuracy', '신뢰 가능한 해석 결과 확보')],
             'kpi': [('test_leadtime', '해석 대기 시간 제거')],
             'outcomes': [('dev_time', '검증 대기 시간 단축')],
             'why': '동일 가상검증률에서의 시험 리드타임 차이 원인(자동화 수준) 규명',
             'gate_why': '단계별 자동화는 단계 간 대기 잔존 — 파이프라인 수준에서 완주'},
            {'axis': 'substitution', 'role': 'driver', 'level': 'cert_gate',
             'fed_by': [('cert_rule', '해석 결과의 인증 근거 인정')],
             'needs': [('digital_thread', 'usage', '취약 시험의 대체 우선순위 선정')],
             'acts_on': [('test', '실물 시험의 해석 대체'), ('prototype', '시료 제작 물량 축소')],
             'change': '개발 일정상 시험 공정 제외',
             'metric': ['대체 시험 건수', '단축일', '회피 시험비'],
             'deps': [('accuracy', '판정 근거로서의 정량 마진 확보'),
                      ('automation', '시험 대체 소요 물량 확보')],
             'kpi': [('test_leadtime', '시험 일정 자체 제거'),
                     ('sample_cut', '실물 시료 제작 물량 축소')],
             'outcomes': [('dev_cost', '시제품·시험 비용 미발생'),
                          ('dev_time', '시험 기간 일정 제외')],
             'why': '동일 가상검증률에서의 비용 차이 원인(대체 대상) 규명',
             'gate_why': '사전 검증 수준까지는 시험 병행 — 일정·비용 미절감'},
            {'axis': 'modeling', 'role': 'driver', 'level': 'test_all',
             'fed_by': [('quality', '시장·공정 불량 정보의 재현 대상화')],
             'needs': [('design_automation', 'part_lib', '검증된 부품 해석 모델 재사용')],
             'acts_on': [('design', '설계 마진의 정량 결정'), ('ve_common', '검증된 마진 축소분의 VE 반영')],
             'change': '양산 결함의 설계 단계 사전 검출',
             'metric': ['ECO 건수', '시장 불량률'],
             'deps': [('accuracy', '현상 재현의 물리적 타당성 확보')],
             'kpi': [('otp', '양산 결함의 선행 제거'),
                     ('asr', '시장 유출 결함 사전 차단'),
                     ('material_cut', '검증된 마진 축소분의 사양 반영')],
             'outcomes': [('quality_cost', '양산·시장 대응 비용 미발생'),
                          ('dev_cost', '재료 사양 하향에 의한 원가 절감')],
             # ⚠️ 제품 경쟁력은 **여기 하나**에만 건다. 재현 범위가 넓어야 마진을 줄인다 —
             #    자동화·적용 범위는 빨리·널리 돌리는 것이지 성능을 올리는 것이 아니다.
             'new_outcomes': [('product', '설계 안전 마진 축소에 의한 성능 향상')],
             'why': 'One Time Pass·ASR 정체 원인(재현 범위) 규명',
             'gate_why': '부분 재현 시 잔여 항목의 시험 존치'},
            {'axis': 'scope', 'role': 'multiplier', 'level': 'derived_some',
             'acts_on': [('design', '전 과제 표준 절차 적용')],
             'change': '전사 표준 절차화',
             'metric': ['적용 과제 비율'],
             'deps': [('modeling', '전개 가능한 표준 해석 모델 확보'),
                      ('automation', '전사 전개를 위한 처리 능력 확보')],
             'kpi': [('test_leadtime', '전사 단위 리드타임 단축'),
                     ('otp', '전사 단위 통과율 개선'),
                     ('asr', '전 과제 적용 시 시장 결함 감소')],
             'outcomes': [],
             'why': '전사 가상검증률의 특정 과제 편중 여부 확인',
             'gate_why': '대표 모델 수준까지는 개인 역량 의존'},
        ],
    },
    'digital_thread': {
        'purpose': '의사결정 자료의 무인·적시 전달',
        'indicators': [
            {'axis': 'quality', 'role': 'prereq', 'level': 'master',
             'acts_on': [('design', '설계 데이터의 신뢰 기반')],
             'change': '검증 절차 없는 데이터 직접 활용',
             'metric': ['재작업 건수'], 'deps': [],
             'kpi': [], 'outcomes': [],
             'why': '데이터 신뢰성의 측정 공백 — 연결 여부만 집계, 신뢰 여부는 미집계',
             'gate_why': '매핑표 오류의 비가시성'},
            {'axis': 'capture', 'role': 'driver', 'level': 'direct',
             'acts_on': [('transfer', '설계·제조 자료의 자동 취합'),
                         ('test', '시험별 소요 기간의 자동 집계')],
             'change': '취합 인력 미투입',
             'metric': ['자료 준비 공수'],
             'deps': [('quality', '신뢰 가능한 원천 데이터 확보')],
             'kpi': [('test_leadtime', '자료 준비 소요일 단축')],
             'outcomes': [('dev_cost', '자료 취합 인력 미투입')],
             'why': '데이터 확보 간접 공수 규모의 산정',
             'gate_why': '취합 방식의 담당자 의존 — 부재 시 중단'},
            {'axis': 'link_mode', 'role': 'driver', 'level': 'integrated',
             'acts_on': [('transfer', '구간 간 자료 전달 자동화'), ('quality', '불량 정보의 설계 되먹임')],
             'change': '대기 없는 구간 간 전달',
             'metric': ['전달 소요일'],
             'deps': [('capture', '연계 대상 원천 데이터 확보')],
             'kpi': [('test_leadtime', '구간 간 전달 대기 제거'),
                     ('asr', '불량 정보의 설계 되먹임'),
                     # 품질·표준(선행)이 들고 있던 E-BOM·M-BOM 정합 — 실제로 그것을 **넘기는** 것은
                     # 연결이다. 선행은 KPI 에 직결하지 않으므로 동인인 여기로 옮긴다.
                     ('fpy', 'E-BOM·M-BOM 정합 이관에 의한 불량 차단')],
             'outcomes': [('dev_time', '전달 대기 일정 제외'),
                          ('quality_cost', '반복 결함 차단에 의한 대응 비용 감소')],
             'why': '구간별 전달 대기의 개발 일정 영향 규명',
             'gate_why': '자동 전달은 송신 측만 자동'},
            {'axis': 'usage', 'role': 'driver', 'level': 'decision',
             'acts_on': [('design', '자료 기반 설계 결정'), ('production', '자료 기반 생산 결정'),
                         # 시험별 소요 기간이 잡히면 **취약 시험**이 드러난다 — 순서·병행 조정과
                         # 설비·인력 보강 판단의 근거. 스레드가 시험 리드타임에 닿는 길이다.
                         ('test', '취약 시험 식별에 의한 순서·병행 조정'),
                         ('test_infra', '취약 시험 기준 설비·인력 보강 판단')],
             'change': '해당 자료 기반 의사결정',
             'metric': ['데이터 기반 결정 건수'],
             'deps': [('quality', '의사결정 근거로서의 자료 신뢰성'),
                      ('link_mode', '적시 자료 도달 보장')],
             'kpi': [('otp', '근거 기반 결정에 따른 재결정 감소'),
                     ('test_leadtime', '취약 시험의 병목 해소')],
             'outcomes': [('dev_time', '설계 반복 횟수 감소')],
             'why': '미활용 연결의 성과 부재 확인',
             'gate_why': '참고·검토 수준은 단절 시에도 업무 지속 — 성과 기여 없음'},
        ],
    },
    'manufacturing_monitoring': {
        'purpose': '이상의 선행 검출과 조치 연계',
        'indicators': [
            {'axis': 'reliability', 'role': 'prereq', 'level': 'high',
             'acts_on': [('production', '판정 결과의 현장 수용')],
             'change': '판정 결과에 대한 현장 신뢰 확보',
             'metric': ['오검출률', '알람 조치율'],
             'deps': [('basic_metrics', '판정 근거 계측 항목 확보')],
             'kpi': [], 'outcomes': [],
             'why': '판정 신뢰도 부족 시 알람 차단에 의한 후속 지표 무효화 방지',
             'gate_why': '오검출 반복 시 판정 자체의 미사용'},
            {'axis': 'basic_metrics', 'role': 'driver', 'level': 'process_var',
             'acts_on': [('production', '원인 변수의 상시 계측')],
             'change': '결과가 아닌 원인 변수 계측',
             'metric': ['원인 규명 시간'],
             'deps': [('collection', '실시간 수집 체계 확보')],
             'kpi': [('cpk', '원인 변수 산포의 관리 가능화')],
             'outcomes': [('mfg_cost', '원인 규명 소요 시간 감소'),
                          ('quality_cost', '공정 내 재작업 비용 감소')],
             'why': '전사 데이터 연결율의 원천 축 — 사후 확인과 사전 예측의 경계',
             'gate_why': '상태·불량 계측은 발생 확인 수준에 한정'},
            {'axis': 'judgement', 'role': 'driver', 'level': 'diagnose',
             'acts_on': [('maintenance', '고장의 사전 예측'), ('production', '이상의 자동 판정')],
             'change': '시스템에 의한 자동 판정',
             'metric': ['검출 시간'],
             'deps': [('basic_metrics', '진단 필요 원인 변수 확보'),
                      ('reliability', '현장 수용 가능한 판정 신뢰도')],
             'kpi': [('mtbf', '사전 예측에 의한 고장 예방')],
             'outcomes': [('mfg_cost', '설비 정지 시간 감소')],
             # ⚠️ 신사업은 **여기 하나**에만 건다. 설비를 진단하는 능력 자체가 상품이다.
             'new_outcomes': [('new_biz', '설비 진단 역량의 예지보전 상품화')],
             'why': '검출 지연 시간과 유실 시간의 일치 확인',
             'gate_why': '이상 판정은 사실 통보까지 — 원인 규명은 사람 의존'},
            {'axis': 'response', 'role': 'driver', 'level': 'standard',
             'acts_on': [('maintenance', '통보의 조치 연계')],
             'change': '통보의 조치 연계',
             'metric': ['조치 소요 시간', '미조치율'],
             'deps': [('judgement', '조치 대상 판정 결과 확보')],
             'kpi': [('mttr', '통보·조치 사슬 단축'),
                     ('asr', '불량 유출 사전 차단')],
             'outcomes': [('mfg_cost', '복구 지연 유실 감소'),
                          ('quality_cost', '불량 유출 대응 비용 미발생')],
             'why': '검출 체계 구축 후 유실율 미개선 원인 규명',
             'gate_why': '담당·조치 미지정 통보의 무시'},
            {'axis': 'collection', 'role': 'driver', 'level': 'periodic',
             'acts_on': [('production', '설비 데이터 무인 수집')],
             'change': '무인 자동 수집',
             'metric': ['수집 지연'], 'deps': [],
             'kpi': [('line_loss', '검출 지연 하한 단축')],
             'outcomes': [('mfg_cost', '인지 지연에 따른 유실 감소')],
             'why': '수집 주기에 의한 검출 지연 하한 확인',
             'gate_why': '수기 방식은 취합 주기가 곧 지연'},
            {'axis': 'scope', 'role': 'multiplier', 'level': 'all_equip',
             'acts_on': [('production', '전 설비 적용')],
             'change': '전 설비 기본 사양화',
             'metric': ['적용 설비 비율'],
             'deps': [('judgement', '전 설비 확대 대상 판정 체계')],
             'kpi': [('line_loss', '공정 전체 단위 유실 개선'),
                     ('asr', '전 설비 유출 차단 적용')],
             'outcomes': [],
             # 설비 투자 절감은 공장 최적화의 「검증 대체」로 옮겼다(2026-09-02) — 검증된 증설
             # 회피가 곧 그것이고, 성과 후보는 지표 하나에서만 온다.
             'why': '시범 설비 한정 적용 시 공정 전체 지표 미개선 확인',
             'gate_why': '시범은 표본 — 공정 전체가 아님'},
        ],
    },
    'factory_optimization': {
        'purpose': '라인·물류·설비의 사전 검증에 의한 동일 설비 생산량 증대',
        'indicators': [
            {'axis': 'fidelity', 'role': 'prereq', 'level': 'ranking',
             'fed_by': [('production', '실적 택트·가동률 데이터의 대조')],
             'acts_on': [('line_build', '배치·계획 대안의 판정 근거')],
             'change': '실측 대비 검증된 모델에 의한 대안 판정',
             'metric': ['대조 기준 대비 오차', '검증 대안 수'], 'deps': [],
             'kpi': [], 'outcomes': [],
             'why': '충실도 미확보 모델의 결정 근거 불가 — 나머지 축의 전제',
             'gate_why': '경향 일치 수준은 방향 확인까지 — 대안 간 우열을 가르는 정량 마진 필요'},
            {'axis': 'data_link', 'role': 'driver', 'level': 'actuals',
             'acts_on': [('production', '실적 데이터 기반 운영 트윈')],
             'change': '실적 데이터의 자동 반영에 의한 상시 검증',
             'metric': ['입력 자동화 항목 수', '모델 갱신 주기'],
             'deps': [('fidelity', '검증된 모델 확보')],
             'kpi': [('line_loss', '계획·보전 주기의 상시 최적화')],
             'outcomes': [('mfg_cost', '계획 이탈에 의한 손실 감소')],
             'why': '수동 입력 모델의 일회성 — 운영 중 재검증 불가',
             'gate_why': '레이아웃 반영까지는 설계 시점 검증 — 실적 입력 후 운영 단계 활용 가능'},
            {'axis': 'modeling', 'role': 'driver', 'level': 'actors',
             'acts_on': [('line_build', '배치·물류의 모델 검증'), ('pilot', '조립성·작업성의 가상 검증')],
             'change': '작업자·로봇·물류를 포함한 사전 검증',
             'metric': ['모델 구성 요소 수', '가상 검증 항목 수'],
             'deps': [('fidelity', '요소별 거동의 실측 대조')],
             'kpi': [('output_per_head', '병목·배치의 사전 해소'),
                     ('fpy', '조립성 결함의 양산 전 제거')],
             'outcomes': [('mfg_cost', '동일 인원 기준 산출 증대'),
                          ('quality_cost', '양산 초기 불량 대응 비용 미발생')],
             'why': '정적 배치만으로는 병목·작업성이 안 보임',
             'gate_why': '동적 흐름까지는 설비 중심 — 작업자·로봇 포함 시 시생산 대체 가능'},
            {'axis': 'substitution', 'role': 'driver', 'level': 'approval_gate',
             'fed_by': [('invest_rule', '시뮬레이션 결과의 승인 근거 인정')],
             'needs': [('digital_thread', 'usage', '자료 기반 결정 체계')],
             'acts_on': [('line_build', '실물 파일럿 없는 배치 확정'), ('pilot', '실물 시생산 회차 축소')],
             'change': '시뮬레이션 결과에 의한 투자·배치 결정',
             'metric': ['대체한 결정 건수', '회피한 실물 검증 회차'],
             'deps': [('fidelity', '판정 근거로서의 정량 마진'), ('modeling', '결정 대상 요소의 모델 포함')],
             'kpi': [('output_per_head', '실물 시행착오 없는 배치 확정')],
             'outcomes': [('mfg_cost', '시행착오 재배치 비용 미발생')],
             # ⚠️ 설비 투자 절감은 **여기 하나**에만 건다 — 검증된 증설 회피가 곧 그것이다.
             'new_outcomes': [('capex', '검증에 의한 증설 회피')],
             'why': '검증 결과의 결정 미반영 — 참고 자료에 그침',
             'gate_why': '사전 검증까지는 확정 전 1회 검토 — 승인 근거 인정 시 결정 대체'},
            {'axis': 'scope', 'role': 'multiplier', 'level': 'new_lines',
             'acts_on': [('production', '전 라인 표준 운영 방식화')],
             'change': '전 법인·라인의 표준 절차화',
             'metric': ['적용 라인 비율'],
             'deps': [('substitution', '결정 대체 체계 확보'), ('data_link', '연동 체계 확보')],
             'kpi': [('line_loss', '공정 전체 단위 유실 개선'),
                     ('output_per_head', '전 라인 산출 증대')],
             'outcomes': [],
             'why': '시범 라인 한정 적용 시 법인 단위 지표 미개선',
             'gate_why': '대표 라인까지는 개별 성과 — 신규 라인 전부 적용이 곧 표준화'},
        ],
    },
}

FRAMEWORK_CAVEATS = [
    '본 자료는 **측정 체계** — 성과 실적이 아님. 실제 수준은 「성숙도」 탭 참조.',
    '가상검증률·데이터 연결율은 「정확도」·「기본 계측」의 **집계값** — '
    '별도 지표가 아닌 해당 축의 다른 명칭.',
    '「측정 지표」 대부분은 **집계 체계 미구축** — 다음 단계에서 확보.',
    '제품 경쟁력·신사업·설비 투자 절감은 **대응 KPI 미정의** — '
    '지표에서 성과로의 직결은 측정이 아닌 가설.',
    '검증·설계·공장 최적화는 **초안** — 성숙도 축·수준이 기준 정보에 미등록. '
    '순서도에서 끊긴 테두리·점점선으로 표시.',
    '업무 단계·기반 요소는 **디지털 트윈 외 영역** — 성숙도 평가 대상이 아니며, '
    '디지털 트윈과 무관하게 KPI 에 기여하는 경로.',
    '평균 복구 시간·평균 고장 간격·공정 능력 지수는 **경유 KPI** — '
    '성과에 직결하지 않음(동일 절감의 이중 계상 방지).',
    '재료비는 **개발비용에 편성** — 별도 성과가 아닌 개발비용의 구성 항목.',
    '지표 → KPI 연결 기준 — 선행: KPI 직결 없음(동인을 통해 기여) · 동인: 한 단계로 움직이는 KPI '
    '· 확산: 부문 동인이 미는 현행 관리 KPI 전부. 두 단계 건너는 연결은 배제.',
    '시뮬레이션은 **밖에서 받는 입력**이 있음 — 정확도는 시험·검증의 실측 대조, 모델링 수준은 '
    '품질 관리의 불량 정보, 시험 대체는 검증 규정(해석의 인증 근거 인정). 회색 실선으로 표시.',
]


def _how(x):
    """'키' 또는 ('키', '어떻게 기여하나'). 설명 없이 선만 그릴 수도 있게 둔다."""
    return x if isinstance(x, tuple) else (x, None)


def measurement_framework(sector_key):
    """부문의 측정 체계 — 축·수준·KPI 명칭을 결합해 반환한다.

    ⚠️ 명칭을 화면에서 다시 찾지 않도록 여기서 붙인다. 기준 정보에서 축 이름을 고치면
       개요의 표기도 같이 바뀌어야 하며, 두 벌로 두면 언젠가 어긋난다.
    """
    conf = MEASUREMENT_FRAMEWORK.get(sector_key)
    if not conf:
        return None
    axes = {a['key']: a for a in get_axes(sector_key)}
    elems = _element_index()
    outs = {o['key']: o for o in BUSINESS_OUTCOMES}
    kpis = {k['key']: k for k in KPI_SET}
    rows = []
    for it in conf['indicators']:
        axis = axes.get(it['axis'])
        if axis is None:
            continue                     # 부문에서 뺀 축은 체계에서도 뺀다
        rungs = axis.get('rungs') or []
        li = next((i for i, r in enumerate(rungs) if r['key'] == it['level']), None)
        rows.append({
            'axis': it['axis'], 'axis_label': axis['label'],
            # 이 축이 집계 지표의 **원본**이면 그 이름을 병기한다 —
            # 「정확도 (가상검증률)」처럼. 원본이 아닌 축에는 안 붙인다.
            'derived_label': next((k['label'] for k in KPI_SET
                                   if k.get('from_axis_key') == it['axis']
                                   and k.get('from_sector') == sector_key), None),
            'role': it['role'], 'role_label': INDICATOR_ROLES[it['role']]['label'],
            'levels': [{'key': r['key'], 'label': r['label']} for r in rungs],
            'level_index': li,
            'level_label': rungs[li]['label'] if li is not None else None,
            'change': it['change'], 'metric': it['metric'],
            # 어느 업무 요소에 작용하나 — 디지털 트윈의 **역할**. 순서도가 위·아래 띠로 잇는다.
            'acts_on': [{'key': e, 'band': elems[e][0], 'label': elems[e][1], 'how': h}
                        for e, h in map(_how, it.get('acts_on', []))],
            # 선행 축 — 순서도가 지표끼리 잇는 데 쓴다. 부문에서 뺀 축은 걸러진다.
            'deps': [{'key': d, 'label': axes[d]['label'], 'how': h}
                     for d, h in map(_how, it.get('deps', [])) if d in axes],
            'needs': _needs(it), 'fed_by': _fed_by(it, elems),
            'why': it['why'], 'gate_why': it['gate_why'],
            'kpi': [{'key': k, 'label': kpis[k]['label'], 'tier': kpis[k]['tier'], 'how': h}
                    for k, h in map(_how, it['kpi'])],
            'outcomes': [{'key': o, 'label': outs[o]['label'], 'how': h}
                         for o, h in map(_how, it['outcomes'])],
            # 신규 성과 — KPI 를 거치지 않는다. 화면이 점선으로 그린다.
            'new_outcomes': [{'key': o, 'label': outs[o]['label'], 'how': h}
                             for o, h in map(_how, it.get('new_outcomes', []))],
        })
    return {
        'sector': sector_key, 'purpose': conf['purpose'], 'indicators': rows,
        'outcomes': BUSINESS_OUTCOMES, 'kpis': KPI_SET, 'kpi_tiers': KPI_TIERS,
        'gaps': FRAMEWORK_GAPS, 'roles': INDICATOR_ROLES, 'caveats': FRAMEWORK_CAVEATS,
    }


# 아직 안 연 중점 분야의 성숙도 지표 **초안**(2026-09-01).
#
# ⚠️ MEASUREMENT_FRAMEWORK 와 형태는 같지만 **수준 사다리(level)가 없다.** 축이
#    기준 정보에 아직 없기 때문이다 — 있는 척하면 「정의된 것」과 「제안하는 것」이
#    섞인다. 화면은 이것을 끊긴 테두리와 점점선으로 그린다.
PROPOSED_FRAMEWORK = {
    'verification_automation': {
        'label': '검증',
        'purpose': '설계 룰 자동 검증에 의한 도면 검토 전 결함 제거',
        'indicators': [
            {'axis': 'rule_tool', 'axis_label': '설계 룰 검증 툴', 'role': 'prereq',
             'needs': [('simulation', 'modeling', '해석 확정 마진의 룰 자산화')],
             'acts_on': [('design', '설계 룰의 자산화')],
             'change': '설계 룰의 기계 판독 가능화',
             'metric': ['자산화 룰 건수'], 'deps': [],
             'kpi': [], 'outcomes': [],
             'why': '툴 부재 시 룰 확인의 육안 의존'},
            {'axis': 'mech_rule', 'axis_label': '기구 룰 검증', 'role': 'driver',
             'acts_on': [('design', '기구 도면 자동 검토')],
             'change': '치수·형상·조립성의 자동 판정',
             'metric': ['간섭·공차 위반 검출 건수'],
             'deps': [('rule_tool', '기구 룰의 자산화')],
             'kpi': [('otp', '조립 간섭·치수 오류의 선행 제거'),
                     ('sample_cut', '간섭 확인용 시작품 재제작 회피')],
             'outcomes': [('dev_cost', '시작품 단계 재작업 미발생')],
             'why': '조립 간섭의 시작품 단계 후행 발견'},
            {'axis': 'circuit_rule', 'axis_label': '회로 룰 검증', 'role': 'driver',
             'acts_on': [('design', '회로 도면 자동 검토')],
             'change': '부품 용량·배선 간격의 자동 판정',
             'metric': ['룰 위반 검출 건수'],
             'deps': [('rule_tool', '회로 룰의 자산화')],
             'kpi': [('otp', '용량·간격 위반의 선행 제거'),
                     ('sample_cut', '기판 재제작 회피')],
             'outcomes': [('dev_cost', '기판 재제작 비용 미발생')],
             'why': '기판 오류 시 전량 재제작 비용 발생'},
            {'axis': 'scope', 'axis_label': '적용 범위', 'role': 'multiplier',
             'acts_on': [('design', '전 과제 자동 검토 적용')],
             'change': '전 과제의 표준 검증 절차화',
             'metric': ['자동 검증 적용 과제 비율'],
             'deps': [('mech_rule', '기구 룰 체계 확보'),
                      ('circuit_rule', '회로 룰 체계 확보')],
             'kpi': [('otp', '전사 단위 통과율 개선')], 'outcomes': [],
             'why': '일부 과제 적용 시 전사 지표 미개선'},
        ],
    },
    'design_automation': {
        'label': '설계',
        'purpose': '표준 부품 조합 기반 설계 초안 자동 생성 — 반복 설계 제거',
        'indicators': [
            {'axis': 'part_lib', 'axis_label': '표준·공용 부품 라이브러리', 'role': 'prereq',
             # ⚠️ 「부품 공용화」를 축에서 뺐다(2026-09-01) — 공용 부품을 **채택하는** 것은 설계
             #    정책·조직의 결정이지 디지털 트윈이 아니다. 라이브러리는 후보를 대는 데까지.
             'acts_on': [('design', '표준 부품 자산 제공'),
                         ('ve_common', '공용 후보 부품의 식별·제안')],
             'change': '검증된 부품의 자산 등록',
             'metric': ['등록 부품 수', '적용 가능 사양 범위'], 'deps': [],
             'kpi': [], 'outcomes': [],
             'why': '조합 대상 부품 부재 시 초안 생성 불가'},
            {'axis': 'draft_gen', 'axis_label': '설계 Draft 자동 생성', 'role': 'driver',
             'acts_on': [('req', '사양 정의 시 초안 자동 도출'), ('design', '설계 초안 자동 생성')],
             'change': '제품 사양 정의 시 초안 자동 도출',
             'metric': ['초안 작성 소요 시간', '자동 생성 비율'],
             'deps': [('part_lib', '조합 대상 부품 자산 확보')],
             'kpi': [('otp', '초안 단계 기준 오류 제거')],
             'outcomes': [('dev_time', '초안 작성 기간 단축')],
             'why': '백지 설계 반복에 의한 동일 오류 재발'},
            {'axis': 'scope', 'axis_label': '적용 범위', 'role': 'multiplier',
             'acts_on': [('design', '전 과제 자동 설계 적용')],
             'change': '전 과제의 표준 설계 절차화',
             'metric': ['적용 과제 비율'],
             'deps': [('draft_gen', '초안 생성 체계 확보')],
             'kpi': [('otp', '전사 단위 통과율 개선')], 'outcomes': [],
             'why': '일부 과제 적용 시 전사 통과율 미개선'},
        ],
    },
}
# 개발·제조의 **핵심 업무 요소** — 디지털 트윈 **밖**이다(2026-09-01).
#
# ⚠️ 디지털 트윈 지표는 이 요소들에 **작용**해서 KPI 를 움직인다(acts_on). 그리고 이
#    요소들은 디지털 트윈 없이도 KPI 를 움직인다 — 시험 설비를 늘려도 리드타임은 준다.
#    그 두 가지가 같이 보여야 「디지털 트윈의 몫이 어디까지인가」가 읽힌다.
#
# kind   step  업무 단계 — 차례가 있다(next)
#        lever 기반 요소 — 단계가 아니라 자원·조직. 디지털 트윈이 대신할 수 없는 몫.
# kpi    이 요소 **자체**가 움직이는 KPI 와 어떻게. 디지털 트윈과 무관한 경로다.
VALUE_CHAIN = {
    'development': {
        'label': '개발 부문',
        'elements': [
            {'key': 'req', 'label': '요구·사양 정의', 'kind': 'step', 'next': 'design',
             'note': '제품 요구와 목표 사양의 확정',
             'kpi': [('otp', '요구 확정도에 따른 재설계 발생')]},
            {'key': 'design', 'label': '설계', 'kind': 'step', 'next': 'prototype',
             'note': '기구·회로·SW 설계와 도면 확정',
             'kpi': [('otp', '설계 완성도에 따른 통과 여부'),
                     ('material_cut', '사양 결정에 의한 재료비 확정')]},
            {'key': 'prototype', 'label': '시작품 제작', 'kind': 'step', 'next': 'test',
             'note': '실물 시료의 제작·투입',
             'kpi': [('sample_cut', '시료 제작 물량의 결정')]},
            {'key': 'test', 'label': '시험·검증', 'kind': 'step', 'next': 'transfer',
             'note': '신뢰성·성능 시험과 합부 판정',
             'kpi': [('test_leadtime', '시험 실행 기간의 확정')]},
            {'key': 'transfer', 'label': '양산 이관', 'kind': 'step', 'next': None,
             'note': '설계·공정 조건의 제조 인계',
             'kpi': [('fpy', '이관 조건 완성도에 따른 초기 불량')]},
            {'key': 'test_infra', 'label': '시험 설비·인력', 'kind': 'lever',
             'note': '시험 설비 용량과 숙련 인력',
             'kpi': [('test_leadtime', '시험 착수 대기의 해소')]},
            {'key': 'design_org', 'label': '설계 프로세스·조직', 'kind': 'lever',
             'note': '요구 관리·설계 기준·검토 체계',
             'kpi': [('otp', '요구 변경에 의한 재설계 억제')]},
            # ⚠️ VE·부품 공용화는 디지털 트윈이 아니라 **개발의 활동**이다(2026-09-01). 축에서 빼고
            #    여기 세운다 — 디지털 트윈은 여기에 후보(공용 부품)와 근거(검증된 마진)를 댄다.
            {'key': 've_common', 'label': 'VE·부품 공용화', 'kind': 'lever',
             'note': '원가 절감 설계(VE)와 기종 간 공용 부품 채택',
             'kpi': [('material_cut', '사양·부품 최적화에 의한 원가 절감')]},
            {'key': 'sourcing', 'label': '부품 구매·소싱', 'kind': 'lever',
             'note': '부품 단가 협상과 공급처 운영',
             'kpi': [('material_cut', '구매 단가 협상에 의한 절감')]},
            # ⚠️ 시험 대체의 「신뢰성 인증 게이트」는 해석 결과를 인증 근거로 **인정하는 규정**이
            #    있어야 성립한다 — 기술이 아니라 규정의 문제. 디지털 트윈이 만들 수 없는 몫이다.
            {'key': 'cert_rule', 'label': '검증 규정·인증 기준', 'kind': 'lever',
             'note': '해석 결과의 인증 근거 인정 절차',
             'kpi': [('test_leadtime', '시험 면제 승인 절차 확보')]},
        ],
    },
    'manufacturing': {
        'label': '제조 부문',
        'elements': [
            {'key': 'line_build', 'label': '설비 투자·라인 구축', 'kind': 'step', 'next': 'pilot',
             'note': '설비 도입과 라인 설치',
             'kpi': [('output_per_head', '생산 능력 자체의 확보'),
                     ('mtbf', '설비 사양 자체의 신뢰성')]},
            {'key': 'pilot', 'label': '시생산', 'kind': 'step', 'next': 'production',
             'note': '양산 전 생산성·조립성 확인',
             'kpi': [('fpy', '양산 전 조립 결함 제거')]},
            {'key': 'production', 'label': '양산', 'kind': 'step', 'next': 'maintenance',
             'note': '계획에 따른 생산 운영',
             'kpi': [('line_loss', '운영 중 정지·손실 발생'),
                     ('output_per_head', '실 산출량의 확정'),
                     ('cpk', '공정 조건의 관리 상태')]},
            {'key': 'maintenance', 'label': '설비 보전', 'kind': 'step', 'next': 'quality',
             'note': '예방·사후 보전과 복구',
             'kpi': [('mtbf', '보전 주기에 따른 고장 빈도'),
                     ('mttr', '복구 체계에 따른 정지 시간')]},
            {'key': 'quality', 'label': '품질 관리·검사', 'kind': 'step', 'next': None,
             'note': '공정·출하 검사와 시장 품질 대응',
             'kpi': [('asr', '출하 검사에 의한 유출 차단')]},
            # ⚠️ 검증 대체의 「승인 게이트」는 시뮬레이션 결과를 투자·배치 승인 근거로 **인정하는
            #    기준**이 있어야 성립한다 — 개발 쪽 검증 규정의 짝. 디지털 트윈이 만들 수 없는 몫.
            {'key': 'invest_rule', 'label': '투자 심의 기준', 'kind': 'lever',
             'note': '설비 투자·라인 변경의 승인 절차와 근거 요건',
             'kpi': [('output_per_head', '검증 기반 투자 승인 절차 확보')]},
            {'key': 'capex_people', 'label': '설비 투자·인력 운영', 'kind': 'lever',
             'note': '설비 투자 집행과 인원 편성',
             'kpi': [('output_per_head', '설비·인원 자체의 확보')]},
            {'key': 'workforce', 'label': '작업자 숙련', 'kind': 'lever',
             'note': '작업자 교육과 다능화',
             'kpi': [('mttr', '숙련도에 따른 복구 속도'),
                     ('output_per_head', '작업 속도·품질의 확보')]},
            {'key': 'material_supply', 'label': '자재 공급', 'kind': 'lever',
             'note': '자재 결품·납기 관리',
             'kpi': [('line_loss', '자재 결품에 의한 정지')]},
        ],
    },
}


# 부문이 어느 쪽에 붙나 — 숫서도의 토글(개발/제조/연계)이 쓴다. 스레드는 둘을 **잇는다**.
SECTOR_PART = {
    'design_automation': 'dev', 'verification_automation': 'dev', 'simulation': 'dev',
    'digital_thread': 'link',
    'factory_optimization': 'mfg', 'manufacturing_monitoring': 'mfg',
}


def value_chain():
    """업무 요소 — 순서도의 위·아래 띠. KPI 명칭을 붙여 돌려준다."""
    kpis = {k['key']: k for k in KPI_SET}
    out = {}
    for band, conf in VALUE_CHAIN.items():
        out[band] = {'label': conf['label'], 'elements': [{
            'key': e['key'], 'label': e['label'], 'kind': e['kind'], 'note': e['note'],
            'next': e.get('next'),
            'kpi': [{'key': k, 'label': kpis[k]['label'], 'how': h}
                    for k, h in map(_how, e['kpi'])],
        } for e in conf['elements']]}
    return out


def _element_index():
    return {e['key']: (band, e['label'])
            for band, conf in VALUE_CHAIN.items() for e in conf['elements']}


def _axis_label(sector_key, axis_key):
    """다른 부문 축의 이름 — 정의된 부문은 기준 정보에서, 초안은 초안에서."""
    if sector_key in MEASUREMENT_FRAMEWORK:
        return next((a['label'] for a in get_axes(sector_key) if a['key'] == axis_key), None)
    conf = PROPOSED_FRAMEWORK.get(sector_key, {})
    return next((i['axis_label'] for i in conf.get('indicators', []) if i['axis'] == axis_key), None)


def _needs(it):
    """부문을 건너는 선행 — 이름을 붙여 돌려준다. 못 찾는 축은 조용히 빼지 않고 KeyError 다."""
    out = []
    for sec, ax, how in it.get('needs', []):
        label = _axis_label(sec, ax)
        if label is None:
            raise KeyError((sec, ax))
        sec_conf = PROPOSED_FRAMEWORK.get(sec)
        sec_label = (sec_conf or {}).get('label') or (sector_of(sec) or {}).get('label', sec)
        out.append({'sector': sec, 'sector_label': sec_label, 'axis': ax, 'label': label, 'how': how})
    return out


def _fed_by(it, elems):
    """업무 요소 → 지표 입력."""
    return [{'key': e, 'band': elems[e][0], 'label': elems[e][1], 'how': h}
            for e, h in map(_how, it.get('fed_by', []))]


def proposed_framework():
    """초안 부문들 — 축이 아직 기준 정보에 없으므로 이름을 여기서 직접 들고 있다.

    ⚠️ 반환 모양을 measurement_framework 의 행과 맞춘다. 화면이 같은 방식으로
       그리되 draft 표시만 보고 회색으로 처리하면 되게 하기 위해서다.
    """
    outs = {o['key']: o for o in BUSINESS_OUTCOMES}
    kpis = {k['key']: k for k in KPI_SET}
    elems = _element_index()
    secs = []
    for key, conf in PROPOSED_FRAMEWORK.items():
        lab = {it['axis']: it['axis_label'] for it in conf['indicators']}
        rows = []
        for it in conf['indicators']:
            rows.append({
                'axis': it['axis'], 'axis_label': it['axis_label'], 'derived_label': None,
                'role': it['role'], 'role_label': INDICATOR_ROLES[it['role']]['label'],
                'change': it['change'], 'metric': it['metric'], 'why': it['why'],
                'acts_on': [{'key': e, 'band': elems[e][0], 'label': elems[e][1], 'how': h}
                            for e, h in map(_how, it.get('acts_on', []))],
                'draft': True, 'levels': [], 'level_index': None, 'level_label': None,
                'gate_why': None,
                'deps': [{'key': d, 'label': lab[d], 'how': h}
                         for d, h in map(_how, it['deps'])],
                'needs': _needs(it), 'fed_by': _fed_by(it, elems),
                'kpi': [{'key': k, 'label': kpis[k]['label'], 'tier': kpis[k]['tier'], 'how': h}
                        for k, h in map(_how, it['kpi'])],
                'outcomes': [{'key': o, 'label': outs[o]['label'], 'how': h}
                             for o, h in map(_how, it['outcomes'])],
                'new_outcomes': [{'key': o, 'label': outs[o]['label'], 'how': h}
                                 for o, h in map(_how, it.get('new_outcomes', []))],
            })
        # ⚠️ 넓힌 이름을 쓴다 — SECTORS 의 부문명은 다른 모듈의 분류와 맞물려 있어
        #    거기서 바꾸면 모듈 사이가 어긋난다. 넓힘은 이 자료 안에서만.
        secs.append({'key': key, 'part': SECTOR_PART.get(key, 'link'),
                     'label': conf.get('label') or (sector_of(key) or {}).get('label', key),
                     'purpose': conf['purpose'], 'indicators': rows, 'draft': True})
    return secs


def focus_areas():
    """중점 추진 분야 — 조사 대상. 아직 안 연 분야도 남긴다."""
    kpis = {k['key']: k for k in KPI_SET}
    return [{
        'key': f['key'],
        'label': (PROPOSED_FRAMEWORK.get(f['key'], {}).get('label')
                  or (sector_of(f['key']) or {}).get('label', f['key'])),
        'open': bool(sector_is_active(f['key'])),
        'defined': f['key'] in MEASUREMENT_FRAMEWORK,
        'indicator_count': len(MEASUREMENT_FRAMEWORK.get(f['key'], {}).get('indicators', [])),
        'role': f['role'],
        'kpi': [{'key': k, 'label': kpis[k]['label'], 'tier': kpis[k]['tier']} for k in f['kpi']],
    } for f in FOCUS_AREAS]


def framework_all():
    """전 부문의 측정 체계 — 「요약」 한 장이 쓴다.

    ⚠️ 요약은 부문 선택과 **무관한 한 페이지**다(2026-08-31 요청). 부문마다 따로
       부르면 화면이 부문에 매이고, 여섯 분야를 한눈에 보여 준다는 목적이 깨진다.
       공통 재료(성과·KPI·공백)는 한 벌만 싣는다 — 부문 수만큼 되풀이하면 응답이 붓는다.
    """
    secs = []
    for key in MEASUREMENT_FRAMEWORK:
        if not sector_is_active(key):
            continue                       # 아직 안 연 부문은 「중점 분야」에만 남는다
        f = measurement_framework(key)
        secs.append({'key': key, 'label': (sector_of(key) or {}).get('label', key),
                     'part': SECTOR_PART.get(key, 'link'),
                     'purpose': f['purpose'], 'indicators': f['indicators']})
    return {
        'sectors': secs,
        # ⚠️ 초안은 따로 싣는다 — 섞으면 「정의된 것」과 「제안하는 것」이 구분되지 않는다.
        'draft_sectors': proposed_framework(),
        # 개발·제조의 업무 요소 — 순서도의 위·아래 띠. 디지털 트윈 **밖**이다.
        'value_chain': value_chain(),
        'focus_areas': focus_areas(),
        'outcomes': BUSINESS_OUTCOMES, 'kpis': KPI_SET, 'kpi_tiers': KPI_TIERS,
        'gaps': FRAMEWORK_GAPS, 'roles': INDICATOR_ROLES, 'caveats': FRAMEWORK_CAVEATS,
    }
