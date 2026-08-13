import React, { useState, useEffect } from 'react';
import { Plus, Table, Trash2, Download, Upload, AlertCircle, Clipboard, FileSpreadsheet } from 'lucide-react';
import Modal from '../../../../shared/components/Modal/Modal';
import './BulkAddTechnologyModal.css';

const BulkAddTechnologyModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  data
}) => {
  const [technologies, setTechnologies] = useState([
    { name: '', sector: '', ring: '', description: '', isAdopted: true }
  ]);
  
  const [errors, setErrors] = useState({});
  const [validationErrors, setValidationErrors] = useState([]);
  const [pasteNotification, setPasteNotification] = useState('');

  useEffect(() => {
    if (isOpen) {
      // 모달이 열릴 때 초기화
      setTechnologies([
        { name: '', sector: '', ring: '', description: '', isAdopted: true }
      ]);
      setErrors({});
      setValidationErrors([]);
      setPasteNotification('');
    }
  }, [isOpen]);

  const handleInputChange = (index, field, value) => {
    const updatedTechnologies = [...technologies];
    updatedTechnologies[index] = { ...updatedTechnologies[index], [field]: value };
    setTechnologies(updatedTechnologies);
    
    // 에러 상태 클리어
    if (errors[`${index}-${field}`]) {
      const newErrors = { ...errors };
      delete newErrors[`${index}-${field}`];
      setErrors(newErrors);
    }
  };

  const addRow = () => {
    setTechnologies([...technologies, { name: '', sector: '', ring: '', description: '', isAdopted: true }]);
  };

  const removeRow = (index) => {
    if (technologies.length > 1) {
      const updatedTechnologies = technologies.filter((_, i) => i !== index);
      setTechnologies(updatedTechnologies);
    }
  };

  // 클립보드 데이터 파싱 함수
  const parseClipboardData = (clipboardText) => {
    console.log('=== 클립보드 파싱 시작 ===');
    console.log('Raw clipboard data:', JSON.stringify(clipboardText));
    
    // 줄바꿈으로 행 분리 (\r\n, \n, \r 모두 처리)
    const lines = clipboardText.split(/\r?\n/).filter(line => line.trim());
    console.log('Lines after split:', lines);
    console.log('Number of lines:', lines.length);
    
    if (lines.length === 0) {
      console.log('비어있는 데이터, 기본 행 반환');
      return [{ name: '', sector: '', ring: '', description: '', isAdopted: true }];
    }

    const result = [];

    lines.forEach((line, lineIndex) => {
      console.log(`\n--- Line ${lineIndex + 1} processing ---`);
      console.log('Original line:', JSON.stringify(line));
      
      let columns = [];
      
      // 탭으로 구분된 데이터 (Excel 기본) 우선 처리
      if (line.includes('\t')) {
        columns = line.split('\t');
        console.log('Tab separated - columns:', columns);
      } 
      // 쉼표로 구분된 데이터
      else if (line.includes(',') && line.split(',').length > 1) {
        columns = line.split(',');
        console.log('Comma separated - columns:', columns);
      } 
      // 여러 공백으로 구분된 데이터
      else if (line.includes('  ')) {
        columns = line.split(/\s{2,}/);
        console.log('Multiple spaces separated - columns:', columns);
      } 
      // 단일 공백으로 구분 (마지막 수단)
      else {
        columns = line.split(/\s+/);
        console.log('Single space separated - columns:', columns);
      }
      
      // 컬럼 데이터 추출 및 정리
      const name = (columns[0] || '').trim();
      const sectorText = (columns[1] || '').trim();
      const ringText = (columns[2] || '').trim();
      const description = (columns[3] || '').trim();
      
      console.log('Extracted raw data:', {
        name: `"${name}"`,
        sectorText: `"${sectorText}"`,
        ringText: `"${ringText}"`,
        description: `"${description}"`
      });

      // 섹터 매칭 (정확히 일치하는 경우만)
      const matchedSector = data.sectors?.find(sector => {
        const sectorNameMatch = sector.name.toLowerCase().trim() === sectorText.toLowerCase().trim();
        const sectorIdMatch = sector.id.toLowerCase().trim() === sectorText.toLowerCase().trim();
        
        if (sectorText && (sectorNameMatch || sectorIdMatch)) {
          console.log(`섹터 매칭 성공: "${sectorText}" -> ${sector.name} (${sector.id})`);
        }
        
        return sectorNameMatch || sectorIdMatch;
      });

      // 성숙도 매칭 (정확히 일치하는 경우만)
      const matchedRing = data.rings?.find(ring => {
        const ringNameMatch = ring.name.toLowerCase().trim() === ringText.toLowerCase().trim();
        const ringIdMatch = ring.id.toLowerCase().trim() === ringText.toLowerCase().trim();
        
        if (ringText && (ringNameMatch || ringIdMatch)) {
          console.log(`성숙도 매칭 성공: "${ringText}" -> ${ring.name} (${ring.id})`);
        }
        
        return ringNameMatch || ringIdMatch;
      });
      
      if (sectorText && !matchedSector) {
        console.log(`섹터 매칭 실패: "${sectorText}" - 사용 가능한 섹터:`, data.sectors?.map(s => s.name));
      }
      
      if (ringText && !matchedRing) {
        console.log(`성숙도 매칭 실패: "${ringText}" - 사용 가능한 성숙도:`, data.rings?.map(r => r.name));
      }

      const techData = {
        name,
        sector: matchedSector ? matchedSector.id : '',
        ring: matchedRing ? matchedRing.id : '',
        description,
        isAdopted: true // 기본값으로 도입됨 설정
      };
      
      console.log('Final tech data for this line:', techData);
      result.push(techData);
    });

    console.log('\n=== 최종 파싱 결과 ===');
    console.log('Parsed technologies:', result);
    
    // 최소 하나의 행은 있어야 함
    if (result.length === 0 || result.every(tech => !tech.name.trim())) {
      console.log('유효한 데이터가 없음, 기본 행 추가');
      result.push({ name: '', sector: '', ring: '', description: '', isAdopted: true });
    }

    return result;
  };

  // 클립보드에서 데이터 붙여넣기 처리
  const handlePasteFromClipboard = async () => {
    try {
      console.log('클립보드 읽기 시도...');
      const clipboardData = await navigator.clipboard.readText();
      console.log('클립보드 읽기 성공');
      
      if (!clipboardData.trim()) {
        console.log('클립보드 비어있음');
        setPasteNotification('클립보드가 비어있습니다.');
        setTimeout(() => setPasteNotification(''), 3000);
        return;
      }

      console.log('파싱 시작...');
      const parsedData = parseClipboardData(clipboardData);
      console.log('파싱 완료:', parsedData);
      
      if (parsedData.length === 0 || parsedData.every(tech => !tech.name.trim())) {
        console.log('유효한 데이터 없음');
        setPasteNotification('유효한 데이터를 찾을 수 없습니다.');
        setTimeout(() => setPasteNotification(''), 3000);
        return;
      }

      // 기존 데이터를 파싱된 데이터로 교체
      console.log('테이블 업데이트');
      setTechnologies(parsedData);
      
      // 에러 상태 초기화
      setErrors({});
      setValidationErrors([]);
      
      setPasteNotification(`${parsedData.length}개 행이 붙여넣기되었습니다.`);
      setTimeout(() => setPasteNotification(''), 3000);
      
    } catch (error) {
      console.error('클립보드 읽기 오류:', error);
      setPasteNotification('클립보드 읽기에 실패했습니다. 브라우저 권한을 확인해주세요.');
      setTimeout(() => setPasteNotification(''), 5000);
    }
  };

  // 테이블 전체 선택 및 붙여넣기 이벤트 처리
  const handleTableKeyDown = (e) => {
    if (e.ctrlKey && e.key === 'v') {
      e.preventDefault();
      handlePasteFromClipboard();
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const newValidationErrors = [];
    
    // 빈 행 제거
    const filledTechnologies = technologies.filter(tech => 
      tech.name.trim() || tech.sector || tech.ring || tech.description.trim()
    );

    if (filledTechnologies.length === 0) {
      newValidationErrors.push('최소 하나의 솔루션을 입력해주세요.');
      setValidationErrors(newValidationErrors);
      return false;
    }

    filledTechnologies.forEach((tech, index) => {
      const originalIndex = technologies.findIndex(t => t === tech);
      
      if (!tech.name.trim()) {
        newErrors[`${originalIndex}-name`] = '솔루션 이름은 필수입니다.';
        newValidationErrors.push(`${originalIndex + 1}번째 행: 솔루션 이름이 비어있습니다.`);
      }
      
      if (!tech.sector) {
        newErrors[`${originalIndex}-sector`] = '섹터는 필수입니다.';
        newValidationErrors.push(`${originalIndex + 1}번째 행: 섹터가 선택되지 않았습니다.`);
      }
      
      if (!tech.ring) {
        newErrors[`${originalIndex}-ring`] = '성숙도는 필수입니다.';
        newValidationErrors.push(`${originalIndex + 1}번째 행: 성숙도가 선택되지 않았습니다.`);
      }

      // 중복 솔루션명 체크
      const duplicates = filledTechnologies.filter(t => 
        t.name.trim().toLowerCase() === tech.name.trim().toLowerCase()
      );
      if (duplicates.length > 1) {
        newErrors[`${originalIndex}-name`] = '중복된 솔루션명입니다.';
        newValidationErrors.push(`${originalIndex + 1}번째 행: "${tech.name}" 중복된 솔루션명입니다.`);
      }
    });
    
    setErrors(newErrors);
    setValidationErrors(newValidationErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    // 빈 행 제거하고 유효한 솔루션만 필터링
    const validTechnologies = technologies
      .filter(tech => tech.name.trim() && tech.sector && tech.ring)
      .map((tech, index) => ({
        ...tech,
        id: Date.now().toString() + index,
        isAdopted: tech.isAdopted !== undefined ? tech.isAdopted : true // 기본값 보장
      }));
    
    onSubmit(validTechnologies);
    handleClose();
  };

  const handleClose = () => {
    setTechnologies([{ name: '', sector: '', ring: '', description: '', isAdopted: true }]);
    setErrors({});
    setValidationErrors([]);
    setPasteNotification('');
    onClose();
  };

  const exportTemplate = () => {
    // CSV 헤더
    const headers = ['솔루션 이름', '섹터', '성숙도', '설명'];
    
    // 모든 섹터와 성숙도 조합으로 샘플 데이터 생성
    const sampleData = [];
    let sampleCounter = 1;
    
    // 모든 섹터에 대해 반복
    data.sectors?.forEach(sector => {
      // 모든 성숙도에 대해 반복
      data.rings?.forEach(ring => {
        sampleData.push([
          `solution${sampleCounter}`,
          sector.name,
          ring.name,
          `${sector.name} 분야의 ${ring.name} 단계 솔루션`
        ]);
        sampleCounter++;
      });
    });
    
    // 섹터나 성숙도가 비어있는 경우를 대비한 기본 샘플
    if (sampleData.length === 0) {
      sampleData.push(
        ['solution1', 'Frontend', 'Adopt', 'Frontend 분야의 Adopt 단계 솔루션'],
        ['solution2', 'Backend', 'Trial', 'Backend 분야의 Trial 단계 솔루션'],
        ['solution3', 'Infrastructure', 'Assess', 'Infrastructure 분야의 Assess 단계 솔루션'],
        ['solution4', 'Data', 'Hold', 'Data 분야의 Hold 단계 솔루션']
      );
    }
    
    // CSV 형식으로 변환
    const csvContent = [headers, ...sampleData]
      .map(row => row.map(cell => {
        // 쉼표나 따옴표가 포함된 경우 따옴표로 감싸기
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(','))
      .join('\n');
    
    console.log('Generated CSV template:', csvContent);
    console.log(`Total samples: ${sampleData.length} (${data.sectors?.length || 0} sectors × ${data.rings?.length || 0} rings)`);
    
    // BOM 추가 (Excel에서 한글이 깨지지 않도록)
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;
    
    // 파일 다운로드
    const blob = new Blob([csvWithBOM], { 
      type: 'text/csv;charset=utf-8;' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_add_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getSectorColor = (sectorId) => {
    const sector = data.sectors?.find(s => s.id === sectorId);
    return sector ? sector.color : '#64748b';
  };

  const getRingColor = (ringId) => {
    const ring = data.rings?.find(r => r.id === ringId);
    return ring ? ring.color : '#64748b';
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="여러 솔루션 일괄 추가"
      maxWidth="1100px"
      className="bulk-add-technology-modal"
    >
      <form onSubmit={handleSubmit} className="bulk-technology-form">
        {/* 안내 메시지 */}
        <div className="bulk-form-guide">
          <div className="guide-content">
            <Table size={18} />
            <div>
              <p><strong>여러 솔루션을 한 번에 추가하세요</strong></p>
              <p>아래 테이블에 직접 입력하거나 Excel/스프레드시트에서 복사하여 붙여넣으세요.</p>
            </div>
          </div>
          <div className="guide-buttons">
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="paste-btn"
              title="클립보드에서 붙여넣기 (Ctrl+V)"
            >
              <Clipboard size={14} />
              붙여넣기
            </button>
            <button
              type="button"
              onClick={exportTemplate}
              className="template-btn"
              title="CSV 템플릿 다운로드"
            >
              <Download size={14} />
              CSV 템플릿
            </button>
          </div>
        </div>

        {/* 붙여넣기 알림 */}
        {pasteNotification && (
          <div className="paste-notification">
            <FileSpreadsheet size={16} />
            <span>{pasteNotification}</span>
          </div>
        )}

        {/* Excel 데이터 포맷 안내 */}
        <div className="format-guide">
          <div className="format-header">
            <FileSpreadsheet size={16} />
            <span>Excel/스프레드시트 데이터 형식</span>
          </div>
          <div className="format-content">
            <div className="format-example">
              <table className="example-table">
                <thead>
                  <tr>
                    <th>솔루션 이름</th>
                    <th>섹터</th>
                    <th>성숙도</th>
                    <th>설명</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>React</td>
                    <td>{data.sectors?.[0]?.name || 'Frontend'}</td>
                    <td>{data.rings?.[0]?.name || 'Adopt'}</td>
                    <td>사용자 인터페이스 라이브러리</td>
                  </tr>
                  <tr>
                    <td>Docker</td>
                    <td>{data.sectors?.[1]?.name || 'Infrastructure'}</td>
                    <td>{data.rings?.[1]?.name || 'Trial'}</td>
                    <td>컨테이너 플랫폼</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>💡 섹터와 성숙도는 정확히 일치하는 이름만 자동으로 매핑됩니다.</p>
            <p>📄 CSV 템플릿에는 모든 섹터×성숙도 조합의 샘플이 포함되어 있습니다.</p>
            <p>🔧 필요한 부분만 수정하여 사용하세요.</p>
          </div>
        </div>

        {/* 유효성 검사 에러 */}
        {validationErrors.length > 0 && (
          <div className="validation-errors">
            <div className="error-header">
              <AlertCircle size={16} />
              <span>다음 오류를 수정해주세요:</span>
            </div>
            <ul>
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 솔루션 테이블 */}
        <div 
          className="technology-table-container"
          onKeyDown={handleTableKeyDown}
          tabIndex={0}
        >
          <table className="technology-table">
            <thead>
              <tr>
                <th className="col-index">#</th>
                <th className="col-name">솔루션 이름 *</th>
                <th className="col-sector">섹터 *</th>
                <th className="col-ring">성숙도 *</th>
                <th className="col-description">설명</th>
                <th className="col-actions">작업</th>
              </tr>
            </thead>
            <tbody>
              {technologies.map((tech, index) => (
                <tr key={index} className={Object.keys(errors).some(key => key.startsWith(`${index}-`)) ? 'has-error' : ''}>
                  <td className="col-index">
                    <span className="row-number">{index + 1}</span>
                  </td>
                  <td className="col-name">
                    <input
                      type="text"
                      value={tech.name}
                      onChange={(e) => handleInputChange(index, 'name', e.target.value)}
                      className={`table-input ${errors[`${index}-name`] ? 'error' : ''}`}
                      placeholder="예: React, Docker"
                    />
                    {errors[`${index}-name`] && (
                      <span className="field-error">{errors[`${index}-name`]}</span>
                    )}
                  </td>
                  <td className="col-sector">
                    <select
                      value={tech.sector}
                      onChange={(e) => handleInputChange(index, 'sector', e.target.value)}
                      className={`table-select ${errors[`${index}-sector`] ? 'error' : ''}`}
                    >
                      <option value="">선택</option>
                      {data.sectors?.map(sector => (
                        <option key={sector.id} value={sector.id}>
                          {sector.name}
                        </option>
                      ))}
                    </select>
                    {tech.sector && (
                      <div className="preview-badge">
                        <span 
                          className="sector-preview"
                          style={{ backgroundColor: getSectorColor(tech.sector) }}
                        >
                          {data.sectors?.find(s => s.id === tech.sector)?.name}
                        </span>
                      </div>
                    )}
                    {errors[`${index}-sector`] && (
                      <span className="field-error">{errors[`${index}-sector`]}</span>
                    )}
                  </td>
                  <td className="col-ring">
                    <select
                      value={tech.ring}
                      onChange={(e) => handleInputChange(index, 'ring', e.target.value)}
                      className={`table-select ${errors[`${index}-ring`] ? 'error' : ''}`}
                    >
                      <option value="">선택</option>
                      {data.rings?.map(ring => (
                        <option key={ring.id} value={ring.id}>
                          {ring.name}
                        </option>
                      ))}
                    </select>
                    {tech.ring && (
                      <div className="preview-badge">
                        <span 
                          className="ring-preview"
                          style={{ backgroundColor: getRingColor(tech.ring) }}
                        >
                          {data.rings?.find(r => r.id === tech.ring)?.name}
                        </span>
                      </div>
                    )}
                    {errors[`${index}-ring`] && (
                      <span className="field-error">{errors[`${index}-ring`]}</span>
                    )}
                  </td>
                  <td className="col-description">
                    <textarea
                      value={tech.description}
                      onChange={(e) => handleInputChange(index, 'description', e.target.value)}
                      className="table-textarea"
                      placeholder="선택사항"
                      rows="2"
                    />
                  </td>
                  <td className="col-actions">
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="remove-row-btn"
                      disabled={technologies.length <= 1}
                      title="행 삭제"
                    >
                      <Trash2 size={14} strokeWidth={2} className="trash-icon" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 테이블 컨트롤 */}
        <div className="table-controls">
          <button
            type="button"
            onClick={addRow}
            className="add-row-btn"
          >
            <Plus size={16} />
            행 추가
          </button>
          <span className="table-info">
            {technologies.length}개 행 | 필수 항목: 솔루션 이름, 섹터, 성숙도 | <kbd>Ctrl+V</kbd>로 붙여넣기
          </span>
        </div>

        {/* 버튼 */}
        <div className="form-actions">
          <button
            type="button"
            onClick={handleClose}
            className="btn btn-cancel"
          >
            취소
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={technologies.every(tech => !tech.name.trim() && !tech.sector && !tech.ring)}
          >
            <Plus size={16} />
            {technologies.filter(tech => tech.name.trim()).length}개 솔루션 추가
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default BulkAddTechnologyModal;
