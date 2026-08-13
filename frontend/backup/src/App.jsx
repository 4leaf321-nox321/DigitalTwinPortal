import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import MainPage from './pages/MainPage';
import EngineeringHub from './pages/EngineeringHub/EngineeringHub';
import KnowledgeGraphApp from './modules/knowledge-graph/KnowledgeGraphApp';
import GanttChartApp from './modules/gantt-chart/GanttChartApp';
import TechRadarApp from './modules/tech-radar/TechRadarApp';
import SwimlaneChartApp from './modules/swimlane-chart/SwimlaneChartApp';
import TechArchiveApp from './modules/tech-archive/TechArchiveApp';
import DigitalTwinSolutionApp from './modules/digital-twin-solution/DigitalTwinSolutionApp';
import DigitalTwinDashboardApp from './modules/digital-twin-dashboard/DigitalTwinDashboardApp';

// 홈으로 이동하는 컴포넌트
const AppWithNav = () => {
  const navigate = useNavigate();
  
  const handleGoHome = () => {
    navigate('/engineeringhub');
  };
  
  return (
    <Routes>
      {/* 메인 페이지 - "열기" 버튼만 있는 페이지 */}
      <Route path="/" element={<MainPage />} />
      
      {/* Engineering Hub - 기존 홈 페이지 */}
      <Route path="/engineeringhub" element={<EngineeringHub />} />
      
      {/* Knowledge Graph 모듈 */}
      <Route path="/knowledge-graph" element={<KnowledgeGraphApp onGoHome={handleGoHome} />} />
      
      {/* Gantt Chart 모듈 */}
      <Route path="/gantt-chart" element={<GanttChartApp onGoHome={handleGoHome} />} />
      
      {/* Tech Radar 모듈 */}
      <Route path="/tech-radar" element={<TechRadarApp onGoHome={handleGoHome} />} />
      
      {/* Swimlane Chart 모듈 */}
      <Route path="/swimlane-chart" element={<SwimlaneChartApp onGoHome={handleGoHome} />} />
      
      {/* Tech Archive 모듈 */}
      <Route path="/tech-archive" element={<TechArchiveApp onGoHome={handleGoHome} />} />
      
      {/* Digital Twin Solution 모듈 */}
      <Route path="/digital-twin-solution" element={<DigitalTwinSolutionApp onGoHome={handleGoHome} />} />
      
      {/* Digital Twin Dashboard 모듈 */}
      <Route path="/digital-twin-dashboard" element={<DigitalTwinDashboardApp onGoHome={handleGoHome} />} />
      
      {/* 다른 모듈들도 임시로 Engineering Hub로 리다이렉트 */}
      <Route path="/genai" element={<Navigate to="/engineeringhub" replace />} />
      <Route path="/mold-cost-calculator" element={<Navigate to="/engineeringhub" replace />} />
      <Route path="/package-simulator" element={<Navigate to="/engineeringhub" replace />} />
      <Route path="/noise-simulator" element={<Navigate to="/engineeringhub" replace />} />
      <Route path="/fastening-simulator" element={<Navigate to="/engineeringhub" replace />} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  console.log('🚀 라우팅 변경된 App 컴포넌트 렌더링');
  
  return (
    <Router>
      <div className="App">
        <AppWithNav />
      </div>
    </Router>
  );
}

export default App;
