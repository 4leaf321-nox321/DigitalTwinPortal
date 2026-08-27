import React, { useState } from 'react';
import styled from 'styled-components';
import {
  Plus, Trash2, Info, AlertTriangle, ClipboardList,
} from 'lucide-react';
import FlowMap from '../FlowMap';
import DivisionFilter, {
  countByDivision, inDivision,
} from '../DivisionFilter';
import ElementCandidatePanel from './ElementCandidatePanel';
import useWideScreen from '../../hooks/useWideScreen';

// ③ 분석 — SWOT.
//
// ⚠️ **격자를 주면 채우는 것이 목적이 된다.** 진단에서 세부 판단 격자를 맨
//    아래로 내리고 접어 둔 것과 같은 함정이다. 그래서 네 칸을 백지로 주지 않고
//    진단·발견 사항에서 **후보를 뽑아 내민다.**
//
// ⚠️ **근거의 무게가 칸마다 다르다.** S·W 는 진단·발견 사항에서 나오지만 O·T 는
//    사람에게 묻거나(설문) 바깥을 봐야(기술 소식) 안다. 넷을 같은 모양으로 두면
//    O·T 가 인상평으로 채워진다. 그래서 **선으로 가르고**, 아래 절반에는 어디서
//    채워야 하는지를 적는다.
//
// ⚠️ 비어 있다고 틀린 것이 아니다. 특히 O·T 는 설문·기술 소식이 쌓이기 전에는
//    빌 수밖에 없다. 무엇이 비었는지 세어 주기만 하고 진행을 막지 않는다.

const Layout = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
`;

const Wrap = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  /* 글줄 상한. 본문이 이보다 넓어지면 한 줄이 너무 길어 눈이 줄을 놓친다.
     곁가지(흐름도·후보 열)는 이 상한 **밖**이다.

     이슈 화면과 같은 1120 이다. SWOT 두 칸은 992 면 나뉘므로 넉넉하고,
     남는 폭은 후보 곁열이 쓰는 편이 낫다. */
  max-width: 1120px;

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

// 후보를 오른쪽에 세워 두는 자리. **SWOT 네 칸을 보면서 고를 수 있어야** 판단이
// 된다 — 바닥에 있으면 이미 올린 것과 겹치는지 보려고 위아래로 오간다.
// 이슈 화면의 「진단 격차에서 가져오기」와 같은 구조다.
//
// 폭이 되는 화면에서만 나온다. 안 되면 지금까지처럼 바닥에 붙는다.
const Rail = styled.aside`
  position: sticky;
  top: 0;
  align-self: flex-start;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;

  flex: 1 1 22rem;
  min-width: 22rem;
  max-width: 30rem;
`;

const KIND = {
  S: { label: '강점', color: '#0f766e' },
  W: { label: '약점', color: '#b45309' },
  O: { label: '기회', color: '#1d4ed8' },
  T: { label: '위협', color: '#b91c1c' },
};

const AnalysisView = ({
  elements, candidates, summary, divisions, canEdit,
  onCreate, onUpdate, onDelete,
}) => {
  const [draft, setDraft] = useState({});
  // 곁열을 세울 폭이 되는가. 이슈 화면과 같은 기준이다.
  const wide = useWideScreen(1800);
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

  // ⚠️ **「없다」와 「기준 때문에 없다」는 다른 말이다.**
  //
  //    한 사이클을 실제로 돌려 보니 강점 후보가 0건이었는데, 화면은 그냥
  //    비어 있었다. 원인은 기준이 5단계로 저장돼 있고 진단 최고가 4단계여서 —
  //    즉 **아무리 기다려도 안 나오는 상태**였는데 사람은 알 길이 없었다.
  //    뒤쪽 문장만이 다음에 무엇을 할지 알려준다.
  const whyEmpty = (kind) => {
    const left = summary?.candidateCounts?.[kind];
    if (left) {
      return `아직 없습니다. 오른쪽 후보 ${left}건에서 올리거나 직접 적으세요.`;
    }
    if (kind === 'O' || kind === 'T') {
      return '아직 없습니다. 설문과 기술 소식(근거를 건 것)에서 옵니다 — '
        + '설문을 돌리거나, 기술정보에 근거를 잇거나, 직접 적으세요.';
    }
    const at = kind === 'S' ? summary?.strongAt : summary?.weakAt;
    const edge = kind === 'S' ? summary?.maxLevel : summary?.minLevel;
    if (at != null && edge != null) {
      const over = kind === 'S' ? edge < at : edge > at;
      if (over) {
        return `후보도 없습니다. ${KIND[kind].label} 기준이 ${at}단계인데 `
          + `진단은 ${kind === 'S' ? '최고' : '최저'}가 ${edge}단계입니다 — `
          + '기준을 ⚙ 설정에서 바꾸지 않으면 후보가 생기지 않습니다.';
      }
    }
    return '아직 없습니다. 직접 적으세요.';
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
          <Empty>{whyEmpty(kind)}</Empty>
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
                  disabled={!canEdit}
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
            {canEdit && (
              <IconButton onClick={() => onDelete(e.id)} title="삭제">
                <Trash2 size={13} />
              </IconButton>
            )}
          </Item>
        ))}

        {canEdit && (
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
        )}
      </Box>
    );
  };

  const candidatePanel = (asRail) => (
    <ElementCandidatePanel
      candidates={shownCandidates}
      kinds={KIND}
      rail={asRail}
      onPromote={(c) => onCreate({
        kind: c.kind, title: c.title, detail: c.detail,
        division_id: c.division_id,
        source_type: c.source_type, source_ref: c.key,
      })}
    />
  );

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
            ④ 솔루션이 <strong>S×O · W×O · S×T · W×T</strong> 네 조합에서
            솔루션을 뽑습니다. 그래서 네 칸이 다 있어야 합니다 — 다만 전부 채울 의무는
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
              <strong>진단 규칙이 못 만드는 정보입니다.</strong> 한 사람이 백지에
              적으면 그건 전략이 아니라 그 사람의 인상입니다.{' '}
              <strong>설문으로 묻거나</strong>(「3년 안에 마주할 가장 큰 위협은?」),
              <strong> 기술 소식</strong>(근거를 건 것)을 후보로 받으세요. 다만 그렇게
              모은 것도 <strong>현장이 인식하는</strong> 기회·위협이지 시장 그 자체는
              아닙니다.
            </span>
          </HalfLabel>
          <Pair>{box('O')}{box('T')}</Pair>
        </Half>

        {canEdit && !wide && candidatePanel(false)}
      </Wrap>

      {canEdit && wide && <Rail>{candidatePanel(true)}</Rail>}
    </Layout>
  );
};

export default AnalysisView;
