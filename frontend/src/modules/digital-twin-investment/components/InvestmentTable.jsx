import React from 'react';
import styled from 'styled-components';
import { ArrowDown, ArrowUp, ChevronsUpDown, Edit2, Trash2 } from 'lucide-react';
import { AMOUNT_UNIT, COLUMNS, formatAmount } from '../constants';

const Wrapper = styled.div`
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  overflow: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;

  th, td {
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid #f1f5f9;
    text-align: left;
    white-space: nowrap;
  }

  th {
    background: #f8fafc;
    color: #475569;
    font-weight: 600;
    font-size: 0.8rem;
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 0;
  }

  tbody tr:hover { background: #eef2ff; }
`;

// 머리글 전체가 눌리는 영역이다. th 의 padding 을 이쪽으로 옮겨 두어
// 글자 옆 여백을 눌러도 정렬이 바뀐다.
const SortButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: ${props => props.$numeric ? 'flex-end' : 'flex-start'};
  gap: 0.25rem;
  padding: 0.6rem 0.75rem;
  border: none;
  background: none;
  font: inherit;
  color: ${props => props.$active ? '#4f46e5' : 'inherit'};
  cursor: pointer;
  user-select: none;

  &:hover { background: #eef2ff; color: #4f46e5; }
  &:focus-visible { outline: 2px solid #4f46e5; outline-offset: -2px; }

  /* 정렬 중이 아닐 때의 화살표는 있는 듯 없는 듯 두고, 손을 올리면 드러낸다. */
  .idle-icon { opacity: 0; transition: opacity 0.15s ease; }
  &:hover .idle-icon { opacity: 0.55; }
`;

const NameCell = styled.td`
  white-space: normal !important;
  color: #1e293b;
  font-weight: 500;
`;

const NumberCell = styled.td`
  text-align: right !important;
  font-variant-numeric: tabular-nums;
`;

const Badge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.75rem;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
`;

const Actions = styled.td`
  text-align: right !important;
`;

const IconButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  color: #94a3b8;
  border-radius: 4px;
  &:hover { color: ${props => props.$danger ? '#ef4444' : '#0ea5e9'}; background: #f1f5f9; }
`;

const Empty = styled.div`
  padding: 4rem 1rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
`;

const TotalRow = styled.tr`
  td {
    background: #f8fafc;
    font-weight: 600;
    color: #1e293b;
    border-top: 1px solid #e2e8f0;
  }
`;

// 오른쪽 정렬로 보여 줄 열은 금액뿐이다(년도는 왼쪽 정렬이되 숫자로 견준다).
const isNumericCell = (col) => col.type === 'amount';

// 합계 줄의 칸 나누기. 계획/실적 두 칸만 숫자로 두고 앞뒤는 하나씩 합쳐 둔다.
// 열이 늘거나 순서가 바뀌어도 어긋나지 않게 COLUMNS 에서 계산한다.
const PLAN_INDEX = COLUMNS.findIndex(c => c.key === 'planAmount');
const ACTUAL_INDEX = COLUMNS.findIndex(c => c.key === 'actualAmount');
const TRAILING_SPAN = COLUMNS.length - ACTUAL_INDEX - 1 + 1; // 남은 열 + 버튼 열

const SortIcon = ({ active, dir }) => {
  if (!active) return <ChevronsUpDown className="idle-icon" size={13} />;
  return dir === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
};

// 정렬 상태는 위(App)가 쥐고 있다. 「로컬 저장」이 화면과 같은 차례로 내보내려면
// 정렬된 배열이 바깥에도 있어야 하기 때문이다. 여기 오는 investments 는 이미 정렬된 것.
const InvestmentTable = ({ investments, sort, onToggleSort, onEdit, onDelete }) => {
  if (investments.length === 0) {
    return (
      <Wrapper>
        <Empty>등록된 투자가 없습니다. 헤더의 「투자 등록」 또는 「일괄 등록」으로 추가하세요.</Empty>
      </Wrapper>
    );
  }

  const totalPlan = investments.reduce((sum, r) => sum + (Number(r.planAmount) || 0), 0);
  const totalActual = investments.reduce((sum, r) => sum + (Number(r.actualAmount) || 0), 0);

  const renderCell = (row, col) => {
    if (col.type === 'amount') return formatAmount(row[col.key]);
    if (col.type === 'category1' || col.type === 'category2') {
      return row[col.key] ? <Badge>{row[col.key]}</Badge> : '-';
    }
    return row[col.key] || '-';
  };

  const renderHead = (col) => {
    const active = sort.key === col.key;
    const numeric = isNumericCell(col);
    const nextLabel = !active ? '오름차순' : sort.dir === 'asc' ? '내림차순' : '정렬 해제';

    return (
      <th
        key={col.key}
        style={{ width: col.width }}
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <SortButton
          type="button"
          onClick={() => onToggleSort(col.key)}
          $active={active}
          $numeric={numeric}
          title={`${col.label} 기준 ${nextLabel}`}
        >
          {/* 숫자 열은 오른쪽 정렬이라 화살표를 글자 왼쪽에 둔다. */}
          {numeric && <SortIcon active={active} dir={sort.dir} />}
          <span>{col.label}</span>
          {!numeric && <SortIcon active={active} dir={sort.dir} />}
        </SortButton>
      </th>
    );
  };

  return (
    <Wrapper>
      <Table>
        <thead>
          <tr>
            {COLUMNS.map(renderHead)}
            <th style={{ width: 80 }} />
          </tr>
        </thead>
        <tbody>
          {investments.map(row => (
            <tr key={row.id}>
              {COLUMNS.map(col => {
                if (col.key === 'name') return <NameCell key={col.key}>{row.name}</NameCell>;
                if (isNumericCell(col)) return <NumberCell key={col.key}>{renderCell(row, col)}</NumberCell>;
                return <td key={col.key}>{renderCell(row, col)}</td>;
              })}
              <Actions>
                <IconButton onClick={() => onEdit(row)} title="수정">
                  <Edit2 size={14} />
                </IconButton>
                <IconButton $danger onClick={() => onDelete(row)} title="삭제">
                  <Trash2 size={14} />
                </IconButton>
              </Actions>
            </tr>
          ))}
          <TotalRow>
            <td colSpan={PLAN_INDEX}>합계 ({investments.length}건)</td>
            <NumberCell>{formatAmount(totalPlan)}</NumberCell>
            <NumberCell>{formatAmount(totalActual)}</NumberCell>
            <td colSpan={TRAILING_SPAN}>{AMOUNT_UNIT}</td>
          </TotalRow>
        </tbody>
      </Table>
    </Wrapper>
  );
};

export default InvestmentTable;
