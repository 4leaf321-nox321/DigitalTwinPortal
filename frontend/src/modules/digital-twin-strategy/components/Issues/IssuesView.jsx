import React, { useState } from 'react';
import styled from 'styled-components';
import { Plus, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import IssueCard from './IssueCard';
import IssueEditor from './IssueEditor';
import CandidatePanel from './CandidatePanel';

// ② 이슈.
//
// 난제는 "넘어야 할 지점"이라 그대로는 손댈 수 없다. 이슈는 **손댈 수 있는
// 단위**여야 한다. 그래서 이 화면은 난제를 축으로 세워두고, 그 아래에 이슈를
// 매단다.
//
// 이 화면이 반드시 드러내야 하는 두 가지가 있다.
//
//   · 이슈가 없는 난제  — 넘겠다고 해놓고 아무것도 안 하는 것
//   · 난제 없는 이슈    — 전략과 무관한 일을 하고 있는 것
//
// 둘 다 "틀렸다"고 말하지 않는다. 난제 쪽이 틀렸을 수도 있다. 보이게만 한다.
//
// **난제 없이 이슈를 추가하는 입구는 두지 않는다.** 화면 위에 '이슈 추가'
// 버튼을 두면 그것이 고아 이슈를 만드는 주 경로가 된다 — 이 화면이 빨갛게
// 경고하는 바로 그 상태를. 추가는 난제 아래에서만, 또는 진단 격차에서 온다.

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
`;

const Hint = styled.span`
  font-size: 0.8125rem;
  color: #94a3b8;
`;

// 핵심 난제는 많아야 서넛이다(그게 설계다). 넓은 화면에서 세로로만 쌓으면
// 한 난제당 1400px 폭에 짧은 이슈 몇 줄이 놓여 눈이 줄을 놓친다.
// 두 칸으로 접어 읽는 폭을 잡고 스크롤을 줄인다.
const CruxGrid = styled.div`
  display: grid;
  gap: 1.25rem;
  grid-template-columns: 1fr;
  align-items: start;

  @media (min-width: 1200px) {
    grid-template-columns: repeat(auto-fit, minmax(520px, 1fr));
  }
`;

const CruxBlock = styled.section`
  border: 1px solid #e2e8f0;
  border-left: 3px solid #a78bfa;
  border-radius: 0.5rem;
  background: white;
  overflow: hidden;
`;

const CruxHead = styled.div`
  padding: 0.875rem 1.125rem;
  background: #faf5ff;
  border-bottom: 1px solid #f1f5f9;
`;

const CruxTitle = styled.div`
  font-size: 0.9375rem;
  font-weight: 700;
  color: #5b21b6;
`;

const CruxRationale = styled.div`
  font-size: 0.8125rem;
  color: #7c3aed;
  line-height: 1.5;
  margin-top: 0.2rem;
  opacity: 0.85;
`;

const Children = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
`;

const SplitButton = styled.button`
  align-self: flex-start;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.7rem;
  border: 1px dashed #c4b5fd;
  border-radius: 0.375rem;
  background: transparent;
  color: #7c3aed;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;

  &:hover { background: #f5f3ff; }
`;

const Warn = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 0.375rem;
  color: #92400e;
  font-size: 0.8125rem;
  line-height: 1.55;
`;

const OrphanBlock = styled.section`
  border: 1px solid #fecaca;
  border-left: 3px solid #f87171;
  border-radius: 0.5rem;
  background: white;
  overflow: hidden;
`;

const OrphanHead = styled.div`
  padding: 0.875rem 1.125rem;
  background: #fef2f2;
  border-bottom: 1px solid #fee2e2;
`;

const OrphanTitle = styled.div`
  font-size: 0.9375rem;
  font-weight: 700;
  color: #b91c1c;
`;

const OrphanHint = styled.div`
  font-size: 0.8125rem;
  color: #dc2626;
  line-height: 1.55;
  margin-top: 0.2rem;
  opacity: 0.9;
`;

const Toggle = styled.button`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: #64748b;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
`;

const Empty = styled.div`
  padding: 2rem 1.25rem;
  text-align: center;
  color: #94a3b8;
  background: white;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.7;
`;

const IssuesView = ({
  cruxes, issues, candidates, coverage, divisions,
  onCreate, onUpdate, onDelete,
}) => {
  // editing: null | { mode:'new'|'edit', crux_id, draft }
  // draft 는 편집기에 미리 채워 넣을 값이다. 수정이면 이슈 그 자체이고,
  // 진단 격차에서 가져온 것이면 후보의 내용이 들어온다.
  const [editing, setEditing] = useState(null);
  const [showDropped, setShowDropped] = useState(false);

  const divisionName = (id) => divisions.find(d => d.id === id)?.name || null;

  const live = issues.filter(i => i.status !== 'dropped');
  const dropped = issues.filter(i => i.status === 'dropped');
  const orphans = live.filter(i => i.crux_id === null);

  const save = async (payload) => {
    const ok = editing?.mode === 'edit'
      ? await onUpdate(editing.draft.id, payload)
      : await onCreate(payload);
    // 실패하면 폼을 닫지 않는다. 닫으면 쓴 내용이 사라지고 저장된 것처럼 보인다.
    if (ok !== false) setEditing(null);
  };

  // 난제가 맥락에서 이미 정해졌으면 편집기에 넘겨 다시 묻지 않게 한다.
  // 고아 이슈를 수정할 때는 넘기지 않는다 — 그때는 고르는 것이 할 일이다.
  const editor = () => (
    <IssueEditor
      issue={editing.draft}
      cruxes={cruxes}
      divisions={divisions}
      lockedCrux={cruxes.find(c => c.id === editing.crux_id) || null}
      onSave={save}
      onCancel={() => setEditing(null)}
    />
  );

  const startNew = (cruxId, draft = {}) =>
    setEditing({ mode: 'new', crux_id: cruxId, draft: { ...draft, crux_id: cruxId } });

  const cardProps = {
    onEdit: (issue) =>
      setEditing({ mode: 'edit', crux_id: issue.crux_id, draft: issue }),
    onToggleDrop: (issue) =>
      onUpdate(issue.id, { status: issue.status === 'dropped' ? 'open' : 'dropped' }),
    onDelete: (issue) => onDelete(issue.id),
  };

  const isEditing = (issue) =>
    editing?.mode === 'edit' && editing.draft.id === issue.id;

  const renderCard = (issue) => (
    isEditing(issue)
      ? <div key={issue.id}>{editor()}</div>
      : (
        <IssueCard
          key={issue.id}
          issue={issue}
          divisionName={divisionName(issue.division_id)}
          {...cardProps}
        />
      )
  );

  if (!cruxes.length) {
    return (
      <Empty>
        <strong>먼저 ① 진단에서 핵심 난제를 고르세요.</strong>
        <div style={{ marginTop: '0.5rem' }}>
          이슈는 <strong>"그 난제를 넘으려면 무엇을 해야 하는가"</strong>에 대한
          답입니다. 난제 없이 이슈부터 모으면 "느낌상 문제"가 목록이 되고,
          무엇을 왜 하는지가 남지 않습니다.
        </div>
      </Empty>
    );
  }

  return (
    <Wrap>
      <Head>
        <Title>이슈</Title>
        {/* 한 줄로 전체 상태가 읽혀야 한다. 아래로 스크롤해야 알 수 있으면
            "할 일이 없는 난제"는 아무도 못 본다. */}
        <Hint>
          핵심 난제마다, 그것을 넘으려면 무엇을 해야 하는지 적습니다.
          이슈 {live.length}건
          {coverage?.cruxesWithoutIssues?.length > 0 &&
            ` · 할 일이 없는 난제 ${coverage.cruxesWithoutIssues.length}개`}
          {orphans.length > 0 && ` · 난제에 안 걸린 이슈 ${orphans.length}건`}
        </Hint>
      </Head>

      <CruxGrid>
      {cruxes.map(crux => {
        const children = live.filter(i => i.crux_id === crux.id);
        return (
          <CruxBlock key={crux.id}>
            <CruxHead>
              <CruxTitle>{crux.title}</CruxTitle>
              {crux.rationale && <CruxRationale>{crux.rationale}</CruxRationale>}
            </CruxHead>
            <Children>
              {children.length === 0 && editing?.crux_id !== crux.id && (
                <Warn>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                  <span>
                    <strong>이 난제를 넘으려면 무엇을 해야 합니까?</strong>{' '}
                    올해 넘겠다고 정해놓고 할 일은 아직 하나도 적지 않았습니다.
                    할 일이 안 떠오르면 난제가 너무 크거나, 애초에 난제가 아닐 수
                    있습니다.
                  </span>
                </Warn>
              )}
              {children.map(renderCard)}

              {/* 라벨에 '쪼개기' 같은 말을 쓰지 않는다. 그 말을 이해해야 누를
                  수 있는 버튼이 된다. 이 버튼은 난제 카드 **안**에 있으므로
                  위치가 이미 "이 난제의" 를 말해준다. */}
              {editing?.mode === 'new' && editing.crux_id === crux.id
                ? editor()
                : (
                  <SplitButton onClick={() => startNew(crux.id)}>
                    <Plus size={14} /> 이슈 추가
                  </SplitButton>
                )}
            </Children>
          </CruxBlock>
        );
      })}
      </CruxGrid>

      {orphans.length > 0 && (
        <OrphanBlock>
          <OrphanHead>
            <OrphanTitle>어느 난제에도 안 걸린 이슈 · {orphans.length}건</OrphanTitle>
            <OrphanHint>
              전략과 무관한 일을 하고 있다는 신호입니다. 다만 난제 쪽이 틀렸을
              수도 있습니다 — 이슈를 지울지, 난제를 새로 세울지 판단하세요.
            </OrphanHint>
          </OrphanHead>
          <Children>{orphans.map(renderCard)}</Children>
        </OrphanBlock>
      )}

      {/* 곧바로 만들지 않고 편집기를 채워서 연다. 바로 만들면 난제에 안 걸린
          채로 생겨 빨간 경고로 떨어지는데, 그러면 그 경고가 무뎌진다.
          어느 난제 아래인지는 가져올 때 정하는 것이 맞다. */}
      <CandidatePanel
        candidates={candidates}
        onPick={(c) => startNew('', {
          title: c.title,
          description: c.detail,
          division_id: c.division_id,
          source_type: c.source_type,
          source_ref: c.source_ref,
        })}
      />

      {/* 후보에서 온 것만 난제가 비어 있다. 그때는 어느 난제 아래인지가
          진짜로 정해지지 않았으므로 편집기가 물어본다. */}
      {editing?.mode === 'new' && editing.crux_id === '' && (
        <div style={{ marginTop: '-0.5rem' }}>{editor()}</div>
      )}

      {dropped.length > 0 && (
        <div>
          <Toggle onClick={() => setShowDropped(v => !v)}>
            {showDropped ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            올해는 안 하기로 한 것 {dropped.length}건
          </Toggle>
          {showDropped && (
            <Children style={{ padding: 0 }}>{dropped.map(renderCard)}</Children>
          )}
        </div>
      )}
    </Wrap>
  );
};

export default IssuesView;
