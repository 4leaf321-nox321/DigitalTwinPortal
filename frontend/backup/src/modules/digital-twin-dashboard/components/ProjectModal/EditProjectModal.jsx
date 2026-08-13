import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';

import { settingsData } from '../../data/sampleData';

import ModalLayout from './components/ModalLayout';
import BasicInfoSection from './components/BasicInfoSection';
import ResponsibleInfoSection from './components/ResponsibleInfoSection';
import PerformanceSection from './components/PerformanceSection';
import RemarksSection from './components/RemarksSection';
import ActionItemsSection from './components/ActionItemsSection';

import { 
  UNIT_OPTIONS, 
  SUBCATEGORY_OPTIONS, 
  INITIAL_PERFORMANCE_INPUT,
  INITIAL_PERSONNEL_INPUT 
} from './constants/formConstants';

import { 
  validateForm, 
  processFormData,
  validatePerformanceInput,
  validateNumericInput
} from './utils/formUtils';

const EditProjectModal = ({ isOpen, onClose, onSubmit, project, currentYear, settingsData }) => {
  const [formData, setFormData] = useState({
    사업부: '',
    프로세스: '',
    과제구분: '',
    과제명: '',
    성과목록: [],
    시작: 1,
    종료: 12,
    진행상태: '미착수',
    진행률: 0,
    과제참여인력목록: [],
    담당부서목록: [],
    과제PL: '',
    작성자: '',
    비고: '',
    액션아이템목록: [],
    PoC과제여부: false,
    중점과제여부: false,
    담당부서: '',
    과제참여인력: ''
  });
  
  const [performanceInput, setPerformanceInput] = useState(INITIAL_PERFORMANCE_INPUT);
  const [personnelInput, setPersonnelInput] = useState(INITIAL_PERSONNEL_INPUT);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (project) {
      let 과제참여인력목록 = [];
      let 담당부서목록 = [];
      
      if (project.과제참여인력목록 && Array.isArray(project.과제참여인력목록)) {
        과제참여인력목록 = project.과제참여인력목록;
        담당부서목록 = project.담당부서목록 || [];
      } else if (project.teamMembers && Array.isArray(project.teamMembers)) {
        과제참여인력목록 = project.teamMembers.map(member => ({
          이름: member.name,
          부서: member.department
        }));
        담당부서목록 = project.departments || [];
      } else {
        if (project.assignees && Array.isArray(project.assignees)) {
          const depts = project.department && Array.isArray(project.department) 
            ? project.department 
            : (project.department ? project.department.split(',').map(d => d.trim()) : []);
          
          과제참여인력목록 = project.assignees.map((name, index) => ({
            이름: name.trim(),
            부서: depts[Math.min(index, depts.length - 1)] || 'Unassigned'
          }));
          
          담당부서목록 = [...new Set(과제참여인력목록.map(p => p.부서))];
        } else if (project.personnel || project.과제참여인력) {
          const names = (project.personnel || project.과제참여인력).split(',').map(n => n.trim());
          const depts = project.department || project.담당부서
            ? (Array.isArray(project.department) 
              ? project.department 
              : (project.department || project.담당부서).split(',').map(d => d.trim()))
            : [];
          
          과제참여인력목록 = names.map((name, index) => ({
            이름: name,
            부서: depts[Math.min(index, depts.length - 1)] || 'Unassigned'
          }));
          
          담당부서목록 = [...new Set(과제참여인력목록.map(p => p.부서))];
        }
      }

      let 성과목록 = [];
      if (project.성과목록 && Array.isArray(project.성과목록) && project.성과목록.length > 0) {
        성과목록 = project.성과목록;
      } else if (project.performanceList && Array.isArray(project.performanceList)) {
        성과목록 = project.performanceList;
      }
      
      let 액션아이템목록 = [];
      if (project.액션아이템목록 && Array.isArray(project.액션아이템목록)) {
        액션아이템목록 = project.액션아이템목록;
      } else if (project.actionItems && Array.isArray(project.actionItems)) {
        액션아이템목록 = project.actionItems;
      }
      
      setFormData({
        사업부: project.사업부 || project.businessDivision || '',
        프로세스: project.프로세스 || project.process || project.division || '',
        과제구분: project.과제구분 || project.taskCategory || '',
        과제명: project.과제명 || project.taskName || '',
        성과목록: 성과목록,
        시작: project.시작 || project.start || 1,
        종료: project.종료 || project.end || 12,
        진행상태: project.진행상태 || project.status || '미착수',
        진행률: project.진행률 || project.progress || 0,
        과제참여인력목록: 과제참여인력목록,
        담당부서목록: 담당부서목록,
        과제PL: project.과제PL || project.manager || project.projectLeader || '',
        작성자: project.작성자 || project.author || '',
        비고: project.비고 || project.notes || project.과제상세설명 || '',
        액션아이템목록: 액션아이템목록,
        PoC과제여부: project.PoC과제여부 || project.isPoCTask || false,
        중점과제여부: project.중점과제여부 || project.isKeyTask || false,
        담당부서: Array.isArray(project.department) 
          ? project.department.join(', ') 
          : project.department || project.담당부서 || '',
        과제참여인력: Array.isArray(project.assignees) 
          ? project.assignees.join(', ') 
          : project.personnel || project.과제참얬인력 || ''
      });
    }
  }, [project]);

  const divisionOptions = (settingsData || {}).divisions ? settingsData.divisions.map(division => division.name) : [];
  const processOptions = (settingsData || {}).processes ? settingsData.processes.map(process => process.name) : [];
  const categoryOptions = (settingsData || {}).taskCategories ? settingsData.taskCategories.map(taskCategory => taskCategory.name) : [];
  const statusOptions = (settingsData || {}).statuses ? settingsData.statuses.map(status => status.name) : [];

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: (i + 1) + '월'
  }));

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };

  const handlePerformanceInputChange = (field, value) => {
    setPerformanceInput(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getCategoryName = (categoryId) => {
    const categories = (settingsData || {}).performanceCategories || [];
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : categoryId;
  };
  
  const getSubcategoryName = (subcategoryId) => {
    const subcategories = (settingsData || {}).performanceSubcategories || [];
    const subcategory = subcategories.find(sub => sub.id === subcategoryId);
    return subcategory ? subcategory.name : subcategoryId;
  };
  
  const getItemName = (itemId) => {
    const items = (settingsData || {}).performanceItems || [];
    const item = items.find(item => item.id === itemId);
    return item ? item.name : itemId;
  };

  const addPerformanceToList = () => {
    if (performanceInput.대분류ID && performanceInput.소분류ID && performanceInput.성과항목ID && 
        performanceInput.과제기여도 && performanceInput.현재수준 && performanceInput.목표수준 && performanceInput.단위) {
      const newPerformance = {
        대분류ID: performanceInput.대분류ID,
        소분류ID: performanceInput.소분류ID,
        성과항목ID: performanceInput.성과항목ID,
        대분류: getCategoryName(performanceInput.대분류ID),
        소분류: getSubcategoryName(performanceInput.소분류ID),
        성과항목: getItemName(performanceInput.성과항목ID),
        과제기여도: performanceInput.과제기여도,
        현재수준: performanceInput.현재수준,
        목표수준: performanceInput.목표수준,
        실적수준: performanceInput.실적수준 || '',
        단위: performanceInput.단위
      };
      
      setFormData(prev => ({
        ...prev,
        성과목록: [...prev.성과목록, newPerformance]
      }));
      
      setPerformanceInput(INITIAL_PERFORMANCE_INPUT);
    }
  };

  const handlePersonnelInputChange = (field, value) => {
    setPersonnelInput(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addPersonnelToList = () => {
    if (personnelInput.이름 && personnelInput.부서) {
      const newPersonnel = {
        이름: personnelInput.이름.trim(),
        부서: personnelInput.부서.trim()
      };
      
      const isDuplicate = formData.과제참여인력목록.some(person => 
        person.이름 === newPersonnel.이름 && person.부서 === newPersonnel.부서
      );
      
      if (isDuplicate) {
        alert('이미 등록된 인원입니다.');
        return;
      }
      
      setFormData(prev => {
        const newPersonnelList = [...prev.과제참여인력목록, newPersonnel];
        const departmentSet = new Set(newPersonnelList.map(person => person.부서));
        const newDepartmentList = Array.from(departmentSet);
        
        return {
          ...prev,
          과제참여인력목록: newPersonnelList,
          담당부서목록: newDepartmentList
        };
      });
      
      setPersonnelInput(INITIAL_PERSONNEL_INPUT);
    }
  };

  const removePerformanceFromList = (index) => {
    setFormData(prev => ({
      ...prev,
      성과목록: prev.성과목록.filter((_, i) => i !== index)
    }));
  };

  const removePersonnelFromList = (index) => {
    setFormData(prev => {
      const newPersonnelList = prev.과제참여인력목록.filter((_, i) => i !== index);
      const departmentSet = new Set(newPersonnelList.map(person => person.부서));
      const newDepartmentList = Array.from(departmentSet);
      
      return {
        ...prev,
        과제참여인력목록: newPersonnelList,
        담당부서목록: newDepartmentList
      };
    });
  };

  const removeDepartmentFromList = (index) => {
    const departmentToRemove = formData.담당부서목록[index];
    
    if (window.confirm(departmentToRemove + ' 부서와 모든 소속 인원을 삭제하시겠습니까?')) {
      setFormData(prev => {
        const newPersonnelList = prev.과제참여인력목록.filter(person => person.부서 !== departmentToRemove);
        const newDepartmentList = prev.담당부서목록.filter((_, i) => i !== index);
        
        return {
          ...prev,
          과제참여인력목록: newPersonnelList,
          담당부서목록: newDepartmentList
        };
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    const processedData = processFormData(formData, currentYear || project.taskYear);
    const updatedProject = {
      ...project,
      ...processedData,
      id: project.id
    };
    
    console.log('Updated project data:', updatedProject);
    onSubmit(updatedProject);
    handleClose();
  };

  const handleClose = () => {
    setErrors({});
    setPerformanceInput(INITIAL_PERFORMANCE_INPUT);
    setPersonnelInput(INITIAL_PERSONNEL_INPUT);
    onClose();
  };

  if (!isOpen || !project) return null;

  return (
    <AnimatePresence>
      <ModalLayout 
        handleClose={handleClose}
        currentYear={currentYear || project.taskYear}
        handleSubmit={handleSubmit}
        isEditMode={true}
      >
        <BasicInfoSection 
          formData={formData}
          handleInputChange={handleInputChange}
          errors={errors}
          divisionOptions={divisionOptions}
          processOptions={processOptions}
          categoryOptions={categoryOptions}
          statusOptions={statusOptions}
          monthOptions={monthOptions}
        />
        <ResponsibleInfoSection 
          formData={formData}
          handleInputChange={handleInputChange}
          errors={errors}
          personnelInput={personnelInput}
          handlePersonnelInputChange={handlePersonnelInputChange}
          addPersonnelToList={addPersonnelToList}
          removePersonnelFromList={removePersonnelFromList}
          removeDepartmentFromList={removeDepartmentFromList}
        />
        <PerformanceSection 
          performanceInput={performanceInput}
          handlePerformanceInputChange={handlePerformanceInputChange}
          addPerformanceToList={addPerformanceToList}
          formData={formData}
          removePerformanceFromList={removePerformanceFromList}
          errors={errors}
          UNIT_OPTIONS={UNIT_OPTIONS}
          SUBCATEGORY_OPTIONS={SUBCATEGORY_OPTIONS}
          settingsData={settingsData}
        />
        <RemarksSection 
          formData={formData}
          handleInputChange={handleInputChange}
        />
        <ActionItemsSection 
          formData={formData}
          handleInputChange={handleInputChange}
        />
      </ModalLayout>
    </AnimatePresence>
  );
};

export default EditProjectModal;