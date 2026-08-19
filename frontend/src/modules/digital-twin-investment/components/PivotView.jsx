import React, { useMemo } from 'react';
import styled from 'styled-components';
import { AMOUNT_UNIT, formatAmount } from '../constants';
import { PIVOT_DIMENSIONS, UNSET, buildPivot } from '../utils/buildPivot';

const Wrapper = styled.div`
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  overflow: auto;
`;

const Caption = styled.div`
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.78rem;
  color: #94a3b8;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;

  th, td {
    padding: 0.45rem 0.6rem;
    border: 1px solid #f1f5f9;
    white-space: nowrap;
  }

  th {
    background: #f8fafc;
    color: #475569;
    font-weight: 600;
    font-size: 0.78rem;
    text-align: center;
  }

  /* 기준열은 세로로 합쳐지므로 글자를 위쪽에 붙여 둔다. */
  tbody td.dim {
    vertical-align: top;
    color: #1e293b;
    background: #fcfdff;
  }

  tbody tr:hover td:not(.dim) { background: #eef2ff; }
`;

// 연도 묶음의 왼쪽 경계를 그어 해마다 눈이 끊기게 한다.
const YearHead = styled.th`
  border-left: 2px solid #e2e8f0 !important;
`;

const NumCell = styled.td`
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: ${props => (props.$muted ? '#cbd5e1' : '#334155')};
  border-left: ${props => (props.$groupStart ? '2px solid #e2e8f0' : '1px solid #f1f5f9')} !important;
`;

const TotalHead = styled.th`
  background: #eef2ff !important;
  color: #3730a3 !important;
  border-left: 2px solid #c7d2fe !important;
`;

const SubtotalRow = styled.tr`
  td {
    background: #f8fafc;
    font-weight: 600;
    color: #334155;
  }
`;

const GrandRow = styled.tr`
  td {
    background: #eef2ff;
    font-weight: 700;
    color: #3730a3;
    border-top: 2px solid #c7d2fe;
  }
`;

const LabelCell = styled.td`
  text-align: right;
`;

const Unset = styled.span`
  color: #94a3b8;
`;

const Empty = styled.div`
  padding: 4rem 1rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.9rem;
`;

/** 값이 없는 칸은 0 대신 흐린 '-' 로 둔다. 0 이 깔리면 표가 읽히지 않는다. */
const Amount = ({ cell, field, groupStart }) => {
  const empty = !cell || cell.count === 0;
  return (
    <NumCell $muted={empty} $groupStart={groupStart}>
      {empty ? '-' : formatAmount(cell[field])}
    </NumCell>
  );
};

const PivotView = ({ investments, orders }) => {
  const pivot = useMemo(() => buildPivot(investments, orders), [investments, orders]);

  if (pivot.rowCount === 0) {
    return (
      <Wrapper>
        <Empty>보여 줄 투자가 없습니다.</Empty>
      </Wrapper>
    );
  }

  const { years, groups, grandTotal } = pivot;

  // 연도마다 계획/실적 두 칸 + 맨 끝 합계 두 칸
  const renderAmountRow = (source) => (
    <>
      {years.map(year => (
        <React.Fragment key={year}>
          <Amount cell={source.cells[year]} field="plan" groupStart />
          <Amount cell={source.cells[year]} field="actual" />
        </React.Fragment>
      ))}
      <Amount cell={source.total} field="plan" groupStart />
      <Amount cell={source.total} field="actual" />
    </>
  );

  return (
    <Wrapper>
      <Caption>
        단위: {AMOUNT_UNIT} · 가로는 투자년도, 세로는 {PIVOT_DIMENSIONS.map(d => d.label).join(' › ')} 차례
      </Caption>
      <Table>
        <thead>
          <tr>
            {PIVOT_DIMENSIONS.map(d => <th key={d.key} rowSpan={2}>{d.label}</th>)}
            {years.map(year => (
              <YearHead key={year} colSpan={2}>{year === '미지정' ? '년도 미지정' : `${year}년`}</YearHead>
            ))}
            <TotalHead colSpan={2}>합계</TotalHead>
          </tr>
          <tr>
            {years.map(year => (
              <React.Fragment key={year}>
                <YearHead>계획</YearHead>
                <th>실적</th>
              </React.Fragment>
            ))}
            <TotalHead>계획</TotalHead>
            <TotalHead>실적</TotalHead>
          </tr>
        </thead>

        <tbody>
          {groups.map(group => (
            <React.Fragment key={group.label}>
              {group.leaves.map((leaf, i) => (
                <tr key={`${group.label}-${i}`}>
                  {leaf.spans.map((span, depth) => (
                    span.render ? (
                      <td className="dim" key={depth} rowSpan={span.rowSpan}>
                        {leaf.path[depth] === UNSET
                          ? <Unset>{UNSET}</Unset>
                          : leaf.path[depth]}
                      </td>
                    ) : null
                  ))}
                  {renderAmountRow(leaf)}
                </tr>
              ))}
              <SubtotalRow>
                <LabelCell colSpan={PIVOT_DIMENSIONS.length}>
                  「{group.label}」 소계
                </LabelCell>
                {renderAmountRow(group.subtotal)}
              </SubtotalRow>
            </React.Fragment>
          ))}

          <GrandRow>
            <LabelCell colSpan={PIVOT_DIMENSIONS.length}>총계 ({pivot.rowCount}건)</LabelCell>
            {renderAmountRow(grandTotal)}
          </GrandRow>
        </tbody>
      </Table>
    </Wrapper>
  );
};

export default PivotView;
