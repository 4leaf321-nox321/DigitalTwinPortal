import React from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { motion } from 'framer-motion';

const Container = styled.div`
  padding: 4rem 2rem;
  max-width: 800px;
  margin: 0 auto;
  background: #ECEFF1;
  min-height: calc(100vh - 64px);
  text-align: center;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  color: #1B263B;
  margin-bottom: 2rem;
`;

const Description = styled.p`
  font-size: 1.2rem;
  color: #1B263B;
  line-height: 1.6;
  margin-bottom: 3rem;
  opacity: 0.8;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 2rem;
  justify-content: center;
  margin-bottom: 3rem;
`;

const Button = styled(motion.button)`
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: bold;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
`;

const PrimaryButton = styled(Button)`
  background: #00ACC1;
  color: white;
  
  &:hover {
    background: #00838F;
    transform: translateY(-2px);
  }
`;

const SecondaryButton = styled(Button)`
  background: white;
  color: #00ACC1;
  border: 2px solid #00ACC1;
  
  &:hover {
    background: #00ACC1;
    color: white;
    transform: translateY(-2px);
  }
`;

const BackButton = styled(Button)`
  background: #f5f5f5;
  color: #666;
  
  &:hover {
    background: #e0e0e0;
    transform: translateY(-2px);
  }
`;

function KnowledgeGraphApp() {
  const navigate = useNavigate();

  const handleOpenKnowledgeGraph = () => {
    // 새 창에서 frontend 지식그래프 앱 열기
    window.open('http://localhost:5174', '_blank', 'width=1400,height=900');
  };

  const handleGoBack = () => {
    navigate('/');
  };

  return (
    <Container>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <Title>🔗 Knowledge Graph</Title>
        
        <Description>
          지식그래프 애플리케이션에 오신 것을 환영합니다!<br/>
          복잡한 데이터 관계를 직관적으로 시각화하고 분석할 수 있는 도구입니다.
        </Description>

        <ButtonContainer>
          <PrimaryButton
            onClick={handleOpenKnowledgeGraph}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            📊 지식그래프 열기
          </PrimaryButton>
          
          <SecondaryButton
            onClick={handleGoBack}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            🏠 메인으로 돌아가기
          </SecondaryButton>
        </ButtonContainer>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '1rem',
            marginTop: '2rem',
            textAlign: 'left'
          }}
        >
          <h3 style={{ color: '#1B263B', marginBottom: '1rem' }}>🌟 주요 기능</h3>
          <ul style={{ color: '#1B263B', lineHeight: 1.8 }}>
            <li>📈 <strong>노드 및 엣지 관리</strong>: 데이터 요소들과 관계를 쉽게 추가, 편집, 삭제</li>
            <li>🎨 <strong>다양한 레이아웃</strong>: Force-directed, Hierarchical, Radial 등 여러 시각화 옵션</li>
            <li>🔍 <strong>검색 및 필터링</strong>: 원하는 정보를 빠르게 찾고 분석</li>
            <li>💾 <strong>데이터 관리</strong>: JSON 형태로 데이터 저장 및 불러오기</li>
            <li>🏷️ <strong>타입 시스템</strong>: 노드와 엣지의 유형을 체계적으로 관리</li>
            <li>📊 <strong>상세 정보 패널</strong>: 선택한 요소의 상세 정보 확인 및 편집</li>
          </ul>
        </motion.div>
      </motion.div>
    </Container>
  );
}

export default KnowledgeGraphApp;
