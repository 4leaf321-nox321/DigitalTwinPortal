import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Target, Search, Filter, Trash2, AlertTriangle } from 'lucide-react';

const AddPerformanceModal = ({
  isOpen,
  onClose,
  onSubmit,
  onDelete, // 새로 추가된 props
  settingsData = {},
  globalPerformances = [],
  showSuccess,
  showError
}) => {
  const [formData, setFormData] = useState({
    대분류: '',
    소분류: '',
    성과항목: '',
    현재수준: '',
    목표수준: '',
    실적수준: '',
    단위: '',
    설명: ''
  });

  const [selectedCategory, setSelectedCategory] = useState('');
  const [availableSubcategories, setAvailableSubcategories] = useState([]);
  const [editingPerformance, setEditingPerformance] = useState(null); // 수정 중인 성과 항목
  
  // 리스트용 상태
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subcategoryFilter, setSubcategoryFilter] = useState('');

  // 삭제 확인 모달 상태
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    performance: null,
    connectedProjects: []
  });

  // 전체 삭제 확인 모달 상태
  const [deleteAllConfirm, setDeleteAllConfirm] = useState({
    isOpen: false
  });

  // 설정 데이터에서 카테고리와 서브카테고리 목록 가져오기
  const categories = settingsData.performanceCategories || [];
  const subcategories = settingsData.performanceSubcategories || [];

  useEffect(() => {
    if (selectedCategory) {
      const filteredSubs = subcategories.filter(sub => sub.categoryId === selectedCategory);
      setAvailableSubcategories(filteredSubs);
    } else {
      setAvailableSubcategories([]);
    }
  }, [selectedCategory, subcategories]);

  useEffect(() => {
    if (isOpen) {
      // 모달이 열릴 때 폼 초기화
      setFormData({
        대분류: '',
        소분류: '',
        성과항목: '',
        현재수준: '',
        목표수준: '',
        실적수준: '',
        단위: '',
        설명: ''
      });
      setSelectedCategory('');
      setSearchTerm('');
      setCategoryFilter('');
      setSubcategoryFilter('');
      setDeleteConfirm({ isOpen: false, performance: null, connectedProjects: [] });
      setDeleteAllConfirm({ isOpen: false });
    }
  }, [isOpen]);

  const handleCategoryChange = (categoryId) => {
    setSelectedCategory(categoryId);
    const category = categories.find(cat => cat.id === categoryId);
    
    // 대분류에 따른 단위 자동 설정
    let autoUnit = '';
    if (category?.name === '비용절감') {
      autoUnit = '억원';
    } else if (category?.name === '리드타임단축') {
      autoUnit = 'hrs';
    }
    
    setFormData(prev => ({
      ...prev,
      대분류: category ? category.name : '',
      소분류: '', // 대분류 변경 시 소분류 초기화
      단위: autoUnit // 자동 설정된 단위
    }));
  };

  const handleSubcategoryChange = (subcategoryId) => {
    const subcategory = subcategories.find(sub => sub.id === subcategoryId);
    const subcategoryName = subcategory ? subcategory.name : '';
    
    // 기존 대분류에 따른 단위 유지
    let autoUnit = formData.단위;
    
    // 대분류가 비용절감이나 리드타임단축이 아닌 경우에만 소분류 기반 단위 설정
    if (formData.대분류 !== '비용절감' && formData.대분류 !== '리드타임단축') {
      // 소분류에 따른 단위 자동 설정
      if (subcategoryName.includes('정확도') || 
          subcategoryName.endsWith('율') || 
          subcategoryName.endsWith('률')) {
        autoUnit = '%';
      } else {
        autoUnit = ''; // 다른 소분류는 수동 입력
      }
    }
    
    setFormData(prev => ({
      ...prev,
      소분류: subcategoryName,
      단위: autoUnit
    }));
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 단위가 자동 설정되는 조건 확인
  const isUnitAutoSet = () => {
    const { 대분류, 소분류 } = formData;
    
    // 대분류에 따른 자동 설정
    if (대분류 === '비용절감' || 대분류 === '리드타임단축') {
      return true;
    }
    
    // 소분류에 따른 자동 설정
    if (소분류.includes('정확도') || 
        소분류.endsWith('율') || 
        소분류.endsWith('률')) {
      return true;
    }
    
    return false;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // 필수 필드 검증
    if (!formData.성과항목.trim()) {
      showError('성과 항목명을 입력해주세요.');
      return;
    }

    if (!formData.대분류) {
      showError('대분류를 선택해주세요.');
      return;
    }

    if (!formData.소분류) {
      showError('소분류를 선택해주세요.');
      return;
    }

    if (editingPerformance) {
      // 수정 모드
      const updatedPerformance = {
        ...editingPerformance,
        ...formData,
        updatedAt: new Date().toISOString(),
        isEditing: true // 수정 모드임을 표시
      };

      try {
        onSubmit(updatedPerformance);
        showSuccess('성과 항목이 성공적으로 수정되었습니다.');
        handleFormReset();
      } catch (error) {
        showError('성과 수정 중 오류가 발생했습니다: ' + error.message);
      }
    } else {
      // 새로 생성 모드
      const newPerformance = {
        ...formData,
        id: `global_perf_${Date.now()}`,
        createdAt: new Date().toISOString(),
        isActive: true,
        isEditing: false // 새 생성임을 표시
      };

      try {
        onSubmit(newPerformance);
        showSuccess('새 성과 항목이 성공적으로 생성되었습니다. 이제 각 과제에서 이 성과를 선택할 수 있습니다.');
        handleFormReset();
      } catch (error) {
        showError('성과 생성 중 오류가 발생했습니다: ' + error.message);
      }
    }
  };

  // 폼 초기화 함수
  const handleFormReset = () => {
    setFormData({
      대분류: '',
      소분류: '',
      성과항목: '',
      현재수준: '',
      목표수준: '',
      실적수준: '',
      단위: '',
      설명: ''
    });
    setSelectedCategory('');
    setEditingPerformance(null);
  };

  // 성과 항목 편집 로드
  const handleEditPerformance = (performance) => {
    // 폼에 데이터 로드
    setFormData({
      대분류: performance.대분류 || '',
      소분류: performance.소분류 || '',
      성과항목: performance.성과항목 || '',
      현재수준: performance.현재수준 || '',
      목표수준: performance.목표수준 || '',
      실적수준: performance.실적수준 || '',
      단위: performance.단위 || '',
      설명: performance.설명 || ''
    });

    // 카테고리 설정
    const category = categories.find(cat => cat.name === performance.대분류);
    if (category) {
      setSelectedCategory(category.id);
    }

    // 수정 모드 설정
    setEditingPerformance(performance);

    // 좌측 패널로 스크롤 (선택사항)
    const createForm = document.querySelector('.create-form');
    if (createForm) {
      createForm.scrollTop = 0;
    }
  };

  // 삭제 확인 처리
  const handleDeleteClick = (performance, e) => {
    e.stopPropagation(); // 카드 클릭 이벤트 방지
    
    // 이 성과 항목을 사용하는 과제들 찾기 (상위 컴포넌트에서 전달받거나 계산)
    const connectedProjects = []; // 실제로는 상위에서 계산해서 전달받아야 함
    
    setDeleteConfirm({
      isOpen: true,
      performance,
      connectedProjects
    });
  };

  // 삭제 실행
  const handleConfirmDelete = () => {
    const { performance } = deleteConfirm;
    
    if (performance && onDelete) {
      try {
        onDelete(performance.id);
        showSuccess(`성과 항목 "${performance.성과항목}"이(가) 삭제되었습니다.`);
        
        // 현재 편집 중인 성과가 삭제된 경우 폼 초기화
        if (editingPerformance?.id === performance.id) {
          handleFormReset();
        }
      } catch (error) {
        showError('성과 삭제 중 오류가 발생했습니다: ' + error.message);
      }
    }
    
    setDeleteConfirm({ isOpen: false, performance: null, connectedProjects: [] });
  };

  // 삭제 취소
  const handleCancelDelete = () => {
    setDeleteConfirm({ isOpen: false, performance: null, connectedProjects: [] });
  };

  // 모든 성과 삭제 처리
  const handleDeleteAllClick = () => {
    if (globalPerformances.length === 0) {
      showError('삭제할 성과 항목이 없습니다.');
      return;
    }
    setDeleteAllConfirm({ isOpen: true });
  };

  // 모든 성과 삭제 실행
  const handleConfirmDeleteAll = () => {
    try {
      const totalCount = globalPerformances.length;
      
      if (onDelete) {
        // 전체 삭제를 나타내는 특별한 ID 사용
        onDelete('ALL');
      }
      
      showSuccess(`모든 성과 항목(${totalCount}개)이 삭제되었습니다.`);
      
      // 편집 중인 성과가 있으면 폼 초기화
      if (editingPerformance) {
        handleFormReset();
      }
    } catch (error) {
      showError('전체 성과 삭제 중 오류가 발생했습니다: ' + error.message);
    }
    
    setDeleteAllConfirm({ isOpen: false });
  };

  // 모든 성과 삭제 취소
  const handleCancelDeleteAll = () => {
    setDeleteAllConfirm({ isOpen: false });
  };

  const handleClose = () => {
    // 변경사항이 있는지 확인
    const hasChanges = Object.values(formData).some(value => value.trim() !== '');
    
    if (hasChanges) {
      if (window.confirm('작성 중인 내용이 있습니다. 정말 닫으시겠습니까?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // 성과 목록 필터링
  const getFilteredPerformances = () => {
    let filtered = globalPerformances;

    // 검색어 필터링
    if (searchTerm) {
      filtered = filtered.filter(perf => 
        perf.성과항목.toLowerCase().includes(searchTerm.toLowerCase()) ||
        perf.대분류.toLowerCase().includes(searchTerm.toLowerCase()) ||
        perf.소분류.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (perf.설명 && perf.설명.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // 대분류 필터링
    if (categoryFilter) {
      filtered = filtered.filter(perf => perf.대분류 === categoryFilter);
    }

    // 소분류 필터링
    if (subcategoryFilter) {
      filtered = filtered.filter(perf => perf.소분류 === subcategoryFilter);
    }

    return filtered;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="modal-overlay"
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 20 }}
          className="performance-modal"
        >
          {/* 모달 헤더 */}
          <div className="modal-header">
            <div className="header-left">
              <Target className="modal-icon" size={24} />
              <h2>성과 항목 관리</h2>
            </div>
            <button onClick={handleClose} className="close-btn">
              <X size={20} />
            </button>
          </div>

          <div className="modal-info">
            <p>
              📋 <strong>성과 항목을 생성하고 관리합니다.</strong> 생성된 성과 항목은 각 과제에서 선택하여 사용할 수 있습니다.
            </p>
          </div>

          {/* 메인 컨텐츠 - 좌우 분할 */}
          <div className="modal-content">
            {/* 좌측: 새 성과 입력 */}
            <div className="left-panel">
              <div className="panel-header">
                <h3>
                  <Plus size={18} />
                  {editingPerformance ? '성과 수정' : '새 성과 생성'}
                </h3>
                {editingPerformance && (
                  <button
                    type="button"
                    onClick={handleFormReset}
                    className="reset-btn"
                    title="새 성과 생성 모드로 돌아가기"
                  >
                    <X size={16} />
                    취소
                  </button>
                )}
              </div>
              
              <form onSubmit={handleSubmit} className="create-form">
                <div className="form-section">
                  <h4>기본 정보</h4>
                  
                  <div className="form-row">
                    <label>성과 항목명 <span className="required">*</span></label>
                    <input
                      type="text"
                      value={formData.성과항목}
                      onChange={(e) => handleInputChange('성과항목', e.target.value)}
                      placeholder="예: 시뮬레이션 정확도 개선, 처리 속도 향상 등"
                      className="form-input"
                      required
                    />
                  </div>

                  <div className="form-grid-three">
                    <div className="form-row">
                      <label>대분류 <span className="required">*</span></label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="form-select"
                        required
                      >
                        <option value="">대분류 선택</option>
                        {categories.map(category => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-row">
                      <label>소분류 <span className="required">*</span></label>
                      <select
                        value={availableSubcategories.find(sub => sub.name === formData.소분류)?.id || ''}
                        onChange={(e) => handleSubcategoryChange(e.target.value)}
                        className="form-select"
                        disabled={!selectedCategory}
                        required
                      >
                        <option value="">소분류 선택</option>
                        {availableSubcategories.map(subcategory => (
                          <option key={subcategory.id} value={subcategory.id}>
                            {subcategory.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-row">
                      <label>단위</label>
                      <input
                        type="text"
                        value={formData.단위}
                        onChange={(e) => handleInputChange('단위', e.target.value)}
                        className={`form-input ${isUnitAutoSet() ? 'auto-set' : ''}`}
                        disabled={isUnitAutoSet()}
                        readOnly={isUnitAutoSet()}
                      />
                    </div>
                  </div>

                  <div className="form-grid-three">
                    <div className="form-row">
                      <label>현재</label>
                      <input
                        type="text"
                        value={formData.현재수준}
                        onChange={(e) => handleInputChange('현재수준', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="form-row">
                      <label>목표</label>
                      <input
                        type="text"
                        value={formData.목표수준}
                        onChange={(e) => handleInputChange('목표수준', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="form-row">
                      <label>실적</label>
                      <input
                        type="text"
                        value={formData.실적수준}
                        onChange={(e) => handleInputChange('실적수준', e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <label>상세 설명</label>
                    <textarea
                      value={formData.설명}
                      onChange={(e) => handleInputChange('설명', e.target.value)}
                      placeholder="성과 항목에 대한 상세 설명을 입력하세요."
                      className="form-textarea"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="submit-btn"
                  >
                    <Plus size={16} />
                    {editingPerformance ? '성과 항목 수정' : '성과 항목 생성'}
                  </button>
                </div>
              </form>
            </div>

            {/* 우측: 성과 목록 */}
            <div className="right-panel">
              <div className="panel-header">
                <h3>
                  <Target size={18} />
                  등록된 성과 항목 ({getFilteredPerformances().length}개)
                </h3>
                {globalPerformances.length > 0 && (
                  <button
                    onClick={handleDeleteAllClick}
                    className="delete-all-btn"
                    title="모든 성과 항목 삭제"
                  >
                    <Trash2 size={16} />
                    전체 삭제
                  </button>
                )}
              </div>

              {/* 검색 및 필터 */}
              <div className="list-filters">
                <div className="search-box">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="성과 항목명, 분류명으로 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>
                
                <div className="filter-grid">
                  <select
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value);
                      setSubcategoryFilter(''); // 대분류 변경 시 소분류 초기화
                    }}
                    className="filter-select"
                  >
                    <option value="">전체 대분류</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  
                  <select
                    value={subcategoryFilter}
                    onChange={(e) => setSubcategoryFilter(e.target.value)}
                    className="filter-select"
                    disabled={!categoryFilter}
                  >
                    <option value="">전체 소분류</option>
                    {subcategories
                      .filter(sub => {
                        const category = categories.find(cat => cat.name === categoryFilter);
                        return category ? sub.categoryId === category.id : false;
                      })
                      .map(subcategory => (
                        <option key={subcategory.id} value={subcategory.name}>
                          {subcategory.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* 성과 목록 */}
              <div className="performance-list">
                {getFilteredPerformances().length === 0 ? (
                  <div className="empty-state">
                    {globalPerformances.length === 0 ? (
                      <>
                        <Target size={48} className="empty-icon" />
                        <p>등록된 성과 항목이 없습니다.</p>
                        <p className="empty-subtitle">좌측 폼에서 새 성과를 생성해보세요!</p>
                      </>
                    ) : (
                      <>
                        <Search size={48} className="empty-icon" />
                        <p>검색 조건에 맞는 성과 항목이 없습니다.</p>
                        <p className="empty-subtitle">다른 검색어나 필터를 시도해보세요.</p>
                      </>
                    )}
                  </div>
                ) : (
                  getFilteredPerformances().map((performance, index) => (
                    <div 
                      key={performance.id || index} 
                      className={`performance-card ${
                        performance.isFromSample ? 'sample-item' : ''
                      } ${
                        editingPerformance?.id === performance.id ? 'editing' : ''
                      }`}
                      onClick={() => handleEditPerformance(performance)}
                      style={{ cursor: 'pointer' }}
                      title="클릭하여 수정하기"
                    >
                      <div className="card-header">
                        <div className="performance-title">
                          <div className="title-content">
                            {performance.성과항목}
                            {performance.isFromSample && <span className="sample-badge">샘플</span>}
                          </div>
                          {/* 삭제 버튼 - 성과명과 같은 행 우측 끝 */}
                          <button
                            className="delete-btn"
                            onClick={(e) => handleDeleteClick(performance, e)}
                            title="성과 삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="performance-id-badge">
                          ID: {performance.id}
                        </div>
                        <div className="performance-category">
                          {performance.대분류} › {performance.소분류}
                        </div>
                      </div>
                      
                      <div className="card-content">
                        {performance.단위 && (
                          <div className="performance-detail">
                            <span className="label">단위:</span> {performance.단위}
                          </div>
                        )}
                        
                        {(performance.현재수준 || performance.목표수준 || performance.실적수준) && (
                          <div className="performance-levels">
                            {performance.현재수준 && (
                              <span className="level-item">
                                현재: {performance.현재수준} {performance.단위}
                              </span>
                            )}
                            {performance.목표수준 && (
                              <span className="level-item">
                                목표: {performance.목표수준} {performance.단위}
                              </span>
                            )}
                            {performance.실적수준 && (
                              <span className="level-item">
                                실적: {performance.실적수준} {performance.단위}
                              </span>
                            )}
                          </div>
                        )}
                        
                        {performance.설명 && (
                          <div className="performance-description">
                            {performance.설명}
                          </div>
                        )}
                        
                        <div className="performance-meta">
                          생성일: {new Date(performance.createdAt).toLocaleDateString('ko-KR')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 모달 푸터 */}
          <div className="modal-footer">
            <button
              type="button"
              onClick={handleClose}
              className="close-modal-btn"
            >
              닫기
            </button>
          </div>
        </motion.div>

        {/* 삭제 확인 모달 */}
        <AnimatePresence>
          {deleteConfirm.isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="delete-modal-overlay"
              onClick={(e) => e.target === e.currentTarget && handleCancelDelete()}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="delete-modal"
              >
                <div className="delete-modal-header">
                  <AlertTriangle size={24} className="warning-icon" />
                  <h3>성과 항목 삭제</h3>
                </div>
                
                <div className="delete-modal-content">
                  <p>다음 성과 항목을 정말 삭제하시겠습니까?</p>
                  
                  <div className="delete-target">
                    <strong>{deleteConfirm.performance?.성과항목}</strong>
                    <div className="delete-target-detail">
                      {deleteConfirm.performance?.대분류} › {deleteConfirm.performance?.소분류}
                    </div>
                  </div>
                  
                  <div className="warning-message">
                    <AlertTriangle size={16} />
                    <span>⚠️ 이 성과 항목을 사용하는 모든 과제에서도 해당 성과가 삭제됩니다.</span>
                  </div>
                  
                  {deleteConfirm.connectedProjects.length > 0 && (
                    <div className="connected-projects">
                      <h4>영향을 받는 과제:</h4>
                      <ul>
                        {deleteConfirm.connectedProjects.map((project, index) => (
                          <li key={index}>{project.과제명}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                
                <div className="delete-modal-actions">
                  <button
                    onClick={handleCancelDelete}
                    className="cancel-delete-btn"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleConfirmDelete}
                    className="confirm-delete-btn"
                  >
                    <Trash2 size={16} />
                    삭제하기
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 모든 성과 삭제 확인 모달 */}
        <AnimatePresence>
          {deleteAllConfirm.isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="delete-modal-overlay"
              onClick={(e) => e.target === e.currentTarget && handleCancelDeleteAll()}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="delete-modal"
              >
                <div className="delete-modal-header">
                  <AlertTriangle size={24} className="warning-icon" />
                  <h3>모든 성과 항목 삭제</h3>
                </div>
                
                <div className="delete-modal-content">
                  <p>등록된 모든 성과 항목을 삭제하시겠습니까?</p>
                  
                  <div className="delete-target">
                    <strong>대상: 전체 {globalPerformances.length}개 성과 항목</strong>
                    <div className="delete-target-detail">
                      모든 대분류 › 모든 소분류
                    </div>
                  </div>
                  
                  <div className="warning-message">
                    <AlertTriangle size={16} />
                    <span>⚠️ 이 동작은 되돌릴 수 없습니다. 모든 프로젝트에서 연결된 성과들도 함께 삭제됩니다.</span>
                  </div>
                </div>
                
                <div className="delete-modal-actions">
                  <button
                    onClick={handleCancelDeleteAll}
                    className="cancel-delete-btn"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleConfirmDeleteAll}
                    className="confirm-delete-btn"
                  >
                    <Trash2 size={16} />
                    전체 삭제
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <style jsx>{`
        .modal-overlay {
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
          padding: 1rem;
        }

        .performance-modal {
          background: white;
          border-radius: 0.75rem;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          width: 100%;
          max-width: 1400px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          flex-shrink: 0;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .modal-icon {
          color: #fbbf24;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .close-btn {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 0.375rem;
          transition: all 0.2s ease;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .modal-info {
          padding: 1rem 1.5rem;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-bottom: 1px solid #f59e0b;
          flex-shrink: 0;
        }

        .modal-info p {
          margin: 0;
          font-size: 0.875rem;
          color: #92400e;
        }

        .modal-content {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .left-panel,
        .right-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .left-panel {
          border-right: 1px solid #e5e7eb;
          background: #fefefe;
        }

        .right-panel {
          background: #f9fafb;
        }

        .panel-header {
          padding: 1.25rem 1.5rem 1rem 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #374151;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .reset-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: #f3f4f6;
          color: #6b7280;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .reset-btn:hover {
          background: #e5e7eb;
          border-color: #9ca3af;
          color: #374151;
        }

        .delete-all-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: #fee2e2;
          color: #dc2626;
          border: 1px solid #fca5a5;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 500;
        }

        .delete-all-btn:hover {
          background: #fecaca;
          border-color: #f87171;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
        }

        .create-form {
          padding: 1.5rem;
          overflow-y: auto;
          flex: 1;
        }

        .form-section {
          margin-bottom: 1.5rem;
        }

        .form-section h4 {
          margin: 0 0 1rem 0;
          font-size: 0.9rem;
          font-weight: 600;
          color: #374151;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 0.5rem;
        }

        .form-row {
          margin-bottom: 1rem;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .form-grid-three {
          display: grid;
          grid-template-columns: 1fr 1fr 0.8fr;
          gap: 1rem;
        }

        /* 🎯 커스텀 폼 레이아웃 - 명확한 레이블 폭 설정 */
        
        /* 성과항목명 필드 - 80px 레이블 */
        .form-section:first-child > .form-row:first-child {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 0.75rem !important;
        }
        
        .form-section:first-child > .form-row:first-child > label {
          margin-bottom: 0 !important;
          flex-shrink: 0 !important;
          width: 80px !important;
          min-width: 80px !important;
          max-width: 80px !important;
          font-size: 0.8rem !important;
          text-align: left !important;
        }
        
        .form-section:first-child > .form-row:first-child > .form-input {
          flex: 1 !important;
        }
        
        /* 모든 그리드 행들 - 50px 레이블 (대분류/소분류/단위 + 현재/목표/실적) */
        .form-section:first-child > .form-grid-three > .form-row {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 0.75rem !important;
        }
        
        .form-section:first-child > .form-grid-three > .form-row > label {
          margin-bottom: 0 !important;
          flex-shrink: 0 !important;
          width: 50px !important;
          min-width: 50px !important;
          max-width: 50px !important;
          font-size: 0.8rem !important;
          text-align: left !important;
        }
        
        .form-section:first-child > .form-grid-three > .form-row > .form-select,
        .form-section:first-child > .form-grid-three > .form-row > .form-input {
          flex: 1 !important;
        }
        
        /* 상세 설명 필드 - 80px 레이블 */
        .form-section:first-child > .form-row:last-child {
          display: flex !important;
          flex-direction: row !important;
          align-items: flex-start !important;
          gap: 0.75rem !important;
        }
        
        .form-section:first-child > .form-row:last-child > label {
          margin-bottom: 0 !important;
          flex-shrink: 0 !important;
          width: 80px !important;
          min-width: 80px !important;
          max-width: 80px !important;
          font-size: 0.8rem !important;
          text-align: left !important;
          padding-top: 0.875rem;
        }
        
        .form-section:first-child > .form-row:last-child > .form-textarea {
          flex: 1 !important;
        }

        .form-row label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #374151;
          font-size: 0.875rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: left;
        }

        .required {
          color: #ef4444;
        }

        .form-input,
        .form-select,
        .form-textarea {
          width: 100%;
          padding: 0.875rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          transition: all 0.2s ease;
          box-sizing: border-box;
          min-height: 42px;
        }

        .form-select {
          padding: 0.75rem 0.875rem;
          background-color: white;
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
          background-position: right 0.75rem center;
          background-repeat: no-repeat;
          background-size: 1.5em 1.5em;
          appearance: none;
          cursor: pointer;
        }

        .form-input.auto-set {
          background-color: #f3f4f6;
          color: #6b7280;
          cursor: not-allowed;
          border-color: #d1d5db;
        }

        .form-input:focus,
        .form-select:focus,
        .form-textarea:focus {
          outline: none;
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
        }

        .form-select:disabled {
          background-color: #f9fafb;
          color: #9ca3af;
          cursor: not-allowed;
          background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
        }

        .form-textarea {
          resize: vertical;
          min-height: 80px;
        }

        .form-actions {
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid #e5e7eb;
        }

        .submit-btn {
          width: 100%;
          padding: 0.875rem 1.5rem;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          border: none;
          border-radius: 0.375rem;
          font-weight: 500;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }

        .submit-btn:hover {
          background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }

        .submit-btn:active {
          transform: translateY(0);
        }

        .list-filters {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          flex-shrink: 0;
        }

        .search-box {
          position: relative;
          margin-bottom: 0.75rem;
        }

        .search-icon {
          position: absolute;
          left: 0.75rem;
          top: 50%;
          transform: translateY(-50%);
          color: #9ca3af;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem 0.75rem 0.75rem 2.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          box-sizing: border-box;
        }

        .search-input:focus {
          outline: none;
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
        }

        .filter-grid {
          display: grid;
          grid-template-columns: 1.5fr 1.5fr;
          gap: 0.75rem;
        }

        .filter-select {
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          background: white;
          width: 100%;
          min-width: 200px;
          max-width: none;
        }

        .filter-select:disabled {
          background: #f9fafb;
          color: #9ca3af;
        }

        .performance-list {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          color: #6b7280;
          padding: 2rem;
        }

        .empty-icon {
          color: #d1d5db;
          margin-bottom: 1rem;
        }

        .empty-state p {
          margin: 0.25rem 0;
          font-weight: 500;
        }

        .empty-subtitle {
          font-size: 0.875rem;
          color: #9ca3af;
          font-style: italic;
        }

        .sample-item {
          border-left: 4px solid #f59e0b;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 10%, white 10%);
        }

        .sample-badge {
          display: inline-block;
          background: #f59e0b;
          color: white;
          font-size: 0.75rem;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          margin-left: 0.5rem;
          font-weight: 500;
        }

        .performance-card {
          border: 1px solid #e5e7eb;
          border-radius: 0.5rem;
          padding: 1rem;
          background: white;
          transition: all 0.2s ease;
          cursor: pointer;
          position: relative;
        }

        .performance-card:hover {
          border-color: #f59e0b;
          box-shadow: 0 2px 4px rgba(245, 158, 11, 0.1);
          transform: translateY(-1px);
        }

        .performance-card.editing {
          border-color: #3b82f6;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 10%, white 10%);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15);
        }

        .performance-card.editing:hover {
          border-color: #2563eb;
          box-shadow: 0 6px 16px rgba(59, 130, 246, 0.2);
        }

        .card-header {
          margin-bottom: 0.75rem;
          position: relative;
        }

        .performance-title {
          font-weight: 600;
          color: #374151;
          font-size: 1rem;
          margin-bottom: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .title-content {
          display: flex;
          align-items: center;
          flex: 1;
          min-width: 0;
        }

        .performance-id-badge {
          display: inline-block;
          background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
          color: #4338ca;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          margin-bottom: 0.375rem;
          border: 1px solid #a5b4fc;
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        }

        .performance-category {
          color: #f59e0b;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .delete-btn {
          background: none;
          border: none;
          color: #dc2626;
          cursor: pointer;
          padding: 0.375rem;
          border-radius: 0.375rem;
          transition: all 0.2s ease;
          opacity: 0;
          visibility: hidden;
          transform: scale(0.8);
          flex-shrink: 0;
        }

        .performance-card:hover .delete-btn {
          opacity: 1;
          visibility: visible;
          transform: scale(1);
        }

        .delete-btn:hover {
          background: #fef2f2;
          color: #b91c1c;
          transform: scale(1.1);
        }

        .card-content {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .performance-detail {
          font-size: 0.875rem;
          color: #6b7280;
        }

        .label {
          font-weight: 500;
          color: #374151;
        }

        .performance-levels {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .level-item {
          background: #f3f4f6;
          padding: 0.25rem 0.5rem;
          border-radius: 0.25rem;
          color: #4b5563;
          font-size: 0.8rem;
        }

        .performance-description {
          font-size: 0.875rem;
          color: #6b7280;
          line-height: 1.4;
          padding: 0.5rem;
          background: #f9fafb;
          border-radius: 0.25rem;
          border-left: 3px solid #f59e0b;
        }

        .performance-meta {
          font-size: 0.75rem;
          color: #9ca3af;
          padding-top: 0.5rem;
          border-top: 1px solid #f3f4f6;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          padding: 1rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
          flex-shrink: 0;
        }

        .close-modal-btn {
          padding: 0.75rem 1.5rem;
          background: white;
          color: #6b7280;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-weight: 500;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .close-modal-btn:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        /* 삭제 확인 모달 스타일 */
        .delete-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          padding: 1rem;
        }

        .delete-modal {
          background: white;
          border-radius: 0.75rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          width: 100%;
          max-width: 500px;
          overflow: hidden;
        }

        .delete-modal-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
        }

        .warning-icon {
          color: #dc2626;
        }

        .delete-modal-header h3 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #dc2626;
        }

        .delete-modal-content {
          padding: 1.5rem;
        }

        .delete-modal-content p {
          margin: 0 0 1rem 0;
          color: #374151;
          font-size: 0.875rem;
        }

        .delete-target {
          background: #f9fafb;
          padding: 1rem;
          border-radius: 0.5rem;
          border-left: 4px solid #dc2626;
          margin: 1rem 0;
        }

        .delete-target strong {
          display: block;
          color: #dc2626;
          font-size: 1rem;
          margin-bottom: 0.5rem;
        }

        .delete-target-detail {
          color: #6b7280;
          font-size: 0.875rem;
        }

        .warning-message {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          background: #fef3c7;
          border: 1px solid #f59e0b;
          border-radius: 0.375rem;
          margin: 1rem 0;
        }

        .warning-message span {
          color: #92400e;
          font-size: 0.875rem;
        }

        .connected-projects {
          margin-top: 1rem;
          padding: 1rem;
          background: #f3f4f6;
          border-radius: 0.375rem;
        }

        .connected-projects h4 {
          margin: 0 0 0.5rem 0;
          color: #374151;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .connected-projects ul {
          margin: 0;
          padding-left: 1.5rem;
          color: #6b7280;
          font-size: 0.875rem;
        }

        .connected-projects li {
          margin-bottom: 0.25rem;
        }

        .delete-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .cancel-delete-btn,
        .confirm-delete-btn {
          padding: 0.75rem 1.5rem;
          border-radius: 0.375rem;
          font-weight: 500;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .cancel-delete-btn {
          background: white;
          color: #6b7280;
          border: 1px solid #d1d5db;
        }

        .cancel-delete-btn:hover {
          background: #f9fafb;
          border-color: #9ca3af;
        }

        .confirm-delete-btn {
          background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
          color: white;
          border: none;
        }

        .confirm-delete-btn:hover {
          background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
        }

        @media (max-width: 1024px) {
          .performance-modal {
            max-width: 95vw;
          }
          
          .modal-content {
            flex-direction: column;
          }
          
          .left-panel {
            border-right: none;
            border-bottom: 1px solid #e5e7eb;
            max-height: 50vh;
          }
          
          .form-grid {
            grid-template-columns: 1fr;
          }
          
          .form-grid-three {
            grid-template-columns: 1fr;
          }
          
          .filter-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .modal-overlay {
            padding: 0.5rem;
          }
          
          .performance-modal {
            max-height: 95vh;
          }
          
          .create-form,
          .list-filters,
          .performance-list {
            padding: 1rem;
          }
          
          .delete-modal-overlay {
            padding: 0.5rem;
          }
          
          .delete-modal {
            max-width: 95vw;
          }
        }
      `}</style>
    </AnimatePresence>
  );
};

export default AddPerformanceModal;