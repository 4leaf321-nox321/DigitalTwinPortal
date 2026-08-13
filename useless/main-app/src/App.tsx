import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Cards from './Cards';
import KnowledgeGraphApp from './KnowledgeGraphApp';

function App() {
  // 디버깅: App 컴포넌트 렌더링 확인
  console.log('🚀 App 컴포넌트가 렌더링되었습니다!');
  console.log('🌐 현재 URL:', window.location.href);
  console.log('📍 현재 pathname:', window.location.pathname);
  
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* 메인 진입페이지 - Cards */}
          <Route path="/" element={
            <>
              {console.log('🏠 메인 홈 페이지 라우트 매칭!')}
              <Cards />
            </>
          } />
          
          {/* Knowledge Graph 애플리케이션 */}
          <Route path="/knowledge-graph" element={
            <>
              {console.log('🔗 지식그래프 페이지 라우트 매칭!')}
              <KnowledgeGraphApp />
            </>
          } />
          
          {/* 기본적으로 메인 페이지로 리다이렉트 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
