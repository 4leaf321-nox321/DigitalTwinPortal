import React, { useState, useEffect, useMemo } from 'react';
import {
  Cloud,
  Upload,
  Download,
  Trash2,
  Edit2,
  Save,
  X,
  RotateCw,
  Plus,
  AlertCircle,
  Globe,
  Lock,
  User,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2
} from 'lucide-react';
import Modal from '../../../../shared/components/Modal/Modal';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  fetchMyGraphs,
  fetchMyGraph,
  createGraph,
  updateGraph,
  deleteGraph,
  saveGraphData,
  fetchPublicGraphs,
  fetchPublicGraph
} from '../../services/graphApi';
import './ServerSyncModal.css';

const ServerSyncModal = ({
  isOpen,
  onClose,
  currentGraphData,
  typeSettings,
  onLoadFromServer,
  showError,
  showSuccess,
  showInfo
}) => {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('my'); // 'my' | 'public'
  const [graphs, setGraphs] = useState([]);
  const [publicGraphs, setPublicGraphs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedGraph, setSelectedGraph] = useState(null);
  const [editingGraph, setEditingGraph] = useState(null);
  const [newGraphName, setNewGraphName] = useState('');
  const [newGraphIsPublic, setNewGraphIsPublic] = useState(false);
  const [showNewGraphInput, setShowNewGraphInput] = useState(false);
  const [savingTo, setSavingTo] = useState(null);

  // 검색 및 페이지네이션
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // 그래프 목록 불러오기
  const loadGraphs = async () => {
    setLoading(true);
    try {
      if (isAuthenticated()) {
        const graphList = await fetchMyGraphs();
        setGraphs(graphList || []);
      }

      // 공용 그래프는 로그인 여부와 상관없이 불러오기
      const publicList = await fetchPublicGraphs();
      setPublicGraphs(publicList || []);
    } catch (error) {
      console.error('그래프 목록 불러오기 실패:', error);
      if (showError) {
        showError(`그래프 목록을 불러오는데 실패했습니다: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 모달이 열릴 때 그래프 목록 불러오기
  useEffect(() => {
    if (isOpen) {
      loadGraphs();
      // 로그인하지 않은 경우 공용 탭으로 시작
      if (!isAuthenticated()) {
        setActiveTab('public');
      }
    }
  }, [isOpen]);

  // 탭 변경 시 검색어와 페이지 초기화
  useEffect(() => {
    setSearchQuery('');
    setCurrentPage(1);
  }, [activeTab]);

  // 필터링된 그래프 목록 (검색)
  const filteredGraphs = useMemo(() => {
    const sourceGraphs = activeTab === 'my' ? graphs : publicGraphs;
    if (!searchQuery.trim()) return sourceGraphs;

    const query = searchQuery.toLowerCase();
    return sourceGraphs.filter(graph =>
      graph.name.toLowerCase().includes(query)
    );
  }, [activeTab, graphs, publicGraphs, searchQuery]);

  // 페이지네이션 계산
  const paginationData = useMemo(() => {
    const totalItems = filteredGraphs.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedGraphs = filteredGraphs.slice(startIndex, endIndex);

    return {
      totalItems,
      totalPages,
      startIndex,
      endIndex: Math.min(endIndex, totalItems),
      paginatedGraphs
    };
  }, [filteredGraphs, currentPage, itemsPerPage]);

  // 페이지 변경
  const handlePageChange = (page) => {
    if (page >= 1 && page <= paginationData.totalPages) {
      setCurrentPage(page);
    }
  };

  // 검색어 변경 시 페이지 초기화
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  // 새 그래프 생성 및 저장
  const handleCreateAndSave = async () => {
    if (!newGraphName.trim()) {
      if (showError) showError('그래프 이름을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      // 1. 새 그래프 생성
      const newGraph = await createGraph({
        name: newGraphName.trim(),
        description: `노드 ${currentGraphData.nodes.length}개, 엣지 ${currentGraphData.edges.length}개`,
        is_public: newGraphIsPublic,
        settings: typeSettings
      });

      // 2. 데이터 저장
      await saveGraphData(newGraph.id, {
        nodes: currentGraphData.nodes,
        edges: currentGraphData.edges,
        settings: typeSettings
      });

      const publicText = newGraphIsPublic ? ' (공용)' : '';
      if (showSuccess) {
        showSuccess(`"${newGraphName}"${publicText} 그래프가 서버에 저장되었습니다!

📈 노드: ${currentGraphData.nodes.length}개
🔗 엣지: ${currentGraphData.edges.length}개`);
      }
      setNewGraphName('');
      setNewGraphIsPublic(false);
      setShowNewGraphInput(false);
      await loadGraphs();
    } catch (error) {
      console.error('그래프 저장 실패:', error);
      if (showError) {
        showError(`그래프 저장에 실패했습니다: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 기존 그래프에 덮어쓰기
  const handleSaveToExisting = async (graph) => {
    setSavingTo(graph.id);
    try {
      // 설정 업데이트
      await updateGraph(graph.id, {
        description: `노드 ${currentGraphData.nodes.length}개, 엣지 ${currentGraphData.edges.length}개`,
        settings: typeSettings
      });

      // 데이터 저장
      await saveGraphData(graph.id, {
        nodes: currentGraphData.nodes,
        edges: currentGraphData.edges,
        settings: typeSettings
      });

      if (showSuccess) {
        showSuccess(`"${graph.name}" 그래프가 업데이트되었습니다!

📈 노드: ${currentGraphData.nodes.length}개
🔗 엣지: ${currentGraphData.edges.length}개`);
      }
      await loadGraphs();
    } catch (error) {
      console.error('그래프 저장 실패:', error);
      if (showError) {
        showError(`그래프 저장에 실패했습니다: ${error.message}`);
      }
    } finally {
      setSavingTo(null);
    }
  };

  // 그래프 불러오기
  const handleLoadGraph = async (graph, isPublic = false) => {
    setLoading(true);
    try {
      const graphData = isPublic
        ? await fetchPublicGraph(graph.id, true)
        : await fetchMyGraph(graph.id, true);

      // 데이터 준비
      const loadedData = {
        nodes: graphData.nodes || [],
        edges: graphData.edges || []
      };

      const loadedSettings = graphData.settings || typeSettings;

      if (onLoadFromServer) {
        onLoadFromServer(loadedData, loadedSettings);
      }

      if (showSuccess) {
        showSuccess(`"${graph.name}" 그래프를 불러왔습니다!

📈 노드: ${loadedData.nodes.length}개
🔗 엣지: ${loadedData.edges.length}개`);
      }

      onClose();
    } catch (error) {
      console.error('그래프 불러오기 실패:', error);
      if (showError) {
        showError(`그래프를 불러오는데 실패했습니다: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 그래프 삭제
  const handleDeleteGraph = async (graph) => {
    if (!window.confirm(`"${graph.name}" 그래프를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    setLoading(true);
    try {
      await deleteGraph(graph.id);

      if (showInfo) {
        showInfo(`"${graph.name}" 그래프가 삭제되었습니다.`);
      }
      await loadGraphs();
    } catch (error) {
      console.error('그래프 삭제 실패:', error);
      if (showError) {
        showError(`그래프 삭제에 실패했습니다: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // 그래프 이름/공개 상태 수정
  const handleUpdateGraphName = async (graph, newName) => {
    if (!newName.trim() || newName === graph.name) {
      setEditingGraph(null);
      return;
    }

    try {
      await updateGraph(graph.id, { name: newName.trim() });
      await loadGraphs();
    } catch (error) {
      console.error('그래프 이름 수정 실패:', error);
      if (showError) {
        showError(`그래프 이름 수정에 실패했습니다: ${error.message}`);
      }
    } finally {
      setEditingGraph(null);
    }
  };

  // 공개 상태 토글
  const handleTogglePublic = async (graph) => {
    try {
      await updateGraph(graph.id, { is_public: !graph.is_public });
      await loadGraphs();

      const status = !graph.is_public ? '공용으로' : '비공개로';
      if (showInfo) {
        showInfo(`"${graph.name}" 그래프가 ${status} 변경되었습니다.`);
      }
    } catch (error) {
      console.error('공개 상태 변경 실패:', error);
      if (showError) {
        showError(`공개 상태 변경에 실패했습니다: ${error.message}`);
      }
    }
  };

  // 날짜 포맷팅
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 노드/엣지 수 파싱 (description에서)
  const parseGraphStats = (description) => {
    if (!description) return { nodes: '-', edges: '-' };
    const nodeMatch = description.match(/노드\s*(\d+)/);
    const edgeMatch = description.match(/엣지\s*(\d+)/);
    return {
      nodes: nodeMatch ? nodeMatch[1] : '-',
      edges: edgeMatch ? edgeMatch[1] : '-'
    };
  };

  // 테이블 행 렌더링
  const renderGraphRow = (graph, isPublic = false, isOwner = true) => {
    const stats = parseGraphStats(graph.description);
    return (
      <tr
        key={graph.id}
        className={selectedGraph?.id === graph.id ? 'selected' : ''}
        onClick={() => setSelectedGraph(graph)}
      >
        <td className="col-status">
          <span className={`status-icon ${graph.is_public ? 'public' : 'private'}`} title={graph.is_public ? '공용' : '비공개'}>
            {graph.is_public ? <Globe size={16} /> : <Lock size={16} />}
          </span>
        </td>
        <td className="col-name">
          <div className="table-name-cell">
            {editingGraph === graph.id ? (
              <input
                type="text"
                defaultValue={graph.name}
                onBlur={(e) => handleUpdateGraphName(graph, e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleUpdateGraphName(graph, e.target.value);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            ) : (
              <span className="table-graph-name">{graph.name}</span>
            )}
          </div>
        </td>
        <td className="col-nodes">{stats.nodes}</td>
        <td className="col-edges">{stats.edges}</td>
        <td className="col-date">
          <span className="table-date">{formatDate(graph.updated_at)}</span>
        </td>
        <td className="col-actions">
          <div className="table-actions">
            <button
              className="action-btn load-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleLoadGraph(graph, isPublic);
              }}
              disabled={loading}
              title="불러오기"
            >
              <Download size={14} />
              <span>불러오기</span>
            </button>
            {isOwner && (
              <>
                <button
                  className="action-btn save-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSaveToExisting(graph);
                  }}
                  disabled={loading || savingTo === graph.id || currentGraphData.nodes.length === 0}
                  title="덮어쓰기"
                >
                  {savingTo === graph.id ? (
                    <Loader2 size={14} className="spinning" />
                  ) : (
                    <Upload size={14} />
                  )}
                  <span>덮어쓰기</span>
                </button>
                <button
                  className={`action-btn public-btn ${graph.is_public ? 'is-public' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePublic(graph);
                  }}
                  disabled={loading}
                  title={graph.is_public ? '비공개로 변경' : '공용으로 변경'}
                >
                  {graph.is_public ? <Globe size={14} /> : <Lock size={14} />}
                  <span>{graph.is_public ? '공용' : '비공개'}</span>
                </button>
                <button
                  className="action-btn edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingGraph(graph.id);
                  }}
                  disabled={loading}
                  title="이름 수정"
                >
                  <Edit2 size={14} />
                  <span>수정</span>
                </button>
                <button
                  className="action-btn delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteGraph(graph);
                  }}
                  disabled={loading}
                  title="삭제"
                >
                  <Trash2 size={14} />
                  <span>삭제</span>
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="서버 저장/불러오기"
      maxWidth="80vw"
      className="server-sync-modal"
    >
      <div className="server-sync-content">
        {/* 현재 데이터 정보 */}
        <div className="server-sync-current-data">
          <h4>현재 작업 데이터</h4>
          <div className="server-sync-stats">
            <span className="stat-badge nodes">
              📈 노드 {currentGraphData.nodes.length}개
            </span>
            <span className="stat-badge edges">
              🔗 엣지 {currentGraphData.edges.length}개
            </span>
          </div>
        </div>

        {/* 탭 */}
        <div className="server-sync-tabs">
          {isAuthenticated() && (
            <button
              className={`tab-btn ${activeTab === 'my' ? 'active' : ''}`}
              onClick={() => setActiveTab('my')}
            >
              <User size={16} />
              내 그래프
            </button>
          )}
          <button
            className={`tab-btn ${activeTab === 'public' ? 'active' : ''}`}
            onClick={() => setActiveTab('public')}
          >
            <Globe size={16} />
            공용 그래프
          </button>
        </div>

        {/* 새 그래프로 저장 (로그인 & 내 그래프 탭에서만) */}
        {isAuthenticated() && activeTab === 'my' && (
          <div className="server-sync-new-graph">
            {!showNewGraphInput ? (
              <button
                className="server-sync-new-btn"
                onClick={() => setShowNewGraphInput(true)}
                disabled={loading || currentGraphData.nodes.length === 0}
              >
                <Plus size={18} />
                새 그래프로 저장
              </button>
            ) : (
              <div className="server-sync-new-input">
                <input
                  type="text"
                  placeholder="그래프 이름을 입력하세요"
                  value={newGraphName}
                  onChange={(e) => setNewGraphName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateAndSave()}
                  autoFocus
                />
                <label className="public-checkbox">
                  <input
                    type="checkbox"
                    checked={newGraphIsPublic}
                    onChange={(e) => setNewGraphIsPublic(e.target.checked)}
                  />
                  <Globe size={14} />
                  공용
                </label>
                <button
                  className="save-btn"
                  onClick={handleCreateAndSave}
                  disabled={loading || !newGraphName.trim()}
                >
                  <Save size={16} />
                  저장
                </button>
                <button
                  className="cancel-btn"
                  onClick={() => {
                    setShowNewGraphInput(false);
                    setNewGraphName('');
                    setNewGraphIsPublic(false);
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* 그래프 목록 */}
        <div className="server-sync-graph-list">
          <div className="server-sync-list-header">
            <h4>{activeTab === 'my' ? '내 그래프 목록' : '공용 그래프 목록'} ({filteredGraphs.length}개)</h4>
            <div className="server-sync-list-controls">
              <div className="search-box">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="그래프 이름 검색..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
                {searchQuery && (
                  <button className="search-clear" onClick={() => { setSearchQuery(''); setCurrentPage(1); }}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                className="action-btn"
                onClick={loadGraphs}
                disabled={loading}
                title="새로고침"
              >
                {loading ? <Loader2 size={16} className="spinning" /> : <RotateCw size={16} />}
              </button>
            </div>
          </div>

          {loading && (activeTab === 'my' ? graphs : publicGraphs).length === 0 ? (
            <div className="server-sync-loading">
              <Loader2 size={24} className="spinning" />
              <span>불러오는 중...</span>
            </div>
          ) : (activeTab === 'my' ? graphs : publicGraphs).length === 0 ? (
            <div className="server-sync-empty">
              <Cloud size={48} />
              {activeTab === 'my' ? (
                <>
                  <p>저장된 그래프가 없습니다.</p>
                  <p>위의 "새 그래프로 저장" 버튼을 눌러 현재 데이터를 저장하세요.</p>
                </>
              ) : (
                <p>공용 그래프가 없습니다.</p>
              )}
            </div>
          ) : filteredGraphs.length === 0 ? (
            <div className="server-sync-empty">
              <Search size={48} />
              <p>"{searchQuery}"에 대한 검색 결과가 없습니다.</p>
            </div>
          ) : (
            <>
              <div className="server-sync-table-container">
                <table className="server-sync-table">
                  <thead>
                    <tr>
                      <th className="col-status">공개</th>
                      <th className="col-name">그래프 이름</th>
                      <th className="col-nodes">노드</th>
                      <th className="col-edges">엣지</th>
                      <th className="col-date">수정일</th>
                      <th className="col-actions">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTab === 'my'
                      ? paginationData.paginatedGraphs.map((graph) => renderGraphRow(graph, false, true))
                      : paginationData.paginatedGraphs.map((graph) => {
                          const isOwner = isAuthenticated() && graph.user_id === user?.id;
                          return renderGraphRow(graph, true, isOwner);
                        })
                    }
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              {paginationData.totalPages > 1 && (
                <div className="pagination">
                  <div className="pagination-info">
                    {paginationData.startIndex + 1}-{paginationData.endIndex} / {paginationData.totalItems}개
                  </div>
                  <div className="pagination-controls">
                    <button
                      className="pagination-btn"
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                      title="첫 페이지"
                    >
                      <ChevronsLeft size={16} />
                    </button>
                    <button
                      className="pagination-btn"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      title="이전 페이지"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <div className="pagination-pages">
                      {Array.from({ length: paginationData.totalPages }, (_, i) => i + 1)
                        .filter(page => {
                          // 현재 페이지 주변 2개씩, 첫/마지막 페이지 표시
                          return page === 1 ||
                            page === paginationData.totalPages ||
                            Math.abs(page - currentPage) <= 2;
                        })
                        .map((page, index, arr) => (
                          <React.Fragment key={page}>
                            {index > 0 && arr[index - 1] !== page - 1 && (
                              <span className="pagination-ellipsis">...</span>
                            )}
                            <button
                              className={`pagination-page ${currentPage === page ? 'active' : ''}`}
                              onClick={() => handlePageChange(page)}
                            >
                              {page}
                            </button>
                          </React.Fragment>
                        ))
                      }
                    </div>
                    <button
                      className="pagination-btn"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === paginationData.totalPages}
                      title="다음 페이지"
                    >
                      <ChevronRight size={16} />
                    </button>
                    <button
                      className="pagination-btn"
                      onClick={() => handlePageChange(paginationData.totalPages)}
                      disabled={currentPage === paginationData.totalPages}
                      title="마지막 페이지"
                    >
                      <ChevronsRight size={16} />
                    </button>
                  </div>
                  <div className="pagination-per-page">
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={5}>5개</option>
                      <option value={10}>10개</option>
                      <option value={20}>20개</option>
                      <option value={50}>50개</option>
                    </select>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 사용자 정보 */}
        <div className="server-sync-user-info">
          {isAuthenticated() ? (
            <span>로그인: {user?.name || user?.email}</span>
          ) : (
            <span className="not-logged-in">
              <AlertCircle size={14} />
              로그인하면 내 그래프를 저장할 수 있습니다
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ServerSyncModal;
