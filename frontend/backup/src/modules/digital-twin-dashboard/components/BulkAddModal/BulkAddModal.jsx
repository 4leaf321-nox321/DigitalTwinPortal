import React, { useState } from 'react';
import styled from 'styled-components';
import { X, Database, Table, Copy, CheckCircle, AlertCircle, Info } from 'lucide-react';
import BulkEditTable from './components/BulkEditTable';

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

const TABLES = [
  {
    id: 'projects',
    name: 'PROJECTS',
    title: '프로젝트 기본정보',
    description: '과제의 기본 정보를 입력합니다',
    headers: [
      { key: 'id', label: 'ID (사업부-번호)', required: true, type: 'text' },
      { key: '과제년도', label: '과제년도', required: true, type: 'number' },
      { key: '사업부', label: '사업부', required: true, type: 'text' },
      { key: '프로세스', label: '프로세스', required: true, type: 'text' },
      { key: '과제구분', label: '과제구분', required: true, type: 'text' },
      { key: '과제명', label: '과제명', required: true, type: 'text' },
      { key: '시작', label: '시작월', required: true, type: 'number' },
      { key: '종료', label: '종료월', required: true, type: 'number' },
      { key: '진행상태', label: '진행상태', required: true, type: 'text' },
      { key: '과제PL', label: '과제PL', required: false, type: 'text' },
      { key: '작성자', label: '작성자', required: true, type: 'text' },
      { key: '과제상세설명', label: '과제상세설명', required: false, type: 'text' },
      { key: 'PoC과제여부', label: 'PoC과제여부', required: false, type: 'boolean' },
      { key: '중점과제여부', label: '중점과제여부', required: false, type: 'boolean' }
    ]
  },
  {
    id: 'performances',
    name: 'PERFORMANCES',
    title: '성과정보',
    description: '프로젝트별 성과 지표를 입력합니다',
    headers: [
      { key: 'project_id', label: 'Project ID (사업부-번호)', required: true, type: 'text' },
      { key: '순번', label: '순번', required: true, type: 'number' },
      { key: '대분류', label: '대분류', required: true, type: 'text' },
      { key: '소분류', label: '소분류', required: false, type: 'text' },
      { key: '성과항목', label: '성과항목', required: true, type: 'text' },
      { key: '과제기여도', label: '과제기여도', required: false, type: 'number' },
      { key: '현재수준', label: '현재수준', required: false, type: 'number' },
      { key: '목표수준', label: '목표수준', required: false, type: 'number' },
      { key: '실적수준', label: '실적수준', required: false, type: 'number' },
      { key: '단위', label: '단위', required: false, type: 'text' }
    ]
  },
  {
    id: 'actionItems',
    name: 'ACTION_ITEMS',
    title: '액션아이템',
    description: '프로젝트별 액션 아이템을 입력합니다',
    headers: [
      { key: 'project_id', label: 'Project ID (사업부-번호)', required: true, type: 'text' },
      { key: '순번', label: '순번', required: true, type: 'number' },
      { key: '제목', label: '제목', required: true, type: 'text' },
      { key: '완료여부', label: '완료여부', required: false, type: 'boolean' }
    ]
  },
  {
    id: 'teamMembers',
    name: 'TEAM_MEMBERS',
    title: '팀멤버',
    description: '프로젝트별 참여 인력을 입력합니다',
    headers: [
      { key: 'project_id', label: 'Project ID (사업부-번호)', required: true, type: 'text' },
      { key: '순번', label: '순번', required: true, type: 'number' },
      { key: '이름', label: '이름', required: true, type: 'text' },
      { key: '부서', label: '부서', required: false, type: 'text' }
    ]
  }
];

const BulkAddModal = ({ isOpen, onClose, onApply, existingProjects = [] }) => {
  const [activeTab, setActiveTab] = useState('projects');
  const [tableData, setTableData] = useState({
    projects: [{}],
    performances: [{}],
    actionItems: [{}],
    teamMembers: [{}]
  });
  const [validationErrors, setValidationErrors] = useState({});

  // 현재 리스트 불러오기
  const loadCurrentData = () => {
    if (!existingProjects || existingProjects.length === 0) {
      alert('불러올 프로젝트 데이터가 없습니다.');
      return;
    }

    try {
      // 기존 프로젝트를 4테이블 형태로 변환
      const convertedData = {
        projects: [],
        performances: [],
        actionItems: [],
        teamMembers: []
      };

      existingProjects.forEach(project => {
        // 1. 프로젝트 기본 정보 (과제목표 제외)
        convertedData.projects.push({
          id: project.id,
          과제년도: project.과제년도,
          사업부: project.사업부,
          프로세스: project.프로세스,
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
        });

        // 2. 성과 정보
        if (project.성과목록 && project.성과목록.length > 0) {
          project.성과목록.forEach((perf, index) => {
            convertedData.performances.push({
              project_id: project.id,
              순번: index + 1,
              대분류: perf.대분류 || '',
              소분류: perf.소분류 || '',
              성과항목: perf.성과항목 || '',
              과제기여도: perf.과제기여도 || '',
              현재수준: perf.현재수준 || '',
              목표수준: perf.목표수준 || '',
              실적수준: perf.실적수준 || '',
              단위: perf.단위 || ''
            });
          });
        }

        // 3. 액션아이템 정보
        if (project.액션아이템목록 && project.액션아이템목록.length > 0) {
          project.액션아이템목록.forEach((item, index) => {
            convertedData.actionItems.push({
              project_id: project.id,
              순번: index + 1,
              제목: item.제목 || '',
              완료여부: item.완료여부 || false
            });
          });
        }

        // 4. 팀멤버 정보
        if (project.과제참여인력목록 && project.과제참여인력목록.length > 0) {
          project.과제참여인력목록.forEach((member, index) => {
            convertedData.teamMembers.push({
              project_id: project.id,
              순번: index + 1,
              이름: member.이름 || '',
              부서: member.부서 || ''
            });
          });
        }
      });

      // 변환된 데이터로 테이블 상태 업데이트
      setTableData({
        projects: convertedData.projects.length > 0 ? convertedData.projects : [{}],
        performances: convertedData.performances.length > 0 ? convertedData.performances : [{}],
        actionItems: convertedData.actionItems.length > 0 ? convertedData.actionItems : [{}],
        teamMembers: convertedData.teamMembers.length > 0 ? convertedData.teamMembers : [{}]
      });

      // 검증 오류 초기화
      setValidationErrors({});

      const totalItems = convertedData.projects.length + 
                        convertedData.performances.length + 
                        convertedData.actionItems.length + 
                        convertedData.teamMembers.length;

      alert(`현재 데이터를 성공적으로 불러왔습니다!\n\n프로젝트: ${convertedData.projects.length}개\n성과: ${convertedData.performances.length}개\n액션아이템: ${convertedData.actionItems.length}개\n팀멤버: ${convertedData.teamMembers.length}개\n\n총 ${totalItems}개 항목`);
      
    } catch (error) {
      console.error('현재 데이터 불러오기 실패:', error);
      alert('데이터 불러오기 중 오류가 발생했습니다: ' + error.message);
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

  const validateData = () => {
    const errors = {};
    let hasErrors = false;

    TABLES.forEach(table => {
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

  const handleApply = () => {
    if (!validateData()) {
      alert('필수 항목을 모두 입력해주세요.');
      return;
    }

    // 빈 행 제거하고 실제 데이터만 추출
    const cleanedData = {};
    
    TABLES.forEach(table => {
      const data = tableData[table.id] || [];
      cleanedData[table.id] = data.filter(row => {
        return Object.values(row).some(value => 
          value !== undefined && value !== null && value !== ''
        );
      });
    });

    onApply(cleanedData);
  };

  const getCurrentTable = () => {
    return TABLES.find(table => table.id === activeTab);
  };

  const getTotalRows = () => {
    return Object.values(tableData).reduce((total, data) => total + data.length, 0);
  };

  const getValidRows = () => {
    let validCount = 0;
    TABLES.forEach(table => {
      const data = tableData[table.id] || [];
      validCount += data.filter(row => {
        return Object.values(row).some(value => 
          value !== undefined && value !== null && value !== ''
        );
      }).length;
    });
    return validCount;
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContainer>
        <ModalHeader>
          <ModalTitle>
            <Database size={24} strokeWidth={2} />
            여러 과제 한번에 추가
          </ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} strokeWidth={2} />
          </CloseButton>
        </ModalHeader>

        <ModalContent>
          <InfoBox>
            <Info size={20} strokeWidth={2} style={{ color: '#3b82f6', marginTop: '2px' }} />
            <InfoText>
              <h4>엑셀에서 데이터 붙여넣기</h4>
              <p>
                <strong>사용법:</strong><br/>
                1번: "📂 현재 리스트 불러오기" → 기존 데이터를 테이블로 로드<br/>
                2번: 엑셀에서 데이터 선택 → Ctrl+C 복사<br/>
                3번: "📋 붙여넣기" 버튼 클릭 (권한 필요)<br/>
                4번: 안 되면 "✍️ 수동 입력" 버튼 → Ctrl+V로 텍스트 입력<br/>
                5번: project_id로 테이블들이 연결되며, 필수(*) 항목은 반드시 입력<br/><br/>
                <strong>가장 확실한 방법:</strong> "수동 입력" 버튼 사용!
              </p>
            </InfoText>
          </InfoBox>

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
                errors={validationErrors[activeTab]}
              />
            )}
          </TableContainer>
        </ModalContent>

        <ButtonContainer>
          <LeftButtons>
            <Button className="info" onClick={loadCurrentData} title="현재 시스템의 프로젝트 데이터를 테이블로 불러옵니다">
              <Database size={16} strokeWidth={2} />
              📂 현재 리스트 불러오기
            </Button>
            <Button className="info">
              <CheckCircle size={16} strokeWidth={2} />
              유효한 행: {getValidRows()}
            </Button>
            <StatusBar>
              <StatusItem className={validationErrors && Object.keys(validationErrors).length > 0 ? 'error' : 'success'}>
                {validationErrors && Object.keys(validationErrors).length > 0 ? (
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
              적용하기
            </Button>
          </RightButtons>
        </ButtonContainer>
      </ModalContainer>
    </ModalOverlay>
  );
};

export default BulkAddModal;