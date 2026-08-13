import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from './components/Layout/Header';
import SwimlaneChart from './components/SwimlaneChart/SwimlaneChart';
import { InputModal } from '../../shared/components/Modal';
import './SwimlaneChartApp.css';

const SwimlaneChartApp = () => {
  const navigate = useNavigate();
  
  // 상태 관리
  const [organizations, setOrganizations] = useState([]); // 기본 조직 제거
  
  const [steps, setSteps] = useState([]); // 기본 단계 제거
  
  const [cellData, setCellData] = useState({}); // 기본 셀 데이터 제거
  
  // 글로벌 연결 상태 추가
  const [globalConnecting, setGlobalConnecting] = useState(false);
  
  // 모달 상태 추가
  const [orgModal, setOrgModal] = useState({ isOpen: false, mode: 'add', orgId: null, initialValue: '' });
  const [stepModal, setStepModal] = useState({ isOpen: false, stepId: null, initialValue: '' });
  const [processModal, setProcessModal] = useState({ 
    isOpen: false, 
    mode: 'add', 
    cellId: null, 
    processId: null, 
    initialValue: ''
  });

  // 이벤트 핸들러들
  const handleGoHome = () => {
    navigate('/engineeringhub');
  };

  const handleAddOrganization = () => {
    setOrgModal({
      isOpen: true,
      mode: 'add',
      orgId: null,
      initialValue: ''
    });
  };

  // 조직 추가 확인 핸들러
  const handleConfirmAddOrganization = (name) => {
    if (name && name.trim()) {
      const newOrg = {
        id: Date.now(),
        name: name.trim()
      };
      setOrganizations(prev => [...prev, newOrg]);
    }
    setOrgModal({ isOpen: false, mode: 'add', orgId: null, initialValue: '' });
  };

  const handleAddStep = () => {
    const nextStepNumber = steps.length + 1;
    const newStep = {
      id: Date.now(),
      name: `${nextStepNumber}단계`
    };
    setSteps(prev => [...prev, newStep]);
  };

  const handleLoadSample = () => {
    // 새로운 property를 포함한 샘플 데이터 로드
    setOrganizations([
      { id: 1, name: '기획팀' },
      { id: 2, name: '디자인팀' },
      { id: 3, name: '개발팀' },
      { id: 4, name: '테스트팀' },
      { id: 5, name: '운영팀' }
    ]);
    
    setSteps([
      { id: 1, name: '기획단계' },
      { id: 2, name: '디자인단계' },
      { id: 3, name: '개발단계' },
      { id: 4, name: '테스트단계' },
      { id: 5, name: '운영단계' }
    ]);
    
    setCellData({
      '1-1': {
        processes: [
          { 
            id: 1, 
            text: '요구사항 정의', 
            x: 20, 
            y: 20,
            primaryOwner: '김기획',
            collaborators: '이분석, 박매니저',
            status: 'completed',
            progress: 100,
            category: 'documentation',
            tags: '요구사항, 기획서',
            description: '프로젝트의 전체 요구사항을 정의하고 문서화합니다.',
            risks: '요구사항 변경으로 인한 일정 지연',
            referenceLinks: 'https://confluence.company.com/requirements'
          },
          { 
            id: 2, 
            text: '기능 명세서 작성', 
            x: 20, 
            y: 180,
            primaryOwner: '이분석',
            collaborators: '김기획, 최개발',
            status: 'completed',
            progress: 100,
            category: 'documentation',
            tags: '명세서, 기능정의',
            description: '각 기능별 상세 명세서를 작성합니다.',
            risks: '기능 복잡도 증가',
            referenceLinks: 'https://docs.company.com/functional-spec'
          }
        ],
        connections: [
          { id: 1, from: 1, to: 2 }
        ]
      },
      '2-1': {
        processes: [
          { 
            id: 3, 
            text: '사용자 스토리 작성', 
            x: 20, 
            y: 20,
            primaryOwner: '박UX',
            collaborators: '김기획, 이디자인',
            status: 'in_progress',
            progress: 70,
            category: 'documentation',
            tags: '사용자스토리, UX',
            description: '사용자 관점에서의 기능 요구사항을 스토리로 작성합니다.',
            risks: '사용자 니즈 파악 부족',
            referenceLinks: 'https://jira.company.com/user-stories'
          }
        ],
        connections: []
      },
      '2-2': {
        processes: [
          { 
            id: 4, 
            text: 'UI/UX 디자인', 
            x: 20, 
            y: 20,
            primaryOwner: '이디자인',
            collaborators: '박UX, 정프론트',
            status: 'review',
            progress: 85,
            category: 'program_development',
            tags: 'UI, UX, 디자인',
            description: '사용자 인터페이스와 경험을 설계합니다.',
            risks: '디자인 변경 요청',
            referenceLinks: 'https://figma.com/company-project'
          },
          { 
            id: 5, 
            text: '프로토타입 제작', 
            x: 20, 
            y: 180,
            primaryOwner: '정프론트',
            collaborators: '이디자인',
            status: 'in_progress',
            progress: 45,
            category: 'program_development',
            tags: '프로토타입, MVP',
            description: '초기 프로토타입을 제작하여 개념을 검증합니다.',
            risks: '기술적 제약사항',
            referenceLinks: 'https://prototype.company.com'
          }
        ],
        connections: [
          { id: 2, from: 4, to: 5 }
        ]
      },
      '3-2': {
        processes: [
          { 
            id: 6, 
            text: '프론트엔드 개발', 
            x: 20, 
            y: 20,
            primaryOwner: '정프론트',
            collaborators: '김리액트, 이Vue',
            status: 'in_progress',
            progress: 65,
            category: 'cae_development',
            tags: 'React, 프론트엔드',
            description: '사용자 인터페이스를 구현합니다.',
            risks: '브라우저 호환성 이슈',
            referenceLinks: 'https://github.com/company/frontend'
          },
          { 
            id: 7, 
            text: '백엔드 개발', 
            x: 160, 
            y: 20,
            primaryOwner: '최백엔드',
            collaborators: '박API, 김DB',
            status: 'in_progress',
            progress: 70,
            category: 'cae_development',
            tags: 'Node.js, API',
            description: '서버사이드 로직과 API를 구현합니다.',
            risks: '성능 및 확장성 이슈',
            referenceLinks: 'https://github.com/company/backend'
          },
          { 
            id: 8, 
            text: '통합 테스트', 
            x: 90, 
            y: 180,
            primaryOwner: '김통합',
            collaborators: '정프론트, 최백엔드',
            status: 'not_started',
            progress: 0,
            category: 'testing',
            tags: '통합테스트, E2E',
            description: '프론트엔드와 백엔드의 통합을 테스트합니다.',
            risks: '인터페이스 불일치',
            referenceLinks: 'https://test-docs.company.com'
          }
        ],
        connections: [
          { id: 3, from: 6, to: 8 },
          { id: 4, from: 7, to: 8 }
        ]
      },
      '3-3': {
        processes: [
          { 
            id: 9, 
            text: '개발 구현', 
            x: 20, 
            y: 20,
            primaryOwner: '김개발',
            collaborators: '이코드, 박알고리즘',
            status: 'in_progress',
            progress: 80,
            category: 'cae_development',
            tags: '구현, 코딩',
            description: '핵심 비즈니스 로직을 구현합니다.',
            risks: '코드 복잡도 증가',
            referenceLinks: 'https://github.com/company/core'
          },
          { 
            id: 10, 
            text: '코드 리뷰', 
            x: 20, 
            y: 180,
            primaryOwner: '박시니어',
            collaborators: '김개발, 이코드',
            status: 'in_progress',
            progress: 60,
            category: 'cae_development',
            tags: '코드리뷰, 품질',
            description: '구현된 코드의 품질을 검토합니다.',
            risks: '리뷰 병목현상',
            referenceLinks: 'https://github.com/company/core/pulls'
          }
        ],
        connections: [
          { id: 5, from: 9, to: 10 }
        ]
      },
      '4-3': {
        processes: [
          { 
            id: 11, 
            text: '최종 코드 검토', 
            x: 20, 
            y: 20,
            primaryOwner: '박시니어',
            collaborators: '김아키텍트',
            status: 'review',
            progress: 90,
            category: 'cae_development',
            tags: '최종검토, 승인',
            description: '배포 전 최종 코드 검토를 수행합니다.',
            risks: '마지막 순간 버그 발견',
            referenceLinks: 'https://review.company.com'
          }
        ],
        connections: []
      },
      '4-4': {
        processes: [
          { 
            id: 12, 
            text: '테스트 계획 수립', 
            x: 20, 
            y: 20,
            primaryOwner: '최테스트',
            collaborators: '김QA, 이자동화',
            status: 'completed',
            progress: 100,
            category: 'testing',
            tags: '테스트계획, QA',
            description: '전체 테스트 계획을 수립합니다.',
            risks: '테스트 커버리지 부족',
            referenceLinks: 'https://testplan.company.com'
          },
          { 
            id: 13, 
            text: '테스트 실행', 
            x: 20, 
            y: 180,
            primaryOwner: '김QA',
            collaborators: '최테스트, 이자동화',
            status: 'in_progress',
            progress: 40,
            category: 'testing',
            tags: '테스트실행, 버그',
            description: '계획된 테스트를 실행하고 결과를 분석합니다.',
            risks: '예상치 못한 버그 발견',
            referenceLinks: 'https://testresults.company.com'
          }
        ],
        connections: [
          { id: 6, from: 12, to: 13 }
        ]
      },
      '5-4': {
        processes: [
          { 
            id: 14, 
            text: '품질 검증', 
            x: 20, 
            y: 20,
            primaryOwner: '이품질',
            collaborators: '김QA, 최테스트',
            status: 'blocked',
            progress: 20,
            category: 'testing',
            tags: '품질검증, 승인',
            description: '최종 품질 기준에 따른 검증을 수행합니다.',
            risks: '품질 기준 미달',
            referenceLinks: 'https://quality.company.com'
          }
        ],
        connections: []
      },
      '5-5': {
        processes: [
          { 
            id: 15, 
            text: '운영 배포', 
            x: 20, 
            y: 20,
            primaryOwner: '정DevOps',
            collaborators: '김인프라, 이모니터링',
            status: 'not_started',
            progress: 0,
            category: 'program_development',
            tags: '배포, 운영',
            description: '운영 환경에 시스템을 배포합니다.',
            risks: '배포 중 서비스 중단',
            referenceLinks: 'https://deploy.company.com'
          },
          { 
            id: 16, 
            text: '모니터링 설정', 
            x: 20, 
            y: 180,
            primaryOwner: '이모니터링',
            collaborators: '정DevOps, 김인프라',
            status: 'not_started',
            progress: 0,
            category: 'program_development',
            tags: '모니터링, 로그',
            description: '시스템 모니터링 및 로그 수집을 설정합니다.',
            risks: '모니터링 누락',
            referenceLinks: 'https://monitoring.company.com'
          }
        ],
        connections: [
          { id: 7, from: 15, to: 16 }
        ]
      }
    });
  };

  const handleEditOrganization = (orgId) => {
    const org = organizations.find(o => o.id === orgId);
    if (org) {
      setOrgModal({
        isOpen: true,
        mode: 'edit',
        orgId: orgId,
        initialValue: org.name
      });
    }
  };

  // 조직 수정 확인 핸들러
  const handleConfirmEditOrganization = (newName) => {
    if (newName && newName.trim()) {
      setOrganizations(prev => 
        prev.map(o => o.id === orgModal.orgId ? { ...o, name: newName.trim() } : o)
      );
    }
    setOrgModal({ isOpen: false, mode: 'add', orgId: null, initialValue: '' });
  };

  const handleDeleteOrganization = (orgId) => {
    if (organizations.length <= 1) {
      alert('최소 하나의 조직은 있어야 합니다.');
      return;
    }
    
    if (window.confirm('이 조직을 삭제하시겠습니까?')) {
      setOrganizations(prev => prev.filter(o => o.id !== orgId));
      
      // 해당 조직의 모든 셀 데이터 삭제
      setCellData(prev => {
        const newCellData = { ...prev };
        Object.keys(newCellData).forEach(key => {
          if (key.endsWith(`-${orgId}`)) {
            delete newCellData[key];
          }
        });
        return newCellData;
      });
    }
  };

  // 조직 순서 변경 핸들러들 추가
  const handleMoveOrganizationLeft = (orgId) => {
    const currentIndex = organizations.findIndex(org => org.id === orgId);
    if (currentIndex > 0) {
      const newOrganizations = [...organizations];
      [newOrganizations[currentIndex], newOrganizations[currentIndex - 1]] = 
      [newOrganizations[currentIndex - 1], newOrganizations[currentIndex]];
      setOrganizations(newOrganizations);
    }
  };

  const handleMoveOrganizationRight = (orgId) => {
    const currentIndex = organizations.findIndex(org => org.id === orgId);
    if (currentIndex < organizations.length - 1) {
      const newOrganizations = [...organizations];
      [newOrganizations[currentIndex], newOrganizations[currentIndex + 1]] = 
      [newOrganizations[currentIndex + 1], newOrganizations[currentIndex]];
      setOrganizations(newOrganizations);
    }
  };

  const handleEditStep = (stepId) => {
    const step = steps.find(s => s.id === stepId);
    if (step) {
      setStepModal({
        isOpen: true,
        stepId: stepId,
        initialValue: step.name
      });
    }
  };

  // 단계 수정 확인 핸들러
  const handleConfirmEditStep = (newName) => {
    if (newName && newName.trim()) {
      setSteps(prev => 
        prev.map(s => s.id === stepModal.stepId ? { ...s, name: newName.trim() } : s)
      );
    }
    setStepModal({ isOpen: false, stepId: null, initialValue: '' });
  };

  const handleDeleteStep = (stepId) => {
    if (steps.length <= 1) {
      alert('최소 하나의 단계는 있어야 합니다.');
      return;
    }
    
    if (window.confirm('이 단계를 삭제하시겠습니까?')) {
      setSteps(prev => prev.filter(s => s.id !== stepId));
      
      // 해당 단계의 모든 셀 데이터 삭제
      setCellData(prev => {
        const newCellData = { ...prev };
        Object.keys(newCellData).forEach(key => {
          if (key.startsWith(`${stepId}-`)) {
            delete newCellData[key];
          }
        });
        return newCellData;
      });
    }
  };

  const handleUpdateCellData = (cellId, data) => {
    setCellData(prev => ({
      ...prev,
      [cellId]: data
    }));
  };
  
  // 글로벌 연결 토글 핸들러
  const handleToggleGlobalConnection = () => {
    setGlobalConnecting(prev => !prev);
  };

  // 프로세스 추가 핸들러 - 이제 상세 모달에서 처리되므로 간단한 텍스트 입력만 지원
  const handleRequestAddProcess = (cellId) => {
    setProcessModal({
      isOpen: true,
      mode: 'add',
      cellId: cellId,
      processId: null,
      initialValue: ''
    });
  };

  // 프로세스 편집 핸들러 - 빠른 편집 (이름만)
  const handleRequestEditProcess = (cellId, processId, currentText) => {
    setProcessModal({
      isOpen: true,
      mode: 'edit',
      cellId: cellId,
      processId: processId,
      initialValue: currentText
    });
  };

  // 프로세스 추가 확인 핸들러 - 기본 프로세스만 생성
  const handleConfirmAddProcess = (text) => {
    if (text && text.trim() && processModal.cellId) {
      const newProcess = {
        id: Date.now(),
        text: text.trim(),
        x: 20,
        y: 30 + (cellData[processModal.cellId]?.processes?.length || 0) * 200,
        primaryOwner: '',
        collaborators: '',
        status: 'not_started',
        progress: 0,
        category: 'cae_development',
        tags: '',
        description: '',
        risks: '',
        referenceLinks: ''
      };
      const currentData = cellData[processModal.cellId] || { processes: [], connections: [] };
      const updatedData = {
        ...currentData,
        processes: [...currentData.processes, newProcess]
      };
      handleUpdateCellData(processModal.cellId, updatedData);
    }
    setProcessModal({ isOpen: false, mode: 'add', cellId: null, processId: null, initialValue: '' });
  };

  // 프로세스 편집 확인 핸들러 - 이름만 수정
  const handleConfirmEditProcess = (newText) => {
    if (newText && newText.trim() && processModal.cellId && processModal.processId) {
      const currentData = cellData[processModal.cellId] || { processes: [], connections: [] };
      const updatedData = {
        ...currentData,
        processes: currentData.processes.map(p => 
          p.id === processModal.processId ? { ...p, text: newText.trim() } : p
        )
      };
      handleUpdateCellData(processModal.cellId, updatedData);
    }
    setProcessModal({ isOpen: false, mode: 'add', cellId: null, processId: null, initialValue: '' });
  };

  return (
    <div className="swimlane-layout">
      <Header
        onGoHome={handleGoHome}
        onAddStep={handleAddStep}
        onAddOrganization={handleAddOrganization}
        onLoadSample={handleLoadSample}
        stepsCount={steps.length}
        organizationsCount={organizations.length}
        globalConnecting={globalConnecting}
        onToggleGlobalConnection={handleToggleGlobalConnection}
      />
      
      <main className="swimlane-main">
        <div className="swimlane-content">
          <div className="chart-container">
            <SwimlaneChart
              organizations={organizations}
              steps={steps}
              cellData={cellData}
              onAddOrganization={handleAddOrganization}
              onEditOrganization={handleEditOrganization}
              onDeleteOrganization={handleDeleteOrganization}
              onMoveOrganizationLeft={handleMoveOrganizationLeft}
              onMoveOrganizationRight={handleMoveOrganizationRight}
              onAddStep={handleAddStep}
              onEditStep={handleEditStep}
              onDeleteStep={handleDeleteStep}
              onUpdateCellData={handleUpdateCellData}
              globalConnecting={globalConnecting}
              onToggleGlobalConnection={handleToggleGlobalConnection}
              onRequestAddProcess={handleRequestAddProcess}
              onRequestEditProcess={handleRequestEditProcess}
            />
          </div>
        </div>
      </main>
      
      {/* 프로세스 관련 모달 - 빠른 추가/편집용 */}
      <InputModal
        isOpen={processModal.isOpen}
        onClose={() => setProcessModal({ isOpen: false, mode: 'add', cellId: null, processId: null, initialValue: '' })}
        onConfirm={processModal.mode === 'add' ? handleConfirmAddProcess : handleConfirmEditProcess}
        title={processModal.mode === 'add' ? '새 프로세스 추가' : '프로세스 이름 수정'}
        message={processModal.mode === 'add' ? '새로운 프로세스의 이름을 입력하세요:' : '프로세스의 새로운 이름을 입력하세요:'}
        placeholder="예: 요구사항 분석, 시스템 설계, 코드 구현..."
        initialValue={processModal.initialValue}
        confirmText={processModal.mode === 'add' ? '추가' : '수정'}
        cancelText="취소"
        maxLength={100}
        required={true}
      />
      
      {/* 조직 관련 모달 */}
      <InputModal
        isOpen={orgModal.isOpen}
        onClose={() => setOrgModal({ isOpen: false, mode: 'add', orgId: null, initialValue: '' })}
        onConfirm={orgModal.mode === 'add' ? handleConfirmAddOrganization : handleConfirmEditOrganization}
        title={orgModal.mode === 'add' ? '새 조직 추가' : '조직 이름 수정'}
        message={orgModal.mode === 'add' ? '새로운 조직의 이름을 입력하세요:' : '조직의 새로운 이름을 입력하세요:'}
        placeholder="예: 개발팀, 마케팅팀, 품질관리팀..."
        initialValue={orgModal.initialValue}
        confirmText={orgModal.mode === 'add' ? '추가' : '수정'}
        cancelText="취소"
        maxLength={50}
        required={true}
      />
      
      {/* 단계 수정 모달 */}
      <InputModal
        isOpen={stepModal.isOpen}
        onClose={() => setStepModal({ isOpen: false, stepId: null, initialValue: '' })}
        onConfirm={handleConfirmEditStep}
        title="단계 이름 수정"
        message="단계의 새로운 이름을 입력하세요:"
        placeholder="예: 기획 단계, 개발 단계, 테스트 단계..."
        initialValue={stepModal.initialValue}
        confirmText="수정"
        cancelText="취소"
        maxLength={30}
        required={true}
      />
    </div>
  );
};

export default SwimlaneChartApp;
