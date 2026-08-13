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

const Cards: React.FC = () => {
  const navigate = useNavigate();
  
  // 디버깅: Cards 컴포넌트가 렌더링되는지 확인
  console.log('🏠 Cards 컴포넌트가 렌더링되었습니다!');

  return (
    <Container>
      <Grid>
        <Card
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.9 }}
          onClick={() => navigate('/mold-cost-calculator')}
        >
          <Title>금형비 산출 시뮬레이터</Title>
          <Description>
            금형 제작 비용을 정확하게 산출하는 도구입니다.
            재료비, 가공비, 설계비 등 다양한 비용 요소를 고려하여 정밀한 금형 제작 비용 견적을 제공합니다.
          </Description>
        </Card>
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
          transition={{ duration: 0.3, delay: 0.4 }}
          onClick={() => navigate('/package-simulator')}
        >
          <Title>포장 적재 시뮬레이터</Title>
          <Description>
            효율적인 물류 운영을 위한 포장 적재 시뮬레이션 도구입니다.
            다양한 크기의 상자와 컨테이너에 대한 최적의 적재 방법을 계산하고 시각화합니다.
          </Description>
        </Card>

        <Card
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.6 }}
          onClick={() => navigate('/noise-simulator')}
        >
          <Title>뚝소음 시뮬레이터</Title>
          <Description>
            제품 사용 중 발생하는 뚝소음을 시뮬레이션하고 분석하는 도구입니다.
            음향 데이터 분석, 소음 패턴 예측, 개선 방안 제시를 통해 제품 품질 향상을 지원합니다.
          </Description>
        </Card>

        <Card
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.7 }}
          onClick={() => navigate('/fastening-simulator')}
        >
          <Title>체결 구조 시뮬레이터</Title>
          <Description>
            기구 설계에서 체결부의 강도 및 형상을 시뮬레이션하고 평가하는 도구입니다.
            체결 형상 평가와 인가 하중 분석을 통해 최적의 체결 구조 설계를 지원합니다.
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
