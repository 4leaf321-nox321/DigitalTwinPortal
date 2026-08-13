import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { X, Database, CheckCircle, AlertCircle, Info, Download } from 'lucide-react';
import BulkEditTable from './BulkEditTable';
import { todayLocalYmd } from '../../../../shared/utils/localDate';

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
  gap: 1rem;
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
  align-items: center;
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

    &:disabled {
      background: #9ca3af;
      border-color: #6b7280;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
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

const BulkAddMaterialModal = ({ isOpen, onClose, onApply, tabsData = {}, existingMaterials = [] }) => {
  const [tableData, setTableData] = useState([{}]);
  const [validationErrors, setValidationErrors] = useState({});

  // tabsData에서 Material(technical-data) 필드들을 헤더로 변환
  const headers = useMemo(() => {
    const technicalData = tabsData['technical-data'];
    if (!technicalData || !technicalData.groups) return [];

    const allHeaders = [];

    technicalData.groups.forEach(group => {
      if (group.fields) {
        group.fields.forEach(field => {
          // generatedtextbox 타입은 자동 생성되므로 제외
          if (field.type === 'generatedtextbox') return;

          allHeaders.push({
            key: field.name,
            label: field.label,
            required: field.required || false,
            type: field.type === 'textbox' ? 'text' : field.type === 'datepicker' ? 'date' : 'text',
            placeholder: field.placeholder || '',
            options: field.options || [],
            width: field.name.length > 15 ? '200px' : '150px'
          });
        });
      }
    });

    return allHeaders;
  }, [tabsData]);

  const handleTableDataChange = (data) => {
    setTableData(data);

    // 데이터 변경시 검증 에러 초기화
    if (Object.keys(validationErrors).length > 0) {
      setValidationErrors({});
    }
  };

  const validateData = () => {
    const errors = {};
    let hasErrors = false;

    tableData.forEach((row, rowIndex) => {
      const rowErrors = {};
      let hasRowErrors = false;

      // 빈 행 체크
      const hasAnyData = Object.values(row).some(value =>
        value !== undefined && value !== null && value !== ''
      );

      if (!hasAnyData) {
        return;
      }

      headers.forEach(header => {
        if (header.required && (!row[header.key] && row[header.key] !== 0)) {
          rowErrors[header.key] = '필수 항목입니다';
          hasRowErrors = true;
        }
      });

      if (hasRowErrors) {
        errors[rowIndex] = rowErrors;
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

    const cleanedData = tableData.filter(row => {
      return Object.values(row).some(value =>
        value !== undefined && value !== null && value !== ''
      );
    });

    if (cleanedData.length === 0) {
      alert('입력된 데이터가 없습니다.');
      return;
    }

    onApply(cleanedData);
  };

  const exportToCSV = () => {
    const validData = tableData.filter(row => {
      return Object.values(row).some(value =>
        value !== undefined && value !== null && value !== ''
      );
    });

    if (validData.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    const headerRow = headers.map(h => h.label).join(',');
    const dataRows = validData.map(row => {
      return headers.map(header => {
        const value = row[header.key] || '';
        if (typeof value === 'string' && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });

    const csvContent = [headerRow, ...dataRows].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Materials_${todayLocalYmd()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadExistingData = () => {
    if (!existingMaterials || existingMaterials.length === 0) {
      alert('불러올 Material 데이터가 없습니다.');
      return;
    }

    const convertedData = existingMaterials.map(material => {
      const row = {};
      headers.forEach(header => {
        if (material[header.key] !== undefined) {
          row[header.key] = material[header.key];
        }
      });
      return row;
    });

    setTableData(convertedData.length > 0 ? convertedData : [{}]);
    setValidationErrors({});
    alert(`${convertedData.length}개의 Material 데이터를 불러왔습니다.`);
  };

  const getValidRows = () => {
    return tableData.filter(row => {
      return Object.values(row).some(value =>
        value !== undefined && value !== null && value !== ''
      );
    }).length;
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContainer>
        <ModalHeader>
          <ModalTitle>
            <Database size={24} strokeWidth={2} />
            여러 Material 한번에 추가
          </ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} strokeWidth={2} />
          </CloseButton>
        </ModalHeader>

        <ModalContent>
          <InfoBox>
            <Info size={20} color="#1e40af" />
            <InfoText>
              <h4>사용 방법</h4>
              <p>
                엑셀에서 Material 데이터를 복사하여 "엑셀 붙여넣기" 버튼을 통해 여러 Material을 한 번에 추가할 수 있습니다.
                컬럼 순서는 테이블 헤더 순서와 동일해야 합니다.
              </p>
            </InfoText>
          </InfoBox>

          <TableContainer>
            <BulkEditTable
              headers={headers}
              data={tableData}
              onChange={handleTableDataChange}
              errors={validationErrors}
              title="Material 추가"
              description="Technical Data 필드에 맞춰 Material 정보를 입력하세요"
            />
          </TableContainer>
        </ModalContent>

        <ButtonContainer>
          <LeftButtons>
            <Button className="info" onClick={loadExistingData}>
              <Database size={16} strokeWidth={2} />
              기존 데이터 불러오기
            </Button>
            <Button className="info" onClick={exportToCSV}>
              <Download size={16} strokeWidth={2} />
              테이블 내보내기
            </Button>
            <StatusBar>
              <StatusItem className="success">
                <CheckCircle size={16} strokeWidth={2} />
                유효한 행: {getValidRows()}
              </StatusItem>
              {Object.keys(validationErrors).length > 0 && (
                <StatusItem className="error">
                  <AlertCircle size={16} strokeWidth={2} />
                  검증 오류 있음
                </StatusItem>
              )}
            </StatusBar>
          </LeftButtons>

          <RightButtons>
            <Button className="secondary" onClick={onClose}>
              취소
            </Button>
            <Button className="primary" onClick={handleApply} disabled={getValidRows() === 0}>
              <Database size={16} strokeWidth={2} />
              {getValidRows()}개 Material 추가
            </Button>
          </RightButtons>
        </ButtonContainer>
      </ModalContainer>
    </ModalOverlay>
  );
};

export default BulkAddMaterialModal;
