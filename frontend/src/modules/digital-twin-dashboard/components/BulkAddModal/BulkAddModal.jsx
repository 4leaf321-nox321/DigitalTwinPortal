import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { X, Database, Table, Copy, CheckCircle, AlertCircle, Info, Download, ChevronDown, Upload } from 'lucide-react';
import BulkEditTable from './components/BulkEditTable';
import ConfirmDialog from '../common/ConfirmDialog';
import AlertDialog from '../common/AlertDialog';
import { todayLocalYmd } from '../../../../shared/utils/localDate';
// 수준값의 0 과 미입력은 다른 뜻이다. `|| ''` 로 다루면 0 이 사라진다.
import { levelText } from '../../utils/levelValue';

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 1rem;
`;

const ModalContainer = styled.div`
  background: white;
  border-radius: 1rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  width: 95vw;
  max-width: 1800px;
  height: 90vh;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 2px solid #e5e7eb;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
`;

const ModalTitle = styled.h2`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  border-radius: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  
  &:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
  }
`;

const ModalContent = styled.div`
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const InfoBox = styled.div`
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 1px solid #93c5fd;
  border-radius: 0.75rem;
  padding: 1rem;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
`;

const InfoText = styled.div`
  flex: 1;
  
  h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: #1e40af;
  }
  
  p {
    margin: 0;
    font-size: 0.85rem;
    color: #1e40af;
    line-height: 1.4;
  }
`;

const TabContainer = styled.div`
  display: flex;
  border-bottom: 2px solid #e5e7eb;
  margin-bottom: 1rem;
`;

const Tab = styled.button`
  padding: 0.75rem 1.5rem;
  border: none;
  background: ${props => props.active ? '#8b5cf6' : 'transparent'};
  color: ${props => props.active ? 'white' : '#6b7280'};
  font-weight: ${props => props.active ? '600' : '500'};
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 0.5rem 0.5rem 0 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &:hover {
    background: ${props => props.active ? '#7c3aed' : '#f3f4f6'};
    color: ${props => props.active ? 'white' : '#374151'};
  }
`;

const TableContainer = styled.div`
  flex: 1;
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  overflow: hidden;
  background: #f9fafb;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-top: 2px solid #e5e7eb;
  background: #f9fafb;
  gap: 1rem;
`;

const LeftButtons = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const RightButtons = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid;
  
  &.primary {
    background: #8b5cf6;
    color: white;
    border-color: #7c3aed;
    
    &:hover {
      background: #7c3aed;
      border-color: #6d28d9;
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(139, 92, 246, 0.3);
    }
  }
  
  &.secondary {
    background: white;
    color: #6b7280;
    border-color: #d1d5db;
    
    &:hover {
      background: #f9fafb;
      border-color: #9ca3af;
      color: #374151;
    }
  }
  
  &.info {
    background: #3b82f6;
    color: white;
    border-color: #2563eb;
    
    &:hover {
      background: #2563eb;
      border-color: #1d4ed8;
    }
  }
`;

const StatusBar = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.875rem;
  color: #6b7280;
`;

const StatusItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;

  &.success {
    color: #059669;
  }

  &.error {
    color: #dc2626;
  }
`;

const InfoModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
  padding: 1rem;
`;

const InfoModalContainer = styled.div`
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  width: 90%;
  max-width: 600px;
  overflow: hidden;
`;

const InfoModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.5rem;
  border-bottom: 2px solid #e5e7eb;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
`;

const InfoModalTitle = styled.h3`
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const InfoModalClose = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  border-radius: 0.5rem;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
    border-color: rgba(255, 255, 255, 0.5);
  }
`;

const InfoModalBody = styled.div`
  padding: 1.5rem;
`;

const InfoContent = styled.div`
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 1px solid #93c5fd;
  border-radius: 0.5rem;
  padding: 1.25rem;

  h4 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    font-weight: 700;
    color: #1e40af;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  p {
    margin: 0;
    font-size: 0.875rem;
    color: #1e40af;
    line-height: 1.8;
    white-space: pre-line;
  }

  strong {
    font-weight: 700;
    color: #1e3a8a;
  }
`;

const InfoModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  padding: 1rem 1.5rem;
  border-top: 2px solid #e5e7eb;
  background: #f9fafb;
`;

const InfoModalButton = styled.button`
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #3b82f6;
  color: white;
  border: 1px solid #2563eb;

  &:hover {
    background: #2563eb;
    border-color: #1d4ed8;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3);
  }
`;

const DropdownContainer = styled.div`
  position: relative;
  display: inline-block;
`;

const DropdownMenu = styled.div`
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 0.25rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  z-index: 10;
  min-width: 200px;
  max-height: 300px;
  overflow-y: auto;
`;

const DropdownItem = styled.button`
  width: 100%;
  padding: 0.75rem 1rem;
  text-align: left;
  background: white;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  color: #374151;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    background: #f3f4f6;
    color: #1f2937;
  }

  &:first-child {
    border-top-left-radius: 0.5rem;
    border-top-right-radius: 0.5rem;
  }

  &:last-child {
    border-bottom-left-radius: 0.5rem;
    border-bottom-right-radius: 0.5rem;
  }
`;

// 동적 옵션을 위한 테이블 생성 함수
const createTables = (settingsData = {}) => {
  const performanceCategories = settingsData.performanceCategories || [];
  const performanceSubcategories = settingsData.performanceSubcategories || [];
  const divisions = settingsData.divisions || [];
  const processes = settingsData.processes || [];
  const projectDomains = settingsData.projectDomains || [];
  const taskCategories = settingsData.taskCategories || [];
  const statuses = settingsData.statuses || [];

  return [
  {
    id: 'globalPerformances',
    name: 'GLOBAL_PERFORMANCES',
    title: '성과 추가',
    description: '전체 성과 항목을 입력합니다',
    headers: [
      { key: 'uuid', label: 'UUID', required: false, type: 'text', width: '300px' },
      { key: 'id', label: 'id', required: false, type: 'text', width: '150px' },
      { key: '성과년도', label: '성과년도', required: true, type: 'number', width: '100px' },
      { key: '성과항목', label: '성과항목', required: true, type: 'text', width: '300px', placeholder: '"[사업부명] " 를 접두사로 추가하세요' },
      {
        key: '대분류',
        label: '대분류',
        required: true,
        type: 'select',
        width: '150px',
        options: [
          { value: '', label: '선택하세요' },
          ...performanceCategories.map(cat => ({ value: cat.name, label: cat.name }))
        ]
      },
      {
        key: '소분류',
        label: '소분류',
        required: false,
        type: 'select',
        width: '150px',
        dependsOn: '대분류', // 대분류 필드에 종속
        options: [
          { value: '', label: '선택하세요', parentValue: '' },
          ...performanceSubcategories.map(sub => {
            // 소분류가 속한 대분류의 name 찾기
            const parentCategory = performanceCategories.find(cat => cat.id === sub.categoryId);
            return {
              value: sub.name,
              label: sub.name,
              parentValue: parentCategory ? parentCategory.name : '' // 대분류 name으로 필터링
            };
          })
        ]
      },
      { key: '단위', label: '단위', required: false, type: 'text', width: '80px' },
      { key: '현재수준', label: '현재수준', required: false, type: 'number', width: '80px' },
      { key: '목표수준', label: '목표수준', required: false, type: 'number', width: '80px' },
      { key: '월별실적여부', label: '월별실적여부', required: false, type: 'boolean', width: '100px' },
      { key: '실적수준', label: '실적수준', required: false, type: 'number', width: '80px' },
      { key: '실적_1월', label: '실적_1월', required: false, type: 'number', width: '80px' },
      { key: '실적_2월', label: '실적_2월', required: false, type: 'number', width: '80px' },
      { key: '실적_3월', label: '실적_3월', required: false, type: 'number', width: '80px' },
      { key: '실적_4월', label: '실적_4월', required: false, type: 'number', width: '80px' },
      { key: '실적_5월', label: '실적_5월', required: false, type: 'number', width: '80px' },
      { key: '실적_6월', label: '실적_6월', required: false, type: 'number', width: '80px' },
      { key: '실적_7월', label: '실적_7월', required: false, type: 'number', width: '80px' },
      { key: '실적_8월', label: '실적_8월', required: false, type: 'number', width: '80px' },
      { key: '실적_9월', label: '실적_9월', required: false, type: 'number', width: '80px' },
      { key: '실적_10월', label: '실적_10월', required: false, type: 'number', width: '80px' },
      { key: '실적_11월', label: '실적_11월', required: false, type: 'number', width: '80px' },
      { key: '실적_12월', label: '실적_12월', required: false, type: 'number', width: '80px' },
      { key: '설명', label: '설명', required: false, type: 'text', width: '300px' }
    ]
  },
  {
    id: 'projects',
    name: 'PROJECTS',
    title: '과제 추가',
    description: '과제의 기본 정보를 입력합니다',
    headers: [
      { key: 'uuid', label: 'UUID', required: false, type: 'text', width: '300px' },
      { key: 'id', label: 'Project ID (사업부-번호)', required: true, type: 'text' },
      { key: '과제년도', label: '과제년도', required: true, type: 'number' },
      {
        key: '사업부',
        label: '사업부',
        required: true,
        type: 'select',
        width: '120px',
        options: [
          { value: '', label: '선택하세요' },
          ...divisions.map(div => ({ value: div.name, label: div.name }))
        ]
      },
      {
        key: '프로세스',
        label: '프로세스',
        required: true,
        type: 'select',
        width: '150px',
        options: [
          { value: '', label: '선택하세요' },
          ...processes.map(proc => ({ value: proc.name, label: proc.name }))
        ]
      },
      {
        key: '과제영역',
        label: '과제영역',
        required: false,
        type: 'select',
        width: '150px',
        options: [
          { value: '', label: '선택하세요' },
          ...projectDomains.map(domain => ({ value: domain.name, label: domain.name }))
        ]
      },
      {
        key: '과제구분',
        label: '과제구분',
        required: true,
        type: 'select',
        width: '200px',
        options: [
          { value: '', label: '선택하세요' },
          ...taskCategories.map(cat => ({ value: cat.name, label: cat.name }))
        ]
      },
      { key: '과제명', label: '과제명', required: true, type: 'text', width: '400px' },
      { key: '시작', label: '시작월', required: true, type: 'number' },
      { key: '종료', label: '종료월', required: true, type: 'number' },
      {
        key: '진행상태',
        label: '진행상태',
        required: true,
        type: 'select',
        width: '120px',
        options: [
          { value: '', label: '선택하세요' },
          ...statuses.map(status => ({ value: status.name, label: status.name }))
        ]
      },
      { key: '과제PL', label: '과제PL', required: false, type: 'text' },
      { key: '작성자', label: '작성자', required: true, type: 'text' },
      { key: '과제상세설명', label: '과제상세설명', required: false, type: 'text', width: '500px' },
      { key: 'PoC과제여부', label: 'PoC과제여부', required: false, type: 'boolean' },
      { key: '중점과제여부', label: '중점과제여부', required: false, type: 'boolean' }
    ]
  },
  {
    id: 'performances',
    name: 'PROJECT_PERFORMANCE_LINKS',
    title: '과제-성과 연결',
    description: '프로젝트와 성과 항목을 연결합니다',
    headers: [
      { key: 'project_id', label: 'Project ID (사업부-번호)', required: true, type: 'text', width: '150px' },
      { key: '과제명', label: '과제명', required: false, type: 'text', width: '300px' },
      { key: 'performance_id', label: 'Performance ID', required: true, type: 'text', width: '150px' },
      { key: '성과항목명', label: '성과항목명', required: false, type: 'text', width: '300px' },
      { key: '과제기여도', label: '과제기여도 (%)', required: false, type: 'number', width: '100px' }
    ]
  },
  {
    id: 'actionItems',
    name: 'ACTION_ITEMS',
    title: '과제 액션아이템 추가',
    description: '과제별 액션 아이템을 입력합니다',
    headers: [
      { key: 'project_id', label: 'Project ID (사업부-번호)', required: true, type: 'text', width: '150px' },
      { key: '제목', label: '제목', required: true, type: 'text' },
      { key: '완료여부', label: '완료여부', required: false, type: 'boolean', width: '100px' }
    ],
    enableReorder: true, // 순서 조정 가능
    groupBy: 'project_id' // project_id로 그룹핑
  },
  {
    id: 'teamMembers',
    name: 'TEAM_MEMBERS',
    title: '과제 멤버 추가',
    description: '과제별 참여 인력을 입력합니다',
    headers: [
      { key: 'project_id', label: 'Project ID (사업부-번호)', required: true, type: 'text', width: '150px' },
      { key: '이름', label: '이름', required: true, type: 'text' },
      { key: 'knoxId', label: 'Knox ID', required: false, type: 'text', width: '120px' },
      { key: '부서', label: '부서', required: false, type: 'text' }
    ],
    enableReorder: true, // 순서 조정 가능
    groupBy: 'project_id' // project_id로 그룹핑
  }
  ];
};

const BulkAddModal = ({ isOpen, onClose, onApply, onApplyAndUpload, existingProjects = [], globalPerformances = [], settingsData = {} }) => {
  // settingsData가 변경될 때마다 TABLES를 다시 생성
  const TABLES = React.useMemo(() => createTables(settingsData), [settingsData]);

  const [activeTab, setActiveTab] = useState('globalPerformances');
  const [tableData, setTableData] = useState({
    globalPerformances: [{}],
    projects: [{}],
    performances: [{}],
    actionItems: [{}],
    teamMembers: [{}]
  });
  const [validationErrors, setValidationErrors] = useState({});

  // 다이얼로그 상태
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    onConfirm: () => {}
  });
  const [alertDialog, setAlertDialog] = useState({
    isOpen: false,
    message: ''
  });

  // Information 모달 상태
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  // 드롭다운 상태
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const exportToCSV = () => {
    // 현재 활성화된 탭의 데이터만 내보내기
    const currentTable = getCurrentTable();
    const data = tableData[activeTab] || [];

    // 유효한 데이터만 필터링
    const validData = data.filter(row => {
      return Object.values(row).some(value =>
        value !== undefined && value !== null && value !== ''
      );
    });

    if (validData.length === 0) {
      setAlertDialog({
        isOpen: true,
        message: '내보낼 데이터가 없습니다.'
      });
      return;
    }

    // CSV 헤더 생성
    const headers = currentTable.headers.map(h => h.label);
    const headerRow = headers.join(',');

    // CSV 데이터 행 생성
    const dataRows = validData.map(row => {
      return currentTable.headers.map(header => {
        const value = row[header.key] || '';
        // 쉼표나 줄바꿈이 포함된 경우 따옴표로 감싸기
        if (typeof value === 'string' && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });

    // CSV 문자열 생성
    const csvContent = [headerRow, ...dataRows].join('\n');

    // BOM 추가 (한글 깨짐 방지)
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    // 다운로드 링크 생성 및 클릭
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${currentTable.title}_${todayLocalYmd()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 현재 리스트 불러오기 (활성화된 탭의 데이터만)
  const loadCurrentData = (division = null) => {
    setIsDropdownOpen(false); // 드롭다운 닫기

    // globalPerformances 탭인 경우 별도 처리
    if (activeTab === 'globalPerformances') {
      if (!globalPerformances || globalPerformances.length === 0) {
        setAlertDialog({
          isOpen: true,
          message: '불러올 성과 데이터가 없습니다.'
        });
        return;
      }
    } else {
      if (!existingProjects || existingProjects.length === 0) {
        setAlertDialog({
          isOpen: true,
          message: '불러올 프로젝트 데이터가 없습니다.'
        });
        return;
      }
    }

    try {
      let convertedData = [];
      let itemCount = 0;

      // 사업부 필터링 함수
      const filterByDivision = (projects) => {
        if (!division) return projects;
        return projects.filter(p => p.사업부 === division);
      };

      switch (activeTab) {
        case 'projects':
          // 프로젝트 기본 정보
          const filteredProjects = filterByDivision(existingProjects);
          convertedData = filteredProjects.map(project => ({
            uuid: project.uuid || '',
            id: project.id,
            과제년도: project.과제년도,
            사업부: project.사업부,
            프로세스: project.프로세스,
            과제영역: project.과제영역 || '',
            과제구분: project.과제구분,
            과제명: project.과제명,
            시작: project.시작,
            종료: project.종료,
            진행상태: project.진행상태,
            과제PL: project.과제PL,
            작성자: project.작성자,
            과제상세설명: project.과제상세설명,
            PoC과제여부: project.PoC과제여부,
            중점과제여부: project.중점과제여부
          }));
          itemCount = convertedData.length;
          break;

        case 'performances':
          // 과제-성과 연결 정보
          const filteredProjectsPerf = filterByDivision(existingProjects);
          filteredProjectsPerf.forEach(project => {
            if (project.성과목록 && project.성과목록.length > 0) {
              project.성과목록.forEach((perf) => {
                const perfId = typeof perf === 'object' ? (perf.id || perf.성과항목ID) : perf;
                const perfData = typeof perf === 'object' ? perf : {};

                let 성과항목명 = perfData.성과항목 || perfData.성과항목명 || '';
                if (!성과항목명 && perfId && globalPerformances.length > 0) {
                  const globalPerf = globalPerformances.find(gp => gp.id === perfId || gp.성과항목ID === perfId);
                  성과항목명 = globalPerf ? globalPerf.성과항목 : '';
                }

                convertedData.push({
                  project_id: project.id,
                  과제명: project.과제명 || '',
                  performance_id: perfId || '',
                  성과항목명: 성과항목명,
                  과제기여도: perfData.과제기여도 || ''
                });
              });
            }
          });
          itemCount = convertedData.length;
          break;

        case 'actionItems':
          // 액션아이템 정보
          const filteredProjectsAction = filterByDivision(existingProjects);
          filteredProjectsAction.forEach(project => {
            if (project.액션아이템목록 && project.액션아이템목록.length > 0) {
              project.액션아이템목록.forEach((item, index) => {
                convertedData.push({
                  project_id: project.id,
                  순번: index + 1,
                  제목: item.제목 || '',
                  완료여부: item.완료여부 || false
                });
              });
            }
          });
          itemCount = convertedData.length;
          break;

        case 'teamMembers':
          // 팀멤버 정보
          const filteredProjectsTeam = filterByDivision(existingProjects);
          filteredProjectsTeam.forEach(project => {
            if (project.과제참여인력목록 && project.과제참여인력목록.length > 0) {
              project.과제참여인력목록.forEach((member, index) => {
                convertedData.push({
                  project_id: project.id,
                  순번: index + 1,
                  이름: member.이름 || '',
                  knoxId: member.knoxId || '',
                  부서: member.부서 || ''
                });
              });
            }
          });
          itemCount = convertedData.length;
          break;

        case 'globalPerformances':
          // 글로벌 성과 목록 - 성과항목명에 [사업부] 포함 여부로 필터링
          let filteredPerformances = globalPerformances;
          if (division) {
            filteredPerformances = globalPerformances.filter(perf => {
              const 성과항목명 = perf.성과항목 || '';
              return 성과항목명.includes(`[${division}]`);
            });
          }
          convertedData = filteredPerformances.map(perf => {
            const 월별실적 = perf.월별실적 || Array(12).fill('');
            return {
              uuid: perf.uuid || '',
              id: perf.id,
              성과년도: perf.성과년도 || '',
              성과항목: perf.성과항목,
              대분류: perf.대분류,
              소분류: perf.소분류 || '',
              단위: perf.단위 || '',
              현재수준: levelText(perf.현재수준),
              목표수준: levelText(perf.목표수준),
              월별실적여부: perf.월별실적여부 || false,
              실적수준: levelText(perf.실적수준),
              실적_1월: 월별실적[0] || '',
              실적_2월: 월별실적[1] || '',
              실적_3월: 월별실적[2] || '',
              실적_4월: 월별실적[3] || '',
              실적_5월: 월별실적[4] || '',
              실적_6월: 월별실적[5] || '',
              실적_7월: 월별실적[6] || '',
              실적_8월: 월별실적[7] || '',
              실적_9월: 월별실적[8] || '',
              실적_10월: 월별실적[9] || '',
              실적_11월: 월별실적[10] || '',
              실적_12월: 월별실적[11] || '',
              설명: perf.설명 || ''
            };
          });
          itemCount = convertedData.length;
          break;

        default:
          setAlertDialog({
            isOpen: true,
            message: '알 수 없는 탭입니다.'
          });
          return;
      }

      // 현재 활성화된 탭의 데이터만 업데이트
      setTableData(prev => ({
        ...prev,
        [activeTab]: convertedData.length > 0 ? convertedData : [{}]
      }));

      // 현재 탭의 검증 오류만 초기화
      setValidationErrors(prev => ({
        ...prev,
        [activeTab]: null
      }));

      const currentTable = getCurrentTable();
      const divisionText = division ? ` (${division} 사업부)` : '';
      setAlertDialog({
        isOpen: true,
        message: `${currentTable.title}${divisionText} 데이터를 성공적으로 불러왔습니다!\n\n${itemCount}개 항목`
      });

    } catch (error) {
      console.error('현재 데이터 불러오기 실패:', error);
      setAlertDialog({
        isOpen: true,
        message: '데이터 불러오기 중 오류가 발생했습니다: ' + error.message
      });
    }
  };

  const handleTableDataChange = (tableId, data) => {
    setTableData(prev => ({
      ...prev,
      [tableId]: data
    }));
    
    // 데이터 변경시 해당 테이블의 검증 에러 초기화
    if (validationErrors[tableId]) {
      setValidationErrors(prev => ({
        ...prev,
        [tableId]: null
      }));
    }
  };

  const validateData = (tableId = null) => {
    const errors = {};
    let hasErrors = false;

    // tableId가 지정되면 해당 테이블만, 아니면 모든 테이블 검증
    const tablesToValidate = tableId
      ? TABLES.filter(table => table.id === tableId)
      : TABLES;

    tablesToValidate.forEach(table => {
      const data = tableData[table.id] || [];
      const tableErrors = [];

      data.forEach((row, rowIndex) => {
        const rowErrors = {};
        let hasRowErrors = false;

        // 빈 행 체크 (모든 필드가 비어있으면 스킵)
        const hasAnyData = Object.values(row).some(value =>
          value !== undefined && value !== null && value !== ''
        );

        if (!hasAnyData) {
          return; // 빈 행은 검증하지 않음
        }

        table.headers.forEach(header => {
          if (header.required && (!row[header.key] && row[header.key] !== 0)) {
            rowErrors[header.key] = '필수 항목입니다';
            hasRowErrors = true;
          }
        });

        if (hasRowErrors) {
          tableErrors[rowIndex] = rowErrors;
        }
      });

      if (tableErrors.length > 0) {
        errors[table.id] = tableErrors;
        hasErrors = true;
      }
    });

    setValidationErrors(errors);
    return !hasErrors;
  };

  // 데이터 검증 및 추출 공통 함수
  const getValidatedData = () => {
    // 현재 활성화된 탭만 검증
    if (!validateData(activeTab)) {
      setAlertDialog({
        isOpen: true,
        message: '필수 항목을 모두 입력해주세요.'
      });
      return null;
    }

    // 현재 활성화된 탭의 데이터만 추출
    const data = tableData[activeTab] || [];
    const cleanedData = data.filter(row => {
      return Object.values(row).some(value =>
        value !== undefined && value !== null && value !== ''
      );
    });

    if (cleanedData.length === 0) {
      setAlertDialog({
        isOpen: true,
        message: '입력된 데이터가 없습니다.'
      });
      return null;
    }

    return {
      type: activeTab,
      data: cleanedData
    };
  };

  const handleApply = () => {
    const validatedData = getValidatedData();
    if (validatedData) {
      onApply(validatedData);
    }
  };

  const handleApplyAndUpload = () => {
    if (!onApplyAndUpload) {
      setAlertDialog({
        isOpen: true,
        message: '서버 업로드 기능이 지원되지 않습니다.'
      });
      return;
    }

    const validatedData = getValidatedData();
    if (validatedData) {
      onApplyAndUpload(validatedData);
    }
  };

  const getCurrentTable = () => {
    return TABLES.find(table => table.id === activeTab);
  };

  const getTotalRows = () => {
    return Object.values(tableData).reduce((total, data) => total + data.length, 0);
  };

  const getValidRows = () => {
    // 현재 활성화된 탭의 유효한 행만 카운트
    const data = tableData[activeTab] || [];
    return data.filter(row => {
      return Object.values(row).some(value =>
        value !== undefined && value !== null && value !== ''
      );
    }).length;
  };

  if (!isOpen) return null;

  return (
    <>
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContainer>
        <ModalHeader>
          <ModalTitle>
            <Database size={24} strokeWidth={2} />
            여러 데이터 한번에 추가
          </ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} strokeWidth={2} />
          </CloseButton>
        </ModalHeader>

        <ModalContent>
          <TabContainer>
            {TABLES.map(table => (
              <Tab
                key={table.id}
                active={activeTab === table.id}
                onClick={() => setActiveTab(table.id)}
              >
                <Table size={16} strokeWidth={2} />
                {table.title}
              </Tab>
            ))}
          </TabContainer>

          <TableContainer>
            {getCurrentTable() && (
              <BulkEditTable
                table={getCurrentTable()}
                data={tableData[activeTab] || [{}]}
                onChange={(data) => handleTableDataChange(activeTab, data)}
                errors={validationErrors[activeTab] || {}}
              />
            )}
          </TableContainer>
        </ModalContent>

        <ButtonContainer>
          <LeftButtons>
            <DropdownContainer ref={dropdownRef}>
              <Button
                className="info"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                title="사업부별 또는 전체 데이터를 선택하여 불러옵니다"
              >
                <Database size={16} strokeWidth={2} />
                리스트 불러오기
                <ChevronDown size={16} strokeWidth={2} />
              </Button>
              {isDropdownOpen && (
                <DropdownMenu>
                  <DropdownItem onClick={() => loadCurrentData(null)}>
                    전체
                  </DropdownItem>
                  {(settingsData.divisions || []).map((division) => (
                    <DropdownItem key={division.id} onClick={() => loadCurrentData(division.name)}>
                      {division.name}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              )}
            </DropdownContainer>
            <Button className="info" onClick={exportToCSV}>
              <Download size={16} strokeWidth={2} />
              테이블 내보내기
            </Button>
            <Button className="info" onClick={() => setIsInfoModalOpen(true)}>
              <Info size={16} strokeWidth={2} />
              사용 방법
            </Button>
            <Button className="info" disabled>
              <CheckCircle size={16} strokeWidth={2} />
              유효한 행: {getValidRows()}
            </Button>
            <StatusBar>
              <StatusItem className={(validationErrors[activeTab] && Object.keys(validationErrors[activeTab]).length > 0) ? 'error' : 'success'}>
                {(validationErrors[activeTab] && Object.keys(validationErrors[activeTab]).length > 0) ? (
                  <>
                    <AlertCircle size={16} strokeWidth={2} />
                    검증 오류 있음
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} strokeWidth={2} />
                    검증 완료
                  </>
                )}
              </StatusItem>
            </StatusBar>
          </LeftButtons>

          <RightButtons>
            <Button className="secondary" onClick={onClose}>
              취소
            </Button>
            <Button className="primary" onClick={handleApply}>
              <Database size={16} strokeWidth={2} />
              {getCurrentTable()?.title} 적용하기
            </Button>
            {onApplyAndUpload && (
              <Button className="primary" onClick={handleApplyAndUpload} style={{ background: '#059669', borderColor: '#047857' }}>
                <Upload size={16} strokeWidth={2} />
                적용 및 서버 업로드
              </Button>
            )}
          </RightButtons>
        </ButtonContainer>
      </ModalContainer>
    </ModalOverlay>

    {/* 확인 다이얼로그 */}
    <ConfirmDialog
      isOpen={confirmDialog.isOpen}
      onConfirm={confirmDialog.onConfirm}
      onCancel={() => setConfirmDialog({ isOpen: false, onConfirm: () => {} })}
      title="데이터 덮어쓰기"
      message="현재 입력된 데이터가 있습니다. 덮어쓰시겠습니까?"
      confirmText="덮어쓰기"
      cancelText="취소"
      variant="warning"
    />

    {/* 알림 다이얼로그 */}
    <AlertDialog
      isOpen={alertDialog.isOpen}
      onClose={() => setAlertDialog({ isOpen: false, message: '' })}
      title="알림"
      message={alertDialog.message}
      variant="info"
    />

    {/* Information 모달 */}
    {isInfoModalOpen && (
      <InfoModalOverlay onClick={(e) => e.target === e.currentTarget && setIsInfoModalOpen(false)}>
        <InfoModalContainer>
          <InfoModalHeader>
            <InfoModalTitle>
              <Info size={20} strokeWidth={2} />
              엑셀에서 데이터 붙여넣기
            </InfoModalTitle>
            <InfoModalClose onClick={() => setIsInfoModalOpen(false)}>
              <X size={20} strokeWidth={2} />
            </InfoModalClose>
          </InfoModalHeader>

          <InfoModalBody>
            <InfoContent>
              <h4>
                <Info size={18} strokeWidth={2} />
                사용법
              </h4>
              <p>
                <strong>📂 리스트 불러오기:</strong> 저장된 데이터를 테이블에 불러옵니다. 사업부별 필터링 가능합니다.{'\n\n'}
                <strong>💾 테이블 내보내기:</strong> 현재 테이블의 데이터를 CSV 파일로 로컬에 저장합니다.{'\n\n'}
                <strong>✏️ CSV 파일 수정:</strong> 저장된 CSV 파일을 엑셀에서 열어 편집합니다.{'\n\n'}
                <strong>📋 엑셀 붙여넣기:</strong> 수정한 데이터를 엑셀에서 선택(Ctrl+C) → "엑셀 붙여넣기" 버튼 클릭하여 테이블에 붙여넣습니다.{'\n\n'}
                <strong>💡 추천 워크플로우:</strong>{'\n'}
                1. 리스트 불러오기로 기존 데이터 로드{'\n'}
                2. 테이블 내보내기로 CSV 저장{'\n'}
                3. 엑셀에서 CSV 파일 수정{'\n'}
                4. 수정된 내용을 복사하여 엑셀 붙여넣기{'\n\n'}
                <strong>📌 성과 추가 탭 주의사항:</strong>{'\n'}
                • 성과항목명 앞에 [사업부명]을 반드시 붙여주세요{'\n'}
                • 예: [MX] 시뮬레이션 정확도 향상, [VD] 데이터 개수 확보{'\n'}
                • 사업부별 필터링 시 [사업부명]을 기준으로 필터링됩니다{'\n\n'}
                <strong>⚠️ 액션아이템 & 팀멤버 탭 주의사항:</strong>{'\n'}
                • 테이블의 ↑↓ 버튼으로 순서를 조정하세요{'\n'}
                • 같은 프로젝트(Project ID) 내에서만 이동 가능{'\n'}
                • 저장 시 자동으로 순번이 부여됩니다{'\n'}
                • ⚠️ 중요: 테이블에 입력한 프로젝트는 기존 데이터가 완전히 교체됩니다
              </p>
            </InfoContent>
          </InfoModalBody>

          <InfoModalFooter>
            <InfoModalButton onClick={() => setIsInfoModalOpen(false)}>
              확인
            </InfoModalButton>
          </InfoModalFooter>
        </InfoModalContainer>
      </InfoModalOverlay>
    )}
    </>
  );
};

export default BulkAddModal;