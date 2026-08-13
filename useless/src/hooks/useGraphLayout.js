import { useState, useCallback, useMemo } from 'react';

export const useGraphLayout = (initialLayout = 'force-directed') => {
  const [layoutType, setLayoutType] = useState(initialLayout);
  const [layoutOptions, setLayoutOptions] = useState({});

  // 레이아웃별 기본 설정
  const layoutConfigs = useMemo(() => ({    
    'force-directed': {
      physics: {
        enabled: true,
        forceAtlas2Based: {
          gravitationalConstant: -50,
          centralGravity: 0.01,
          springConstant: 0.08,
          springLength: 100,
          damping: 0.4,
          avoidOverlap: 0
        },
        maxVelocity: 50,
        solver: 'forceAtlas2Based',
        timestep: 0.35,
        stabilization: { iterations: 150 }
      }
    },
    circular: {
      layout: {
        randomSeed: 2
      },
      physics: {
        enabled: true,
        forceAtlas2Based: {
          gravitationalConstant: -26,
          centralGravity: 0.005,
          springLength: 230,
          springConstant: 0.18
        },
        maxVelocity: 146,
        solver: 'forceAtlas2Based',
        timestep: 0.35,
        stabilization: { iterations: 150 }
      }
    },
    grid: {
      layout: {
        randomSeed: 1
      },
      physics: {
        enabled: false
      }
    }
  }), []);

  // 현재 레이아웃 설정 가져오기
  const currentLayoutConfig = useMemo(() => {
    const baseConfig = layoutConfigs[layoutType] || layoutConfigs['force-directed'];
    
    // 사용자 정의 옵션과 병합
    return {
      ...baseConfig,
      ...layoutOptions
    };
  }, [layoutType, layoutOptions, layoutConfigs]);

  // 레이아웃 변경
  const changeLayout = useCallback((newLayout, options = {}) => {
    setLayoutType(newLayout);
    setLayoutOptions(options);
  }, []);

  // 레이아웃 옵션 업데이트
  const updateLayoutOptions = useCallback((options) => {
    setLayoutOptions(prev => ({
      ...prev,
      ...options
    }));
  }, []);

  // 물리 시뮬레이션 토글
  const togglePhysics = useCallback(() => {
    setLayoutOptions(prev => ({
      ...prev,
      physics: {
        ...prev.physics,
        enabled: !prev.physics?.enabled
      }
    }));
  }, []);

  // 레이아웃 초기화
  const resetLayout = useCallback(() => {
    setLayoutOptions({});
  }, []);

  // 레이아웃 적용 함수 생성
  const applyLayout = useCallback((network) => {
    if (!network) return;
    
    network.setOptions(currentLayoutConfig);
    
    // 그리드 레이아웃인 경우 수동으로 위치 설정
    if (layoutType === 'grid') {
      const nodes = network.body.data.nodes;
      const nodeIds = nodes.getIds();
      const gridSize = Math.ceil(Math.sqrt(nodeIds.length));
      
      const updates = nodeIds.map((nodeId, index) => ({
        id: nodeId,
        x: (index % gridSize) * 200 - (gridSize * 100),
        y: Math.floor(index / gridSize) * 200 - (gridSize * 100),
        physics: false
      }));
      
      nodes.update(updates);
    }
  }, [currentLayoutConfig, layoutType]);

  return {
    layoutType,
    layoutOptions,
    currentLayoutConfig,
    availableLayouts: Object.keys(layoutConfigs),
    changeLayout,
    updateLayoutOptions,
    togglePhysics,
    resetLayout,
    applyLayout
  };
};
