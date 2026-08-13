// 새로운 분리된 데이터 구조의 샘플 데이터
// metadata, projects, performances 분리 구조

// 시스템 설정 데이터 import
import systemSettingData from '../../../option/systemsetting.json';

// ============== 샘플 데이터 ==============
// 프로젝트와 성과 데이터는 /src/sample/option.json에서 로드됩니다.
// 여기서는 앱 초기화에 필요한 설정만 export합니다.

// ============== 샘플 메타데이터 ==============

export const sampleMetadata = {
  version: '2.1',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  projectCount: 0,
  performanceCount: 0,
  lastBackupDate: null,
  settings: {
    currentYear: 2025,
    viewMode: 'dashboard',
    autoSave: true
  }
};

// ============== 색상 설정 ==============

export const STATUS_COLORS = {
  '완료': '#3b82f6',
  '정상진행': '#eab308',
  '지연': '#ef4444',
  '미착수': '#9ca3af',
  '미배정': '#9ca3af',
  '계획': '#8b5cf6',
  '취소': '#374151'
};

export const DIVISION_COLORS = {
  'MX': '#06b6d4',
  'VD': '#8b5cf6',
  'DA': '#ef4444',
  'NW': '#059669',
  '의료기기': '#10b981',
  'GTR': '#f97316',
  'SR': '#ec4899',
  'CS': '#14b8a6'
};

// ============== 시스템 설정 데이터 ==============

// 시스템 설정 데이터를 JSON 파일에서 불러와서 export
export const settingsData = systemSettingData;
