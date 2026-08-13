import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { X, Upload, Trash2, FileIcon, Image, Bold, Italic, Underline, List, ListOrdered, Link, Download } from 'lucide-react';
import JSZip from 'jszip';

const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Modal = styled.div`
  background: white;
  border-radius: 16px;
  width: 80%;
  height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
`;

const ModalTitle = styled.h2`
  font-size: 18px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: #f1f5f9;
  border-radius: 8px;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s;

  &:hover {
    background: #e2e8f0;
    color: #1e293b;
  }
`;

const ModalBody = styled.div`
  flex: 1;
  padding: 24px;
  overflow-y: auto;
`;

const FormGroup = styled.div`
  margin-bottom: 20px;
`;

const DescriptionFormGroup = styled.div`
  margin-bottom: 20px;
`;

const Label = styled.label`
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  color: #1e293b;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const EditorToolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: #f8fafc;
`;

const ToolbarButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: ${props => props.$active ? '#e2e8f0' : 'transparent'};
  border-radius: 6px;
  cursor: pointer;
  color: #64748b;
  transition: all 0.2s;

  &:hover {
    background: #e2e8f0;
    color: #1e293b;
  }
`;

const ToolbarDivider = styled.div`
  width: 1px;
  height: 24px;
  background: #e2e8f0;
  margin: 0 4px;
`;

const RichTextArea = styled.div`
  min-height: 300px;
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 0 0 8px 8px;
  font-size: 14px;
  color: #1e293b;
  line-height: 1.6;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }

  img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 8px 0;
  }

  ul, ol {
    margin: 8px 0;
    padding-left: 24px;
  }

  a {
    color: #8b5cf6;
    text-decoration: underline;
  }
`;

const ThumbnailUploadArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const ThumbnailPreview = styled.div`
  width: 100%;
  height: 140px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  position: relative;
  background: #f8fafc;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;

const ThumbnailPlaceholder = styled.div`
  width: 100%;
  height: 140px;
  border: 2px dashed #e2e8f0;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: #94a3b8;

  &:hover {
    border-color: #8b5cf6;
    background: #faf5ff;
    color: #8b5cf6;
  }
`;

const ThumbnailActions = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const ThumbnailButton = styled.button`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  font-size: 13px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }

  &.delete {
    color: #ef4444;
    border-color: #fecaca;

    &:hover {
      background: #fef2f2;
      border-color: #ef4444;
    }
  }
`;

const ThumbnailHint = styled.span`
  font-size: 12px;
  color: #94a3b8;
  margin-left: auto;
`;

const TwoColumnRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 20px;
`;

const ColumnFormGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const FileUploadArea = styled.div`
  border: 2px dashed #e2e8f0;
  border-radius: 8px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #8b5cf6;
    background: #faf5ff;
  }
`;

const FileUploadIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: #f1f5f9;
  border-radius: 12px;
  margin: 0 auto 12px;
  color: #64748b;
`;

const FileUploadText = styled.p`
  font-size: 14px;
  color: #64748b;
  margin: 0;
`;

const FileUploadHint = styled.span`
  font-size: 12px;
  color: #94a3b8;
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const FileList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
`;

const FileItem = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
`;

const FileInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const FileName = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const FileSize = styled.div`
  font-size: 12px;
  color: #64748b;
`;

const DeleteFileButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: #ef4444;
  transition: all 0.2s;

  &:hover {
    background: #fee2e2;
  }
`;

const DownloadFileButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: #3b82f6;
  transition: all 0.2s;

  &:hover {
    background: #dbeafe;
  }
`;

const FileActions = styled.div`
  display: flex;
  gap: 4px;
`;

const ModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  padding: 20px 24px;
  border-top: 1px solid #e2e8f0;
`;

const Button = styled.button`
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
`;

const CancelButton = styled(Button)`
  background: white;
  color: #64748b;
  border: 1px solid #e2e8f0;

  &:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
  }
`;

const SaveButton = styled(Button)`
  background: #8b5cf6;
  color: white;
  border: none;

  &:hover {
    background: #7c3aed;
  }

  &:disabled {
    background: #c4b5fd;
    cursor: not-allowed;
  }
`;

const TestMethodModal = ({ isOpen, onClose, onSave, initialData = null, mode = 'add' }) => {
  const [testName, setTestName] = useState('');
  const [equipment, setEquipment] = useState('');
  const [equipmentLocation, setEquipmentLocation] = useState('');
  const [thumbnail, setThumbnail] = useState(null);
  const [files, setFiles] = useState([]);
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTestName(initialData.testName || '');
        setEquipment(initialData.equipment || '');
        setEquipmentLocation(initialData.equipmentLocation || '');
        setThumbnail(initialData.thumbnail || null);
        setFiles(initialData.files || []);
        if (editorRef.current) {
          editorRef.current.innerHTML = initialData.description || '';
        }
      } else {
        setTestName('');
        setEquipment('');
        setEquipmentLocation('');
        setThumbnail(null);
        setFiles([]);
        if (editorRef.current) {
          editorRef.current.innerHTML = '';
        }
      }
    }
  }, [isOpen, initialData]);

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const handleBold = () => execCommand('bold');
  const handleItalic = () => execCommand('italic');
  const handleUnderline = () => execCommand('underline');
  const handleUnorderedList = () => execCommand('insertUnorderedList');
  const handleOrderedList = () => execCommand('insertOrderedList');

  const handleLink = () => {
    const url = prompt('링크 URL을 입력하세요:');
    if (url) {
      execCommand('createLink', url);
    }
  };

  const handleImageInsert = () => {
    imageInputRef.current?.click();
  };

  const handleImageSelected = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        execCommand('insertImage', event.target.result);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleThumbnailClick = () => {
    thumbnailInputRef.current?.click();
  };

  const handleThumbnailSelected = (e) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setThumbnail(event.target.result);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleRemoveThumbnail = () => {
    setThumbnail(null);
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (e) => {
    const selectedFiles = Array.from(e.target.files || []);

    selectedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFiles(prev => [...prev, {
          id: Date.now() + Math.random(),
          name: file.name,
          size: file.size,
          type: file.type,
          data: event.target.result
        }]);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  const handleDeleteFile = (fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleDownloadFile = async (file) => {
    try {
      // Base64 데이터를 바이너리로 변환
      const base64Data = file.data.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // ZIP으로 압축
      const zip = new JSZip();
      zip.file(file.name, bytes);

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      // ZIP 파일명 생성 (확장자 제거 후 .zip 추가)
      const zipFileName = file.name.replace(/\.[^/.]+$/, '') + '.zip';

      // 다운로드 트리거
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('파일 다운로드 오류:', error);
      alert('파일 다운로드 중 오류가 발생했습니다.');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSave = () => {
    if (!testName.trim()) {
      alert('시험명을 입력해주세요.');
      return;
    }

    const data = {
      id: initialData?.id || Date.now().toString(),
      testName: testName.trim(),
      equipment: equipment.trim(),
      equipmentLocation: equipmentLocation.trim(),
      thumbnail: thumbnail,
      description: editorRef.current?.innerHTML || '',
      files: files,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onSave(data);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Overlay onClick={handleOverlayClick}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>
            {mode === 'add' ? '시험 방법 추가' : mode === 'edit' ? '시험 방법 수정' : '시험 방법 상세'}
          </ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <ModalBody>
          <FormGroup>
            <Label>시험명 *</Label>
            <Input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              placeholder="예: 인장 시험, DMA 시험"
              disabled={mode === 'view'}
            />
          </FormGroup>

          <TwoColumnRow>
            <ColumnFormGroup>
              <Label>사용 장비</Label>
              <Input
                type="text"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="예: ZWICK 250kN, TA Instruments DMA"
                disabled={mode === 'view'}
              />
            </ColumnFormGroup>
            <ColumnFormGroup>
              <Label>장비 위치</Label>
              <Input
                type="text"
                value={equipmentLocation}
                onChange={(e) => setEquipmentLocation(e.target.value)}
                placeholder="예: 연구동 2층, 시험실 A"
                disabled={mode === 'view'}
              />
            </ColumnFormGroup>
          </TwoColumnRow>

          <TwoColumnRow>
            <ColumnFormGroup>
              <Label>대표 이미지</Label>
              <ThumbnailUploadArea>
                {thumbnail ? (
                  <ThumbnailPreview>
                    <img src={thumbnail} alt="대표 이미지" />
                  </ThumbnailPreview>
                ) : (
                  <ThumbnailPlaceholder onClick={mode !== 'view' ? handleThumbnailClick : undefined}>
                    <Image size={24} />
                    <span style={{ fontSize: '12px' }}>이미지 추가</span>
                  </ThumbnailPlaceholder>
                )}
                {mode !== 'view' && (
                  <ThumbnailActions>
                    <ThumbnailButton onClick={handleThumbnailClick}>
                      <Upload size={14} />
                      {thumbnail ? '변경' : '선택'}
                    </ThumbnailButton>
                    {thumbnail && (
                      <ThumbnailButton className="delete" onClick={handleRemoveThumbnail}>
                        <Trash2 size={14} />
                        삭제
                      </ThumbnailButton>
                    )}
                    <ThumbnailHint>
                      카드에 표시될 이미지
                    </ThumbnailHint>
                  </ThumbnailActions>
                )}
                <HiddenFileInput
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailSelected}
                />
              </ThumbnailUploadArea>
            </ColumnFormGroup>

            <ColumnFormGroup>
              <Label>첨부파일</Label>
              {mode !== 'view' && (
                <FileUploadArea onClick={handleFileUploadClick}>
                  <FileUploadIcon>
                    <Upload size={24} />
                  </FileUploadIcon>
                  <FileUploadText>
                    클릭하여 파일 선택
                  </FileUploadText>
                  <FileUploadHint>
                    PDF, 문서, 이미지 등
                  </FileUploadHint>
                  <HiddenFileInput
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFilesSelected}
                  />
                </FileUploadArea>
              )}
              {files.length > 0 && (
                <FileList>
                  {files.map(file => (
                    <FileItem key={file.id}>
                      <FileIcon size={20} color="#64748b" />
                      <FileInfo>
                        <FileName>{file.name}</FileName>
                        <FileSize>{formatFileSize(file.size || 0)}</FileSize>
                      </FileInfo>
                      <FileActions>
                        <DownloadFileButton onClick={() => handleDownloadFile(file)} title="다운로드">
                          <Download size={16} />
                        </DownloadFileButton>
                        {mode !== 'view' && (
                          <DeleteFileButton onClick={() => handleDeleteFile(file.id)} title="삭제">
                            <Trash2 size={16} />
                          </DeleteFileButton>
                        )}
                      </FileActions>
                    </FileItem>
                  ))}
                </FileList>
              )}
            </ColumnFormGroup>
          </TwoColumnRow>

          <DescriptionFormGroup>
            <Label>시험 방법 설명</Label>
            {mode !== 'view' && (
              <EditorToolbar>
                <ToolbarButton onClick={handleBold} title="굵게">
                  <Bold size={16} />
                </ToolbarButton>
                <ToolbarButton onClick={handleItalic} title="기울임">
                  <Italic size={16} />
                </ToolbarButton>
                <ToolbarButton onClick={handleUnderline} title="밑줄">
                  <Underline size={16} />
                </ToolbarButton>
                <ToolbarDivider />
                <ToolbarButton onClick={handleUnorderedList} title="글머리 기호">
                  <List size={16} />
                </ToolbarButton>
                <ToolbarButton onClick={handleOrderedList} title="번호 매기기">
                  <ListOrdered size={16} />
                </ToolbarButton>
                <ToolbarDivider />
                <ToolbarButton onClick={handleLink} title="링크 삽입">
                  <Link size={16} />
                </ToolbarButton>
                <ToolbarButton onClick={handleImageInsert} title="이미지 삽입">
                  <Image size={16} />
                </ToolbarButton>
                <HiddenFileInput
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelected}
                />
              </EditorToolbar>
            )}
            <RichTextArea
              ref={editorRef}
              contentEditable={mode !== 'view'}
              suppressContentEditableWarning={true}
              style={{
                borderRadius: mode !== 'view' ? '0 0 8px 8px' : '8px'
              }}
            />
          </DescriptionFormGroup>
        </ModalBody>

        <ModalFooter>
          <CancelButton onClick={onClose}>
            {mode === 'view' ? '닫기' : '취소'}
          </CancelButton>
          {mode !== 'view' && (
            <SaveButton onClick={handleSave} disabled={!testName.trim()}>
              {mode === 'add' ? '추가' : '저장'}
            </SaveButton>
          )}
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default TestMethodModal;
