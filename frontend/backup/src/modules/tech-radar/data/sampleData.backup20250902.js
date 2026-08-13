// Tech Radar 샘플 데이터
export const sampleTechRadarData = {
  sectors: [
    { id: 'simulation-methods', name: 'Simulation Methods', color: '#8B5CF6' },
    { id: 'digital-twin-platforms', name: 'Digital Twin Platforms & Integration', color: '#3B82F6' },
    { id: 'ai-ml-simulation', name: 'AI/ML for Simulation', color: '#10B981' },
    { id: 'visualization-collaboration', name: 'Visualization & Collaboration', color: '#F59E0B' }
  ],
  rings: [
    { id: 'adopt', name: 'Adopt', radius: 180, color: '#10B981' },
    { id: 'trial', name: 'Trial', radius: 300, color: '#3B82F6' },
    { id: 'assess', name: 'Assess', radius: 420, color: '#F59E0B' },
    { id: 'hold', name: 'Hold', radius: 540, color: '#EF4444' }
  ],
  technologies: [
    // Simulation Methods
    { id: '1', name: 'FEM/CFD', sector: 'simulation-methods', ring: 'adopt', description: '유한요소법/전산유체역학' },
    { id: '2', name: 'DEM', sector: 'simulation-methods', ring: 'adopt', description: '이산요소법' },
    { id: '3', name: 'MBD', sector: 'simulation-methods', ring: 'trial', description: '다물체 동역학' },
    { id: '4', name: 'SPH', sector: 'simulation-methods', ring: 'trial', description: 'Smoothed Particle Hydrodynamics' },
    { id: '5', name: 'SimSolid', sector: 'simulation-methods', ring: 'assess', description: '메쉬리스 구조해석' },
    { id: '6', name: 'ROM', sector: 'simulation-methods', ring: 'trial', description: 'Reduced-order modeling' },
    { id: '7', name: 'Hybrid Physics+ML', sector: 'simulation-methods', ring: 'assess', description: '물리+머신러닝 하이브리드' },
    { id: '8', name: 'IGA', sector: 'simulation-methods', ring: 'assess', description: 'Isogeometric Analysis' },
    
    // Digital Twin Platforms & Integration
    { id: '9', name: 'Altair DT Platform', sector: 'digital-twin-platforms', ring: 'adopt', description: 'Altair 디지털트윈 플랫폼' },
    { id: '10', name: 'Siemens DT Platform', sector: 'digital-twin-platforms', ring: 'adopt', description: 'Siemens 디지털트윈 플랫폼' },
    { id: '11', name: 'MBSE/PLM 연계', sector: 'digital-twin-platforms', ring: 'adopt', description: '모델기반 시스템 엔지니어링' },
    { id: '12', name: 'Industrial IoT', sector: 'digital-twin-platforms', ring: 'adopt', description: '산업용 IoT 연결' },
    { id: '13', name: 'OPC-UA Interface', sector: 'digital-twin-platforms', ring: 'trial', description: 'OPC-UA 데이터 인터페이스' },
    { id: '14', name: 'MQTT Interface', sector: 'digital-twin-platforms', ring: 'trial', description: 'MQTT 기반 데이터 통신' },
    { id: '15', name: 'SysML 모델링', sector: 'digital-twin-platforms', ring: 'trial', description: 'SysML 기반 시스템 모델링' },
    
    // AI/ML for Simulation
    { id: '16', name: 'Surrogate Models', sector: 'ai-ml-simulation', ring: 'trial', description: '대리모델/메타모델' },
    { id: '17', name: 'DOE 기반 학습', sector: 'ai-ml-simulation', ring: 'trial', description: '실험계획법 기반 학습' },
    { id: '18', name: 'PINN', sector: 'ai-ml-simulation', ring: 'assess', description: 'Physics-informed Neural Networks' },
    { id: '19', name: 'Generative Design', sector: 'ai-ml-simulation', ring: 'assess', description: '생성형 설계 최적화' },
    { id: '20', name: 'RL for Control', sector: 'ai-ml-simulation', ring: 'assess', description: '제어 시뮬레이션용 강화학습' },
    
    // Visualization & Collaboration
    { id: '21', name: 'AR/VR Viewer', sector: 'visualization-collaboration', ring: 'trial', description: 'AR/VR 기반 디지털트윈 뷰어' },
    { id: '22', name: 'Knowledge Graph', sector: 'visualization-collaboration', ring: 'trial', description: '기술/조직 지식 그래프' },
    { id: '23', name: 'Cloud HPC', sector: 'visualization-collaboration', ring: 'trial', description: '클라우드 고성능 컴퓨팅' },
    { id: '24', name: '3D Web Viewer', sector: 'visualization-collaboration', ring: 'adopt', description: '실시간 3D 웹 뷰어' },
    { id: '25', name: 'Real-time Dashboards', sector: 'visualization-collaboration', ring: 'adopt', description: '실시간 대시보드' },
    { id: '26', name: 'Fully Automated DT', sector: 'visualization-collaboration', ring: 'hold', description: '완전 자동화 디지털트윈' }
  ]
};

export default sampleTechRadarData;