import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronUp } from 'lucide-react';
import settingsData from '../../../option/systemsetting.json';

const STATUSES = [
  { value: '미정', color: '#94a3b8', bg: '#f1f5f9' },
  { value: '계획', color: '#3b82f6', bg: '#eff6ff' },
  { value: '안건 확정', color: '#f59e0b', bg: '#fffbeb' },
  { value: '완료', color: '#10b981', bg: '#ecfdf5' },
];

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const DIVISIONS = (settingsData?.divisions || []).map(d => ({
  id: d.id,
  name: d.name,
  color: d.color,
}));

const formatScheduleDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dayName = DAY_NAMES[d.getDay()];
  return `${month}/${day} (${dayName})`;
};

const getWeekNumber = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d - oneJan) / 86400000) + 1;
  return Math.ceil((dayOfYear + oneJan.getDay()) / 7);
};

// Predefined palette for category colors
const CATEGORY_PALETTE = [
  { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  { color: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' },
  { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  { color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
  { color: '#be185d', bg: '#fdf2f8', border: '#fbcfe8' },
  { color: '#6d28d9', bg: '#ede9fe', border: '#c4b5fd' },
  { color: '#0e7490', bg: '#ecfeff', border: '#a5f3fc' },
  { color: '#9a3412', bg: '#fff7ed', border: '#fed7aa' },
  { color: '#4338ca', bg: '#eef2ff', border: '#c7d2fe' },
  { color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
];

// ============== Styled Components ==============

const Wrapper = styled.div`
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
`;

const ToolBar = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const ExpandToggleBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  background: white;
  font-size: 0.82rem;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: #8b5cf6;
    color: #7c3aed;
    background: #faf5ff;
  }
`;

const TableContainer = styled.div`
  background: white;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border: 1px solid #e2e8f0;
  overflow: auto;
  max-height: calc(100vh - 220px);
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;

  th {
    padding: 0.75rem;
    text-align: center;
    font-size: 0.9rem;
    font-weight: 600;
    color: #475569;
    background: #f8fafc;
    border-bottom: 2px solid #cbd5e1;
    border-right: 1px solid #e2e8f0;
    position: sticky;
    top: 0;
    z-index: 2;
  }

  th:last-child {
    border-right: none;
  }

  td {
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid #e2e8f0;
    border-right: 1px solid #e2e8f0;
    font-size: 0.95rem;
    color: #334155;
    vertical-align: top;
  }

  td:last-child {
    border-right: none;
  }

  tbody tr:nth-child(even) td {
    background: #fafbfc;
  }
`;

const RoundHeaderCell = styled.td`
  background: #f8f7ff !important;
  vertical-align: middle !important;
  text-align: center;
  white-space: nowrap;
  min-width: 90px;
  border-right: 2px solid #d6d3e8 !important;
`;

const RoundNumber = styled.div`
  font-weight: 700;
  font-size: 0.95rem;
  color: #7c3aed;
`;

const RoundDate = styled.div`
  font-size: 0.82rem;
  color: #64748b;
  margin-top: 0.125rem;
`;

const RoundTime = styled.div`
  font-size: 0.78rem;
  color: #94a3b8;
`;

const StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.73rem;
  font-weight: 600;
  color: ${props => props.$color};
  background: ${props => props.$bg};
  margin-top: 0.3rem;
`;

const CellContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const CategoryBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const CategoryChip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: 0.3rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: ${props => props.$catColor || '#6d28d9'};
  background: ${props => props.$catBg || '#f5f3ff'};
  border: 1px solid ${props => props.$catBorder || '#ede9fe'};
  white-space: nowrap;
  align-self: flex-start;
`;

const AgendaList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding-left: 0.625rem;
  border-left: 2px solid ${props => props.$accentColor || '#ede9fe'};
  margin-left: 0.3rem;
`;

const AgendaItem = styled.div`
  font-size: 0.82rem;
  color: #4b5563;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
`;

const ChipList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
`;

const EmptyCell = styled.span`
  color: #d1d5db;
  font-size: 0.85rem;
`;

const EmptyMessage = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
  font-size: 0.95rem;
`;

const DivisionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
`;

const DivisionDot = styled.span`
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: ${props => props.$color};
  flex-shrink: 0;
`;

// ============== Component ==============

const ReportPlanSummary = ({ rounds, planTab }) => {
  const [expanded, setExpanded] = useState(false);

  // Build a stable color map for all unique categories
  const categoryColorMap = useMemo(() => {
    const map = new Map();
    if (!rounds) return map;
    let idx = 0;
    rounds.forEach(r => r.items.forEach(it => {
      if (it.category && !map.has(it.category)) {
        map.set(it.category, CATEGORY_PALETTE[idx % CATEGORY_PALETTE.length]);
        idx++;
      }
    }));
    return map;
  }, [rounds]);

  // Build pivot data: round × division → [{ category, agendas[] }]
  const { columns, matrix } = useMemo(() => {
    if (!rounds || rounds.length === 0) return { columns: [], matrix: [] };

    const allDivIds = new Set();
    rounds.forEach(r => r.items.forEach(it => {
      (it.divisions || []).forEach(id => allDivIds.add(id));
    }));

    const cols = DIVISIONS.filter(d => allDivIds.has(d.id));

    const mat = rounds.map(round => {
      const row = {};
      cols.forEach(col => {
        const catMap = new Map();
        round.items.forEach(it => {
          const divs = it.divisions || [];
          if (divs.includes(col.id) && it.category) {
            if (!catMap.has(it.category)) {
              catMap.set(it.category, []);
            }
            if (it.agenda) {
              catMap.get(it.category).push(it.agenda);
            }
          }
        });
        row[col.id] = [...catMap.entries()].map(([category, agendas]) => ({
          category,
          agendas,
        }));
      });
      return row;
    });

    return { columns: cols, matrix: mat };
  }, [rounds]);

  if (!rounds || rounds.length === 0) {
    return (
      <Wrapper>
        <EmptyMessage>등록된 회차가 없습니다.</EmptyMessage>
      </Wrapper>
    );
  }

  if (columns.length === 0) {
    return (
      <Wrapper>
        <EmptyMessage>사업부 또는 구분이 입력된 데이터가 없습니다.</EmptyMessage>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <ToolBar>
        <ExpandToggleBtn onClick={() => setExpanded(prev => !prev)}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? '접기' : '펼치기'}
        </ExpandToggleBtn>
      </ToolBar>
      <TableContainer>
        <StyledTable>
          <thead>
            <tr>
              <th style={{ width: 110 }}>{planTab === 'cfo' ? '주차' : '회차'}</th>
              {columns.map(col => (
                <th key={col.id}>
                  <DivisionHeader>
                    <DivisionDot $color={col.color} />
                    {col.name}
                  </DivisionHeader>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rounds.map((round, ri) => {
              const statusInfo = STATUSES.find(s => s.value === round.status) || STATUSES[0];
              const timeStr = (round.timeStart || round.timeEnd)
                ? `${round.timeStart || '00:00'} ~ ${round.timeEnd || '00:00'}`
                : '';

              return (
                <tr key={round.id}>
                  <RoundHeaderCell>
                    <RoundNumber>
                      {planTab === 'cfo'
                        ? `${getWeekNumber(round.schedule) ? getWeekNumber(round.schedule) + '주차' : '날짜 미정'}`
                        : `${round.roundNumber}회차`
                      }
                    </RoundNumber>
                    {round.schedule && (
                      <RoundDate>{formatScheduleDate(round.schedule)}</RoundDate>
                    )}
                    {timeStr && <RoundTime>{timeStr}</RoundTime>}
                    <StatusBadge $color={statusInfo.color} $bg={statusInfo.bg}>
                      {round.status}
                    </StatusBadge>
                  </RoundHeaderCell>
                  {columns.map(col => {
                    const entries = matrix[ri][col.id];
                    if (entries.length === 0) {
                      return <td key={col.id}><EmptyCell>—</EmptyCell></td>;
                    }

                    return (
                      <td key={col.id}>
                        {expanded ? (
                          <CellContent>
                            {entries.map(entry => {
                              const palette = categoryColorMap.get(entry.category) || CATEGORY_PALETTE[0];
                              return (
                                <CategoryBlock key={entry.category}>
                                  <CategoryChip
                                    $catColor={palette.color}
                                    $catBg={palette.bg}
                                    $catBorder={palette.border}
                                  >
                                    {entry.category}
                                  </CategoryChip>
                                  {entry.agendas.length > 0 && (
                                    <AgendaList $accentColor={palette.border}>
                                      {entry.agendas.map((ag, i) => (
                                        <AgendaItem key={i}>{ag}</AgendaItem>
                                      ))}
                                    </AgendaList>
                                  )}
                                </CategoryBlock>
                              );
                            })}
                          </CellContent>
                        ) : (
                          <ChipList>
                            {entries.map(entry => {
                              const palette = categoryColorMap.get(entry.category) || CATEGORY_PALETTE[0];
                              return (
                                <CategoryChip
                                  key={entry.category}
                                  $catColor={palette.color}
                                  $catBg={palette.bg}
                                  $catBorder={palette.border}
                                >
                                  {entry.category}
                                </CategoryChip>
                              );
                            })}
                          </ChipList>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </StyledTable>
      </TableContainer>
    </Wrapper>
  );
};

export default ReportPlanSummary;
