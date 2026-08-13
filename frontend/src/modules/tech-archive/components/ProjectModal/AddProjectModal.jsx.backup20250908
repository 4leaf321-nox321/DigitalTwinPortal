import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Folder, Calendar, Users, Tag, FileText, AlertCircle } from 'lucide-react';
import styled from 'styled-components';

const ModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContainer = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  padding: 0;
  max-width: 600px;
  width: 90vw;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
`;

const ModalHeader = styled.div`
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;

  h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .close-btn {
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.375rem;
    transition: background 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.1);
    }
  }
`;

const ModalBody = styled.div`
  padding: 2rem;
  overflow-y: auto;
  max-height: calc(90vh - 140px);
`;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  .required {
    color: #ef4444;
  }

  input, textarea, select {
    width: 100%;
    padding: 0.75rem;
    border: 2px solid #e5e7eb;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    transition: border-color 0.2s ease;

    &:focus {
      outline: none;
      border-color: #10b981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }

    &.error {
      border-color: #ef4444;
    }
  }

  textarea {
    resize: vertical;
    min-height: 100px;
  }

  .error-message {
    margin-top: 0.5rem;
    color: #ef4444;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .help-text {
    margin-top: 0.5rem;
    color: #6b7280;
    font-size: 0.75rem;
  }
`;

const TagsInput = styled.div`
  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .tag {
    background: #10b981;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;

    .remove-tag {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      transition: background 0.2s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    }
  }

  .tag-input {
    flex: 1;
    min-width: 200px;
  }
`;

const AssigneesInput = styled.div`
  .assignees-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .assignee {
    background: #3b82f6;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;

    .remove-assignee {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      transition: background 0.2s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.2);
      }
    }
  }

  .assignee-input {
    flex: 1;
    min-width: 200px;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  padding: 1.5rem 2rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;

  button {
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 2px solid transparent;

    &.cancel {
      background: white;
      color: #6b7280;
      border-color: #d1d5db;

      &:hover {
        background: #f9fafb;
        border-color: #9ca3af;
      }
    }

    &.submit {
      background: #10b981;
      color: white;
      border-color: #10b981;

      &:hover {
        background: #059669;
        border-color: #059669;
      }

      &:disabled {
        background: #d1d5db;
        color: #9ca3af;
        border-color: #d1d5db;
        cursor: not-allowed;
      }
    }
  }
`;

const projectTypes = [
  { value: 'new-simulation', label: '신규 시뮬레이션 기법 개발' },
  { value: 'simulation-automation', label: '시뮬레이션 자동화' },
  { value: 'ai-model-development', label: 'AI 모델 개발' },
  { value: 'platform-development', label: '플랫폼 개발&도입' },
  { value: 'infrastructure', label: '인프라 구축&도입' },
  { value: 'data-acquisition', label: '데이터 확보' },
  { value: 'process-development', label: '신규 프로세스 구축' }
];

const statusOptions = [
  { value: 'planning', label: '계획 중' },
  { value: 'active', label: '진행 중' },
  { value: 'completed', label: '완료됨' }
];

const teamOptions = [
  { value: '', label: '선택하세요' },
  { value: 'gtr', label: 'GTR' },
  { value: 'mx', label: 'MX' },
  { value: 'vd', label: 'VD' },
  { value: 'da', label: 'DA' },
  { value: 'network', label: '네트워크' },
  { value: 'medical-device', label: '의료기기' }
];

const AddProjectModal = ({ isOpen, onClose, onSubmit, showError }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'new-simulation',
    status: 'planning',
    startDate: '',
    endDate: '',
    assignees: [],
    team: '',
    tags: []
  });

  const [tagInput, setTagInput] = useState('');
  const [assigneeInput, setAssigneeInput] = useState('');
  const [errors, setErrors] = useState({});

  // 모달이 열릴 때 폼 초기화
  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: '',
        description: '',
        type: 'new-simulation',
        status: 'planning',
        startDate: '',
        endDate: '',
        assignees: [],
        team: '',
        tags: []
      });
      setTagInput('');
      setAssigneeInput('');
      setErrors({});
    }
  }, [isOpen]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // 에러 메시지 제거
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleTagKeyPress = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    }
  };

  const handleAssigneeKeyPress = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addAssignee();
    }
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
      setTagInput('');
    }
  };

  const addAssignee = () => {
    const assignee = assigneeInput.trim();
    if (assignee && !formData.assignees.includes(assignee)) {
      setFormData(prev => ({
        ...prev,
        assignees: [...prev.assignees, assignee]
      }));
      setAssigneeInput('');
    }
  };

  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const removeAssignee = (assigneeToRemove) => {
    setFormData(prev => ({
      ...prev,
      assignees: prev.assignees.filter(assignee => assignee !== assigneeToRemove)
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = '프로젝트 제목은 필수입니다.';
    }

    if (!formData.description.trim()) {
      newErrors.description = '프로젝트 설명은 필수입니다.';
    }

    if (formData.assignees.length === 0) {
      newErrors.assignees = '담당자를 최소 1명 이상 추가해주세요.';
    }

    if (!formData.team.trim()) {
      newErrors.team = '담당팀은 필수입니다.';
    }

    if (formData.startDate && formData.endDate) {
      if (new Date(formData.startDate) > new Date(formData.endDate)) {
        newErrors.endDate = '종료일은 시작일보다 늦어야 합니다.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showError && showError('입력 정보를 확인해주세요.');
      return;
    }

    const projectData = {
      ...formData,
      id: `project_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: 0,
      tasks: [],
      documents: [],
      milestones: []
    };

    onSubmit(projectData);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalOverlay
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <ModalContainer
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader>
              <h2>
                <Plus size={20} />
                새 프로젝트 추가
              </h2>
              <button className="close-btn" onClick={onClose}>
                <X size={20} />
              </button>
            </ModalHeader>

            <form onSubmit={handleSubmit}>
              <ModalBody>
                <FormGroup>
                  <label>
                    프로젝트 제목 <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    placeholder="프로젝트 제목을 입력하세요"
                    className={errors.title ? 'error' : ''}
                  />
                  {errors.title && (
                    <div className="error-message">
                      <AlertCircle size={12} />
                      {errors.title}
                    </div>
                  )}
                </FormGroup>

                <FormGroup>
                  <label>
                    프로젝트 설명 <span className="required">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="프로젝트에 대한 자세한 설명을 입력하세요"
                    className={errors.description ? 'error' : ''}
                  />
                  {errors.description && (
                    <div className="error-message">
                      <AlertCircle size={12} />
                      {errors.description}
                    </div>
                  )}
                </FormGroup>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <FormGroup>
                    <label>
                      <Folder size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                      타입
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) => handleInputChange('type', e.target.value)}
                    >
                      {projectTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </FormGroup>

                  <FormGroup>
                    <label>상태</label>
                    <select
                      value={formData.status}
                      onChange={(e) => handleInputChange('status', e.target.value)}
                    >
                      {statusOptions.map(status => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </FormGroup>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <FormGroup>
                    <label>
                      <Calendar size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                      시작일
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => handleInputChange('startDate', e.target.value)}
                    />
                  </FormGroup>

                  <FormGroup>
                    <label>
                      <Calendar size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                      종료일
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => handleInputChange('endDate', e.target.value)}
                      className={errors.endDate ? 'error' : ''}
                    />
                    {errors.endDate && (
                      <div className="error-message">
                        <AlertCircle size={12} />
                        {errors.endDate}
                      </div>
                    )}
                  </FormGroup>
                </div>

                <FormGroup>
                  <label>
                    <Users size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                    담당자 <span className="required">*</span>
                  </label>
                  <AssigneesInput>
                    <div className="assignees-container">
                      {formData.assignees.map((assignee, index) => (
                        <div key={index} className="assignee">
                          {assignee}
                          <button
                            type="button"
                            className="remove-assignee"
                            onClick={() => removeAssignee(assignee)}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <input
                      type="text"
                      className={`assignee-input ${errors.assignees ? 'error' : ''}`}
                      value={assigneeInput}
                      onChange={(e) => setAssigneeInput(e.target.value)}
                      onKeyPress={handleAssigneeKeyPress}
                      onBlur={addAssignee}
                      placeholder="담당자 이름을 입력하고 Enter를 누르세요"
                    />
                  </AssigneesInput>
                  {errors.assignees && (
                    <div className="error-message">
                      <AlertCircle size={12} />
                      {errors.assignees}
                    </div>
                  )}
                  <div className="help-text">
                    여러 담당자는 쉼표(,)나 Enter로 구분하여 입력하세요.
                  </div>
                </FormGroup>

                <FormGroup>
                  <label>
                    <Users size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                    담당 팀 <span className="required">*</span>
                  </label>
                  <select
                    value={formData.team}
                    onChange={(e) => handleInputChange('team', e.target.value)}
                    className={errors.team ? 'error' : ''}
                  >
                    {teamOptions.map(team => (
                      <option key={team.value} value={team.value}>
                        {team.label}
                      </option>
                    ))}
                  </select>
                  {errors.team && (
                    <div className="error-message">
                      <AlertCircle size={12} />
                      {errors.team}
                    </div>
                  )}
                </FormGroup>

                <FormGroup>
                  <label>
                    <Tag size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                    태그
                  </label>
                  <TagsInput>
                    <div className="tags-container">
                      {formData.tags.map((tag, index) => (
                        <div key={index} className="tag">
                          {tag}
                          <button
                            type="button"
                            className="remove-tag"
                            onClick={() => removeTag(tag)}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <input
                      type="text"
                      className="tag-input"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={handleTagKeyPress}
                      onBlur={addTag}
                      placeholder="태그를 입력하고 Enter를 누르세요"
                    />
                  </TagsInput>
                  <div className="help-text">
                    여러 태그는 쉼표(,)나 Enter로 구분하여 입력하세요.
                  </div>
                </FormGroup>
              </ModalBody>

              <ButtonGroup>
                <button type="button" className="cancel" onClick={onClose}>
                  취소
                </button>
                <button type="submit" className="submit">
                  프로젝트 생성
                </button>
              </ButtonGroup>
            </form>
          </ModalContainer>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
};

export default AddProjectModal;