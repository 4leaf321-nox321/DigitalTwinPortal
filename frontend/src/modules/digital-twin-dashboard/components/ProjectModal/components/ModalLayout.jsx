import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import { X, Plus, Save, Cloud, Copy, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { useAuth } from '../../../../../contexts/AuthContext';

/*
 * 탭 UI (선택적)
 *
 * `tabs` prop 을 주면 섹션들을 탭으로 나눠 보여준다. 주지 않으면 기존처럼
 * 세로로 이어 붙인다 — 새 과제 추가 화면은 그대로 두기 위한 하위 호환이다.
 *
 * 비활성 탭도 **언마운트하지 않고 CSS 로 숨긴다.** 언마운트하면
 *   - 섹션 안의 입력 중이던 로컬 상태(성과 입력폼 등)가 사라지고
 *   - 탭을 옮길 때마다 첨부파일 목록을 다시 불러오게 된다.
 */
const TabBar = styled.div`
  display: flex;
  gap: 0.25rem;
  padding: 0 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  background: #fafafa;
  overflow-x: auto;

  @media (max-width: 768px) {
    padding: 0 0.75rem;
  }
`;

const TabButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.75rem 1rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: ${props => (props.$active ? 600 : 500)};
  color: ${props => (props.$active ? '#4f46e5' : '#6b7280')};
  border-bottom: 2px solid ${props => (props.$active ? '#4f46e5' : 'transparent')};
  white-space: nowrap;
  transition: color 0.15s ease, border-color 0.15s ease;

  &:hover {
    color: ${props => (props.$active ? '#4f46e5' : '#374151')};
  }

  @media (max-width: 768px) {
    padding: 0.625rem 0.75rem;
    font-size: 0.8125rem;
  }
`;

const TabCount = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.375rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 600;
  background: ${props => (props.$active ? '#e0e7ff' : '#e5e7eb')};
  color: ${props => (props.$active ? '#4338ca' : '#6b7280')};
`;

const TabAlert = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 700;
  background: #fee2e2;
  color: #dc2626;
`;

const TabPanel = styled.div`
  display: ${props => (props.$active ? 'block' : 'none')};
`;

const ModalOverlay = styled(motion.div)`
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
  z-index: 1000;
  padding: 1rem;
  
  @media (max-width: 768px) {
    padding: 0.5rem;
    align-items: flex-start;
    padding-top: 1rem;
  }
  
  @media (max-width: 480px) {
    padding: 0;
    align-items: stretch;
  }
`;

const ModalContainer = styled(motion.div)`
  background: white;
  border-radius: 1rem;
  width: 90vw;
  /*
   * 탭을 쓸 때는 높이를 고정한다.
   * height:auto 로 두면 탭을 옮길 때마다 모달이 커졌다 작아졌다 해서
   * 화면이 출렁이고, 내용이 길면 위쪽(헤더·탭)이 잘려 보인다.
   */
  height: ${props => (props.$fixedHeight ? '88vh' : 'auto')};
  max-width: 1800px;
  max-height: 90vh;
  min-height: 300px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
  display: flex;
  flex-direction: column;

  @media (max-width: 1024px) {
    width: 90vw;
    height: ${props => (props.$fixedHeight ? '85vh' : 'auto')};
    max-height: 85vh;
  }

  @media (max-width: 768px) {
    width: calc(100vw - 1rem);
    height: ${props => (props.$fixedHeight ? 'calc(100vh - 2rem)' : 'auto')};
    max-height: calc(100vh - 2rem);
    border-radius: 0.5rem;
    min-height: auto;
  }

  @media (max-width: 480px) {
    width: 100vw;
    height: ${props => (props.$fixedHeight ? '100vh' : 'auto')};
    max-height: 100vh;
    border-radius: 0;
    min-height: auto;
  }
`;

/*
 * form 이 flex 컨테이너여야 ModalBody 의 flex:1 이 실제로 동작한다.
 * 예전에는 form 이 그냥 블록이라 ModalBody 가 calc(90vh - 200px) 라는
 * 하드코딩 높이에 의존했고, 탭 바가 추가되자 그 200px 가정이 깨져
 * 내용이 컨테이너를 넘치면서 헤더·탭이 잘렸다.
 */
const ModalForm = styled.form`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
`;

const ModalHeader = styled.div`
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  padding: 1.5rem 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  
  .title {
    font-size: 1.25rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .close-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    border-radius: 0.5rem;
    color: white;
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    
    &:hover {
      background: rgba(255, 255, 255, 0.3);
      transform: scale(1.05);
    }
  }
  
  @media (max-width: 768px) {
    padding: 1rem 1.5rem;
    
    .title {
      font-size: 1.1rem;
    }
    
    .close-btn {
      width: 2rem;
      height: 2rem;
    }
  }
  
  @media (max-width: 480px) {
    padding: 1rem;
  }
`;

const ModalBody = styled.div`
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  /* 높이는 flex 가 정한다. 하드코딩 max-height 를 쓰면 헤더·탭 높이가 바뀔 때마다 어긋난다 */
  min-height: 0;

  &::-webkit-scrollbar {
    width: 12px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 6px;
    margin: 4px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #10b981;
    border-radius: 6px;
    border: 2px solid #f1f5f9;
    
    &:hover {
      background: #059669;
    }
    
    &:active {
      background: #047857;
    }
  }
  
  scrollbar-width: thin;
  scrollbar-color: #10b981 #f1f5f9;
  
  @media (max-width: 1024px) {
    max-height: calc(85vh - 180px);
  }
  
  @media (max-width: 768px) {
    padding: 1.5rem;
    gap: 1.5rem;
    max-height: calc(100vh - 160px);
    
    &::-webkit-scrollbar {
      width: 8px;
    }
  }
  
  @media (max-width: 480px) {
    padding: 1rem;
    gap: 1rem;
    max-height: calc(100vh - 140px);
    
    &::-webkit-scrollbar {
      width: 6px;
    }
  }
`;

/* 기본정보 + 담당정보를 나란히 놓는 컨테이너. 탭 안에서도 쓰라고 내보낸다. */
export const HorizontalSectionsContainer = styled.div`
  display: flex;
  gap: 2rem;
  align-items: flex-start;

  > * {
    flex: 1;
    min-width: 0;
  }

  @media (max-width: 900px) {
    flex-direction: column;
    gap: 1.5rem;

    > * {
      width: 100%;
    }
  }

  @media (max-width: 768px) {
    gap: 1rem;
  }
`;

const ModalFooter = styled.div`
  padding: 1.5rem 2rem;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  background: #f9fafb;
  flex-shrink: 0;
  
  @media (max-width: 768px) {
    padding: 1rem 1.5rem;
    gap: 0.75rem;
  }
  
  @media (max-width: 480px) {
    padding: 1rem;
    flex-direction: column-reverse;
    gap: 0.5rem;
  }
`;

const Button = styled.button`
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  white-space: nowrap;
  
  &.secondary {
    background: #f3f4f6;
    color: #374151;
    border: 2px solid #d1d5db;
    
    &:hover {
      background: #e5e7eb;
      border-color: #9ca3af;
    }
  }
  
  &.primary {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: 2px solid transparent;

    &:hover {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
  }

  &.primary-upload {
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: white;
    border: 2px solid transparent;

    &:hover {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
  }

  @media (max-width: 768px) {
    padding: 0.625rem 1.25rem;
    font-size: 0.8rem;
  }
  
  @media (max-width: 480px) {
    width: 100%;
    padding: 0.75rem;
  }
`;

const NavArrowButton = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  border: 2px solid #e5e7eb;
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

  &:hover {
    background: white;
    border-color: #10b981;
    color: #10b981;
    transform: translateY(-50%) scale(1.1);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: translateY(-50%) scale(0.95);
  }

  &.nav-left {
    left: 0.5rem;
  }

  &.nav-right {
    right: 0.5rem;
  }

  @media (max-width: 768px) {
    width: 36px;
    height: 36px;

    &.nav-left {
      left: 0.25rem;
    }

    &.nav-right {
      right: 0.25rem;
    }
  }
`;

const NavInfo = styled.span`
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
  margin-left: 0.75rem;
`;

const ModalLayout = ({
  children, handleClose, currentYear, formYear, handleSubmit, handleSubmitAndUpload,
  handleSaveAndStay,
  handleSaveAsNew, onExportToPPT, isEditMode = false, onNavigatePrev, onNavigateNext, navInfo,
  // 탭 UI (선택) — 주지 않으면 기존처럼 세로로 이어 붙인다
  tabs, activeTab, onTabChange,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.is_admin;

  // formYear가 있으면 formYear 사용, 없으면 currentYear 사용
  const displayYear = formYear || currentYear;
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStartPos, setDragStartPos] = React.useState({ x: 0, y: 0 });
  const [showConfirmModal, setShowConfirmModal] = React.useState(false);

  const handleMouseDown = (e) => {
    setIsDragging(false);
    setDragStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e) => {
    if (dragStartPos.x !== 0 || dragStartPos.y !== 0) {
      const distance = Math.sqrt(
        Math.pow(e.clientX - dragStartPos.x, 2) + Math.pow(e.clientY - dragStartPos.y, 2)
      );
      // 5픽셀 이상 이동하면 드래그로 간주
      if (distance > 5) {
        setIsDragging(true);
      }
    }
  };

  const handleMouseUp = (e) => {
    // 드래그가 아니고, 오버레이를 직접 클릭한 경우에만 모달 닫기 확인
    if (!isDragging && e.target === e.currentTarget) {
      setShowConfirmModal(true);
    }
    setIsDragging(false);
    setDragStartPos({ x: 0, y: 0 });
  };

  const handleCloseClick = () => {
    setShowConfirmModal(true);
  };

  const handleConfirmClose = () => {
    setShowConfirmModal(false);
    handleClose();
  };

  const handleCancelClose = () => {
    setShowConfirmModal(false);
  };
  return (
    <ModalOverlay
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {isEditMode && onNavigatePrev && (
        <NavArrowButton
          className="nav-left"
          onClick={(e) => { e.stopPropagation(); onNavigatePrev(); }}
          title="이전 과제"
        >
          <ChevronLeft size={24} />
        </NavArrowButton>
      )}
      {isEditMode && onNavigateNext && (
        <NavArrowButton
          className="nav-right"
          onClick={(e) => { e.stopPropagation(); onNavigateNext(); }}
          title="다음 과제"
        >
          <ChevronRight size={24} />
        </NavArrowButton>
      )}
      <ModalContainer
        $fixedHeight={Boolean(tabs && tabs.length > 0)}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 500 }}
      >
        <ModalHeader>
          <div className="title">
            {isEditMode ? (
              <>
                <Save size={20} />
                과제 편집 ({displayYear}년)
                {navInfo && <NavInfo>{navInfo.current} / {navInfo.total}</NavInfo>}
              </>
            ) : (
              <>
                <Plus size={20} />
                새 과제 추가 ({displayYear}년)
              </>
            )}
          </div>
          <button className="close-btn" onClick={handleCloseClick}>
            <X size={18} />
          </button>
        </ModalHeader>

        {tabs && tabs.length > 0 && (
          <TabBar role="tablist">
            {tabs.map(tab => {
              const active = tab.key === activeTab;
              return (
                <TabButton
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  $active={active}
                  onClick={() => onTabChange && onTabChange(tab.key)}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.errorCount > 0 ? (
                    <TabAlert title={`입력이 필요한 항목 ${tab.errorCount}개`}>!</TabAlert>
                  ) : (
                    tab.count > 0 && <TabCount $active={active}>{tab.count}</TabCount>
                  )}
                </TabButton>
              );
            })}
          </TabBar>
        )}

        {/*
          `noValidate` — 브라우저 기본 검증을 끈다. (2026-08-02)

          왜  브라우저 검증은 **앱 검증(validateForm)보다 먼저** 돌고, 걸리면 submit 자체를
              취소해 `handleSubmit` 이 아예 안 불린다. 그런데 이 폼은 탭으로 나뉘어 있어서
              문제의 입력칸이 **접힌 탭 안에 있으면 브라우저가 포커스를 못 준다** — 그러면
              오류 말풍선도 못 띄우고 콘솔에
              `An invalid form control with name='' is not focusable` 만 남긴다.
              사용자에게는 **저장 버튼이 아무 반응 없는 것**으로 보인다.

              실제로 그랬다(2026-08-02): 액션아이템 '생성 날짜'의 max 가 UTC 기준이라
              KST 새벽에 하루 밀렸고, 그것 때문에 저장이 통째로 막혔다. 날짜 버그는
              고쳤지만(utils/localDate.js) **같은 함정이 남아 있는 한 또 생긴다** —
              목표일·완료일의 min/max(과제년도 범위)도 옛 데이터에서는 벗어날 수 있다.

          대신  검증은 `validateForm` 한 곳으로 모은다. 거기는 오류를 `errors` 로 돌려주고
                `focusFirstErrorTab` 이 **숨은 탭까지 열어서** 보여준다 — 침묵하지 않는다.

          ⚠️ 이 폼의 `required` 5개(사업부·프로세스·과제구분·과제명·과제PL)는 전부
             `validateForm` 이 이미 검사한다. 확인하고 껐다 — 새 필수 항목을 추가할 때는
             `required` 만 붙이지 말고 **반드시 validateForm 에도 넣어야 한다.**
        */}
        <ModalForm onSubmit={handleSubmit} noValidate>
          <ModalBody>
            {tabs && tabs.length > 0 ? (
              // 비활성 탭도 마운트는 유지한다 (입력 중이던 상태·불러온 목록 보존)
              tabs.map(tab => (
                <TabPanel key={tab.key} $active={tab.key === activeTab} role="tabpanel">
                  {tab.content}
                </TabPanel>
              ))
            ) : (
              <>
                <HorizontalSectionsContainer>
                  {children[0]} {/* BasicInfoSection */}
                  {children[1]} {/* ResponsibleInfoSection */}
                </HorizontalSectionsContainer>
                {children.slice(2)} {/* 나머지 모든 섹션들 */}
              </>
            )}
          </ModalBody>

          <ModalFooter>
            <Button type="button" className="secondary" onClick={handleCloseClick}>
              취소
            </Button>
            {isEditMode && onExportToPPT && (
              <Button
                type="button"
                className="secondary"
                onClick={onExportToPPT}
                title="현재 과제 내용을 PPT 보고서로 저장합니다."
              >
                <FileText size={16} />
                보고서 저장
              </Button>
            )}
            {/*
              2026-08-01 저장 버튼을 **하나로 합쳤다.**

              전에는 '변경 저장'(로컬 전용, admin 만 보임)과 '과제 저장 및 서버 업로드'(서버)
              둘이 나란히 있었다. 로컬 전용 쪽은 "여러 건 모아뒀다가 '서버에 저장' 메뉴로
              일괄 업로드" 하는 워크플로를 위한 것이었는데, **컷오버로 그 메뉴를 내려서
              회수 경로가 사라졌다.** 그대로 두면 admin 이 저장을 누르고 성공 메시지를 본 뒤
              새로고침하면 조용히 사라진다.

              form 의 `onSubmit` 자체를 서버 경로로 돌렸으므로(각 모달의 `handleSubmit`)
              이 submit 버튼도, **입력칸에서 Enter 를 누르는 것도** 서버로 간다.
            */}
            {isAdmin && isEditMode && handleSaveAsNew && (
              <Button
                type="button"
                className="secondary"
                onClick={handleSaveAsNew}
                title="입력한 내용으로 새 과제를 만듭니다. 서버에 저장되어 모든 사용자와 공유됩니다."
              >
                <Copy size={16} />
                다른 이름으로 저장
              </Button>
            )}
            {/*
              '저장 후 계속' — 저장하고 **창을 닫지 않는다** (관리자 전용, 2026-08-07).

              옆의 '변경 저장' 은 저장 뒤 닫힌다. 그래서 이전/다음 과제로 넘겨 가며
              여러 건을 손볼 때, 한 건마다 목록으로 나갔다 다시 들어와야 했다.
              저장 경로는 '변경 저장' 과 **같다** — 닫느냐 마느냐만 다르다.
            */}
            {isAdmin && isEditMode && handleSaveAndStay && (
              <Button
                type="button"
                className="secondary"
                onClick={handleSaveAndStay}
                title="저장하고 이 창을 그대로 둡니다. 이전/다음 과제로 넘겨 가며 이어서 고칠 때 쓰세요."
              >
                <Cloud size={16} />
                저장 후 계속
              </Button>
            )}
            <Button
              type="submit"
              className="primary-upload"
              title="서버에 저장되어 모든 사용자와 공유됩니다. 저장 후 창이 닫힙니다."
            >
              <Cloud size={16} />
              {isEditMode ? '변경 저장' : '과제 추가'}
            </Button>
          </ModalFooter>
        </ModalForm>
      </ModalContainer>
      
      <ConfirmModal
        isOpen={showConfirmModal}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
        title="창 닫기 확인"
        message="작성 중인 내용이 손실될 수 있습니다. 정말로 창을 닫으시겠습니까?"
        confirmText="닫기"
        cancelText="취소"
        isDanger={true}
      />
    </ModalOverlay>
  );
};

export default ModalLayout;
