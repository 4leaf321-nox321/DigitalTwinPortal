import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { AMOUNT_UNIT, formatAmount } from '../constants';
import { PIVOT_DIMENSIONS, UNSET, buildPivot } from '../utils/buildPivot';
import { NO_SCOPES, applyScopePick, hasScope, makeScope, removeScope } from '../utils/pivotSummary';
import PivotSummaryPanel from './PivotSummaryPanel';

// 표는 넓고 패널은 좁다. 표가 자기 상자 안에서만 가로로 흐르게 두어야
// 페이지 전체가 옆으로 밀리지 않는다. 좁은 화면에서는 위아래로 쌓는다.
const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 460px;
  gap: 1rem;
  align-items: start;

  /* 패널이 넓어진 만큼 표에 남는 폭도 줄어든다. 표가 눌리기 전에 위아래로 쌓는다. */
  @media (max-width: 1360px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Wrapper = styled.div`
  background: white;
  border-radius: 0.75rem;
  border: 1px solid #e2e8f0;
  overflow: auto;
  min-width: 0;
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
    border: 1px solid #e2e8f0;
    white-space: nowrap;
  }

  /* 위쪽 머리 — 자료 칸과 확실히 갈라 놓는다 */
  th {
    background: #f1f5f9;
    color: #334155;
    font-weight: 700;
    font-size: 0.78rem;
    text-align: center;
    border-color: #cbd5e1;
  }

  thead tr:last-child th {
    border-bottom: 2px solid #94a3b8;
  }

  /* 기준열은 세로로 합쳐지는 칸이다. 합쳐진 높이의 **가운데**에 글자를 두어야
     그 칸이 어디까지 걸쳐 있는지 눈으로 잡힌다. */
  tbody td.dim {
    vertical-align: middle;
    color: #1e293b;
    background: #f8fafc;
    font-weight: 600;
    border-color: #cbd5e1;
    cursor: pointer;
  }

  /* 왼쪽 머리(기준열)와 숫자 자리를 가르는 선 — 머리줄부터 아래까지 한 줄로 이어진다 */
  thead th.dim-head-last,
  tbody td.dim-last {
    border-right: 2px solid #94a3b8;
  }
  tbody td.dim:hover { background: #eef2ff; }
  tbody td.dim.picked {
    background: #e0e7ff;
    box-shadow: inset 2px 0 0 #4f46e5;
    font-weight: 700;
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
  cursor: pointer;

  td {
    background: ${props => (props.$picked ? '#e0e7ff' : '#f8fafc')};
    font-weight: ${props => (props.$picked ? 700 : 600)};
    color: #334155;
  }
  &:hover td { background: #eef2ff; }
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
  /* 기준열 네 칸을 합친 자리라 오른쪽 경계를 기준열과 똑같이 긋는다 */
  border-right: 2px solid #94a3b8 !important;
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
  // 표에서 고른 범위들. 우측 그래프가 이 범위만 본다. 빈 배열이면 전체다.
  const [scopes, setScopes] = useState(NO_SCOPES);

  // 기준열 칸을 누르면 그 깊이까지 좁힌다 — 사업부 칸이면 투자 유형 ▸ 사업부.
  // Ctrl(맥은 ⌘)을 누른 채면 이미 고른 것에 **더한다**.
  const pickScope = (event, path, depth) =>
    setScopes(prev => applyScopePick(prev, makeScope(path, depth), event.ctrlKey || event.metaKey));
  const isPicked = (path, depth) => hasScope(scopes, makeScope(path, depth));

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
    <Layout>
      <Wrapper>
        <Caption>
          단위: {AMOUNT_UNIT} · 가로는 투자년도, 세로는 {PIVOT_DIMENSIONS.map(d => d.label).join(' › ')} 차례
          {' · '}기준열 칸을 누르면 오른쪽이 그 범위만 봅니다 (Ctrl+클릭으로 여러 영역)
        </Caption>
        <Table>
          <thead>
            <tr>
              {PIVOT_DIMENSIONS.map((d, i) => (
                <th
                  key={d.key}
                  rowSpan={2}
                  className={i === PIVOT_DIMENSIONS.length - 1 ? 'dim-head-last' : undefined}
                >
                  {d.label}
                </th>
              ))}
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
                        <td
                          className={[
                            'dim',
                            depth === PIVOT_DIMENSIONS.length - 1 ? 'dim-last' : '',
                            isPicked(leaf.path, depth + 1) ? 'picked' : '',
                          ].filter(Boolean).join(' ')}
                          key={depth}
                          rowSpan={span.rowSpan}
                          onClick={(e) => pickScope(e, leaf.path, depth + 1)}
                          title={`${leaf.path.slice(0, depth + 1).join(' ▸ ')} · Ctrl(⌘)+클릭이면 함께 봅니다`}
                        >
                          {leaf.path[depth] === UNSET
                            ? <Unset>{UNSET}</Unset>
                            : leaf.path[depth]}
                        </td>
                      ) : null
                    ))}
                    {renderAmountRow(leaf)}
                  </tr>
                ))}
                <SubtotalRow
                  $picked={isPicked([group.label], 1)}
                  onClick={(e) => pickScope(e, [group.label], 1)}
                  title={`${group.label} · Ctrl(⌘)+클릭이면 함께 봅니다`}
                >
                  <LabelCell colSpan={PIVOT_DIMENSIONS.length}>
                    「{group.label}」 소계
                  </LabelCell>
                  {renderAmountRow(group.subtotal)}
                </SubtotalRow>
              </React.Fragment>
            ))}

            <GrandRow
              style={{ cursor: 'pointer' }}
              onClick={() => setScopes(NO_SCOPES)}
              title="고른 영역을 모두 풀고 전체를 봅니다"
            >
              <LabelCell colSpan={PIVOT_DIMENSIONS.length}>총계 ({pivot.rowCount}건)</LabelCell>
              {renderAmountRow(grandTotal)}
            </GrandRow>
          </tbody>
        </Table>
      </Wrapper>

      <PivotSummaryPanel
        investments={investments}
        scopes={scopes}
        onRemoveScope={(scope) => setScopes(prev => removeScope(prev, scope))}
        onClearScopes={() => setScopes(NO_SCOPES)}
      />
    </Layout>
  );
};

export default PivotView;
