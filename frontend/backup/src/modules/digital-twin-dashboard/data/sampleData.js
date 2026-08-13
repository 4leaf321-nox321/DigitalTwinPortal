// 디지털 트윈 과제 샘플 데이터 (11개 과제로 확장, GTR 추가)
// 과제 번호 형식: 사업부-번호 (예: VD-1, MX-2)
export const sampleProjects = [
  {
    id: 'VD-1',
    과제년도: 2025,
    사업부: 'VD',
    프로세스: '개발',
    과제구분: '신규 시뮬레이션 기법 개발',
    과제명: 'AI 기반 기구 부품 성능 예측 모듈 개발 (메타 모델)',
    시작: 1,
    종료: 12,
    진행상태: '지연',
    과제PL: '남규현',
    작성자: '최대수',
    과제상세설명: 'AI 모델 학습 데이터 부족으로 일부 지연 발생',
    PoC과제여부: true,
    중점과제여부: false,
    과제참여인력목록: [
      { 이름: '남규현', 부서: 'Mecha Solution(VD)' },
      { 이름: '김AI', 부서: 'Mecha Solution(VD)' },
      { 이름: '박예측', 부서: 'Data Science Team' }
    ],
    담당부서목록: ['Mecha Solution(VD)', 'Data Science Team'],
    성과목록: [
      {
        대분류: '리드타임단축',
        소분류: '검증·분석시간',
        성과항목: 'AI 예측으로 인한 설계 검증 시간 단축',
        과제기여도: '80',
        현재수준: '120',
        목표수준: '60',
        실적수준: '95',
        단위: 'hours'
      },
      {
        대분류: '품질향상',
        소분류: '불량률 감소',
        성과항목: '조기 검증으로 인한 결함률 감소',
        과제기여도: '70',
        현재수준: '5200',
        목표수준: '2800',
        실적수준: '3500',
        단위: 'ppm'
      }
    ],
    액션아이템목록: [
      {
        id: 'action_VD-1_1',
        제목: '학습 데이터 수집 및 전처리',
        완료여부: false
      },
      {
        id: 'action_VD-1_2',
        제목: 'AI 모델 아키텍처 설계',
        완료여부: true
      },
      {
        id: 'action_VD-1_3',
        제목: '예측 모델 성능 검증',
        완료여부: false
      },
      {
        id: 'action_VD-1_4',
        제목: '실제 프로젝트 적용 테스트',
        완료여부: false
      }
    ]
  },
  {
    id: 'VD-2',
    과제년도: 2025,
    사업부: 'VD',
    프로세스: '품질',
    과제구분: '조기 검증 체계 구축',
    과제명: '품질 개선을 위한 조기 검증 시스템 구축',
    시작: 2,
    종료: 4,
    진행상태: '미배정',
    과제PL: '',
    작성자: '이승재',
    과제상세설명: '담당 PL 배정 대기 중',
    PoC과제여부: false,
    중점과제여부: true,
    과제참여인력목록: [
      { 이름: '박용진', 부서: 'Mecha 1Lab(VD)' },
      { 이름: '이승재', 부서: 'Mecha 2Lab(VD)' },
      { 이름: '김품질', 부서: 'Quality Team' }
    ],
    담당부서목록: ['Mecha 1Lab(VD)', 'Mecha 2Lab(VD)', 'Quality Team'],
    성과목록: [
      {
        대분류: '품질향상',
        소분류: '불량률 감소',
        성과항목: '조기 검증으로 인한 결함률 감소',
        과제기여도: '30',
        현재수준: '5200',
        목표수준: '2800',
        실적수준: '',
        단위: 'ppm'
      }
    ],
    액션아이템목록: [
      {
        id: 'action_VD-2_1',
        제목: 'PL 및 팀원 배정',
        완료여부: false
      },
      {
        id: 'action_VD-2_2',
        제목: '현재 검증 프로세스 분석',
        완료여부: false
      }
    ]
  },
  {
    id: 'MX-1',
    과제년도: 2025,
    사업부: 'MX',
    프로세스: '개발',
    과제구분: '기존 기법 정확도/정합성 개선',
    과제명: '시뮬레이션 고도화 과제',
    시작: 3,
    종료: 9,
    진행상태: '미착수',
    과제PL: '박용진',
    작성자: '이승재',
    과제상세설명: '3월 시작 예정',
    PoC과제여부: false,
    중점과제여부: false,
    과제참여인력목록: [
      { 이름: '박용진', 부서: 'Mecha 2Lab(VD)' },
      { 이름: '강대영', 부서: 'Data Science Team' },
      { 이름: '이시뮬', 부서: 'Simulation Team' }
    ],
    담당부서목록: ['Mecha 2Lab(VD)', 'Data Science Team', 'Simulation Team'],
    성과목록: [
      {
        대분류: '기술혁신',
        소분류: '시뮬레이션 정확도',
        성과항목: '시뮬레이션 정확도 개선',
        과제기여도: '90',
        현재수준: '75',
        목표수준: '92',
        실적수준: '',
        단위: '%'
      }
    ],
    액션아이템목록: [
      {
        id: 'action_MX-1_1',
        제목: '킥오프 미팅 및 계획 수립',
        완료여부: false
      },
      {
        id: 'action_MX-1_2',
        제목: '현재 시뮬레이션 기법 분석',
        완료여부: false
      },
      {
        id: 'action_MX-1_3',
        제목: '개선 방안 연구',
        완료여부: false
      }
    ]
  },
  {
    id: 'MX-2',
    과제년도: 2025,
    사업부: 'MX',
    프로세스: '제조',
    과제구분: '시뮬레이션 자동화',
    과제명: '품질을 개선하기위해 여러 이상 감지를 할 수 있도록 IOT 데이터 수집을 자동화하는 과제',
    시작: 5,
    종료: 10,
    진행상태: '완료',
    과제PL: '박용진',
    작성자: '이승재',
    과제상세설명: '목표 대비 120% 성과 달성으로 조기 완료',
    PoC과제여부: true,
    중점과제여부: true,
    과제참여인력목록: [
      { 이름: '박용진', 부서: 'Mecha 1Lab(VD)' },
      { 이름: '김민수', 부서: 'Quality Team' },
      { 이름: '이지현', 부서: 'IoT Team' },
      { 이름: '정자동', 부서: 'Automation Team' }
    ],
    담당부서목록: ['Mecha 1Lab(VD)', 'Quality Team', 'IoT Team', 'Automation Team'],
    성과목록: [
      {
        대분류: '비용절감',
        소분류: '제조비 (인건비)',
        성과항목: 'IOT 자동화로 인한 인력 절감',
        과제기여도: '85',
        현재수준: '8',
        목표수준: '5',
        실적수준: '4.5',
        단위: '억원'
      },
      {
        대분류: '품질향상',
        소분류: '불량률 감소',
        성과항목: '이상 감지 시스템 도입으로 인한 품질 개선',
        과제기여도: '70',
        현재수준: '3200',
        목표수준: '1800',
        실적수준: '1650',
        단위: 'ppm'
      }
    ],
    액션아이템목록: [
      {
        id: 'action_MX-2_1',
        제목: 'IoT 센서 설치 및 테스트',
        완료여부: true
      },
      {
        id: 'action_MX-2_2',
        제목: '이상 감지 알고리즘 개발',
        완료여부: true
      },
      {
        id: 'action_MX-2_3',
        제목: '자동화 시스템 통합',
        완료여부: true
      },
      {
        id: 'action_MX-2_4',
        제목: '운영 매뉴얼 작성',
        완료여부: true
      }
    ]
  },
  {
    id: '의료기기-1',
    과제년도: 2025,
    사업부: '의료기기',
    프로세스: '개발',
    과제구분: '플랫폼 도입 및 적용 확대',
    과제명: 'SPDM(Smart Product Data Management) 플랫폼 구축',
    시작: 8,
    종료: 12,
    진행상태: '지연',
    과제PL: '박용진',
    작성자: '강대영',
    과제상세설명: '외부 업체와의 일정 조율 이슈로 지연',
    PoC과제여부: false,
    중점과제여부: true,
    과제참여인력목록: [
      { 이름: '박용진', 부서: 'Mecha 2Lab(VD)' },
      { 이름: '최민호', 부서: 'System Integration' },
      { 이름: '김플랫', 부서: 'Platform Team' }
    ],
    담당부서목록: ['Mecha 2Lab(VD)', 'System Integration', 'Platform Team'],
    성과목록: [
      {
        대분류: '비용절감',
        소분류: '개발비 (시료, 목업 등 자재비)',
        성과항목: 'SPDM 도입으로 인한 개발비용 절감',
        과제기여도: '60',
        현재수준: '10',
        목표수준: '8.5',
        실적수준: '9.2',
        단위: '억원'
      }
    ],
    액션아이템목록: [
      {
        id: 'action_의료기기-1_1',
        제목: '요구사항 정의 및 분석',
        완료여부: true
      },
      {
        id: 'action_의료기기-1_2',
        제목: '플랫폼 아키텍처 설계',
        완료여부: false
      },
      {
        id: 'action_의료기기-1_3',
        제목: '외부 시스템 연동 설계',
        완료여부: false
      },
      {
        id: 'action_의료기기-1_4',
        제목: '파일럿 시스템 구축',
        완료여부: false
      }
    ]
  },
  {
    id: 'DA-1',
    과제년도: 2025,
    사업부: 'DA',
    프로세스: '디자인',
    과제구분: '신규 프로세스 도입',
    과제명: '생성형 AI 기반 3D 모델링 자동화 시스템',
    시작: 1,
    종료: 8,
    진행상태: '정상진행',
    과제PL: '김창의',
    작성자: '박디자인',
    과제상세설명: '생성형 AI를 활용한 3D 모델 자동 생성 및 최적화',
    PoC과제여부: true,
    중점과제여부: false,
    과제참여인력목록: [
      { 이름: '김창의', 부서: 'Design AI Lab' },
      { 이름: '이모델링', 부서: '3D Modeling Team' },
      { 이름: '정자동화', 부서: 'Automation Team' },
      { 이름: '최생성AI', 부서: 'AI Research Lab' }
    ],
    담당부서목록: ['Design AI Lab', '3D Modeling Team', 'Automation Team'],
    성과목록: [
      {
        대분류: '리드타임단축',
        소분류: '제품설계시간',
        성과항목: '3D 모델링 자동화로 인한 설계 시간 단축',
        과제기여도: '75',
        현재수준: '480',
        목표수준: '240',
        실적수준: '320',
        단위: 'hours'
      },
      {
        대분류: '기술혁신',
        소분류: '시뮬레이션 정확도',
        성과항목: 'AI 생성 모델의 정확도',
        과제기여도: '85',
        현재수준: '65',
        목표수준: '85',
        실적수준: '78',
        단위: '%'
      }
    ],
    액션아이템목록: [
      {
        id: 'action_DA-1_1',
        제목: 'AI 모델 학습 데이터셋 구축',
        완료여부: true
      },
      {
        id: 'action_DA-1_2',
        제목: '생성형 AI 모델 개발',
        완료여부: true
      },
      {
        id: 'action_DA-1_3',
        제목: '3D 모델링 파이프라인 구축',
        완료여부: false
      },
      {
        id: 'action_DA-1_4',
        제목: '사용자 인터페이스 개발',
        완료여부: false
      }
    ]
  },
  {
    id: 'NW-1',
    과제년도: 2025,
    사업부: 'NW',
    프로세스: '연계',
    과제구분: '신규 프로세스 도입',
    과제명: '멀티클라우드 기반 데이터 통합 플랫폼 구축',
    시작: 3,
    종료: 11,
    진행상태: '정상진행',
    과제PL: '서클라우드',
    작성자: '김네트워크',
    과제상세설명: '다중 클라우드 환경에서 데이터 통합 관리',
    PoC과제여부: false,
    중점과제여부: true,
    과제참여인력목록: [
      { 이름: '서클라우드', 부서: 'Cloud Platform Team' },
      { 이름: '이데이터', 부서: 'Data Integration Team' },
      { 이름: '박보안', 부서: 'Security Team' },
      { 이름: '최운영', 부서: 'DevOps Team' }
    ],
    담당부서목록: ['Cloud Platform Team', 'Data Integration Team', 'Security Team'],
    성과목록: [
      {
        대분류: '비용절감',
        소분류: '제조비 (설비운영비)',
        성과항목: '클라우드 비용 최적화',
        과제기여도: '70',
        현재수준: '15',
        목표수준: '11',
        실적수준: '13',
        단위: '억원'
      },
      {
        대분류: '리드타임단축',
        소분류: '측정·검사시간',
        성과항목: '데이터 처리 속도 개선',
        과제기여도: '80',
        현재수준: '24',
        목표수준: '8',
        실적수준: '12',
        단위: 'hours'
      }
    ],
    액션아이템목록: [
      {
        id: 'action_NW-1_1',
        제목: '클라우드 아키텍처 설계',
        완료여부: true
      },
      {
        id: 'action_NW-1_2',
        제목: '데이터 파이프라인 구축',
        완료여부: true
      },
      {
        id: 'action_NW-1_3',
        제목: '보안 정책 수립 및 적용',
        완료여부: false
      },
      {
        id: 'action_NW-1_4',
        제목: '모니터링 시스템 구축',
        완료여부: false
      },
      {
        id: 'action_NW-1_5',
        제목: '성능 최적화 및 튜닝',
        완료여부: false
      }
    ]
  },
  {
    id: 'VD-3',
    과제년도: 2025,
    사업부: 'VD',
    프로세스: '제조',
    과제구분: '기존 프로세스 고도화',
    과제명: '디지털 트윈 기반 실시간 생산 최적화 시스템',
    시작: 4,
    종료: 12,
    진행상태: '정상진행',
    과제PL: '김디지털',
    작성자: '이트윈',
    과제상세설명: '실시간 생산 데이터를 활용한 디지털 트윈 구축',
    PoC과제여부: true,
    중점과제여부: true,
    과제참여인력목록: [
      { 이름: '김디지털', 부서: 'Digital Twin Lab' },
      { 이름: '이트윈', 부서: 'Manufacturing Team' },
      { 이름: '박실시간', 부서: 'Real-time Analytics' },
      { 이름: '정최적화', 부서: 'Optimization Team' }
    ],
    담당부서목록: ['Digital Twin Lab', 'Manufacturing Team', 'Real-time Analytics'],
    성과목록: [
      {
        대분류: '비용절감',
        소분류: '개발비 (금형제조비)',
        성과항목: '생산 최적화로 인한 재료비 절감',
        과제기여도: '65',
        현재수준: '25',
        목표수준: '20',
        실적수준: '22',
        단위: '억원'
      },
      {
        대분류: '제조성과',
        소분류: '설비정비율',
        성과항목: '디지털 트윈 기반 설비 가동률 향상',
        과제기여도: '80',
        현재수준: '92',
        목표수준: '96',
        실적수준: '94',
        단위: '%'
      }
    ],
    액션아이템목록: [
      {
        id: 'action_VD-3_1',
        제목: '생산 라인 센서 데이터 수집',
        완료여부: true
      },
      {
        id: 'action_VD-3_2',
        제목: '디지털 트윈 모델 구축',
        완료여부: true
      },
      {
        id: 'action_VD-3_3',
        제목: '실시간 최적화 알고리즘 개발',
        완료여부: false
      },
      {
        id: 'action_VD-3_4',
        제목: '제어 시스템 연동',
        완료여부: false
      }
    ]
  },
  {
    id: 'DA-2',
    과제년도: 2025,
    사업부: 'DA',
    프로세스: '품질',
    과제구분: '물성·측정 고도화',
    과제명: 'AR/VR 기반 품질 검사 시스템 고도화',
    시작: 6,
    종료: 10,
    진행상태: '취소',
    과제PL: '박가상',
    작성자: '김현실',
    과제상세설명: '예산 부족으로 과제 취소됨',
    PoC과제여부: false,
    중점과제여부: false,
    과제참여인력목록: [
      { 이름: '박가상', 부서: 'AR/VR Lab' },
      { 이름: '김현실', 부서: 'Quality Assurance' },
      { 이름: '이검사', 부서: 'Inspection Team' }
    ],
    담당부서목록: ['AR/VR Lab', 'Quality Assurance', 'Inspection Team'],
    성과목록: [
      {
        대분류: '기술혁신',
        소분류: '구현 건수',
        성과항목: 'AR/VR 검사 시스템 구현 건수',
        과제기여도: '90',
        현재수준: '2',
        목표수준: '5',
        실적수준: '',
        단위: '건'
      }
    ],
    액션아이템목록: [
      {
        id: 'action_DA-2_1',
        제목: 'AR/VR 하드웨어 선정',
        완료여부: true
      },
      {
        id: 'action_DA-2_2',
        제목: '검사 알고리즘 개발',
        완료여부: false
      },
      {
        id: 'action_DA-2_3',
        제목: '사용자 인터페이스 설계',
        완료여부: false
      }
    ]
  },
  {
    id: 'MX-3',
    과제년도: 2025,
    사업부: 'MX',
    프로세스: '연계',
    과제구분: '플랫폼 도입 및 적용 확대',
    과제명: '통합 ERP 시스템 연동 및 데이터 표준화',
    시작: 2,
    종료: 6,
    진행상태: '완료',
    과제PL: '정통합',
    작성자: '한표준',
    과제상세설명: '목표 기간 내 성공적으로 완료',
    PoC과제여부: false,
    중점과제여부: false,
    과제참여인력목록: [
      { 이름: '정통합', 부서: 'ERP Team' },
      { 이름: '한표준', 부서: 'Data Standards Team' },
      { 이름: '류연동', 부서: 'System Integration' },
      { 이름: '신데이터', 부서: 'Database Team' }
    ],
    담당부서목록: ['ERP Team', 'Data Standards Team', 'System Integration'],
    성과목록: [
      {
        대분류: '리드타임단축',
        소분류: '시험시간',
        성과항목: 'ERP 데이터 연동 시간 단축',
        과제기여도: '75',
        현재수준: '6',
        목표수준: '2',
        실적수준: '1.8',
        단위: 'hours'
      },
      {
        대분류: '비용절감',
        소분류: '품질·서비스비',
        성과항목: '데이터 관리 비용 절감',
        과제기여도: '60',
        현재수준: '8',
        목표수준: '6',
        실적수준: '5.5',
        단위: '억원'
      }
    ],
    액션아이템목록: [
      {
        id: 'action_MX-3_1',
        제목: '기존 시스템 분석',
        완료여부: true
      },
      {
        id: 'action_MX-3_2',
        제목: '데이터 매핑 및 표준화',
        완료여부: true
      },
      {
        id: 'action_MX-3_3',
        제목: 'API 연동 개발',
        완료여부: true
      },
      {
        id: 'action_MX-3_4',
        제목: '통합 테스트 및 검증',
        완료여부: true
      },
      {
        id: 'action_MX-3_5',
        제목: '운영 매뉴얼 작성',
        완료여부: true
      }
    ]
  },
  {
    id: 'GTR-1',
    과제년도: 2025,
    사업부: 'GTR',
    프로세스: '개발',
    과제구분: '신규 시뮬레이션 기법 개발',
    과제명: '양자 컴퓨팅 기반 복합재료 시뮬레이션 플랫폼 개발',
    시작: 7,
    종료: 12,
    진행상태: '정상진행',
    과제PL: '김양자',
    작성자: '박연구',
    과제상세설명: '차세대 양자 컴퓨팅 기술을 활용한 복합재료 특성 예측 시스템',
    PoC과제여부: true,
    중점과제여부: true,
    과제참여인력목록: [
      { 이름: '김양자', 부서: 'Quantum Computing Lab' },
      { 이름: '박연구', 부서: 'Advanced Materials Team' },
      { 이름: '이복합재', 부서: 'Composite Research Lab' },
      { 이름: '정시뮬', 부서: 'Simulation Technology Team' }
    ],
    담당부서목록: ['Quantum Computing Lab', 'Advanced Materials Team', 'Composite Research Lab'],
    성과목록: [
      {
        대분류: '기술혁신',
        소분류: '시뮬레이션 정확도',
        성과항목: '양자 시뮬레이션 정확도',
        과제기여도: '95',
        현재수준: '65',
        목표수준: '90',
        실적수준: '78',
        단위: '%'
      },
      {
        대분류: '리드타임단축',
        소분류: '검증·분석시간',
        성과항목: '복합재료 특성 분석 시간 단축',
        과제기여도: '80',
        현재수준: '168',
        목표수준: '48',
        실적수준: '96',
        단위: 'hours'
      }
    ],
    액션아이템목록: [
      {
        id: 'action_GTR-1_1',
        제목: '양자 알고리즘 설계 및 구현',
        완료여부: true
      },
      {
        id: 'action_GTR-1_2',
        제목: '복합재료 데이터베이스 구축',
        완료여부: true
      },
      {
        id: 'action_GTR-1_3',
        제목: '양자-클래식 하이브리드 시스템 구축',
        완료여부: false
      },
      {
        id: 'action_GTR-1_4',
        제목: '실제 재료 샘플 검증',
        완료여부: false
      },
      {
        id: 'action_GTR-1_5',
        제목: '상용화 가능성 평가',
        완료여부: false
      }
    ]
  }
];

// 과제 번호 생성 유틸리티 함수
export const generateNextProjectId = (projects, division) => {
  // 해당 사업부의 기존 과제들에서 최대 번호 찾기
  const divisionProjects = projects.filter(project => project.사업부 === division);
  const divisionNumbers = divisionProjects
    .map(project => {
      // ID가 문자열인지 확인하고 split 실행
      if (typeof project.id === 'string' && project.id.includes('-')) {
        const parts = project.id.split('-');
        return parts.length === 2 ? parseInt(parts[1], 10) : 0;
      }
      return 0; // 문자열이 아니거나 '-'가 없으면 0 반환
    })
    .filter(num => !isNaN(num));
  
  const maxNumber = divisionNumbers.length > 0 ? Math.max(...divisionNumbers) : 0;
  return `${division}-${maxNumber + 1}`;
};

// 액션 아이템 ID 생성 유틸리티 함수
export const generateNextActionItemId = (projectId, actionItems) => {
  const projectActionItems = actionItems.filter(item => item.id.startsWith(`action_${projectId}_`));
  const actionNumbers = projectActionItems
    .map(item => {
      const parts = item.id.split('_');
      return parts.length === 3 ? parseInt(parts[2], 10) : 0;
    })
    .filter(num => !isNaN(num));
  
  const maxNumber = actionNumbers.length > 0 ? Math.max(...actionNumbers) : 0;
  return `action_${projectId}_${maxNumber + 1}`;
};

// 월 이름 배열
export const MONTHS = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월'
];

// 상태별 색상 정의
export const STATUS_COLORS = {
  '완료': '#3b82f6',        // 파란색
  '정상진행': '#eab308',  // 노란색
  '지연': '#ef4444',        // 빨간색
  '미착수': '#9ca3af',     // 회색
  '미배정': '#9ca3af',     // 회색
  '계획': '#8b5cf6',        // 보라색
  '취소': '#374151'         // 아주 진한 회색
};

// 사업부별 색상 정의
export const DIVISION_COLORS = {
  'VD': '#8b5cf6',
  'MX': '#06b6d4',
  '의료기기': '#10b981',
  'DA': '#ef4444',
  'NW': '#059669',
  'GTR': '#f97316'
};

// 우선순위별 색상 정의
export const PRIORITY_COLORS = {
  '높음': '#ef4444',    // 빨간색
  '중간': '#eab308',    // 노란색
  '낮음': '#10b981'     // 초록색
};

// 리스크 확률별 색상 정의
export const RISK_PROBABILITY_COLORS = {
  '높음': '#ef4444',    // 빨간색
  '중간': '#eab308',    // 노란색
  '낮음': '#10b981'     // 초록색
};

// 리스크 영향도별 색상 정의
export const RISK_IMPACT_COLORS = {
  '높음': '#ef4444',    // 빨간색
  '중간': '#eab308',    // 노란색
  '낮음': '#10b981'     // 초록색
};

// 설정 데이터 구조
export const settingsData = {
  // 사업부
  divisions: [
    { id: 'mx', name: 'MX', color: '#06b6d4', description: 'Manufacturing Excellence 사업부', order: 0 },
    { id: 'vd', name: 'VD', color: '#8b5cf6', description: 'Vehicle Dynamics 사업부', order: 1 },
    { id: 'da', name: 'DA', color: '#ef4444', description: 'Design Analysis 사업부', order: 2 },
    { id: 'nw', name: 'NW', color: '#059669', description: 'Network 사업부', order: 3 },
    { id: 'medical', name: '의료기기', color: '#10b981', description: '의료기기 사업부', order: 4 },
    { id: 'gtr', name: 'GTR', color: '#f97316', description: 'Global Technology Research 사업부', order: 5 }
  ],
  
  // 진행상태
  statuses: [
    { id: 'completed', name: '완료', color: '#3b82f6', description: '과제가 완료됨', order: 0 },
    { id: 'normal', name: '정상진행', color: '#eab308', description: '정상적으로 진행중', order: 1 },
    { id: 'delayed', name: '지연', color: '#ef4444', description: '진행이 지연됨', order: 2 },
    { id: 'not_started', name: '미착수', color: '#9ca3af', description: '아직 시작하지 않음', order: 3 },
    { id: 'unassigned', name: '미배정', color: '#9ca3af', description: '담당자가 배정되지 않음', order: 4 },
    { id: 'planned', name: '계획', color: '#8b5cf6', description: '계획 단계', order: 5 },
    { id: 'cancelled', name: '취소', color: '#374151', description: '과제가 취소됨', order: 6 }
  ],
  
  // 프로세스 (기존 부문)
  processes: [
    { id: 'development', name: '개발', description: '신규 개발 과제', order: 0 },
    { id: 'manufacturing', name: '제조', description: '제조 관련 과제', order: 1 },
    { id: 'quality', name: '품질', description: '품질 개선 과제', order: 2 },
    { id: 'design', name: '디자인', description: '디자인 관련 과제', order: 3 },
    { id: 'liaison', name: '연계', description: '부서간 연계 과제', order: 4 }
  ],
  
  // 과제구분
  taskCategories: [
    { id: 'new_simulation_method', name: '신규 시뮬레이션 기법 개발', processId: 'development', description: '새로운 시뮬레이션 기법 연구 및 개발', order: 0 },
    { id: 'accuracy_improvement', name: '기존 기법 정확도/정합성 개선', processId: 'development', description: '기존 기법의 정확도 및 정합성 향상', order: 1 },
    { id: 'scope_expansion', name: '기존 기법 적용 범위 확대', processId: 'development', description: '기존 기법의 적용 영역 확장', order: 2 },
    { id: 'simulation_automation', name: '시뮬레이션 자동화', processId: 'manufacturing', description: '시뮬레이션 프로세스 자동화', order: 3 },
    { id: 'early_verification', name: '조기 검증 체계 구축', processId: 'quality', description: '조기 단계 검증 시스템 구축', order: 4 },
    { id: 'material_measurement', name: '물성·측정 고도화', processId: 'quality', description: '물성 측정 기술의 고도화', order: 5 },
    { id: 'new_process_intro', name: '신규 프로세스 도입', processId: 'design', description: '새로운 업무 프로세스 도입', order: 6 },
    { id: 'process_advancement', name: '기존 프로세스 고도화', processId: 'manufacturing', description: '기존 프로세스의 고도화 및 개선', order: 7 },
    { id: 'platform_adoption', name: '플랫폼 도입 및 적용 확대', processId: 'development', description: '플랫폼 기반 솔루션 도입 및 확대', order: 8 }
  ],
  
  // 소분류
  subcategories: [
    { id: 'simulation', name: '시뮬레이션', processId: 'development', description: '시뮬레이션 개발', order: 0 },
    { id: 'db_platform', name: 'DB 플랫폼', processId: 'development', description: '데이터베이스 플랫폼', order: 1 },
    { id: 'ai_ml', name: 'AI/ML', processId: 'development', description: '인공지능/머신러닝', order: 2 },
    { id: 'cad_modeling', name: 'CAD 모델링', processId: 'design', description: 'CAD 모델링 및 3D 디자인', order: 3 },
    { id: 'parametric_modeling', name: '파라메트릭 모델링', processId: 'design', description: '파라메트릭 모델링 시스템', order: 4 },
    { id: 'topology_optimization', name: '토폴로지 최적화', processId: 'design', description: '토폴로지 최적화 및 경량화', order: 5 },
    { id: 'design_automation', name: '디자인 자동화', processId: 'design', description: '디자인 프로세스 자동화', order: 6 },
    { id: 'automation', name: '자동화', processId: 'manufacturing', description: '제조 자동화', order: 7 },
    { id: 'optimization', name: '최적화', processId: 'manufacturing', description: '제조 공정 최적화', order: 8 },
    { id: 'anomaly_detection', name: '이상감지/조기개선', processId: 'quality', description: '이상 감지 시스템', order: 9 },
    { id: 'process_improvement', name: '프로세스 개선', processId: 'quality', description: '업무 프로세스 개선', order: 10 },
    { id: 'ar_vr', name: 'AR/VR', processId: 'quality', description: '증강현실/가상현실 기술', order: 11 },
    { id: 'cloud_platform', name: '클라우드 플랫폼', processId: 'liaison', description: '클라우드 기반 플랫폼', order: 12 },
    { id: 'digital_twin', name: '디지털 트윈', processId: 'manufacturing', description: '디지털 트윈 기술', order: 13 }
  ],
  
  // 성과 분류 (대분류)
  performanceCategories: [
    { id: 'lead_time', name: '리드타임단축', color: '#1e40af', description: '업무 처리 시간 단축', order: 0 },
    { id: 'cost_reduction', name: '비용절감', color: '#047857', description: '비용 절감 효과', order: 1 },
    { id: 'quality_improvement', name: '품질향상', color: '#d97706', description: '제품 및 서비스 품질 향상', order: 2 },
    { id: 'technology_innovation', name: '기술혁신', color: '#7c3aed', description: '기술적 혁신 성과', order: 3 },
    { id: 'manufacturing_performance', name: '제조성과', color: '#dc2626', description: '제조 관련 성과', order: 4 },
    { id: 'other', name: '기타', color: '#374151', description: '기타 성과', order: 5 }
  ],
  
  // 성과 소분류
  performanceSubcategories: [
    // 리드타임단축
    { id: 'product_design_time', name: '제품설계시간', categoryId: 'lead_time', description: '제품 설계 소요시간', order: 0 },
    { id: 'test_time', name: '시험시간', categoryId: 'lead_time', description: '시험 수행시간', order: 1 },
    { id: 'measurement_inspection_time', name: '측정·검사시간', categoryId: 'lead_time', description: '측정 및 검사 소요시간', order: 2 },
    { id: 'certification_time', name: '인증시간', categoryId: 'lead_time', description: '인증 절차 소요시간', order: 3 },
    { id: 'verification_analysis_time', name: '검증·분석시간', categoryId: 'lead_time', description: '검증 및 분석 소요시간', order: 4 },
    { id: 'process_design_time', name: '공정설계시간', categoryId: 'lead_time', description: '공정 설계 소요시간', order: 5 },
    { id: 'production_time', name: '생산시간', categoryId: 'lead_time', description: '생산 작업시간', order: 6 },
    { id: 'equipment_setup_time', name: '설비셋업시간', categoryId: 'lead_time', description: '설비 설정 및 준비시간', order: 7 },
    
    // 비용절감
    { id: 'development_cost', name: '개발비 (시료, 목업 등 자재비)', categoryId: 'cost_reduction', description: '개발 단계 자재비', order: 0 },
    { id: 'mold_cost', name: '개발비 (금형제조비)', categoryId: 'cost_reduction', description: '금형 제조비용', order: 1 },
    { id: 'labor_cost', name: '제조비 (인건비)', categoryId: 'cost_reduction', description: '제조 인건비', order: 2 },
    { id: 'facility_cost', name: '제조비 (설비운영비)', categoryId: 'cost_reduction', description: '설비 운영비용', order: 3 },
    { id: 'quality_service_cost', name: '품질·서비스비', categoryId: 'cost_reduction', description: '품질 및 서비스 비용', order: 4 },
    
    // 품질향상
    { id: 'defect_reduction', name: '불량률 감소', categoryId: 'quality_improvement', description: '제품 불량률 개선', order: 0 },
    
    // 기술혁신
    { id: 'simulation_accuracy', name: '시뮬레이션 정확도', categoryId: 'technology_innovation', description: '시뮬레이션 결과 정확도', order: 0 },
    { id: 'simulation_scope_expansion', name: '시뮬레이션 대상 확대', categoryId: 'technology_innovation', description: '시뮬레이션 적용 범위 확대', order: 1 },
    { id: 'system_registration_count', name: '시스템 등록 건수', categoryId: 'technology_innovation', description: '시스템에 등록된 항목 건수', order: 2 },
    { id: 'implementation_count', name: '구현 건수', categoryId: 'technology_innovation', description: '실제 구현된 항목 건수', order: 3 },
    
    // 제조성과
    { id: 'equipment_availability', name: '설비정비율', categoryId: 'manufacturing_performance', description: '설비 가동률 및 정비율', order: 0 },
    { id: 'data_connection_rate', name: '데이터연결률', categoryId: 'manufacturing_performance', description: '데이터 시스템 연결률', order: 1 },
    { id: 'production_per_person', name: '인당생산대수', categoryId: 'manufacturing_performance', description: '인당 생산량', order: 2 },
    { id: 'manufacturing_loss_rate', name: '제조유실율', categoryId: 'manufacturing_performance', description: '제조 과정 중 손실률', order: 3 },
    
    // 기타
    { id: 'other_performance', name: '기타 성과', categoryId: 'other', description: '분류되지 않은 기타 성과', order: 0 }
  ],
  
  // 성과 항목 템플릿 (미리 정의된 성과 항목들)
  performanceItems: [
    // AI 관련
    { id: 'ai_prediction_time_reduction', name: 'AI 예측으로 인한 설계 검증 시간 단축', subcategoryId: 'verification_analysis_time', unit: 'hours', currentLevel: '120', targetLevel: '60', actualLevel: '', description: 'AI 기반 예측 모델을 통한 설계 검증 시간 단축' },
    { id: 'ai_model_accuracy', name: 'AI 생성 모델의 정확도', subcategoryId: 'simulation_accuracy', unit: '%', currentLevel: '65', targetLevel: '85', actualLevel: '', description: 'AI 모델의 예측 정확도' },
    
    // 자동화 관련
    { id: 'iot_automation_labor_reduction', name: 'IOT 자동화로 인한 인력 절감', subcategoryId: 'labor_cost', unit: '억원', currentLevel: '8', targetLevel: '5', actualLevel: '', description: 'IoT 기반 자동화를 통한 인건비 절감' },
    { id: '3d_modeling_automation_time', name: '3D 모델링 자동화로 인한 설계 시간 단축', subcategoryId: 'product_design_time', unit: 'hours', currentLevel: '480', targetLevel: '240', actualLevel: '', description: '자동화된 3D 모델링을 통한 설계 시간 단축' },
    
    // 품질 관련
    { id: 'early_verification_defect_reduction', name: '조기 검증으로 인한 결함률 감소', subcategoryId: 'defect_reduction', unit: 'ppm', currentLevel: '5200', targetLevel: '2800', actualLevel: '', description: '조기 검증 시스템을 통한 제품 결함률 개선' },
    { id: 'anomaly_detection_quality', name: '이상 감지 시스템 도입으로 인한 품질 개선', subcategoryId: 'defect_reduction', unit: 'ppm', currentLevel: '3200', targetLevel: '1800', actualLevel: '', description: '이상 감지 시스템을 통한 품질 개선' },
    { id: 'ar_vr_inspection_implementation', name: 'AR/VR 검사 시스템 구현 건수', subcategoryId: 'implementation_count', unit: '건', currentLevel: '2', targetLevel: '5', actualLevel: '', description: 'AR/VR 기반 검사 시스템 구현 건수' },
    
    // 시뮬레이션 관련
    { id: 'simulation_accuracy_improvement', name: '시뮬레이션 정확도 개선', subcategoryId: 'simulation_accuracy', unit: '%', currentLevel: '75', targetLevel: '92', actualLevel: '', description: '기존 시뮬레이션 대비 정확도 향상' },
    { id: 'simulation_scope_expansion_count', name: '시뮬레이션 대상 확대 건수', subcategoryId: 'simulation_scope_expansion', unit: '건', currentLevel: '5', targetLevel: '12', actualLevel: '', description: '시뮬레이션 적용 대상 확대 건수' },
    { id: 'system_registration_improvement', name: '시스템 등록 건수 증가', subcategoryId: 'system_registration_count', unit: '건', currentLevel: '15', targetLevel: '25', actualLevel: '', description: '시스템에 등록된 항목 건수 증가' },
    { id: 'implementation_count_increase', name: '구현 건수 증가', subcategoryId: 'implementation_count', unit: '건', currentLevel: '3', targetLevel: '8', actualLevel: '', description: '실제 구현된 항목 건수 증가' },
    
    // 비용 절감 관련
    { id: 'spdm_development_cost_reduction', name: 'SPDM 도입으로 인한 개발비용 절감', subcategoryId: 'development_cost', unit: '억원', currentLevel: '10', targetLevel: '8.5', actualLevel: '', description: 'SPDM 플랫폼 도입을 통한 개발비 절감' },
    { id: 'production_optimization_material_cost', name: '생산 최적화로 인한 재료비 절감', subcategoryId: 'mold_cost', unit: '억원', currentLevel: '25', targetLevel: '20', actualLevel: '', description: '생산 공정 최적화를 통한 재료비 절감' },
    { id: 'cloud_cost_optimization', name: '클라우드 비용 최적화', subcategoryId: 'facility_cost', unit: '억원', currentLevel: '15', targetLevel: '11', actualLevel: '', description: '클라우드 인프라 비용 최적화' },
    { id: 'data_management_cost_reduction', name: '데이터 관리 비용 절감', subcategoryId: 'quality_service_cost', unit: '억원', currentLevel: '8', targetLevel: '6', actualLevel: '', description: '통합 데이터 관리를 통한 비용 절감' },
    
    // 시간 단축 관련
    { id: 'data_processing_speed_improvement', name: '데이터 처리 속도 개선', subcategoryId: 'measurement_inspection_time', unit: 'hours', currentLevel: '24', targetLevel: '8', actualLevel: '', description: '데이터 처리 및 분석 속도 개선' },
    { id: 'erp_integration_time_reduction', name: 'ERP 데이터 연동 시간 단축', subcategoryId: 'test_time', unit: 'hours', currentLevel: '6', targetLevel: '2', actualLevel: '', description: 'ERP 시스템 연동 시간 단축' },
    
    // 제조 성과 관련
    { id: 'equipment_availability_improvement', name: '설비 가동률 향상', subcategoryId: 'equipment_availability', unit: '%', currentLevel: '92', targetLevel: '96', actualLevel: '', description: '디지털 트윈 기반 설비 가동률 향상' },
    { id: 'data_connection_rate_improvement', name: '데이터 연결률 향상', subcategoryId: 'data_connection_rate', unit: '%', currentLevel: '85', targetLevel: '95', actualLevel: '', description: '시스템간 데이터 연결률 개선' },
    { id: 'production_per_person_improvement', name: '인당 생산대수 향상', subcategoryId: 'production_per_person', unit: '대/인', currentLevel: '12', targetLevel: '18', actualLevel: '', description: '작업자당 생산량 증대' },
    { id: 'manufacturing_loss_reduction', name: '제조 유실율 감소', subcategoryId: 'manufacturing_loss_rate', unit: '%', currentLevel: '2.5', targetLevel: '1.2', actualLevel: '', description: '제조 과정 중 손실률 감소' }
  ]
};
