import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import Modal from '../../../../shared/components/Modal/Modal';
import './AddTechnologyModal.css';

const AddTechnologyModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  data,
  editingTech = null
}) => {
  const [formData, setFormData] = useState({
    name: '',
    sector: '',
    ring: '',
    description: '',
    isAdopted: true // 기본값: 도입됨
  });
  
  const [errors, setErrors] = useState({});

  // 편집 모드일 때 초기값 설정
  useEffect(() => {
    if (editingTech) {
      setFormData({
        name: editingTech.name || '',
        sector: editingTech.sector || '',
        ring: editingTech.ring || '',
        description: editingTech.description || '',
        isAdopted: editingTech.isAdopted !== undefined ? editingTech.isAdopted : true
      });
    } else {
      setFormData({
        name: '',
        sector: '',
        ring: '',
        description: '',
        isAdopted: true
      });
    }
    setErrors({});
  }, [editingTech, isOpen]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // 에러 상태 클리어
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = '기술 이름을 입력해주세요.';
    }
    
    if (!formData.sector) {
      newErrors.sector = '섹터를 선택해주세요.';
    }
    
    if (!formData.ring) {
      newErrors.ring = '성숙도를 선택해주세요.';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    const techData = {
      ...formData,
      id: editingTech ? editingTech.id : Date.now().toString()
    };
    
    onSubmit(techData);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      name: '',
      sector: '',
      ring: '',
      description: '',
      isAdopted: true
    });
    setErrors({});
    onClose();
  };

  const getSectorColor = (sectorId) => {
    const sector = data.sectors?.find(s => s.id === sectorId);
    return sector ? sector.color : '#64748b';
  };

  const getRingColor = (ringId) => {
    const ring = data.rings?.find(r => r.id === ringId);
    return ring ? ring.color : '#64748b';
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={editingTech ? '기술 정보 수정' : '새로운 기술 추가'}
      maxWidth="620px"
      className="add-technology-modal"
    >
      <form onSubmit={handleSubmit} className="technology-form">
        {/* 기술 이름 */}
        <div className="form-group">
          <label className="form-label" htmlFor="tech-name">
            기술 이름 *
          </label>
          <input
            id="tech-name"
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className={`form-input ${errors.name ? 'error' : ''}`}
            placeholder="예: React, Kubernetes, TensorFlow"
            autoFocus
          />
          {errors.name && (
            <span className="error-message">{errors.name}</span>
          )}
        </div>

        {/* 섹터와 성숙도 선택 */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="tech-sector">
              섹터 *
            </label>
            <select
              id="tech-sector"
              value={formData.sector}
              onChange={(e) => handleInputChange('sector', e.target.value)}
              className={`form-select ${errors.sector ? 'error' : ''}`}
            >
              <option value="">섹터를 선택해주세요</option>
              {data.sectors?.map(sector => (
                <option key={sector.id} value={sector.id}>
                  {sector.name}
                </option>
              ))}
            </select>
            {errors.sector && (
              <span className="error-message">{errors.sector}</span>
            )}
            {formData.sector && (
              <div className="preview-badge">
                <span 
                  className="sector-preview"
                  style={{ backgroundColor: getSectorColor(formData.sector) }}
                >
                  {data.sectors?.find(s => s.id === formData.sector)?.name}
                </span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="tech-ring">
              성숙도 *
            </label>
            <select
              id="tech-ring"
              value={formData.ring}
              onChange={(e) => handleInputChange('ring', e.target.value)}
              className={`form-select ${errors.ring ? 'error' : ''}`}
            >
              <option value="">성숙도를 선택해주세요</option>
              {data.rings?.map(ring => (
                <option key={ring.id} value={ring.id}>
                  {ring.name}
                </option>
              ))}
            </select>
            {errors.ring && (
              <span className="error-message">{errors.ring}</span>
            )}
            {formData.ring && (
              <div className="preview-badge">
                <span 
                  className="ring-preview"
                  style={{ backgroundColor: getRingColor(formData.ring) }}
                >
                  {data.rings?.find(r => r.id === formData.ring)?.name}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 도입 여부 선택 */}
        <div className="form-group">
          <label className="form-label">
            도입 여부 *
          </label>
          <div className="adoption-status-group">
            <label className="adoption-option">
              <input
                type="radio"
                name="isAdopted"
                value="true"
                checked={formData.isAdopted === true}
                onChange={() => handleInputChange('isAdopted', true)}
              />
              <span className="adoption-label adopted">도입됨</span>
              <span className="adoption-description">현재 사용 중이거나 도입 완료된 기술</span>
            </label>
            <label className="adoption-option">
              <input
                type="radio"
                name="isAdopted"
                value="false"
                checked={formData.isAdopted === false}
                onChange={() => handleInputChange('isAdopted', false)}
              />
              <span className="adoption-label not-adopted">미도입</span>
              <span className="adoption-description">평가 중이거나 아직 도입하지 않은 기술</span>
            </label>
          </div>
        </div>

        {/* 설명 */}
        <div className="form-group">
          <label className="form-label" htmlFor="tech-description">
            상세 설명
          </label>
          <textarea
            id="tech-description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            className="form-textarea"
            placeholder="이 기술에 대한 상세한 설명을 입력해주세요. (선택사항)"
            rows="4"
          />
        </div>

        {/* 버튼 */}
        <div className="form-actions">
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-cancel"
          >
            취소
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!formData.name || !formData.sector || !formData.ring}
          >
            <Plus size={16} />
            {editingTech ? '변경사항 저장' : '기술 추가하기'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddTechnologyModal;