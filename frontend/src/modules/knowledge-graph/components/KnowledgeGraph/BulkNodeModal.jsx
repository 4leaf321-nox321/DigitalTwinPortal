import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Database, ClipboardPaste, FileSpreadsheet } from 'lucide-react';
import { assignDistinctColors } from '../../utils/colorUtils.js';
import './BulkNodeModal.css';

const BulkNodeModal = ({ 
  isOpen, 
  onClose, 
  onBulkAdd, 
  nodeTypes = [], 
  onTypeUpdate,
  // 커스텀 모달 함수들 추가
  showError,
  showSuccess,
  showInfo
}) => {
  const [nodes, setNodes] = useState([
    { label: '', type: 'unknown' }
  ]);

  const addRow = () => {
    setNodes([...nodes, { label: '', type: 'unknown' }]);
  };

  const removeRow = (index) => {
    if (nodes.length > 1) {
      const newNodes = nodes.filter((_, i) => i !== index);
      setNodes(newNodes);
    }
  };

  const updateNode = (index, field, value) => {
    const newNodes = [...nodes];
    newNodes[index][field] = value;
    setNodes(newNodes);
  };

  // 클립보드 데이터 파싱 함수
  const parseClipboardData = (text) => {
    if (!text || !text.trim()) return [];
    
    const lines = text.trim().split(/\r?\n/);
    const parsedData = [];
    
    lines.forEach(line => {
      if (!line.trim()) return; // 빈 줄 건너뛰기
      
      // 탭 구분자로 먼저 시도
      let columns = line.split('\t');
      
      // 탭이 없으면 쉼표로 시도
      if (columns.length === 1) {
        columns = line.split(',');
      }
      
      // 세미콜론으로 시도
      if (columns.length === 1) {
        columns = line.split(';');
      }
      
      // 파이프로 시도
      if (columns.length === 1) {
        columns = line.split('|');
      }
      
      // 컬럼 데이터 정리
      const cleanedColumns = columns.map(col => col.trim().replace(/^["']|["']$/g, ''));
      
      if (cleanedColumns.length >= 1) {
        const nodeName = cleanedColumns[0];
        const nodeType = cleanedColumns.length >= 2 && cleanedColumns[1] 
          ? cleanedColumns[1].toLowerCase() 
          : 'unknown';
          
        if (nodeName) { // 노드 이름이 있는 경우만 추가
          parsedData.push({
            label: nodeName,
            type: nodeType
          });
        }
      }
    });
    
    return parsedData;
  };

  // 클립보드에서 붙여넣기
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsedData = parseClipboardData(text);
      
      if (parsedData.length === 0) {
        if (showError) {
          await showError(`유효한 데이터를 찾을 수 없습니다.

📋 지원하는 형식:
• 탭 구분 (엑셀 기본): 김철수 → 사람
• 쉼표 구분: 김철수, 사람
• 세미콜론 구분: 김철수; 사람

💡 예시:
김철수	사람
박영희	사람
AI회사	회사`, '데이터 형식 오류');
        } else {
          alert('유효한 데이터를 찾을 수 없습니다.\n\n형식: 노드명[탭/쉼표]타입\n예시:\n김철수\t사람\n박영희\t사람\nAI회사\t회사');
        }
        return;
      }
      
      // 기존 빈 행이 하나만 있으면 교체, 아니면 추가
      if (nodes.length === 1 && nodes[0].label === '' && nodes[0].type === 'unknown') {
        setNodes(parsedData);
      } else {
        // 기존 데이터에 추가
        setNodes([...nodes, ...parsedData]);
      }
      
      if (showSuccess) {
        await showSuccess(`${parsedData.length}개의 노드 데이터를 성공적으로 추가했습니다!`, '데이터 추가 완료');
      } else {
        alert(`${parsedData.length}개의 노드 데이터를 추가했습니다.`);
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

  // 예제 데이터 추가
  const addSampleData = () => {
    const sampleData = [
      { label: '김철수', type: 'person' },
      { label: '박영희', type: 'person' },
      { label: 'AI회사', type: 'company' },
      { label: '데이터 분석', type: 'project' },
      { label: 'Python', type: 'skill' }
    ];
    
    // 기존 빈 행이 하나만 있으면 교체, 아니면 추가
    if (nodes.length === 1 && nodes[0].label === '' && nodes[0].type === 'unknown') {
      setNodes(sampleData);
    } else {
      setNodes([...nodes, ...sampleData]);
    }
  };

  // 모든 행 삭제
  const clearAllRows = () => {
    setNodes([{ label: '', type: 'unknown' }]);
  };

  const handleSubmit = async () => {
    // 유효한 노드만 필터링 (라벨이 있는 것들)
    const validNodes = nodes.filter(node => node.label.trim() !== '');
    
    if (validNodes.length === 0) {
      if (showError) {
        await showError(`최소 하나의 유효한 노드가 필요합니다.

💡 해결 방법:
1. 노드 이름을 입력해주세요
2. 또는 '붙여넣기' 버튼으로 데이터를 추가해주세요
3. '예제 데이터' 버튼으로 샘플을 추가할 수도 있습니다`, '유효한 노드 없음');
      } else {
        alert('최소 하나의 유효한 노드가 필요합니다.');
      }
      return;
    }

    // 새로운 타입들을 수집
    const newTypeIds = new Set();
    validNodes.forEach(node => {
      if (!nodeTypes.find(type => type.id === node.type)) {
        newTypeIds.add(node.type);
      }
    });

    // 새로운 타입이 있으면 구분되는 색상으로 타입 설정에 추가
    if (newTypeIds.size > 0) {
      console.log('🎨 새로운 타입들에 구분되는 색상 배정:', Array.from(newTypeIds));
      
      const newTypeSettings = assignDistinctColors(Array.from(newTypeIds), nodeTypes);
      
      console.log('🎨 배정된 색상들:', newTypeSettings);
      
      onTypeUpdate(newTypeSettings);
    }

    onBulkAdd(validNodes);
    handleClose();
  };

  const handleClose = () => {
    setNodes([{ label: '', type: 'unknown' }]);
    onClose();
  };

  const getUniqueTypes = () => {
    const existingTypes = nodeTypes.map(type => type.id);
    const customTypes = [...new Set(nodes.map(node => node.type))];
    return [...new Set([...existingTypes, ...customTypes])];
  };

  // 타입별 색상 미리보기 (새로운 타입인 경우)
  const getTypeColorPreview = (typeId) => {
    // 기존 타입이면 해당 색상 반환
    const existingType = nodeTypes.find(t => t.id === typeId);
    if (existingType && existingType.color) {
      return existingType.color;
    }
    
    // 새로운 타입이면 미리보기 색상 생성
    if (typeId && typeId !== 'unknown') {
      const currentNewTypes = [...new Set(nodes.map(n => n.type))].filter(t => 
        t && !nodeTypes.find(existing => existing.id === t)
      );
      
      if (currentNewTypes.includes(typeId)) {
        const previewColors = assignDistinctColors(currentNewTypes, nodeTypes);
        const previewType = previewColors.find(t => t.id === typeId);
        return previewType ? previewType.color : '#cccccc';
      }
    }
    
    return '#cccccc';
  };

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isOpen && e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        handlePasteFromClipboard();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-container bulk-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-content">
            <Database size={24} />
            <h2 className="modal-title">일괄 노드 추가</h2>
          </div>
          <button className="modal-close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          <div className="bulk-instructions">
            <p>여러 노드를 한번에 추가할 수 있습니다. 새로운 타입을 입력하면 자동으로 구분되는 색상으로 설정에 추가됩니다.</p>
            <p><strong>💡 팁:</strong> 엑셀에서 복사한 데이터를 붙여넣기(Ctrl+V)로 빠르게 추가할 수 있습니다!</p>
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
                  <li>탭 구분 (엑셀 기본): <code>김철수 → 사람</code></li>
                  <li>쉼표 구분: <code>김철수, 사람</code></li>
                  <li>세미콜론 구분: <code>김철수; 사람</code></li>
                  <li>파이프 구분: <code>김철수 | 사람</code></li>
                </ul>
                <p><strong>예시 데이터:</strong></p>
                <pre>김철수	person
박영희	person
AI회사	company
Python	skill</pre>
              </div>
            </details>
          </div>

          <div className="bulk-table-container">
            <table className="bulk-table">
              <thead>
                <tr>
                  <th>노드 이름</th>
                  <th>타입</th>
                  <th>미리보기</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        type="text"
                        value={node.label}
                        onChange={(e) => updateNode(index, 'label', e.target.value)}
                        placeholder="노드 이름을 입력하세요"
                        className="bulk-input"
                      />
                    </td>
                    <td>
                      <select
                        value={node.type}
                        onChange={(e) => updateNode(index, 'type', e.target.value)}
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
                        value={node.type}
                        onChange={(e) => updateNode(index, 'type', e.target.value)}
                        placeholder="새 타입 입력"
                        className="bulk-input-small"
                        style={{ marginTop: '5px', fontSize: '12px' }}
                      />
                    </td>
                    <td>
                      <div className="type-color-preview">
                        <div 
                          className="color-swatch"
                          style={{ 
                            backgroundColor: getTypeColorPreview(node.type),
                            border: '2px solid #ddd',
                            borderRadius: '4px',
                            width: '30px',
                            height: '30px',
                            display: 'inline-block'
                          }}
                          title={`타입 "${node.type}"의 미리보기 색상`}
                        />
                        {!nodeTypes.find(t => t.id === node.type) && node.type !== 'unknown' && (
                          <div className="new-type-indicator">
                            <small style={{ color: '#007bff', fontWeight: 'bold' }}>NEW</small>
                          </div>
                        )}
                      </div>
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
                        {nodes.length > 1 && (
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

          <div className="bulk-summary">
            <p>총 {nodes.filter(n => n.label.trim()).length}개의 유효한 노드가 추가됩니다.</p>
            {(() => {
              const newTypes = [...new Set(nodes.map(n => n.type))].filter(t => 
                t && t !== 'unknown' && !nodeTypes.find(existing => existing.id === t)
              );
              return newTypes.length > 0 && (
                <p style={{ color: '#007bff', fontSize: '14px', marginTop: '8px' }}>
                  🎨 새로운 타입 {newTypes.length}개가 구분되는 색상으로 추가됩니다: {newTypes.join(', ')}
                </p>
              );
            })()}
          </div>

          <div className="bulk-modal-footer">
            <button className="btn btn-secondary" onClick={handleClose}>
              취소
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleSubmit}
              disabled={nodes.filter(n => n.label.trim()).length === 0}
            >
              {nodes.filter(n => n.label.trim()).length}개 노드 추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkNodeModal;