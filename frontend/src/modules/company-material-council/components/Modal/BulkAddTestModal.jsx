import React, { useState, useMemo, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { X, Database, CheckCircle, AlertCircle, Info, Upload, FileText, Link2, Unlink, Trash2, Plus, Copy, Wand2 } from 'lucide-react';

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

const TabContainer = styled.div`
  display: flex;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 1rem;
`;

const Tab = styled.button`
  padding: 1rem 1.5rem;
  background: ${props => props.active ? 'white' : 'transparent'};
  border: none;
  border-bottom: 3px solid ${props => props.active ? '#8b5cf6' : 'transparent'};
  color: ${props => props.active ? '#8b5cf6' : '#64748b'};
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &:hover {
    color: #8b5cf6;
    background: ${props => props.active ? 'white' : '#f1f5f9'};
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

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 1rem;
  flex: 1;
  min-height: 0;
`;

const TableSection = styled.div`
  display: flex;
  flex-direction: column;
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  overflow: hidden;
  background: white;
`;

const FileSection = styled.div`
  display: flex;
  flex-direction: column;
  border: 2px solid #e5e7eb;
  border-radius: 0.75rem;
  overflow: hidden;
  background: white;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;

  h3 {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 600;
    color: #1e293b;
  }
`;

const TableActions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button`
  padding: 0.4rem 0.6rem;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  border: 1px solid;

  &.add {
    background: #10b981;
    color: white;
    border-color: #059669;

    &:hover {
      background: #059669;
    }
  }

  &.paste {
    background: #3b82f6;
    color: white;
    border-color: #2563eb;

    &:hover {
      background: #2563eb;
    }
  }

  &.clear {
    background: #ef4444;
    color: white;
    border-color: #dc2626;

    &:hover {
      background: #dc2626;
    }
  }

  &.match {
    background: #8b5cf6;
    color: white;
    border-color: #7c3aed;

    &:hover {
      background: #7c3aed;
    }

    &:disabled {
      background: #d1d5db;
      border-color: #9ca3af;
      cursor: not-allowed;
    }
  }
`;

const TableWrapper = styled.div`
  flex: 1;
  overflow: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
`;

const TableHead = styled.thead`
  background: #f1f5f9;
  position: sticky;
  top: 0;
  z-index: 10;
`;

const TableBody = styled.tbody``;

const HeaderCell = styled.th`
  padding: 0.5rem;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  background: #f8fafc;
  white-space: nowrap;
  min-width: 100px;

  &.required::after {
    content: '*';
    color: #ef4444;
    margin-left: 0.25rem;
  }

  &:last-child {
    border-right: none;
  }
`;

const TableRow = styled.tr`
  &:nth-child(even) {
    background: #f9fafb;
  }

  &:hover {
    background: #f3f4f6;
  }

  &.has-file {
    background: #f0fdf4;
    &:hover {
      background: #dcfce7;
    }
  }
`;

const TableCell = styled.td`
  padding: 0.4rem;
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  vertical-align: middle;

  &:last-child {
    border-right: none;
  }

  &.actions {
    width: 50px;
    text-align: center;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 0.3rem 0.4rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  font-size: 0.8rem;
  background: white;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const Select = styled.select`
  width: 100%;
  padding: 0.3rem 0.4rem;
  border: 1px solid #d1d5db;
  border-radius: 0.25rem;
  font-size: 0.8rem;
  background: white;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const FileCell = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem;
  background: ${props => props.hasFile ? '#dcfce7' : '#f1f5f9'};
  border-radius: 0.25rem;
  min-height: 28px;
`;

const FileName = styled.span`
  font-size: 0.75rem;
  color: ${props => props.hasFile ? '#166534' : '#94a3b8'};
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FileActionButton = styled.button`
  padding: 0.15rem;
  background: transparent;
  border: none;
  cursor: pointer;
  color: ${props => props.danger ? '#ef4444' : '#64748b'};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.25rem;

  &:hover {
    background: ${props => props.danger ? '#fee2e2' : '#e2e8f0'};
  }
`;

const RowNumber = styled.div`
  background: #f1f5f9;
  color: #64748b;
  text-align: center;
  font-weight: 500;
  font-size: 0.7rem;
  padding: 0.2rem;
  min-width: 30px;
`;

const DeleteButton = styled.button`
  padding: 0.2rem;
  background: #fee2e2;
  color: #dc2626;
  border: 1px solid #fecaca;
  border-radius: 0.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: #fecaca;
  }
`;

const DropZone = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  border: 2px dashed ${props => props.isDragOver ? '#8b5cf6' : '#d1d5db'};
  border-radius: 0.5rem;
  margin: 0.75rem;
  background: ${props => props.isDragOver ? '#f5f3ff' : '#f9fafb'};
  transition: all 0.2s;
  cursor: pointer;

  &:hover {
    border-color: #8b5cf6;
    background: #f5f3ff;
  }
`;

const DropZoneIcon = styled.div`
  color: ${props => props.isDragOver ? '#8b5cf6' : '#94a3b8'};
  margin-bottom: 0.5rem;
`;

const DropZoneText = styled.div`
  font-size: 0.85rem;
  color: #64748b;
  text-align: center;

  strong {
    color: #8b5cf6;
  }
`;

const FileList = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
`;

const FileItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: ${props => props.matched ? '#dcfce7' : props.selected ? '#dbeafe' : '#f8fafc'};
  border: 1px solid ${props => props.matched ? '#86efac' : props.selected ? '#93c5fd' : '#e2e8f0'};
  border-radius: 0.375rem;
  margin-bottom: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: ${props => props.matched ? '#bbf7d0' : '#e0f2fe'};
  }
`;

const FileItemIcon = styled.div`
  color: ${props => props.matched ? '#16a34a' : '#3b82f6'};
`;

const FileItemInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const FileItemName = styled.div`
  font-size: 0.8rem;
  font-weight: 500;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FileItemStatus = styled.div`
  font-size: 0.7rem;
  color: ${props => props.matched ? '#16a34a' : '#94a3b8'};
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const FileItemActions = styled.div`
  display: flex;
  gap: 0.25rem;
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

  &.warning {
    color: #d97706;
  }
`;

const PasteModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10000;
`;

const PasteModalContainer = styled.div`
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
`;

const PasteModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 2px solid #e5e7eb;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border-radius: 0.75rem 0.75rem 0 0;
`;

const PasteModalBody = styled.div`
  padding: 1.5rem;
  flex: 1;
  overflow: auto;
`;

const PasteTextArea = styled.textarea`
  width: 100%;
  min-height: 250px;
  padding: 1rem;
  border: 2px solid #d1d5db;
  border-radius: 0.5rem;
  font-size: 0.85rem;
  font-family: 'Courier New', monospace;
  resize: vertical;

  &:focus {
    outline: none;
    border-color: #3b82f6;
  }
`;

const PasteModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 2px solid #e5e7eb;
  background: #f9fafb;
  border-radius: 0 0 0.75rem 0.75rem;
`;

const TEST_TYPES = [
  { id: 'tensile-test', label: 'Tensile Test', fileExt: '.tra' },
  { id: 'dma-strain-sweep', label: 'DMA Strain Sweep', fileExt: '.csv' },
  { id: 'dma-freq-temp-sweep', label: 'DMA Freq-Temp Sweep', fileExt: '.csv' }
];

const BulkAddTestModal = ({ isOpen, onClose, onApply, tabsData = {}, materialId }) => {
  const [activeTestType, setActiveTestType] = useState('tensile-test');
  const [tableDataByType, setTableDataByType] = useState({
    'tensile-test': [{}],
    'dma-strain-sweep': [{}],
    'dma-freq-temp-sweep': [{}]
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileMatching, setFileMatching] = useState({}); // { rowIndex: file }
  const [selectedFileIndex, setSelectedFileIndex] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const fileInputRef = useRef(null);
  const textAreaRef = useRef(null);

  const tableData = tableDataByType[activeTestType] || [{}];

  // 현재 테스트 타입의 헤더 생성
  const headers = useMemo(() => {
    const testTypeData = tabsData[activeTestType];
    if (!testTypeData || !testTypeData.groups) return [];

    const allHeaders = [];

    testTypeData.groups.forEach(group => {
      if (group.fields) {
        group.fields.forEach(field => {
          if (field.type === 'generatedtextbox') return;

          allHeaders.push({
            key: field.name,
            label: field.label,
            required: field.required || false,
            type: field.type === 'textbox' ? 'text' : field.type === 'datepicker' ? 'date' : 'text',
            placeholder: field.placeholder || '',
            options: field.options || [],
            width: field.name.length > 15 ? '180px' : '120px'
          });
        });
      }
    });

    return allHeaders;
  }, [tabsData, activeTestType]);

  const currentFileExt = TEST_TYPES.find(t => t.id === activeTestType)?.fileExt || '';

  // 테이블 데이터 업데이트
  const setTableData = useCallback((newData) => {
    setTableDataByType(prev => ({
      ...prev,
      [activeTestType]: newData
    }));
  }, [activeTestType]);

  // 행 추가
  const addRow = useCallback(() => {
    setTableData([...tableData, {}]);
  }, [tableData, setTableData]);

  // 행 삭제
  const deleteRow = useCallback((index) => {
    if (tableData.length <= 1) return;
    setTableData(tableData.filter((_, i) => i !== index));

    // 파일 매칭 업데이트
    const newMatching = {};
    Object.entries(fileMatching).forEach(([rowIdx, file]) => {
      const idx = parseInt(rowIdx);
      if (idx < index) {
        newMatching[idx] = file;
      } else if (idx > index) {
        newMatching[idx - 1] = file;
      }
    });
    setFileMatching(newMatching);
  }, [tableData, setTableData, fileMatching]);

  // 셀 업데이트
  const updateCell = useCallback((rowIndex, key, value) => {
    const newData = [...tableData];
    if (!newData[rowIndex]) {
      newData[rowIndex] = {};
    }
    newData[rowIndex][key] = value;
    setTableData(newData);
  }, [tableData, setTableData]);

  // 전체 삭제
  const clearAll = useCallback(() => {
    if (window.confirm('모든 데이터를 삭제하시겠습니까?')) {
      setTableData([{}]);
      setFileMatching({});
    }
  }, [setTableData]);

  // 파일 드롭 핸들러
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      return ext === currentFileExt;
    });

    if (files.length === 0) {
      alert(`${currentFileExt} 파일만 업로드할 수 있습니다.`);
      return;
    }

    setUploadedFiles(prev => [...prev, ...files]);
  }, [currentFileExt]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  // 파일 선택 핸들러
  const handleFileSelect = useCallback((e) => {
    const files = Array.from(e.target.files).filter(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      return ext === currentFileExt;
    });

    if (files.length > 0) {
      setUploadedFiles(prev => [...prev, ...files]);
    }
    e.target.value = '';
  }, [currentFileExt]);

  // 자동 파일 매칭 (파일명 기반) - 버튼 클릭 시 실행
  const handleAutoMatch = useCallback(() => {
    if (uploadedFiles.length === 0) {
      alert('업로드된 파일이 없습니다.');
      return;
    }

    if (tableData.length === 0 || (tableData.length === 1 && Object.keys(tableData[0]).length === 0)) {
      alert('테이블에 데이터가 없습니다. 먼저 테이블을 작성해주세요.');
      return;
    }

    const newMatching = {};
    let matchedCount = 0;

    // 1단계: 파일명과 testInstanceName 매칭 시도
    uploadedFiles.forEach(file => {
      const fileName = file.name.toLowerCase().replace(currentFileExt, '');

      for (let i = 0; i < tableData.length; i++) {
        if (newMatching[i]) continue; // 이미 매칭된 행 스킵

        const row = tableData[i];
        const testInstanceName = (row.testInstanceName || '').toLowerCase();

        // 파일명에 testInstanceName이 포함되어 있거나 그 반대
        if (testInstanceName && (fileName.includes(testInstanceName) || testInstanceName.includes(fileName))) {
          newMatching[i] = file;
          matchedCount++;
          break;
        }
      }
    });

    // 2단계: 매칭되지 않은 파일들을 빈 행에 순서대로 매칭
    uploadedFiles.forEach(file => {
      // 이미 매칭된 파일인지 확인
      const isAlreadyMatched = Object.values(newMatching).some(f => f.name === file.name);
      if (isAlreadyMatched) return;

      for (let i = 0; i < tableData.length; i++) {
        if (!newMatching[i]) {
          newMatching[i] = file;
          matchedCount++;
          break;
        }
      }
    });

    setFileMatching(newMatching);
    alert(`${matchedCount}개의 파일이 매칭되었습니다.`);
  }, [uploadedFiles, tableData, currentFileExt]);

  // 수동 파일 매칭
  const matchFileToRow = useCallback((rowIndex) => {
    if (selectedFileIndex === null) return;

    const file = uploadedFiles[selectedFileIndex];
    if (!file) return;

    setFileMatching(prev => ({
      ...prev,
      [rowIndex]: file
    }));
    setSelectedFileIndex(null);
  }, [selectedFileIndex, uploadedFiles]);

  // 파일 매칭 해제
  const unmatchFile = useCallback((rowIndex) => {
    setFileMatching(prev => {
      const newMatching = { ...prev };
      delete newMatching[rowIndex];
      return newMatching;
    });
  }, []);

  // 파일 삭제
  const removeFile = useCallback((index) => {
    const file = uploadedFiles[index];

    // 매칭된 파일 해제
    const newMatching = {};
    Object.entries(fileMatching).forEach(([rowIdx, f]) => {
      if (f.name !== file.name) {
        newMatching[rowIdx] = f;
      }
    });
    setFileMatching(newMatching);

    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
    if (selectedFileIndex === index) {
      setSelectedFileIndex(null);
    }
  }, [uploadedFiles, fileMatching, selectedFileIndex]);

  // 엑셀 붙여넣기
  const handlePaste = useCallback(async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        try {
          const text = await navigator.clipboard.readText();
          if (text && text.trim()) {
            processPastedData(text);
            return;
          }
        } catch (e) {
          console.warn('Clipboard API 사용 불가:', e);
        }
      }
    } catch (error) {
      console.warn('Clipboard API 접근 실패:', error);
    }

    setIsPasteModalOpen(true);
    setPasteText('');
    setTimeout(() => {
      if (textAreaRef.current) {
        textAreaRef.current.focus();
      }
    }, 100);
  }, []);

  const processPastedData = useCallback((text) => {
    if (!text || text.trim() === '') {
      alert('데이터가 비어있습니다.');
      return false;
    }

    const rows = text.trim().split('\n');
    const newData = [];

    rows.forEach(row => {
      const cells = row.split('\t');
      const rowData = {};

      headers.forEach((header, index) => {
        if (cells[index] !== undefined) {
          rowData[header.key] = cells[index].trim();
        }
      });

      if (Object.values(rowData).some(v => v !== '' && v !== null && v !== undefined)) {
        newData.push(rowData);
      }
    });

    if (newData.length > 0) {
      setTableData(newData);
      setFileMatching({});
      alert(`${newData.length}개 행이 성공적으로 추가되었습니다.`);
      return true;
    } else {
      alert('사용 가능한 데이터가 없습니다.');
      return false;
    }
  }, [headers, setTableData]);

  const handleConfirmPaste = useCallback(() => {
    if (processPastedData(pasteText)) {
      setIsPasteModalOpen(false);
      setPasteText('');
    }
  }, [pasteText, processPastedData]);

  // 유효한 행 수
  const getValidRows = () => {
    return tableData.filter(row => {
      return Object.values(row).some(value =>
        value !== undefined && value !== null && value !== ''
      );
    }).length;
  };

  // 파일이 매칭된 행 수
  const getMatchedRows = () => {
    return Object.keys(fileMatching).length;
  };

  // 적용
  const handleApply = () => {
    const validData = tableData
      .map((row, index) => ({
        ...row,
        file: fileMatching[index] || null
      }))
      .filter(row => {
        return Object.entries(row).some(([key, value]) =>
          key !== 'file' && value !== undefined && value !== null && value !== ''
        );
      });

    if (validData.length === 0) {
      alert('입력된 데이터가 없습니다.');
      return;
    }

    onApply(activeTestType, validData, materialId);
  };

  // 파일이 매칭되었는지 확인
  const isFileMatched = (file) => {
    return Object.values(fileMatching).some(f => f.name === file.name);
  };

  // 입력 렌더링
  const renderInput = (header, value, rowIndex) => {
    const commonProps = {
      value: value || '',
      onChange: (e) => updateCell(rowIndex, header.key, e.target.value)
    };

    if (header.options && header.options.length > 0) {
      return (
        <Select {...commonProps}>
          <option value="">{header.placeholder || '선택'}</option>
          {header.options.map((opt, idx) => (
            <option key={idx} value={opt}>{opt}</option>
          ))}
        </Select>
      );
    }

    return (
      <Input
        {...commonProps}
        type={header.type === 'date' ? 'date' : 'text'}
        placeholder={header.placeholder || ''}
      />
    );
  };

  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <ModalContainer>
        <ModalHeader>
          <ModalTitle>
            <Database size={24} strokeWidth={2} />
            여러 시험 데이터 추가
          </ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} strokeWidth={2} />
          </CloseButton>
        </ModalHeader>

        <TabContainer>
          {TEST_TYPES.map(type => (
            <Tab
              key={type.id}
              active={activeTestType === type.id}
              onClick={() => setActiveTestType(type.id)}
            >
              {type.label}
            </Tab>
          ))}
        </TabContainer>

        <ModalContent>
          <InfoBox>
            <Info size={20} color="#1e40af" />
            <InfoText>
              <h4>사용 방법</h4>
              <p>
                1. 엑셀에서 시험 데이터를 복사하여 "엑셀 붙여넣기" 버튼으로 테이블에 입력합니다.<br />
                2. 오른쪽 파일 업로드 영역에 {currentFileExt} 파일들을 드래그하여 업로드합니다.<br />
                3. "자동 매칭" 버튼을 클릭하거나, 파일을 선택 후 테이블 행의 연결 버튼을 클릭하여 수동 매칭합니다.
              </p>
            </InfoText>
          </InfoBox>

          <ContentGrid>
            <TableSection>
              <SectionHeader>
                <h3>시험 데이터 ({getValidRows()}건)</h3>
                <TableActions>
                  <ActionButton className="paste" onClick={handlePaste}>
                    <Copy size={12} />
                    엑셀 붙여넣기
                  </ActionButton>
                  <ActionButton className="add" onClick={addRow}>
                    <Plus size={12} />
                    행 추가
                  </ActionButton>
                  <ActionButton className="clear" onClick={clearAll}>
                    <Trash2 size={12} />
                    전체 삭제
                  </ActionButton>
                </TableActions>
              </SectionHeader>

              <TableWrapper>
                <Table>
                  <TableHead>
                    <tr>
                      <HeaderCell style={{ width: '35px', minWidth: '35px' }}>#</HeaderCell>
                      <HeaderCell style={{ width: '140px', minWidth: '140px' }}>파일</HeaderCell>
                      {headers.map(header => (
                        <HeaderCell
                          key={header.key}
                          className={header.required ? 'required' : ''}
                          style={header.width ? { width: header.width, minWidth: header.width } : {}}
                        >
                          {header.label}
                        </HeaderCell>
                      ))}
                      <HeaderCell style={{ width: '40px', minWidth: '40px' }}>삭제</HeaderCell>
                    </tr>
                  </TableHead>
                  <TableBody>
                    {tableData.map((row, rowIndex) => {
                      const matchedFile = fileMatching[rowIndex];
                      return (
                        <TableRow key={rowIndex} className={matchedFile ? 'has-file' : ''}>
                          <TableCell>
                            <RowNumber>{rowIndex + 1}</RowNumber>
                          </TableCell>
                          <TableCell>
                            <FileCell hasFile={!!matchedFile}>
                              {matchedFile ? (
                                <>
                                  <FileText size={14} color="#16a34a" />
                                  <FileName hasFile title={matchedFile.name}>
                                    {matchedFile.name}
                                  </FileName>
                                  <FileActionButton danger onClick={() => unmatchFile(rowIndex)} title="연결 해제">
                                    <Unlink size={12} />
                                  </FileActionButton>
                                </>
                              ) : (
                                <>
                                  <FileName>파일 없음</FileName>
                                  {selectedFileIndex !== null && (
                                    <FileActionButton onClick={() => matchFileToRow(rowIndex)} title="선택한 파일 연결">
                                      <Link2 size={12} />
                                    </FileActionButton>
                                  )}
                                </>
                              )}
                            </FileCell>
                          </TableCell>
                          {headers.map(header => (
                            <TableCell key={header.key}>
                              {renderInput(header, row[header.key], rowIndex)}
                            </TableCell>
                          ))}
                          <TableCell className="actions">
                            {tableData.length > 1 && (
                              <DeleteButton onClick={() => deleteRow(rowIndex)}>
                                <Trash2 size={12} />
                              </DeleteButton>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableWrapper>
            </TableSection>

            <FileSection>
              <SectionHeader>
                <h3>파일 업로드 ({uploadedFiles.length}개)</h3>
                <ActionButton
                  className="match"
                  onClick={handleAutoMatch}
                  disabled={uploadedFiles.length === 0}
                  title="테이블 행과 파일을 자동으로 매칭합니다"
                >
                  <Wand2 size={12} />
                  자동 매칭
                </ActionButton>
              </SectionHeader>

              <DropZone
                isDragOver={isDragOver}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <DropZoneIcon isDragOver={isDragOver}>
                  <Upload size={32} />
                </DropZoneIcon>
                <DropZoneText>
                  <strong>{currentFileExt}</strong> 파일을 드래그하거나<br />
                  클릭하여 업로드
                </DropZoneText>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={currentFileExt}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </DropZone>

              {uploadedFiles.length > 0 && (
                <FileList>
                  {uploadedFiles.map((file, index) => {
                    const matched = isFileMatched(file);
                    const selected = selectedFileIndex === index;
                    return (
                      <FileItem
                        key={index}
                        matched={matched}
                        selected={selected}
                        onClick={() => !matched && setSelectedFileIndex(selected ? null : index)}
                      >
                        <FileItemIcon matched={matched}>
                          <FileText size={16} />
                        </FileItemIcon>
                        <FileItemInfo>
                          <FileItemName>{file.name}</FileItemName>
                          <FileItemStatus matched={matched}>
                            {matched ? (
                              <>
                                <CheckCircle size={10} />
                                연결됨
                              </>
                            ) : selected ? (
                              '행에 연결하려면 클릭'
                            ) : (
                              '클릭하여 선택'
                            )}
                          </FileItemStatus>
                        </FileItemInfo>
                        <FileItemActions>
                          <FileActionButton danger onClick={(e) => { e.stopPropagation(); removeFile(index); }}>
                            <Trash2 size={14} />
                          </FileActionButton>
                        </FileItemActions>
                      </FileItem>
                    );
                  })}
                </FileList>
              )}
            </FileSection>
          </ContentGrid>
        </ModalContent>

        <ButtonContainer>
          <LeftButtons>
            <StatusBar>
              <StatusItem className="success">
                <CheckCircle size={16} />
                유효한 행: {getValidRows()}
              </StatusItem>
              <StatusItem className={getMatchedRows() > 0 ? 'success' : 'warning'}>
                {getMatchedRows() > 0 ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                파일 매칭: {getMatchedRows()}/{getValidRows()}
              </StatusItem>
            </StatusBar>
          </LeftButtons>

          <RightButtons>
            <Button className="secondary" onClick={onClose}>
              취소
            </Button>
            <Button className="primary" onClick={handleApply} disabled={getValidRows() === 0}>
              <Database size={16} />
              {getValidRows()}개 시험 데이터 추가
            </Button>
          </RightButtons>
        </ButtonContainer>
      </ModalContainer>

      {isPasteModalOpen && (
        <PasteModalOverlay onClick={(e) => e.target === e.currentTarget && setIsPasteModalOpen(false)}>
          <PasteModalContainer>
            <PasteModalHeader>
              <ModalTitle style={{ fontSize: '1.125rem' }}>
                <Copy size={20} />
                엑셀 데이터 붙여넣기
              </ModalTitle>
              <CloseButton onClick={() => setIsPasteModalOpen(false)}>
                <X size={18} />
              </CloseButton>
            </PasteModalHeader>

            <PasteModalBody>
              <InfoBox style={{ marginBottom: '1rem' }}>
                <Info size={16} color="#1e40af" />
                <InfoText>
                  <p>
                    엑셀에서 데이터를 복사(Ctrl+C)한 후 아래 입력창에 붙여넣기(Ctrl+V)하세요.
                    컬럼 순서가 테이블 헤더와 동일해야 합니다.
                  </p>
                </InfoText>
              </InfoBox>

              <PasteTextArea
                ref={textAreaRef}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="여기에 엑셀 데이터를 붙여넣으세요 (Ctrl+V)..."
              />
            </PasteModalBody>

            <PasteModalFooter>
              <Button className="secondary" onClick={() => setIsPasteModalOpen(false)}>
                취소
              </Button>
              <Button
                className="primary"
                onClick={handleConfirmPaste}
                disabled={!pasteText.trim()}
              >
                <Copy size={16} />
                데이터 가져오기
              </Button>
            </PasteModalFooter>
          </PasteModalContainer>
        </PasteModalOverlay>
      )}
    </ModalOverlay>
  );
};

export default BulkAddTestModal;
