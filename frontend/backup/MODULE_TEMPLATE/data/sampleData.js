/**
 * [MODULE_NAME] 샘플 데이터
 * 
 * 개발 및 테스트용 샘플 데이터를 정의합니다.
 * 실제 프로덕션에서는 API에서 데이터를 가져와야 합니다.
 */

// 샘플 사용자 데이터
export const sampleUsers = [
  {
    id: 1,
    name: '김철수',
    email: 'kim@example.com',
    role: 'admin',
    status: 'active',
    createdAt: '2024-01-15T09:30:00Z'
  },
  {
    id: 2,
    name: '박영희',
    email: 'park@example.com',
    role: 'user',
    status: 'active',
    createdAt: '2024-02-20T14:15:00Z'
  },
  {
    id: 3,
    name: '이민수',
    email: 'lee@example.com',
    role: 'user',
    status: 'inactive',
    createdAt: '2024-03-10T11:45:00Z'
  }
];

// 샘플 항목 데이터
export const sampleItems = [
  {
    id: 'item-1',
    title: '첫 번째 항목',
    description: '이것은 첫 번째 샘플 항목입니다.',
    type: 'type-a',
    priority: 'high',
    value: 100,
    tags: ['중요', '긴급'],
    createdAt: '2024-08-01T10:00:00Z'
  },
  {
    id: 'item-2',
    title: '두 번째 항목',
    description: '이것은 두 번째 샘플 항목입니다.',
    type: 'type-b',
    priority: 'medium',
    value: 75,
    tags: ['일반'],
    createdAt: '2024-08-15T15:30:00Z'
  },
  {
    id: 'item-3',
    title: '세 번째 항목',
    description: '이것은 세 번째 샘플 항목입니다.',
    type: 'type-a',
    priority: 'low',
    value: 50,
    tags: ['참고'],
    createdAt: '2024-08-30T09:15:00Z'
  }
];

// 샘플 설정 데이터
export const sampleSettings = {
  theme: 'light',
  language: 'ko',
  notifications: {
    email: true,
    push: false,
    sms: false
  },
  preferences: {
    autoSave: true,
    showTips: true,
    compactView: false
  },
  limits: {
    maxItems: 1000,
    maxFileSize: 10485760, // 10MB
    maxUsers: 100
  }
};

// 샘플 통계 데이터
export const sampleStatistics = {
  totalItems: 156,
  activeUsers: 23,
  completedTasks: 89,
  pendingTasks: 34,
  monthlyGrowth: 12.5,
  trends: [
    { month: '1월', value: 45 },
    { month: '2월', value: 52 },
    { month: '3월', value: 48 },
    { month: '4월', value: 61 },
    { month: '5월', value: 55 },
    { month: '6월', value: 67 },
    { month: '7월', value: 73 },
    { month: '8월', value: 78 }
  ]
};

// 샘플 카테고리 데이터
export const sampleCategories = [
  {
    id: 'cat-1',
    name: '카테고리 A',
    color: '#3498db',
    description: '첫 번째 카테고리입니다.',
    count: 45
  },
  {
    id: 'cat-2',
    name: '카테고리 B',
    color: '#e74c3c',
    description: '두 번째 카테고리입니다.',
    count: 32
  },
  {
    id: 'cat-3',
    name: '카테고리 C',
    color: '#2ecc71',
    description: '세 번째 카테고리입니다.',
    count: 28
  }
];

// 전체 샘플 데이터 객체
export const sampleModuleData = {
  users: sampleUsers,
  items: sampleItems,
  settings: sampleSettings,
  statistics: sampleStatistics,
  categories: sampleCategories,
  lastUpdated: new Date().toISOString(),
  version: '1.0.0'
};

// 빈 데이터 템플릿
export const emptyModuleData = {
  users: [],
  items: [],
  settings: {
    theme: 'light',
    language: 'ko'
  },
  statistics: {
    totalItems: 0,
    activeUsers: 0
  },
  categories: [],
  lastUpdated: new Date().toISOString(),
  version: '1.0.0'
};

// 샘플 데이터 로딩 함수
export const loadSampleData = () => {
  console.log('📁 샘플 데이터 로딩...');
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log('✅ 샘플 데이터 로딩 완료');
      resolve(sampleModuleData);
    }, 1000);
  });
};

// 랜덤 샘플 데이터 생성
export const generateRandomData = (count = 10) => {
  const types = ['type-a', 'type-b', 'type-c'];
  const priorities = ['high', 'medium', 'low'];
  const statuses = ['active', 'inactive', 'pending'];
  
  const items = [];
  
  for (let i = 1; i <= count; i++) {
    items.push({
      id: `random-${i}`,
      title: `랜덤 항목 ${i}`,
      description: `자동 생성된 ${i}번째 항목입니다.`,
      type: types[Math.floor(Math.random() * types.length)],
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      value: Math.floor(Math.random() * 100) + 1,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
    });
  }
  
  return {
    items,
    totalCount: count,
    generatedAt: new Date().toISOString()
  };
};
