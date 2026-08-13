import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { Package, ChevronDown, ChevronUp, Plus, Edit2, Trash2, FlaskConical, Activity, Waves, Database, FileText, Download, Upload } from 'lucide-react';
import { MeasurementDataTable, MeasurementChart, StrainSweepDataTable, StrainSweepChart, FreqTempDataTable, FreqTempChart } from '../MeasurementData';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f1f5f9;
  overflow: hidden;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #94a3b8;
  text-align: center;

  svg {
    margin-bottom: 16px;
    opacity: 0.3;
  }

  h3 {
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 500;
    color: #64748b;
  }

  p {
    margin: 0;
    font-size: 13px;
  }
`;

const ScrollContainer = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
`;

const MaterialHeader = styled.div`
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const MaterialHeaderTop = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
`;

const MaterialIcon = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
`;

const MaterialHeaderInfo = styled.div`
  flex: 1;
`;

const MaterialTitle = styled.h2`
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
`;

const MaterialSubtitle = styled.p`
  margin: 0;
  font-size: 13px;
  color: #64748b;
`;

const MaterialActions = styled.div`
  display: flex;
  gap: 8px;
`;

const ActionButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f8fafc;
    color: #1e293b;
  }

  &.delete:hover {
    background: #fee2e2;
    border-color: #fecaca;
    color: #dc2626;
  }
`;

const MaterialProperties = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
`;

const PropertyItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const PropertyLabel = styled.span`
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const PropertyValue = styled.span`
  font-size: 13px;
  color: #1e293b;
  font-weight: 500;
`;

const TestsSection = styled.div`
  margin-bottom: 20px;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const SectionTitle = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const AddTestButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: #8b5cf6;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #7c3aed;
  }
`;

const BulkAddTestButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: #3b82f6;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #2563eb;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Divider = styled.div`
  width: 1px;
  height: 24px;
  background: #e2e8f0;
  margin: 0 4px;
`;

const ExportTestButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: #10b981;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #059669;
  }

  &:disabled {
    background: #d1d5db;
    cursor: not-allowed;
  }
`;

const ImportTestButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: #f59e0b;
  color: white;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #d97706;
  }
`;

const HiddenInput = styled.input`
  display: none;
`;

const TestTypesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const TestTypeCard = styled.div`
  background: white;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const TestTypeHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%);
  color: #334155;
  cursor: pointer;
  border-radius: ${props => props.isExpanded ? '10px 10px 0 0' : '10px'};
  transition: border-radius 0.2s;

  &:hover {
    background: linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%);
  }
`;

const TestTypeInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const TestTypeIcon = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: #8b5cf6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
`;

const TestTypeName = styled.span`
  font-size: 13px;
  font-weight: 600;
`;

const TestCount = styled.span`
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: white;
  color: #64748b;
  border: 1px solid #e2e8f0;
`;

const TestTypeBody = styled.div`
  padding: 12px 16px;
`;

const TestInstancesContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
`;

const TestInstance = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
`;

const TestInstanceHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: ${props => props.isExpanded ? '#f1f5f9' : '#f8fafc'};
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #f1f5f9;
  }
`;

const TestInstanceInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
`;

const TestInstanceIcon = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
`;

const TestInstanceTitle = styled.div`
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
`;

const TestInstanceMeta = styled.div`
  font-size: 11px;
  color: #64748b;
  margin-top: 2px;
`;

const FileBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 8px;
  background: #dcfce7;
  border: 1px solid #86efac;
  border-radius: 10px;
  font-size: 10px;
  color: #166534;
  margin-left: 8px;
  max-width: 180px;

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100px;
  }
`;

const DownloadButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #166534;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #bbf7d0;
    color: #15803d;
  }
`;

const TestInstanceActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const TestInstanceBody = styled.div`
  padding: 16px;
  border-top: 1px solid #e2e8f0;
  background: #fafbfc;
`;

const TestInstanceFieldsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
`;

const TestFieldItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 10px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
`;

const TestFieldLabel = styled.span`
  font-size: 10px;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const TestFieldValue = styled.span`
  font-size: 12px;
  color: #1e293b;
  font-weight: 500;
  word-break: break-word;
`;

const MeasurementDataViewSection = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;

  @media (max-width: 1400px) {
    grid-template-columns: 1fr;
  }
`;

const SmallButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 5px;
  background: white;
  color: #64748b;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f1f5f9;
    color: #1e293b;
    border-color: #cbd5e1;
  }

  &.delete:hover {
    background: #fee2e2;
    border-color: #fecaca;
    color: #dc2626;
  }

  &.download {
    background: #ecfdf5;
    border-color: #a7f3d0;
    color: #059669;

    &:hover {
      background: #d1fae5;
      border-color: #6ee7b7;
      color: #047857;
    }
  }
`;

const EmptyTestState = styled.div`
  padding: 20px;
  text-align: center;
  color: #94a3b8;
  font-size: 12px;
`;

const AddTestCardButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px;
  border: 1px dashed #d1d5db;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #8b5cf6;
    color: #8b5cf6;
    background: #faf5ff;
  }
`;

const TEST_TYPE_CONFIG = {
  'tensile-test': {
    label: 'Tensile Test',
    icon: Activity,
    specimenField: 'specimenNumber',
  },
  'dma-strain-sweep': {
    label: 'DMA Strain Sweep',
    icon: Waves,
    specimenField: 'dmaSSSpecimenNumber',
  },
  'dma-freq-temp-sweep': {
    label: 'DMA Freq-Temp Sweep',
    icon: FlaskConical,
    specimenField: 'dmaFTSpecimenNumber',
  },
};

const MaterialDetailPanel = ({
  material,
  tabsData,
  tabOrder,
  onEditMaterial,
  onDeleteMaterial,
  onAddTest,
  onBulkAddTest,
  onViewTest,
  onDeleteTest,
  onExportTests,
  onImportTests
}) => {
  const [expandedTypes, setExpandedTypes] = useState({});
  const [expandedInstances, setExpandedInstances] = useState({});
  const testFileInputRef = useRef(null);

  const handleImportClick = () => {
    testFileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && material) {
      onImportTests(material.id, file);
      e.target.value = '';
    }
  };

  const getTestCount = () => {
    if (!material?.tests) return 0;
    let count = 0;
    Object.values(material.tests).forEach(tests => {
      count += tests.length;
    });
    return count;
  };

  if (!material) {
    return (
      <Container>
        <EmptyState>
          <Package size={64} />
          <h3>Material을 선택하세요</h3>
          <p>좌측 목록에서 Material을 선택하면<br />상세 정보가 표시됩니다.</p>
        </EmptyState>
      </Container>
    );
  }

  const toggleExpand = (typeId) => {
    setExpandedTypes(prev => ({
      ...prev,
      [typeId]: !prev[typeId]
    }));
  };

  const toggleInstance = (instanceId) => {
    setExpandedInstances(prev => ({
      ...prev,
      [instanceId]: !prev[instanceId]
    }));
  };

  // 파일 다운로드 핸들러
  const handleDownloadFile = (e, fileName, fileData, fileType) => {
    e.stopPropagation();

    if (!fileData) {
      alert('다운로드할 파일 데이터가 없습니다.');
      return;
    }

    try {
      // Base64 데이터에서 실제 데이터 부분 추출
      const base64Data = fileData.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: fileType || 'application/octet-stream' });

      // 다운로드 링크 생성 및 클릭
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('파일 다운로드 오류:', error);
      alert('파일 다운로드에 실패했습니다.');
    }
  };

  const getTestFields = (typeId) => {
    const tabData = tabsData[typeId];
    if (!tabData || !tabData.groups) return [];

    const allFields = [];
    tabData.groups.forEach(group => {
      if (group.fields) {
        group.fields.forEach(field => {
          allFields.push({
            name: field.name,
            label: field.label,
            type: field.type,
          });
        });
      }
    });
    return allFields;
  };

  const getMaterialDisplayName = () => {
    const family = material.data?.family || '';
    const category = material.data?.category || '';
    const grade = material.data?.grade || '';

    if (family || category) {
      return `${family}${category ? ' / ' + category : ''}${grade ? ' / ' + grade : ''}`;
    }
    return 'Unnamed Material';
  };

  const getTestTypes = () => {
    return tabOrder.filter(tabId => tabId !== 'technical-data');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
  };

  const getPropertyValue = (key) => {
    return material.data?.[key] || '-';
  };

  return (
    <Container>
      <ScrollContainer>
        <MaterialHeader>
          <MaterialHeaderTop>
            <MaterialIcon>
              <Package size={24} />
            </MaterialIcon>
            <MaterialHeaderInfo>
              <MaterialTitle>{getMaterialDisplayName()}</MaterialTitle>
              <MaterialSubtitle>
                {material.data?.specThickness ? `${material.data.specThickness}mm` : ''}
                {material.data?.orientation ? ` • ${material.data.orientation}` : ''}
                {material.createdAt ? ` • 등록: ${formatDate(material.createdAt)}` : ''}
              </MaterialSubtitle>
            </MaterialHeaderInfo>
            <MaterialActions>
              <ActionButton onClick={() => onEditMaterial(material.id)} title="수정">
                <Edit2 size={14} />
              </ActionButton>
              <ActionButton className="delete" onClick={() => onDeleteMaterial(material.id)} title="삭제">
                <Trash2 size={14} />
              </ActionButton>
            </MaterialActions>
          </MaterialHeaderTop>

          <MaterialProperties>
            <PropertyItem>
              <PropertyLabel>Family</PropertyLabel>
              <PropertyValue>{getPropertyValue('family')}</PropertyValue>
            </PropertyItem>
            <PropertyItem>
              <PropertyLabel>Category</PropertyLabel>
              <PropertyValue>{getPropertyValue('category')}</PropertyValue>
            </PropertyItem>
            <PropertyItem>
              <PropertyLabel>Grade</PropertyLabel>
              <PropertyValue>{getPropertyValue('grade')}</PropertyValue>
            </PropertyItem>
            <PropertyItem>
              <PropertyLabel>Thickness</PropertyLabel>
              <PropertyValue>{getPropertyValue('specThickness')}mm</PropertyValue>
            </PropertyItem>
            <PropertyItem>
              <PropertyLabel>Orientation</PropertyLabel>
              <PropertyValue>{getPropertyValue('orientation')}</PropertyValue>
            </PropertyItem>
            <PropertyItem>
              <PropertyLabel>Manufacturer</PropertyLabel>
              <PropertyValue>{getPropertyValue('manufacturer')}</PropertyValue>
            </PropertyItem>
          </MaterialProperties>
        </MaterialHeader>

        <TestsSection>
          <SectionHeader>
            <SectionTitle>
              <FlaskConical size={16} />
              물성 시험 데이터
            </SectionTitle>
            <ButtonGroup>
              <AddTestButton onClick={() => onAddTest(material.id)}>
                <Plus size={14} />
                시험 데이터 추가
              </AddTestButton>
              <BulkAddTestButton onClick={() => onBulkAddTest(material.id)}>
                <Database size={14} />
                여러 시험 데이터 추가
              </BulkAddTestButton>
              <Divider />
              <ExportTestButton
                onClick={() => onExportTests(material.id)}
                disabled={getTestCount() === 0}
                title={getTestCount() === 0 ? '내보낼 시험 데이터가 없습니다' : ''}
              >
                <Download size={14} />
                JSON 내보내기
              </ExportTestButton>
              <ImportTestButton onClick={handleImportClick}>
                <Upload size={14} />
                JSON 가져오기
              </ImportTestButton>
              <HiddenInput
                ref={testFileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
              />
            </ButtonGroup>
          </SectionHeader>

          <TestTypesContainer>
            {getTestTypes().map(typeId => {
              const config = TEST_TYPE_CONFIG[typeId] || {
                label: tabsData[typeId]?.label || typeId,
                icon: FlaskConical,
                specimenField: 'specimenNumber'
              };
              const IconComponent = config.icon || FlaskConical;
              const tests = material.tests?.[typeId] || [];
              const isTypeExpanded = expandedTypes[typeId] !== false;
              const testFields = getTestFields(typeId);

              return (
                <TestTypeCard key={typeId}>
                  <TestTypeHeader isExpanded={isTypeExpanded} onClick={() => toggleExpand(typeId)}>
                    <TestTypeInfo>
                      <TestTypeIcon>
                        <IconComponent size={16} />
                      </TestTypeIcon>
                      <TestTypeName>{config.label}</TestTypeName>
                    </TestTypeInfo>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <TestCount>{tests.length}건</TestCount>
                      {isTypeExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </TestTypeHeader>

                  {isTypeExpanded && (
                    <TestTypeBody>
                      {tests.length > 0 && (
                        <TestInstancesContainer>
                          {tests.map(test => {
                            const instanceName = test.data?.testInstanceName || `Test #${test.id.slice(-4)}`;
                            const specimenNumber = test.data?.[config.specimenField];
                            const isInstanceExpanded = expandedInstances[test.id] === true;

                            return (
                              <TestInstance key={test.id}>
                                <TestInstanceHeader
                                  isExpanded={isInstanceExpanded}
                                  onClick={() => toggleInstance(test.id)}
                                >
                                  <TestInstanceInfo>
                                    <TestInstanceIcon>
                                      <IconComponent size={14} />
                                    </TestInstanceIcon>
                                    <div>
                                      <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <TestInstanceTitle>{instanceName}</TestInstanceTitle>
                                        {test.data?.uploadedFileName && (
                                          <FileBadge title={test.data.uploadedFileName}>
                                            <FileText size={10} />
                                            <span>{test.data.uploadedFileName}</span>
                                          </FileBadge>
                                        )}
                                      </div>
                                      <TestInstanceMeta>
                                        {specimenNumber && `Specimen: ${specimenNumber} • `}등록: {formatDate(test.createdAt)}
                                      </TestInstanceMeta>
                                    </div>
                                  </TestInstanceInfo>
                                  <TestInstanceActions>
                                    <SmallButton onClick={(e) => { e.stopPropagation(); onViewTest(material.id, typeId, test.id); }}>
                                      <Edit2 size={12} />
                                      수정
                                    </SmallButton>
                                    <SmallButton className="delete" onClick={(e) => { e.stopPropagation(); onDeleteTest(material.id, typeId, test.id); }}>
                                      <Trash2 size={12} />
                                      삭제
                                    </SmallButton>
                                    {test.data?.uploadedFileData && (
                                      <SmallButton
                                        className="download"
                                        onClick={(e) => handleDownloadFile(
                                          e,
                                          test.data.uploadedFileName,
                                          test.data.uploadedFileData,
                                          test.data.uploadedFileType
                                        )}
                                      >
                                        <Download size={12} />
                                        원본 다운로드
                                      </SmallButton>
                                    )}
                                    {isInstanceExpanded ? <ChevronUp size={16} style={{ marginLeft: 4, color: '#64748b' }} /> : <ChevronDown size={16} style={{ marginLeft: 4, color: '#64748b' }} />}
                                  </TestInstanceActions>
                                </TestInstanceHeader>

                                {isInstanceExpanded && (
                                  <TestInstanceBody>
                                    <TestInstanceFieldsGrid>
                                      {testFields.map(field => (
                                        <TestFieldItem key={field.name}>
                                          <TestFieldLabel>{field.label}</TestFieldLabel>
                                          <TestFieldValue>
                                            {test.data?.[field.name] || '-'}
                                          </TestFieldValue>
                                        </TestFieldItem>
                                      ))}
                                    </TestInstanceFieldsGrid>

                                    {/* Tensile Test의 측정 데이터 표시 */}
                                    {typeId === 'tensile-test' && test.data?.measurementData && test.data.measurementData.length > 0 && (
                                      <MeasurementDataViewSection>
                                        <MeasurementDataTable
                                          data={test.data.measurementData}
                                          readOnly
                                        />
                                        <MeasurementChart data={test.data.measurementData} />
                                      </MeasurementDataViewSection>
                                    )}

                                    {/* DMA Strain Sweep의 측정 데이터 표시 */}
                                    {typeId === 'dma-strain-sweep' && test.data?.measurementData && test.data.measurementData.length > 0 && (
                                      <MeasurementDataViewSection>
                                        <StrainSweepDataTable
                                          data={test.data.measurementData}
                                          readOnly
                                        />
                                        <StrainSweepChart data={test.data.measurementData} />
                                      </MeasurementDataViewSection>
                                    )}

                                    {/* DMA Freq-Temp Sweep의 측정 데이터 표시 */}
                                    {typeId === 'dma-freq-temp-sweep' && (test.data?.tempSweepData?.length > 0 || test.data?.shiftFactorsData?.length > 0 || test.data?.masterCurveData?.length > 0) && (
                                      <MeasurementDataViewSection>
                                        <FreqTempDataTable
                                          tempSweepData={test.data.tempSweepData || []}
                                          shiftFactorsData={test.data.shiftFactorsData || []}
                                          masterCurveData={test.data.masterCurveData || []}
                                          tempSweepTables={test.data.tempSweepTables || []}
                                          readOnly
                                        />
                                        <FreqTempChart
                                          tempSweepData={test.data.tempSweepData || []}
                                          shiftFactorsData={test.data.shiftFactorsData || []}
                                          masterCurveData={test.data.masterCurveData || []}
                                          tempSweepTables={test.data.tempSweepTables || []}
                                        />
                                      </MeasurementDataViewSection>
                                    )}
                                  </TestInstanceBody>
                                )}
                              </TestInstance>
                            );
                          })}
                        </TestInstancesContainer>
                      )}

                      {tests.length === 0 && (
                        <EmptyTestState>등록된 테스트가 없습니다.</EmptyTestState>
                      )}

                      <AddTestCardButton onClick={() => onAddTest(material.id, typeId)}>
                        <Plus size={12} />
                        {config.label} 추가
                      </AddTestCardButton>
                    </TestTypeBody>
                  )}
                </TestTypeCard>
              );
            })}
          </TestTypesContainer>
        </TestsSection>
      </ScrollContainer>
    </Container>
  );
};

export default MaterialDetailPanel;
