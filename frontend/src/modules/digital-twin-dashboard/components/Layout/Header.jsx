import React, { useState, useEffect, useRef } from 'react';
import { Activity, BarChart3, Bell, Calendar, CalendarRange, Plus, Settings, Download, Upload, FileText, Database, Trash2, Target, Camera, HardDrive, ChevronDown, Clock, Cloud, FolderArchive, Percent, UserCheck, RefreshCw, Mail } from 'lucide-react';
import { CommonHeader } from '../../../../shared/components/Header';
import VisibilityScopeToggle from '../../../../shared/components/VisibilityScopeToggle';
import { useAuth } from '../../../../contexts/AuthContext';

const Header = ({
  onGoHome,
  viewMode = 'dashboard',
  onViewModeChange,
  dashboardSubTab = 'overview',
  onDashboardSubTabChange,
  onAddProject,
  onAddMultipleProjects,
  onAddPerformance,
  onEditContributions,
  onManageSettings,
  onExportData,
  onImportData,
  onClearAllData,
  onClearLocalCache,
  onLoadSampleData,
  onManageSnapshots,
  onViewActivityLog,
  onServerUpload,
  onServerDownload,
  onShowAllProjects,
  onDownloadAllAttachments,
  onBackfillAllCreatedAt,
  onAuditMembers,
  onAuditOwnerLinks,
  onMailRecipients,
  onGenerateReport,
  onGeneratePdfReport,
  // 「내 일」 — null 이면 버튼을 안 그린다(viewer 등 목록이 성립하지 않는 사람)
  worklistCount = null,
  onOpenWorklist,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.is_admin;
  // Admin, Manager, DT Office 권한은 설정에 접근 가능
  const canAccessSettings = ['admin', 'manager', 'dt_office'].includes(user?.role) || user?.is_admin;
  // 서버의 `permissions.GLOBAL_EDIT_ROLES` 와 **같은 조건**이어야 한다.
  // 위 `isAdmin` 은 dt_office 를 빼먹는데, 사무국이 바로 그 역할이다.
  const canManageMembers = ['admin', 'dt_office'].includes(user?.role) || user?.is_admin;

  const [isLocalDataDropdownOpen, setIsLocalDataDropdownOpen] = useState(false);
  const [isSettingsDropdownOpen, setIsSettingsDropdownOpen] = useState(false);
  const [isServerDataDropdownOpen, setIsServerDataDropdownOpen] = useState(false);
  const localDataDropdownRef = useRef(null);
  const settingsDropdownRef = useRef(null);
  const serverDataDropdownRef = useRef(null);

  // 통계 데이터 (현재 사용 안함)
  const statsData = [];

  const handleClearAllData = () => {
    onClearAllData && onClearAllData();
  };

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (localDataDropdownRef.current && !localDataDropdownRef.current.contains(event.target)) {
        setIsLocalDataDropdownOpen(false);
      }
      if (settingsDropdownRef.current && !settingsDropdownRef.current.contains(event.target)) {
        setIsSettingsDropdownOpen(false);
      }
      if (serverDataDropdownRef.current && !serverDataDropdownRef.current.contains(event.target)) {
        setIsServerDataDropdownOpen(false);
      }
    };

    if (isLocalDataDropdownOpen || isSettingsDropdownOpen || isServerDataDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLocalDataDropdownOpen, isSettingsDropdownOpen, isServerDataDropdownOpen]);

  // 중앙 액션 버튼들
  const centerContent = (
    <div className="header-center-content">
      {/* Dashboard Sub Tabs - 대시보드 모드일 때만 좌측에 표시 */}
      {viewMode === 'dashboard' && (
        <div className="dashboard-sub-tabs">
          <button
            className={`sub-tab featured ${dashboardSubTab === 'executive' ? 'active' : ''}`}
            onClick={() => onDashboardSubTabChange && onDashboardSubTabChange('executive')}
          >
            전체 요약
          </button>
          <button
            className={`sub-tab ${dashboardSubTab === 'overview' ? 'active' : ''}`}
            onClick={() => onDashboardSubTabChange && onDashboardSubTabChange('overview')}
          >
            종합 대시보드
          </button>
          <button
            className={`sub-tab ${dashboardSubTab === 'kpi' ? 'active' : ''}`}
            onClick={() => onDashboardSubTabChange && onDashboardSubTabChange('kpi')}
          >
            모든 성과 현황
          </button>
          <button
            className={`sub-tab ${dashboardSubTab === 'allProjects' ? 'active' : ''}`}
            onClick={() => onDashboardSubTabChange && onDashboardSubTabChange('allProjects')}
          >
            모든 과제 현황
          </button>
          <button
            className={`sub-tab ${dashboardSubTab === 'comparison' ? 'active' : ''}`}
            onClick={() => onDashboardSubTabChange && onDashboardSubTabChange('comparison')}
          >
            부서별 현황
          </button>
          <button
            className={`sub-tab ${dashboardSubTab === 'trend' ? 'active' : ''}`}
            onClick={() => onDashboardSubTabChange && onDashboardSubTabChange('trend')}
          >
            진행률 현황
          </button>
          <button
            className={`sub-tab ${dashboardSubTab === 'issues' ? 'active' : ''}`}
            onClick={() => onDashboardSubTabChange && onDashboardSubTabChange('issues')}
          >
            이슈 현황
          </button>
          <button
            className={`sub-tab ${dashboardSubTab === 'report' ? 'active' : ''}`}
            onClick={() => onDashboardSubTabChange && onDashboardSubTabChange('report')}
          >
            결과 보고서
          </button>
          {/*
            과제·성과 추이 — 날짜별로 과제가 얼마나 늘고 줄었나(편성·삭제 이력),
            성과 속성 카드의 값이 어떻게 쌓였나.
            ⚠️ 「진행률 현황」은 **월별 진행 과제**라 다른 화면이다. 이름을 「추이」로
               맞추면 둘이 헷갈리므로 무엇의 추이인지 붙여 둔다.
            ⚠️ 이름은 화면 안의 제목(TrendView 의 Title)과 **같아야 한다.**
          */}
          <button
            className={`sub-tab ${dashboardSubTab === 'trendHistory' ? 'active' : ''}`}
            onClick={() => onDashboardSubTabChange && onDashboardSubTabChange('trendHistory')}
            title="날짜별 사업부 과제 수와 성과 속성 카드 값의 변화"
          >
            과제·성과 추이
          </button>
          {/*
            관계도 — 과제·성과·KPI·사업부가 어떻게 엮여 있는지 한 장으로.
            예전 「지식 그래프 저장」(로컬 JSON · 서버 저장) 두 메뉴를 대신한다.
            그쪽은 저장 순간에 얼어붙는 스냅샷이었고, 이건 열 때마다 지금 값을 읽는다.
            ⚠️ 이름은 화면 안의 제목(GraphView 의 Title)과 **같아야 한다.**

            ★ **2026-08-11 전 사용자에게 열었다.** 그전에는 `isAdmin` 으로 가려 두었는데
              (2026-08-09, "아직 다듬는 중" 이라는 뜻이었다) 다듬기가 끝나 열었다.

              **API 는 원래부터 안 막혀 있었다.** 그래도 새지 않는다 — 서버가
              `can_view_project` 로 과제를 먼저 거르고 노드가 전부 거기서 파생되므로
              **누가 부르든 자기가 볼 수 있는 것만** 나온다. 버튼만 가려 뒀던 것이라
              이 조건을 지우는 것으로 개방이 끝난다.

              ⚠️ 이 화면 우측 패널에는 **사업부 비교**(`division_compare`)가 있다.
                 사업부를 줄 세우는 표라 계획서(§6-2)가 한 번 미뤄뒀던 분석인데,
                 여는 것으로 결정했다(2026-08-11). 「내 일」 화면에서는 **사무국
                 렌즈에만** 둔 것과는 다른 판단이니 헷갈리지 말 것.
          */}
          <button
            className={`sub-tab ${dashboardSubTab === 'graph' ? 'active' : ''}`}
            onClick={() => onDashboardSubTabChange && onDashboardSubTabChange('graph')}
            title="과제·성과·KPI·조직·사람이 어떻게 엮여 있는지 한 장으로"
          >
            관계도
          </button>
          {/*
            과제-KPI 연결 매트릭스. 오른쪽 끝에 두되 **생김새는 다른 탭과 같다** —
            예전엔 구분선·남색·아이콘으로 떼어 놨는데, 같은 줄의 탭인데 혼자 달라
            보이면 다른 종류의 버튼으로 읽힌다(2026-08-08 요청).
            ⚠️ 이름은 화면 안의 제목(KpiMatrixView 의 Title)과 **같아야 한다** —
               탭과 제목이 다르면 같은 화면인지 알 수가 없다.
          */}
          <button
            className={`sub-tab ${dashboardSubTab === 'kpiMatrix' ? 'active' : ''}`}
            onClick={() => onDashboardSubTabChange && onDashboardSubTabChange('kpiMatrix')}
            title="어떤 과제가 어떤 DX KPI 에 기여하는지 한 장으로 본다"
          >
            과제-KPI 연결
          </button>
        </div>
      )}

      {/* 새 과제 추가 버튼들 - 간트 뷰에서만 표시 */}
      {viewMode === 'gantt' && (
        <div className="header-gantt-actions">
          <div className="add-project-buttons">
            <button
              className="add-performance-btn"
              onClick={onAddPerformance}
              title="새 성과 추가"
            >
              <Target size={16} strokeWidth={2} />
              <span>새 성과 추가</span>
            </button>

            <button
              className="add-project-btn"
              onClick={onAddProject}
              title="새 과제 추가"
            >
              <Plus size={16} strokeWidth={2} />
              <span>새 과제 추가</span>
            </button>

            {isAdmin && (
              <button
                className="add-multiple-projects-btn"
                onClick={onAddMultipleProjects}
                title="여러 데이터 한번에 추가 (관리자 전용)"
              >
                <Database size={16} strokeWidth={2} />
                <span>여러 데이터 추가</span>
              </button>
            )}

            <button
              className="edit-contributions-btn"
              onClick={onEditContributions}
              title="성과별 과제 기여도 수정"
            >
              <Percent size={16} strokeWidth={2} />
              <span>기여도 수정</span>
            </button>
          </div>
          
          {/* 데이터 가져오기/내보내기 버튼들 */}
          <div className="import-export-buttons">
            {/* 샘플 데이터 버튼 비활성화
            {onLoadSampleData && (
              <button
                className="import-export-btn sample-btn"
                onClick={onLoadSampleData}
                title="샘플 데이터 불러오기"
              >
                <Database size={16} strokeWidth={2} />
                <span>샘플</span>
              </button>
            )}
            */}

            {/* 로컬 데이터 드롭다운 */}
            <div className="local-data-dropdown" ref={localDataDropdownRef}>
              <button
                className={`import-export-btn local-data-btn ${isLocalDataDropdownOpen ? 'open' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsLocalDataDropdownOpen(!isLocalDataDropdownOpen);
                }}
                title="로컬 데이터"
              >
                <HardDrive size={16} strokeWidth={2} />
                <span>로컬 데이터</span>
                <ChevronDown size={14} className="dropdown-icon" />
              </button>
              {isLocalDataDropdownOpen && (
                <div className="local-data-dropdown-menu">
                  <div
                    className="dropdown-menu-item"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onExportData();
                      setIsLocalDataDropdownOpen(false);
                    }}
                  >
                    <Download size={14} />
                    <span>로컬 저장</span>
                  </div>
                  <div
                    className="dropdown-menu-item"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onImportData();
                      setIsLocalDataDropdownOpen(false);
                    }}
                  >
                    <Upload size={14} />
                    <span>로컬 불러오기</span>
                  </div>
                  {/*
                    「지식 그래프 저장하기」(로컬 JSON) 를 내렸다 — 2026-08-09.
                    저장한 순간에 얼어붙는 스냅샷이라, 과제명을 바꿔도 옛 이름이
                    남았고 색·크기가 노드에 박혀 데이터가 아니라 그림이었다.
                    대시보드의 **「관계도」 탭**이 그 자리를 대신한다(항상 최신).
                  */}

                  {/*
                    로컬 캐시 비우기 — 옛 '전체 삭제'가 **실제로 하던 일**이 여기다.
                    이 브라우저의 사본(IndexedDB·localStorage)만 지우고 서버에서 다시 받는다.

                    왜 '로컬 데이터' 안에 두나
                        하는 일이 로컬 범위여서다. 서버를 건드리지 않으므로 관리자 전용도
                        아니다 — 자기 브라우저의 캐시는 누구나 고칠 수 있어야 한다.
                        (서버까지 지우는 것은 오른쪽의 '연도별 삭제'이고 그건 admin 전용이다)
                  */}
                  <div className="dropdown-menu-divider"></div>
                  <div
                    className="dropdown-menu-item"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onClearLocalCache && onClearLocalCache();
                      setIsLocalDataDropdownOpen(false);
                    }}
                    title="이 브라우저의 사본만 지우고 서버에서 다시 받습니다 (서버 데이터는 그대로)"
                  >
                    <RefreshCw size={14} />
                    <span>로컬 캐시 비우기</span>
                  </div>
                </div>
              )}
            </div>

            {/* 서버 데이터 드롭다운 */}
            <div className="server-data-dropdown" ref={serverDataDropdownRef}>
              <button
                className={`import-export-btn server-data-btn ${isServerDataDropdownOpen ? 'open' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsServerDataDropdownOpen(!isServerDataDropdownOpen);
                }}
                title="서버 데이터"
              >
                <Cloud size={16} strokeWidth={2} />
                <span>서버 데이터</span>
                <ChevronDown size={14} className="dropdown-icon" />
              </button>
              {isServerDataDropdownOpen && (
                <div className="server-data-dropdown-menu">
                  {/*
                    2026-07-31 V2 컷오버 — '서버에 저장'(수동 서버 업로드) 메뉴를 내렸다.

                    왜  이 경로는 화면이 들고 있는 **전체 배열을 통째로 덮어쓴다.** V2 대응이
                        없어서(dashboardWriteApi 의 saveManualUpsert/saveManualOverwrite)
                        컷오버 후 쓰면 dt2 가 아니라 낡은 V1 에 쓰이고, 덮어쓰기 모드는
                        남의 최신 과제까지 날릴 수 있다.
                    컷오버 후 저장은 전부 과제/성과 단위 API 를 지난다 — 이 버튼은 그 원칙의
                    유일한 예외였다.

                    ⚠️ 화면 진입점만 없앴다. `ServerUploadModal` 과 핸들러는 그대로 있다.
                  */}
                  <div
                    className="dropdown-menu-item"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onServerDownload && onServerDownload();
                      setIsServerDataDropdownOpen(false);
                    }}
                  >
                    <Download size={14} />
                    <span>서버로부터 불러오기</span>
                  </div>
                  {/*
                    「서버에 지식 그래프 저장」을 내렸다 — 2026-08-09.
                    이건 DT 데이터를 **다른 모듈(DX 업무 프로세스)의 그래프 편집기
                    표**(`dx_graphs`/`dx_nodes`/`dx_edges`)에 찍어 두는 것이었다.
                    저장 순간에 얼어붙고, 과제-성과 **또는** 과제-인력 둘 중 하나만
                    담겼다. 대시보드의 **「관계도」 탭**이 그 자리를 대신한다 —
                    저장하지 않고 열 때마다 dt2_* 를 읽는다.
                  */}
                </div>
              )}
            </div>

            {/*
              2026-08-02 '전체 삭제' → '연도별 삭제'.

              왜  옛 버튼은 로컬(IndexedDB/localStorage)만 비웠고, 확정은 '서버에 저장'
                  (수동 업로드)이 맡는 2단 동작이었다. 그 메뉴가 V2 컷오버 때 내려가면서
                  (바로 위 주석) **서버에 닿지 않는 버튼**이 됐다 — 새로고침하면 마운트
                  시 자동 다운로드가 그대로 되살려 놓는데, 화면은 "모든 데이터가
                  삭제되었습니다" 라고 말하고 확인창은 "되돌릴 수 없습니다" 라고 했다.
                  안 되는 것보다 **됐다고 믿게 만드는 것**이 문제였다.

              이제 서버의 연도별 일괄 삭제(POST /api/dt-v2/projects/bulk-delete)를 부른다.
              소프트 삭제라 같은 모달에서 연도 단위로 되살릴 수 있다.

              ⚠️ 이름을 바꾼 이유 — 이제 '전체'가 아니다. 전부 지우려면 모달에서 연도를
                 다 고르면 된다. '전체' 버튼을 남기면 한 번의 실수가 전 과제 삭제가 된다.

              ⚠️ `isAdmin` 은 admin 만이다(dt_office 제외). 서버도 같은 조건으로 막는다 —
                 여기만 좁히고 서버가 GLOBAL_EDIT_ROLES 면 API 로 우회된다.
            */}
            {isAdmin && (
              <button
                className="import-export-btn clear-btn"
                onClick={handleClearAllData}
                title="연도를 골라 과제를 삭제합니다 (관리자 전용)"
              >
                <Trash2 size={16} strokeWidth={2} />
                <span>연도별 삭제</span>
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );

  /*
    보기 토글은 **스크롤되는 줄 밖**에 둔다. (2026-08-10 요청)

    예전에는 가운데 줄 맨 끝에 있어서, 화면이 좁으면 탭에 밀려 스크롤 저편으로
    넘어갔다. 대시보드/간트를 오가는 것은 이 화면에서 가장 자주 하는 조작이라
    **늘 손이 닿는 자리**여야 한다 — 설정·홈과 같은 묶음으로 옮긴다.
  */
  const viewToggle = (
    <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <VisibilityScopeToggle />
      <div className="view-toggle">
        <button
          className={`toggle-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
          onClick={() => onViewModeChange('dashboard')}
          title="대시보드 뷰"
        >
          <BarChart3 size={16} strokeWidth={2} />
          <span>대시보드</span>
        </button>
        <button
          className={`toggle-btn ${viewMode === 'gantt' ? 'active' : ''}`}
          onClick={() => onViewModeChange('gantt')}
          title="간트 차트 뷰"
        >
          <Calendar size={16} strokeWidth={2} />
          <span>과제 진행 현황</span>
        </button>
      </div>
    </div>
  );

  /**
   * 「내 일」 종 버튼 (2026-08-11).
   *
   * ⚠️ **`viewMode` 와 무관하게 항상 같은 자리에 있다.** 대시보드 서브탭에 넣지 않은
   *    이유가 이것이다 — 기본 진입 화면은 간트이고, 서브탭은 대시보드 모드에서만
   *    그려져서 정작 사람들이 일하는 화면에서는 안 보인다.
   *
   * ⚠️ 배지는 **미처리 건수**다. 열어봤다고 줄지 않는다 — 줄어들면 숫자가 뜻을 잃는다.
   *    viewer 는 고칠 수 있는 게 없어 서버가 렌즈를 안 주므로 `worklistCount` 가
   *    null 로 오고, 그러면 버튼 자체를 안 그린다.
   */
  const worklistButton = (worklistCount === null || worklistCount === undefined) ? null : (
    <button
      className="header-btn action-btn"
      onClick={onOpenWorklist}
      title="내 일 — 지금 손대야 하는 것"
      style={{
        position: 'relative', marginRight: '0.75rem', display: 'flex',
        alignItems: 'center', gap: '0.375rem',
        backgroundColor: worklistCount > 0 ? '#ef4444' : '#ffffff',
        color: worklistCount > 0 ? '#ffffff' : '#475569',
        borderColor: worklistCount > 0 ? '#dc2626' : '#cbd5e1',
      }}
    >
      <Bell size={18} strokeWidth={2} />
      <span>내 일</span>
      {worklistCount > 0 && (
        <span style={{
          minWidth: '1.25rem', padding: '0 0.3rem', borderRadius: '999px',
          background: '#ffffff', color: '#b91c1c', fontSize: '0.72rem',
          fontWeight: 800, lineHeight: '1.15rem', textAlign: 'center',
        }}>{worklistCount}</span>
      )}
    </button>
  );

  // 설정 드롭다운 (홈 버튼 왼쪽에 표시) - Admin, Manager, DT Office 접근 가능
  const settingsButton = canAccessSettings ? (
    <div className="settings-dropdown-wrapper" ref={settingsDropdownRef}>
      <button
        className={`header-btn action-btn settings-dropdown-btn ${isSettingsDropdownOpen ? 'open' : ''}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsSettingsDropdownOpen(!isSettingsDropdownOpen);
        }}
        title="설정 메뉴"
        style={{
          backgroundColor: '#8b5cf6',
          color: '#ffffff',
          borderColor: '#7c3aed',
          marginRight: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem'
        }}
      >
        <Settings size={18} strokeWidth={2} />
        <span>설정</span>
        <ChevronDown size={14} className="settings-dropdown-icon" />
      </button>
      {isSettingsDropdownOpen && (
        <div className="settings-dropdown-menu">
          <div
            className="settings-dropdown-item"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onViewActivityLog && onViewActivityLog();
              setIsSettingsDropdownOpen(false);
            }}
          >
            <Clock size={14} />
            <span>최근 수정 사항</span>
          </div>
          <div
            className="settings-dropdown-item"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onManageSettings();
              setIsSettingsDropdownOpen(false);
            }}
          >
            <Settings size={14} />
            <span>시스템 설정</span>
          </div>
          {/*
            2026-07-31 V2 컷오버 — '스냅샷 관리' 메뉴를 내렸다.

            왜  스냅샷은 `dashboard_data` JSON 을 통째로 복사하는 방식인데, 컷오버 후
                그 JSON 은 더 이상 정본이 아니다. 정본이 아닌 것을 복사해 두면 "복구했는데
                옛날 데이터로 돌아갔다" 가 된다.
            근거 운영 실측(scripts/dt3_snapshot_usage.py) — 전체 130건 중 사람이 만든 것은
                11건(upload 10 · manual 1)뿐이고 **전부 90일 이전**이다. 최근 90일 사람이
                만든 스냅샷 0건.
            대신 되돌리기는 `dt2_project_changes`(필드 단위 이력), 재해 복구는 DB 덤프가 맡는다.

            ⚠️ 화면 진입점만 없앴다. `SnapshotModal`·API·기존 130건은 그대로 있다 —
               되살리려면 이 블록만 되돌리면 된다.
          */}
          {isAdmin && (
            <>
              <div className="settings-dropdown-divider"></div>
              <div
                className="settings-dropdown-item"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onDownloadAllAttachments && onDownloadAllAttachments();
                  setIsSettingsDropdownOpen(false);
                }}
              >
                <FolderArchive size={14} />
                <span>모든 첨부파일 다운로드</span>
              </div>
              <div
                className="settings-dropdown-item"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onBackfillAllCreatedAt && onBackfillAllCreatedAt();
                  setIsSettingsDropdownOpen(false);
                }}
                title="모든 과제의 액션아이템/액티비티 중 생성 날짜가 없는 항목을 일괄로 채우고 서버에 업로드합니다"
              >
                <CalendarRange size={14} />
                <span>생성 날짜 일괄 채우기 (전체 과제)</span>
              </div>
            </>
          )}
          {/*
            2026-08-01 추가. **`isAdmin` 이 아니라 `canManageMembers` 로 건다.**
            서버(`GLOBAL_EDIT_ROLES`)는 admin·dt_office 를 허용하는데 이 파일의 `isAdmin` 은
            dt_office 를 빼먹는다. 참여인력 정리는 **사무국(dt_office) 업무**라, isAdmin 으로
            걸면 정작 쓸 사람이 메뉴를 못 본다.
          */}
          {canManageMembers && (
            <>
              {!isAdmin && <div className="settings-dropdown-divider"></div>}
              <div
                className="settings-dropdown-item"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAuditMembers && onAuditMembers();
                  setIsSettingsDropdownOpen(false);
                }}
                title="참여인력의 knoxId 가 계정과 연결됐는지 점검하고, 한 사람의 knoxId를 여러 과제에 일괄 반영합니다"
              >
                <UserCheck size={14} />
                <span>참여인력 계정 점검</span>
              </div>
              {/*
                과제PL·작성자는 참여인력과 **다른 칸**이라 위 화면으로는 못 고친다.
                운영에 이름만 적힌 과제가 많아 따로 열어 둔다 —
                과제PL 은 계정이 붙어야 **본인이 자기 과제를 고칠 수 있다.**
              */}
              <div
                className="settings-dropdown-item"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAuditOwnerLinks && onAuditOwnerLinks();
                  setIsSettingsDropdownOpen(false);
                }}
                title="이름만 있고 계정이 안 붙은 과제PL·작성자를 찾아 한 번에 연결합니다"
              >
                <UserCheck size={14} />
                <span>과제PL · 작성자 계정 연결</span>
              </div>
              {/* 메일 수신처 — 계정 연결과 같은 묶음에 둔다. 셋 다 「누가 이 과제
                  사람인가」를 다루고, 여기서 빠진 사람이 곧 위 두 화면의 할 일이다. */}
              <div
                className="settings-dropdown-item"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onMailRecipients && onMailRecipients();
                  setIsSettingsDropdownOpen(false);
                }}
                title="고른 과제의 과제PL·참여인력·작성자 knoxId 를 모아 줍니다"
              >
                <Mail size={14} />
                <span>메일 수신처 뽑기</span>
              </div>
            </>
          )}
          {canAccessSettings && (
            <>
              {!isAdmin && <div className="settings-dropdown-divider"></div>}
              <div
                className="settings-dropdown-item"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onGenerateReport && onGenerateReport();
                  setIsSettingsDropdownOpen(false);
                }}
              >
                <FileText size={14} />
                <span>PPT 보고서 저장</span>
              </div>
              <div
                className="settings-dropdown-item"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onGeneratePdfReport && onGeneratePdfReport();
                  setIsSettingsDropdownOpen(false);
                }}
                title="HTML 기반 자동 페이지네이션 PDF (분량 오버플로 없음)"
              >
                <FileText size={14} />
                <span>PDF 보고서 저장</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <CommonHeader
        logo={<Activity size={24} strokeWidth={2} />}
        title="Digital Twin Dashboard"
        titleColor="#0066cc"
        centerContent={centerContent}
        rightContent={<>{viewToggle}{worklistButton}{settingsButton}</>}
        statsData={statsData}
        onGoHome={onGoHome}
        className="digital-twin-dashboard-header"
      />
      
      {/* 추가 스타일 */}
      <style>{`
        /*
          화면이 좁으면 **가운데 줄이 옆으로 굴러간다.** (2026-08-10 요청)

          이 대시보드는 탭과 버튼이 계속 늘어서, 해상도가 낮으면 오른쪽 것부터
          잘려 나가 **누를 수도, 있는 줄도 몰랐다.** 공용 헤더는
          flex-shrink 0 · width max-content 라 줄어들지 않고 그대로 넘쳤다.

          그래서 **이 대시보드에서만** 줄어들 수 있게 풀고 가로 스크롤을 준다.
          공용 CSS 를 고치면 다른 모듈 헤더까지 한꺼번에 바뀌므로 건드리지 않는다.

          ⚠️ 안쪽 것들은 flex-shrink 0 이어야 한다 — 안 그러면 줄어들 뿐
             넘치지 않아서 **스크롤이 생기지 않는다.** (버튼만 찌그러진다)
        */
        .digital-twin-dashboard-header .header-right {
          /* 🐞 공용 CSS 가 flex-shrink 0 이라 이 묶음이 통째로 안 줄었다. 그래서
             남는 자리가 없어지면 **오른쪽 끝(설정·홈)이 화면 밖으로 밀려 잘렸고**,
             정작 스크롤은 그 뒤에야 생겼다. 줄어들 수 있게 풀어, 좁아지는 몫을
             가운데 줄이 받아 **먼저** 스크롤이 생기게 한다. */
          flex-shrink: 1 !important;
          min-width: 0;
        }

        /* 토글·설정·홈은 **절대 줄지 않는다.** 늘 손이 닿아야 하는 것들이라,
           좁아지는 몫은 전부 가운데 줄(스크롤되는 곳)이 받는다. */
        .digital-twin-dashboard-header .header-right > *:not(.header-center-content) {
          flex-shrink: 0;
        }
        .digital-twin-dashboard-header .header-right .header-btn,
        .digital-twin-dashboard-header .header-right .header-actions,
        .digital-twin-dashboard-header .header-right .settings-dropdown-wrapper {
          flex-shrink: 0;
        }

        .digital-twin-dashboard-header .header-center-content {
          flex-shrink: 1 !important;
          min-width: 0 !important;
          width: auto !important;
          overflow-x: auto !important;
          overflow-y: hidden;
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 transparent;
        }

        .digital-twin-dashboard-header .header-center-content > * {
          flex-shrink: 0;
        }

        /* 64px 짜리 머리줄이라 스크롤바가 두꺼우면 글자를 밀어낸다 */
        .digital-twin-dashboard-header .header-center-content::-webkit-scrollbar {
          height: 6px;
        }
        .digital-twin-dashboard-header .header-center-content::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .digital-twin-dashboard-header .header-center-content::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .digital-twin-dashboard-header .header-center-content::-webkit-scrollbar-track {
          background: transparent;
        }

        /* Header Center Content - 가로 배치 강제 */
        .header-center-content {
          display: flex !important;
          flex-direction: row !important;
          align-items: center !important;
          gap: 0 !important;
        }

        /* Dashboard Sub Tabs */
        .dashboard-sub-tabs {
          display: flex !important;
          flex-direction: row !important;
          flex-shrink: 0;          /* 찌그러지는 대신 넘쳐서 스크롤이 생기게 */
          align-items: center;
          gap: 0.5rem;
          margin-right: 1.5rem;
          padding-right: 1.5rem;
          border-right: 2px solid #e5e7eb;
        }

        .dashboard-sub-tabs .sub-tab {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.4rem 0.875rem;
          background: white;
          color: #6b7280;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .dashboard-sub-tabs .sub-tab:hover {
          background: #f9fafb;
          border-color: #9ca3af;
          color: #374151;
          transform: translateY(-1px);
        }

        .dashboard-sub-tabs .sub-tab.active {
          background: linear-gradient(135deg, #0066cc 0%, #0052a3 100%);
          color: white;
          border-color: #0066cc;
          font-weight: 600;
          box-shadow: 0 2px 4px rgba(0, 102, 204, 0.2);
        }

        .dashboard-sub-tabs .sub-tab.active:hover {
          background: linear-gradient(135deg, #0052a3 0%, #004080 100%);
          transform: translateY(-1px);
          box-shadow: 0 3px 6px rgba(0, 102, 204, 0.3);
        }

        /* '과제-KPI 연결' 은 2026-08-08 부터 **다른 탭과 같은 생김새**다.
           구분선·남색·아이콘을 떼었다 — 같은 줄의 탭인데 혼자 다르면 다른 종류의
           버튼으로 읽힌다. (되살리려면 sub-tab.kpi-matrix 규칙을 다시 넣고 버튼에
           그 class 를 붙이면 된다)
           ⚠️ 이 블록은 템플릿 리터럴 안이다 — **주석에도 백틱을 쓰지 말 것.**
              백틱 하나가 문자열을 끊고, 빌드는 통과한 뒤 런타임에만 터진다. */

        /* 추천 탭(전체 요약) 강조 - 비활성 상태에서도 눈에 띄도록 */
        .dashboard-sub-tabs .sub-tab.featured:not(.active) {
          background: linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%);
          color: #b45309;
          border-color: #f59e0b;
          font-weight: 700;
          box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.25);
        }

        .dashboard-sub-tabs .sub-tab.featured:not(.active)::before {
          content: '⭐';
          font-size: 0.75rem;
          line-height: 1;
        }

        .dashboard-sub-tabs .sub-tab.featured:not(.active):hover {
          background: linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%);
          border-color: #d97706;
          color: #92400e;
          transform: translateY(-1px);
        }

        .header-gantt-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .add-project-buttons {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-right: 0.75rem;
          margin-right: 0.75rem;
          border-right: 2px solid #e5e7eb;
        }

        .import-export-buttons {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding-right: 1.5rem;
          margin-right: 1.5rem;
          border-right: 2px solid #e5e7eb;
        }
        
        .import-export-btn {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.4rem 0.875rem;
          border: 1px solid;
          border-radius: 0.375rem;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          background: white;
          white-space: nowrap;
        }

        /* 로컬 데이터 드롭다운 */
        .local-data-dropdown {
          position: relative;
        }

        .local-data-btn {
          color: #059669;
          border-color: #059669;
          background: white;
          position: relative;
        }

        .local-data-btn .dropdown-icon {
          margin-left: 0.25rem;
          transition: transform 0.2s ease;
        }

        .local-data-btn.open .dropdown-icon {
          transform: rotate(180deg);
        }

        .local-data-btn:hover {
          background: #f0fdf4;
          border-color: #047857;
          color: #047857;
          transform: translateY(-1px);
        }

        .local-data-btn.open {
          background: #f0fdf4;
          border-color: #047857;
          color: #047857;
        }

        .local-data-dropdown-menu {
          position: absolute;
          top: calc(100% + 0.25rem);
          left: 0;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          z-index: 1001;
          min-width: 150px;
          overflow: hidden;
        }

        .dropdown-menu-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          color: #374151;
          cursor: pointer;
          transition: background 0.2s ease;
          white-space: nowrap;
        }

        .dropdown-menu-item:hover {
          background: #f3f4f6;
        }

        .sample-btn {
          color: #8b5cf6;
          border-color: #8b5cf6;
          background: white;
        }

        .sample-btn:hover {
          background: #f5f3ff;
          border-color: #7c3aed;
          color: #7c3aed;
          transform: translateY(-1px);
        }

        .clear-btn {
          color: #ef4444;
          border-color: #ef4444;
          background: white;
        }

        .clear-btn:hover {
          background: #fef2f2;
          border-color: #dc2626;
          color: #dc2626;
          transform: translateY(-1px);
        }

        /* 서버 데이터 드롭다운 */
        .server-data-dropdown {
          position: relative;
        }

        .server-data-btn {
          color: #0066cc;
          border-color: #0066cc;
          background: white;
          position: relative;
        }

        .server-data-btn .dropdown-icon {
          margin-left: 0.25rem;
          transition: transform 0.2s ease;
        }

        .server-data-btn.open .dropdown-icon {
          transform: rotate(180deg);
        }

        .server-data-btn:hover {
          background: #e7f3ff;
          border-color: #0052a3;
          color: #0052a3;
          transform: translateY(-1px);
        }

        .server-data-btn.open {
          background: #e7f3ff;
          border-color: #0052a3;
          color: #0052a3;
        }

        .server-data-dropdown-menu {
          position: absolute;
          top: calc(100% + 0.25rem);
          left: 0;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          z-index: 1001;
          min-width: 200px;
          overflow: hidden;
        }

        .dropdown-menu-divider {
          height: 1px;
          background: #e5e7eb;
          margin: 0.25rem 0;
        }

        /* 설정 드롭다운 */
        .settings-dropdown-wrapper {
          position: relative;
        }

        .settings-dropdown-btn {
          position: relative;
        }

        .settings-dropdown-icon {
          transition: transform 0.2s ease;
        }

        .settings-dropdown-btn.open .settings-dropdown-icon {
          transform: rotate(180deg);
        }

        .settings-dropdown-btn.open {
          background: #7c3aed !important;
        }

        .settings-dropdown-menu {
          position: absolute;
          top: calc(100% + 0.25rem);
          right: 0;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          z-index: 1001;
          min-width: 160px;
          overflow: hidden;
        }

        .settings-dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          color: #374151;
          cursor: pointer;
          transition: background 0.2s ease;
          white-space: nowrap;
        }

        .settings-dropdown-item:hover {
          background: #f3f4f6;
        }

        .settings-dropdown-divider {
          height: 1px;
          background: #e5e7eb;
          margin: 0.25rem 0;
        }

        .add-performance-btn {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.4rem 0.875rem;
          background: white;
          color: #e11d48;
          border: 1px solid #e11d48;
          border-radius: 0.375rem;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .add-performance-btn:hover {
          background: #ffe4e6;
          border-color: #be123c;
          color: #be123c;
          transform: translateY(-1px);
        }

        .add-project-btn {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.4rem 0.875rem;
          background: white;
          color: #0066cc;
          border: 1px solid #0066cc;
          border-radius: 0.375rem;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .add-project-btn:hover {
          background: #eff6ff;
          border-color: #004499;
          color: #004499;
          transform: translateY(-1px);
        }

        .add-multiple-projects-btn {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.4rem 0.875rem;
          background: white;
          color: #8b5cf6;
          border: 1px solid #8b5cf6;
          border-radius: 0.375rem;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .add-multiple-projects-btn:hover {
          background: #f5f3ff;
          border-color: #7c3aed;
          color: #7c3aed;
          transform: translateY(-1px);
        }

        .edit-contributions-btn {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.4rem 0.875rem;
          background: white;
          color: #f59e0b;
          border: 1px solid #f59e0b;
          border-radius: 0.375rem;
          font-size: 0.8125rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .edit-contributions-btn:hover {
          background: #fffbeb;
          border-color: #d97706;
          color: #d97706;
          transform: translateY(-1px);
        }

        /* 반응형: 중간 화면 - 버튼 텍스트 숨기기 */
        @media (max-width: 1400px) {
          .header-gantt-actions .import-export-btn span,
          .header-gantt-actions .add-project-btn span,
          .header-gantt-actions .add-performance-btn span,
          .header-gantt-actions .add-multiple-projects-btn span,
          .header-gantt-actions .edit-contributions-btn span {
            display: none;
          }

          .header-gantt-actions .import-export-btn,
          .header-gantt-actions .add-project-btn,
          .header-gantt-actions .add-performance-btn,
          .header-gantt-actions .add-multiple-projects-btn,
          .header-gantt-actions .edit-contributions-btn {
            padding: 0.5rem;
          }

          .header-gantt-actions .import-export-btn .dropdown-icon {
            margin-left: 0;
          }

          .dashboard-sub-tabs .sub-tab {
            padding: 0.4rem 0.6rem;
            font-size: 0.75rem;
          }
        }

        /* 반응형: 작은 화면 - 대시보드 탭도 줄이기 */
        @media (max-width: 1200px) {
          .dashboard-sub-tabs {
            margin-right: 0.75rem;
            padding-right: 0.75rem;
            gap: 0.25rem;
          }

          .dashboard-sub-tabs .sub-tab {
            padding: 0.35rem 0.5rem;
            font-size: 0.7rem;
          }

          .add-project-buttons {
            padding-right: 0.5rem;
            margin-right: 0.5rem;
            gap: 0.25rem;
          }

          .import-export-buttons {
            padding-right: 0.75rem;
            margin-right: 0.75rem;
            gap: 0.25rem;
          }

          .view-toggle .toggle-btn span {
            display: none;
          }

          .view-toggle .toggle-btn {
            padding: 0.4rem 0.6rem;
          }
        }

        /* 반응형: 더 작은 화면 */
        @media (max-width: 1000px) {
          .header-gantt-actions {
            gap: 0.5rem;
          }

          .add-project-buttons,
          .import-export-buttons {
            border-right: none;
            padding-right: 0;
            margin-right: 0;
          }
        }
      `}</style>
    </>
  );
};

export default Header;