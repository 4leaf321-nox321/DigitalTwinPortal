import React, { useState, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { X, AlertCircle, CheckCircle, Clipboard } from 'lucide-react';

// 엑셀 TSV 데이터를 파싱하는 함수 (줄바꿈이 포함된 셀 처리)
const parseExcelData = (text) => {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // 이스케이프된 따옴표
          currentCell += '"';
          i++;
        } else {
          // 따옴표 종료
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === '\t') {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (char === '\r' && nextChar === '\n') {
        // Windows 줄바꿈
        currentRow.push(currentCell);
        if (currentRow.length > 0 && currentRow.some(cell => cell.trim())) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
        i++; // \n 스킵
      } else if (char === '\n') {
        // Unix 줄바꿈
        currentRow.push(currentCell);
        if (currentRow.length > 0 && currentRow.some(cell => cell.trim())) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  // 마지막 셀과 행 처리
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some(cell => cell.trim())) {
      rows.push(currentRow);
    }
  }

  return rows;
};

// 파싱된 행을 안건 데이터로 변환
const convertToAgendas = (rows) => {
  const results = [];
  const errors = [];

  rows.forEach((row, index) => {
    // 최소 4개 컬럼 필요: 연도, 주차, 안건명, 내용
    if (row.length < 4) {
      errors.push(`${index + 1}행: 컬럼이 부족합니다 (연도, 주차, 안건명, 내용 필요)`);
      return;
    }

    const [yearStr, weekStr, title, content] = row;

    const year = parseInt(yearStr.trim(), 10);
    const week = parseInt(weekStr.trim(), 10);

    if (isNaN(year) || year < 2000 || year > 2100) {
      errors.push(`${index + 1}행: 연도가 올바르지 않습니다 (${yearStr})`);
      return;
    }

    if (isNaN(week) || week < 1 || week > 53) {
      errors.push(`${index + 1}행: 주차가 올바르지 않습니다 (${weekStr})`);
      return;
    }

    if (!title.trim()) {
      errors.push(`${index + 1}행: 안건명이 비어있습니다`);
      return;
    }

    results.push({
      year,
      week,
      title: title.trim(),
      content: content?.trim() || ''
    });
  });

  return { results, errors };
};

const BulkAddModal = ({ isOpen, onClose, onAdd }) => {
  const [pasteData, setPasteData] = useState('');
  const [parsedData, setParsedData] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [isParsed, setIsParsed] = useState(false);
  const textareaRef = useRef(null);

  const handlePaste = useCallback((e) => {
    // textarea의 기본 붙여넣기 동작 사용
    // onPaste 이벤트 후 onChange에서 처리됨
  }, []);

  const handleTextChange = useCallback((e) => {
    const text = e.target.value;
    setPasteData(text);
    setIsParsed(false);
    setParsedData([]);
    setParseErrors([]);
  }, []);

  const handleParse = useCallback(() => {
    if (!pasteData.trim()) {
      setParseErrors(['붙여넣은 데이터가 없습니다']);
      return;
    }

    const rows = parseExcelData(pasteData);
    const { results, errors } = convertToAgendas(rows);

    setParsedData(results);
    setParseErrors(errors);
    setIsParsed(true);
  }, [pasteData]);

  const handleAdd = useCallback(() => {
    if (parsedData.length === 0) return;
    onAdd(parsedData);
    handleClose();
  }, [parsedData, onAdd]);

  const handleClose = useCallback(() => {
    setPasteData('');
    setParsedData([]);
    setParseErrors([]);
    setIsParsed(false);
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <ModalOverlay onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <Modal>
        <ModalHeader>
          <ModalTitle>여러 안건 추가</ModalTitle>
          <ModalCloseButton onClick={handleClose}>
            <X size={18} />
          </ModalCloseButton>
        </ModalHeader>

        <ModalContent>
          <InfoBox>
            <InfoTitle>사용 방법</InfoTitle>
            <InfoText>
              1. 엑셀에서 데이터를 복사합니다 (연도, 주차, 안건명, 내용 순서)<br />
              2. 아래 입력창에 붙여넣기 합니다 (Ctrl+V)<br />
              3. "데이터 확인" 버튼을 클릭하여 미리보기합니다<br />
              4. 확인 후 "추가" 버튼을 클릭합니다
            </InfoText>
            <ExampleTable>
              <thead>
                <tr>
                  <th>연도</th>
                  <th>주차</th>
                  <th>안건명</th>
                  <th>내용</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>2025</td>
                  <td>49</td>
                  <td>프로젝트 회의</td>
                  <td>진행상황 공유</td>
                </tr>
              </tbody>
            </ExampleTable>
          </InfoBox>

          <FormGroup>
            <Label>
              <Clipboard size={14} />
              데이터 붙여넣기
            </Label>
            <PasteArea
              ref={textareaRef}
              value={pasteData}
              onChange={handleTextChange}
              onPaste={handlePaste}
              placeholder="엑셀에서 복사한 데이터를 여기에 붙여넣기 하세요 (Ctrl+V)&#10;&#10;컬럼 순서: 연도 → 주차 → 안건명 → 내용"
            />
          </FormGroup>

          {!isParsed && pasteData && (
            <ParseButton onClick={handleParse}>
              데이터 확인
            </ParseButton>
          )}

          {isParsed && (
            <>
              {parseErrors.length > 0 && (
                <ErrorBox>
                  <ErrorTitle>
                    <AlertCircle size={16} />
                    오류 ({parseErrors.length}건)
                  </ErrorTitle>
                  <ErrorList>
                    {parseErrors.map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                  </ErrorList>
                </ErrorBox>
              )}

              {parsedData.length > 0 && (
                <PreviewBox>
                  <PreviewTitle>
                    <CheckCircle size={16} />
                    추가될 안건 ({parsedData.length}건)
                  </PreviewTitle>
                  <PreviewTable>
                    <thead>
                      <tr>
                        <th>연도</th>
                        <th>주차</th>
                        <th>안건명</th>
                        <th>내용</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.map((item, i) => (
                        <tr key={i}>
                          <td>{item.year}</td>
                          <td>{item.week}</td>
                          <td>{item.title}</td>
                          <td className="content-cell">{item.content}</td>
                        </tr>
                      ))}
                    </tbody>
                  </PreviewTable>
                </PreviewBox>
              )}
            </>
          )}
        </ModalContent>

        <ModalFooter>
          <Button onClick={handleClose}>취소</Button>
          <Button
            primary
            onClick={handleAdd}
            disabled={!isParsed || parsedData.length === 0}
          >
            추가 ({parsedData.length}건)
          </Button>
        </ModalFooter>
      </Modal>
    </ModalOverlay>
  );
};

// Styled Components
const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const Modal = styled.div`
  background: white;
  border-radius: 0.75rem;
  width: 100%;
  max-width: 700px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e2e8f0;
`;

const ModalTitle = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const ModalCloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: #64748b;
  border-radius: 0.375rem;
  cursor: pointer;

  &:hover {
    background: #f1f5f9;
  }
`;

const ModalContent = styled.div`
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const InfoBox = styled.div`
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 0.5rem;
  padding: 1rem;
`;

const InfoTitle = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #0369a1;
  margin-bottom: 0.5rem;
`;

const InfoText = styled.div`
  font-size: 0.8rem;
  color: #0c4a6e;
  line-height: 1.6;
`;

const ExampleTable = styled.table`
  width: 100%;
  margin-top: 0.75rem;
  border-collapse: collapse;
  font-size: 0.75rem;

  th, td {
    padding: 0.375rem 0.5rem;
    border: 1px solid #bae6fd;
    text-align: left;
  }

  th {
    background: #e0f2fe;
    color: #0369a1;
    font-weight: 600;
  }

  td {
    background: white;
    color: #334155;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Label = styled.label`
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

const PasteArea = styled.textarea`
  width: 100%;
  min-height: 150px;
  padding: 0.75rem;
  border: 2px dashed #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-family: 'Consolas', 'Monaco', monospace;
  resize: vertical;
  transition: border-color 0.2s;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #4f46e5;
    border-style: solid;
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const ParseButton = styled.button`
  padding: 0.625rem 1rem;
  background: #4f46e5;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  align-self: flex-start;

  &:hover {
    background: #4338ca;
  }
`;

const ErrorBox = styled.div`
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  padding: 1rem;
`;

const ErrorTitle = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #dc2626;
  margin-bottom: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

const ErrorList = styled.ul`
  margin: 0;
  padding-left: 1.25rem;
  font-size: 0.8rem;
  color: #991b1b;

  li {
    margin-bottom: 0.25rem;
  }
`;

const PreviewBox = styled.div`
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 0.5rem;
  padding: 1rem;
`;

const PreviewTitle = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #16a34a;
  margin-bottom: 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.375rem;
`;

const PreviewTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;

  th, td {
    padding: 0.5rem;
    border: 1px solid #bbf7d0;
    text-align: left;
    vertical-align: top;
  }

  th {
    background: #dcfce7;
    color: #166534;
    font-weight: 600;
    white-space: nowrap;
  }

  td {
    background: white;
    color: #334155;
  }

  th:nth-child(1), td:nth-child(1) { width: 60px; }
  th:nth-child(2), td:nth-child(2) { width: 50px; }
  th:nth-child(3), td:nth-child(3) { width: 150px; }

  .content-cell {
    white-space: pre-wrap;
    max-height: 80px;
    overflow-y: auto;
  }
`;

const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  ${props => props.primary ? `
    background: #4f46e5;
    color: white;
    border: none;

    &:hover:not(:disabled) {
      background: #4338ca;
    }

    &:disabled {
      background: #c7d2fe;
      cursor: not-allowed;
    }
  ` : `
    background: white;
    color: #64748b;
    border: 1px solid #e2e8f0;

    &:hover {
      background: #f8fafc;
    }
  `}
`;

export default BulkAddModal;
