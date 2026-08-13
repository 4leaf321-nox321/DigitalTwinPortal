import React, { useState, useCallback, useRef } from 'react';
import styled from 'styled-components';
import {
  Upload, FileText, ShieldCheck, Loader2, CheckCircle, AlertCircle,
  ChevronDown, ChevronUp, ArrowRight, RotateCcw, Download, ClipboardPaste,
} from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import Header from './components/Layout/Header';
import { compareDocuments, compareTexts, readFileToBuffer } from './services/api';

// ─── Styled Components ──────────────────────────────────────────

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
`;

const Content = styled.main`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 2rem;
`;

const Card = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
`;

const CardTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 1rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

/* ── Upload Area ── */

const UploadRow = styled.div`
  display: flex;
  gap: 1.5rem;
  align-items: stretch;

  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const UploadBox = styled.div`
  flex: 1;
  border: 2px dashed ${p => (p.$hasFile ? '#8b5cf6' : '#cbd5e1')};
  border-radius: 12px;
  padding: 2rem 1.5rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  background: ${p => (p.$hasFile ? '#f5f3ff' : '#fafafa')};
  position: relative;

  &:hover {
    border-color: #8b5cf6;
    background: #f5f3ff;
  }
`;

const UploadIcon = styled.div`
  margin-bottom: 0.75rem;
  color: ${p => (p.$hasFile ? '#8b5cf6' : '#94a3b8')};
`;

const UploadLabel = styled.div`
  font-size: 0.8125rem;
  color: #64748b;
  margin-bottom: 0.25rem;
`;

const UploadFileName = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
  margin-top: 0.5rem;
  word-break: break-all;
`;

const ArrowCol = styled.div`
  display: flex;
  align-items: center;
  color: #94a3b8;

  @media (max-width: 768px) {
    justify-content: center;
    transform: rotate(90deg);
  }
`;

/* ── Input Mode Toggle ── */

const ModeToggleRow = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const ModeBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border: 1px solid ${p => (p.$active ? '#8b5cf6' : '#e2e8f0')};
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: ${p => (p.$active ? 600 : 400)};
  color: ${p => (p.$active ? '#8b5cf6' : '#64748b')};
  background: ${p => (p.$active ? '#f5f3ff' : 'white')};
  cursor: pointer;
  transition: all 0.15s;

  &:hover { border-color: #8b5cf6; }
`;

/* ── Text Paste Area ── */

const PasteRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const PasteGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const PasteLabel = styled.div`
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
`;

const PasteHint = styled.span`
  font-weight: 400;
  color: #94a3b8;
  font-size: 0.75rem;
  margin-left: 0.375rem;
`;

const TextArea = styled.textarea`
  width: 100%;
  min-height: 220px;
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-family: 'Pretendard', sans-serif;
  line-height: 1.6;
  resize: vertical;
  color: #1e293b;
  background: #fafafa;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
    background: white;
  }

  &::placeholder {
    color: #cbd5e1;
  }
`;

const LineCount = styled.div`
  font-size: 0.6875rem;
  color: #94a3b8;
  text-align: right;
`;

/* ── Action Buttons ── */

const ActionRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const PrimaryBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 2rem;
  border: none;
  border-radius: 8px;
  font-size: 0.9375rem;
  font-weight: 600;
  color: white;
  background: #8b5cf6;
  cursor: pointer;
  transition: background 0.15s;

  &:hover:not(:disabled) { background: #7c3aed; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const SecondaryBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
  background: white;
  cursor: pointer;

  &:hover { background: #f8fafc; }
`;

/* ── Summary ── */

const SummaryGrid = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
`;

const SummaryItem = styled.div`
  flex: 1;
  min-width: 120px;
  padding: 1rem;
  border-radius: 10px;
  text-align: center;
  background: ${p => p.$bg || '#f1f5f9'};
`;

const SummaryValue = styled.div`
  font-size: 1.75rem;
  font-weight: 700;
  color: ${p => p.$color || '#1e293b'};
`;

const SummaryLabel = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.25rem;
`;

/* ── Filter ── */

const FilterRow = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const FilterBtn = styled.button`
  padding: 0.375rem 0.875rem;
  border: 1px solid ${p => (p.$active ? '#8b5cf6' : '#e2e8f0')};
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: ${p => (p.$active ? 600 : 400)};
  color: ${p => (p.$active ? '#8b5cf6' : '#64748b')};
  background: ${p => (p.$active ? '#f5f3ff' : 'white')};
  cursor: pointer;
  transition: all 0.15s;

  &:hover { border-color: #8b5cf6; }
`;

/* ── Diff Rows ── */

const DiffBlock = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 0.75rem;
  overflow: hidden;
`;

const DiffHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  background: ${p => {
    switch (p.$type) {
      case 'added': return '#f0fdf4';
      case 'deleted': return '#fef2f2';
      case 'modified': return '#fffbeb';
      default: return '#f8fafc';
    }
  }};
  color: ${p => {
    switch (p.$type) {
      case 'added': return '#16a34a';
      case 'deleted': return '#dc2626';
      case 'modified': return '#d97706';
      default: return '#475569';
    }
  }};
`;

const DiffBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  color: white;
  background: ${p => {
    switch (p.$type) {
      case 'added': return '#22c55e';
      case 'deleted': return '#ef4444';
      case 'modified': return '#f59e0b';
      default: return '#94a3b8';
    }
  }};
`;

const DiffTypeBadge = styled.span`
  font-size: 0.6875rem;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const DiffLocation = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin-left: auto;
  font-size: 0.6875rem;
  color: #94a3b8;
  white-space: nowrap;
`;

const LocTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
  background: ${p => p.$bg || '#f1f5f9'};
  color: ${p => p.$color || '#64748b'};
  font-size: 0.625rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`;

const DiffBody = styled.div`
  padding: 1rem;
  font-size: 0.8125rem;
  line-height: 1.7;
  border-top: 1px solid #e2e8f0;
  background: white;
`;

const SideBySide = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const SideLabel = styled.div`
  font-size: 0.6875rem;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
`;

const SideContent = styled.div`
  padding: 0.75rem;
  border-radius: 6px;
  background: ${p => p.$bg || '#f8fafc'};
  white-space: pre-wrap;
  word-break: break-word;
`;

/* ── Word Diff Inline ── */

const WordAdded = styled.span`
  background: #bbf7d0;
  color: #166534;
  padding: 0.05rem 0.2rem;
  border-radius: 3px;
`;

const WordDeleted = styled.span`
  background: #fecaca;
  color: #991b1b;
  text-decoration: line-through;
  padding: 0.05rem 0.2rem;
  border-radius: 3px;
`;

/* ── Table Diff ── */

const DiffTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;

  th, td {
    border: 1px solid #e2e8f0;
    padding: 0.5rem 0.75rem;
    text-align: left;
  }

  th {
    background: #f1f5f9;
    font-weight: 600;
    color: #475569;
  }
`;

const CellModified = styled.td`
  background: #fef9c3;
`;

const RowAdded = styled.tr`
  background: #f0fdf4;
`;

const RowDeleted = styled.tr`
  background: #fef2f2;
  text-decoration: line-through;
  color: #991b1b;
`;

/* ── Full Document View ── */

const FullDocWrapper = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const FullDocColumn = styled.div`
  &:first-child {
    border-right: 1px solid #e2e8f0;

    @media (max-width: 768px) {
      border-right: none;
      border-bottom: 1px solid #e2e8f0;
    }
  }
`;

const FullDocHeader = styled.div`
  padding: 0.625rem 1rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  background: #f1f5f9;
  text-transform: uppercase;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 1;
`;

const DocLine = styled.div`
  padding: 0.25rem 1rem;
  font-size: 0.8125rem;
  line-height: 1.7;
  border-bottom: 1px solid #f1f5f9;
  min-height: 1.5em;
  background: ${p => {
    switch (p.$type) {
      case 'added': return '#f0fdf4';
      case 'deleted': return '#fef2f2';
      case 'modified': return '#fffbeb';
      default: return 'white';
    }
  }};
  color: ${p => p.$type === 'deleted' ? '#991b1b' : '#1e293b'};
  ${p => p.$type === 'deleted' ? 'text-decoration: line-through;' : ''}
`;

const DocLineNum = styled.span`
  display: inline-block;
  width: 36px;
  margin-right: 8px;
  font-size: 0.6875rem;
  color: #94a3b8;
  text-align: right;
  user-select: none;
  font-variant-numeric: tabular-nums;
`;

const DocTableWrap = styled.div`
  padding: 0.375rem 1rem 0.375rem 44px;
  border-bottom: 1px solid #f1f5f9;
  background: ${p => {
    switch (p.$type) {
      case 'added': return '#f0fdf4';
      case 'deleted': return '#fef2f2';
      case 'modified': return '#fffbeb';
      default: return 'white';
    }
  }};
`;

const DocMiniTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;

  td {
    border: 1px solid #e2e8f0;
    padding: 0.25rem 0.5rem;
  }
`;

const EmptyLine = styled.div`
  padding: 0.25rem 1rem;
  min-height: 1.5em;
  border-bottom: 1px solid #f1f5f9;
  background: #f8fafc;
`;

/* ── View Toggle ── */

const ViewToggle = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
`;

const CardTitleRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  color: #94a3b8;
  text-align: center;
  gap: 1rem;
`;

// ─── Helper: 단어 diff 렌더링 ──────────────────────────────────

function renderWordDiffs(wordDiffs) {
  return wordDiffs.map((wd, i) => {
    if (wd.type === 'equal') return <span key={i}>{wd.text} </span>;
    if (wd.type === 'added') return <WordAdded key={i}>{wd.text} </WordAdded>;
    if (wd.type === 'deleted') return <WordDeleted key={i}>{wd.text} </WordDeleted>;
    return <span key={i}>{wd.text} </span>;
  });
}

// ─── Helper: 표 diff 렌더링 ────────────────────────────────────

function renderTableDiff(diff) {
  const tableDiffs = diff.tableDiffs;
  if (!tableDiffs || tableDiffs.length === 0) return null;

  // 열 수 결정
  const maxCols = tableDiffs.reduce((mx, rd) => {
    const cells = rd.cells || rd.cellsA || rd.cellsB || [];
    return Math.max(mx, cells.length);
  }, 0);

  return (
    <DiffTable>
      <thead>
        <tr>
          <th style={{ width: 50 }}>#</th>
          <th style={{ width: 70 }}>상태</th>
          {Array.from({ length: maxCols }, (_, i) => (
            <th key={i}>열 {i + 1}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tableDiffs.map((rd, ri) => {
          if (rd.type === 'equal') {
            return (
              <tr key={ri}>
                <td>{rd.indexA + 1}</td>
                <td><DiffBadge $type="equal">일치</DiffBadge></td>
                {(rd.cells || []).map((c, ci) => <td key={ci}>{c}</td>)}
              </tr>
            );
          }
          if (rd.type === 'added') {
            return (
              <RowAdded key={ri}>
                <td>+{rd.indexB + 1}</td>
                <td><DiffBadge $type="added">추가</DiffBadge></td>
                {(rd.cells || []).map((c, ci) => <td key={ci}>{c}</td>)}
              </RowAdded>
            );
          }
          if (rd.type === 'deleted') {
            return (
              <RowDeleted key={ri}>
                <td>{rd.indexA + 1}</td>
                <td><DiffBadge $type="deleted">삭제</DiffBadge></td>
                {(rd.cells || []).map((c, ci) => <td key={ci}>{c}</td>)}
              </RowDeleted>
            );
          }
          if (rd.type === 'modified') {
            return (
              <tr key={ri}>
                <td>{rd.indexA + 1}</td>
                <td><DiffBadge $type="modified">변경</DiffBadge></td>
                {(rd.cellDiffs || []).map((cd, ci) => {
                  if (cd.type === 'equal') {
                    return <td key={ci}>{cd.value}</td>;
                  }
                  return (
                    <CellModified key={ci}>
                      {cd.wordDiffs ? renderWordDiffs(cd.wordDiffs) : (
                        <>
                          <WordDeleted>{cd.oldValue}</WordDeleted>{' '}
                          <WordAdded>{cd.newValue}</WordAdded>
                        </>
                      )}
                    </CellModified>
                  );
                })}
              </tr>
            );
          }
          return null;
        })}
      </tbody>
    </DiffTable>
  );
}

// ─── Diff Block Component ──────────────────────────────────────

function formatLoc(page, line, label) {
  if (page == null && line == null) return null;
  return (
    <LocTag $bg={label === 'A' ? '#eff6ff' : '#f0fdf4'} $color={label === 'A' ? '#3b82f6' : '#22c55e'}>
      {label} p.{page ?? '?'} L{line ?? '?'}
    </LocTag>
  );
}

function DiffItem({ diff, index }) {
  const [open, setOpen] = useState(diff.type !== 'equal');

  const typeLabel = {
    equal: '일치',
    added: '추가',
    deleted: '삭제',
    modified: '변경',
  };

  const blockTypeLabel = diff.blockType === 'table' ? '표' : '문단';
  const previewText = (diff.textA || diff.textB || '').slice(0, 80);

  const locA = formatLoc(diff.pageA, diff.lineA, 'A');
  const locB = formatLoc(diff.pageB, diff.lineB, 'B');

  return (
    <DiffBlock>
      <DiffHeader $type={diff.type} onClick={() => setOpen(o => !o)}>
        <DiffBadge $type={diff.type}>{typeLabel[diff.type]}</DiffBadge>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {previewText}{(diff.textA || diff.textB || '').length > 80 ? '…' : ''}
        </span>
        <DiffLocation>
          {locA}{locB}
          <DiffTypeBadge>
            {blockTypeLabel === '표' ? <FileText size={12} /> : null}
            {blockTypeLabel}
          </DiffTypeBadge>
        </DiffLocation>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </DiffHeader>

      {open && (
        <DiffBody>
          {/* ── EQUAL ── */}
          {diff.type === 'equal' && (
            diff.blockType === 'table' && diff.rowsA ? (
              <DiffTable>
                <tbody>
                  {diff.rowsA.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </DiffTable>
            ) : (
              <SideContent>{diff.textA}</SideContent>
            )
          )}

          {/* ── ADDED ── */}
          {diff.type === 'added' && (
            diff.blockType === 'table' && diff.rowsB ? (
              <DiffTable>
                <tbody>
                  {diff.rowsB.map((row, ri) => (
                    <RowAdded key={ri}>
                      {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
                    </RowAdded>
                  ))}
                </tbody>
              </DiffTable>
            ) : (
              <SideContent $bg="#f0fdf4">{diff.textB}</SideContent>
            )
          )}

          {/* ── DELETED ── */}
          {diff.type === 'deleted' && (
            diff.blockType === 'table' && diff.rowsA ? (
              <DiffTable>
                <tbody>
                  {diff.rowsA.map((row, ri) => (
                    <RowDeleted key={ri}>
                      {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
                    </RowDeleted>
                  ))}
                </tbody>
              </DiffTable>
            ) : (
              <SideContent $bg="#fef2f2" style={{ textDecoration: 'line-through', color: '#991b1b' }}>
                {diff.textA}
              </SideContent>
            )
          )}

          {/* ── MODIFIED ── */}
          {diff.type === 'modified' && (
            diff.blockType === 'table' ? (
              renderTableDiff(diff)
            ) : (
              <SideBySide>
                <div>
                  <SideLabel>원본 (A)</SideLabel>
                  <SideContent $bg="#fef2f2">
                    {diff.wordDiffs
                      ? renderWordDiffs(diff.wordDiffs)
                      : diff.textA}
                  </SideContent>
                </div>
                <div>
                  <SideLabel>비교본 (B)</SideLabel>
                  <SideContent $bg="#f0fdf4">
                    {diff.wordDiffs
                      ? renderWordDiffs(diff.wordDiffs)
                      : diff.textB}
                  </SideContent>
                </div>
              </SideBySide>
            )
          )}
        </DiffBody>
      )}
    </DiffBlock>
  );
}

// ─── Full Document View ───────────────────────────────────────

function renderMiniTable(rows, type) {
  if (!rows) return null;
  return (
    <DocTableWrap $type={type}>
      <DocMiniTable>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => <td key={ci}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </DocMiniTable>
    </DocTableWrap>
  );
}

function renderModifiedTable(diff) {
  // 표 변경: 셀 diff로 변경 부분 하이라이트
  if (!diff.tableDiffs) return renderMiniTable(diff.rowsB || diff.rowsA, 'modified');

  return (
    <DocTableWrap $type="modified">
      <DocMiniTable>
        <tbody>
          {diff.tableDiffs.map((rd, ri) => {
            if (rd.type === 'equal') {
              return <tr key={ri}>{(rd.cells || []).map((c, ci) => <td key={ci}>{c}</td>)}</tr>;
            }
            if (rd.type === 'added') {
              return <tr key={ri} style={{ background: '#dcfce7' }}>{(rd.cells || []).map((c, ci) => <td key={ci}>{c}</td>)}</tr>;
            }
            if (rd.type === 'deleted') {
              return <tr key={ri} style={{ background: '#fecaca', textDecoration: 'line-through' }}>{(rd.cells || []).map((c, ci) => <td key={ci}>{c}</td>)}</tr>;
            }
            if (rd.type === 'modified' && rd.cellDiffs) {
              return (
                <tr key={ri} style={{ background: '#fef9c3' }}>
                  {rd.cellDiffs.map((cd, ci) => (
                    <td key={ci}>
                      {cd.type === 'equal' ? cd.value : (
                        cd.wordDiffs ? renderWordDiffs(cd.wordDiffs) : (
                          <><WordDeleted>{cd.oldValue}</WordDeleted> <WordAdded>{cd.newValue}</WordAdded></>
                        )
                      )}
                    </td>
                  ))}
                </tr>
              );
            }
            return null;
          })}
        </tbody>
      </DocMiniTable>
    </DocTableWrap>
  );
}

function FullDocView({ diffs, fileNameA, fileNameB }) {
  // 문서 A쪽과 B쪽을 각각 구성
  const linesA = [];
  const linesB = [];

  diffs.forEach((d, idx) => {
    if (d.type === 'equal') {
      if (d.blockType === 'table' && d.rowsA) {
        linesA.push({ key: idx, type: 'equal', content: renderMiniTable(d.rowsA, 'equal'), line: d.lineA });
        linesB.push({ key: idx, type: 'equal', content: renderMiniTable(d.rowsA, 'equal'), line: d.lineB });
      } else {
        linesA.push({ key: idx, type: 'equal', text: d.textA, line: d.lineA });
        linesB.push({ key: idx, type: 'equal', text: d.textA, line: d.lineB });
      }
    } else if (d.type === 'added') {
      if (d.blockType === 'table' && d.rowsB) {
        linesA.push({ key: idx, type: 'empty' });
        linesB.push({ key: idx, type: 'added', content: renderMiniTable(d.rowsB, 'added'), line: d.lineB });
      } else {
        linesA.push({ key: idx, type: 'empty' });
        linesB.push({ key: idx, type: 'added', text: d.textB, line: d.lineB });
      }
    } else if (d.type === 'deleted') {
      if (d.blockType === 'table' && d.rowsA) {
        linesA.push({ key: idx, type: 'deleted', content: renderMiniTable(d.rowsA, 'deleted'), line: d.lineA });
        linesB.push({ key: idx, type: 'empty' });
      } else {
        linesA.push({ key: idx, type: 'deleted', text: d.textA, line: d.lineA });
        linesB.push({ key: idx, type: 'empty' });
      }
    } else if (d.type === 'modified') {
      if (d.blockType === 'table') {
        linesA.push({ key: idx, type: 'modified', content: renderMiniTable(d.rowsA, 'modified'), line: d.lineA });
        linesB.push({ key: idx, type: 'modified', content: renderModifiedTable(d), line: d.lineB });
      } else {
        linesA.push({
          key: idx, type: 'modified', line: d.lineA,
          rendered: d.wordDiffs ? renderWordDiffs(d.wordDiffs.filter(w => w.type !== 'added')) : d.textA,
        });
        linesB.push({
          key: idx, type: 'modified', line: d.lineB,
          rendered: d.wordDiffs ? renderWordDiffs(d.wordDiffs.filter(w => w.type !== 'deleted')) : d.textB,
        });
      }
    }
  });

  const renderColumn = (lines) =>
    lines.map((l) => {
      if (l.type === 'empty') return <EmptyLine key={l.key} />;
      if (l.content) return <React.Fragment key={l.key}>{l.content}</React.Fragment>;
      return (
        <DocLine key={l.key} $type={l.type}>
          <DocLineNum>{l.line ?? ''}</DocLineNum>
          {l.rendered || l.text}
        </DocLine>
      );
    });

  return (
    <FullDocWrapper>
      <FullDocColumn>
        <FullDocHeader>A — {fileNameA || '원본'}</FullDocHeader>
        {renderColumn(linesA)}
      </FullDocColumn>
      <FullDocColumn>
        <FullDocHeader>B — {fileNameB || '비교본'}</FullDocHeader>
        {renderColumn(linesB)}
      </FullDocColumn>
    </FullDocWrapper>
  );
}

// ─── Excel Export ──────────────────────────────────────────────

const TYPE_LABEL = { added: '추가', deleted: '삭제', modified: '변경' };

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
  fill: { fgColor: { rgb: '6D28D9' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
  border: {
    top: { style: 'thin', color: { rgb: 'D6BCFA' } },
    bottom: { style: 'thin', color: { rgb: 'D6BCFA' } },
    left: { style: 'thin', color: { rgb: 'D6BCFA' } },
    right: { style: 'thin', color: { rgb: 'D6BCFA' } },
  },
};

const CELL_BORDER = {
  top: { style: 'thin', color: { rgb: 'E2E8F0' } },
  bottom: { style: 'thin', color: { rgb: 'E2E8F0' } },
  left: { style: 'thin', color: { rgb: 'E2E8F0' } },
  right: { style: 'thin', color: { rgb: 'E2E8F0' } },
};

const ROW_FILLS = {
  added: { fgColor: { rgb: 'F0FDF4' } },
  deleted: { fgColor: { rgb: 'FEF2F2' } },
  modified: { fgColor: { rgb: 'FFFBEB' } },
};

function flattenTableText(rows) {
  if (!rows || rows.length === 0) return '';
  return rows.map(r => r.join(' | ')).join('\n');
}

function wordDiffsToChangesOnly(wordDiffs) {
  if (!wordDiffs) return '';
  // 연속된 deleted+added 쌍을 "기존" → "수정" 형태로 묶음
  const parts = [];
  let i = 0;
  while (i < wordDiffs.length) {
    const wd = wordDiffs[i];
    if (wd.type === 'deleted') {
      // 바로 다음이 added면 쌍으로 묶기
      if (i + 1 < wordDiffs.length && wordDiffs[i + 1].type === 'added') {
        parts.push(`"${wd.text}" → "${wordDiffs[i + 1].text}"`);
        i += 2;
        continue;
      }
      parts.push(`삭제: "${wd.text}"`);
    } else if (wd.type === 'added') {
      parts.push(`추가: "${wd.text}"`);
    }
    // equal은 건너뜀
    i++;
  }
  return parts.join('\n');
}

function tableDiffsToChangesOnly(diff) {
  if (!diff.tableDiffs) return '';
  return diff.tableDiffs
    .filter(rd => rd.type !== 'equal')
    .map(rd => {
      const rowNum = (rd.indexA ?? rd.indexB) + 1;
      if (rd.type === 'added') {
        const cells = (rd.cells || []).join(' | ');
        return `행${rowNum} 추가: ${cells}`;
      }
      if (rd.type === 'deleted') {
        const cells = (rd.cells || []).join(' | ');
        return `행${rowNum} 삭제: ${cells}`;
      }
      if (rd.type === 'modified' && rd.cellDiffs) {
        const changes = rd.cellDiffs
          .filter(cd => cd.type !== 'equal')
          .map(cd => `열${cd.col + 1}: "${cd.oldValue}" → "${cd.newValue}"`)
          .join(', ');
        return `행${rowNum}: ${changes}`;
      }
      return '';
    }).filter(Boolean).join('\n');
}

function exportToExcel(result) {
  if (!result) return;

  const changes = result.diffs.filter(d => d.type !== 'equal');
  if (changes.length === 0) return;

  const headers = ['No', '유형', '블록', 'A 위치', 'B 위치', '원본 (A)', '비교본 (B)', '변경 상세'];

  const rows = changes.map((d, i) => {
    const locA = d.pageA != null ? `p.${d.pageA} L${d.lineA}` : '-';
    const locB = d.pageB != null ? `p.${d.pageB} L${d.lineB}` : '-';
    const blockLabel = d.blockType === 'table' ? '표' : '문단';

    let textA = '';
    let textB = '';
    let detail = '';

    if (d.type === 'added') {
      textB = d.blockType === 'table' ? flattenTableText(d.rowsB) : (d.textB || '');
      detail = '(전체 추가)';
    } else if (d.type === 'deleted') {
      textA = d.blockType === 'table' ? flattenTableText(d.rowsA) : (d.textA || '');
      detail = '(전체 삭제)';
    } else if (d.type === 'modified') {
      if (d.blockType === 'table') {
        textA = flattenTableText(d.rowsA);
        textB = flattenTableText(d.rowsB);
        detail = tableDiffsToChangesOnly(d);
      } else {
        textA = d.textA || '';
        textB = d.textB || '';
        detail = d.wordDiffs ? wordDiffsToChangesOnly(d.wordDiffs) : '';
      }
    }

    return [i + 1, TYPE_LABEL[d.type] || d.type, blockLabel, locA, locB, textA, textB, detail];
  });

  // 요약 시트 데이터
  const sumHeaders = ['항목', '값'];
  const sumRows = [
    ['원본 파일', result.fileNameA || '-'],
    ['비교 파일', result.fileNameB || '-'],
    ['일치율', `${result.summary.matchRate}%`],
    ['전체 블록 (A)', result.summary.totalBlocksA],
    ['전체 블록 (B)', result.summary.totalBlocksB],
    ['일치', result.summary.equal],
    ['변경', result.summary.modified],
    ['추가', result.summary.added],
    ['삭제', result.summary.deleted],
  ];

  const wb = XLSX.utils.book_new();

  // ── 요약 시트 ──
  const sumAoa = [sumHeaders, ...sumRows];
  const wsSummary = XLSX.utils.aoa_to_sheet(sumAoa);
  wsSummary['!cols'] = [{ wch: 18 }, { wch: 30 }];
  // 스타일 적용
  for (let c = 0; c < 2; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (wsSummary[addr]) wsSummary[addr].s = HEADER_STYLE;
  }
  for (let r = 1; r < sumAoa.length; r++) {
    for (let c = 0; c < 2; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (wsSummary[addr]) {
        wsSummary[addr].s = {
          border: CELL_BORDER,
          alignment: { vertical: 'center', wrapText: true },
          font: c === 0 ? { bold: true, sz: 10 } : { sz: 10 },
        };
      }
    }
  }
  XLSX.utils.book_append_sheet(wb, wsSummary, '요약');

  // ── 변경사항 시트 ──
  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // 열 너비
  ws['!cols'] = [
    { wch: 5 },   // No
    { wch: 7 },   // 유형
    { wch: 5 },   // 블록
    { wch: 10 },  // A 위치
    { wch: 10 },  // B 위치
    { wch: 40 },  // 원본
    { wch: 40 },  // 비교본
    { wch: 50 },  // 변경 상세
  ];

  // 헤더 스타일
  for (let c = 0; c < headers.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = HEADER_STYLE;
  }

  // 데이터 행 스타일
  for (let r = 0; r < rows.length; r++) {
    const d = changes[r];
    const fill = ROW_FILLS[d.type] || {};
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: r + 1, c });
      if (ws[addr]) {
        ws[addr].s = {
          fill,
          border: CELL_BORDER,
          alignment: { vertical: 'top', wrapText: true },
          font: { sz: 10 },
        };
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, '변경사항');

  // 다운로드
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  XLSX.writeFile(wb, `문서검증_변경사항_${ts}.xlsx`);
}

// ─── Main App ──────────────────────────────────────────────────

const AutoDocumentVerifyApp = ({ onGoHome }) => {
  const [inputMode, setInputMode] = useState('file'); // 'file' | 'text'

  // 파일 모드
  const [fileA, setFileA] = useState(null);
  const [fileB, setFileB] = useState(null);

  // 텍스트 모드
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('detail'); // 'detail' | 'fulldoc'

  const refA = useRef(null);
  const refB = useRef(null);

  const bufferFile = useCallback(async (file, setter) => {
    if (!file || !/\.(docx|txt)$/i.test(file.name)) return;
    try {
      const buffered = await readFileToBuffer(file);
      setter(buffered);
    } catch {
      setError('파일을 읽을 수 없습니다. DRM 해제 상태를 확인해주세요.');
    }
  }, []);

  const handleDrop = useCallback((setter) => (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    bufferFile(file, setter);
  }, [bufferFile]);

  const canCompare = inputMode === 'file'
    ? (fileA && fileB)
    : (textA.trim() && textB.trim());

  const handleCompare = async () => {
    if (!canCompare) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let data;
      if (inputMode === 'file') {
        data = await compareDocuments(fileA, fileB);
      } else {
        data = await compareTexts(textA, textB, '원본 텍스트', '비교 텍스트');
      }
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFileA(null);
    setFileB(null);
    setTextA('');
    setTextB('');
    setResult(null);
    setError(null);
    setFilter('all');
    setViewMode('detail');
  };

  const countLines = (t) => t ? t.split('\n').filter(l => l.trim()).length : 0;

  const filteredDiffs = result?.diffs?.filter(d => {
    if (filter === 'all') return true;
    if (filter === 'changes') return d.type !== 'equal';
    return d.type === filter;
  }) || [];

  const summary = result?.summary;

  return (
    <Container>
      <Header onGoHome={onGoHome} />
      <Content>
        {/* ── 입력 모드 선택 + 입력 영역 ── */}
        <Card>
          <ModeToggleRow>
            <ModeBtn $active={inputMode === 'file'} onClick={() => setInputMode('file')}>
              <Upload size={14} /> 파일 업로드
            </ModeBtn>
            <ModeBtn $active={inputMode === 'text'} onClick={() => setInputMode('text')}>
              <ClipboardPaste size={14} /> 텍스트 붙여넣기
            </ModeBtn>
          </ModeToggleRow>

          {inputMode === 'file' ? (
            /* ── 파일 업로드 모드 ── */
            <UploadRow>
              <UploadBox
                $hasFile={!!fileA}
                onClick={() => refA.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop(setFileA)}
              >
                <input
                  ref={refA}
                  type="file"
                  accept=".docx,.txt"
                  style={{ display: 'none' }}
                  onChange={e => bufferFile(e.target.files[0], setFileA)}
                />
                <UploadIcon $hasFile={!!fileA}>
                  <FileText size={36} />
                </UploadIcon>
                <UploadLabel>원본 문서 (A)</UploadLabel>
                {fileA
                  ? <UploadFileName>{fileA.name}</UploadFileName>
                  : <UploadLabel style={{ color: '#cbd5e1' }}>.docx / .txt 파일을 드래그하거나 클릭</UploadLabel>}
              </UploadBox>

              <ArrowCol><ArrowRight size={24} /></ArrowCol>

              <UploadBox
                $hasFile={!!fileB}
                onClick={() => refB.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop(setFileB)}
              >
                <input
                  ref={refB}
                  type="file"
                  accept=".docx,.txt"
                  style={{ display: 'none' }}
                  onChange={e => bufferFile(e.target.files[0], setFileB)}
                />
                <UploadIcon $hasFile={!!fileB}>
                  <FileText size={36} />
                </UploadIcon>
                <UploadLabel>비교 문서 (B)</UploadLabel>
                {fileB
                  ? <UploadFileName>{fileB.name}</UploadFileName>
                  : <UploadLabel style={{ color: '#cbd5e1' }}>.docx / .txt 파일을 드래그하거나 클릭</UploadLabel>}
              </UploadBox>
            </UploadRow>
          ) : (
            /* ── 텍스트 붙여넣기 모드 ── */
            <PasteRow>
              <PasteGroup>
                <PasteLabel>
                  원본 텍스트 (A)
                  <PasteHint>Word에서 Ctrl+A → Ctrl+C 후 여기에 Ctrl+V</PasteHint>
                </PasteLabel>
                <TextArea
                  placeholder="원본 텍스트를 붙여넣으세요..."
                  value={textA}
                  onChange={e => setTextA(e.target.value)}
                />
                <LineCount>{countLines(textA)}줄</LineCount>
              </PasteGroup>
              <PasteGroup>
                <PasteLabel>
                  비교 텍스트 (B)
                  <PasteHint>비교할 문서 내용을 붙여넣으세요</PasteHint>
                </PasteLabel>
                <TextArea
                  placeholder="비교 텍스트를 붙여넣으세요..."
                  value={textB}
                  onChange={e => setTextB(e.target.value)}
                />
                <LineCount>{countLines(textB)}줄</LineCount>
              </PasteGroup>
            </PasteRow>
          )}
        </Card>

        {/* ── 비교 버튼 ── */}
        <ActionRow>
          <PrimaryBtn disabled={!canCompare || loading} onClick={handleCompare}>
            {loading ? <Loader2 size={18} className="spin" /> : <ShieldCheck size={18} />}
            {loading ? '비교 중…' : '문서 비교'}
          </PrimaryBtn>
          {result && (
            <>
              <SecondaryBtn
                onClick={() => exportToExcel(result)}
                disabled={!result?.diffs?.some(d => d.type !== 'equal')}
              >
                <Download size={16} />
                Excel 내보내기
              </SecondaryBtn>
              <SecondaryBtn onClick={handleReset}>
                <RotateCcw size={16} />
                초기화
              </SecondaryBtn>
            </>
          )}
        </ActionRow>

        {/* ── 에러 ── */}
        {error && (
          <Card style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
            <div style={{ display: 'flex', gap: 8, color: '#dc2626' }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ whiteSpace: 'pre-line' }}>{error}</span>
            </div>
          </Card>
        )}

        {/* ── 결과 ── */}
        {result && summary && (
          <>
            {/* 요약 */}
            <Card>
              <CardTitle>
                <CheckCircle size={18} style={{ color: '#22c55e' }} />
                비교 결과 요약
              </CardTitle>
              <SummaryGrid>
                <SummaryItem $bg="#f5f3ff">
                  <SummaryValue $color="#8b5cf6">{summary.matchRate}%</SummaryValue>
                  <SummaryLabel>일치율</SummaryLabel>
                </SummaryItem>
                <SummaryItem $bg="#f0fdf4">
                  <SummaryValue $color="#22c55e">{summary.equal}</SummaryValue>
                  <SummaryLabel>일치</SummaryLabel>
                </SummaryItem>
                <SummaryItem $bg="#fffbeb">
                  <SummaryValue $color="#f59e0b">{summary.modified}</SummaryValue>
                  <SummaryLabel>변경</SummaryLabel>
                </SummaryItem>
                <SummaryItem $bg="#f0fdf4">
                  <SummaryValue $color="#16a34a">{summary.added}</SummaryValue>
                  <SummaryLabel>추가</SummaryLabel>
                </SummaryItem>
                <SummaryItem $bg="#fef2f2">
                  <SummaryValue $color="#ef4444">{summary.deleted}</SummaryValue>
                  <SummaryLabel>삭제</SummaryLabel>
                </SummaryItem>
                <SummaryItem>
                  <SummaryValue>{summary.totalBlocksA} / {summary.totalBlocksB}</SummaryValue>
                  <SummaryLabel>블록 수 (A / B)</SummaryLabel>
                </SummaryItem>
              </SummaryGrid>
            </Card>

            {/* 뷰 모드 선택 + 비교 결과 */}
            <Card>
              <CardTitleRow>
                <CardTitle style={{ margin: 0 }}>비교 결과</CardTitle>
                <ViewToggle>
                  <FilterBtn $active={viewMode === 'detail'} onClick={() => setViewMode('detail')}>
                    상세 비교
                  </FilterBtn>
                  <FilterBtn $active={viewMode === 'fulldoc'} onClick={() => setViewMode('fulldoc')}>
                    전체 문서
                  </FilterBtn>
                </ViewToggle>
              </CardTitleRow>

              {viewMode === 'detail' ? (
                /* ── 상세 비교 (기존) ── */
                <>
                  <FilterRow>
                    {[
                      { key: 'all', label: `전체 (${result.diffs.length})` },
                      { key: 'changes', label: `변경사항만 (${result.diffs.filter(d => d.type !== 'equal').length})` },
                      { key: 'modified', label: `변경 (${summary.modified})` },
                      { key: 'added', label: `추가 (${summary.added})` },
                      { key: 'deleted', label: `삭제 (${summary.deleted})` },
                      { key: 'equal', label: `일치 (${summary.equal})` },
                    ].map(f => (
                      <FilterBtn
                        key={f.key}
                        $active={filter === f.key}
                        onClick={() => setFilter(f.key)}
                      >
                        {f.label}
                      </FilterBtn>
                    ))}
                  </FilterRow>

                  {filteredDiffs.length === 0 ? (
                    <EmptyState>
                      <CheckCircle size={40} />
                      해당 유형의 항목이 없습니다.
                    </EmptyState>
                  ) : (
                    filteredDiffs.map((diff, i) => (
                      <DiffItem key={i} diff={diff} index={i} />
                    ))
                  )}
                </>
              ) : (
                /* ── 전체 문서 뷰 ── */
                <FullDocView
                  diffs={result.diffs}
                  fileNameA={result.fileNameA}
                  fileNameB={result.fileNameB}
                />
              )}
            </Card>
          </>
        )}

        {/* ── 초기 빈 상태 ── */}
        {!result && !loading && !error && (
          <EmptyState>
            <ShieldCheck size={48} />
            <div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#475569', marginBottom: 4 }}>
                두 문서를 업로드하거나 텍스트를 붙여넣어 비교를 시작하세요
              </div>
              <div style={{ fontSize: '0.8125rem' }}>
                파일 업로드(.docx/.txt) 또는 텍스트 붙여넣기(DRM 파일 대응)를 지원합니다
              </div>
            </div>
          </EmptyState>
        )}
      </Content>

      {/* 로딩 스피너 CSS */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </Container>
  );
};

export default AutoDocumentVerifyApp;
