export const sampleGraphData = {
  nodes: [
    {
      id: 'person_1',
      label: '김철수',
      type: 'person',
      properties: {
        age: 30,
        occupation: '소프트웨어 엔지니어',
        location: '서울',
        department: '개발팀'
      },
      size: 25
    },
    {
      id: 'person_2',
      label: '박영희',
      type: 'person',
      properties: {
        age: 28,
        occupation: '데이터 분석가',
        location: '부산',
        department: '분석팀'
      },
      size: 25
    },
    {
      id: 'company_1',
      label: '테크코프',
      type: 'company',
      properties: {
        industry: '정보기술',
        employees: 500,
        founded: 2015,
        location: '서울 강남구'
      },
      size: 35
    },
    {
      id: 'project_1',
      label: '지식그래프 시스템',
      type: 'project',
      properties: {
        status: '진행중',
        startDate: '2024-01-01',
        budget: 50000000,
        priority: 'high'
      },
      size: 30
    },
    {
      id: 'skill_1',
      label: 'React',
      type: 'skill',
      properties: {
        category: 'Frontend',
        difficulty: 'intermediate',
        popularity: 95
      },
      size: 20
    },
    {
      id: 'skill_2',
      label: 'Python',
      type: 'skill',
      properties: {
        category: 'Backend',
        difficulty: 'intermediate',
        popularity: 98
      },
      size: 20
    },
    {
      id: 'skill_3',
      label: 'D3.js',
      type: 'skill',
      properties: {
        category: 'Data Visualization',
        difficulty: 'advanced',
        popularity: 75
      },
      size: 20
    },
    {
      id: 'department_1',
      label: '개발부',
      type: 'department',
      properties: {
        headCount: 25,
        budget: 200000000,
        location: '본사 3층'
      },
      size: 30
    },
    {
      id: 'department_2',
      label: '분석부',
      type: 'department',
      properties: {
        headCount: 15,
        budget: 100000000,
        location: '본사 2층'
      },
      size: 25
    },
    {
      id: 'technology_1',
      label: 'Graph Database',
      type: 'technology',
      properties: {
        type: 'Database',
        maturity: 'emerging',
        adoptionRate: 25
      },
      size: 25
    }
  ],
  
  edges: [
    {
      id: 'edge_1',
      from: 'person_1',
      to: 'company_1',
      label: '근무',
      type: 'works_for',
      properties: {
        startDate: '2020-03-01',
        position: 'Senior Developer',
        salary: 6000
      },
      color: '#666',
      width: 2
    },
    {
      id: 'edge_2',
      from: 'person_2',
      to: 'company_1',
      label: '근무',
      type: 'works_for',
      properties: {
        startDate: '2021-06-15',
        position: 'Data Analyst',
        salary: 5500
      },
      color: '#666',
      width: 2
    },
    {
      id: 'edge_3',
      from: 'person_1',
      to: 'project_1',
      label: '참여',
      type: 'participates_in',
      properties: {
        role: 'Lead Developer',
        allocation: 80,
        startDate: '2024-01-01'
      },
      color: '#888',
      width: 2
    },
    {
      id: 'edge_4',
      from: 'person_2',
      to: 'project_1',
      label: '참여',
      type: 'participates_in',
      properties: {
        role: 'Data Analyst',
        allocation: 60,
        startDate: '2024-02-01'
      },
      color: '#888',
      width: 2
    },
    {
      id: 'edge_5',
      from: 'person_1',
      to: 'skill_1',
      label: '보유',
      type: 'has_skill',
      properties: {
        level: 'expert',
        experience: 5,
        certified: true
      },
      color: '#aaa',
      width: 1.5
    },
    {
      id: 'edge_6',
      from: 'person_1',
      to: 'skill_3',
      label: '보유',
      type: 'has_skill',
      properties: {
        level: 'intermediate',
        experience: 2,
        certified: false
      },
      color: '#aaa',
      width: 1.5
    },
    {
      id: 'edge_7',
      from: 'person_2',
      to: 'skill_2',
      label: '보유',
      type: 'has_skill',
      properties: {
        level: 'expert',
        experience: 4,
        certified: true
      },
      color: '#aaa',
      width: 1.5
    },
    {
      id: 'edge_8',
      from: 'person_1',
      to: 'department_1',
      label: '소속',
      type: 'belongs_to',
      properties: {
        joinDate: '2020-03-01',
        role: 'Senior Member'
      },
      color: '#777',
      width: 2
    },
    {
      id: 'edge_9',
      from: 'person_2',
      to: 'department_2',
      label: '소속',
      type: 'belongs_to',
      properties: {
        joinDate: '2021-06-15',
        role: 'Member'
      },
      color: '#777',
      width: 2
    },
    {
      id: 'edge_10',
      from: 'project_1',
      to: 'skill_3',
      label: '사용',
      type: 'uses_technology',
      properties: {
        importance: 'high',
        version: 'latest'
      },
      color: '#999',
      width: 1.5
    },
    {
      id: 'edge_11',
      from: 'project_1',
      to: 'technology_1',
      label: '활용',
      type: 'utilizes',
      properties: {
        implementation: 'core',
        percentage: 70
      },
      color: '#999',
      width: 2
    },
    {
      id: 'edge_12',
      from: 'department_1',
      to: 'company_1',
      label: '부서',
      type: 'part_of',
      properties: {
        established: '2015-01-01'
      },
      color: '#555',
      width: 3
    },
    {
      id: 'edge_13',
      from: 'department_2',
      to: 'company_1',
      label: '부서',
      type: 'part_of',
      properties: {
        established: '2017-06-01'
      },
      color: '#555',
      width: 3
    },
    {
      id: 'edge_14',
      from: 'person_1',
      to: 'person_2',
      label: '협업',
      type: 'collaborates_with',
      properties: {
        frequency: 'daily',
        projects: ['지식그래프 시스템'],
        relationship: 'colleague'
      },
      color: '#444',
      width: 1
    }
  ]
};

// 노드 타입별 기본 설정
export const nodeTypeConfig = {
  person: {
    color: '#FF6B6B',
    size: 25,
    shape: 'dot'
  },
  company: {
    color: '#4ECDC4',
    size: 35,
    shape: 'square'
  },
  project: {
    color: '#45B7D1',
    size: 30,
    shape: 'triangle'
  },
  skill: {
    color: '#96CEB4',
    size: 20,
    shape: 'dot'
  },
  department: {
    color: '#FECA57',
    size: 30,
    shape: 'diamond'
  },
  technology: {
    color: '#FF9FF3',
    size: 25,
    shape: 'star'
  }
};

// 엣지 타입별 기본 설정
export const edgeTypeConfig = {
  works_for: {
    color: '#666',
    width: 2,
    style: 'solid'
  },
  participates_in: {
    color: '#888',
    width: 2,
    style: 'solid'
  },
  has_skill: {
    color: '#aaa',
    width: 1.5,
    style: 'dashed'
  },
  belongs_to: {
    color: '#777',
    width: 2,
    style: 'solid'
  },
  uses_technology: {
    color: '#999',
    width: 1.5,
    style: 'dotted'
  },
  utilizes: {
    color: '#999',
    width: 2,
    style: 'solid'
  },
  part_of: {
    color: '#555',
    width: 3,
    style: 'solid'
  },
  collaborates_with: {
    color: '#444',
    width: 1,
    style: 'dashed'
  }
};