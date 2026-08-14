import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { VisibilityScopeProvider } from './contexts/VisibilityScopeContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MainPage from './pages/MainPage';
import AccountManagementPage from './pages/AccountManagementPage';
import EngineeringHub from './pages/EngineeringHub/EngineeringHub';
import KnowledgeGraphApp from './modules/knowledge-graph/KnowledgeGraphApp';
import GanttChartApp from './modules/gantt-chart/GanttChartApp';
import TechRadarApp from './modules/tech-radar/TechRadarApp';
import SwimlaneChartApp from './modules/swimlane-chart/SwimlaneChartApp';
import TechArchiveApp from './modules/tech-archive/TechArchiveApp';
import DigitalTwinSolutionApp from './modules/digital-twin-solution/DigitalTwinSolutionApp';
import DigitalTwinDashboardApp from './modules/digital-twin-dashboard/DigitalTwinDashboardApp';
import DigitalTwinStrategyApp from './modules/digital-twin-strategy/DigitalTwinStrategyApp';
import DxWorkProcessApp from './modules/dx-work-process/KnowledgeGraphApp';
import OrganizationChartApp from './modules/organization-chart/OrganizationChartApp';
import OfficeManagementApp from './modules/office-management/OfficeManagementApp';
import DevManufacturingProcessApp from './modules/dev-manufacturing-process/DevManufacturingProcessApp';
import MeetingManagementApp from './modules/meeting-management/MeetingManagementApp';
import CollaborationBoardApp from './modules/collaboration-board/CollaborationBoardApp';
import CompanyMaterialCouncilApp from './modules/company-material-council/CompanyMaterialCouncilApp';
import DigitalTwinTechLevelApp from './modules/digital-twin-tech-level/DigitalTwinTechLevelApp';
import DigitalTwinResourceApp from './modules/digital-twin-resource/DigitalTwinResourceApp';
import SPDMStatusApp from './modules/spdm-status/SPDMStatusApp';
import DigitalTwinReferenceApp from './modules/digital-twin-reference/DigitalTwinReferenceApp';
import DigitalTwinTaskManagementApp from './modules/digital-twin-task-management/DigitalTwinTaskManagementApp';
import DigitalTwinSwResourceApp from './modules/digital-twin-sw-resource/DigitalTwinSwResourceApp';
import AutoDocumentApp from './modules/auto-document/AutoDocumentApp';
import AutoDocumentVerifyApp from './modules/auto-document-verify/AutoDocumentVerifyApp';
import DxKpiManagementApp from './modules/dx-kpi-management/DxKpiManagementApp';

// 홈으로 이동하는 컴포넌트
const AppWithNav = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
  };
  
  return (
    <Routes>
      {/* 로그인 페이지 */}
      <Route path="/login" element={<LoginPage />} />

      {/* 회원가입 페이지 */}
      <Route path="/register" element={<RegisterPage />} />

      {/* 메인 페이지 - DX 시뮬레이션 플랫폼 (보호됨) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainPage />
          </ProtectedRoute>
        }
      />

      {/* Engineering Hub - 통합 도구 허브 (보호됨) */}
      <Route
        path="/engineeringhub"
        element={
          <ProtectedRoute>
            <EngineeringHub />
          </ProtectedRoute>
        }
      />

      {/* Knowledge Graph 모듈 (보호됨) */}
      <Route
        path="/knowledge-graph"
        element={
          <ProtectedRoute>
            <KnowledgeGraphApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* Gantt Chart 모듈 (보호됨) */}
      <Route
        path="/gantt-chart"
        element={
          <ProtectedRoute>
            <GanttChartApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* Tech Radar 모듈 (보호됨) */}
      <Route
        path="/tech-radar"
        element={
          <ProtectedRoute>
            <TechRadarApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* Swimlane Chart 모듈 (보호됨) */}
      <Route
        path="/swimlane-chart"
        element={
          <ProtectedRoute>
            <SwimlaneChartApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* Tech Archive 모듈 (보호됨) */}
      <Route
        path="/tech-archive"
        element={
          <ProtectedRoute>
            <TechArchiveApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* Digital Twin Solution 모듈 (보호됨) */}
      <Route
        path="/digital-twin-solution"
        element={
          <ProtectedRoute>
            <DigitalTwinSolutionApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* Digital Twin Dashboard 모듈 (보호됨) */}
      <Route
        path="/digital-twin-dashboard"
        element={
          <ProtectedRoute>
            <DigitalTwinDashboardApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* Digital Twin Strategy 모듈 (보호됨) */}
      <Route
        path="/digital-twin-strategy"
        element={
          <ProtectedRoute>
            <DigitalTwinStrategyApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* DX Work Process 모듈 (보호됨) */}
      <Route
        path="/dx-work-process"
        element={
          <ProtectedRoute>
            <DxWorkProcessApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* Organization Chart 모듈 (보호됨) */}
      <Route
        path="/organization-chart"
        element={
          <ProtectedRoute>
            <OrganizationChartApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* Office Management 모듈 (보호됨 - admin, dt_office만 접근 가능) */}
      <Route
        path="/office-management"
        element={
          <ProtectedRoute allowedRoles={['admin', 'dt_office']}>
            <OfficeManagementApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* Dev Manufacturing Process 모듈 (보호됨) */}
      <Route
        path="/dev-manufacturing-process"
        element={
          <ProtectedRoute>
            <DevManufacturingProcessApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* Meeting Management 모듈 (보호됨 - admin, dt_office, manager만 접근 가능) */}
      <Route
        path="/meeting-management"
        element={
          <ProtectedRoute allowedRoles={['admin', 'dt_office', 'manager']}>
            <MeetingManagementApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* Collaboration Board 모듈 (보호됨) */}
      <Route
        path="/collaboration-board"
        element={
          <ProtectedRoute>
            <CollaborationBoardApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* Company Material Council 모듈 (보호됨) */}
      <Route
        path="/company-material-council"
        element={
          <ProtectedRoute>
            <CompanyMaterialCouncilApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* Digital Twin Tech Level 모듈 (보호됨) */}
      <Route
        path="/digital-twin-tech-level"
        element={
          <ProtectedRoute>
            <DigitalTwinTechLevelApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* Digital Twin Resource 모듈 (보호됨) */}
      <Route
        path="/digital-twin-resource"
        element={
          <ProtectedRoute>
            <DigitalTwinResourceApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* SPDM Status 모듈 (보호됨) */}
      <Route
        path="/spdm-status"
        element={
          <ProtectedRoute>
            <SPDMStatusApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* 제조 디지털 트윈 과제 관리 모듈 (보호됨) */}
      <Route
        path="/digital-twin-task-management"
        element={
          <ProtectedRoute>
            <DigitalTwinTaskManagementApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* 전사 디지털 트윈 S/W 자원 정보 모듈 (보호됨) */}
      <Route
        path="/digital-twin-sw-resource"
        element={
          <ProtectedRoute>
            <DigitalTwinSwResourceApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* Digital Twin Reference 모듈 (보호됨) */}
      <Route
        path="/digital-twin-reference"
        element={
          <ProtectedRoute>
            <DigitalTwinReferenceApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* 문서 자동 작성 모듈 (보호됨 - admin만 접근 가능) */}
      <Route
        path="/auto-document"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AutoDocumentApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* 문서 자동 검증 모듈 (보호됨 - admin만 접근 가능) */}
      <Route
        path="/auto-document-verify"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AutoDocumentVerifyApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* DX 부문 KPI 관리 모듈 (보호됨) */}
      <Route
        path="/dx-kpi-management"
        element={
          <ProtectedRoute>
            <DxKpiManagementApp onGoHome={handleGoHome} />
          </ProtectedRoute>
        }
      />

      {/* Account Management 페이지 (보호됨) */}
      <Route
        path="/account-management"
        element={
          <ProtectedRoute>
            <AccountManagementPage />
          </ProtectedRoute>
        }
      />

      {/* 다른 모듈들도 임시로 Engineering Hub로 리다이렉트 */}
      <Route path="/genai" element={<Navigate to="/engineeringhub" replace />} />
      <Route path="/mold-cost-calculator" element={<Navigate to="/engineeringhub" replace />} />
      <Route path="/package-simulator" element={<Navigate to="/engineeringhub" replace />} />
      <Route path="/noise-simulator" element={<Navigate to="/engineeringhub" replace />} />
      <Route path="/fastening-simulator" element={<Navigate to="/engineeringhub" replace />} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

function App() {
  console.log('🚀 라우팅 변경된 App 컴포넌트 렌더링');

  return (
    <AuthProvider>
      <VisibilityScopeProvider>
        <Router>
          <div className="App">
            <AppWithNav />
          </div>
        </Router>
      </VisibilityScopeProvider>
    </AuthProvider>
  );
}

export default App;
