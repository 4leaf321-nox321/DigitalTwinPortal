import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { Calendar, ChevronDown, ChevronUp, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import Modal from '../../../../shared/components/Modal/Modal';
import { parseTraFile, isTraFile } from '../../utils/traFileParser';
import { parseStrainSweepFile, isStrainSweepFile } from '../../utils/strainSweepFileParser';
import { parseFreqTempFile, isFreqTempFile } from '../../utils/freqTempFileParser';
import { MeasurementDataTable, MeasurementChart, StrainSweepDataTable, StrainSweepChart, FreqTempDataTable, FreqTempChart } from '../MeasurementData';

const ModalWrapper = styled.div`
  .add-data-modal {
    width: 80vw !important;
    max-width: 80vw !important;
    height: 80vh !important;
    max-height: 80vh !important;
  }

  .add-data-modal .modal-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 0 !important;
  }
`;

const TabsContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 0 20px;
  flex-shrink: 0;
`;

const Tab = styled.button`
  padding: 14px 20px;
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  color: ${props => props.active ? '#8b5cf6' : '#64748b'};
  cursor: pointer;
  position: relative;
  transition: color 0.2s;

  &:hover {
    color: #8b5cf6;
  }

  &::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 0;
    right: 0;
    height: 2px;
    background: ${props => props.active ? '#8b5cf6' : 'transparent'};
    transition: background 0.2s;
  }
`;

const ContentArea = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 24px 40px;
`;

const FileUploadSection = styled.div`
  margin-bottom: 20px;
`;

const FileUploadArea = styled.div`
  border: 2px dashed ${props => props.isDragOver ? '#8b5cf6' : props.hasFile ? '#22c55e' : '#d1d5db'};
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: ${props => props.isDragOver ? '#faf5ff' : props.hasFile ? '#f0fdf4' : '#fafafa'};

  &:hover {
    border-color: #8b5cf6;
    background: #faf5ff;
  }
`;

const FileUploadIcon = styled.div`
  width: 48px;
  height: 48px;
  margin: 0 auto 12px;
  border-radius: 12px;
  background: ${props => props.hasFile ? '#dcfce7' : '#f1f5f9'};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${props => props.hasFile ? '#22c55e' : '#64748b'};
`;

const FileUploadTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 4px;
`;

const FileUploadDesc = styled.div`
  font-size: 12px;
  color: #64748b;
`;

const FileUploadInput = styled.input`
  display: none;
`;

const FileInfo = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  padding: 8px 16px;
  background: white;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
`;

const FileName = styled.span`
  font-size: 13px;
  color: #1e293b;
  font-weight: 500;
`;

const FileStatus = styled.span`
  font-size: 12px;
  color: ${props => props.success ? '#22c55e' : '#ef4444'};
  display: flex;
  align-items: center;
  gap: 4px;
`;

const MeasurementGroupSection = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
`;

const MeasurementGroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
  border-radius: 12px 12px 0 0;

  &:hover {
    background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
  }
`;

const MeasurementGroupContent = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 18px;

  @media (max-width: 1200px) {
    grid-template-columns: 1fr;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
  min-height: 0;
`;

const ScrollableArea = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 8px;
  display: flex;
  flex-direction: column;
  gap: 20px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
`;

const GroupsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const GroupSection = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
`;

const GroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
  cursor: pointer;
  user-select: none;
  transition: background 0.2s;
  border-radius: 12px 12px 0 0;

  &:hover {
    background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
  }
`;

const GroupTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const FieldCount = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  background: white;
  padding: 2px 8px;
  border-radius: 10px;
`;

const ExpandIcon = styled.div`
  color: #64748b;
`;

const GroupContent = styled.div`
  padding: 18px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  align-content: start;

  @media (min-width: 1800px) {
    grid-template-columns: repeat(6, 1fr);
  }

  @media (min-width: 1500px) and (max-width: 1799px) {
    grid-template-columns: repeat(5, 1fr);
  }

  @media (min-width: 1200px) and (max-width: 1499px) {
    grid-template-columns: repeat(4, 1fr);
  }

  @media (min-width: 900px) and (max-width: 1199px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (min-width: 600px) and (max-width: 899px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 599px) {
    grid-template-columns: 1fr;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 4px;

  .required {
    color: #dc2626;
  }
`;

const Input = styled.input`
  padding: 9px 11px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &:disabled {
    background: #f1f5f9;
    color: #64748b;
    cursor: not-allowed;
  }
`;

const Select = styled.select`
  padding: 9px 11px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }
`;

const DateInputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const DateInput = styled.input`
  padding: 9px 11px;
  padding-right: 34px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  width: 100%;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &::-webkit-calendar-picker-indicator {
    opacity: 0;
    position: absolute;
    right: 0;
    width: 34px;
    height: 100%;
    cursor: pointer;
  }
`;

const CalendarIcon = styled.div`
  position: absolute;
  right: 10px;
  color: #64748b;
  pointer-events: none;
`;

const ButtonGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
`;

const Button = styled.button`
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &.cancel {
    background: white;
    border: 1px solid #d1d5db;
    color: #374151;

    &:hover {
      background: #f3f4f6;
    }
  }

  &.submit {
    background: #8b5cf6;
    border: none;
    color: white;

    &:hover {
      background: #7c3aed;
    }

    &:disabled {
      background: #c4b5fd;
      cursor: not-allowed;
    }
  }
`;

const EmptyMessage = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #64748b;
  font-size: 15px;
`;

const generateId = () => {
  return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const AddDataModal = ({ isOpen, onClose, onSubmit, tabsData = {}, tabOrder = [], title = '데이터 추가', defaultTab = null, initialData = null }) => {
  const [activeTab, setActiveTab] = useState(tabOrder[0] || '');
  const [formData, setFormData] = useState({});
  const [expandedGroups, setExpandedGroups] = useState({});
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState({ success: false, message: '' });
  const [isDragOver, setIsDragOver] = useState(false);
  const [measurementData, setMeasurementData] = useState([]);
  // Freq-Temp Sweep 데이터
  const [tempSweepData, setTempSweepData] = useState([]);
  const [shiftFactorsData, setShiftFactorsData] = useState([]);
  const [masterCurveData, setMasterCurveData] = useState([]);
  const [tempSweepTables, setTempSweepTables] = useState([]); // 테이블 정보
  const fileInputRef = useRef(null);

  const isEditMode = !!initialData;

  useEffect(() => {
    if (isOpen && tabOrder.length > 0) {
      const initialTab = defaultTab && tabOrder.includes(defaultTab) ? defaultTab : tabOrder[0];
      setActiveTab(initialTab);
    }
  }, [isOpen, tabOrder, defaultTab]);

  useEffect(() => {
    if (isOpen && activeTab && tabsData[activeTab]) {
      initializeFormData();
    }
  }, [isOpen, activeTab, initialData]);

  const initializeFormData = () => {
    const currentTab = tabsData[activeTab];
    if (!currentTab) return;

    const newFormData = {};
    const initialExpanded = {};

    currentTab.groups.forEach(group => {
      initialExpanded[group.id] = true;
      group.fields.forEach(field => {
        if (initialData && initialData[field.name] !== undefined) {
          // Edit 모드: 기존 데이터로 채움
          newFormData[field.name] = initialData[field.name];
        } else if (field.type === 'generatedtextbox') {
          newFormData[field.name] = generateId();
        } else {
          newFormData[field.name] = '';
        }
      });
    });

    // 측정 데이터 그룹도 기본 확장
    initialExpanded['measurement-data'] = true;

    setFormData(newFormData);
    setExpandedGroups(initialExpanded);

    // Edit 모드에서 측정 데이터 로드
    if (initialData && initialData.measurementData) {
      setMeasurementData(initialData.measurementData);
    } else {
      setMeasurementData([]);
    }

    // Freq-Temp Sweep 데이터 로드
    if (initialData && initialData.tempSweepData) {
      setTempSweepData(initialData.tempSweepData);
    } else {
      setTempSweepData([]);
    }
    if (initialData && initialData.shiftFactorsData) {
      setShiftFactorsData(initialData.shiftFactorsData);
    } else {
      setShiftFactorsData([]);
    }
    if (initialData && initialData.masterCurveData) {
      setMasterCurveData(initialData.masterCurveData);
    } else {
      setMasterCurveData([]);
    }
    if (initialData && initialData.tempSweepTables) {
      setTempSweepTables(initialData.tempSweepTables);
    } else {
      setTempSweepTables([]);
    }
  };

  const handleChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      let dataToSubmit = formData;

      // Tensile Test 또는 DMA Strain Sweep인 경우 측정 데이터도 함께 전달
      if (activeTab === 'tensile-test' || activeTab === 'dma-strain-sweep') {
        dataToSubmit = { ...formData, measurementData };
      }
      // DMA Freq-Temp Sweep인 경우 3가지 데이터 전달
      else if (activeTab === 'dma-freq-temp-sweep') {
        dataToSubmit = { ...formData, tempSweepData, shiftFactorsData, masterCurveData, tempSweepTables };
      }

      onSubmit(activeTab, dataToSubmit);
    }
    initializeFormData();
    setUploadedFile(null);
    setUploadStatus({ success: false, message: '' });
    onClose();
  };

  const handleClose = () => {
    setUploadedFile(null);
    setUploadStatus({ success: false, message: '' });
    setMeasurementData([]);
    setTempSweepData([]);
    setShiftFactorsData([]);
    setMasterCurveData([]);
    setTempSweepTables([]);
    onClose();
  };

  // 파일 업로드 관련 함수들
  const handleFileSelect = (file) => {
    if (!file) return;

    // 탭에 따라 파일 형식 검증
    if (activeTab === 'tensile-test') {
      if (!isTraFile(file.name)) {
        setUploadStatus({ success: false, message: '지원하지 않는 파일 형식입니다. (.tra 파일만 지원)' });
        return;
      }
    } else if (activeTab === 'dma-strain-sweep') {
      if (!isStrainSweepFile(file.name)) {
        setUploadStatus({ success: false, message: '지원하지 않는 파일 형식입니다. (.csv 파일만 지원)' });
        return;
      }
    } else if (activeTab === 'dma-freq-temp-sweep') {
      if (!isFreqTempFile(file.name)) {
        setUploadStatus({ success: false, message: '지원하지 않는 파일 형식입니다. (.csv 파일만 지원)' });
        return;
      }
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target.result;
        let parsedData, parsedMeasurement, rawFieldCount, measurementCount;

        if (activeTab === 'tensile-test') {
          const result = parseTraFile(content);
          parsedData = result.formData;
          parsedMeasurement = result.measurementData;
          rawFieldCount = result.rawFieldCount;
          measurementCount = result.measurementCount;

          // 측정 데이터 설정
          setMeasurementData(parsedMeasurement);

          setUploadedFile(file);
          setUploadStatus({
            success: true,
            message: `${rawFieldCount}개 필드, ${measurementCount}개 측정 데이터가 입력되었습니다.`
          });
        } else if (activeTab === 'dma-strain-sweep') {
          const result = parseStrainSweepFile(content);
          parsedData = result.formData;
          parsedMeasurement = result.measurementData;
          rawFieldCount = result.rawFieldCount;
          measurementCount = result.measurementCount;

          // 측정 데이터 설정
          setMeasurementData(parsedMeasurement);

          setUploadedFile(file);
          setUploadStatus({
            success: true,
            message: `${rawFieldCount}개 필드, ${measurementCount}개 측정 데이터가 입력되었습니다.`
          });
        } else if (activeTab === 'dma-freq-temp-sweep') {
          const result = parseFreqTempFile(content);
          parsedData = result.formData;
          rawFieldCount = result.rawFieldCount;

          // Freq-Temp 데이터 설정
          setTempSweepData(result.tempSweepData);
          setShiftFactorsData(result.shiftFactorsData);
          setMasterCurveData(result.masterCurveData);
          setTempSweepTables(result.tempSweepTables || []);

          const tableCount = result.tempSweepTables?.length || 0;

          setUploadedFile(file);
          setUploadStatus({
            success: true,
            message: `${rawFieldCount}개 필드, 온도 테이블 ${tableCount}개 (${result.tempSweepCount}행), Shift Factors ${result.shiftFactorsCount}행, Master Curve ${result.masterCurveCount}행`
          });
        }

        // 파싱된 데이터를 폼에 반영
        setFormData(prev => ({
          ...prev,
          ...parsedData,
        }));
      } catch (error) {
        console.error('File parsing error:', error);
        setUploadStatus({ success: false, message: '파일 파싱 중 오류가 발생했습니다.' });
      }
    };
    reader.onerror = () => {
      setUploadStatus({ success: false, message: '파일을 읽을 수 없습니다.' });
    };

    // CSV 파일은 EUC-KR 인코딩으로 읽기 (한글 Windows에서 생성된 파일)
    // TRA 파일은 UTF-8로 읽기
    const encoding = file.name.toLowerCase().endsWith('.csv') ? 'euc-kr' : 'utf-8';
    reader.readAsText(file, encoding);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    handleFileSelect(file);
    e.target.value = ''; // 같은 파일 다시 선택 가능하도록
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // 파일 업로드 지원 탭인지 확인
  const isTensileTestTab = activeTab === 'tensile-test';
  const isDmaStrainSweepTab = activeTab === 'dma-strain-sweep';
  const isDmaFreqTempSweepTab = activeTab === 'dma-freq-temp-sweep';
  const isFileUploadTab = isTensileTestTab || isDmaStrainSweepTab || isDmaFreqTempSweepTab;

  // 파일 확장자 및 설명 가져오기
  const getFileUploadConfig = () => {
    if (isTensileTestTab) {
      return { accept: '.tra', description: 'Tensile Test 결과 파일 (.tra)을 업로드하면 자동으로 필드가 채워집니다.' };
    } else if (isDmaStrainSweepTab) {
      return { accept: '.csv', description: 'DMA Strain Sweep 결과 파일 (.csv)을 업로드하면 자동으로 필드가 채워집니다.' };
    } else if (isDmaFreqTempSweepTab) {
      return { accept: '.csv', description: 'DMA Freq-Temp Sweep 결과 파일 (.csv)을 업로드하면 자동으로 필드가 채워집니다.' };
    }
    return { accept: '', description: '' };
  };

  const fileUploadConfig = getFileUploadConfig();

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const renderField = (field) => {
    switch (field.type) {
      case 'combobox':
        return (
          <Select
            name={field.name}
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            required={field.required}
          >
            <option value="">-- 선택하세요 --</option>
            {(field.options || []).map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
        );

      case 'datepicker':
        return (
          <DateInputWrapper>
            <DateInput
              type="date"
              name={field.name}
              value={formData[field.name] || ''}
              onChange={(e) => handleChange(field.name, e.target.value)}
              required={field.required}
            />
            <CalendarIcon>
              <Calendar size={15} />
            </CalendarIcon>
          </DateInputWrapper>
        );

      case 'generatedtextbox':
        return (
          <Input
            type="text"
            name={field.name}
            value={formData[field.name] || ''}
            disabled
            placeholder="자동 생성됨"
          />
        );

      case 'textbox':
      default:
        return (
          <Input
            type="text"
            name={field.name}
            value={formData[field.name] || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            placeholder={field.placeholder || ''}
            required={field.required}
          />
        );
    }
  };

  const currentTab = tabsData[activeTab];
  const groups = currentTab?.groups || [];
  const hasFields = groups.some(g => g.fields && g.fields.length > 0);

  return (
    <ModalWrapper>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={title}
        maxWidth="80vw"
        className="add-data-modal"
      >
        {tabOrder.length > 1 && (
          <TabsContainer>
            {tabOrder.map(tabId => (
              <Tab
                key={tabId}
                active={activeTab === tabId}
                onClick={() => setActiveTab(tabId)}
              >
                {tabsData[tabId]?.label || tabId}
              </Tab>
            ))}
          </TabsContainer>
        )}

        <ContentArea>
          <Form onSubmit={handleSubmit}>
            <ScrollableArea>
              {isFileUploadTab && (
                <FileUploadSection>
                  <FileUploadArea
                    isDragOver={isDragOver}
                    hasFile={!!uploadedFile}
                    onClick={handleUploadClick}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <FileUploadIcon hasFile={!!uploadedFile}>
                      {uploadedFile ? <CheckCircle size={24} /> : <Upload size={24} />}
                    </FileUploadIcon>
                    <FileUploadTitle>
                      {uploadedFile ? '파일 업로드 완료' : `${fileUploadConfig.accept} 파일을 드래그하거나 클릭하여 업로드`}
                    </FileUploadTitle>
                    <FileUploadDesc>
                      {fileUploadConfig.description}
                    </FileUploadDesc>
                    {uploadedFile && (
                      <FileInfo>
                        <FileText size={16} />
                        <FileName>{uploadedFile.name}</FileName>
                        <FileStatus success={uploadStatus.success}>
                          {uploadStatus.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                          {uploadStatus.message}
                        </FileStatus>
                      </FileInfo>
                    )}
                    {!uploadedFile && uploadStatus.message && (
                      <FileInfo>
                        <FileStatus success={uploadStatus.success}>
                          <AlertCircle size={14} />
                          {uploadStatus.message}
                        </FileStatus>
                      </FileInfo>
                    )}
                  </FileUploadArea>
                  <FileUploadInput
                    ref={fileInputRef}
                    type="file"
                    accept={fileUploadConfig.accept}
                    onChange={handleFileInputChange}
                  />
                </FileUploadSection>
              )}

              <GroupsContainer>
              {!hasFields ? (
                <EmptyMessage>
                  설정에서 입력 필드를 추가해주세요.
                </EmptyMessage>
              ) : (
                groups.map((group, groupIndex) => (
                  <React.Fragment key={group.id}>
                    <GroupSection>
                      <GroupHeader onClick={() => toggleGroup(group.id)}>
                        <GroupTitle>
                          {group.title}
                          <FieldCount>{group.fields.length}개 필드</FieldCount>
                        </GroupTitle>
                        <ExpandIcon>
                          {expandedGroups[group.id] ? (
                            <ChevronUp size={18} />
                          ) : (
                            <ChevronDown size={18} />
                          )}
                        </ExpandIcon>
                      </GroupHeader>

                      {expandedGroups[group.id] && (
                        <GroupContent>
                          {group.fields.map(field => (
                            <FormGroup key={field.id}>
                              <Label>
                                {field.label}
                                {field.required && <span className="required">*</span>}
                              </Label>
                              {renderField(field)}
                            </FormGroup>
                          ))}
                        </GroupContent>
                      )}
                    </GroupSection>

                    {/* Tensile Test 측정 데이터 섹션: Test Result 그룹 다음에 표시 */}
                    {isTensileTestTab && group.id === 'group_test_result' && (
                      <MeasurementGroupSection>
                        <MeasurementGroupHeader onClick={() => toggleGroup('measurement-data')}>
                          <GroupTitle>
                            측정 데이터
                            <FieldCount>{measurementData.length}개 행</FieldCount>
                          </GroupTitle>
                          <ExpandIcon>
                            {expandedGroups['measurement-data'] ? (
                              <ChevronUp size={18} />
                            ) : (
                              <ChevronDown size={18} />
                            )}
                          </ExpandIcon>
                        </MeasurementGroupHeader>

                        {expandedGroups['measurement-data'] && (
                          <MeasurementGroupContent>
                            <MeasurementDataTable
                              data={measurementData}
                              onChange={setMeasurementData}
                            />
                            <MeasurementChart data={measurementData} />
                          </MeasurementGroupContent>
                        )}
                      </MeasurementGroupSection>
                    )}

                    {/* DMA Strain Sweep 측정 데이터 섹션: Test Result 그룹 다음에 표시 */}
                    {isDmaStrainSweepTab && group.id === 'group_dma_ss_test_result' && (
                      <MeasurementGroupSection>
                        <MeasurementGroupHeader onClick={() => toggleGroup('measurement-data')}>
                          <GroupTitle>
                            Strain Sweep 데이터
                            <FieldCount>{measurementData.length}개 행</FieldCount>
                          </GroupTitle>
                          <ExpandIcon>
                            {expandedGroups['measurement-data'] ? (
                              <ChevronUp size={18} />
                            ) : (
                              <ChevronDown size={18} />
                            )}
                          </ExpandIcon>
                        </MeasurementGroupHeader>

                        {expandedGroups['measurement-data'] && (
                          <MeasurementGroupContent>
                            <StrainSweepDataTable
                              data={measurementData}
                              onChange={setMeasurementData}
                            />
                            <StrainSweepChart data={measurementData} />
                          </MeasurementGroupContent>
                        )}
                      </MeasurementGroupSection>
                    )}

                    {/* DMA Freq-Temp Sweep 측정 데이터 섹션: Test Result 그룹 다음에 표시 */}
                    {isDmaFreqTempSweepTab && group.id === 'group_dma_ft_test_result' && (
                      <MeasurementGroupSection>
                        <MeasurementGroupHeader onClick={() => toggleGroup('measurement-data')}>
                          <GroupTitle>
                            Freq-Temp Sweep 데이터
                            <FieldCount>
                              온도 스윕 {tempSweepData.length} / Shift Factors {shiftFactorsData.length} / Master Curve {masterCurveData.length}
                            </FieldCount>
                          </GroupTitle>
                          <ExpandIcon>
                            {expandedGroups['measurement-data'] ? (
                              <ChevronUp size={18} />
                            ) : (
                              <ChevronDown size={18} />
                            )}
                          </ExpandIcon>
                        </MeasurementGroupHeader>

                        {expandedGroups['measurement-data'] && (
                          <MeasurementGroupContent>
                            <FreqTempDataTable
                              tempSweepData={tempSweepData}
                              shiftFactorsData={shiftFactorsData}
                              masterCurveData={masterCurveData}
                              tempSweepTables={tempSweepTables}
                            />
                            <FreqTempChart
                              tempSweepData={tempSweepData}
                              shiftFactorsData={shiftFactorsData}
                              masterCurveData={masterCurveData}
                              tempSweepTables={tempSweepTables}
                            />
                          </MeasurementGroupContent>
                        )}
                      </MeasurementGroupSection>
                    )}
                  </React.Fragment>
                ))
              )}
            </GroupsContainer>
            </ScrollableArea>

            <ButtonGroup>
              <Button type="button" className="cancel" onClick={handleClose}>
                취소
              </Button>
              <Button type="submit" className="submit" disabled={!hasFields}>
                {isEditMode ? '수정' : '추가'}
              </Button>
            </ButtonGroup>
          </Form>
        </ContentArea>
      </Modal>
    </ModalWrapper>
  );
};

export default AddDataModal;
