import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { ClipboardList, AlertTriangle, Check, ChevronDown, ChevronRight } from 'lucide-react';

// 설문이 말하는 것. (LINK_PLAN 2단계)
//
// ⚠️ **설문은 근거지 결론이 아니다.** 이 화면은 아무것도 자동으로 바꾸지 않는다.
//    제안값과 표본 수를 나란히 놓고, 사람이 「반영」을 눌러야 진단값이 바뀐다.
//    조직 레벨은 '개인 차원'·'부서 표준' 같은 **서술로 정의된 단계**라, 1~5
//    응답의 평균을 반올림한 것과 뜻이 같지 않다.
//
// ⚠️ **평균과 제안 레벨을 같이 보여준다.** 3.4 와 3.6 이 3 과 4 로 갈리는 것을
//    숨기면 숫자가 실제보다 정밀해 보인다.
//
// ⚠️ **설문끼리 뭉치지 않는다.** 같은 축을 가리켜도 묻는 맥락이 다르다. 설문
//    별로 묶어서 보여주고, 반영도 설문 하나를 골라서 한다.

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const SurveyBlock = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  overflow: hidden;
`;

const SurveyHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.6rem 0.75rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
`;

const Toggle = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0;
  border: none;
  background: transparent;
  color: #1e293b;
  font-size: 0.875rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
`;

const Meta = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
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
  vertical-align: middle;
  white-space: nowrap;
`;

const Level = styled.span`
  font-weight: 700;
  color: ${p => (p.$muted ? '#94a3b8' : '#1e293b')};
`;

// 평균은 회색으로 작게. 레벨이 주인공이지만 반올림했다는 사실은 남아야 한다.
const Avg = styled.span`
  font-size: 0.75rem;
  color: #64748b;
`;

const Short = styled.span`
  font-size: 0.75rem;
  color: #b45309;
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
  &:hover:not(:disabled) { border-color: #0f766e; color: #0f766e; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const Primary = styled(Button)`
  margin-left: auto;
  border-color: transparent;
  background: #0f766e;
  color: white;
`;

const Roles = styled.div`
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
`;

const Role = styled.span`
  font-size: 0.6875rem;
  color: #64748b;
  background: #f1f5f9;
  border-radius: 0.25rem;
  padding: 0.05rem 0.35rem;
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

const cellKey = (c) => `${c.survey_id}:${c.division_id}:${c.dimension}`;

const SurveyEvidence = ({ evidence, onApply }) => {
  const { surveys = [], cells = [], out_of_scope: outOfScope = [] } = evidence || {};
  const [open, setOpen] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const bySurvey = useMemo(() => {
    const map = new Map();
    cells.forEach(c => {
      if (!map.has(c.survey_id)) map.set(c.survey_id, []);
      map.get(c.survey_id).push(c);
    });
    return map;
  }, [cells]);

  const apply = async (list) => {
    if (!list.length) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await onApply(list.map(c => ({
        survey_id: c.survey_id,
        division_id: c.division_id,
        dimension: c.dimension,
      })));
      setResult(res || null);
    } finally {
      setBusy(false);
    }
  };

  if (surveys.length === 0) {
    return (
      <Empty>
        이 전략에 매달린 <strong>마감된 설문</strong>이 아직 없습니다. 설문 모듈에서
        문항에 <strong>진단 연결</strong>을 걸어 만들고, 마감하면 여기에 조직 역량
        제안값이 나타납니다. 진행 중인 설문은 쓰지 않습니다 — 사람이 답할 때마다
        진단이 움직이면 어제 본 숫자와 오늘 숫자가 달라집니다.
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

      {surveys.map(survey => {
        const rows = bySurvey.get(survey.id) || [];
        // ⚠️ 표본이 서는 칸만 반영 대상이다. 사람이 매긴 칸은 서버가 건너뛰고
        //    이유를 돌려준다 — 화면에서 미리 빼면 왜 안 되는지 알 수 없다.
        const usable = rows.filter(r => !r.insufficient);
        const isOpen = open[survey.id] !== false;
        return (
          <SurveyBlock key={survey.id}>
            <SurveyHead>
              <Toggle onClick={() => setOpen(o => ({ ...o, [survey.id]: !isOpen }))}>
                {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <ClipboardList size={14} />
                {survey.title}
              </Toggle>
              <Meta>응답 {survey.response_count}명 · 근거 {rows.length}칸</Meta>
              {/* 「반영」은 진단값을 바꾼다. 조회만 하는 사람에게는 안 보인다 —
                  집계는 그대로 읽을 수 있다. */}
              {onApply && (
                <Primary disabled={busy || usable.length === 0}
                         onClick={() => apply(usable)}>
                  <Check size={13} /> 이 설문으로 {usable.length}칸 반영
                </Primary>
              )}
            </SurveyHead>

            {isOpen && (
              <Table>
                <thead>
                  <tr>
                    <Th>조직 축</Th>
                    <Th>사업부</Th>
                    <Th>설문</Th>
                    <Th>제안</Th>
                    <Th>현재</Th>
                    <Th>역할별</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(c => (
                    <tr key={cellKey(c)}>
                      <Td>{c.dimension_label}</Td>
                      <Td>{c.division_name}</Td>
                      <Td>
                        <Avg>{c.average}점 · {c.respondent_count}명</Avg>
                      </Td>
                      <Td>
                        {c.insufficient
                          ? <Short>표본 부족</Short>
                          : <Level>{c.suggested_level}</Level>}
                      </Td>
                      <Td>
                        <Level $muted={c.current_level == null}>
                          {c.current_level ?? '—'}
                        </Level>
                        {c.basis === 'manual' && c.current_level != null && (
                          <Manual title="사람이 매긴 값입니다. 「반영」은 이 칸을 건너뜁니다.">
                            수기
                          </Manual>
                        )}
                      </Td>
                      <Td>
                        <Roles>
                          {Object.entries(c.by_role || {}).map(([role, stat]) => (
                            <Role key={role} title={`${stat.count}명`}>
                              {role} {stat.average}
                            </Role>
                          ))}
                        </Roles>
                      </Td>
                      <Td>
                        {onApply ? (
                          <Button disabled={busy || c.insufficient}
                                  onClick={() => apply([c])}>
                            반영
                          </Button>
                        ) : '—'}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </SurveyBlock>
        );
      })}

      {outOfScope.length > 0 && (
        // 버리지 않고 세는 이유: 빠뜨리면 "답했는데 아무 데도 안 잡힌" 사람이
        // 생기고, 응답 수 합계가 안 맞는데 화면 어디에도 그 이유가 없다.
        <Warn>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <span>
            <strong>진단 대상 밖 응답이 있습니다:</strong>{' '}
            {outOfScope.map(o => `${o.division_name} ${o.respondent_count}명`).join(', ')}.
            진단은 KPI 를 직접 관리하는 사업부만 하므로 이 응답은 레벨에 들어가지
            않습니다. 집계 화면과 원자료에는 그대로 있습니다.
          </span>
        </Warn>
      )}
    </Wrap>
  );
};

export default SurveyEvidence;
