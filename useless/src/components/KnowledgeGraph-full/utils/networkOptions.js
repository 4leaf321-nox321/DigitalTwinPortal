/**
 * vis-network 옵션을 레이아웃별로 생성하는 유틸리티 함수
 */
export const getNetworkOptions = (layout) => {
  const baseOptions = {
    nodes: {
      borderWidth: 2,
      borderWidthSelected: 4,
      font: {
        size: 14,
        face: 'Arial, sans-serif',
        strokeWidth: 2,
        strokeColor: '#ffffff'
      },
      shadow: {
        enabled: true,
        color: 'rgba(0,0,0,0.3)',
        size: 10,
        x: 2,
        y: 2
      },
      physics: true,
      chosen: {
        node: (values, id, selected, hovering) => {
          values.shadow = selected || hovering;
          if (selected || hovering) {
            values.shadowSize = 15;
            values.shadowX = 3;
            values.shadowY = 3;
          }
        }
      }
    },
    edges: {
      arrows: {
        to: { enabled: true, scaleFactor: 1 }
      },
      color: {
        inherit: 'from'
      },
      font: {
        size: 12,
        align: 'middle',
        strokeWidth: 3,
        strokeColor: '#ffffff'
      },
      smooth: {
        enabled: true,
        type: 'dynamic',
        roundness: 0.5
      },
      chosen: {
        edge: (values, id, selected, hovering) => {
          values.shadow = selected || hovering;
        }
      }
    },
    interaction: {
      dragNodes: true,
      dragView: true,
      zoomView: true,
      selectConnectedEdges: false,
      hover: true,
      hoverConnectedEdges: true,
      keyboard: {
        enabled: true,
        speed: { x: 10, y: 10, zoom: 0.02 }
      }
    },
    manipulation: {
      enabled: false
    }
  };

  // 레이아웃별 물리 설정
  switch (layout) {
    case 'circular':
      return {
        ...baseOptions,
        layout: {
          randomSeed: 2,
          improvedLayout: false
        },
        physics: {
          enabled: true,
          forceAtlas2Based: {
            gravitationalConstant: -26,
            centralGravity: 0.005,
            springLength: 230,
            springConstant: 0.18,
            damping: 0.4,
            avoidOverlap: 0.5
          },
          maxVelocity: 146,
          solver: 'forceAtlas2Based',
          timestep: 0.35,
          stabilization: { 
            enabled: true,
            iterations: 150,
            updateInterval: 25
          }
        }
      };

    case 'grid':
      return {
        ...baseOptions,
        physics: {
          enabled: false
        }
      };

    case 'force-directed':
    default:
      return {
        ...baseOptions,
        physics: {
          enabled: true,
          forceAtlas2Based: {
            gravitationalConstant: -35,  // 중력 약화로 더 자연스러운 움직임
            centralGravity: 0.008,       // 중심 끌림 약간 증가
            springConstant: 0.12,        // 스프링 강도 증가로 더 안정적
            springLength: 120,           // 기본 거리 증가
            damping: 0.85,               // 댐핑 감소로 부드러운 정지
            avoidOverlap: 0.6            // 겹침 방지 강화
          },
          maxVelocity: 25,               // 최대 속도 감소
          minVelocity: 0.02,             // 최소 속도 감소로 더 자연스러운 정지
          solver: 'forceAtlas2Based',
          timestep: 0.4,                 // 시간 간격 증가로 부드러운 움직임
          stabilization: { 
            enabled: true,
            iterations: 250,             // 안정화 반복 증가
            updateInterval: 20,          // 업데이트 간격 단축으로 부드러운 진행
            onlyDynamicEdges: false,
            fit: false
          },
          adaptiveTimestep: true
        }
      };
  }
};