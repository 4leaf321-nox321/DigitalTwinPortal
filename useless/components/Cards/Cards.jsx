import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const Container = styled.div`
  padding: 4rem 2rem;
  max-width: 1200px;
  margin: 0 auto;
  background: #ECEFF1;
  min-height: calc(100vh - 64px);
  margin-top: 64px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
`;

const Card = styled(motion.div)`
  background: #FFFFFF;
  padding: 2rem;
  border-radius: 1rem;
  transition: all 0.2s ease-in-out;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  &:hover {
    background: #FFFFFF;
    transform: translateY(-5px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    border-color: #00ACC1;
  }
`;

const Title = styled.h2`
  font-size: 1.5rem;
  color: #1B263B;
  margin-bottom: 1rem;
  transition: color 0.2s ease;

  ${Card}:hover & {
    color: #00ACC1;
  }
`;

const Description = styled.p`
  color: #1B263B;
  line-height: 1.6;
  margin-bottom: 1rem;
  opacity: 0.8;
`;

const Cards = () => {
  const navigate = useNavigate();

  return (
    <Container>
      <Grid>

        <Card
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          onClick={() => navigate('/genai')}
        >
          <Title>Gen AI</Title>
          <Description>
            대규모 언어 모델과 생성형 AI를 활용하여 설계 아이디어 제안, 문서 작성, 코드 생성 등을 지원합니다.
            Gauss와 사외 AI 서비스를 통합하여 최적의 솔루션을 제공합니다.
          </Description>
        </Card>

        <Card
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.8 }}
          onClick={() => navigate('/knowledge-graph')}
          style={{ 
            border: '2px solid #00ACC1',
            background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)'
          }}
        >
          <Title style={{ color: '#00ACC1', fontSize: '1.6rem' }}>🔗 Knowledge Graph</Title>
          <Description>
            기업 내 데이터와 문서들을 지식 그래프로 구조화하여 연결하고 시각화합니다.
            그래프 데이터베이스로 복잡한 관계를 직관적으로 탐색하고 분석할 수 있습니다.
          </Description>
          <div style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            background: '#00ACC1',
            color: 'white',
            borderRadius: '0.5rem',
            textAlign: 'center',
            fontSize: '0.9rem',
            fontWeight: 'bold'
          }}>
            지식그래프 GUI 열기
          </div>
        </Card>

      </Grid>
    </Container>
  );
};

export default Cards;
