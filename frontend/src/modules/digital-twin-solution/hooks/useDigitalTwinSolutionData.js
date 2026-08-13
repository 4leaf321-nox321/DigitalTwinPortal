import { useState, useCallback, useEffect } from 'react';
import { digitalTwinSolutionData } from '../data/digitalTwinSolutionData';
import { todayLocalYmd } from '../../../shared/utils/localDate';

const useDigitalTwinSolutionData = () => {
  const [data, setData] = useState(digitalTwinSolutionData);
  const [selectedTechnology, setSelectedTechnology] = useState(null);

  // 로컬 스토리지에서 데이터 로드
  useEffect(() => {
    const savedData = localStorage.getItem('digitalTwinSolutionData');
    if (savedData) {
      try {
        const parsedData = JSON.parse(savedData);
        setData(parsedData);
      } catch (error) {
        console.error('Failed to parse saved data:', error);
      }
    }
  }, []);

  // 데이터 변경 시 로컬 스토리지에 저장
  useEffect(() => {
    localStorage.setItem('digitalTwinSolutionData', JSON.stringify(data));
  }, [data]);

  // 솔루션 추가
  const addTechnology = useCallback((techData) => {
    const newTech = {
      ...techData,
      id: techData.id || Date.now().toString(),
      isAdopted: techData.isAdopted !== undefined ? techData.isAdopted : true
    };

    setData(prevData => ({
      ...prevData,
      technologies: [...prevData.technologies, newTech]
    }));
  }, []);

  // 솔루션 수정
  const updateTechnology = useCallback((techId, updatedData) => {
    setData(prevData => ({
      ...prevData,
      technologies: prevData.technologies.map(tech =>
        tech.id === techId ? { ...tech, ...updatedData } : tech
      )
    }));

    // 선택된 솔루션이 수정된 경우 업데이트
    if (selectedTechnology?.id === techId) {
      setSelectedTechnology(prev => ({ ...prev, ...updatedData }));
    }
  }, [selectedTechnology]);

  // 솔루션 삭제
  const deleteTechnology = useCallback((techId) => {
    setData(prevData => ({
      ...prevData,
      technologies: prevData.technologies.filter(tech => tech.id !== techId)
    }));

    // 선택된 솔루션이 삭제된 경우 선택 해제
    if (selectedTechnology?.id === techId) {
      setSelectedTechnology(null);
    }
  }, [selectedTechnology]);

  // 샘플 데이터 로드
  const loadSampleData = useCallback(() => {
    setData(digitalTwinSolutionData);
    setSelectedTechnology(null);
    // 로컬 스토리지도 업데이트
    localStorage.setItem('digitalTwinSolutionData', JSON.stringify(digitalTwinSolutionData));
  }, []);

  // 모든 데이터 삭제
  const clearData = useCallback(() => {
    const emptyData = {
      ...digitalTwinSolutionData,
      technologies: []
    };
    setData(emptyData);
    setSelectedTechnology(null);
    // 로컬 스토리지도 삭제
    localStorage.removeItem('digitalTwinSolutionData');
  }, []);

  // 데이터 내보내기
  const exportData = useCallback(() => {
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `digital-twin-solutions-${todayLocalYmd()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [data]);

  // 데이터 가져오기
  const importData = useCallback((file) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        // 데이터 유효성 검사
        if (importedData.technologies && Array.isArray(importedData.technologies)) {
          setData(importedData);
          setSelectedTechnology(null);
        } else {
          throw new Error('잘못된 파일 형식입니다.');
        }
      } catch (error) {
        console.error('Failed to import data:', error);
        throw error;
      }
    };
    
    reader.readAsText(file);
  }, []);

  // 섹터 추가
  const addSector = useCallback((sectorData) => {
    const newSector = {
      ...sectorData,
      id: sectorData.id || Date.now().toString()
    };

    setData(prevData => ({
      ...prevData,
      sectors: [...prevData.sectors, newSector]
    }));
  }, []);

  // 섹터 수정
  const updateSector = useCallback((sectorId, updatedData) => {
    setData(prevData => {
      // 섹터 정보 업데이트
      const updatedSectors = prevData.sectors.map(sector =>
        sector.id === sectorId ? { ...sector, ...updatedData } : sector
      );

      // 섹터 ID가 변경된 경우, 관련 솔루션들의 섹터도 업데이트
      let updatedTechnologies = prevData.technologies;
      if (sectorId !== updatedData.id) {
        updatedTechnologies = prevData.technologies.map(tech =>
          tech.sector === sectorId ? { ...tech, sector: updatedData.id } : tech
        );
      }

      return {
        ...prevData,
        sectors: updatedSectors,
        technologies: updatedTechnologies
      };
    });

    // 선택된 솔루션의 섹터가 변경된 경우 업데이트
    if (selectedTechnology?.sector === sectorId && sectorId !== updatedData.id) {
      setSelectedTechnology(prev => ({ ...prev, sector: updatedData.id }));
    }
  }, [selectedTechnology]);

  // 섹터 삭제
  const deleteSector = useCallback((sectorId) => {
    setData(prevData => {
      // 해당 섹터의 모든 솔루션 삭제
      const remainingTechnologies = prevData.technologies.filter(
        tech => tech.sector !== sectorId
      );
      
      // 섹터 삭제
      const remainingSectors = prevData.sectors.filter(
        sector => sector.id !== sectorId
      );

      return {
        ...prevData,
        sectors: remainingSectors,
        technologies: remainingTechnologies
      };
    });

    // 선택된 솔루션이 삭제된 섹터에 속한 경우 선택 해제
    if (selectedTechnology?.sector === sectorId) {
      setSelectedTechnology(null);
    }
  }, [selectedTechnology]);

  // 성숙도 링 추가 (필요시)
  const addRing = useCallback((ringData) => {
    const newRing = {
      ...ringData,
      id: ringData.id || Date.now().toString()
    };

    setData(prevData => ({
      ...prevData,
      rings: [...prevData.rings, newRing]
    }));
  }, []);

  // 설정 업데이트 (새로 추가)
  const updateSettings = useCallback((settingsData) => {
    setData(prevData => ({
      ...prevData,
      sectors: settingsData.sectors || prevData.sectors,
      rings: settingsData.rings || prevData.rings,
      categories: settingsData.categories || prevData.categories,
      subcategories: settingsData.subcategories || prevData.subcategories,
      objectives: settingsData.objectives || prevData.objectives
    }));
  }, []);

  // 통계 정보 계산
  const getStatistics = useCallback(() => {
    const stats = {
      total: data.technologies.length,
      adopted: data.technologies.filter(tech => tech.isAdopted !== false).length,
      notAdopted: data.technologies.filter(tech => tech.isAdopted === false).length,
      bySector: {},
      byRing: {}
    };

    // 섹터별 통계
    data.sectors.forEach(sector => {
      const sectorTechs = data.technologies.filter(tech => tech.sector === sector.id);
      stats.bySector[sector.id] = {
        name: sector.name,
        total: sectorTechs.length,
        adopted: sectorTechs.filter(tech => tech.isAdopted !== false).length,
        notAdopted: sectorTechs.filter(tech => tech.isAdopted === false).length
      };
    });

    // 성숙도별 통계
    data.rings.forEach(ring => {
      const ringTechs = data.technologies.filter(tech => tech.ring === ring.id);
      stats.byRing[ring.id] = {
        name: ring.name,
        total: ringTechs.length,
        adopted: ringTechs.filter(tech => tech.isAdopted !== false).length,
        notAdopted: ringTechs.filter(tech => tech.isAdopted === false).length
      };
    });

    return stats;
  }, [data]);

  return {
    data,
    setData,
    selectedTechnology,
    setSelectedTechnology,
    addTechnology,
    updateTechnology,
    deleteTechnology,
    addSector,
    updateSector,
    deleteSector,
    addRing,
    updateSettings,
    loadSampleData,
    clearData,
    exportData,
    importData,
    getStatistics
  };
};

export default useDigitalTwinSolutionData;
