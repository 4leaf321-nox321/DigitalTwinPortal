// Digital Twin Dashboard 데이터 구조
export const digitalTwinSolutionData = {
  // 사업부/도메인 정의 (기존 sectors)
  sectors: [
    {
      id: 'manufacturing',
      name: 'Manufacturing',
      color: '#3B82F6', // 블루
      description: '제조업 디지털 트윈 솔루션',
      order: 0
    },
    {
      id: 'infrastructure',
      name: 'Infrastructure',
      color: '#10B981', // 그린
      description: '인프라 디지털 트윈 솔루션',
      order: 1
    },
    {
      id: 'automotive',
      name: 'Automotive',
      color: '#F59E0B', // 옐로우
      description: '자동차 산업 디지털 트윈 솔루션',
      order: 2
    },
    {
      id: 'healthcare',
      name: 'Healthcare',
      color: '#EF4444', // 레드
      description: '헬스케어 디지털 트윈 솔루션',
      order: 3
    },
    {
      id: 'energy',
      name: 'Energy',
      color: '#8B5CF6', // 퍼플
      description: '에너지 산업 디지털 트윈 솔루션',
      order: 4
    },
    {
      id: 'aerospace',
      name: 'Aerospace',
      color: '#06B6D4', // 시안
      description: '항공우주 산업 디지털 트윈 솔루션',
      order: 5
    }
  ],

  // 진행상태/성숙도 링 정의 (기존 rings)
  rings: [
    {
      id: 'adopt',
      name: 'Adopt',
      color: '#10B981',
      radius: 130,
      description: '즉시 채택 권장 - 검증된 성숙한 솔루션',
      order: 0
    },
    {
      id: 'trial',
      name: 'Trial',
      color: '#3B82F6',
      radius: 200,
      description: '시험 적용 권장 - 유망한 솔루션',
      order: 1
    },
    {
      id: 'assess',
      name: 'Assess',
      color: '#F59E0B',
      radius: 270,
      description: '관찰·검토 필요 - 잠재력 있는 솔루션',
      order: 2
    },
    {
      id: 'hold',
      name: 'Hold',
      color: '#EF4444',
      radius: 340,
      description: '보류/채택 비권장 - 신중한 검토 필요',
      order: 3
    }
  ],

  // 대분류 정의 (새로 추가)
  categories: [
    {
      id: 'platform',
      name: '플랫폼 솔루션',
      description: '종합적인 디지털 트윈 플랫폼',
      order: 0
    },
    {
      id: 'simulation',
      name: '시뮬레이션 도구',
      description: '시뮬레이션 및 모델링 전문 도구',
      order: 1
    },
    {
      id: 'iot',
      name: 'IoT 연동 솔루션',
      description: 'IoT 기반 데이터 수집 및 연동',
      order: 2
    },
    {
      id: 'ai',
      name: 'AI/ML 기반 솔루션',
      description: '인공지능 및 머신러닝 기반',
      order: 3
    },
    {
      id: 'visualization',
      name: '시각화 도구',
      description: '3D 모델링 및 시각화 전문',
      order: 4
    },
    {
      id: 'analytics',
      name: '분석 솔루션',
      description: '데이터 분석 및 인사이트 도출',
      order: 5
    }
  ],

  // 소분류 정의 (새로 추가)
  subcategories: [
    {
      id: 'cloud_platform',
      name: '클라우드 플랫폼',
      categoryId: 'platform',
      description: '클라우드 기반 통합 플랫폼',
      order: 0
    },
    {
      id: 'on_premise',
      name: '온프레미스 솔루션',
      categoryId: 'platform', 
      description: '자체 서버 기반 플랫폼',
      order: 1
    },
    {
      id: 'cad_simulation',
      name: 'CAD/CAE 시뮬레이션',
      categoryId: 'simulation',
      description: '설계 및 해석 시뮬레이션',
      order: 2
    },
    {
      id: 'physics_simulation',
      name: '물리 시뮬레이션',
      categoryId: 'simulation',
      description: '물리 현상 기반 시뮬레이션',
      order: 3
    },
    {
      id: 'sensor_integration',
      name: '센서 통합',
      categoryId: 'iot',
      description: '다양한 센서 데이터 통합',
      order: 4
    },
    {
      id: 'edge_computing',
      name: '엣지 컴퓨팅',
      categoryId: 'iot',
      description: '엣지 디바이스 기반 처리',
      order: 5
    },
    {
      id: 'predictive_analytics',
      name: '예측 분석',
      categoryId: 'ai',
      description: 'AI 기반 예측 및 분석',
      order: 6
    },
    {
      id: 'computer_vision',
      name: '컴퓨터 비전',
      categoryId: 'ai',
      description: '이미지/영상 기반 AI',
      order: 7
    },
    {
      id: '3d_modeling',
      name: '3D 모델링',
      categoryId: 'visualization',
      description: '3차원 모델 생성 및 렌더링',
      order: 8
    },
    {
      id: 'ar_vr',
      name: 'AR/VR',
      categoryId: 'visualization',
      description: '증강/가상 현실 기술',
      order: 9
    },
    {
      id: 'dashboard',
      name: '대시보드',
      categoryId: 'analytics',
      description: '실시간 모니터링 대시보드',
      order: 10
    },
    {
      id: 'reporting',
      name: '리포팅',
      categoryId: 'analytics',
      description: '분석 리포트 및 인사이트',
      order: 11
    }
  ],

  // 과제목표 정의 (새로 추가)
  objectives: [
    {
      id: 'efficiency',
      name: '운영 효율성 향상',
      description: '프로세스 최적화를 통한 효율성 개선',
      order: 0
    },
    {
      id: 'cost_reduction',
      name: '비용 절감',
      description: '운영비 및 유지보수 비용 절감',
      order: 1
    },
    {
      id: 'predictive_maintenance',
      name: '예측 유지보수',
      description: '장비 고장 예측 및 사전 대응',
      order: 2
    },
    {
      id: 'quality_improvement',
      name: '품질 향상',
      description: '제품/서비스 품질 개선',
      order: 3
    },
    {
      id: 'safety_enhancement',
      name: '안전성 강화',
      description: '작업자 및 시설 안전 개선',
      order: 4
    },
    {
      id: 'innovation',
      name: '혁신 추진',
      description: '새로운 기술 도입 및 혁신',
      order: 5
    },
    {
      id: 'sustainability',
      name: '지속가능성',
      description: '환경 친화적 운영 및 ESG 경영',
      order: 6
    },
    {
      id: 'customer_experience',
      name: '고객 경험 개선',
      description: '서비스 품질 및 고객 만족도 향상',
      order: 7
    },
    {
      id: 'digital_transformation',
      name: '디지털 전환',
      description: '디지털 기술 도입 및 전환',
      order: 8
    },
    {
      id: 'competitiveness',
      name: '경쟁력 강화',
      description: '시장 경쟁력 및 우위 확보',
      order: 9
    }
  ],

  // 디지털 트윈 솔루션 목록 (확장)
  technologies: [
    // Manufacturing (제조업)
    {
      id: '1',
      name: 'ANSYS Twin Builder',
      sector: 'manufacturing',
      ring: 'adopt',
      category: 'simulation',
      subcategory: 'physics_simulation',
      objective: 'efficiency',
      description: '제조 공정 시뮬레이션 및 최적화를 위한 디지털 트윈 플랫폼',
      isAdopted: true
    },
    {
      id: '2',
      name: 'Siemens NX',
      sector: 'manufacturing',
      ring: 'adopt',
      category: 'simulation',
      subcategory: 'cad_simulation',
      objective: 'quality_improvement',
      description: '제품 설계 및 제조 과정의 디지털 트윈 생성 도구',
      isAdopted: true
    },
    {
      id: '3',
      name: 'GE Predix',
      sector: 'manufacturing',
      ring: 'trial',
      category: 'platform',
      subcategory: 'cloud_platform',
      objective: 'digital_transformation',
      description: '산업용 IoT 및 디지털 트윈을 위한 클라우드 플랫폼',
      isAdopted: false
    },
    {
      id: '4',
      name: 'PTC ThingWorx',
      sector: 'manufacturing',
      ring: 'trial',
      category: 'iot',
      subcategory: 'sensor_integration',
      objective: 'predictive_maintenance',
      description: 'IoT 기반 디지털 트윈 애플리케이션 개발 플랫폼',
      isAdopted: true
    },
    {
      id: '5',
      name: 'Dassault SIMULIA',
      sector: 'manufacturing',
      ring: 'assess',
      category: 'simulation',
      subcategory: 'physics_simulation',
      objective: 'innovation',
      description: '복잡한 제조 시스템의 시뮬레이션 및 모델링',
      isAdopted: false
    },

    // Infrastructure (인프라)
    {
      id: '6',
      name: 'Bentley iTwin',
      sector: 'infrastructure',
      ring: 'adopt',
      category: 'platform',
      subcategory: 'cloud_platform',
      objective: 'efficiency',
      description: '인프라 디지털 트윈 생성 및 관리 플랫폼',
      isAdopted: true
    },
    {
      id: '7',
      name: 'Autodesk BIM 360',
      sector: 'infrastructure',
      ring: 'adopt',
      category: 'visualization',
      subcategory: '3d_modeling',
      objective: 'quality_improvement',
      description: '건설 및 인프라 프로젝트의 디지털 트윈 관리',
      isAdopted: true
    },
    {
      id: '8',
      name: 'NVIDIA Omniverse',
      sector: 'infrastructure',
      ring: 'trial',
      category: 'visualization',
      subcategory: '3d_modeling',
      objective: 'innovation',
      description: '협업 기반 3D 디지털 트윈 시뮬레이션 플랫폼',
      isAdopted: false
    },
    {
      id: '9',
      name: 'Unity Reflect',
      sector: 'infrastructure',
      ring: 'assess',
      category: 'visualization',
      subcategory: 'ar_vr',
      objective: 'customer_experience',
      description: 'BIM 데이터를 활용한 실시간 3D 디지털 트윈',
      isAdopted: false
    },
    {
      id: '10',
      name: 'CityScope',
      sector: 'infrastructure',
      ring: 'assess',
      category: 'analytics',
      subcategory: 'dashboard',
      objective: 'sustainability',
      description: 'MIT 개발 도시 계획용 디지털 트윈 플랫폼',
      isAdopted: false
    },

    // Automotive (자동차)
    {
      id: '11',
      name: 'CARLA Simulator',
      sector: 'automotive',
      ring: 'adopt',
      category: 'simulation',
      subcategory: 'physics_simulation',
      objective: 'safety_enhancement',
      description: '자율주행차 개발을 위한 오픈소스 시뮬레이터',
      isAdopted: true
    },
    {
      id: '12',
      name: 'AVL CRUISE',
      sector: 'automotive',
      ring: 'adopt',
      category: 'simulation',
      subcategory: 'cad_simulation',
      objective: 'efficiency',
      description: '차량 시스템 시뮬레이션 및 최적화 도구',
      isAdopted: true
    },
    {
      id: '13',
      name: 'dSPACE VEOS',
      sector: 'automotive',
      ring: 'trial',
      category: 'simulation',
      subcategory: 'physics_simulation',
      objective: 'quality_improvement',
      description: '차량 ECU 및 소프트웨어 검증을 위한 가상 환경',
      isAdopted: true
    },
    {
      id: '14',
      name: 'IPG CarMaker',
      sector: 'automotive',
      ring: 'trial',
      category: 'simulation',
      subcategory: 'physics_simulation',
      objective: 'innovation',
      description: '차량 동역학 시뮬레이션 및 ADAS 테스트',
      isAdopted: false
    },
    {
      id: '15',
      name: 'Tesla FSD Beta',
      sector: 'automotive',
      ring: 'hold',
      category: 'ai',
      subcategory: 'computer_vision',
      objective: 'innovation',
      description: '완전 자율주행을 위한 디지털 트윈 기술',
      isAdopted: false
    },

    // Healthcare (헬스케어)
    {
      id: '16',
      name: 'Philips HealthSuite',
      sector: 'healthcare',
      ring: 'trial',
      category: 'platform',
      subcategory: 'cloud_platform',
      objective: 'customer_experience',
      description: '환자 데이터 기반 헬스케어 디지털 트윈',
      isAdopted: true
    },
    {
      id: '17',
      name: 'Dassault Living Heart',
      sector: 'healthcare',
      ring: 'assess',
      category: 'simulation',
      subcategory: 'physics_simulation',
      objective: 'innovation',
      description: '심장의 3D 디지털 트윈 모델링',
      isAdopted: false
    },
    {
      id: '18',
      name: 'GE Healthcare Edison',
      sector: 'healthcare',
      ring: 'assess',
      category: 'ai',
      subcategory: 'predictive_analytics',
      objective: 'quality_improvement',
      description: 'AI 기반 의료기기 디지털 트윈 플랫폼',
      isAdopted: false
    },
    {
      id: '19',
      name: 'Medtronic CareLink',
      sector: 'healthcare',
      ring: 'trial',
      category: 'iot',
      subcategory: 'sensor_integration',
      objective: 'predictive_maintenance',
      description: '의료기기 원격 모니터링 및 디지털 트윈',
      isAdopted: true
    },
    {
      id: '20',
      name: 'Virtual Physiological Human',
      sector: 'healthcare',
      ring: 'hold',
      category: 'simulation',
      subcategory: 'physics_simulation',
      objective: 'innovation',
      description: '인체 전체의 가상 시뮬레이션 모델',
      isAdopted: false
    },

    // Energy (에너지)
    {
      id: '21',
      name: 'Schneider EcoStruxure',
      sector: 'energy',
      ring: 'adopt',
      category: 'platform',
      subcategory: 'cloud_platform',
      objective: 'sustainability',
      description: '에너지 관리 및 최적화를 위한 디지털 트윈',
      isAdopted: true
    },
    {
      id: '22',
      name: 'ABB Ability System 800xA',
      sector: 'energy',
      ring: 'adopt',
      category: 'analytics',
      subcategory: 'dashboard',
      objective: 'efficiency',
      description: '발전소 운영 최적화를 위한 디지털 트윈',
      isAdopted: true
    },
    {
      id: '23',
      name: 'GE Digital APM',
      sector: 'energy',
      ring: 'trial',
      category: 'ai',
      subcategory: 'predictive_analytics',
      objective: 'predictive_maintenance',
      description: '자산 성능 관리를 위한 디지털 트윈 솔루션',
      isAdopted: false
    },
    {
      id: '24',
      name: 'Siemens COMOS',
      sector: 'energy',
      ring: 'trial',
      category: 'simulation',
      subcategory: 'cad_simulation',
      objective: 'cost_reduction',
      description: '화학 플랜트 설계 및 운영 최적화',
      isAdopted: true
    },
    {
      id: '25',
      name: 'WindSim',
      sector: 'energy',
      ring: 'assess',
      category: 'simulation',
      subcategory: 'physics_simulation',
      objective: 'sustainability',
      description: '풍력 발전단지 설계 및 최적화 시뮬레이션',
      isAdopted: false
    },

    // Aerospace (항공우주)
    {
      id: '26',
      name: 'Boeing AnalytX',
      sector: 'aerospace',
      ring: 'trial',
      category: 'analytics',
      subcategory: 'reporting',
      objective: 'competitiveness',
      description: '항공기 성능 최적화를 위한 디지털 트윈',
      isAdopted: false
    },
    {
      id: '27',
      name: 'Airbus Skywise',
      sector: 'aerospace',
      ring: 'trial',
      category: 'ai',
      subcategory: 'predictive_analytics',
      objective: 'predictive_maintenance',
      description: '항공기 데이터 분석 및 예측 유지보수',
      isAdopted: true
    },
    {
      id: '28',
      name: 'NASA Digital Twin',
      sector: 'aerospace',
      ring: 'assess',
      category: 'simulation',
      subcategory: 'physics_simulation',
      objective: 'innovation',
      description: '우주선 및 위성의 디지털 트윈 기술',
      isAdopted: false
    },
    {
      id: '29',
      name: 'Rolls-Royce IntelligentEngine',
      sector: 'aerospace',
      ring: 'adopt',
      category: 'ai',
      subcategory: 'predictive_analytics',
      objective: 'predictive_maintenance',
      description: '항공기 엔진의 디지털 트윈 및 예측 분석',
      isAdopted: true
    },
    {
      id: '30',
      name: 'SpaceX Starship Simulation',
      sector: 'aerospace',
      ring: 'hold',
      category: 'simulation',
      subcategory: 'physics_simulation',
      objective: 'innovation',
      description: '차세대 우주선 개발을 위한 디지털 트윈',
      isAdopted: false
    }
  ]
};

export default digitalTwinSolutionData;
