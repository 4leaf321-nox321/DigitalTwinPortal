// 타입 설정 복원 스크립트
console.log('🔧 타입 설정 복원 시작...');

// 기본 타입 설정 정의
const defaultTypeSettings = {
  nodeTypes: [
    { id: 'person', label: 'Person', color: '#4CAF50' },
    { id: 'company', label: 'Company', color: '#2196F3' },
    { id: 'project', label: 'Project', color: '#FF9800' },
    { id: 'skill', label: 'Skill', color: '#9C27B0' },
    { id: 'department', label: 'Department', color: '#FF5722' },
    { id: 'technology', label: 'Technology', color: '#607D8B' },
    { id: 'team', label: 'Team', color: '#795548' },
    { id: 'product', label: 'Product', color: '#E91E63' },
    { id: 'service', label: 'Service', color: '#00BCD4' },
    { id: 'location', label: 'Location', color: '#8BC34A' },
    { id: 'unknown', label: 'Unknown', color: '#cccccc' }
  ],
  edgeTypes: [
    { id: 'works_for', label: '근무' },
    { id: 'participates_in', label: '참여' },
    { id: 'has_skill', label: '보유' },
    { id: 'belongs_to', label: '소속' },
    { id: 'uses_technology', label: '사용' },
    { id: 'utilizes', label: '활용' },
    { id: 'part_of', label: '부분' },
    { id: 'collaborates_with', label: '협업' },
    { id: 'unknown', label: '알 수 없음' }
  ]
};

// 로컬 스토리지에 기본 설정 저장
localStorage.setItem('knowledgeGraphTypeSettings', JSON.stringify(defaultTypeSettings));

console.log('✅ 기본 타입 설정이 복원되었습니다.');
console.log('🔄 페이지를 새로고침하세요.');

// 자동으로 새로고침
setTimeout(() => {
  location.reload();
}, 1000);