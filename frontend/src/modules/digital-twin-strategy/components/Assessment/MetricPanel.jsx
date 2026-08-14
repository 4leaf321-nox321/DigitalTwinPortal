import React from 'react';
import styled from 'styled-components';
import { HelpCircle } from 'lucide-react';

// B. 활용과 성과 — 포탈 데이터로 계산된 관측값.
// 사람이 매기지 않는다. 기술 성숙도 옆에 놓여서 "기술은 4단계인데 활용은 바닥"이
// 한눈에 보이게 하는 것이 목적이다.

const Wrap = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow: hidden;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 200px 120px 140px 90px minmax(160px, 1fr);
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;

  &:last-child { border-bottom: none; }
`;

const HeadRow = styled(Row)`
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #475569;
`;

const NameCell = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-weight: 600;
  color: #1e293b;
`;

const HintIcon = styled(HelpCircle)`
  color: #cbd5e1;
  cursor: help;
  flex-shrink: 0;
  &:hover { color: #7c3aed; }
`;

const Observed = styled.div`
  font-size: 1.0625rem;
  font-weight: 700;
  color: ${p => (p.$missing ? '#cbd5e1' : '#0f172a')};
`;

const Unit = styled.span`
  font-size: 0.8125rem;
  font-weight: 500;
  color: #94a3b8;
  margin-left: 0.2rem;
`;

const TargetInput = styled.input`
  width: 110px;
  padding: 0.4rem 0.6rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #334155;
  &:focus { outline: none; border-color: #7c3aed; }
`;

const Gap = styled.div`
  font-weight: 700;
  text-align: center;
  color: ${p => {
    if (p.$value === null || p.$value === undefined) return '#cbd5e1';
    // 목표에 못 미치면 양수. 클수록 급하다.
    if (p.$value <= 0) return '#10b981';
    return '#ef4444';
  }};
`;

const NoteInput = styled.input`
  width: 100%;
  padding: 0.45rem 0.7rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #334155;
  &:focus { outline: none; border-color: #7c3aed; }
`;

const Notice = styled.div`
  padding: 0.75rem 1.25rem;
  background: #fef2f2;
  color: #b91c1c;
  font-size: 0.8125rem;
  border-bottom: 1px solid #fecaca;
`;

const MetricPanel = ({ metrics, definitions, divisionId, error, onTargetChange }) => {
  const rows = (metrics || []).filter(m => m.division_id === divisionId);
  const byKey = {};
  rows.forEach(r => { byKey[r.metric_key] = r; });

  return (
    <Wrap>
      {error && <Notice>{error}</Notice>}
      <HeadRow>
        <div>지표</div>
        <div>관측값</div>
        <div>목표</div>
        <div style={{ textAlign: 'center' }}>격차</div>
        <div>메모</div>
      </HeadRow>

      {(definitions || []).map(def => {
        const m = byKey[def.key] || {};
        const missing = m.value === null || m.value === undefined;
        return (
          <Row key={def.key}>
            <NameCell>
              {def.label}
              <HintIcon size={14} title={def.detail} />
            </NameCell>

            <Observed $missing={missing} title={missing ? '계산할 근거가 없습니다' : ''}>
              {missing ? '—' : m.value}
              {!missing && <Unit>{def.unit}</Unit>}
            </Observed>

            <div>
              <TargetInput
                type="number"
                key={`${divisionId}-${def.key}-${m.target_value ?? ''}`}
                defaultValue={m.target_value ?? ''}
                placeholder="목표 없음"
                onBlur={e => {
                  const raw = e.target.value.trim();
                  const next = raw === '' ? null : Number(raw);
                  if ((m.target_value ?? null) !== next) {
                    onTargetChange(divisionId, def.key, { target_value: next });
                  }
                }}
              />
            </div>

            <Gap $value={m.gap}>
              {m.gap === null || m.gap === undefined
                ? '—'
                : (m.gap > 0 ? `+${m.gap}` : m.gap)}
            </Gap>

            <NoteInput
              key={`${divisionId}-${def.key}-note-${m.note || ''}`}
              defaultValue={m.note || ''}
              placeholder="해석이나 메모"
              onBlur={e => {
                if ((m.note || '') !== e.target.value) {
                  onTargetChange(divisionId, def.key, { note: e.target.value });
                }
              }}
            />
          </Row>
        );
      })}
    </Wrap>
  );
};

export default MetricPanel;
