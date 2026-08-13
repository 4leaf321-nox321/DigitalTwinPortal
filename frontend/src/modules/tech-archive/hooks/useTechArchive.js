import { useState, useEffect, useMemo } from 'react';
import { sampleTechDocs, categories, documentTypes, statusOptions } from '../data/sampleData';
import { todayLocalYmd } from '../../../shared/utils/localDate';

export const useTechArchive = () => {
  // 상태 관리
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isLoading, setIsLoading] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    loadSampleData();
  }, []);

  // 샘플 데이터 로드
  const loadSampleData = () => {
    setIsLoading(true);
    setTimeout(() => {
      setDocuments(sampleTechDocs);
      setIsLoading(false);
    }, 500); // 로딩 시뮬레이션
  };

  // 데이터 초기화
  const clearData = () => {
    setDocuments([]);
    setSelectedDocument(null);
  };

  // 사용 가능한 태그 목록 (문서 수와 함께)
  const availableTags = useMemo(() => {
    const tagCounts = {};
    
    documents.forEach(doc => {
      doc.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [documents]);

  // 필터링된 문서 목록
  const filteredDocuments = useMemo(() => {
    let filtered = documents;

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.title.toLowerCase().includes(query) ||
        doc.description.toLowerCase().includes(query) ||
        doc.content.toLowerCase().includes(query) ||
        doc.tags.some(tag => tag.toLowerCase().includes(query)) ||
        doc.author.toLowerCase().includes(query)
      );
    }

    // 카테고리 필터
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(doc => doc.category === selectedCategory);
    }

    // 타입 필터
    if (selectedType !== 'all') {
      filtered = filtered.filter(doc => doc.type === selectedType);
    }

    // 상태 필터
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(doc => doc.status === selectedStatus);
    }

    // 태그 필터
    if (selectedTags.length > 0) {
      filtered = filtered.filter(doc => 
        selectedTags.every(tag => doc.tags.includes(tag))
      );
    }

    // 정렬
    filtered.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      // 날짜 필드 처리
      if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      // 문자열 필드 처리
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [
    documents, 
    searchQuery, 
    selectedCategory, 
    selectedType, 
    selectedStatus, 
    selectedTags,
    sortBy, 
    sortOrder
  ]);

  // 카테고리별 문서 수 계산
  const categoriesWithCount = useMemo(() => {
    return categories.map(category => ({
      ...category,
      count: category.id === 'all' 
        ? documents.length 
        : documents.filter(doc => doc.category === category.id).length
    }));
  }, [documents]);

  // 문서 선택
  const selectDocument = (doc) => {
    setSelectedDocument(doc);
    // 조회수 증가
    if (doc) {
      setDocuments(prev => 
        prev.map(d => 
          d.id === doc.id 
            ? { ...d, readCount: d.readCount + 1 }
            : d
        )
      );
    }
  };

  // 문서 추가
  const addDocument = (docData) => {
    const newDoc = {
      ...docData,
      id: `doc_${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      readCount: 0,
      likes: 0,
      relatedDocs: [],
      attachments: []
    };
    setDocuments(prev => [newDoc, ...prev]);
    return newDoc;
  };

  // 문서 수정
  const updateDocument = (docId, updates) => {
    setDocuments(prev =>
      prev.map(doc =>
        doc.id === docId
          ? { ...doc, ...updates, updatedAt: new Date().toISOString() }
          : doc
      )
    );
    
    // 선택된 문서가 수정된 경우 업데이트
    if (selectedDocument?.id === docId) {
      setSelectedDocument(prev => ({
        ...prev,
        ...updates,
        updatedAt: new Date().toISOString()
      }));
    }
  };

  // 문서 삭제
  const deleteDocument = (docId) => {
    setDocuments(prev => prev.filter(doc => doc.id !== docId));
    if (selectedDocument?.id === docId) {
      setSelectedDocument(null);
    }
  };

  // 문서 좋아요 토글
  const toggleLike = (docId) => {
    setDocuments(prev =>
      prev.map(doc =>
        doc.id === docId
          ? { ...doc, likes: doc.likes + 1 }
          : doc
      )
    );
    
    if (selectedDocument?.id === docId) {
      setSelectedDocument(prev => ({
        ...prev,
        likes: prev.likes + 1
      }));
    }
  };

  // 필터 초기화
  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedType('all');
    setSelectedStatus('all');
    setSelectedTags([]);
    setSortBy('updatedAt');
    setSortOrder('desc');
  };

  // 데이터 내보내기
  const exportData = () => {
    const dataStr = JSON.stringify(documents, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tech-archive-${todayLocalYmd()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 데이터 가져오기
  const importData = (jsonData) => {
    try {
      let importedDocs;
      
      if (Array.isArray(jsonData)) {
        importedDocs = jsonData;
      } else if (jsonData.documents) {
        importedDocs = jsonData.documents;
      } else {
        throw new Error('Invalid data format');
      }

      // 데이터 정규화
      const processedDocs = importedDocs.map(doc => ({
        ...doc,
        id: doc.id || `imported_${Date.now()}_${Math.random()}`,
        createdAt: doc.createdAt || new Date().toISOString(),
        updatedAt: doc.updatedAt || new Date().toISOString(),
        readCount: doc.readCount || 0,
        likes: doc.likes || 0,
        relatedDocs: doc.relatedDocs || [],
        attachments: doc.attachments || [],
        tags: Array.isArray(doc.tags) ? doc.tags : []
      }));

      setDocuments(processedDocs);
      return processedDocs.length;
    } catch (error) {
      throw new Error(`데이터 가져오기 실패: ${error.message}`);
    }
  };

  return {
    // 상태
    documents: filteredDocuments,
    allDocuments: documents,
    selectedDocument,
    searchQuery,
    selectedCategory,
    selectedType,
    selectedStatus,
    selectedTags,
    sortBy,
    sortOrder,
    isLoading,
    
    // 계산된 값
    categoriesWithCount,
    documentTypes,
    statusOptions,
    availableTags,
    
    // 액션
    selectDocument,
    addDocument,
    updateDocument,
    deleteDocument,
    toggleLike,
    loadSampleData,
    clearData,
    exportData,
    importData,
    resetFilters,
    
    // 필터 설정
    setSearchQuery,
    setSelectedCategory,
    setSelectedType,
    setSelectedStatus,
    setSelectedTags,
    setSortBy,
    setSortOrder
  };
};
