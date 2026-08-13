import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Link, ClipboardPaste, FileSpreadsheet, Search } from 'lucide-react';
import { assignDistinctColors } from '../../utils/colorUtils.js';
import './BulkEdgeModal.css';

const BulkEdgeModal = ({ 
  isOpen, 
  onClose, 
  onBulkAdd, 
  edgeTypes = [], 
  graphData = { nodes: [], edges: [] },
  onTypeUpdate,
  // 커스텀 모달 함수들 추가
  showError,
  showSuccess,
  showInfo,
  askWarningConfirm
}) => {
  const [edges, setEdges] = useState([
    { from: '', to: '', type: 'unknown', label: '' }
  ]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showNodePicker, setShowNodePicker] = useState(false);
  const [activeField, setActiveField] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);

  const addRow = () => {
    setEdges([...edges, { from: '', to: '', type: 'unknown', label: '' }]);
  };

  const removeRow = (index) => {
    if (edges.length > 1) {
      const newEdges = edges.filter((_, i) => i !== index);
      setEdges(newEdges);
    }
  };

  const updateEdge = (index, field, value) => {
    const newEdges = [...edges];
    newEdges[index][field] = value;
    setEdges(newEdges);
  };

  const filteredNodes = graphData.nodes.filter(node => 
    node.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    node.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getNodeIdByLabel = (label) => {
    const node = graphData.nodes.find(n => n.label === label);
    return node ? node.id : label;
  };

  const getLabelByNodeId = (id) => {
    const node = graphData.nodes.find(n => n.id === id);
    return node ? node.label : id;
  };

  const handleNodeSelect = (node) => {
    if (activeField && activeIndex !== null) {
      updateEdge(activeIndex, activeField, node.label);
      setShowNodePicker(false);
      setActiveField(null);
      setActiveIndex(null);
      setSearchTerm('');
    }
  };

  const openNodePicker = (field, index) => {
    setActiveField(field);
    setActiveIndex(index);
    setShowNodePicker(true);
    setSearchTerm('');
  };

  const parseClipboardData = (text) => {
    if (!text || !text.trim()) return [];
    
    const lines = text.trim().split(/\r?\n/);
    const parsedData = [];
    
    lines.forEach(line => {
      if (!line.trim()) return;
      
      let columns = line.split('\t');
      
      if (columns.length === 1) {
        columns = line.split(',');
      }
      
      if (columns.length === 1) {
        columns = line.split(';');
      }
      
      if (columns.length === 1) {
        columns = line.split('|');
      }
      
      const cleanedColumns = columns.map(col => col.trim().replace(/^["']|["']$/g, ''));
      
      if (cleanedColumns.length >= 2) {
        const fromNode = cleanedColumns[0];
        const toNode = cleanedColumns[1];
        const edgeType = cleanedColumns.length >= 3 && cleanedColumns[2] 
          ? cleanedColumns[2].toLowerCase() 
          : 'unknown';
        const edgeLabel = cleanedColumns.length >= 4 && cleanedColumns[3] 
          ? cleanedColumns[3] 
          : '';
          
        if (fromNode && toNode) {
          parsedData.push({
            from: fromNode,
            to: toNode,
            type: edgeType,
            label: edgeLabel
          });
        }
      }
    });
    
    return parsedData;
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsedData = parseClipboardData(text);
      
      if (parsedData.length === 0) {
        if (showError) {
          await showError(`유효한 엣지 데이터를 찾을 수 없습니다.

📋 지원하는 형식:
• 탭 구분 (엑셀 기본): 김철수 → 박영희 → 협업
• 쉼표 구분: 김철수, 박영희, 협업
• 세미콜론 구분: 김철수; 박영희; 협업

💡 예시:
김철수	박영희	협업
박영희	AI회사	근무	정규직`, '데이터 형식 오류');
        } else {
          alert('유효한 엣지 데이터를 찾을 수 없습니다.\n\n형식: 시작노드이름[탭/쉼표]끝노드이름[탭/쉼표]타입[탭/쉼표]라벨\n예시:\n김철수\t박영희\t협업\n박영희\tAI회사\t근무\t정규직');
        }
        return;
      }
      
      if (edges.length === 1 && edges[0].from === '' && edges[0].to === '') {
        setEdges(parsedData);
      } else {
        setEdges([...edges, ...parsedData]);
      }
      
      if (showSuccess) {
        await showSuccess(`${parsedData.length}개의 엣지 데이터를 성공적으로 추가했습니다!`, '데이터 추가 완료');
      } else {
        alert(`${parsedData.length}개의 엣지 데이터를 추가했습니다.`);
      }
      
    } catch (error) {
      console.error('클립보드 읽기 오류:', error);
      if (showError) {
        await showError(`클립보드에서 데이터를 읽을 수 없습니다.

브라우저에서 클립보드 접근을 허용해주세요.

💡 해결 방법:
1. 브라우저 주소창의 🔒 아이콘 클릭
2. 클립보드 접근 권한 허용
3. 페이지 새로고침 후 다시 시도`, '클립보드 접근 오류');
      } else {
        alert('클립보드에서 데이터를 읽을 수 없습니다.\n브라우저에서 클립보드 접근을 허용해주세요.');
      }
    }
  };

  const addSampleData = async () => {
    const availableNodes = graphData.nodes.slice(0, 5);
    
    if (availableNodes.length < 2) {
      if (showError) {
        await showError(`예제 데이터를 생성하려면 최소 2개의 노드가 필요합니다.

💡 해결 방법:
1. 먼저 노드를 추가해주세요
2. 일괄 노드 추가 기능을 사용하세요
3. 또는 개별적으로 노드를 생성하세요`, '노드 부족');
      } else {
        alert('예제 데이터를 생성하려면 최소 2개의 노드가 필요합니다.\n먼저 노드를 추가해주세요.');
      }
      return;
    }
    
    const sampleData = [];
    
    if (availableNodes.length >= 2) {
      sampleData.push({
        from: availableNodes[0].label,
        to: availableNodes[1].label,
        type: 'collaborates_with',
        label: '협업'
      });
    }
    
    if (availableNodes.length >= 3) {
      sampleData.push({
        from: availableNodes[1].label,
        to: availableNodes[2].label,
        type: 'works_for',
        label: '근무'
      });
    }
    
    if (availableNodes.length >= 4) {
      sampleData.push({
        from: availableNodes[2].label,
        to: availableNodes[3].label,
        type: 'participates_in',
        label: '참여'
      });
    }
    
    if (edges.length === 1 && edges[0].from === '' && edges[0].to === '') {
      setEdges(sampleData);
    } else {
      setEdges([...edges, ...sampleData]);
    }
  };

  const clearAllRows = () => {
    setEdges([{ from: '', to: '', type: 'unknown', label: '' }]);
  };

  const handleSubmit = async () => {
    const validEdges = edges.filter(edge => edge.from.trim() !== '' && edge.to.trim() !== '');
    
    if (validEdges.length === 0) {
      if (showError) {
        await showError(`최소 하나의 유효한 엣지가 필요합니다.

💡 해결 방법:
1. 시작 노드와 끝 노드를 입력해주세요
2. 또는 '붙여넣기' 버튼으로 데이터를 추가해주세요
3. '예제 데이터' 버튼으로 샘플을 추가할 수도 있습니다`, '유효한 엣지 없음');
      } else {
        alert('최소 하나의 유효한 엣지가 필요합니다.');
      }
      return;
    }

    const edgesWithIds = validEdges.map(edge => ({
      ...edge,
      from: getNodeIdByLabel(edge.from),
      to: getNodeIdByLabel(edge.to)
    }));

    const nodeIds = new Set(graphData.nodes.map(n => n.id));
    const nodeLabels = new Set(graphData.nodes.map(n => n.label));
    const missingNodes = [];
    
    validEdges.forEach(edge => {
      if (!nodeLabels.has(edge.from) && !nodeIds.has(edge.from)) {
        missingNodes.push(edge.from);
      }
      if (!nodeLabels.has(edge.to) && !nodeIds.has(edge.to)) {
        missingNodes.push(edge.to);
      }
    });
    
    const uniqueMissingNodes = [...new Set(missingNodes)];
    
    if (uniqueMissingNodes.length > 0) {
      let confirmed;
      if (askWarningConfirm) {
        confirmed = await askWarningConfirm(
          `다음 노드들이 존재하지 않습니다:
${uniqueMissingNodes.join(', ')}

계속 진행하시겠습니까?

⚠️ 존재하지 않는 노드를 참조하는 엣지는 제외됩니다.`,
          '누락된 노드 발견'
        );
      } else {
        confirmed = confirm(
          `다음 노드들이 존재하지 않습니다:\n${uniqueMissingNodes.join(', ')}\n\n계속 진행하시겠습니까? (존재하지 않는 노드를 참조하는 엣지는 제외됩니다)`
        );
      }
      
      if (!confirmed) return;
      
      const filteredEdges = edgesWithIds.filter(edge => 
        nodeIds.has(edge.from) && nodeIds.has(edge.to)
      );
      
      if (filteredEdges.length === 0) {
        if (showError) {
          await showError(`유효한 엣지가 없습니다.

모든 엣지가 존재하지 않는 노드를 참조하고 있습니다.

💡 해결 방법:
1. 올바른 노드 이름을 입력해주세요
2. 먼저 필요한 노드들을 생성해주세요`, '유효한 엣지 없음');
        } else {
          alert('유효한 엣지가 없습니다.');
        }
        return;
      }
      
      const newTypeIds = new Set();
      filteredEdges.forEach(edge => {
        if (!edgeTypes.find(type => type.id === edge.type)) {
          newTypeIds.add(edge.type);
        }
      });

      if (newTypeIds.size > 0) {
        console.log('🎨 새로운 엣지 타입들에 구분되는 색상 배정:', Array.from(newTypeIds));
        
        const newTypeSettings = assignDistinctColors(Array.from(newTypeIds), edgeTypes);
        
        console.log('🎨 배정된 엣지 색상들:', newTypeSettings);
        
        onTypeUpdate(newTypeSettings);
      }

      onBulkAdd(filteredEdges);
    } else {
      const newTypeIds = new Set();
      edgesWithIds.forEach(edge => {
        if (!edgeTypes.find(type => type.id === edge.type)) {
          newTypeIds.add(edge.type);
        }
      });

      if (newTypeIds.size > 0) {
        console.log('🎨 새로운 엣지 타입들에 구분되는 색상 배정:', Array.from(newTypeIds));
        
        const newTypeSettings = assignDistinctColors(Array.from(newTypeIds), edgeTypes);
        
        console.log('🎨 배정된 엣지 색상들:', newTypeSettings);
        
        onTypeUpdate(newTypeSettings);
      }

      onBulkAdd(edgesWithIds);
    }
    
    handleClose();
  };

  const handleClose = () => {
    setEdges([{ from: '', to: '', type: 'unknown', label: '' }]);
    setShowNodePicker(false);
    setActiveField(null);
    setActiveIndex(null);
    setSearchTerm('');
    onClose();
  };

  const getUniqueTypes = () => {
    const existingTypes = edgeTypes.map(type => type.id);
    const customTypes = [...new Set(edges.map(edge => edge.type))];
    return [...new Set([...existingTypes, ...customTypes])];
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isOpen && e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        handlePasteFromClipboard();
      }
      
      if (isOpen && e.key === 'Escape' && showNodePicker) {
        setShowNodePicker(false);
        setActiveField(null);
        setActiveIndex(null);
        setSearchTerm('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, showNodePicker]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-container bulk-modal bulk-edge-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-content">
            <Link size={24} />
            <h2 className="modal-title">일괄 엣지 추가</h2>
          </div>
          <button className="modal-close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          <div className="bulk-instructions">
            <p>여러 엣지를 한번에 추가할 수 있습니다. 새로운 타입을 입력하면 자동으로 설정에 추가됩니다.</p>
            <p><strong>💡 팁:</strong> 노드 필드를 클릭하면 기존 노드 목록에서 선택할 수 있습니다!</p>
          </div>

          <div className="bulk-toolbar">
            <div className="bulk-toolbar-left">
              <button 
                className="bulk-tool-btn paste-btn"
                onClick={handlePasteFromClipboard}
                title="클립보드에서 붙여넣기 (Ctrl+V)"
              >
                <ClipboardPaste size={16} />
                붙여넣기
              </button>
              <button 
                className="bulk-tool-btn sample-btn"
                onClick={addSampleData}
                title="예제 데이터 추가"
              >
                <FileSpreadsheet size={16} />
                예제 데이터
              </button>
            </div>
            <div className="bulk-toolbar-right">
              <span className="node-count">
                사용 가능한 노드: {graphData.nodes.length}개
              </span>
              <button 
                className="bulk-tool-btn clear-btn"
                onClick={clearAllRows}
                title="모든 행 삭제"
              >
                <X size={16} />
                전체 삭제
              </button>
            </div>
          </div>

          <div className="bulk-paste-guide">
            <details>
              <summary>📋 붙여넣기 형식 가이드</summary>
              <div className="paste-guide-content">
                <p><strong>지원하는 형식:</strong></p>
                <ul>
                  <li>탭 구분 (엑셀 기본): <code>김철수 → 박영희 → 협업 → 동료</code></li>
                  <li>쉼표 구분: <code>김철수, 박영희, 협업, 동료</code></li>
                  <li>세미콜론 구분: <code>김철수; 박영희; 협업; 동료</code></li>
                  <li>파이프 구분: <code>김철수 | 박영희 | 협업 | 동료</code></li>
                </ul>
                <p><strong>💡 이제 노드 이름으로 입력하세요!</strong></p>
                <p><strong>예시 데이터:</strong></p>
                <pre>김철수	박영희	collaborates_with	협업
박영희	AI회사	works_for	근무
AI회사	데이터분석	participates_in	참여</pre>
              </div>
            </details>
          </div>

          <div className="bulk-table-container">
            <table className="bulk-table">
              <thead>
                <tr>
                  <th>시작 노드</th>
                  <th>끝 노드</th>
                  <th>타입</th>
                  <th>라벨</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {edges.map((edge, index) => (
                  <tr key={index}>
                    <td>
                      <div className="node-input-container">
                        <input
                          type="text"
                          value={edge.from}
                          onChange={(e) => updateEdge(index, 'from', e.target.value)}
                          onClick={() => openNodePicker('from', index)}
                          placeholder="시작 노드 이름"
                          className="bulk-input node-input"
                        />
                        <button
                          type="button"
                          className="node-picker-btn"
                          onClick={() => openNodePicker('from', index)}
                          title="노드 선택"
                        >
                          <Search size={14} />
                        </button>
                        {edge.from && (
                          <div className="node-label-preview">
                            {edge.from}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="node-input-container">
                        <input
                          type="text"
                          value={edge.to}
                          onChange={(e) => updateEdge(index, 'to', e.target.value)}
                          onClick={() => openNodePicker('to', index)}
                          placeholder="끝 노드 이름"
                          className="bulk-input node-input"
                        />
                        <button
                          type="button"
                          className="node-picker-btn"
                          onClick={() => openNodePicker('to', index)}
                          title="노드 선택"
                        >
                          <Search size={14} />
                        </button>
                        {edge.to && (
                          <div className="node-label-preview">
                            {edge.to}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <select
                        value={edge.type}
                        onChange={(e) => updateEdge(index, 'type', e.target.value)}
                        className="bulk-select"
                      >
                        {getUniqueTypes().map(typeId => (
                          <option key={typeId} value={typeId}>
                            {typeId}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={edge.type}
                        onChange={(e) => updateEdge(index, 'type', e.target.value)}
                        placeholder="새 타입 입력"
                        className="bulk-input-small"
                        style={{ marginTop: '5px', fontSize: '12px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={edge.label}
                        onChange={(e) => updateEdge(index, 'label', e.target.value)}
                        placeholder="라벨 (선택사항)"
                        className="bulk-input"
                      />
                    </td>
                    <td>
                      <div className="bulk-actions">
                        <button
                          type="button"
                          onClick={addRow}
                          className="bulk-action-btn add"
                          title="행 추가"
                        >
                          <Plus size={16} />
                        </button>
                        {edges.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="bulk-action-btn remove"
                            title="행 제거"
                          >
                            <Minus size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {showNodePicker && (
            <div className="node-picker-modal">
              <div className="node-picker-content">
                <div className="node-picker-header">
                  <h3>노드 선택 ({activeField === 'from' ? '시작' : '끝'} 노드)</h3>
                  <button
                    className="node-picker-close"
                    onClick={() => {
                      setShowNodePicker(false);
                      setActiveField(null);
                      setActiveIndex(null);
                      setSearchTerm('');
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="node-picker-search">
                  <Search size={16} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="노드 검색..."
                    className="node-search-input"
                    autoFocus
                  />
                </div>
                <div className="node-picker-list">
                  {filteredNodes.map(node => (
                    <div
                      key={node.id}
                      className="node-picker-item"
                      onClick={() => handleNodeSelect(node)}
                    >
                      <div className="node-item-label">{node.label}</div>
                      <div className="node-item-id">{node.id}</div>
                      <div className="node-item-type">{node.type}</div>
                    </div>
                  ))}
                  {filteredNodes.length === 0 && (
                    <div className="node-picker-empty">
                      검색 결과가 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="bulk-summary">
            <p>총 {edges.filter(e => e.from.trim() && e.to.trim()).length}개의 유효한 엣지가 추가됩니다.</p>
          </div>

          <div className="bulk-modal-footer">
            <button className="btn btn-secondary" onClick={handleClose}>
              취소
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleSubmit}
              disabled={edges.filter(e => e.from.trim() && e.to.trim()).length === 0}
            >
              {edges.filter(e => e.from.trim() && e.to.trim()).length}개 엣지 추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkEdgeModal;