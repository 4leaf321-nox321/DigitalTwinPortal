import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { X } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

import { AMOUNT_UNIT, formatAmount } from '../constants';
import { PIVOT_DIMENSIONS } from '../utils/buildPivot';
import {
  buildBreakdown, buildScopeComparison, buildYearSeries, filterByScopes,
  pickBreakdownMetric, scopeKey, scopeLabel, scopeTotals,
} from '../utils/pivotSummary';

const Panel = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
`;

const Card = styled.section`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.75rem 0.85rem 0.6rem;
`;

const CardTitle = styled.h4`
  margin: 0 0 0.1rem;
  font-size: 0.82rem;
  font-weight: 700;
  color: #1e293b;
`;

const CardNote = styled.p`
  margin: 0 0 0.5rem;
  font-size: 0.7rem;
  color: #94a3b8;
`;

const ScopeBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
  font-size: 0.75rem;
`;

const ClearAll = styled.button`
  margin-left: auto;
  border: none;
  background: none;
  padding: 0 2px;
  font-size: 0.72rem;
  color: #6366f1;
  cursor: pointer;
  text-decoration: underline;
  &:hover { color: #312e81; }
`;

const ScopeChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 2px 6px 2px 9px;
  border-radius: 999px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  color: #3730a3;
  font-weight: 700;
`;

const ScopeClear = styled.button`
  display: inline-flex;
  align-items: center;
  border: none;
  background: none;
  padding: 1px;
  color: #6366f1;
  cursor: pointer;
  border-radius: 999px;
  &:hover { background: #c7d2fe; color: #312e81; }
`;

const Hint = styled.span`
  color: #94a3b8;
`;

const Totals = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
`;

const Total = styled.div`
  min-width: 0;

  dt {
    margin: 0;
    font-size: 0.68rem;
    color: #94a3b8;
  }
  dd {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: ${props => props.$accent || '#1e293b'};
    font-variant-numeric: tabular-nums;
  }
`;

const Select = styled.select`
  margin-left: auto;
  padding: 2px 5px;
  border: 1px solid #e2e8f0;
  border-radius: 0.35rem;
  font-size: 0.72rem;
  color: #475569;
  background: white;
  cursor: pointer;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const Empty = styled.div`
  padding: 1.75rem 0.5rem;
  text-align: center;
  color: #cbd5e1;
  font-size: 0.78rem;
`;

const PLAN_COLOR = '#c7d2fe';
const ACTUAL_COLOR = '#4f46e5';
const RATE_COLOR = '#f59e0b';
// 구성 막대는 한 계열이라 색으로 크기를 나타낸다 (큰 것이 진하다).
const SHARE_COLORS = ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'];

const TooltipBox = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.4rem;
  padding: 6px 9px;
  font-size: 0.74rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);

  strong { display: block; margin-bottom: 3px; color: #1e293b; }
  div { display: flex; justify-content: space-between; gap: 10px; color: #64748b; }
  b { color: #1e293b; font-variant-numeric: tabular-nums; }
`;

const amount = (n) => `${formatAmount(n)} ${AMOUNT_UNIT}`;
const rateText = (r) => (r === null || r === undefined ? '–' : `${r}%`);

const PivotSummaryPanel = ({ investments, scopes = [], onRemoveScope, onClearScopes }) => {
  // 구성 막대의 기준열. 피벗의 첫 기준열(투자 유형)로 시작한다.
  const [breakdownKey, setBreakdownKey] = useState(PIVOT_DIMENSIONS[0].key);

  // 고른 영역이 여럿이면 **합집합**이다. 겹쳐 골라도 한 건이 두 번 세어지지 않는다.
  const rows = useMemo(() => filterByScopes(investments, scopes), [investments, scopes]);
  const comparison = useMemo(
    () => (scopes.length > 1 ? buildScopeComparison(investments, scopes) : []),
    [investments, scopes]);
  const years = useMemo(() => buildYearSeries(rows), [rows]);
  const totals = useMemo(() => scopeTotals(rows), [rows]);
  const metric = useMemo(() => pickBreakdownMetric(rows), [rows]);
  const breakdown = useMemo(
    () => buildBreakdown(rows, breakdownKey, metric), [rows, breakdownKey, metric]);

  const metricLabel = metric === 'actual' ? '실적' : '계획';
  const dimLabel = PIVOT_DIMENSIONS.find(d => d.key === breakdownKey)?.label || '';

  return (
    <Panel>
      <Card>
        <ScopeBar>
          {scopes.length === 0 ? (
            <Hint>전체 {totals.count}건 · 표의 기준열 칸을 누르면 그 범위만 봅니다</Hint>
          ) : (
            <>
              {scopes.map(scope => (
                <ScopeChip key={scopeKey(scope)}>
                  {scopeLabel(scope)}
                  <ScopeClear onClick={() => onRemoveScope(scope)} title="이 영역 빼기">
                    <X size={12} />
                  </ScopeClear>
                </ScopeChip>
              ))}
              <Hint>{totals.count}건</Hint>
              {scopes.length > 1 && (
                <ClearAll onClick={onClearScopes}>모두 해제</ClearAll>
              )}
            </>
          )}
        </ScopeBar>

        <Totals>
          <Total as="dl">
            <dt>계획</dt>
            <dd>{amount(totals.plan)}</dd>
          </Total>
          <Total as="dl" $accent={ACTUAL_COLOR}>
            <dt>실적</dt>
            <dd>{amount(totals.actual)}</dd>
          </Total>
          <Total as="dl" $accent={RATE_COLOR}>
            <dt>집행률</dt>
            <dd>{rateText(totals.rate)}</dd>
          </Total>
        </Totals>
      </Card>

      <Card>
        <CardTitle>연도별 계획 vs 실적</CardTitle>
        <CardNote>막대는 금액({AMOUNT_UNIT}), 선은 집행률(실적÷계획)</CardNote>
        {years.length === 0 ? (
          <Empty>보여 줄 자료가 없습니다.</Empty>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={years} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11.5, fill: '#64748b' }} />
              <YAxis yAxisId="amount" tick={{ fontSize: 11.5, fill: '#64748b' }} />
              {/* 집행률은 금액과 자릿수가 전혀 달라 축을 따로 둔다.
                  100%를 넘길 수 있으므로 위를 고정하지 않는다. */}
              <YAxis
                yAxisId="rate"
                orientation="right"
                tick={{ fontSize: 11.5, fill: RATE_COLOR }}
                tickFormatter={(v) => `${v}%`}
                width={38}
              />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <TooltipBox>
                      <strong>{d.year === '미지정' ? '년도 미지정' : `${label}년`}</strong>
                      <div><span>계획</span><b>{amount(d.plan)}</b></div>
                      <div><span>실적</span><b>{amount(d.actual)}</b></div>
                      <div><span>집행률</span><b>{rateText(d.rate)}</b></div>
                      <div><span>건수</span><b>{d.count}건</b></div>
                    </TooltipBox>
                  );
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 2 }} />
              <Bar yAxisId="amount" dataKey="plan" name="계획" fill={PLAN_COLOR} radius={[3, 3, 0, 0]} />
              <Bar yAxisId="amount" dataKey="actual" name="실적" fill={ACTUAL_COLOR} radius={[3, 3, 0, 0]} />
              <Line
                yAxisId="rate"
                type="monotone"
                dataKey="rate"
                name="집행률"
                stroke={RATE_COLOR}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>

      {comparison.length > 1 && (
        <Card>
          <CardTitle>고른 영역 견주기</CardTitle>
          <CardNote>영역별 실적({AMOUNT_UNIT}) · 겹쳐 고르면 같은 건이 두 줄에 모두 듭니다</CardNote>
          <ResponsiveContainer width="100%" height={Math.max(120, comparison.length * 40 + 26)}>
            <BarChart
              data={comparison}
              layout="vertical"
              margin={{ top: 2, right: 44, left: 4, bottom: 2 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                width={132}
                tick={{ fontSize: 11.5, fill: '#475569' }}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <TooltipBox>
                      <strong>{d.label}</strong>
                      <div><span>계획</span><b>{amount(d.plan)}</b></div>
                      <div><span>실적</span><b>{amount(d.actual)}</b></div>
                      <div><span>집행률</span><b>{rateText(d.rate)}</b></div>
                      <div><span>건수</span><b>{d.count}건</b></div>
                    </TooltipBox>
                  );
                }}
              />
              <Bar
                dataKey="actual"
                fill={ACTUAL_COLOR}
                radius={[0, 3, 3, 0]}
                label={{
                  position: 'right',
                  fontSize: 10.5,
                  fill: '#64748b',
                  formatter: (_v, _n, props) => rateText(props?.payload?.rate),
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Card>
        <TitleRow>
          <CardTitle>구성</CardTitle>
          <Select
            value={breakdownKey}
            onChange={e => setBreakdownKey(e.target.value)}
            title="어떤 기준열로 나눌지 고릅니다"
          >
            {PIVOT_DIMENSIONS.map(d => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </Select>
        </TitleRow>
        <CardNote>
          {dimLabel}별 {metricLabel} 비중
          {metric === 'plan' && ' · 실적이 아직 없어 계획 기준입니다'}
        </CardNote>
        {breakdown.length === 0 ? (
          <Empty>보여 줄 자료가 없습니다.</Empty>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(140, breakdown.length * 40 + 26)}>
            <BarChart
              data={breakdown}
              layout="vertical"
              margin={{ top: 2, right: 44, left: 4, bottom: 2 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={116}
                tick={{ fontSize: 11.5, fill: '#475569' }}
                interval={0}
              />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <TooltipBox>
                      <strong>{d.name}</strong>
                      <div><span>계획</span><b>{amount(d.plan)}</b></div>
                      <div><span>실적</span><b>{amount(d.actual)}</b></div>
                      <div><span>비중</span><b>{d.share}%</b></div>
                      <div><span>건수</span><b>{d.count}건</b></div>
                    </TooltipBox>
                  );
                }}
              />
              <Bar
                dataKey="value"
                radius={[0, 3, 3, 0]}
                label={{
                  position: 'right',
                  fontSize: 10.5,
                  fill: '#64748b',
                  formatter: (v, _n, props) => `${props?.payload?.share ?? 0}%`,
                }}
              >
                {breakdown.map((d, i) => (
                  <Cell key={d.name} fill={SHARE_COLORS[Math.min(i, SHARE_COLORS.length - 1)]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>
    </Panel>
  );
};

export default PivotSummaryPanel;
