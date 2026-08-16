import React, { useState } from 'react';
import styled from 'styled-components';
import {
  Plus, Trash2, ArrowDown, Info, AlertTriangle, ClipboardList, ChevronDown,
} from 'lucide-react';
import FlowMap from '../FlowMap';
import DivisionFilter, {
  countByDivision, inDivision,
} from '../DivisionFilter';

// ③ 분석 — SWOT.
//
// ⚠️ **격자를 주면 채우는 것이 목적이 된다.** 진단에서 세부 판단 격자를 맨
//    아래로 내리고 접어 둔 것과 같은 함정이다. 그래서 네 칸을 백지로 주지 않고
//    진단·발견 사항에서 **후보를 뽑아 내민다.**
//
// ⚠️ **근거의 무게가 칸마다 다르다.** S·W 는 포탈 데이터에서 나오지만 O·T 는
//    포탈에 없는 정보다. 넷을 같은 모양으로 두면 O·T 가 인상평으로 채워진다.
//    그래서 **선으로 가르고**, 아래 절반에는 어디서 채워야 하는지를 적는다.
//
// ⚠️ 비어 있다고 틀린 것이 아니다. 특히 O·T 는 설문을 돌리기 전에는 빌 수밖에
//    없다. 무엇이 비었는지 세어 주기만 하고 진행을 막지 않는다.

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
  align-items: baseline;
  gap: 0.625rem;
  flex-wrap: wrap;
`;

const StepBadge = styled.span`
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: #ede9fe;
  color: #6d28d9;
  font-size: 0.75rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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

// 근거 있는 절반과 없는 절반. **선으로 가르는 것이 이 화면의 요점**이다.
const Half = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 0.875rem;
  border-radius: 0.625rem;
  border: 1px solid ${p => (p.$grounded ? '#ddd6fe' : '#fde68a')};
  background: ${p => (p.$grounded ? '#faf8ff' : '#fffdf5')};
`;

const HalfLabel = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  font-size: 0.75rem;
  line-height: 1.6;
  color: ${p => (p.$grounded ? '#6d28d9' : '#92400e')};
`;

const Pair = styled.div`
  display: grid;
  gap: 0.75rem;
  grid-template-columns: 1fr;
  @media (min-width: 62rem) { grid-template-columns: 1fr 1fr; }
`;

const Box = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const BoxHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const Kind = styled.span`
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 0.3rem;
  display: grid;
  place-items: center;
  font-size: 0.75rem;
  font-weight: 800;
  color: white;
  background: ${p => p.$color};
`;

const BoxTitle = styled.span`
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
`;

const Count = styled.span`
  margin-left: auto;
  font-size: 0.75rem;
  color: #94a3b8;
`;

const Item = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  border-radius: 0.375rem;
  background: #f8fafc;
  font-size: 0.8125rem;
  line-height: 1.55;
  color: #334155;
`;

const ItemBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const ItemDetail = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.15rem;
`;

// 요소가 어느 사업부 것인가. **고칠 수 있어야 한다** — 후보가 달아 준 사업부가
// 늘 맞지는 않고, 틀리면 그 요소가 엉뚱한 사업부의 전략에 앉는다.
// 특히 '전사' 로 잘못 들어간 것은 **모든 사업부에 다 뜬다.**
const Where = styled.select`
  padding: 0.05rem 0.2rem;
  border: 1px solid transparent;
  border-radius: 0.25rem;
  background: transparent;
  color: #64748b;
  font-size: 0.6875rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  &:hover { border-color: #cbd5e1; background: white; }
`;

const IconButton = styled.button`
  flex-shrink: 0;
  padding: 0.2rem;
  border: none;
  border-radius: 0.25rem;
  background: transparent;
  color: #cbd5e1;
  cursor: pointer;
  display: flex;
  &:hover { background: #fef2f2; color: #dc2626; }
`;

const Empty = styled.div`
  padding: 0.75rem 0.5rem;
  color: #94a3b8;
  font-size: 0.8125rem;
  line-height: 1.6;
`;

const AddRow = styled.div`
  display: flex;
  gap: 0.4rem;
`;

const Input = styled.input`
  flex: 1;
  min-width: 0;
  padding: 0.35rem 0.55rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-family: inherit;
  color: #1e293b;
  &:focus { outline: none; border-color: #7c3aed; }
`;

const AddButton = styled.button`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.35rem 0.6rem;
  border: 1px dashed #cbd5e1;
  border-radius: 0.375rem;
  background: transparent;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { border-color: #7c3aed; color: #6d28d9; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

// 후보 — 백지에서 시작하지 않게 하는 장치. 자동으로 요소가 되지는 않는다.
const Candidates = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.875rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.625rem;
`;

const CandidateRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.45rem 0.5rem;
  border-radius: 0.375rem;
  &:hover { background: #f8fafc; }
`;

const PromoteButton = styled.button`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.3rem;
  background: white;
  color: #475569;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { border-color: #7c3aed; color: #6d28d9; }
`;

const KIND = {
  S: { label: '강점', color: '#0f766e' },
  W: { label: '약점', color: '#b45309' },
  O: { label: '기회', color: '#1d4ed8' },
  T: { label: '위협', color: '#b91c1c' },
};

// 후보가 길면 접는다. 스물넷을 한 번에 펴 두면 그 아래 화면이 안 보이고,
// 목록이 길다는 이유만으로 안 읽힌다.
const VISIBLE_CANDIDATES = 8;

const AnalysisView = ({
  elements, candidates, summary, divisions, onCreate, onUpdate, onDelete,
}) => {
  const [draft, setDraft] = useState({});
  const [showAll, setShowAll] = useState(false);
  // null 이면 전체 전략. 사업부를 고르면 그 사업부 것과 **전사 공통**을 함께 본다.
  const [division, setDivision] = useState(null);

  const divisionName = (id) => divisions.find(d => d.id === id)?.name || null;
  const shown = (elements || []).filter(e => inDivision(e, division));
  const shownCandidates = (candidates || []).filter(c => inDivision(c, division));
  const of = (kind) => shown.filter(e => e.kind === kind);

  const add = async (kind) => {
    const title = (draft[kind] || '').trim();
    if (!title) return;
    // 사업부를 골라 놓고 적으면 그 사업부 것이다. 전체 보기면 전사 항목이 된다.
    const ok = await onCreate({
      kind, title, source_type: 'manual', division_id: division,
    });
    if (ok !== false) setDraft(d => ({ ...d, [kind]: '' }));
  };

  const box = (kind) => {
    const items = of(kind);
    return (
      <Box>
        <BoxHead>
          <Kind $color={KIND[kind].color}>{kind}</Kind>
          <BoxTitle>{KIND[kind].label}</BoxTitle>
          <Count>{items.length}건</Count>
        </BoxHead>

        {items.length === 0 ? (
          <Empty>
            {kind === 'O' || kind === 'T'
              ? '아직 없습니다. 설문으로 물어보거나 직접 적으세요.'
              : '아직 없습니다. 아래 후보에서 올리거나 직접 적으세요.'}
          </Empty>
        ) : items.map(e => (
          <Item key={e.id}>
            <ItemBody>
              {e.title}
              <ItemDetail>
                {/* 사업부를 골라 놓고 봐도 전사 항목은 같이 보인다. 그 사실을
                    적지 않으면 그 사업부만의 것으로 읽힌다. 그리고 **여기서
                    고칠 수 있어야 한다** — 전사로 잘못 들어간 것은 모든
                    사업부에 다 뜬다. */}
                <Where
                  value={e.division_id ?? ''}
                  onChange={ev => onUpdate(e.id, {
                    division_id: ev.target.value === '' ? null
                      : Number(ev.target.value),
                  })}
                  title="이 요소가 어느 사업부의 것인지"
                >
                  <option value="">전사 (모든 사업부에 보임)</option>
                  {divisions.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </Where>
                {e.detail && ` · ${e.detail}`}
              </ItemDetail>
            </ItemBody>
            <IconButton onClick={() => onDelete(e.id)} title="삭제">
              <Trash2 size={13} />
            </IconButton>
          </Item>
        ))}

        <AddRow>
          <Input
            value={draft[kind] || ''}
            onChange={ev => setDraft(d => ({ ...d, [kind]: ev.target.value }))}
            onKeyDown={ev => { if (ev.key === 'Enter') add(kind); }}
            placeholder={`${KIND[kind].label} 직접 적기`}
          />
          <AddButton disabled={!(draft[kind] || '').trim()} onClick={() => add(kind)}>
            <Plus size={13} /> 추가
          </AddButton>
        </AddRow>
      </Box>
    );
  };

  const flow = [
    { kind: 'group', label: '① 진단 · ② 이슈에서' },
    { kind: 'node', id: 'sec-swot-grounded', label: 'S 강점 · W 약점' },
    { kind: 'branch', into: true, text: <>진단 레벨과 <strong>발견 사항</strong>에서</> },
    { kind: 'node', id: 'sec-swot-open', label: 'O 기회 · T 위협' },
    { kind: 'branch', into: true, text: <><strong>설문</strong>으로 물어서</> },
    { kind: 'link', note: '네 칸을 조합해서' },
    { kind: 'exit', label: '④ 솔루션 (다음 단계)' },
  ];

  return (
    <Layout>
      <FlowMap items={flow} />
      <Wrap>
        <DivisionFilter
          divisions={divisions}
          value={division}
          onChange={setDivision}
          counts={countByDivision(elements || [], divisions)}
        />

        <Head>
          <StepBadge>3</StepBadge>
          <Title>
            SWOT{division !== null && ` · ${divisionName(division)}`}
          </Title>
          <Hint>
            ④ 솔루션이 <strong>S×O · W×O · S×T · W×T</strong> 네 조합에서 수를
            뽑습니다. 그래서 네 칸이 다 있어야 합니다 — 다만 전부 채울 의무는
            없습니다.
          </Hint>
        </Head>

        {summary?.emptyKinds?.length > 0 && (
          <HalfLabel>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <span>
              비어 있는 칸: <strong>{summary.emptyKinds.map(k => KIND[k].label).join(', ')}</strong>.
              그 칸이 들어가는 조합은 ④ 에서 안 만들어집니다.
            </span>
          </HalfLabel>
        )}

        {/* 근거 있는 절반 */}
        <Half $grounded id="sec-swot-grounded">
          <HalfLabel $grounded>
            <Info size={14} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <span>
              <strong>근거가 있습니다.</strong> 진단 레벨과 발견 사항에서 나옵니다 —
              아래 후보에서 올리세요.
            </span>
          </HalfLabel>
          <Pair>{box('S')}{box('W')}</Pair>
        </Half>

        {/* 근거 없는 절반 — 이 구분이 화면의 요점이다 */}
        <Half id="sec-swot-open">
          <HalfLabel>
            <ClipboardList size={14} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <span>
              <strong>포탈에 없는 정보입니다.</strong> 한 사람이 백지에 적으면 그건
              전략이 아니라 그 사람의 인상입니다. <strong>설문으로 물어보세요</strong> —
              「3년 안에 마주할 가장 큰 위협은?」은 설문 문항입니다. 다만 그렇게 모은
              것도 <strong>현장이 인식하는</strong> 기회·위협이지 시장 그 자체는
              아닙니다.
            </span>
          </HalfLabel>
          <Pair>{box('O')}{box('T')}</Pair>
        </Half>

        {/* 후보 — 자동으로 올리지 않는다 */}
        {shownCandidates.length > 0 && (
          <Candidates>
            <BoxHead>
              <BoxTitle>후보 {shownCandidates.length}건</BoxTitle>
              <Count>진단·발견 사항에서 뽑았습니다. 고르는 것은 사람입니다.</Count>
            </BoxHead>
            {(showAll ? shownCandidates : shownCandidates.slice(0, VISIBLE_CANDIDATES)).map(c => (
              <CandidateRow key={c.key}>
                <Kind $color={KIND[c.kind].color}>{c.kind}</Kind>
                <ItemBody>
                  <div style={{ fontSize: '0.8125rem', color: '#1e293b' }}>{c.title}</div>
                  {c.detail && <ItemDetail>{c.detail}</ItemDetail>}
                </ItemBody>
                <PromoteButton
                  onClick={() => onCreate({
                    kind: c.kind, title: c.title, detail: c.detail,
                    division_id: c.division_id,
                    source_type: c.source_type, source_ref: c.key,
                  })}
                  title={`${KIND[c.kind].label}으로 올립니다`}
                >
                  <ArrowDown size={13} /> {KIND[c.kind].label}으로
                </PromoteButton>
              </CandidateRow>
            ))}
            {shownCandidates.length > VISIBLE_CANDIDATES && (
              <AddButton onClick={() => setShowAll(v => !v)}
                         style={{ alignSelf: 'flex-start' }}>
                <ChevronDown size={13} />
                {showAll
                  ? '접기'
                  : `나머지 ${shownCandidates.length - VISIBLE_CANDIDATES}건 더 보기`}
              </AddButton>
            )}
          </Candidates>
        )}
      </Wrap>
    </Layout>
  );
};

export default AnalysisView;
