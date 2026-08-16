import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Plus, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import IssueCard from './IssueCard';
import IssueEditor from './IssueEditor';
import FlowMap from '../FlowMap';
import useWideScreen from '../../hooks/useWideScreen';
import DivisionFilter, {
  countByDivision, inDivision,
} from '../DivisionFilter';
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

const Layout = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
`;

const Wrap = styled.div`
  flex: 1;
  min-width: 0;
  /* 글줄 상한. 본문이 이보다 넓어지면 한 줄이 너무 길어 눈이 줄을 놓친다.
     곁가지(흐름도·후보 열)는 이 상한 **밖**이다. */
  max-width: 1200px;

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

// 묶기 작업대. 고아 목록을 **경고로만** 두면 사람이 할 수 있는 일이 '지우기'
// 뿐이라, 진단의 여러 곳에서 나온 것을 모아 난제를 세우는 길이 막힌다.
const Rollup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.625rem 0.75rem;
  margin-bottom: 0.5rem;
  background: white;
  border: 1px solid #fbbf24;
  border-radius: 0.5rem;
`;

const RollupInput = styled.input`
  flex: 1;
  min-width: 12rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-family: inherit;
  color: #1e293b;
  &:focus { outline: none; border-color: #7c3aed; }
`;

const RollupButton = styled.button`
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 0.375rem;
  background: #7c3aed;
  color: white;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const Pick = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.15rem 0;
  cursor: pointer;
  > input { margin-top: 0.9rem; flex-shrink: 0; }
  > div { flex: 1; min-width: 0; }
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

// 후보에서 가져올 때만 모달로 연다.
//
// 난제 아래 「이슈 추가」나 카드 수정은 **이미 그 자리**에서 열리므로 그대로
// 둔다 — 맥락이 눈앞에 있는데 모달로 덮으면 오히려 나빠진다. 문제는 후보에서
// 가져오는 길 하나였다: 후보 패널이 화면 맨 아래인데 편집기가 그보다 더 아래에
// 열려서, 내려가서 누르고 더 내려가서 적고 다시 맨 위로 올라가 확인해야 했다.
const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1.5rem;
`;

const Sheet = styled.div`
  width: min(720px, 100%);
  max-height: 85vh;
  overflow-y: auto;
  background: #f8fafc;
  border-radius: 0.75rem;
  padding: 1rem;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
`;

const SheetHead = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1e293b;
`;

const SheetHint = styled.span`
  font-size: 0.8125rem;
  font-weight: 500;
  color: #94a3b8;
`;

// 후보를 오른쪽에 세워 두는 자리. **난제 목록을 보면서 고를 수 있어야** 묶기
// 판단이 된다 — 바닥에 있으면 어느 난제와 겹치는지 보려고 위아래로 오간다.
//
// 폭이 되는 화면에서만 나온다. 안 되면 지금까지처럼 바닥에 붙는다.
const Rail = styled.aside`
  position: sticky;
  top: 0;
  align-self: flex-start;
  flex-shrink: 0;
  width: 20rem;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
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
  onCreate, onUpdate, onDelete, onRollup,
}) => {
  // editing: null | { mode:'new'|'edit', crux_id, draft }
  // draft 는 편집기에 미리 채워 넣을 값이다. 수정이면 이슈 그 자체이고,
  // 진단 격차에서 가져온 것이면 후보의 내용이 들어온다.
  const [editing, setEditing] = useState(null);
  const [showDropped, setShowDropped] = useState(false);
  // 묶어서 난제로 만들 이슈. 고아 영역에서만 고른다.
  const [picked, setPicked] = useState([]);
  const [rollupTitle, setRollupTitle] = useState('');
  // null 이면 전체 전략. 사업부를 고르면 그 사업부 것과 **전사 공통**을 함께 본다.
  const [division, setDivision] = useState(null);
  // 방금 만들거나 고친 이슈. 그 자리로 데려가고 잠깐 밝힌다.
  const [flashId, setFlashId] = useState(null);
  // 흐름도(208) + 본문(1200) + 후보 열(320) + 여백이 들어갈 폭.
  const wide = useWideScreen(1760);

  // 곁열과 바닥이 **같은 것**을 그려야 한다. 두 군데에 따로 적으면 한쪽만
  // 고치는 일이 반드시 생긴다.
  const candidatePanel = (asRail) => (
    <CandidatePanel
      rail={asRail}
      candidates={visibleCandidates}
      onBundle={onRollup}
      onPick={(c) => startNew('', {
        title: c.title,
        description: c.detail,
        division_id: c.division_id,
        source_type: c.source_type,
        source_ref: c.source_ref,
      })}
    />
  );

  const divisionName = (id) => divisions.find(d => d.id === id)?.name || null;

  // ⚠️ 난제와 이슈를 **각각** 거른다. 난제만 걸러 그 아래 이슈를 다 보여주면
  //    MX 를 보는데 VD 이슈가 딸려 오고, 이슈만 걸러 난제를 다 보여주면 이슈가
  //    하나도 없는 난제가 잔뜩 뜬다.
  const visibleCruxes = cruxes.filter(c => inDivision(c, division));
  const live = issues.filter(
    i => i.status !== 'dropped' && inDivision(i, division));
  const dropped = issues.filter(
    i => i.status === 'dropped' && inDivision(i, division));
  const orphans = live.filter(i => i.crux_id === null);
  const visibleCandidates = (candidates || []).filter(
    c => inDivision(c, division));
  // 보이는 난제 중 이슈가 하나도 안 달린 것. 서버의 coverage 는 전체 기준이라
  // 필터를 걸면 화면과 어긋난다.
  const emptyCruxCount = visibleCruxes.filter(
    c => !live.some(i => i.crux_id === c.id)).length;

  const save = async (payload) => {
    const res = editing?.mode === 'edit'
      ? await onUpdate(editing.draft.id, payload)
      : await onCreate(payload);
    // 실패하면 폼을 닫지 않는다. 닫으면 쓴 내용이 사라지고 저장된 것처럼 보인다.
    if (res === false) return;
    setEditing(null);
    // 저장한 것이 **다른 곳에** 들어간다 — 후보에서 만들면 화면 위 난제 블록
    // 안으로. 어디로 갔는지 안 알려주면 사람이 눈으로 찾아야 하고, 못 찾으면
    // 같은 것을 또 만든다.
    setFlashId(res?.data?.id ?? editing?.draft?.id ?? null);
  };

  // 목록이 새로 그려진 **뒤에** 찾아간다. 저장 직후에는 그 카드가 아직 없다.
  useEffect(() => {
    if (!flashId) return undefined;
    const el = document.getElementById(`issue-${flashId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // ⚠️ 사업부 필터 때문에 안 보이는 경우. MX 를 보면서 VD 이슈를 만들면
      //    저장은 됐는데 화면에는 없다 — 그러면 사람은 저장이 안 된 줄 알고
      //    또 만든다. **만든 것을 못 보여주느니 필터를 푼다.**
      const made = issues.find(i => i.id === flashId);
      if (made && !inDivision(made, division)) {
        setDivision(null);
        return undefined;      // 다시 그려지면 이 효과가 또 돈다
      }
    }
    const timer = setTimeout(() => setFlashId(null), 2200);
    return () => clearTimeout(timer);
  }, [flashId, issues, division]);

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

  // ⚠️ 진단이 난제를 먼저 남기고 그것을 쪼개는 것이 본줄기지만, 반대 방향도
  //    일어난다 — 진단의 여러 곳에서 나온 것을 각각 이슈로 적어 놓고 보니
  //    **그것들을 관통하는 하나**가 보이는 경우다. 그게 난제다.
  const rollup = async () => {
    const title = rollupTitle.trim();
    if (!title || picked.length === 0) return;
    const ok = await onRollup({ title, issue_ids: picked });
    if (ok !== false) {
      setPicked([]);
      setRollupTitle('');
    }
  };

  const togglePick = (id) => setPicked(prev => (
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  ));

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

  // 이 화면의 흐름. **아래에서 위로 가는 길**도 그린다 — 진단이 난제를 먼저
  // 남기는 것이 본줄기지만, 이슈를 모아 놓고 보니 관통하는 하나가 보이는 일이
  // 실제로 일어난다.
  // ⚠️ 같은 id 를 두 번 넣지 않는다. 두 상자가 같은 자리를 가리키면 눌러도
  //    같은 곳으로 가고, 현재 위치 표시가 둘 다 켜진다.
  //
  // 난제와 이슈는 **한 덩어리**다 — 난제가 축이고 그 아래에 이슈가 달린다.
  // 그래서 상자 하나로 두고, 쪼갠다는 것은 연결선의 말로 적는다.
  const flow = [
    { kind: 'group', label: '① 진단에서' },
    {
      kind: 'node', id: 'sec-issue-cruxes', out: true,
      label: '핵심 난제 ▸ 이슈',
    },
    ...(candidates?.length > 0 ? [{
      kind: 'branch', into: true,
      text: <><strong>이슈 후보</strong>에서 가져와서</>,
    }] : []),
    ...(orphans.length > 0 ? [
      { kind: 'link', note: '난제를 아직 못 정한 것' },
      { kind: 'node', id: 'sec-issue-orphans', label: '난제에 안 걸린 이슈' },
      {
        kind: 'branch',
        text: <>골라서 <strong>난제로 묶기</strong> — 아래에서 위로</>,
      },
    ] : []),
    { kind: 'link', note: '영향도 × 실행가능성' },
    { kind: 'exit', label: '③ 분석 (다음 단계)' },
  ];

  const renderCard = (issue) => (
    isEditing(issue)
      ? <div key={issue.id}>{editor()}</div>
      : (
        <IssueCard
          key={issue.id}
          issue={issue}
          divisionName={divisionName(issue.division_id)}
          flash={flashId === issue.id}
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
    <Layout>
      <FlowMap items={flow} />
      <Wrap>
        <DivisionFilter
          divisions={divisions}
          value={division}
          onChange={setDivision}
          counts={countByDivision(issues.filter(i => i.status !== 'dropped'),
                                  divisions)}
        />
      <Head>
        <Title>이슈</Title>
        {/* 한 줄로 전체 상태가 읽혀야 한다. 아래로 스크롤해야 알 수 있으면
            "할 일이 없는 난제"는 아무도 못 본다. */}
        {/* ⚠️ 서버가 준 coverage 는 **전체 기준**이다. 사업부를 골라 놓고 그
            숫자를 그대로 쓰면 화면에 안 보이는 난제까지 세어져, "할 일이 없는
            난제 3개"라는데 화면에는 하나도 없는 상태가 된다. 보이는 것으로 센다. */}
        <Hint>
          핵심 난제마다, 그것을 넘으려면 무엇을 해야 하는지 적습니다.
          이슈 {live.length}건
          {emptyCruxCount > 0 && ` · 할 일이 없는 난제 ${emptyCruxCount}개`}
          {orphans.length > 0 && ` · 난제에 안 걸린 이슈 ${orphans.length}건`}
        </Hint>
      </Head>

      <CruxGrid id="sec-issue-cruxes">
      {visibleCruxes.map(crux => {
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
        <OrphanBlock id="sec-issue-orphans">
          <OrphanHead>
            <OrphanTitle>어느 난제에도 안 걸린 이슈 · {orphans.length}건</OrphanTitle>
            <OrphanHint>
              전략과 무관한 일을 하고 있다는 신호입니다. 다만 난제 쪽이 틀렸을
              수도 있습니다 — 이슈를 지울지, <strong>골라서 난제로 묶을지</strong>,
              난제를 새로 세울지 판단하세요.
            </OrphanHint>
          </OrphanHead>

          {/* 여러 이슈를 관통하는 하나가 보이면 그것이 난제다. 하나씩 옮기면
              다섯 건에 여섯 번을 눌러야 하고, 빠뜨린 것은 고아로 남는다. */}
          <Rollup>
            <RollupInput
              value={rollupTitle}
              onChange={e => setRollupTitle(e.target.value)}
              placeholder={picked.length > 0
                ? `고른 ${picked.length}건을 관통하는 난제는 무엇입니까?`
                : '아래에서 묶을 이슈를 고르세요'}
              disabled={picked.length === 0}
            />
            <RollupButton
              disabled={picked.length === 0 || !rollupTitle.trim()}
              onClick={rollup}
            >
              {picked.length > 0 ? `${picked.length}건을 난제로 묶기` : '난제로 묶기'}
            </RollupButton>
          </Rollup>

          <Children>
            {orphans.map(issue => (
              isEditing(issue) ? <div key={issue.id}>{editor()}</div> : (
                <Pick key={issue.id}>
                  <input
                    type="checkbox"
                    checked={picked.includes(issue.id)}
                    onChange={() => togglePick(issue.id)}
                    aria-label={`${issue.title} 묶기`}
                  />
                  <div>{renderCard(issue)}</div>
                </Pick>
              )
            ))}
          </Children>
        </OrphanBlock>
      )}

      {/* 곧바로 만들지 않고 편집기를 채워서 연다. 바로 만들면 난제에 안 걸린
          채로 생겨 빨간 경고로 떨어지는데, 그러면 그 경고가 무뎌진다.
          어느 난제 아래인지는 가져올 때 정하는 것이 맞다. */}
      {/* 넓으면 오른쪽 곁열에 세우고, 좁으면 지금까지처럼 바닥에 붙인다.
          **두 곳에 그리지 않는다** — 고른 후보와 적던 제목이 두 벌이 된다. */}
      {!wide && candidatePanel(false)}

      {/* 후보에서 온 것만 난제가 비어 있다. 그때는 어느 난제 아래인지가
          진짜로 정해지지 않았으므로 편집기가 물어본다.

          ⚠️ **모달로 연다.** 후보 패널이 화면 맨 아래인데 편집기를 그보다 더
             아래에 열면, 내려가서 누르고 더 내려가서 적고 다시 맨 위로 올라가
             확인해야 한다. 한 동작인데 화면 세 곳을 오가는 셈이었다. */}
      {editing?.mode === 'new' && editing.crux_id === '' && (
        <Backdrop onClick={() => setEditing(null)}>
          <Sheet onClick={e => e.stopPropagation()}>
            <SheetHead>
              후보를 이슈로
              <SheetHint>
                어느 난제 아래에 둘지 고르세요. 저장하면 그 자리로 데려다 드립니다.
              </SheetHint>
            </SheetHead>
            {editor()}
          </Sheet>
        </Backdrop>
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

      {wide && <Rail>{candidatePanel(true)}</Rail>}
    </Layout>
  );
};

export default IssuesView;
