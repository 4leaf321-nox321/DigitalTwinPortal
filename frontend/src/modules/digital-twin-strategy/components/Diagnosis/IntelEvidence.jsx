import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { Radar, AlertTriangle, Check } from 'lucide-react';

// 기술 레이더가 말하는 것. (AUDIT_PLAN 3-1)
//
// ⚠️ **설문 근거와 같은 규칙이다.** 아무것도 자동으로 바뀌지 않는다 — 후보와
//    근거(어느 역량들이 그 레벨을 말하는지)를 나란히 놓고, 사람이 「반영」을
//    눌러야 진단값이 바뀐다. 사람이 매긴 칸은 서버가 건너뛰고 이유를 돌려준다.
//
// ⚠️ **응용(application) 축에는 후보가 없다.** 도구를 들였다는 사실은 「실제
//    의사결정에 쓰는가」를 말해 주지 못한다. 그 칸이 비는 것이 정직한 것이라,
//    화면도 그 이유를 적는다.
//
// ⚠️ 5(폐루프)는 후보로 안 나온다 — 결과가 현실로 되돌아간다는 판단은 사람 몫.

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const Block = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  overflow: hidden;
`;

const HeadRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.6rem 0.75rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
`;

const Meta = styled.span`
  font-size: 0.75rem;
  font-weight: 400;
  color: #94a3b8;
`;

// 사업부별 기록률. 낮은 기록률은 수준이 낮다는 말이 아니라 **근거가 없다**는
// 말이라, 수치만 담담하게 둔다.
const Coverage = styled.span`
  font-size: 0.6875rem;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 0.25rem;
  padding: 0.1rem 0.4rem;
`;

const Stale = styled.em`
  font-style: normal;
  color: #b45309;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
`;

const Th = styled.th`
  padding: 0.4rem 0.6rem;
  text-align: left;
  font-weight: 700;
  font-size: 0.6875rem;
  color: #64748b;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
  vertical-align: top;
`;

const Level = styled.span`
  font-weight: 700;
  color: ${p => (p.$muted ? '#94a3b8' : '#1e293b')};
`;

const Short = styled.span`
  font-size: 0.75rem;
  color: #b45309;
  white-space: nowrap;
`;

const Manual = styled.span`
  font-size: 0.6875rem;
  font-weight: 700;
  color: #92400e;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 0.25rem;
  padding: 0.05rem 0.3rem;
  margin-left: 0.3rem;
`;

const Stages = styled.span`
  white-space: nowrap;
`;

// 근거 역량 이름 — 이 목록이 있어야 후보가 인상이 아니라 관찰이다.
const Examples = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.15rem;
`;

const Button = styled.button`
  padding: 0.25rem 0.6rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.3rem;
  background: white;
  color: #475569;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  white-space: nowrap;
  &:hover:not(:disabled) { border-color: #0f766e; color: #0f766e; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const Primary = styled(Button)`
  margin-left: auto;
  border-color: transparent;
  background: #0f766e;
  color: white;
`;

const Warn = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 0.6rem 0.75rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 0.5rem;
  color: #92400e;
  font-size: 0.8125rem;
  line-height: 1.6;
`;

const Empty = styled.div`
  padding: 0.875rem 1.125rem;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  color: #64748b;
  font-size: 0.8125rem;
  line-height: 1.6;
`;

const Result = styled.div`
  padding: 0.6rem 0.75rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  line-height: 1.6;
  background: ${p => (p.$bad ? '#fffbeb' : '#f0fdf4')};
  border: 1px solid ${p => (p.$bad ? '#fde68a' : '#bbf7d0')};
  color: ${p => (p.$bad ? '#92400e' : '#15803d')};
`;

const IntelEvidence = ({ evidence, error, dimensionLabel, onApply }) => {
  const { cells = [], divisions = [], total_caps: totalCaps = 0 } = evidence || {};
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const nameOf = useMemo(() => {
    const map = {};
    divisions.forEach(d => { map[d.division_id] = d.name; });
    return map;
  }, [divisions]);

  // 아무것도 안 적힌 칸(recorded 0)은 표에 안 놓는다 — 스무 칸 대부분이 빈
  // 판에서는 적힌 줄이 안 보인다. 빈 정도는 위 기록률이 이미 말한다.
  const rows = useMemo(
    () => cells.filter(c => c.recorded > 0),
    [cells],
  );
  const usable = rows.filter(r => r.suggested_level != null);

  const apply = async (list) => {
    if (!list.length) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await onApply(list.map(c => ({
        division_id: c.division_id,
        dimension: c.dimension,
      })));
      setResult(res || null);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <Warn>
        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
        <span>기술정보 모듈을 읽지 못했습니다 — {error}. 이 자리만 비고 나머지
          진단은 그대로입니다.</span>
      </Warn>
    );
  }

  if (rows.length === 0) {
    return (
      <Empty>
        기술 레이더의 역량 {totalCaps}개에 <strong>사업부가 적힌 줄이 아직
        없습니다.</strong> 기술정보 모듈의 <strong>사업부 적기</strong>에서
        도입·시험 같은 단계를 적으면, 여기에 technical 진단의 후보 레벨이
        나타납니다.
      </Empty>
    );
  }

  return (
    <Wrap>
      {result && (
        <Result $bad={result.applied?.length === 0}>
          {result.applied?.length > 0 && (
            <><strong>{result.applied.length}칸을 반영했습니다.</strong>{' '}</>
          )}
          {result.skipped?.length > 0 && (
            <>
              {result.skipped.length}칸은 건너뛰었습니다 —{' '}
              {[...new Set(result.skipped.map(s => s.reason))].join(' / ')}
            </>
          )}
        </Result>
      )}

      <Block>
        <HeadRow>
          <Radar size={14} />
          기술 레이더
          <Meta>역량 {totalCaps}개 기준</Meta>
          {divisions.map(d => (
            <Coverage key={d.division_id}
                      title={`${d.name} 는 역량 ${d.total}개 중 ${d.recorded}개를 적었습니다`}>
              {d.name} {d.recorded}/{d.total}
              {d.stale > 0 && <Stale> · 낡음 {d.stale}</Stale>}
            </Coverage>
          ))}
          {onApply && (
            <Primary disabled={busy || usable.length === 0}
                     onClick={() => apply(usable)}>
              <Check size={13} /> 후보 {usable.length}칸 반영
            </Primary>
          )}
        </HeadRow>

        <Table>
          <thead>
            <tr>
              <Th>기술 축</Th>
              <Th>사업부</Th>
              <Th>기록</Th>
              <Th>제안</Th>
              <Th>현재</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map(c => (
              <tr key={`${c.division_id}:${c.dimension}`}>
                <Td>{dimensionLabel?.[c.dimension] || c.dimension}</Td>
                <Td>{nameOf[c.division_id] || c.division_id}</Td>
                <Td>
                  <Stages>
                    {Object.entries(c.stages || {})
                      .map(([stage, n]) => `${stage} ${n}`).join(' · ')}
                  </Stages>
                  {c.examples?.length > 0 && (
                    <Examples>{c.examples.join(' · ')}</Examples>
                  )}
                </Td>
                <Td>
                  {c.suggested_level == null
                    ? <Short title={c.insufficient || undefined}>표본 부족</Short>
                    : <Level>{c.suggested_level}</Level>}
                </Td>
                <Td>
                  <Level $muted={c.current_level == null}>
                    {c.current_level ?? '—'}
                  </Level>
                  {c.current_basis === 'manual' && c.current_level != null && (
                    <Manual title="사람이 매긴 값입니다. 「반영」은 이 칸을 건너뜁니다.">
                      수기
                    </Manual>
                  )}
                </Td>
                <Td>
                  {onApply ? (
                    <Button disabled={busy || c.suggested_level == null}
                            onClick={() => apply([c])}>
                      반영
                    </Button>
                  ) : '—'}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Block>
    </Wrap>
  );
};

export default IntelEvidence;
