# -*- coding: utf-8 -*-
"""개발 디지털 트윈 성숙도 — 정의의 단일 출처. (PLAN.md 3·4절)

부문(sector) · 축(axis) · 사다리(ladder) · 정확도 규칙 · 가져오기 틀이 전부 여기
있다. 화면·API·시험이 이 파일 하나를 읽는다 — 정의가 두 곳이면 둘이 갈린다.

⚠️⚠️ **한 엔진, 부문별 사다리 세트.** 부문마다 코드를 갈라 만들지 않는다.
   부문을 하나 더 붙이는 일이 `SECTORS` 와 사다리 한 벌을 더하는 것으로 끝나야 한다.
   그렇지 않으면 3절의 설계가 틀린 것이다.

⚠️ **축은 세 종류다.** `rung`(칸을 고른다) · `value`(값을 적고 문턱으로 칸이 정해진다) ·
   `set`(선후 없는 항목을 선택·해제한다 — 자동화). 정확도가 value 다. 값과 칸이 따로 놀면
   정확도가 둘이 된다 — 칸을 바꾸려면 값을 바꿔야 한다. set 은 첫 칸(수동)이 「아무것도
   안 켬」이고 서열은 켠 개수다 — 전처리·실행·후처리에는 순서가 없다(2026-08-28).

⚠️ **사다리 문구는 설정으로 갈아 끼울 수 있지만 key 는 고정이다.** 이력과 평가가
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
    # ⚠️ 아래 셋은 자리만 잡아 둔다. 사다리가 없으면 화면에 안 뜬다(active=False).
    {'key': 'verification_automation', 'label': '검증 자동화', 'has_agent': True,
     'subject_label': '검증 대상 로직', 'agent_label': '자동 검증 환경', 'phase': 2},
    {'key': 'design_automation', 'label': '설계 자동화', 'has_agent': True,
     'subject_label': '설계 업무', 'agent_label': '자동화 도구', 'phase': 2},
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

# ── 축과 사다리 — 시뮬레이션 부문 (합의됨, PLAN 4절) ───────────────────────
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
            #    '미평가' 은 값이 없는 상태라 사다리에 없다(None).
            'rungs': [
                # 문구는 2026-08-28 — 한 줄 막대의 세 영역. key 는 고정.
                {'key': 'trend', 'label': '경향 일치',
                 'description': '시험의 방향·순서는 맞지만 값은 안 맞는다'},
                {'key': 'quantitative', 'label': '원인 분석',
                 'description': '값이 맞아 문제의 원인을 시뮬레이션으로 찾을 수 있다'},
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
            # ⚠️ 사다리가 아니라 **묶음**이다. 전처리·실행·후처리·보고·파이프라인은 선후가
            #    없어 따로 선택·해제한다. 「수동」은 아무것도 안 켠 상태. 서열(색)은 켠 개수다.
            'rungs': [
                {'key': 'manual', 'label': '수동', 'short': '수동', 'description': '아무 단계도 자동이 아니다 — 전 과정을 사람이 한다'},
                {'key': 'pre', 'label': '전처리 자동', 'short': '전처리', 'description': '형상·메시·조건 준비가 자동'},
                {'key': 'run', 'label': '실행 자동', 'short': '실행', 'description': '템플릿으로 해석이 돈다'},
                {'key': 'post', 'label': '후처리 자동', 'short': '후처리', 'description': '결과 정리(추출·그래프)가 자동'},
                {'key': 'report', 'label': '보고 자동', 'short': '보고', 'description': '보고서가 자동으로 나온다'},
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
            # 묶음이다(2026-08-28) — 시험 병행·원인 분석·사전 검증·인증 게이트·완전 대체는 사다리가 아니라
            # **쓰임새**라 겹칠 수 있다. 첫 칸 「없음」은 아무것도 안 켠 상태이고 화면엔 안 보인다(hide_empty).
            # 「완전 대체」를 선택하면 나머지가 다 켜진다(implies). 오른쪽일수록 앞선 것.
            'hide_empty': True,
            'implies': {'full': ['reference', 'cause_analysis', 'screening', 'cert_gate']},
            'rungs': [
                {'key': 'none', 'label': '없음', 'description': '시험 대체에 시뮬레이션을 쓰지 않는다'},
                {'key': 'reference', 'label': '시험 병행(참고)', 'short': '병행', 'description': '시험은 그대로, 참고만'},
                {'key': 'cause_analysis', 'label': '원인 분석', 'short': '원인', 'description': '시험에서 난 문제의 원인을 시뮬레이션으로 찾는다'},
                {'key': 'screening', 'label': '사전 검증(자주 검증)', 'short': '사전', 'description': '시험 전에 설계자가 시뮬레이션으로 먼저 걸러 시험 횟수를 줄인다'},
                {'key': 'cert_gate', 'label': '신뢰성 인증 게이트', 'short': '인증', 'description': '신뢰성 인증의 관문을 시뮬레이션 결과로 통과한다'},
                {'key': 'full', 'label': '완전 대체', 'short': '완전', 'description': '시험을 하지 않는다'},
            ],
        },
    ],
    # 나머지 부문은 사다리가 없다 — 자료 조사 뒤(PLAN 3-1) / 3차(3-2).
    'verification_automation': [],
    'design_automation': [],
    # ── 디지털 스레드(2026-08-28) — 대상은 「구간」(데이터가 조직·시스템을 건너는 자리), 수단 없음 ──
    'digital_thread': [
        {
            'key': 'link_mode', 'label': '연결 방식', 'kind': 'rung',
            'question': '데이터가 어떻게 건너가는가',
            'evidence': ['attachment'], 'evidence_label': '근거 링크',
            # 매개가 「비공식 매개」면 둘째 칸까지만(threads.guard_assess)
            'rungs': [
                {'key': 'verbal', 'label': '문서·구두 전달', 'description': '사람이 문서나 말로 넘긴다'},
                {'key': 'manual_file', 'label': '수동 파일 교환', 'description': '사람이 파일을 내려 보낸다(메일·공유폴더)'},
                {'key': 'auto_file', 'label': '자동 파일 교환', 'description': '정해진 폴더·포맷으로 자동 배치'},
                {'key': 'api', 'label': 'API 연동', 'description': '시스템끼리 API·링크로 바로 잇는다'},
                {'key': 'sync', 'label': '자동 동기', 'description': '바뀌면 저절로 따라간다'},
                {'key': 'closed_loop', 'label': '폐루프', 'description': '하류의 결과가 상류를 갱신한다'},
            ],
        },
        {
            'key': 'traceability', 'label': '추적성', 'kind': 'set', 'hide_empty': True,
            'question': '건너면서 무엇을 잃지 않는가',
            'evidence': ['attachment'], 'evidence_label': '근거 링크',
            'rungs': [
                {'key': 'none', 'label': '없음', 'description': '아무것도 유지되지 않는다'},
                {'key': 'identity', 'label': '식별자 유지', 'short': '식별자', 'description': '같은 물건을 같은 id 로 안다'},
                {'key': 'version', 'label': '버전 유지', 'short': '버전', 'description': '어느 판인지 안다'},
                {'key': 'provenance', 'label': '출처 기록', 'short': '출처', 'description': '누가 언제 만들었는지 남는다'},
                {'key': 'up_link', 'label': '상류 링크', 'short': '상류', 'description': '어디서 왔는지로 거슬러 간다'},
                {'key': 'down_link', 'label': '하류 링크', 'short': '하류', 'description': '어디에 쓰였는지로 내려간다'},
            ],
        },
        {
            'key': 'consistency', 'label': '데이터 정합', 'kind': 'rung',
            'question': '두 쪽이 같은 뜻으로 읽는가',
            'evidence': ['attachment'], 'evidence_label': '근거 링크',
            'rungs': [
                {'key': 'retyped', 'label': '사람이 옮겨 적음', 'description': '값을 손으로 다시 넣는다'},
                {'key': 'mapped', 'label': '매핑표', 'description': '같은 뜻 다른 코드를 표로 맞춘다'},
                {'key': 'master', 'label': '같은 마스터 참조', 'description': '둘 다 같은 기준 자료를 본다'},
                {'key': 'single_source', 'label': '단일 원천', 'description': '한 곳에만 있고 나머지는 참조'},
            ],
        },
        {
            'key': 'scope', 'label': '적용 범위', 'kind': 'rung',
            'question': '어느 개발 과제에서 흐르는가',
            'evidence': ['product_families'], 'evidence_label': '대상 제품군',
            'rungs': [
                {'key': 'issue', 'label': '이슈 대응', 'description': '문제가 난 뒤, 그 과제에만'},
                {'key': 'basic', 'label': '대표(Basic) 모델', 'description': '제품군의 대표 모델 개발에서'},
                {'key': 'derived_some', 'label': '신규 개발 전 모델', 'description': '신규 개발 과제 전부에서'},
                {'key': 'all', 'label': '파생·지역 변형까지', 'description': '파생·지역 변형 과제까지 전부에서'},
            ],
        },
        {
            'key': 'stability', 'label': '운영 안정성', 'kind': 'value', 'unit': '%',
            'question': '수동 개입 없이 흐른 비율',
            'evidence': ['attachment'], 'evidence_label': '근거 링크',
            # 값 축 — 정확도처럼 기록이 줄줄이 쌓인다. 문턱은 축 자체에(사업부 설정 아님).
            'thresholds': [{'rung': 'manual_heavy', 'min': 0}, {'rung': 'partly', 'min': 50}, {'rung': 'auto', 'min': 90}],
            'boundary': 'gte',
            'rungs': [
                {'key': 'manual_heavy', 'label': '손이 많이 감', 'description': '절반 넘게 사람이 고친다'},
                {'key': 'partly', 'label': '대체로 자동', 'description': '가끔 손을 댄다'},
                {'key': 'auto', 'label': '자동 운영', 'description': '거의 손을 안 댄다'},
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
    {'key': 'informal', 'label': '비공식 매개'}, {'key': 'other', 'label': '기타'},
]
SYSTEM_KIND_KEYS = [k['key'] for k in SYSTEM_KINDS]
INFORMAL_ITEMS = ['메일', '엑셀·문서 전달', '파일서버·공유폴더', '메신저', '구두·회의']
LINK_MEANS = [{'key': 'api', 'label': 'API 있음'}, {'key': 'file', 'label': '파일 배치'}, {'key': 'none', 'label': '없음'}, {'key': 'unknown', 'label': '미확인'}]
LINK_MEANS_KEYS = [k['key'] for k in LINK_MEANS]
SYSTEM_STATUS = [{'key': 'active', 'label': '운영'}, {'key': 'adopting', 'label': '도입 중'}, {'key': 'retiring', 'label': '폐지 예정'}]
SYSTEM_STATUS_KEYS = [k['key'] for k in SYSTEM_STATUS]

# 표준 스레드의 첫 판 — 표가 비어 있을 때 넣는 초안. 사무국이 화면에서 고친다(key 는 고정).
THREAD_DEFAULTS = [
    {'key': 'simulation', 'name': '시뮬레이션 스레드', 'description': '요구사항에서 해석 조건·모델·결과·설계 판정·시험 비교까지', 'axes_off': ['consistency'],
     'segments': [
         {'key': 'req_to_cond', 'name': '요구사항 → 해석 조건', 'from': 'planning', 'to': 'development'},
         {'key': 'cad_to_model', 'name': '설계 형상 → 해석 모델', 'from': 'development', 'to': 'development'},
         {'key': 'result_to_review', 'name': '해석 결과 → 설계 판정', 'from': 'development', 'to': 'development'},
         {'key': 'test_vs_result', 'name': '시험 결과 ↔ 해석 결과', 'from': 'quality', 'to': 'development'},
         {'key': 'eco_to_rerun', 'name': '설계 변경 → 해석 재수행', 'from': 'development', 'to': 'development'},
     ]},
    {'key': 'cost', 'name': '재료비 스레드', 'description': '목표 원가에서 설계 BOM·예상 원가·구매 단가·실적 원가·손익까지',
     'segments': [
         {'key': 'target_to_bom', 'name': '목표 원가 → 설계 BOM', 'from': 'planning', 'to': 'development'},
         {'key': 'bom_to_estimate', 'name': '설계 BOM → 예상 원가', 'from': 'development', 'to': 'management'},
         {'key': 'estimate_to_price', 'name': '예상 원가 → 구매 단가', 'from': 'management', 'to': 'purchasing'},
         {'key': 'price_to_actual', 'name': '구매 단가 → 실적 원가', 'from': 'purchasing', 'to': 'manufacturing'},
         {'key': 'actual_to_pl', 'name': '실적 원가 → 손익', 'from': 'manufacturing', 'to': 'management'},
     ]},
    {'key': 'quality', 'name': '품질 스레드', 'description': '스펙에서 신뢰성 시험·양산 검사·시장 불량·원인 분석·설계 변경까지(폐루프)',
     'segments': [
         {'key': 'spec_to_test', 'name': '스펙 → 신뢰성 시험 결과', 'from': 'development', 'to': 'quality'},
         {'key': 'test_to_inspection', 'name': '시험 결과 → 양산 검사', 'from': 'quality', 'to': 'manufacturing'},
         {'key': 'inspection_to_field', 'name': '양산 검사 → 시장 불량', 'from': 'manufacturing', 'to': 'market'},
         {'key': 'field_to_cause', 'name': '시장 불량 → 원인 분석', 'from': 'market', 'to': 'development'},
         {'key': 'cause_to_eco', 'name': '원인 분석 → 설계 변경', 'from': 'development', 'to': 'development'},
     ]},
    {'key': 'manufacturing', 'name': '제조 스레드', 'description': '설계 형상·공차에서 공정 설계·설비 파라미터·생산 실적·설계 피드백까지',
     'segments': [
         {'key': 'design_to_process', 'name': '설계 형상·공차 → 공정 설계', 'from': 'development', 'to': 'mfg_eng'},
         {'key': 'process_to_equipment', 'name': '공정 설계 → 설비 파라미터', 'from': 'mfg_eng', 'to': 'manufacturing'},
         {'key': 'equipment_to_yield', 'name': '설비 파라미터 → 생산 실적·수율', 'from': 'manufacturing', 'to': 'manufacturing'},
         {'key': 'yield_to_design', 'name': '생산 실적 → 설계 피드백', 'from': 'manufacturing', 'to': 'development'},
     ]},
    {'key': 'bom_change', 'name': 'BOM·설계 변경 스레드', 'description': '설계 BOM에서 제조 BOM·구매·설계 변경 전파까지',
     'segments': [
         {'key': 'ebom_to_mbom', 'name': '설계 BOM → 제조 BOM', 'from': 'development', 'to': 'mfg_eng'},
         {'key': 'mbom_to_purchase', 'name': '제조 BOM → 구매 요청', 'from': 'mfg_eng', 'to': 'purchasing'},
         {'key': 'eco_to_mbom', 'name': '설계 변경 → 제조 BOM 반영', 'from': 'development', 'to': 'mfg_eng'},
         {'key': 'eco_to_field', 'name': '설계 변경 → 서비스 부품 반영', 'from': 'development', 'to': 'market'},
     ]},
]


def thread_definitions():
    return {'stages': THREAD_STAGES, 'system_kinds': SYSTEM_KINDS, 'informal_items': INFORMAL_ITEMS,
            'link_means': LINK_MEANS, 'system_status': SYSTEM_STATUS}
AXIS_KINDS = {'rung', 'value', 'set', 'matrix'}   # matrix: 바탕 토글 + 불량 유형 × 열 표(모델링 수준)


def sector_is_active(sector_key):
    """사다리가 있는 부문만 화면에 뜬다. 자리만 잡힌 부문은 안 뜬다."""
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
SETTINGS_KEYS = ('ladders', 'accuracy', 'phenomena', 'stale_days', 'hidden_divisions', 'review_promote_min')


def _setting(key):
    from app.modules.digital_twin_dashboard.models import ModuleSettings
    row = ModuleSettings.query.filter_by(
        module_name=MODULE_KEY, settings_key=key).first()
    return row.settings_data if row and row.settings_data is not None else None


def get_axes(sector_key):
    """사다리 — 기본 문구 위에 설정의 문구를 덮는다. **key 가 맞는 칸만** 덮는다.

    설정에 모르는 key 가 있어도 칸이 생기지 않는다. 칸을 더하는 것은 코드의 일이다
    — 이력과 평가가 key 로 묶여 있어, 설정에서 칸이 생기고 없어지면 이력이 미아가 된다.
    """
    base = AXES.get(sector_key, [])
    override = (_setting('ladders') or {}).get(sector_key) or {}
    out = []
    for axis in base:
        words = {r['key']: r for r in (override.get(axis['key']) or []) if isinstance(r, dict)}
        rungs = [{**r, **{k: v for k, v in words.get(r['key'], {}).items()
                          if k in ('label', 'description')}}
                 for r in axis['rungs']]
        out.append({**axis, 'rungs': rungs})
    return out


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


def get_stale_days():
    v = _setting('stale_days')
    return int(v) if isinstance(v, (int, float)) and v > 0 else DEFAULT_STALE_DAYS


# ── 해석 활용 기록 — 시험과 짝이 없는 스팟성 시뮬레이션(2026-08-28) ──────────────
#
# 건(件)의 속성이다 — 사다리 칸이 아니라. 같은 문구를 「이 시뮬레이션은 어느 칸」이 아니라
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
    return {'kinds': REVIEW_KINDS, 'fields': REVIEW_FIELDS, 'columns': REVIEW_COLUMNS,
            'promote_min': get_review_promote_min()}
