import React, { useState, useEffect, useRef } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Paperclip, FileText, Trash2 } from 'lucide-react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { ISSUE_STATUS } from '../data/sampleData';

const ModalOverlay = styled(motion.div)`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const ModalContent = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  width: 80%;
  max-width: 80%;
  height: 80vh;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;

  h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }
`;

const CloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: none;
  border-radius: 0.5rem;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: #f1f5f9;
    color: #1e293b;
  }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
`;

const FormGroup = styled.div`
  margin-bottom: 1.25rem;

  &:last-child {
    margin-bottom: 0;
  }

  label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: #374151;
    margin-bottom: 0.5rem;
  }
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1.25rem;

  ${FormGroup} {
    margin-bottom: 0;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  color: #1e293b;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }

  &::placeholder {
    color: #94a3b8;
  }

  &:read-only {
    background: #f8fafc;
    color: #64748b;
  }
`;

const EditorWrapper = styled.div`
  .quill {
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    overflow: hidden;

    &:focus-within {
      border-color: #8b5cf6;
    }
  }

  .ql-toolbar {
    border: none !important;
    border-bottom: 1px solid #e2e8f0 !important;
    background: #f8fafc;
    padding: 0.5rem !important;
  }

  .ql-container {
    border: none !important;
    font-size: 0.9375rem;
    font-family: inherit;
  }

  .ql-editor {
    min-height: 300px;
    max-height: none;
    overflow-y: visible;
    padding: 0.75rem;

    &.ql-blank::before {
      color: #94a3b8;
      font-style: normal;
      left: 0.75rem;
    }

    p {
      margin-bottom: 0.5rem;
    }

    ul, ol {
      padding-left: 1.5rem;
      margin-bottom: 0.5rem;
    }

    h1, h2, h3 {
      margin-bottom: 0.5rem;
    }
  }

  .ql-snow .ql-picker {
    color: #374151;
  }

  .ql-snow .ql-stroke {
    stroke: #64748b;
  }

  .ql-snow .ql-fill {
    fill: #64748b;
  }

  .ql-snow.ql-toolbar button:hover,
  .ql-snow .ql-toolbar button:hover,
  .ql-snow.ql-toolbar button:focus,
  .ql-snow .ql-toolbar button:focus,
  .ql-snow.ql-toolbar button.ql-active,
  .ql-snow .ql-toolbar button.ql-active {
    color: #8b5cf6;
  }

  .ql-snow.ql-toolbar button:hover .ql-stroke,
  .ql-snow .ql-toolbar button:hover .ql-stroke,
  .ql-snow.ql-toolbar button:focus .ql-stroke,
  .ql-snow .ql-toolbar button:focus .ql-stroke,
  .ql-snow.ql-toolbar button.ql-active .ql-stroke,
  .ql-snow .ql-toolbar button.ql-active .ql-stroke {
    stroke: #8b5cf6;
  }

  .ql-snow.ql-toolbar button:hover .ql-fill,
  .ql-snow .ql-toolbar button:hover .ql-fill,
  .ql-snow.ql-toolbar button:focus .ql-fill,
  .ql-snow .ql-toolbar button:focus .ql-fill,
  .ql-snow.ql-toolbar button.ql-active .ql-fill,
  .ql-snow .ql-toolbar button.ql-active .ql-fill {
    fill: #8b5cf6;
  }
`;

const Select = styled.div`
  position: relative;
`;

const SelectButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  color: #1e293b;
  cursor: pointer;
  transition: border-color 0.2s ease;

  &:hover {
    border-color: #8b5cf6;
  }

  .selected {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${props => props.$color || '#94a3b8'};
  }

  .placeholder {
    color: #94a3b8;
  }
`;

const SelectMenu = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.25rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  z-index: 100;
  max-height: 200px;
  overflow-y: auto;
`;

const SelectOption = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: ${props => props.$active ? '#f1f5f9' : 'transparent'};
  border: none;
  font-size: 0.9375rem;
  color: #1e293b;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;

  &:hover {
    background: #f1f5f9;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${props => props.$color};
  }
`;

const CheckboxGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const CheckboxItem = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: ${props => props.$checked ? `${props.$color}15` : '#f8fafc'};
  border: 1px solid ${props => props.$checked ? props.$color : '#e2e8f0'};
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: ${props => props.$color};
  }

  input {
    display: none;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => props.$color};
  }

  span {
    font-size: 0.875rem;
    color: ${props => props.$checked ? props.$color : '#64748b'};
    font-weight: ${props => props.$checked ? '500' : '400'};
  }
`;

const FileUploadArea = styled.div`
  border: 2px dashed #e2e8f0;
  border-radius: 0.5rem;
  padding: 1rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #8b5cf6;
    background: #faf5ff;
  }

  input {
    display: none;
  }

  .upload-text {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: #64748b;
    font-size: 0.875rem;

    svg {
      color: #8b5cf6;
    }
  }
`;

const FileList = styled.div`
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const FileItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;

  .file-icon {
    color: #8b5cf6;
  }

  .file-info {
    flex: 1;
    min-width: 0;

    .file-name {
      font-size: 0.875rem;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-size {
      font-size: 0.75rem;
      color: #94a3b8;
    }
  }

  .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;

    &:hover {
      background: #fee2e2;
      color: #ef4444;
    }
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid #e2e8f0;
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &.secondary {
    background: white;
    border: 1px solid #e2e8f0;
    color: #64748b;

    &:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }
  }

  &.primary {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    border: none;
    color: white;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
  }
`;

// Quill 에디터 모듈 설정
const quillModules = {
  toolbar: [
    [{ 'header': [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'indent': '-1'}, { 'indent': '+1' }],
    ['link'],
    ['clean']
  ],
};

const quillFormats = [
  'header',
  'bold', 'italic', 'underline', 'strike',
  'color', 'background',
  'list', 'bullet', 'indent',
  'link'
];

const IssueModal = ({ isOpen, issue, groups = [], departments = [], currentUser, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    groupId: '',
    status: 'registered',
    assignee: '',
    departments: [],
    dueDate: ''
  });

  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const fileInputRef = useRef(null);

  // 로그인한 사용자의 이름 가져오기
  const currentUserName = currentUser?.name || currentUser?.username || '';

  useEffect(() => {
    if (issue) {
      setFormData({
        title: issue.title || '',
        description: issue.description || '',
        groupId: issue.groupId || '',
        status: issue.status || 'registered',
        assignee: issue.assignee || '',
        departments: issue.departments || [],
        dueDate: issue.dueDate || ''
      });
    } else {
      // 새 이슈 등록 시 로그인한 사용자 이름을 기본값으로 설정
      setFormData({
        title: '',
        description: '',
        groupId: '',
        status: 'registered',
        assignee: currentUserName,
        departments: [],
        dueDate: ''
      });
    }
    // 모달 열릴 때 pendingFiles 초기화
    setPendingFiles([]);
  }, [issue, isOpen, currentUserName]);

  const handleDepartmentToggle = (deptId) => {
    setFormData(prev => ({
      ...prev,
      departments: prev.departments.includes(deptId)
        ? prev.departments.filter(id => id !== deptId)
        : [...prev.departments, deptId]
    }));
  };

  const handleDescriptionChange = (value) => {
    setFormData(prev => ({ ...prev, description: value }));
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setPendingFiles(prev => [...prev, ...files]);
    }
    // Reset input
    e.target.value = '';
  };

  const handleRemovePendingFile = (index) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSubmit = () => {
    if (!formData.title.trim() || !formData.groupId || !formData.assignee.trim()) {
      return;
    }

    onSave({
      ...issue,
      ...formData,
      id: issue?.id || Date.now(),
      createdAt: issue?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pendingFiles: pendingFiles
    });
  };

  const selectedGroup = groups.find(g => g.id === formData.groupId);
  const selectedStatus = ISSUE_STATUS.find(s => s.id === formData.status);

  const isValid = formData.title.trim() && formData.groupId && formData.assignee.trim();

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalOverlay
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <ModalContent
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader>
              <h2>{issue ? '이슈 수정' : '새 이슈 등록'}</h2>
              <CloseButton onClick={onClose}>
                <X size={20} />
              </CloseButton>
            </ModalHeader>

            <ModalBody>
              <FormGroup>
                <label>제목 *</label>
                <Input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="이슈 제목을 입력하세요"
                />
              </FormGroup>

              <FormRow>
                <FormGroup>
                  <label>이슈 그룹 *</label>
                  <Select>
                    <SelectButton
                      $color={selectedGroup?.color}
                      onClick={() => setShowGroupMenu(!showGroupMenu)}
                    >
                      {selectedGroup ? (
                        <span className="selected">
                          <span className="dot" />
                          {selectedGroup.name}
                        </span>
                      ) : (
                        <span className="placeholder">그룹 선택</span>
                      )}
                      <ChevronDown size={16} />
                    </SelectButton>
                    {showGroupMenu && (
                      <SelectMenu>
                        {groups.map(group => (
                          <SelectOption
                            key={group.id}
                            $color={group.color}
                            $active={formData.groupId === group.id}
                            onClick={() => {
                              setFormData({ ...formData, groupId: group.id });
                              setShowGroupMenu(false);
                            }}
                          >
                            <span className="dot" />
                            {group.name}
                          </SelectOption>
                        ))}
                      </SelectMenu>
                    )}
                  </Select>
                </FormGroup>

                <FormGroup>
                  <label>상태</label>
                  <Select>
                    <SelectButton
                      $color={selectedStatus?.color}
                      onClick={() => setShowStatusMenu(!showStatusMenu)}
                    >
                      <span className="selected">
                        <span className="dot" />
                        {selectedStatus?.name || '등록'}
                      </span>
                      <ChevronDown size={16} />
                    </SelectButton>
                    {showStatusMenu && (
                      <SelectMenu>
                        {ISSUE_STATUS.map(status => (
                          <SelectOption
                            key={status.id}
                            $color={status.color}
                            $active={formData.status === status.id}
                            onClick={() => {
                              setFormData({ ...formData, status: status.id });
                              setShowStatusMenu(false);
                            }}
                          >
                            <span className="dot" />
                            {status.name}
                          </SelectOption>
                        ))}
                      </SelectMenu>
                    )}
                  </Select>
                </FormGroup>

                <FormGroup>
                  <label>개설자 *</label>
                  <Input
                    type="text"
                    value={formData.assignee}
                    readOnly
                    placeholder="개설자"
                  />
                </FormGroup>

                <FormGroup>
                  <label>목표 일정</label>
                  <Input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                </FormGroup>
              </FormRow>

              <FormGroup>
                <label>관련 사업부</label>
                <CheckboxGroup>
                  {departments.map(dept => (
                    <CheckboxItem
                      key={dept.id}
                      $color={dept.color}
                      $checked={formData.departments.includes(dept.id)}
                    >
                      <input
                        type="checkbox"
                        checked={formData.departments.includes(dept.id)}
                        onChange={() => handleDepartmentToggle(dept.id)}
                      />
                      <span className="dot" />
                      <span>{dept.name}</span>
                    </CheckboxItem>
                  ))}
                </CheckboxGroup>
              </FormGroup>

              <FormGroup>
                <label>내용</label>
                <EditorWrapper>
                  <ReactQuill
                    theme="snow"
                    value={formData.description}
                    onChange={handleDescriptionChange}
                    modules={quillModules}
                    formats={quillFormats}
                    placeholder="이슈에 대한 상세 내용을 입력하세요"
                  />
                </EditorWrapper>
              </FormGroup>

              <FormGroup>
                <label>첨부파일</label>
                <FileUploadArea onClick={() => fileInputRef.current?.click()}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                  />
                  <div className="upload-text">
                    <Paperclip size={18} />
                    <span>클릭하여 파일을 선택하세요 (여러 파일 선택 가능)</span>
                  </div>
                </FileUploadArea>
                {pendingFiles.length > 0 && (
                  <FileList>
                    {pendingFiles.map((file, index) => (
                      <FileItem key={index}>
                        <FileText size={20} className="file-icon" />
                        <div className="file-info">
                          <div className="file-name">{file.name}</div>
                          <div className="file-size">{formatFileSize(file.size)}</div>
                        </div>
                        <button
                          type="button"
                          className="remove-btn"
                          onClick={() => handleRemovePendingFile(index)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </FileItem>
                    ))}
                  </FileList>
                )}
              </FormGroup>
            </ModalBody>

            <ModalFooter>
              <Button className="secondary" onClick={onClose}>
                취소
              </Button>
              <Button className="primary" onClick={handleSubmit} disabled={!isValid}>
                {issue ? '수정' : '등록'}
              </Button>
            </ModalFooter>
          </ModalContent>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
};

export default IssueModal;
