import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  FileText,
  HardDrive,
  Cloud,
  BarChart3,
  Calendar,
  Settings,
  ChevronRight,
  ChevronLeft,
  X,
  Lightbulb,
  ArrowRight,
  Camera,
  Shield,
  Users,
  Zap,
  RefreshCw,
  Lock,
  Unlock,
  Database,
  Upload
} from 'lucide-react';
import { useAuth } from '../../../../../contexts/AuthContext';

const GuideOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 2rem;
`;

const GuideContainer = styled(motion.div)`
  background: white;
  border-radius: 1.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
  max-width: 1000px;
  width: 100%;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const GuideHeader = styled.div`
  padding: 2rem 2.5rem;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;

  h1 {
    font-size: 1.75rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  p {
    font-size: 1rem;
    opacity: 0.9;
    line-height: 1.5;
  }

  .user-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    background: rgba(255, 255, 255, 0.2);
    padding: 0.25rem 0.75rem;
    border-radius: 1rem;
    font-size: 0.875rem;
    margin-left: 0.75rem;
  }
`;

const GuideContent = styled.div`
  padding: 2rem 2.5rem;
  flex: 1;
  overflow-y: auto;
`;

const StepIndicator = styled.div`
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 2rem;
`;

const StepDot = styled.div`
  width: ${props => props.active ? '2rem' : '0.75rem'};
  height: 0.75rem;
  border-radius: 0.5rem;
  background: ${props => props.active ? '#3b82f6' : props.completed ? '#10b981' : '#e2e8f0'};
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    background: ${props => props.active ? '#3b82f6' : props.completed ? '#059669' : '#cbd5e1'};
  }
`;

const StepContent = styled(motion.div)`
  min-height: 350px;
`;

const WorkflowSection = styled.div`
  margin-bottom: 2rem;

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
`;

const WorkflowSteps = styled.div`
  display: flex;
  align-items: stretch;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
  }
`;

const WorkflowStep = styled.div`
  flex: 1;
  min-width: 180px;
  max-width: 220px;
  background: ${props => props.highlight ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' : '#f8fafc'};
  border: 2px solid ${props => props.highlight ? '#3b82f6' : '#e2e8f0'};
  border-radius: 1rem;
  padding: 1.5rem;
  text-align: center;
  transition: all 0.3s ease;
  position: relative;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
  }

  .step-number {
    position: absolute;
    top: -0.75rem;
    left: 50%;
    transform: translateX(-50%);
    background: ${props => props.highlight ? '#3b82f6' : '#6b7280'};
    color: white;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 700;
  }

  .step-icon {
    width: 3.5rem;
    height: 3.5rem;
    background: ${props => props.highlight ? '#3b82f6' : '#e2e8f0'};
    color: ${props => props.highlight ? 'white' : '#6b7280'};
    border-radius: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1rem;
  }

  .step-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.5rem;
  }

  .step-desc {
    font-size: 0.8125rem;
    color: #6b7280;
    line-height: 1.4;
  }
`;

const ArrowIcon = styled.div`
  display: flex;
  align-items: center;
  color: #9ca3af;

  @media (max-width: 768px) {
    transform: rotate(90deg);
  }
`;

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const FeatureCard = styled.div`
  background: ${props => props.highlight ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)' : '#f8fafc'};
  border: 1px solid ${props => props.highlight ? '#3b82f6' : '#e2e8f0'};
  border-radius: 0.75rem;
  padding: 1.25rem;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.highlight ? 'linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)' : '#f1f5f9'};
    border-color: ${props => props.highlight ? '#2563eb' : '#cbd5e1'};
  }

  .feature-icon {
    width: 2.5rem;
    height: 2.5rem;
    background: ${props => props.iconBg || '#e2e8f0'};
    color: ${props => props.iconColor || '#6b7280'};
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .feature-content {
    flex: 1;

    h4 {
      font-size: 0.9375rem;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 0.25rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    p {
      font-size: 0.8125rem;
      color: #6b7280;
      line-height: 1.4;
    }
  }
`;

const RoleBadge = styled.span`
  font-size: 0.6875rem;
  padding: 0.125rem 0.5rem;
  border-radius: 0.25rem;
  font-weight: 600;
  background: ${props => props.admin ? '#fef2f2' : '#ecfdf5'};
  color: ${props => props.admin ? '#dc2626' : '#059669'};
  border: 1px solid ${props => props.admin ? '#fecaca' : '#a7f3d0'};
`;

const TipBox = styled.div`
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 1px solid #3b82f6;
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  margin-top: 1.5rem;

  .tip-icon {
    color: #2563eb;
    flex-shrink: 0;
  }

  .tip-content {
    font-size: 0.875rem;
    color: #1e40af;
    line-height: 1.5;

    strong {
      font-weight: 600;
    }
  }
`;

const ImportantBox = styled.div`
  background: ${props => props.variant === 'success' ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)' : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'};
  border: 1px solid ${props => props.variant === 'success' ? '#10b981' : '#3b82f6'};
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  margin-top: 1rem;

  .icon {
    color: ${props => props.variant === 'success' ? '#059669' : '#2563eb'};
    flex-shrink: 0;
  }

  .content {
    font-size: 0.875rem;
    color: ${props => props.variant === 'success' ? '#065f46' : '#1e40af'};
    line-height: 1.5;

    strong {
      font-weight: 600;
    }
  }
`;

const ComparisonTable = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-top: 1rem;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const ComparisonColumn = styled.div`
  background: ${props => props.admin ? '#fef2f2' : '#f0fdf4'};
  border: 2px solid ${props => props.admin ? '#fecaca' : '#bbf7d0'};
  border-radius: 1rem;
  padding: 1.5rem;

  .column-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid ${props => props.admin ? '#fecaca' : '#bbf7d0'};

    .icon-wrapper {
      width: 2.5rem;
      height: 2.5rem;
      background: ${props => props.admin ? '#dc2626' : '#10b981'};
      color: white;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    h4 {
      font-size: 1.125rem;
      font-weight: 700;
      color: ${props => props.admin ? '#991b1b' : '#065f46'};
    }
  }

  .feature-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .feature-item {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: #374151;
    line-height: 1.4;

    .check-icon {
      color: ${props => props.admin ? '#dc2626' : '#10b981'};
      flex-shrink: 0;
      margin-top: 0.125rem;
    }
  }
`;

const GuideFooter = styled.div`
  padding: 1.5rem 2.5rem;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const NavButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;

  &.primary {
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border: none;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
    }
  }

  &.secondary {
    background: white;
    color: #6b7280;
    border: 1px solid #d1d5db;

    &:hover {
      background: #f3f4f6;
      color: #374151;
    }
  }

  &.skip {
    background: transparent;
    color: #9ca3af;
    border: none;
    padding: 0.75rem 1rem;

    &:hover {
      color: #6b7280;
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const DismissCheckbox = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #6b7280;
  cursor: pointer;

  input {
    width: 1rem;
    height: 1rem;
    accent-color: #3b82f6;
  }
`;

const GUIDE_STEPS = [
  {
    id: 'workflow',
    title: '기본 사용 흐름',
    content: 'workflow'
  },
  {
    id: 'user-roles',
    title: '사용자 권한',
    content: 'user-roles'
  },
  {
    id: 'views',
    title: '화면 전환',
    content: 'views'
  },
  {
    id: 'settings',
    title: '설정 및 관리',
    content: 'settings'
  }
];

const EmptyStateGuide = ({ onDismiss, onAddPerformance, onAddProject }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.is_admin;

  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleDismiss = () => {
    if (dontShowAgain) {
      localStorage.setItem('digitalTwinGuideHidden', 'true');
    }
    onDismiss();
  };

  const handleNext = () => {
    if (currentStep < GUIDE_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleDismiss();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepContent = () => {
    switch (GUIDE_STEPS[currentStep].content) {
      case 'workflow':
        return (
          <StepContent
            key="workflow"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <WorkflowSection>
              <h3>
                <Target size={20} color="#3b82f6" />
                데이터 등록 순서
              </h3>
              <WorkflowSteps>
                <WorkflowStep>
                  <div className="step-number">1</div>
                  <div className="step-icon">
                    <Target size={24} />
                  </div>
                  <div className="step-title">성과 등록</div>
                  <div className="step-desc">
                    측정할 성과 지표를 먼저 정의합니다<br/>
                    (예: 매출 증가율, 공정 효율)
                  </div>
                </WorkflowStep>

                <ArrowIcon>
                  <ArrowRight size={24} />
                </ArrowIcon>

                <WorkflowStep>
                  <div className="step-number">2</div>
                  <div className="step-icon">
                    <FileText size={24} />
                  </div>
                  <div className="step-title">과제 등록</div>
                  <div className="step-desc">
                    프로젝트/과제를 생성하고<br/>
                    기본 정보를 입력합니다
                  </div>
                </WorkflowStep>

                <ArrowIcon>
                  <ArrowRight size={24} />
                </ArrowIcon>

                <WorkflowStep>
                  <div className="step-number">3</div>
                  <div className="step-icon">
                    <Target size={24} />
                  </div>
                  <div className="step-title">성과 연결</div>
                  <div className="step-desc">
                    과제 편집에서 등록된<br/>
                    성과를 과제에 연결합니다
                  </div>
                </WorkflowStep>
              </WorkflowSteps>
            </WorkflowSection>

            <ImportantBox variant="success">
              <Zap size={20} className="icon" />
              <div className="content">
                <strong>자동 서버 동기화!</strong><br/>
                과제나 성과를 등록/수정할 때 <strong>"저장 및 서버 업로드"</strong> 버튼을 클릭하면 변경 사항이 <strong>즉시 서버에 반영</strong>됩니다.<br/>
                별도의 "서버에 저장" 과정 없이 각 항목 수정 시마다 실시간으로 모든 사용자와 공유됩니다.
              </div>
            </ImportantBox>
          </StepContent>
        );

      case 'user-roles':
        return (
          <StepContent
            key="user-roles"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <WorkflowSection>
              <h3>
                <Users size={20} color="#3b82f6" />
                사용자 권한별 기능
              </h3>

              <ComparisonTable>
                <ComparisonColumn>
                  <div className="column-header">
                    <div className="icon-wrapper">
                      <Users size={20} />
                    </div>
                    <h4>일반 사용자</h4>
                  </div>
                  <div className="feature-list">
                    <div className="feature-item">
                      <ChevronRight size={16} className="check-icon" />
                      <span>과제 및 성과 등록/수정/삭제</span>
                    </div>
                    <div className="feature-item">
                      <ChevronRight size={16} className="check-icon" />
                      <span><strong>"저장 및 서버 업로드"</strong>로 개별 항목 즉시 반영</span>
                    </div>
                    <div className="feature-item">
                      <ChevronRight size={16} className="check-icon" />
                      <span>서버 데이터 불러오기</span>
                    </div>
                    <div className="feature-item">
                      <ChevronRight size={16} className="check-icon" />
                      <span>로컬 파일 저장/불러오기 (백업용)</span>
                    </div>
                    <div className="feature-item">
                      <ChevronRight size={16} className="check-icon" />
                      <span>대시보드 및 간트 차트 조회</span>
                    </div>
                    <div className="feature-item">
                      <ChevronRight size={16} className="check-icon" />
                      <span>기여도 수정 후 서버 업로드</span>
                    </div>
                  </div>
                </ComparisonColumn>

                <ComparisonColumn admin>
                  <div className="column-header">
                    <div className="icon-wrapper">
                      <Shield size={20} />
                    </div>
                    <h4>관리자</h4>
                  </div>
                  <div className="feature-list">
                    <div className="feature-item">
                      <ChevronRight size={16} className="check-icon" />
                      <span>일반 사용자의 모든 기능 포함</span>
                    </div>
                    {/* 2026-07-31 컷오버 — '서버에 저장'·'스냅샷 생성/복원' 항목을 뺐다.
                        둘 다 헤더에서 메뉴를 내렸다(Header.jsx 의 같은 날짜 주석 참조).
                        없는 기능을 안내하면 사용자가 메뉴를 찾아 헤매게 된다. */}
                    <div className="feature-item">
                      <ChevronRight size={16} className="check-icon" />
                      <span>여러 데이터 추가 (대량 등록)</span>
                    </div>
                    <div className="feature-item">
                      <ChevronRight size={16} className="check-icon" />
                      <span>시스템 설정 관리</span>
                    </div>
                    <div className="feature-item">
                      <ChevronRight size={16} className="check-icon" />
                      <span>전체 데이터 삭제</span>
                    </div>
                  </div>
                </ComparisonColumn>
              </ComparisonTable>
            </WorkflowSection>

            <TipBox>
              <Lightbulb size={20} className="tip-icon" />
              <div className="tip-content">
                <strong>현재 로그인: {isAdmin ? '관리자' : '일반 사용자'}</strong><br/>
                {isAdmin
                  ? '관리자 권한으로 모든 기능을 사용할 수 있습니다.'
                  : '각 항목 편집 후 "저장 및 서버 업로드" 버튼으로 변경 사항을 즉시 서버에 반영하세요.'}
              </div>
            </TipBox>
          </StepContent>
        );

      case 'views':
        return (
          <StepContent
            key="views"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <WorkflowSection>
              <h3>
                <BarChart3 size={20} color="#3b82f6" />
                화면 전환
              </h3>
              <FeatureGrid>
                <FeatureCard iconBg="#eff6ff" iconColor="#2563eb">
                  <div className="feature-icon">
                    <BarChart3 size={20} />
                  </div>
                  <div className="feature-content">
                    <h4>대시보드</h4>
                    <p>사업부별 현황, 성과 분류, 월별 추이 등 전체 현황을 한눈에 파악할 수 있는 시각화 화면입니다.</p>
                  </div>
                </FeatureCard>

                <FeatureCard iconBg="#eff6ff" iconColor="#2563eb">
                  <div className="feature-icon">
                    <Calendar size={20} />
                  </div>
                  <div className="feature-content">
                    <h4>과제 진행 현황</h4>
                    <p>간트 차트 형태로 과제별 일정과 진행 상태를 확인하고 관리할 수 있습니다. (현재 화면)</p>
                  </div>
                </FeatureCard>

                <FeatureCard iconBg="#dcfce7" iconColor="#16a34a">
                  <div className="feature-icon">
                    <HardDrive size={20} />
                  </div>
                  <div className="feature-content">
                    <h4>로컬 파일</h4>
                    <p>JSON 파일로 내 컴퓨터에 저장하거나, 저장된 파일을 불러올 수 있습니다. 개인 백업용으로 활용하세요.</p>
                  </div>
                </FeatureCard>

                <FeatureCard iconBg="#dbeafe" iconColor="#2563eb">
                  <div className="feature-icon">
                    <Cloud size={20} />
                  </div>
                  <div className="feature-content">
                    <h4>서버 데이터</h4>
                    <p>서버에서 최신 데이터를 불러오거나(모두), 변경 사항을 서버에 반영할 수 있습니다(관리자).</p>
                  </div>
                </FeatureCard>
              </FeatureGrid>
            </WorkflowSection>

            <TipBox>
              <Lightbulb size={20} className="tip-icon" />
              <div className="tip-content">
                <strong>빠른 화면 전환!</strong><br/>
                헤더 우측의 <strong>"대시보드"</strong>와 <strong>"과제 진행 현황"</strong> 버튼으로 언제든 화면을 전환할 수 있습니다.
              </div>
            </TipBox>
          </StepContent>
        );

      case 'settings':
        return (
          <StepContent
            key="settings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <WorkflowSection>
              <h3>
                <Settings size={20} color="#3b82f6" />
                설정 및 관리
              </h3>
              <FeatureGrid>
                <FeatureCard iconBg="#fef2f2" iconColor="#dc2626" highlight={isAdmin}>
                  <div className="feature-icon">
                    <Settings size={20} />
                  </div>
                  <div className="feature-content">
                    <h4>
                      시스템 설정
                      <RoleBadge admin>관리자</RoleBadge>
                    </h4>
                    <p>사업부, 부서, 프로세스, 과제 구분, 성과 분류 등 시스템 기본 항목을 설정합니다.</p>
                  </div>
                </FeatureCard>

                <FeatureCard iconBg="#e0f2fe" iconColor="#0369a1">
                  <div className="feature-icon">
                    <FileText size={20} />
                  </div>
                  <div className="feature-content">
                    <h4>최근 수정 사항</h4>
                    <p>과제 및 성과의 생성, 수정, 삭제 이력을 확인할 수 있습니다. 변경 추적에 활용하세요.</p>
                  </div>
                </FeatureCard>

                {/* 2026-07-31 컷오버 — '스냅샷 관리' 카드를 뺐다. 메뉴를 내렸기 때문이다.
                    되돌리기는 '최근 수정 사항'(필드 단위 이력)이, 재해 복구는 DB 덤프가 맡는다. */}

                <FeatureCard iconBg="#fef2f2" iconColor="#dc2626" highlight={isAdmin}>
                  <div className="feature-icon">
                    <Database size={20} />
                  </div>
                  <div className="feature-content">
                    <h4>
                      여러 데이터 추가
                      <RoleBadge admin>관리자</RoleBadge>
                    </h4>
                    <p>Excel/JSON 파일을 통해 여러 과제와 성과를 한 번에 등록할 수 있습니다.</p>
                  </div>
                </FeatureCard>
              </FeatureGrid>
            </WorkflowSection>

            <TipBox>
              <Lightbulb size={20} className="tip-icon" />
              <div className="tip-content">
                <strong>설정 메뉴 접근!</strong><br/>
                헤더 우측의 <strong>"설정"</strong> 버튼을 클릭하면 시스템 설정, 최근 수정 사항에 접근할 수 있습니다.
              </div>
            </TipBox>
          </StepContent>
        );

      default:
        return null;
    }
  };

  return (
    <GuideOverlay
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <GuideContainer
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        <GuideHeader>
          <h1>
            <Lightbulb size={28} />
            Digital Twin Dashboard 시작 가이드
            <span className="user-badge">
              {isAdmin ? <Shield size={14} /> : <Users size={14} />}
              {isAdmin ? '관리자' : '일반 사용자'}
            </span>
          </h1>
          <p>
            처음 사용하시나요? 주요 기능과 사용 방법을 안내해 드립니다.
          </p>
        </GuideHeader>

        <GuideContent>
          <StepIndicator>
            {GUIDE_STEPS.map((step, index) => (
              <StepDot
                key={step.id}
                active={index === currentStep}
                completed={index < currentStep}
                onClick={() => setCurrentStep(index)}
                title={step.title}
              />
            ))}
          </StepIndicator>

          <AnimatePresence mode="wait">
            {renderStepContent()}
          </AnimatePresence>
        </GuideContent>

        <GuideFooter>
          <DismissCheckbox>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            다시 보지 않기
          </DismissCheckbox>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <NavButton className="skip" onClick={handleDismiss}>
              건너뛰기
            </NavButton>

            {currentStep > 0 && (
              <NavButton className="secondary" onClick={handlePrev}>
                <ChevronLeft size={18} />
                이전
              </NavButton>
            )}

            <NavButton className="primary" onClick={handleNext}>
              {currentStep === GUIDE_STEPS.length - 1 ? (
                <>
                  시작하기
                  <ChevronRight size={18} />
                </>
              ) : (
                <>
                  다음
                  <ChevronRight size={18} />
                </>
              )}
            </NavButton>
          </div>
        </GuideFooter>
      </GuideContainer>
    </GuideOverlay>
  );
};

export default EmptyStateGuide;
