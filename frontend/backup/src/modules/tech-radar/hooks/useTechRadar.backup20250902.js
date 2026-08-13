import { useState } from 'react';
import { sampleTechRadarData } from '../data/sampleData';

// 기본 섹터와 링 정의
const defaultSectors = [
  { id: 'simulation-methods', name: 'Simulation Methods', color: '#8B5CF6' },
  { id: 'digital-twin-platforms', name: 'Digital Twin Platforms & Integration', color: '#3B82F6' },
  { id: 'ai-ml-simulation', name: 'AI/ML for Simulation', color: '#10B981' },
  { id: 'visualization-collaboration', name: 'Visualization & Collaboration', color: '#F59E0B' }
];

const defaultRings = [
  { id: 'adopt', name: 'Adopt', radius: 180, color: '#10B981' },
  { id: 'trial', name: 'Trial', radius: 300, color: '#3B82F6' },
  { id: 'assess', name: 'Assess', radius: 420, color: '#F59E0B' },
  { id: 'hold', name: 'Hold', radius: 540, color: '#EF4444' }
];

let techIdCounter = 1;

// 고유한 ID 생성 함수
const generateUniqueId = (existingTechnologies = [], prefix = 'tech') => {
  let id;
  do {
    id = `${prefix}_${techIdCounter++}_${Date.now()}`;
  } while (existingTechnologies.some(tech => tech.id === id));
  return id;
};

export const useTechRadar = () => {
  const [radarData, setRadarData] = useState({
    sectors: defaultSectors,
    rings: defaultRings,
    technologies: []
  });
  const [selectedTechnology, setSelectedTechnology] = useState(null);

  // 기술 추가 - 고유한 ID 보장 및 isAdopted 기본값 설정
  const addTechnology = (technology) => {
    const newTech = {
      ...technology,
      id: technology.id || generateUniqueId(radarData.technologies),
      isAdopted: technology.isAdopted !== undefined ? technology.isAdopted : true, // 기본값: true (도입됨)
      createdAt: technology.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // 이미 같은 ID가 있는지 확인하고 중복 방지
    setRadarData(prev => {
      const existingIndex = prev.technologies.findIndex(tech => tech.id === newTech.id);
      if (existingIndex >= 0) {
        // 중복 ID가 있으면 새 ID 생성
        newTech.id = generateUniqueId(prev.technologies);
      }
      
      return {
        ...prev,
        technologies: [...prev.technologies, newTech]
      };
    });

    return newTech.id; // 생성된 ID 반환
  };

  // 기술 편집
  const editTechnology = (id, updatedTechnology) => {
    setRadarData(prev => ({
      ...prev,
      technologies: prev.technologies.map(tech => 
        tech.id === id ? { 
          ...updatedTechnology, 
          id,
          isAdopted: updatedTechnology.isAdopted !== undefined ? updatedTechnology.isAdopted : tech.isAdopted,
          updatedAt: new Date().toISOString(),
          createdAt: tech.createdAt || new Date().toISOString()
        } : tech
      )
    }));
    
    // 현재 선택된 기술이 편집된 경우 업데이트
    if (selectedTechnology?.id === id) {
      setSelectedTechnology({ 
        ...updatedTechnology, 
        id,
        isAdopted: updatedTechnology.isAdopted !== undefined ? updatedTechnology.isAdopted : selectedTechnology.isAdopted,
        updatedAt: new Date().toISOString()
      });
    }
  };

  // 기술 삭제
  const deleteTechnology = (id) => {
    setRadarData(prev => ({
      ...prev,
      technologies: prev.technologies.filter(tech => tech.id !== id)
    }));
    
    // 선택된 기술이 삭제된 경우 선택 해제
    if (selectedTechnology?.id === id) {
      setSelectedTechnology(null);
    }
  };

  // 기술 선택
  const selectTechnology = (technology) => {
    setSelectedTechnology(technology);
  };

  // 샘플 데이터 로드 - ID 중복 방지 및 isAdopted 기본값 설정
  const loadSampleData = () => {
    const processedData = {
      ...sampleTechRadarData,
      technologies: sampleTechRadarData.technologies.map((tech, index) => ({
        ...tech,
        id: tech.id || generateUniqueId([], 'sample'),
        isAdopted: tech.isAdopted !== undefined ? tech.isAdopted : true, // 기본값: true
        createdAt: tech.createdAt || new Date().toISOString(),
        updatedAt: tech.updatedAt || new Date().toISOString()
      }))
    };
    
    setRadarData(processedData);
    setSelectedTechnology(null);
  };

  // 모든 데이터 삭제
  const clearData = () => {
    setRadarData({
      sectors: defaultSectors,
      rings: defaultRings,
      technologies: []
    });
    setSelectedTechnology(null);
    techIdCounter = 1; // 카운터 리셋
  };

  // 데이터 내보내기
  const exportData = () => {
    const dataStr = JSON.stringify({
      version: '1.0',
      exportDate: new Date().toISOString(),
      data: radarData
    }, null, 2);
    
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tech-radar-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 데이터 가져오기 개선
  const importData = (file) => {
    return new Promise((resolve, reject) => {
      if (!file || file.type !== 'application/json') {
        reject(new Error('JSON 파일만 업로드 가능합니다.'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          
          let importedData = null;
          
          // 다양한 데이터 형식 지원
          if (data.data && data.data.sectors && data.data.rings && data.data.technologies) {
            importedData = data.data;
          } else if (data.sectors && data.rings && data.technologies) {
            importedData = data;
          } else if (Array.isArray(data)) {
            // 기술 배열만 있는 경우
            importedData = {
              sectors: defaultSectors,
              rings: defaultRings,
              technologies: data
            };
          } else if (data.technologies && Array.isArray(data.technologies)) {
            // technologies 키가 있는 경우
            importedData = {
              sectors: data.sectors || defaultSectors,
              rings: data.rings || defaultRings,
              technologies: data.technologies
            };
          } else {
            reject(new Error('올바른 Tech Radar 데이터 형식이 아닙니다.'));
            return;
          }

          // 가져온 기술들의 ID 고유성 보장 및 isAdopted 기본값 설정
          const processedTechnologies = importedData.technologies.map((tech, index) => ({
            ...tech,
            id: tech.id || generateUniqueId([], 'imported'),
            isAdopted: tech.isAdopted !== undefined ? tech.isAdopted : true, // 기본값: true
            createdAt: tech.createdAt || new Date().toISOString(),
            updatedAt: tech.updatedAt || new Date().toISOString()
          }));

          setRadarData({
            ...importedData,
            technologies: processedTechnologies
          });
          setSelectedTechnology(null);
          resolve(`${processedTechnologies.length}개의 기술을 성공적으로 불러왔습니다.`);
          
        } catch (error) {
          reject(new Error('파일을 읽는 중 오류가 발생했습니다: ' + error.message));
        }
      };
      reader.readAsText(file);
    });
  };

  return {
    radarData,
    selectedTechnology,
    addTechnology,
    editTechnology,
    deleteTechnology,
    selectTechnology,
    loadSampleData,
    clearData,
    exportData,
    importData
  };
};