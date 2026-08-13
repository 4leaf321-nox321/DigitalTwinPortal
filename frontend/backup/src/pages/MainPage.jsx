import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Settings, 
  Code, 
  BarChart3, 
  GitBranch,
  Layers,
  FileText,
  Cpu,
  Calculator,
  Package,
  Volume2,
  Wrench,
  Home,
  Zap,
  Play,
  Cog,
  Brain,
  Users,
  Network,
  Target
} from 'lucide-react';

// ---- Styled Components ----------------------------------------------------
const Container = styled.div`
  height: 100vh;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
  color: #1e293b;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.header`
  padding: 1rem;
  border-bottom: 1px solid #e2e8f0;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  position: sticky;
  top: 0;
  z-index: 10;
`;

const HeaderContent = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
`;

const LogoSection = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const LogoIcon = styled.div`
  padding: 0.5rem;
  border-radius: 0.75rem;
  background: #1e293b;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LogoText = styled.div`
  h1 {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
    color: #1e293b;
  }
  p {
    font-size: 0.75rem;
    color: #64748b;
    margin: 0;
  }
`;

const HeaderControls = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const SearchContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  padding: 0.5rem;
  
  @media (max-width: 768px) {
    display: none;
  }
`;

const SearchInput = styled.input`
  outline: none;
  border: none;
  font-size: 0.875rem;
  width: 256px;
  background: transparent;
  color: #1e293b;
  
  &::placeholder {
    color: #94a3b8;
  }
`;

const RoleSelect = styled.select`
  font-size: 0.875rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.25rem 0.5rem;
  background: white;
  color: #1e293b;
`;

const Main = styled.main`
  flex: 1;
  padding: 0.5rem;
  overflow: visible;
  display: flex;
  flex-direction: column;
`;

const MainContent = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 0.5rem;
  overflow: visible;
  
  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }
`;

const MetroGrid = styled.section`
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 1rem;
`;

const TileGrid = styled(motion.div)`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 0.5rem;
  width: 100%;
  height: 100%;
  padding: 1rem;
  
  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(4, 1fr);
    padding: 0.5rem;
  }
  
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(8, 1fr);
    padding: 0.5rem;
  }
`;

const Sidebar = styled.aside`
  width: 300px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: auto;
  
  @media (max-width: 1024px) {
    width: 100%;
    height: auto;
    max-height: 40vh;
  }
`;

const Widget = styled(motion.div)`
  border-radius: 1rem;
  border: 1px solid #e2e8f0;
  background: white;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const KPIGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
`;

const KPICard = styled.div`
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  background: white;
  padding: 0.75rem;
  
  .label {
    font-size: 0.6875rem;
    color: #64748b;
    margin-bottom: 0.125rem;
  }
  
  .value {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }
`;

const WidgetTitle = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  margin-bottom: 0.5rem;
`;

const AnnouncementList = styled.ul`
  margin: 0.5rem 0 0 0;
  padding-left: 1rem;
  font-size: 0.875rem;
  color: #374151;
  line-height: 1.5;
  
  li {
    margin-bottom: 0.25rem;
  }
`;

const RecentList = styled.div`
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const RecentItem = styled.div`
  padding: 0.5rem;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  transition: background-color 0.2s ease;
  cursor: pointer;
  
  &:hover {
    background: #f8fafc;
  }
  
  .title {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1e293b;
  }
  
  .tag {
    font-size: 0.6875rem;
    color: #64748b;
    margin-top: 0.125rem;
  }
`;

const QuickActions = styled.div`
  margin-top: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
`;

const QuickButton = styled.button`
  padding: 0.375rem 0.75rem;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  font-size: 0.875rem;
  background: white;
  color: #1e293b;
  transition: all 0.2s ease;
  cursor: pointer;
  
  &:hover {
    background: #f8fafc;
  }
`;

const Toast = styled(motion.div)`
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  padding: 1rem 1.5rem;
  border-radius: 0.75rem;
  background: #1e293b;
  color: white;
  font-size: 0.875rem;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
  z-index: 50;
`;

const Footer = styled.footer`
  padding: 0 1rem 1.5rem 1rem;
  text-align: center;
  font-size: 0.75rem;
  color: #64748b;
`;

// ---- Tile Component -------------------------------------------------------
const TileButton = styled(motion.button)`
  position: relative;
  overflow: hidden;
  border-radius: 1rem;
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.5rem;
  width: 100%;
  height: 100%;
  z-index: 1;
  
  &:hover {
    transform: scale(1.05);
    border: 2px solid rgba(255, 255, 255, 0.8);
    box-shadow: 
      0 0 30px rgba(255, 255, 255, 0.3),
      0 0 60px rgba(255, 255, 255, 0.2),
      0 8px 25px rgba(0, 0, 0, 0.2);
    z-index: 10;
  }
  
  &:active {
    transform: scale(1.02);
    transition: all 0.1s ease;
    z-index: 10;
  }
`;

const TileGradient = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0) 100%);
  transition: opacity 0.3s ease;
  
  ${TileButton}:hover & {
    background: linear-gradient(135deg, 
      rgba(255, 255, 255, 0.1) 0%, 
      rgba(255, 255, 255, 0.05) 50%,
      rgba(0, 0, 0, 0.1) 100%);
  }
`;

const TileBadge = styled.div`
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.9);
  color: #374151;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  
  ${TileButton}:hover & {
    background: rgba(255, 255, 255, 1);
    transform: scale(1.1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }
`;

const TileContent = styled.div`
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`;

const TileTop = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  align-items: flex-start;
  transition: transform 0.3s ease;
  
  svg {
    transition: all 0.3s ease;
  }
  
  ${TileButton}:hover & {
    transform: translateY(-2px);
    
    svg {
      transform: scale(1.1);
      filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.6));
    }
  }
`;

const TileTitle = styled.div`
  font-weight: 600;
  line-height: 1.2;
  font-size: 1.1rem;
  text-align: left;
  margin-top: 0.5rem;
  color: white;
  transition: all 0.3s ease;
  
  ${TileButton}:hover & {
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
    transform: translateY(-1px);
  }
  
  @media (max-width: 768px) {
    font-size: 1rem;
  }
`;

const TileDescription = styled.div`
  font-size: 0.85rem;
  opacity: 0.95;
  text-align: left;
  line-height: 1.4;
  margin-top: auto;
  color: white;
  transition: all 0.3s ease;
  
  ${TileButton}:hover & {
    opacity: 1;
    text-shadow: 0 0 8px rgba(255, 255, 255, 0.6);
  }
  
  @media (max-width: 768px) {
    font-size: 0.75rem;
  }
`;

const TILE_COLORS = [
  "#4f46e5", "#0ea5e9", "#10b981", "#14b8a6",
  "#f59e0b", "#ef4444", "#374151", "#c026d3",
];

const SIMULATION_FEATURES = [
  { 
    id: "simulation-tools", 
    name: "DX 부문 디지털 트윈 솔루션 맵", 
    desc: "시뮬레이션 툴 정보 공유", 
    color: 0, 
    gridColumn: "span 1", 
    gridRow: "span 1",
    badge: "8개",
    icon: Cog,
    route: "/digital-twin-solution"
  },
  { 
    id: "self-simulation", 
    name: "디지털 트윈 인력 운영", 
    desc: "설계자 주도 시뮬레이션 추진·기술 인력 양성", 
    color: 1, 
    gridColumn: "span 1", 
    gridRow: "span 1",
    badge: "BETA",
    icon: Play
  },
  { 
    id: "element-tech", 
    name: "시뮬레이션 기법 라이브러리", 
    desc: "물성·템플릿·산출물 공유", 
    color: 2, 
    gridColumn: "span 2", 
    gridRow: "span 2",
    icon: Layers
  },
  { 
    id: "ai-hub", 
    name: "AI 기술 허브", 
    desc: "기법 공유·데이터표준화·MLOps", 
    color: 3, 
    gridColumn: "span 2", 
    gridRow: "span 1",
    badge: "NEW",
    icon: Brain
  },
  { 
    id: "company-projects", 
    name: "프로젝트 갤러리", 
    desc: "사업부 간 과제 공유", 
    color: 4, 
    gridColumn: "span 1", 
    gridRow: "span 1",
    badge: "24개",
    icon: Users
  },
  { 
    id: "system-level", 
    name: "하드웨어 인프라 현황", 
    desc: "MBSE(SysML)/SPDM 협업", 
    color: 5, 
    gridColumn: "span 1", 
    gridRow: "span 1",
    icon: Network
  },
  { 
    id: "engineering-hub", 
    name: "디지털 트윈 과제 현황", 
    desc: "사업부 데이터·현황 취합", 
    color: 6, 
    gridColumn: "span 1", 
    gridRow: "span 1",
    icon: Home,
    route: "/digital-twin-dashboard"
  },
  { 
    id: "kpi-dashboard", 
    name: "주요 일정", 
    desc: "성과 지표 모니터링", 
    color: 0, 
    gridColumn: "span 1", 
    gridRow: "span 1",
    icon: BarChart3
  },
];

function Tile({ item, onOpen }) {
  const color = TILE_COLORS[item.color % TILE_COLORS.length];
  const IconComponent = item.icon || Zap;
  
  return (
    <TileButton
      onClick={() => onOpen?.(item)}
      style={{
        backgroundColor: color,
        gridColumn: item.gridColumn,
        gridRow: item.gridRow,
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 1.02 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <TileGradient />
      {item.badge && <TileBadge>{item.badge}</TileBadge>}
      <TileContent>
        <TileTop>
          <IconComponent size={28} style={{ opacity: 0.95, color: 'white' }} />
          <TileTitle>{item.name}</TileTitle>
        </TileTop>
        <TileDescription>{item.desc}</TileDescription>
      </TileContent>
    </TileButton>
  );
}

// ---- Data ----------------------------------------------------------------
const RECENTS = [
  { id: "r1", title: "OptiStruct 접촉 해석 가이드 업데이트", tag: "요소기술" },
  { id: "r2", title: "AI 허브 - PCB 변형 예측 모델 v2.1", tag: "AI Hub" },
  { id: "r3", title: "전사 시뮬레이션 과제 리뷰 Q2", tag: "전사과제" },
  { id: "r4", title: "멀티피직스 통합 해석 사례 추가", tag: "시스템레벨" },
];

const KPIS = [
  { id: "k1", label: "월간 해석 실행", value: 428 },
  { id: "k2", label: "등록 모델", value: 96 },
  { id: "k3", label: "진행 과제", value: 37 },
  { id: "k4", label: "AI 모델", value: 18 },
];

// ---- Main Component -------------------------------------------------------
const MainPage = () => {
  const navigate = useNavigate();
  const [notice, setNotice] = useState(null);
  const [role, setRole] = useState("All");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return SIMULATION_FEATURES.filter((x) =>
      (!term || x.name.toLowerCase().includes(term) || x.desc.toLowerCase().includes(term)) &&
      (role === "All" || 
       (role === "Engineer" && ["self-simulation","element-tech","ai-hub","simulation-tools"].includes(x.id)) ||
       (role === "Manager" && ["company-projects","system-level","kpi-dashboard","engineering-hub"].includes(x.id)))
    );
  }, [q, role]);

  const onOpen = (feature) => {
    if (feature.route) {
      navigate(feature.route);
    } else {
      setNotice(`➡️ "${feature.name}" 모듈로 이동 (라우팅 연동 예정)`);
      setTimeout(() => setNotice(null), 2300);
    }
  };

  return (
    <Container>
      {/* Header */}
      <Header>
        <HeaderContent>
          <LogoSection
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
          >
            <LogoIcon>
              <Target size={20} />
            </LogoIcon>
            <LogoText>
              <h1>DX 시뮬레이션 플랫폼</h1>
              <p>디지털 트윈 시뮬레이션 통합 대시보드 · React + Styled Components</p>
            </LogoText>
          </LogoSection>
          
          <HeaderControls
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <SearchContainer>
              <Search size={16} color="#94a3b8" />
              <SearchInput
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="검색: 시뮬레이션/AI/과제"
              />
            </SearchContainer>
            <RoleSelect 
              value={role} 
              onChange={(e) => setRole(e.target.value)}
            >
              <option>All</option>
              <option>Engineer</option>
              <option>Manager</option>
            </RoleSelect>
          </HeaderControls>
        </HeaderContent>
      </Header>

      {/* Body */}
      <Main>
        <MainContent>
          {/* Metro Grid */}
          <MetroGrid>
            <TileGrid
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              {filtered.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  style={{ 
                    gridColumn: item.gridColumn,
                    gridRow: item.gridRow,
                    display: 'flex'
                  }}
                >
                  <Tile item={item} onOpen={onOpen} />
                </motion.div>
              ))}
            </TileGrid>
          </MetroGrid>

          {/* Sidebar */}
          <Sidebar>
            {/* KPI Cards */}
            <KPIGrid>
              {KPIS.map((k, index) => (
                <motion.div
                  key={k.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                >
                  <KPICard>
                    <div className="label">{k.label}</div>
                    <div className="value">{k.value.toLocaleString()}</div>
                  </KPICard>
                </motion.div>
              ))}
            </KPIGrid>

            {/* Announcements */}
            <Widget
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              <WidgetTitle>공지사항</WidgetTitle>
              <AnnouncementList>
                <li>셀프 시뮬레이션 v0.8 - 열-구조 연성 해석 추가</li>
                <li>AI 허브 신규 모델 5종 배포 (PCB, 방열, 진동)</li>
                <li>시스템 레벨 과제 템플릿 라이브러리 오픈</li>
                <li>상용 툴 라이선스 풀 확장 (Ansys, Altair)</li>
              </AnnouncementList>
            </Widget>

            {/* Recent Updates */}
            <Widget
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <WidgetTitle>최근 업데이트</WidgetTitle>
              <RecentList>
                {RECENTS.map((r) => (
                  <RecentItem key={r.id}>
                    <div className="title">{r.title}</div>
                    <div className="tag">{r.tag}</div>
                  </RecentItem>
                ))}
              </RecentList>
            </Widget>

            {/* Quick Actions */}
            <Widget
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <WidgetTitle>빠른 실행</WidgetTitle>
              <QuickActions>
                {[
                  { id: "qa1", name: "해석 실행", action: () => setNotice("셀프 시뮬레이션으로 이동") },
                  { id: "qa2", name: "모델 업로드", action: () => setNotice("모델 관리 시스템으로 이동") },
                  { id: "qa3", name: "과제 등록", action: () => setNotice("과제 관리 시스템으로 이동") },
                  { id: "qa4", name: "허브 이동", action: () => navigate('/engineeringhub') },
                ].map((a) => (
                  <QuickButton 
                    key={a.id} 
                    onClick={a.action}
                  >
                    {a.name}
                  </QuickButton>
                ))}
              </QuickActions>
            </Widget>

            {/* GUI Library */}
            <Widget
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
            >
              <WidgetTitle>GUI 라이브러리</WidgetTitle>
              <QuickActions>
                <QuickButton onClick={() => navigate('/engineeringhub')}>
                  통합 도구 허브
                </QuickButton>
              </QuickActions>
            </Widget>
          </Sidebar>
        </MainContent>
      </Main>

      {/* Toast Notification */}
      {notice && (
        <Toast
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          {notice}
        </Toast>
      )}

      <Footer>
        © 2025 DX 시뮬레이션 플랫폼 · Digital Twin Dashboard — React + Styled Components
      </Footer>
    </Container>
  );
};

export default MainPage;