# -*- coding: utf-8 -*-
"""개발 DB 용 성숙도 씨앗 — 전자제품 회사 모양의 시험 × 시뮬레이션. **개발 전용.**

⚠️⚠️ 운영에 돌리면 안 된다. 이 자료는 지어낸 것이다 — 임계값 보정이나 시점 판단을
   여기서 하면 안 된다(memory: dev-db-is-seeded). 로컬 DB 가 아니면 멈춘다.

무엇을 만드나 (사업부 5 · 시험 44 · 시뮬레이션 50 · 쌍 50 · 평가 142 · 이력 151)
    MX(모바일)   낙하·굽힘·발열·안테나·카메라 …      물리+데이터 모델 섞임, 가장 성숙
    VD(TV)       패널 열변형·백라이트·스탠드·음향 …     중간
    DA(가전)     냉장고 단열·세탁기 진동·모터 소음 …    자동화 낮음, 대체는 일부
    NW(네트워크)  기지국 방열·진동·EMI …                 시험 적음, 정확도 미입력 많음
    의료기기     초음파 프로브·X-ray 검출기 …           막 시작 — 대부분 미평가

일부러 남긴 것: 미평가 칸(다음 채울 곳) · 낡은 평가(14개월 전) · 부분 채움 정확도 ·
단일/평균 규칙이 갈리는 항목 · 이력(칸이 올라온 날). 화면이 이런 것을 말해야 해서다.

돌리기
    cd backend && python scripts/seed_dev_dt_maturity.py
    (여러 번 돌려도 같다 — 다섯 사업부의 성숙도 자료를 비우고 다시 넣는다)
"""
import logging
import os
import sys
from datetime import datetime, timedelta

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(_HERE))
logging.disable(logging.INFO)          # 엔진 에코까지 끈다 — 안 끄면 SQL 이 수백 KB 쏟아진다

from app import create_app                                                   # noqa: E402
from app.extensions import db                                                # noqa: E402
from app.modules.dev_dt_maturity import definitions as D                     # noqa: E402
from app.modules.dev_dt_maturity import services as S                        # noqa: E402
from app.modules.dev_dt_maturity.models import (                             # noqa: E402
    MaturityAgent, MaturityAssessment, MaturityChange, MaturityPair, MaturityReviewCase, MaturitySubject,
)
from app.modules.digital_twin_dashboard.models import Department, Division   # noqa: E402

NOW = datetime.now()
# 종류 → 흔히 쓰는 도구. 시뮬레이션에 인스턴스로 붙는다(전자제품 CAE 에서 흔한 것들).
TOOLS_BY_KIND = {
    '구조': ['LS-DYNA', 'HyperMesh'], '열': ['Ansys Icepak', 'FloTHERM'], '유동': ['Ansys Fluent', 'STAR-CCM+'],
    '전자기': ['HFSS', 'CST Studio'], '진동': ['Ansys Mechanical', 'HyperMesh'], '음향': ['Actran', 'COMSOL'],
    '광학': ['LightTools', 'Zemax'], '열구조': ['Abaqus', 'HyperMesh'], '동역학': ['RecurDyn', 'Adams'],
    '시스템': ['Amesim'], '공차': ['3DCS'], 'ML': ['Python', 'PyTorch'],
}
PEOPLE = ['김해석', '박시험', '이구조', '최열유동', '정데이터']

# ── 자료 ──────────────────────────────────────────────────────────────────
#
# 시험: (이름, 세부, 제품군, [시뮬레이션…])
# 시뮬레이션: (이름, 종류, 모델종류, {축: (칸|값, 근거, 증빙, 며칠 전)}, [이력 (며칠 전, 전, 후, 근거)…])
# 축 key 는 definitions.AXES['simulation'] 의 것. 값이 없는 축은 미평가로 남긴다.

# 시뮬레이션의 불량 유형 — 종류(kind)별로 그럴듯한 것들
DEFECTS_BY_KIND = {
    '구조': ['크랙', '파손', '영구 변형'], '열': ['변색', '과열', '열화'], '유동': ['소음', '누수'],
    '전자기': ['오동작', '노이즈'], '진동': ['공진 파손', '체결 풀림'], '음향': ['이음', '떨림'],
    '열구조': ['열변형', '납 균열'], '동역학': ['걸림', '마모'], '광학': ['얼룩', '빛샘'],
    '공차': ['간섭', '단차'], '시스템': ['오동작'], 'ML': ['오판정'],
}


# 시뮬레이션마다 그럴듯한 불량 유형 — 이름이 여기 있으면 종류별 기본보다 우선한다(2026-08-28)
DEFECTS_BY_NAME = {
    # MX
    'OIS 진동 해석': ['OIS 떨림', '공진 파손', '스프링 피로'],
    '굽힘 강성 해석': ['프레임 영구 변형', '디스플레이 크랙', '백글라스 파손'],
    '낙하 구조 해석': ['커버 글라스 크랙', '카메라 렌즈 파손', '프레임 찍힘', '기판 솔더 크랙'],
    '낙하 파손 예측 모델': ['커버 글라스 크랙', '카메라 렌즈 파손'],
    '돔 스위치 피로 해석': ['돔 눌림 불량', '클릭감 저하', '돔 크랙'],
    '랜덤 진동 해석': ['솔더 크랙', '커넥터 이탈', '체결 풀림'],
    '셀 팽창 구조 해석': ['배터리 스웰링 변형', '백커버 들뜸', '디스플레이 들뜸'],
    '스웰링 수명 예측': ['배터리 스웰링 변형', '백커버 들뜸'],
    '실링 압력 해석': ['방수 실링 누수', '개스킷 영구 변형'],
    '안테나 전자기 해석': ['수신 감도 저하', '핸드 이펙트 감도 저하', 'SAR 초과'],
    '열 과도응답 예측': ['표면 과열', '성능 스로틀링'],
    '열 해석 (정상상태)': ['표면 과열', '성능 스로틀링', '배터리 고온 열화'],
    '음향 해석': ['스피커 찌그러짐', '이음', '통화 음질 저하'],
    '충전 열 해석': ['충전 중 과열', '커넥터 변색', '배터리 고온 열화'],
    '폴딩 응력 해석': ['폴딩 주름', '힌지부 크랙', '패널 층간 박리'],
    '힌지 마모 해석': ['힌지 마모', '힌지 유격', '힌지 소음'],
    # VD
    'TV 음향 해석': ['스피커 떨림', '이음', '저음 왜곡'],
    '공차 해석': ['베젤 단차', '패널 간섭', '유격'],
    '광학 시뮬레이션': ['빛샘', '무라', '휘도 불균일'],
    '리모컨 낙하 해석': ['하우징 크랙', '버튼 이탈', '배터리 커버 파손'],
    '마운트 구조 해석': ['마운트 변형', '체결부 크랙', '처짐'],
    '무라 예측 모델': ['무라', '휘도 불균일'],
    '스탠드 구조 해석': ['스탠드 처짐', '넘어짐', '체결부 크랙'],
    '전원 보드 열 해석': ['커패시터 과열', '기판 변색', '납 균열'],
    '패널 열-구조 연성 해석': ['패널 열변형', '무라', '납 균열'],
    '포장 완충 해석': ['운송 중 패널 파손', '코너 찍힘', '완충재 파손'],
    # 생활가전
    '건조 열물질 전달 모델': ['건조 불균일', '과건조 변색', '수축'],
    '냉기 유동 해석': ['냉기 불균일', '결로', '성에'],
    '냉매 사이클 시뮬레이션': ['냉각 성능 저하', '압축기 과부하', '결로'],
    '노즐 분사 유동 해석': ['세척 불량', '노즐 막힘', '소음'],
    '드럼 동역학 해석': ['드럼 편심 진동', '베어링 마모', '이음'],
    '모터 전자기-음향 해석': ['모터 소음', '토크 리플', '진동'],
    '실내 기류 해석': ['냉기 불균일', '결로', '소음'],
    '오븐 복사-대류 해석': ['가열 불균일', '도어 과열', '변색'],
    '유도 가열 전자기-열 해석': ['가열 불균일', '코일 과열', '유리 상판 크랙'],
    '진동 이상 예측': ['드럼 편심 진동', '베어링 마모'],
    '팬 유동 해석': ['소음', '풍량 저하', '진동'],
    '힌지 피로 해석': ['도어 힌지 파손', '도어 처짐', '힌지 마모'],
    # NW
    'EMI 전자기 해석': ['EMI 초과', '오동작', '노이즈'],
    'RU 열 해석': ['소자 과열', '방열판 변색', '성능 저하'],
    '부식 예측 모델': ['외함 부식', '커넥터 부식'],
    '어레이 안테나 해석': ['빔 왜곡', '이득 저하', '사이드로브 초과'],
    '포장 낙하 해석': ['외함 변형', '커넥터 파손', '내부 체결 풀림'],
    '풍하중 구조 해석': ['마운트 변형', '체결부 파손', '공진 진동'],
    # 의료기기
    'EMC 해석': ['EMC 초과', '오동작', '영상 노이즈'],
    '검출기 낙하 해석': ['검출기 파손', '하우징 크랙', '센서 정렬 틀어짐'],
    '음향 빔 시뮬레이션': ['영상 해상도 저하', '아티팩트', '빔 왜곡'],
    '전도 구조 해석': ['전도 시 프레임 변형', '캐스터 파손', '모니터 암 파손'],
    '케이블 피로 해석': ['케이블 단선', '피복 크랙', '커넥터 접촉 불량'],
    '프로브 열 해석': ['프로브 표면 과열', '렌즈 변색', '성능 저하'],
}


def _defects_for(name, kind):
    return DEFECTS_BY_NAME.get(name) or DEFECTS_BY_KIND.get(kind, [])


def _modeling_seed(val, defect_types, evidence, days):
    """옛 묶음 값('geometry,performance,defect,multi')을 바탕 + 불량 유형 표로 옮긴다."""
    parts = set(str(val or '').split(','))
    base = [k for k in ('geometry', 'performance') if k in parts]
    names = list(defect_types or [])
    defects = {}
    when = _days_ago(days).strftime('%Y-%m')
    if 'condition' in parts:
        for n in names:
            defects[n] = {'test': when}
    elif 'defect' in parts:
        for n in names[: max(1, (len(names) + 1) // 2)]:
            defects[n] = {'test': when}
    if 'multi' in parts and names:
        defects.setdefault(names[0], {'test': when})['market'] = when
    ev = dict(evidence or {})
    ev.pop('phenomena', None)          # 현상 태그는 뺐다 — 불량 유형 표가 그 자리
    if defects:
        ev['defects'] = defects
    return (','.join(base) or 'none'), ev


def _s(name, kind, model, assess, history=()):
    return (name, kind, model, assess, list(history))


DATA = {
    'MX': [
        ('낙하 시험', '1.2m 6면 26모서리', ['S 시리즈', 'A 시리즈', 'Z 폴드'], [
            _s('낙하 구조 해석', '구조', 'physics',
               {'accuracy': (91, '25년 낙하 32건 비교, 파손 위치 일치율 91%', {'compared_tests': 32, 'error_pct': 6}, 20),
                'automation': ('pre,run,post,report', '낙하 자세 24종 템플릿 + 보고서 자동', {'hours_per_run': 3}, 45),
                'modeling': ('geometry,performance,defect,multi', '유리 깨짐·프레임 휨·커넥터 이탈까지', {'phenomena': ['유리 깨짐', '프레임 휨', '커넥터 이탈']}, 45),
                'scope': ('all', '25년 출시 전 모델에 적용', {}, 45),
                'substitution': ('screening', '1차 시제 낙하 시험 3회 → 1회', {'tests_saved_per_year': 40}, 45)},
               [(400, None, 'pre', '메시 자동화'), (250, 'pre', 'pre,run', '자세 템플릿'), (45, 'pre,run', 'pre,run,post,report', '보고서 자동')]),
            _s('낙하 파손 예측 모델', 'ML', 'data',
               {'accuracy': (84, '해석 결과 2,100건 학습, 파손 여부 정확도 84%', {'compared_tests': 120}, 30),
                'automation': ('pre,run,post,report,pipeline', '설계 변경 → 파손 확률 자동 산출', {'hours_per_run': 0.2}, 30),
                'modeling': ('geometry,performance,defect', '유리 깨짐 여부만', {'phenomena': ['유리 깨짐']}, 30),
                'scope': ('basic', '플래그십 기본 모델', {}, 30)},
               [(90, None, 'pre,run', '초기 파이프라인'), (30, 'pre,run', 'pre,run,post,report,pipeline', '설계 변경 연동')]),
        ]),
        ('굽힘 시험', '3점 굽힘 1kN', ['S 시리즈', 'A 시리즈'], [
            _s('굽힘 강성 해석', '구조', 'physics',
               {'accuracy': (95, '강성 곡선 오차 5% 이내', {'compared_tests': 18, 'error_pct': 5}, 60),
                'automation': ('pre,run', '', {'hours_per_run': 2}, 60),
                'modeling': ('geometry,performance', '강성·최대 변형', {}, 60),
                'scope': ('all', '', {}, 60),
                'substitution': ('screening,cert_gate', '인증 시험만 남김', {'tests_saved_per_year': 60}, 60)},
               [(300, None, 'cause_analysis', '일부 조건'), (60, 'cause_analysis', 'screening,cert_gate', '인증 외 전량 대체')]),
        ]),
        ('폴더블 힌지 내구', '20만 회 접힘', ['Z 폴드'], [
            _s('힌지 마모 해석', '구조', 'physics',
               {'accuracy': (72, '마모량 경향 일치, 절대값 오차 큼', {'compared_tests': 6, 'error_pct': 22}, 15),
                'automation': ('pre', '', {'hours_per_run': 16}, 15),
                'modeling': ('geometry,performance,defect', '힌지 유격', {'phenomena': ['힌지 유격']}, 15),
                'scope': ('issue', '이슈 모델 2종', {}, 15),
                'substitution': ('reference', '', {}, 15)}),
            _s('폴딩 응력 해석', '구조', 'physics',
               {'accuracy': (88, '패널 응력 분포 일치', {'compared_tests': 9, 'error_pct': 9}, 15),
                'modeling': ('geometry,performance,defect', '패널 주름', {'phenomena': ['패널 주름']}, 15)}),
        ]),
        ('발열 시험', '게임 30분 표면온도', ['S 시리즈', 'A 시리즈', 'Z 폴드'], [
            _s('열 해석 (정상상태)', '열', 'physics',
               {'accuracy': (89, '표면 최고온도 오차 ±2℃', {'compared_tests': 40, 'error_pct': 4}, 10),
                'automation': ('pre,run,post,report', '', {'hours_per_run': 4}, 10),
                'modeling': ('geometry,performance,defect,multi', '핫스팟·스로틀링 시점', {'phenomena': ['핫스팟', '스로틀링']}, 10),
                'scope': ('all', '', {}, 10),
                'substitution': ('cause_analysis', '', {'tests_saved_per_year': 20}, 10)},
               [(200, None, 'reference', ''), (10, 'reference', 'cause_analysis', '온도 챔버 일부 조건 생략')]),
            _s('열 과도응답 예측', 'ML', 'hybrid',
               {'accuracy': (81, '30분 온도 곡선 RMSE 1.8℃', {'compared_tests': 25}, 10),
                'automation': ('pre,run', '', {}, 10)}),
        ]),
        ('안테나 성능', 'OTA TRP/TIS', ['S 시리즈', 'A 시리즈'], [
            _s('안테나 전자기 해석', '전자기', 'physics',
               {'accuracy': (93, 'TRP 오차 0.5dB', {'compared_tests': 50, 'error_pct': 3}, 90),
                'automation': ('pre,run,post,report', '', {'hours_per_run': 6}, 90),
                'modeling': ('geometry,performance', 'TRP·TIS', {}, 90),
                'scope': ('all', '', {}, 90),
                'substitution': ('screening', '', {'tests_saved_per_year': 80}, 90)}),
        ]),
        ('카메라 손떨림 보정', 'OIS 4축', ['S 시리즈'], [
            _s('OIS 진동 해석', '진동', 'physics',
               {'accuracy': (76, '공진 주파수 일치, 진폭 오차', {'compared_tests': 8, 'error_pct': 15}, 30),
                'modeling': ('geometry,performance', '', {}, 30),
                'scope': ('basic', '', {}, 30)}),
        ]),
        ('방수 시험', 'IP68 1.5m 30분', ['S 시리즈', 'A 시리즈'], [
            _s('실링 압력 해석', '구조', 'physics',
               {'accuracy': (68, '누수 위치는 맞으나 압력값 편차', {'compared_tests': 5, 'error_pct': 25}, 420),
                'automation': ('manual', '', {'hours_per_run': 24}, 420),
                'scope': ('issue', '', {}, 420)}),
        ]),
        ('배터리 스웰링', '고온 보관 후 두께', ['S 시리즈', 'A 시리즈', 'Z 폴드'], [
            _s('셀 팽창 구조 해석', '구조', 'physics',
               {'accuracy': (79, '', {'compared_tests': 12, 'error_pct': 12}, 25),
                'modeling': ('geometry,performance,defect', '후면 커버 들뜸', {'phenomena': ['커버 들뜸']}, 25),
                'automation': ('pre', '', {}, 25)}),
            _s('스웰링 수명 예측', 'ML', 'data',
               {'accuracy': (None, '', {}, 0)}),
        ]),
        ('스피커 음향', '주파수 응답', ['S 시리즈', 'A 시리즈'], [
            _s('음향 해석', '음향', 'physics',
               {'accuracy': (85, '', {'compared_tests': 20, 'error_pct': 8}, 40),
                'automation': ('pre,run', '', {'hours_per_run': 5}, 40),
                'modeling': ('geometry,performance', '주파수 응답', {}, 40),
                'scope': ('derived_some', '', {}, 40),
                'substitution': ('cause_analysis', '', {'tests_saved_per_year': 15}, 40)}),
        ]),
        ('키 내구', '측면 키 50만 회', ['S 시리즈', 'A 시리즈'], [
            _s('돔 스위치 피로 해석', '구조', 'physics',
               {'accuracy': (None, '', {}, 0), 'automation': ('manual', '', {}, 100)}),
        ]),
        ('충전 발열', '25W 유선 충전', ['S 시리즈', 'A 시리즈'], [
            _s('충전 열 해석', '열', 'physics',
               {'accuracy': (87, '', {'compared_tests': 15, 'error_pct': 6}, 50),
                'automation': ('pre,run,post,report', '', {}, 50), 'scope': ('all', '', {}, 50),
                'substitution': ('cause_analysis', '', {}, 50)}),
        ]),
        ('진동 시험', '수송 진동 프로파일', ['S 시리즈', 'A 시리즈', 'Z 폴드'], [
            _s('랜덤 진동 해석', '진동', 'physics',
               {'accuracy': (90, '', {'compared_tests': 22, 'error_pct': 7}, 35),
                'automation': ('pre,run', '', {}, 35), 'modeling': ('geometry,performance,defect', '납땜 크랙', {'phenomena': ['납땜 크랙']}, 35),
                'scope': ('all', '', {}, 35), 'substitution': ('screening', '', {'tests_saved_per_year': 30}, 35)}),
        ]),
    ],
    'VD': [
        ('패널 열변형', '65인치 4시간 점등', ['Neo QLED', 'OLED', 'Crystal UHD'], [
            _s('패널 열-구조 연성 해석', '열구조', 'physics',
               {'accuracy': (86, '휨량 오차 0.3mm', {'compared_tests': 14, 'error_pct': 9}, 30),
                'automation': ('pre,run', '', {'hours_per_run': 8}, 30),
                'modeling': ('geometry,performance,defect,multi', '패널 휨·베젤 갭', {'phenomena': ['패널 휨', '베젤 갭']}, 30),
                'scope': ('derived_some', '', {}, 30), 'substitution': ('cause_analysis', '', {'tests_saved_per_year': 12}, 30)},
               [(150, None, 'reference', ''), (30, 'reference', 'cause_analysis', '')]),
        ]),
        ('백라이트 휘도 균일도', '9점 측정', ['Neo QLED', 'Crystal UHD'], [
            _s('광학 시뮬레이션', '광학', 'physics',
               {'accuracy': (92, '', {'compared_tests': 30, 'error_pct': 4}, 60),
                'automation': ('pre,run,post,report', '', {}, 60), 'modeling': ('geometry,performance', '', {}, 60),
                'scope': ('all', '', {}, 60), 'substitution': ('screening,cert_gate', '', {'tests_saved_per_year': 50}, 60)}),
        ]),
        ('스탠드 하중', '전방 전도 10°', ['Neo QLED', 'OLED', 'Crystal UHD'], [
            _s('스탠드 구조 해석', '구조', 'physics',
               {'accuracy': (94, '', {'compared_tests': 25, 'error_pct': 5}, 45),
                'automation': ('pre,run,post,report', '', {}, 45), 'scope': ('all', '', {}, 45),
                'substitution': ('reference,cause_analysis,screening,cert_gate,full', '전도 시험 전량 대체', {'tests_saved_per_year': 90}, 45)},
               [(500, None, 'screening', ''), (200, 'screening', 'screening,cert_gate', ''), (45, 'screening,cert_gate', 'reference,cause_analysis,screening,cert_gate,full', '인증 기관 합의')]),
        ]),
        ('스피커 음향', '내장 스피커 주파수 응답', ['Neo QLED', 'OLED'], [
            _s('TV 음향 해석', '음향', 'physics',
               {'accuracy': (80, '', {'compared_tests': 10, 'error_pct': 10}, 70),
                'automation': ('pre', '', {}, 70), 'modeling': ('geometry,performance', '', {}, 70)}),
        ]),
        ('낙하 포장 시험', '포장 상태 낙하 60cm', ['Neo QLED', 'OLED', 'Crystal UHD'], [
            _s('포장 완충 해석', '구조', 'physics',
               {'accuracy': (77, '', {'compared_tests': 8, 'error_pct': 14}, 440),
                'automation': ('manual', '', {'hours_per_run': 30}, 440), 'scope': ('basic', '', {}, 440)}),
        ]),
        ('벽걸이 마운트 강도', 'VESA 4배 하중', ['Neo QLED', 'OLED'], [
            _s('마운트 구조 해석', '구조', 'physics',
               {'accuracy': (96, '', {'compared_tests': 12, 'error_pct': 3}, 20),
                'automation': ('pre,run', '', {}, 20), 'scope': ('all', '', {}, 20),
                'substitution': ('screening,cert_gate', '', {}, 20)}),
        ]),
        ('전원부 발열', '최대 밝기 8시간', ['Neo QLED', 'Crystal UHD'], [
            _s('전원 보드 열 해석', '열', 'physics',
               {'accuracy': (83, '', {'compared_tests': 16, 'error_pct': 7}, 40),
                'automation': ('pre,run', '', {}, 40), 'modeling': ('geometry,performance,defect', '커패시터 과열', {'phenomena': ['커패시터 과열']}, 40)}),
        ]),
        ('리모컨 낙하', '1m 낙하', ['공통'], [
            _s('리모컨 낙하 해석', '구조', 'physics', {'accuracy': (None, '', {}, 0)}),
        ]),
        ('화질 무라', '저계조 무라', ['OLED'], [
            _s('무라 예측 모델', 'ML', 'data',
               {'accuracy': (71, '패널 공정 데이터 기반', {'compared_tests': 200}, 25),
                'automation': ('pre,run,post,report,pipeline', '', {}, 25), 'modeling': ('geometry,performance,defect', '무라', {'phenomena': ['무라']}, 25),
                'scope': ('basic', '', {}, 25)}),
        ]),
        ('베젤 갭 조립', '4변 갭 편차', ['Neo QLED', 'OLED'], [
            _s('공차 해석', '공차', 'physics',
               {'accuracy': (88, '', {'compared_tests': 40, 'error_pct': 6}, 55),
                'automation': ('pre,run,post,report', '', {}, 55), 'scope': ('all', '', {}, 55), 'substitution': ('screening', '', {}, 55)}),
        ]),
    ],
    'DA': [
        ('냉장고 단열 성능', '월 소비전력', ['비스포크 냉장고', '김치냉장고'], [
            _s('냉기 유동 해석', '유동', 'physics',
               {'accuracy': (82, '', {'compared_tests': 12, 'error_pct': 9}, 60),
                'automation': ('pre', '', {'hours_per_run': 40}, 60), 'modeling': ('geometry,performance', '', {}, 60),
                'scope': ('basic', '', {}, 60), 'substitution': ('reference', '', {}, 60)}),
        ]),
        ('세탁기 탈수 진동', '1400rpm 편심 부하', ['비스포크 세탁기', '드럼 세탁기'], [
            _s('드럼 동역학 해석', '동역학', 'physics',
               {'accuracy': (90, '', {'compared_tests': 28, 'error_pct': 6}, 30),
                'automation': ('pre,run', '', {}, 30), 'modeling': ('geometry,performance,defect,multi', '워킹·소음', {'phenomena': ['워킹', '진동 소음']}, 30),
                'scope': ('all', '', {}, 30), 'substitution': ('screening', '', {'tests_saved_per_year': 25}, 30)},
               [(300, None, 'pre', ''), (30, 'pre', 'pre,run', '')]),
            _s('진동 이상 예측', 'ML', 'data',
               {'accuracy': (78, '', {'compared_tests': 60}, 30), 'automation': ('pre,run,post,report,pipeline', '', {}, 30)}),
        ]),
        ('모터 소음', '1m 거리 dB', ['비스포크 세탁기', '청소기'], [
            _s('모터 전자기-음향 해석', '음향', 'physics',
               {'accuracy': (74, '', {'compared_tests': 9, 'error_pct': 13}, 400),
                'automation': ('manual', '', {'hours_per_run': 60}, 400)}),
        ]),
        ('에어컨 냉방 능력', '정격 냉방', ['무풍 에어컨'], [
            _s('냉매 사이클 시뮬레이션', '시스템', 'physics',
               {'accuracy': (93, '', {'compared_tests': 35, 'error_pct': 4}, 45),
                'automation': ('pre,run,post,report', '', {}, 45), 'scope': ('all', '', {}, 45), 'substitution': ('cause_analysis', '', {}, 45)}),
            _s('실내 기류 해석', '유동', 'physics',
               {'accuracy': (80, '', {'compared_tests': 10, 'error_pct': 11}, 45), 'automation': ('pre', '', {}, 45)}),
        ]),
        ('식기세척기 세척 성능', '오염 접시 세척률', ['비스포크 식기세척기'], [
            _s('노즐 분사 유동 해석', '유동', 'physics',
               {'accuracy': (65, '', {'compared_tests': 4, 'error_pct': 28}, 20), 'modeling': ('geometry', '', {}, 20)}),
        ]),
        ('청소기 흡입력', '흡입 일률', ['비스포크 제트'], [
            _s('팬 유동 해석', '유동', 'physics',
               {'accuracy': (89, '', {'compared_tests': 20, 'error_pct': 6}, 35),
                'automation': ('pre,run', '', {}, 35), 'scope': ('derived_some', '', {}, 35), 'substitution': ('cause_analysis', '', {}, 35)}),
        ]),
        ('오븐 온도 균일도', '9점 온도', ['비스포크 오븐'], [
            _s('오븐 복사-대류 해석', '열', 'physics',
               {'accuracy': (84, '', {'compared_tests': 14, 'error_pct': 8}, 50), 'automation': ('pre', '', {}, 50)}),
        ]),
        ('건조기 건조 시간', '표준 부하', ['비스포크 건조기'], [
            _s('건조 열물질 전달 모델', '열', 'hybrid', {'accuracy': (None, '', {}, 0)}),
        ]),
        ('냉장고 도어 내구', '10만 회 개폐', ['비스포크 냉장고'], [
            _s('힌지 피로 해석', '구조', 'physics',
               {'accuracy': (86, '', {'compared_tests': 11, 'error_pct': 8}, 70),
                'automation': ('pre,run', '', {}, 70), 'substitution': ('screening', '', {'tests_saved_per_year': 10}, 70)}),
        ]),
        ('인덕션 발열 분포', '냄비 바닥 온도', ['비스포크 인덕션'], [
            _s('유도 가열 전자기-열 해석', '전자기', 'physics',
               {'accuracy': (91, '', {'compared_tests': 18, 'error_pct': 5}, 40), 'automation': ('pre,run,post,report', '', {}, 40),
                'scope': ('all', '', {}, 40), 'substitution': ('screening,cert_gate', '', {}, 40)}),
        ]),
    ],
    'NW': [
        ('기지국 방열', '55℃ 환경 최대 부하', ['5G RU', 'Massive MIMO'], [
            _s('RU 열 해석', '열', 'physics',
               {'accuracy': (88, '', {'compared_tests': 10, 'error_pct': 6}, 30),
                'automation': ('pre,run', '', {}, 30), 'scope': ('all', '', {}, 30), 'substitution': ('cause_analysis', '', {}, 30)}),
        ]),
        ('철탑 진동', '풍하중 진동', ['5G RU'], [
            _s('풍하중 구조 해석', '구조', 'physics',
               {'accuracy': (None, '', {}, 0), 'automation': ('manual', '', {}, 80)}),
        ]),
        ('EMI 방출', 'CISPR 32', ['5G RU', 'Massive MIMO', '코어 장비'], [
            _s('EMI 전자기 해석', '전자기', 'physics',
               {'accuracy': (70, '', {'compared_tests': 6, 'error_pct': 18}, 25), 'modeling': ('geometry,performance', '', {}, 25)}),
        ]),
        ('안테나 빔 패턴', '빔포밍 이득', ['Massive MIMO'], [
            _s('어레이 안테나 해석', '전자기', 'physics',
               {'accuracy': (95, '', {'compared_tests': 20, 'error_pct': 3}, 40),
                'automation': ('pre,run,post,report', '', {}, 40), 'scope': ('all', '', {}, 40), 'substitution': ('screening', '', {}, 40)}),
        ]),
        ('낙하·수송', '포장 낙하', ['5G RU'], [
            _s('포장 낙하 해석', '구조', 'physics', {}),
        ]),
        ('염수 분무 내식', '96시간', ['5G RU', 'Massive MIMO'], [
            _s('부식 예측 모델', 'ML', 'data', {'accuracy': (None, '', {}, 0)}),
        ]),
    ],
    '의료기기': [
        ('초음파 프로브 발열', '표면 온도 43℃ 이하', ['프로브'], [
            _s('프로브 열 해석', '열', 'physics',
               {'accuracy': (85, '', {'compared_tests': 7, 'error_pct': 7}, 15), 'automation': ('pre', '', {}, 15)}),
        ]),
        ('X-ray 검출기 낙하', '운반 낙하', ['디지털 X-ray'], [
            _s('검출기 낙하 해석', '구조', 'physics', {}),
        ]),
        ('본체 전도 안정성', '10° 경사', ['디지털 X-ray', '초음파 본체'], [
            _s('전도 구조 해석', '구조', 'physics',
               {'accuracy': (92, '', {'compared_tests': 5, 'error_pct': 4}, 30), 'scope': ('basic', '', {}, 30)}),
        ]),
        ('영상 화질 팬텀', '공간 분해능', ['초음파 본체'], [
            _s('음향 빔 시뮬레이션', '음향', 'physics', {'accuracy': (None, '', {}, 0)}),
        ]),
        ('케이블 굽힘 내구', '5만 회', ['프로브'], [
            _s('케이블 피로 해석', '구조', 'physics', {}),
        ]),
        ('EMC 면역', 'IEC 60601-1-2', ['디지털 X-ray', '초음파 본체'], [
            _s('EMC 해석', '전자기', 'physics', {}),
        ]),
    ],
}


# ── 넣기 ──────────────────────────────────────────────────────────────────

def _guard(app):
    uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
    if not any(h in uri for h in ('localhost', '127.0.0.1')) and os.environ.get('DT_MATURITY_DEV_SEED') != '1':
        print('로컬 DB 가 아닙니다. 개발 전용 씨앗이라 멈춥니다. (강제: DT_MATURITY_DEV_SEED=1)')
        sys.exit(2)


def _days_ago(n):
    return NOW - timedelta(days=int(n))


def main():
    app = create_app()
    app.config['SQLALCHEMY_ECHO'] = False
    _guard(app)
    with app.app_context():
        # ⚠️ 같은 이름의 비활성 옛 사업부 행이 있다(개발 DB 에 MX 가 둘). 활성만 쓰고,
        #    지울 때는 이름이 같은 행 전부를 지운다 — 안 그러면 옛 id 에 고아가 남는다.
        same_name = Division.query.filter(Division.name.in_(DATA.keys())).all()
        divisions = {d.name: d for d in same_name if d.is_active}
        missing = [n for n in DATA if n not in divisions]
        if missing:
            print('사업부가 없어 건너뜀:', missing)

        # 다시 넣는다 — 다섯 사업부의 성숙도 자료만.
        ids = [d.id for d in same_name]
        n_old = MaturitySubject.query.filter(MaturitySubject.division_id.in_(ids)).delete(synchronize_session=False)
        MaturityAgent.query.filter(MaturityAgent.division_id.in_(ids)).delete(synchronize_session=False)
        MaturityReviewCase.query.filter(MaturityReviewCase.division_id.in_(ids)).delete(synchronize_session=False)
        db.session.flush()

        counts = {'subjects': 0, 'agents': 0, 'pairs': 0, 'assessments': 0, 'changes': 0}
        axes = {a['key']: a for a in D.AXES['simulation']}
        for dname, tests in DATA.items():
            div = divisions.get(dname)
            if not div:
                continue
            agents = {}
            # 담당 부서 — 그 사업부의 활성 부서 중 CAE 냄새가 나는 것, 없으면 첫 것, 그것도 없으면 비움
            deps = Department.query.filter_by(division_id=div.id, is_active=True).order_by(Department.name).all()
            dep = next((x for x in deps if 'CAE' in (x.name or '').upper() or '해석' in (x.name or '')), deps[0] if deps else None)
            for order, (tname, detail, families, sims) in enumerate(tests, 1):
                subject = MaturitySubject(division_id=div.id, sector='simulation', name=tname, detail=detail,
                                          product_families=families, accuracy_rule='auto', order=order)
                db.session.add(subject); db.session.flush(); counts['subjects'] += 1
                for i, (sname, kind, model, assess, history) in enumerate(sims):
                    agent = agents.get(sname)
                    if agent is None:
                        agent = MaturityAgent(division_id=div.id, sector='simulation', name=sname, kind=kind, model_kind=model,
                                              tools=TOOLS_BY_KIND.get(kind, []), defect_types=_defects_for(sname, kind),
                                              department_id=(dep.id if dep else None))
                        db.session.add(agent); db.session.flush(); agents[sname] = agent; counts['agents'] += 1
                    pair = MaturityPair(subject_id=subject.id, agent_id=agent.id)
                    db.session.add(pair); db.session.flush(); counts['pairs'] += 1
                    who = PEOPLE[(order + i) % len(PEOPLE)]
                    for axis_key, (val, note, evidence, days) in assess.items():
                        axis = axes[axis_key]
                        if axis['kind'] == 'value':
                            if val is None:
                                continue                       # 값 없음 = 미검증(미평가)
                            rung, value = None, float(val)
                        elif axis['kind'] == 'matrix':
                            rung, value = None, None
                            rung, evidence = _modeling_seed(val, agent.defect_types, evidence, days)
                        else:
                            rung, value = val, None
                        a = MaturityAssessment(pair_id=pair.id, axis=axis_key, rung=rung, value=value,
                                               note=note or f'{who} 평가', evidence=evidence or {},
                                               assessed_at=_days_ago(days), assessed_by_name=who)
                        db.session.add(a); counts['assessments'] += 1
                        # 이력이 따로 없으면 「처음 매긴 날」 한 줄
                        if not any(h[2] == (rung or f'{value:g}') for h in history if h):
                            c = MaturityChange(pair_id=pair.id, axis=axis_key, before=None,
                                               after=(rung or f'{value:g}'), note=note or '', actor_name=who)
                            db.session.add(c); db.session.flush()
                            c.created_at = _days_ago(days); counts['changes'] += 1
                    for (days, before, after, note) in history:
                        axis_key = next((k for k, ax in axes.items()
                                         if (ax['kind'] == 'rung' and after in D.rung_keys(ax))
                                         or (ax['kind'] == 'set' and D.set_flags(ax, after) is not None)), None)
                        if not axis_key:
                            continue
                        c = MaturityChange(pair_id=pair.id, axis=axis_key, before=before, after=after,
                                           note=note or '', actor_name=who)
                        db.session.add(c); db.session.flush()
                        c.created_at = _days_ago(days); counts['changes'] += 1
        counts['reviews'] = _seed_reviews(divisions)          # 검토 대장 — 스팟 건
        db.session.commit()
        print(f'지운 시험 {n_old}개 → 넣음:', counts)
        for dname, div in divisions.items():
            n = MaturitySubject.query.filter_by(division_id=div.id).count()
            print(f'  {dname}: 시험 {n}')




# ── 검토 대장 씨앗 — 사업부마다 올해·작년 스팟 건 몇 개(2026-08-28) ──────────
REVIEW_SEED = {
    'MX': [
        ('2026-02', 'spec', 'Galaxy Z Fold8', '힌지 강성 스펙', '폴딩 응력 해석', 'before_spec', 'gate', 'margin', 4, '힌지 두께 0.2mm 축소 결정'),
        ('2026-03', 'spec', 'Galaxy Z Fold8', '힌지 강성 스펙', '폴딩 응력 해석', 'before_spec', 'gate', 'margin', 3, ''),
        ('2026-05', 'spec', 'Galaxy S27', '힌지 강성 스펙', '폴딩 응력 해석', 'review_meeting', 'change_basis', 'trend', 5, ''),
        ('2026-04', 'spec', 'Galaxy S27', '방열 마진', '열 해석 (정상상태)', 'concept', 'rule', 'confirmed', 2, '방열 시트 두께 규칙화'),
        ('2026-06', 'cause', 'QM #4412', '커버 글라스 크랙', '낙하 구조 해석', 'after_issue', 'change_basis', 'confirmed', 6, '코너 R 확대'),
        ('2026-07', 'cause', 'QM #4501', '배터리 스웰링 변형', '셀 팽창 구조 해석', 'after_issue', 'reference', 'trend', 8, ''),
        ('2025-11', 'spec', 'Galaxy Z Flip7', '힌지 강성 스펙', '폴딩 응력 해석', 'review_meeting', 'change_basis', 'margin', 4, ''),
    ],
    'VD': [
        ('2026-01', 'spec', 'Neo QLED 98', '스탠드 처짐 스펙', '스탠드 구조 해석', 'before_spec', 'gate', 'margin', 3, ''),
        ('2026-03', 'spec', 'Neo QLED 98', '전원 보드 온도 스펙', '전원 보드 열 해석', 'review_meeting', 'change_basis', 'margin', 5, ''),
        ('2026-05', 'cause', 'QM #2201', '무라', '패널 열-구조 연성 해석', 'after_issue', 'change_basis', 'confirmed', 9, ''),
    ],
    '생활가전': [
        ('2026-02', 'spec', '비스포크 AI 세탁기', '드럼 진동 스펙', '드럼 동역학 해석', 'before_spec', 'gate', 'confirmed', 4, ''),
        ('2026-04', 'spec', '비스포크 냉장고', '냉기 분배 스펙', '냉기 유동 해석', 'concept', 'change_basis', 'trend', 6, ''),
        ('2026-06', 'cause', 'QM #3310', '결로', '실내 기류 해석', 'after_issue', 'change_basis', 'margin', 5, ''),
        ('2026-07', 'cause', 'QM #3355', '드럼 편심 진동', '드럼 동역학 해석', 'after_issue', 'reference', 'trend', 3, ''),
    ],
    'NW': [
        ('2026-03', 'spec', 'RU 6G', '방열 마진', 'RU 열 해석', 'before_spec', 'gate', 'margin', 7, ''),
        ('2026-05', 'cause', 'FI #880', '외함 부식', '부식 예측 모델', 'after_issue', 'reference', 'trend', 12, ''),
    ],
    '의료기기': [
        ('2026-02', 'spec', 'RS90', '프로브 온도 스펙', '프로브 열 해석', 'before_spec', 'gate', 'confirmed', 3, ''),
        ('2026-06', 'cause', 'QM #120', '케이블 단선', '케이블 피로 해석', 'after_issue', 'change_basis', 'confirmed', 7, ''),
    ],
}


def _seed_reviews(divisions):
    from datetime import date as _date
    n = 0
    for dname, rows in REVIEW_SEED.items():
        div = divisions.get(dname)
        if not div:
            continue
        for (ym, kind, target, item, agent_name, timing, decision, basis, lead, note) in rows:
            agent = MaturityAgent.query.filter_by(division_id=div.id, name=agent_name).first()
            y, m = ym.split('-')
            db.session.add(MaturityReviewCase(
                division_id=div.id, kind=kind, month=_date(int(y), int(m), 1), target=target, item=item,
                agent_id=agent.id if agent else None, agent_name=agent_name, timing=timing, decision=decision,
                basis=basis, lead_days=lead, note=note or None, actor_name=PEOPLE[n % len(PEOPLE)]))
            n += 1
    return n

if __name__ == '__main__':
    main()
