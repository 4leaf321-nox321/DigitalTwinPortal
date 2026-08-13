import React, { useRef, useEffect } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import styled from 'styled-components';
import { FileText } from 'lucide-react';

const RemarksContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  
  @media (max-width: 768px) {
    gap: 0.75rem;
  }
`;

const SectionTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  @media (max-width: 768px) {
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const StyledQuillContainer = styled.div`
  .ql-editor {
    min-height: 120px;
    font-size: 0.875rem;
    line-height: 1.5;
    padding: 0.75rem 1rem;
    overflow: visible;
    
    @media (max-width: 768px) {
      min-height: 100px;
      font-size: 0.8rem;
      padding: 0.625rem 0.875rem;
    }
  }
  
  .ql-container {
    border: 2px solid #e5e7eb;
    border-radius: 0 0 0.5rem 0.5rem;
    transition: all 0.2s ease;
    
    &:focus-within {
      border-color: #10b981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }
  }
  
  .ql-toolbar {
    border: 2px solid #e5e7eb;
    border-bottom: none;
    border-radius: 0.5rem 0.5rem 0 0;
    
    .ql-formats {
      margin-right: 15px;
    }
    
    .ql-picker-label {
      border: none;
      padding: 2px 5px;
      font-size: 13px;
    }
    
    button {
      width: 28px;
      height: 28px;
      padding: 3px;
      border: none;
      border-radius: 3px;
      
      &:hover {
        background-color: #f3f4f6;
      }
      
      &.ql-active {
        background-color: #10b981;
        color: white;
      }
    }
  }
  
  .ql-editor.ql-blank::before {
    color: #9ca3af;
    font-style: normal;
    font-size: 0.875rem;
    
    @media (max-width: 768px) {
      font-size: 0.8rem;
    }
  }
`;

const RemarksSection = ({ formData, handleInputChange }) => {
  const quillRef = useRef(null);

  // 에디터 내용 변경 처리
  const handleQuillChange = (content, delta, source, editor) => {
    // 빈 에디터일 때 빈 문자열로 처리
    const text = editor.getText();
    const finalContent = text.trim() === '' ? '' : content;
    
    // 기존 handleInputChange와 호환되도록 이벤트 객체 생성
    const syntheticEvent = {
      target: {
        name: '비고',
        value: finalContent
      }
    };
    
    handleInputChange(syntheticEvent);
  };

  // 동적 높이 조정
  useEffect(() => {
    const adjustHeight = () => {
      if (quillRef.current) {
        const editor = quillRef.current.getEditor();
        const editorElement = quillRef.current.getEditingArea();
        
        if (editorElement) {
          // 임시로 auto로 설정하여 실제 내용 높이 측정
          editorElement.style.height = 'auto';
          const scrollHeight = editorElement.scrollHeight;
          const minHeight = 120;
          
          let newHeight = Math.max(minHeight, scrollHeight + 10);
          
          // 모바일에서는 최소 높이를 줄임
          if (window.innerWidth <= 768) {
            const mobileMinHeight = 100;
            newHeight = Math.max(mobileMinHeight, scrollHeight + 10);
          }
          
          editorElement.style.height = `${newHeight}px`;
        }
      }
    };

    // 내용 변경시 높이 조정
    const timer = setTimeout(adjustHeight, 50);
    
    // 에디터에 이벤트 리스너 추가 (text-change 이벤트)
    if (quillRef.current) {
      const editor = quillRef.current.getEditor();
      editor.on('text-change', adjustHeight);
      
      return () => {
        clearTimeout(timer);
        editor.off('text-change', adjustHeight);
      };
    }
    
    return () => clearTimeout(timer);
  }, [formData.비고]);

  // Quill 에디터 모듈 설정
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'align': [] }],
      ['link', 'image'],
      ['clean']
    ]
  };

  // Quill 에디터 포맷 설정
  const formats = [
    'header', 'bold', 'italic', 'underline', 'strike',
    'color', 'background', 'list', 'bullet', 'indent',
    'align', 'link', 'image'
  ];

  return (
    <RemarksContainer>
      <SectionTitle>
        <FileText size={16} />
        과제 상세 설명
      </SectionTitle>
      
      <FormGroup>
        <StyledQuillContainer>
          <ReactQuill
            ref={quillRef}
            theme="snow"
            value={formData.비고 || ''}
            onChange={handleQuillChange}
            modules={modules}
            formats={formats}
            placeholder="과제에 대한 상세 설명이나 추가 정보를 입력하세요 (선택사항)"
          />
        </StyledQuillContainer>
      </FormGroup>
    </RemarksContainer>
  );
};

export default RemarksSection;