// 새로운 날짜 시스템 테스트용 유틸리티

import { debugDateRange } from './dateUtils.js';

// 테스트할 날짜 범위들
const testRanges = [
  {
    name: '2025년 전체',
    start: new Date('2025-01-01'),
    end: new Date('2025-12-31')
  },
  {
    name: '2025년 1~3월',
    start: new Date('2025-01-01'),
    end: new Date('2025-03-31')
  },
  {
    name: '2025년 10~12월',
    start: new Date('2025-10-01'),
    end: new Date('2025-12-31')
  },
  {
    name: '2024-2025년 연말연시',
    start: new Date('2024-12-01'),
    end: new Date('2025-02-28')
  },
  {
    name: '짧은 프로젝트 (1개월)',
    start: new Date('2025-06-15'),
    end: new Date('2025-07-20')
  }
];

// 모든 테스트 실행
export const runAllTests = () => {
  console.log('🧪 새로운 일 단위 기반 날짜 시스템 테스트 시작');
  console.log('===============================================');
  
  testRanges.forEach(range => {
    console.log(`\n📅 테스트: ${range.name}`);
    debugDateRange(range.start, range.end);
  });
  
  console.log('✅ 모든 테스트 완료');
};

// 특정 뷰 타입만 테스트
export const testSpecificView = (startDate, endDate, viewType) => {
  debugDateRange(startDate, endDate, viewType);
};

// 브라우저 콘솔에서 쉽게 테스트할 수 있도록
if (typeof window !== 'undefined') {
  window.testNewDateSystem = runAllTests;
  window.testSpecificView = testSpecificView;
}
