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
    MaturityAgent, MaturityAssessment, MaturityChange, MaturityPair, MaturitySubject,
)
from app.modules.digital_twin_dashboard.models import Division               # noqa: E402

NOW = datetime.now()
PEOPLE = ['김해석', '박시험', '이구조', '최열유동', '정데이터']

# ── 자료 ──────────────────────────────────────────────────────────────────
#
# 시험: (이름, 세부, 제품군, [시뮬레이션…])
# 시뮬레이션: (이름, 종류, 모델종류, {축: (칸|값, 근거, 증빙, 며칠 전)}, [이력 (며칠 전, 전, 후, 근거)…])
# 축 key 는 definitions.AXES['simulation'] 의 것. 값이 없는 축은 미평가로 남긴다.

def _s(name, kind, model, assess, history=()):
    return (name, kind, model, assess, list(history))


DATA = {
    'MX': [
        ('낙하 시험', '1.2m 6면 26모서리', ['S 시리즈', 'A 시리즈', 'Z 폴드'], [
            _s('낙하 구조 해석', '구조', 'physics',
               {'accuracy': (91, '25년 낙하 32건 비교, 파손 위치 일치율 91%', {'compared_tests': 32, 'error_pct': 6}, 20),
                'automation': ('post', '낙하 자세 24종 템플릿 + 보고서 자동', {'hours_per_run': 3}, 45),
                'modeling': ('multi', '유리 깨짐·프레임 휨·커넥터 이탈까지', {'phenomena': ['유리 깨짐', '프레임 휨', '커넥터 이탈']}, 45),
                'scope': ('all', '25년 출시 전 모델에 적용', {}, 45),
                'substitution': ('screening', '1차 시제 낙하 시험 3회 → 1회', {'tests_saved_per_year': 40}, 45)},
               [(400, None, 'pre', '메시 자동화'), (250, 'pre', 'run', '자세 템플릿'), (45, 'run', 'post', '보고서 자동')]),
            _s('낙하 파손 예측 모델', 'ML', 'data',
               {'accuracy': (84, '해석 결과 2,100건 학습, 파손 여부 정확도 84%', {'compared_tests': 120}, 30),
                'automation': ('pipeline', '설계 변경 → 파손 확률 자동 산출', {'hours_per_run': 0.2}, 30),
                'modeling': ('defect', '유리 깨짐 여부만', {'phenomena': ['유리 깨짐']}, 30),
                'scope': ('basic', '플래그십 기본 모델', {}, 30)},
               [(90, None, 'run', '초기 파이프라인'), (30, 'run', 'pipeline', '설계 변경 연동')]),
        ]),
        ('굽힘 시험', '3점 굽힘 1kN', ['S 시리즈', 'A 시리즈'], [
            _s('굽힘 강성 해석', '구조', 'physics',
               {'accuracy': (95, '강성 곡선 오차 5% 이내', {'compared_tests': 18, 'error_pct': 5}, 60),
                'automation': ('run', '', {'hours_per_run': 2}, 60),
                'modeling': ('performance', '강성·최대 변형', {}, 60),
                'scope': ('all', '', {}, 60),
                'substitution': ('certified_except', '인증 시험만 남김', {'tests_saved_per_year': 60}, 60)},
               [(300, None, 'partial', '일부 조건'), (60, 'partial', 'certified_except', '인증 외 전량 대체')]),
        ]),
        ('폴더블 힌지 내구', '20만 회 접힘', ['Z 폴드'], [
            _s('힌지 마모 해석', '구조', 'physics',
               {'accuracy': (72, '마모량 경향 일치, 절대값 오차 큼', {'compared_tests': 6, 'error_pct': 22}, 15),
                'automation': ('pre', '', {'hours_per_run': 16}, 15),
                'modeling': ('defect', '힌지 유격', {'phenomena': ['힌지 유격']}, 15),
                'scope': ('issue', '이슈 모델 2종', {}, 15),
                'substitution': ('reference', '', {}, 15)}),
            _s('폴딩 응력 해석', '구조', 'physics',
               {'accuracy': (88, '패널 응력 분포 일치', {'compared_tests': 9, 'error_pct': 9}, 15),
                'modeling': ('defect', '패널 주름', {'phenomena': ['패널 주름']}, 15)}),
        ]),
        ('발열 시험', '게임 30분 표면온도', ['S 시리즈', 'A 시리즈', 'Z 폴드'], [
            _s('열 해석 (정상상태)', '열', 'physics',
               {'accuracy': (89, '표면 최고온도 오차 ±2℃', {'compared_tests': 40, 'error_pct': 4}, 10),
                'automation': ('post', '', {'hours_per_run': 4}, 10),
                'modeling': ('multi', '핫스팟·스로틀링 시점', {'phenomena': ['핫스팟', '스로틀링']}, 10),
                'scope': ('all', '', {}, 10),
                'substitution': ('partial', '', {'tests_saved_per_year': 20}, 10)},
               [(200, None, 'reference', ''), (10, 'reference', 'partial', '온도 챔버 일부 조건 생략')]),
            _s('열 과도응답 예측', 'ML', 'hybrid',
               {'accuracy': (81, '30분 온도 곡선 RMSE 1.8℃', {'compared_tests': 25}, 10),
                'automation': ('run', '', {}, 10)}),
        ]),
        ('안테나 성능', 'OTA TRP/TIS', ['S 시리즈', 'A 시리즈'], [
            _s('안테나 전자기 해석', '전자기', 'physics',
               {'accuracy': (93, 'TRP 오차 0.5dB', {'compared_tests': 50, 'error_pct': 3}, 90),
                'automation': ('post', '', {'hours_per_run': 6}, 90),
                'modeling': ('performance', 'TRP·TIS', {}, 90),
                'scope': ('all', '', {}, 90),
                'substitution': ('screening', '', {'tests_saved_per_year': 80}, 90)}),
        ]),
        ('카메라 손떨림 보정', 'OIS 4축', ['S 시리즈'], [
            _s('OIS 진동 해석', '진동', 'physics',
               {'accuracy': (76, '공진 주파수 일치, 진폭 오차', {'compared_tests': 8, 'error_pct': 15}, 30),
                'modeling': ('performance', '', {}, 30),
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
                'modeling': ('defect', '후면 커버 들뜸', {'phenomena': ['커버 들뜸']}, 25),
                'automation': ('pre', '', {}, 25)}),
            _s('스웰링 수명 예측', 'ML', 'data',
               {'accuracy': (None, '', {}, 0)}),
        ]),
        ('스피커 음향', '주파수 응답', ['S 시리즈', 'A 시리즈'], [
            _s('음향 해석', '음향', 'physics',
               {'accuracy': (85, '', {'compared_tests': 20, 'error_pct': 8}, 40),
                'automation': ('run', '', {'hours_per_run': 5}, 40),
                'modeling': ('performance', '주파수 응답', {}, 40),
                'scope': ('derived_some', '', {}, 40),
                'substitution': ('partial', '', {'tests_saved_per_year': 15}, 40)}),
        ]),
        ('키 내구', '측면 키 50만 회', ['S 시리즈', 'A 시리즈'], [
            _s('돔 스위치 피로 해석', '구조', 'physics',
               {'accuracy': (None, '', {}, 0), 'automation': ('manual', '', {}, 100)}),
        ]),
        ('충전 발열', '25W 유선 충전', ['S 시리즈', 'A 시리즈'], [
            _s('충전 열 해석', '열', 'physics',
               {'accuracy': (87, '', {'compared_tests': 15, 'error_pct': 6}, 50),
                'automation': ('post', '', {}, 50), 'scope': ('all', '', {}, 50),
                'substitution': ('partial', '', {}, 50)}),
        ]),
        ('진동 시험', '수송 진동 프로파일', ['S 시리즈', 'A 시리즈', 'Z 폴드'], [
            _s('랜덤 진동 해석', '진동', 'physics',
               {'accuracy': (90, '', {'compared_tests': 22, 'error_pct': 7}, 35),
                'automation': ('run', '', {}, 35), 'modeling': ('defect', '납땜 크랙', {'phenomena': ['납땜 크랙']}, 35),
                'scope': ('all', '', {}, 35), 'substitution': ('screening', '', {'tests_saved_per_year': 30}, 35)}),
        ]),
    ],
    'VD': [
        ('패널 열변형', '65인치 4시간 점등', ['Neo QLED', 'OLED', 'Crystal UHD'], [
            _s('패널 열-구조 연성 해석', '열구조', 'physics',
               {'accuracy': (86, '휨량 오차 0.3mm', {'compared_tests': 14, 'error_pct': 9}, 30),
                'automation': ('run', '', {'hours_per_run': 8}, 30),
                'modeling': ('multi', '패널 휨·베젤 갭', {'phenomena': ['패널 휨', '베젤 갭']}, 30),
                'scope': ('derived_some', '', {}, 30), 'substitution': ('partial', '', {'tests_saved_per_year': 12}, 30)},
               [(150, None, 'reference', ''), (30, 'reference', 'partial', '')]),
        ]),
        ('백라이트 휘도 균일도', '9점 측정', ['Neo QLED', 'Crystal UHD'], [
            _s('광학 시뮬레이션', '광학', 'physics',
               {'accuracy': (92, '', {'compared_tests': 30, 'error_pct': 4}, 60),
                'automation': ('post', '', {}, 60), 'modeling': ('performance', '', {}, 60),
                'scope': ('all', '', {}, 60), 'substitution': ('certified_except', '', {'tests_saved_per_year': 50}, 60)}),
        ]),
        ('스탠드 하중', '전방 전도 10°', ['Neo QLED', 'OLED', 'Crystal UHD'], [
            _s('스탠드 구조 해석', '구조', 'physics',
               {'accuracy': (94, '', {'compared_tests': 25, 'error_pct': 5}, 45),
                'automation': ('post', '', {}, 45), 'scope': ('all', '', {}, 45),
                'substitution': ('full', '전도 시험 전량 대체', {'tests_saved_per_year': 90}, 45)},
               [(500, None, 'screening', ''), (200, 'screening', 'certified_except', ''), (45, 'certified_except', 'full', '인증 기관 합의')]),
        ]),
        ('스피커 음향', '내장 스피커 주파수 응답', ['Neo QLED', 'OLED'], [
            _s('TV 음향 해석', '음향', 'physics',
               {'accuracy': (80, '', {'compared_tests': 10, 'error_pct': 10}, 70),
                'automation': ('pre', '', {}, 70), 'modeling': ('performance', '', {}, 70)}),
        ]),
        ('낙하 포장 시험', '포장 상태 낙하 60cm', ['Neo QLED', 'OLED', 'Crystal UHD'], [
            _s('포장 완충 해석', '구조', 'physics',
               {'accuracy': (77, '', {'compared_tests': 8, 'error_pct': 14}, 440),
                'automation': ('manual', '', {'hours_per_run': 30}, 440), 'scope': ('basic', '', {}, 440)}),
        ]),
        ('벽걸이 마운트 강도', 'VESA 4배 하중', ['Neo QLED', 'OLED'], [
            _s('마운트 구조 해석', '구조', 'physics',
               {'accuracy': (96, '', {'compared_tests': 12, 'error_pct': 3}, 20),
                'automation': ('run', '', {}, 20), 'scope': ('all', '', {}, 20),
                'substitution': ('certified_except', '', {}, 20)}),
        ]),
        ('전원부 발열', '최대 밝기 8시간', ['Neo QLED', 'Crystal UHD'], [
            _s('전원 보드 열 해석', '열', 'physics',
               {'accuracy': (83, '', {'compared_tests': 16, 'error_pct': 7}, 40),
                'automation': ('run', '', {}, 40), 'modeling': ('defect', '커패시터 과열', {'phenomena': ['커패시터 과열']}, 40)}),
        ]),
        ('리모컨 낙하', '1m 낙하', ['공통'], [
            _s('리모컨 낙하 해석', '구조', 'physics', {'accuracy': (None, '', {}, 0)}),
        ]),
        ('화질 무라', '저계조 무라', ['OLED'], [
            _s('무라 예측 모델', 'ML', 'data',
               {'accuracy': (71, '패널 공정 데이터 기반', {'compared_tests': 200}, 25),
                'automation': ('pipeline', '', {}, 25), 'modeling': ('defect', '무라', {'phenomena': ['무라']}, 25),
                'scope': ('basic', '', {}, 25)}),
        ]),
        ('베젤 갭 조립', '4변 갭 편차', ['Neo QLED', 'OLED'], [
            _s('공차 해석', '공차', 'physics',
               {'accuracy': (88, '', {'compared_tests': 40, 'error_pct': 6}, 55),
                'automation': ('post', '', {}, 55), 'scope': ('all', '', {}, 55), 'substitution': ('screening', '', {}, 55)}),
        ]),
    ],
    'DA': [
        ('냉장고 단열 성능', '월 소비전력', ['비스포크 냉장고', '김치냉장고'], [
            _s('냉기 유동 해석', '유동', 'physics',
               {'accuracy': (82, '', {'compared_tests': 12, 'error_pct': 9}, 60),
                'automation': ('pre', '', {'hours_per_run': 40}, 60), 'modeling': ('performance', '', {}, 60),
                'scope': ('basic', '', {}, 60), 'substitution': ('reference', '', {}, 60)}),
        ]),
        ('세탁기 탈수 진동', '1400rpm 편심 부하', ['비스포크 세탁기', '드럼 세탁기'], [
            _s('드럼 동역학 해석', '동역학', 'physics',
               {'accuracy': (90, '', {'compared_tests': 28, 'error_pct': 6}, 30),
                'automation': ('run', '', {}, 30), 'modeling': ('multi', '워킹·소음', {'phenomena': ['워킹', '진동 소음']}, 30),
                'scope': ('all', '', {}, 30), 'substitution': ('screening', '', {'tests_saved_per_year': 25}, 30)},
               [(300, None, 'pre', ''), (30, 'pre', 'run', '')]),
            _s('진동 이상 예측', 'ML', 'data',
               {'accuracy': (78, '', {'compared_tests': 60}, 30), 'automation': ('pipeline', '', {}, 30)}),
        ]),
        ('모터 소음', '1m 거리 dB', ['비스포크 세탁기', '청소기'], [
            _s('모터 전자기-음향 해석', '음향', 'physics',
               {'accuracy': (74, '', {'compared_tests': 9, 'error_pct': 13}, 400),
                'automation': ('manual', '', {'hours_per_run': 60}, 400)}),
        ]),
        ('에어컨 냉방 능력', '정격 냉방', ['무풍 에어컨'], [
            _s('냉매 사이클 시뮬레이션', '시스템', 'physics',
               {'accuracy': (93, '', {'compared_tests': 35, 'error_pct': 4}, 45),
                'automation': ('post', '', {}, 45), 'scope': ('all', '', {}, 45), 'substitution': ('partial', '', {}, 45)}),
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
                'automation': ('run', '', {}, 35), 'scope': ('derived_some', '', {}, 35), 'substitution': ('partial', '', {}, 35)}),
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
                'automation': ('run', '', {}, 70), 'substitution': ('screening', '', {'tests_saved_per_year': 10}, 70)}),
        ]),
        ('인덕션 발열 분포', '냄비 바닥 온도', ['비스포크 인덕션'], [
            _s('유도 가열 전자기-열 해석', '전자기', 'physics',
               {'accuracy': (91, '', {'compared_tests': 18, 'error_pct': 5}, 40), 'automation': ('post', '', {}, 40),
                'scope': ('all', '', {}, 40), 'substitution': ('certified_except', '', {}, 40)}),
        ]),
    ],
    'NW': [
        ('기지국 방열', '55℃ 환경 최대 부하', ['5G RU', 'Massive MIMO'], [
            _s('RU 열 해석', '열', 'physics',
               {'accuracy': (88, '', {'compared_tests': 10, 'error_pct': 6}, 30),
                'automation': ('run', '', {}, 30), 'scope': ('all', '', {}, 30), 'substitution': ('partial', '', {}, 30)}),
        ]),
        ('철탑 진동', '풍하중 진동', ['5G RU'], [
            _s('풍하중 구조 해석', '구조', 'physics',
               {'accuracy': (None, '', {}, 0), 'automation': ('manual', '', {}, 80)}),
        ]),
        ('EMI 방출', 'CISPR 32', ['5G RU', 'Massive MIMO', '코어 장비'], [
            _s('EMI 전자기 해석', '전자기', 'physics',
               {'accuracy': (70, '', {'compared_tests': 6, 'error_pct': 18}, 25), 'modeling': ('performance', '', {}, 25)}),
        ]),
        ('안테나 빔 패턴', '빔포밍 이득', ['Massive MIMO'], [
            _s('어레이 안테나 해석', '전자기', 'physics',
               {'accuracy': (95, '', {'compared_tests': 20, 'error_pct': 3}, 40),
                'automation': ('post', '', {}, 40), 'scope': ('all', '', {}, 40), 'substitution': ('screening', '', {}, 40)}),
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
        db.session.flush()

        counts = {'subjects': 0, 'agents': 0, 'pairs': 0, 'assessments': 0, 'changes': 0}
        axes = {a['key']: a for a in D.AXES['simulation']}
        for dname, tests in DATA.items():
            div = divisions.get(dname)
            if not div:
                continue
            agents = {}
            for order, (tname, detail, families, sims) in enumerate(tests, 1):
                subject = MaturitySubject(division_id=div.id, sector='simulation', name=tname, detail=detail,
                                          product_families=families, accuracy_rule='auto', order=order)
                db.session.add(subject); db.session.flush(); counts['subjects'] += 1
                for i, (sname, kind, model, assess, history) in enumerate(sims):
                    agent = agents.get(sname)
                    if agent is None:
                        agent = MaturityAgent(division_id=div.id, sector='simulation', name=sname, kind=kind, model_kind=model)
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
                        else:
                            rung, value = val, None
                        a = MaturityAssessment(pair_id=pair.id, axis=axis_key, rung=rung, value=value,
                                               note=note or f'{who} 평가', evidence=evidence or {},
                                               assessed_at=_days_ago(days), assessed_by_name=who)
                        db.session.add(a); counts['assessments'] += 1
                        if axis_key == 'modeling':
                            S._grow_phenomena(div.id, (evidence or {}).get('phenomena') or [])   # 사업부 태그 사전
                        # 이력이 따로 없으면 「처음 매긴 날」 한 줄
                        if not any(h[2] == (rung or f'{value:g}') for h in history if h):
                            c = MaturityChange(pair_id=pair.id, axis=axis_key, before=None,
                                               after=(rung or f'{value:g}'), note=note or '', actor_name=who)
                            db.session.add(c); db.session.flush()
                            c.created_at = _days_ago(days); counts['changes'] += 1
                    for (days, before, after, note) in history:
                        axis_key = next((k for k, ax in axes.items()
                                         if ax['kind'] == 'rung' and after in D.rung_keys(ax)), None)
                        if not axis_key:
                            continue
                        c = MaturityChange(pair_id=pair.id, axis=axis_key, before=before, after=after,
                                           note=note or '', actor_name=who)
                        db.session.add(c); db.session.flush()
                        c.created_at = _days_ago(days); counts['changes'] += 1
        db.session.commit()
        print(f'지운 시험 {n_old}개 → 넣음:', counts)
        for dname, div in divisions.items():
            n = MaturitySubject.query.filter_by(division_id=div.id).count()
            print(f'  {dname}: 시험 {n}')


if __name__ == '__main__':
    main()
