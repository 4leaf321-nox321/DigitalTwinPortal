import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';

const Container = styled.div`
  padding: 4rem 2rem;
  max-width: 1200px;
  margin: 0 auto;
  background: #ECEFF1;
  min-height: 100vh;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 4rem;
  position: relative;
`;

const UserInfo = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 1rem;
  background: white;
  padding: 0.75rem 1.25rem;
  border-radius: 0.75rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const UserDetails = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #374151;
  font-size: 0.875rem;
  font-weight: 500;
`;

const LogoutButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: linear-gradient(135deg, #0066CC 0%, #003399 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
`;

const MainTitle = styled.h1`
  font-size: 3rem;
  color: #1B263B;
  margin-bottom: 1rem;
  font-weight: bold;
`;

const Subtitle = styled.p`
  font-size: 1.2rem;
  color: #666;
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
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
  display: flex;
  flex-direction: column;
  height: 100%;

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
  flex-grow: 1;
`;

const StatusBadge = styled.div`
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.8rem;
  font-weight: bold;
  margin-bottom: 1rem;
  ${props => {
    switch (props.status) {
      case 'active':
        return 'background: #e8f5e8; color: #2e7d32;';
      case 'development':
        return 'background: #fff3e0; color: #f57c00;';
      case 'planned':
        return 'background: #f3e5f5; color: #7b1fa2;';
      default:
        return 'background: #f5f5f5; color: #666;';
    }
  }}
`;

const EngineeringHub = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    if (window.confirm('로그아웃 하시겠습니까?')) {
      logout();
      navigate('/login');
    }
  };

  const modules = [
    {
      id: 'knowledge-graph',
      title: '🔗 Knowledge Graph',
      description: '기업 내 데이터와 문서들을 지식 그래프로 구조화하여 연결하고 시각화합니다. 그래프 데이터베이스로 복잡한 관계를 직관적으로 탐색하고 분석할 수 있습니다.',
      status: 'active',
      route: '/knowledge-graph',
      featured: true
    },
    {
      id: 'genai',
      title: '🤖 Gen AI',
      description: '대규모 언어 모델과 생성형 AI를 활용하여 설계 아이디어 제안, 문서 작성, 코드 생성 등을 지원합니다. Gauss와 사외 AI 서비스를 통합하여 최적의 솔루션을 제공합니다.',
      status: 'development',
      route: '/genai'
    },
    {
      id: 'gantt-chart',
      title: '📊 Gantt Chart',
      description: '프로젝트 일정을 시각적으로 관리하고 추적할 수 있는 간트 차트 도구입니다. 작업 계획, 진행 상황, 의존성 관계를 직관적으로 파악하여 효율적인 프로젝트 관리를 지원합니다.',
      status: 'active',
      route: '/gantt-chart',
      featured: true
    },
    {
      id: 'tech-radar',
      title: '📡 Tech Radar',
      description: '기술 동향과 조직 내 기술 채택 현황을 시각화하여 관리하는 도구입니다. 기술의 성숙도와 채택 단계를 추적하고, 전략적 기술 의사결정을 지원합니다.',
      status: 'active',
      route: '/tech-radar',
      featured: true
    },
    {
      id: 'swimlane-chart',
      title: '🏊 Swimlane Chart',
      description: '프로세스와 워크플로우를 수영장 레인처럼 구분하여 시각화하는 도구입니다. 부서별, 역할별 업무 흐름을 명확하게 표현하여 프로세스 개선과 책임 분담을 지원합니다.',
      status: 'active',
      route: '/swimlane-chart',
      featured: true
    },
    {
      id: 'tech-archive',
      title: '📚 Tech Archive',
      description: '기술 문서, 가이드라인, 베스트 프랙티스를 체계적으로 관리하는 기술 아카이브입니다. 팀 내 기술 지식을 축적하고 공유하여 효율적인 개발 환경을 구축합니다.',
      status: 'active',
      route: '/tech-archive',
      featured: true
    },
    {
      id: 'digital-twin-solution',
      title: '🎯 Digital Twin Solution',
      description: '디지털 트윈 솔루션 기술의 성숙도와 도입 현황을 레이더 차트로 시각화합니다. 기술 로드맵, 리스크 분석, 전략 수립을 지원하여 디지털 트윈 전장에서의 의사결정을 도와줍니다.',
      status: 'active',
      route: '/digital-twin-solution',
      featured: true
    },
    {
      id: 'digital-twin-dashboard',
      title: '📈 Digital Twin Dashboard',
      description: '디지털 트윈 시스템들의 현황을 통합적으로 모니터링하고 분석하는 대시보드입니다. 실시간 데이터 수집, 시각화, 알림 기능을 통해 디지털 트윈 운영 현황을 한눈에 파악할 수 있습니다.',
      status: 'development',
      route: '/digital-twin-dashboard'
    }
  ];

  return (
    <Container>
      <Header>
        <UserInfo>
          <UserDetails>
            <UserIcon size={18} />
            <span>{user?.name || user?.username}</span>
          </UserDetails>
          <LogoutButton onClick={handleLogout}>
            <LogOut size={16} />
            로그아웃
          </LogoutButton>
        </UserInfo>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <MainTitle>Engineering Hub</MainTitle>
          <Subtitle>
            통합 엔지니어링 도구 모음입니다. 설계, 시뮬레이션, 분석 등 다양한 엔지니어링 업무를 지원하는 모듈들을 제공합니다.
          </Subtitle>
        </motion.div>
      </Header>

      <Grid>
        {modules.map((module, index) => (
          <Card
            key={module.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            onClick={() => navigate(module.route)}
            style={module.featured ? { 
              border: '2px solid #00ACC1',
              background: 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 100%)'
            } : {}}
          >
            <StatusBadge status={module.status}>
              {module.status === 'active' && '사용 가능'}
              {module.status === 'development' && '개발 중'}
              {module.status === 'planned' && '계획됨'}
            </StatusBadge>
            
            <Title style={module.featured ? { color: '#00ACC1', fontSize: '1.6rem' } : {}}>
              {module.title}
            </Title>
            
            <Description>
              {module.description}
            </Description>
            
            {module.featured && (
              <div style={{
                marginTop: 'auto',
                padding: '0.5rem 1rem',
                background: '#00ACC1',
                color: 'white',
                borderRadius: '0.5rem',
                textAlign: 'center',
                fontSize: '0.9rem',
                fontWeight: 'bold'
              }}>
                지금 사용하기
              </div>
            )}
          </Card>
        ))}
      </Grid>
    </Container>
  );
};

export default EngineeringHub;
