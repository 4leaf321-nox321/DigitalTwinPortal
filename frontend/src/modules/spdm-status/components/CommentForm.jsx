import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { Send, Paperclip, ChevronDown, X, FileText } from 'lucide-react';

const FormContainer = styled.div`
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
`;

const FormHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
`;

const DepartmentSelect = styled.div`
  position: relative;
`;

const SelectButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: #1e293b;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #8b5cf6;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => props.$color || '#94a3b8'};
  }
`;

const SelectMenu = styled.div`
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 0.25rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  z-index: 100;
  min-width: 180px;
  overflow: hidden;
`;

const SelectOption = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: ${props => props.$active ? '#f1f5f9' : 'transparent'};
  border: none;
  font-size: 0.875rem;
  color: #1e293b;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;

  &:hover {
    background: #f1f5f9;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${props => props.$color};
  }
`;

const FormLabel = styled.span`
  font-size: 0.8125rem;
  color: #64748b;
`;

const InputWrapper = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const TextArea = styled.textarea`
  flex: 1;
  min-height: 60px;
  max-height: 150px;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  color: #1e293b;
  resize: vertical;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const AttachButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: #8b5cf6;
    color: #8b5cf6;
    background: #f5f3ff;
  }
`;

const SubmitButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  border: none;
  border-radius: 0.5rem;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;

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
`;

const HiddenInput = styled.input`
  display: none;
`;

const SelectedFilesContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
`;

const SelectedFileItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  color: #475569;

  .file-icon {
    color: #8b5cf6;
  }

  .file-name {
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-size {
    color: #94a3b8;
    font-size: 0.6875rem;
  }

  .remove-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: #94a3b8;
    cursor: pointer;
    transition: all 0.2s ease;
    padding: 0;

    &:hover {
      background: #fee2e2;
      color: #ef4444;
    }
  }
`;

const AttachButtonActive = styled(AttachButton)`
  border-color: #8b5cf6;
  color: #8b5cf6;
  background: #f5f3ff;
  position: relative;

  .badge {
    position: absolute;
    top: -4px;
    right: -4px;
    width: 16px;
    height: 16px;
    background: #8b5cf6;
    color: white;
    border-radius: 50%;
    font-size: 0.625rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

const CommentForm = ({ issueId, onSubmit, departments = [], currentUser }) => {
  const [content, setContent] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [showDeptMenu, setShowDeptMenu] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);

  const selectedDept = departments.find(d => d.id === departmentId);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!content.trim() && selectedFiles.length === 0) return;

    onSubmit({
      issueId,
      type: 'comment',
      content: content.trim(),
      departmentId,
      author: currentUser?.name || '사용자',
      createdAt: new Date().toISOString(),
      pendingFiles: selectedFiles
    });

    setContent('');
    setSelectedFiles([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit();
    }
  };

  return (
    <FormContainer>
      <FormHeader>
        <DepartmentSelect>
          <SelectButton
            $color={selectedDept?.color}
            onClick={() => setShowDeptMenu(!showDeptMenu)}
          >
            <span className="dot" />
            {selectedDept?.name || '사업부 선택'}
            <ChevronDown size={14} />
          </SelectButton>
          {showDeptMenu && (
            <SelectMenu>
              {departments.map(dept => (
                <SelectOption
                  key={dept.id}
                  $color={dept.color}
                  $active={departmentId === dept.id}
                  onClick={() => {
                    setDepartmentId(dept.id);
                    setShowDeptMenu(false);
                  }}
                >
                  <span className="dot" />
                  {dept.name}
                </SelectOption>
              ))}
            </SelectMenu>
          )}
        </DepartmentSelect>
        <FormLabel>로 의견 작성</FormLabel>
      </FormHeader>
      <InputWrapper>
        <TextArea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="의견을 입력하세요... (Ctrl+Enter로 등록)"
        />
        <ButtonGroup>
          <HiddenInput
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            multiple
          />
          {selectedFiles.length > 0 ? (
            <AttachButtonActive
              onClick={() => fileInputRef.current?.click()}
              title="파일 추가"
            >
              <Paperclip size={18} />
              <span className="badge">{selectedFiles.length}</span>
            </AttachButtonActive>
          ) : (
            <AttachButton
              onClick={() => fileInputRef.current?.click()}
              title="파일 첨부"
            >
              <Paperclip size={18} />
            </AttachButton>
          )}
          <SubmitButton
            onClick={handleSubmit}
            disabled={!content.trim() && selectedFiles.length === 0}
            title="의견 등록"
          >
            <Send size={18} />
          </SubmitButton>
        </ButtonGroup>
      </InputWrapper>

      {selectedFiles.length > 0 && (
        <SelectedFilesContainer>
          {selectedFiles.map((file, index) => (
            <SelectedFileItem key={index}>
              <FileText size={14} className="file-icon" />
              <span className="file-name" title={file.name}>{file.name}</span>
              <span className="file-size">({formatFileSize(file.size)})</span>
              <button
                className="remove-btn"
                onClick={() => handleRemoveFile(index)}
                title="제거"
              >
                <X size={12} />
              </button>
            </SelectedFileItem>
          ))}
        </SelectedFilesContainer>
      )}
    </FormContainer>
  );
};

export default CommentForm;
