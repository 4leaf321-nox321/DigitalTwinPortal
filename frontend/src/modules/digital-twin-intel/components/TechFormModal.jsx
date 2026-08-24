import React, { useState } from 'react';
import styled from 'styled-components';
import { X, Radar, AlertTriangle, Plus } from 'lucide-react';

import { STAGES } from './RadarBoard';
import {
  Overlay, Panel, Head, CloseBtn, Body, Foot, Field, TwoCol, Hint, Warn,
  PrimaryBtn, GhostBtn, Spacer,
} from './modalStyles';

const AliasRow = styled.div`
  display: flex;
  gap: 0.375rem;
`;

const Chips = styled.div`
  display: flex;
  gap: 0.3125rem;
  flex-wrap: wrap;
`;

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1875rem 0.5rem;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 999px;
  font-size: 0.6875rem;
  color: #3730a3;

  button { border: none; background: none; color: #818cf8; cursor: pointer; padding: 0; display: flex; }
`;

const SmallBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  padding: 0.4375rem 0.625rem;
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 0.4375rem;
  font-size: 0.75rem;
  color: #475569;
  white-space: nowrap;
  cursor: pointer;

  &:hover { background: #f8fafc; }
`;

const CptGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.3125rem;

  @media (max-width: 560px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
`;

const CptBtn = styled.button`
  display: flex;
  flex-direction: column;
  gap: 0.0625rem;
  padding: 0.375rem 0.5rem;
  border: 1px solid ${(p) => (p.$on ? '#4f46e5' : '#cbd5e1')};
  background: ${(p) => (p.$on ? '#eef2ff' : '#fff')};
  border-radius: 0.4375rem;
  cursor: pointer;
  text-align: left;

  b { font-size: 0.75rem; color: ${(p) => (p.$on ? '#3730a3' : '#334155')}; }
  small { font-size: 0.625rem; color: #94a3b8; }
`;

const StageRow = styled.div`
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
`;

const StageBtn = styled.button`
  padding: 0.3125rem 0.75rem;
  border: 1px solid ${(p) => (p.$on ? p.$color : '#cbd5e1')};
  background: ${(p) => (p.$on ? p.$color : '#fff')};
  color: ${(p) => (p.$on ? '#fff' : '#475569')};
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
`;

/**
 * 기술 등록·편집.
 *
 * ⚠️ 예전에는 `window.prompt` 로 **이름 하나만** 받았다. 그러면 레이더에 이름만
 *    적힌 줄이 쌓이는데, 그건 목록이지 참고 자료가 아니다 — 「이게 뭐였지」에 답을
 *    못 하면 아무도 안 본다.
 *
 * 한 줄이 제 값을 하려면 넷이 있어야 한다 —
 *     요약   **이게 뭐냐.** 목록에서 이것만 읽는다
 *     링크   더 알아보려면 어디로. 없으면 결국 검색을 다시 한다
 *     분류   어느 갈래인지
 *     별칭   같은 기술이 여러 줄 되는 것을 막는다
 */
const TechFormModal = ({ isOpen, initial, onClose, onSave, categories, cptGroups,
                        canCurate, saving }) => {
  const edit = Boolean(initial);
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    vendor: initial?.vendor || '',
    category: initial?.category || '',
    url: initial?.url || '',
    summary: initial?.summary || '',
    description: initial?.description || '',
  }));
  const [aliases, setAliases] = useState(initial?.aliases || []);
  const [aliasInput, setAliasInput] = useState('');
  const [tags, setTags] = useState(initial?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [cpt, setCpt] = useState(initial?.cpt || []);
  // 새로 만들 때만 단계를 여기서 고른다. 편집은 전용 길(권한이 다르다)로 간다.
  const [stage, setStage] = useState(initial?.stage || '관찰');
  const [stageReason, setStageReason] = useState('');

  if (!isOpen) return null;

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const addAlias = () => {
    const v = aliasInput.trim();
    if (!v) return;
    if (!aliases.some((a) => a.toLowerCase() === v.toLowerCase())) {
      setAliases((p) => [...p, v]);
    }
    setAliasInput('');
  };

  const needReason = !edit && stage === '보류' && !stageReason.trim();

  const addTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    if (!tags.some((a) => a.toLowerCase() === v.toLowerCase())) setTags((p) => [...p, v]);
    setTagInput('');
  };

  const toggleCpt = (k) =>
    setCpt((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const submit = () => {
    if (!form.name.trim()) return;
    const body = { ...form, aliases, tags, cpt };
    if (!edit) {
      body.stage = stage;
      if (stageReason.trim()) body.stageReason = stageReason.trim();
    }
    onSave(body);
  };

  return (
    <Overlay onClick={onClose}>
      <Panel $wide="40rem" onClick={(e) => e.stopPropagation()}>
        <Head>
          <Radar size={17} color="#4f46e5" />
          <h2>{edit ? '기술 고치기' : '기술 추가'}</h2>
          <CloseBtn onClick={onClose}><X size={18} /></CloseBtn>
        </Head>

        <Body>
          <TwoCol>
            <Field>
              <span>이름 *</span>
              <input value={form.name} onChange={set('name')}
                     placeholder="예: NVIDIA Omniverse" />
            </Field>
            <Field>
              <span>공급사</span>
              <input value={form.vendor} onChange={set('vendor')}
                     placeholder="예: NVIDIA · 오픈소스" />
            </Field>
          </TwoCol>

          <Field>
            <span>한 줄 요약</span>
            <input value={form.summary} onChange={set('summary')}
                   placeholder="이게 무엇인지 한 문장으로" />
          </Field>
          {/* ⚠️ 요약이 이 창에서 가장 중요한 칸이다 — 목록에서 이것만 읽는다. */}
          <Hint>
            <b>목록에 이 문장이 보입니다.</b> 이름만 적힌 줄은 6개월 뒤 「이게 뭐였지」가
            되고, 그러면 아무도 레이더를 안 봅니다.
          </Hint>

          <TwoCol>
            <Field>
              <span>분류</span>
              <select value={form.category} onChange={set('category')}>
                <option value="">고르지 않음</option>
                {(categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field>
              <span>공식 문서·제품 주소</span>
              <input value={form.url} onChange={set('url')} placeholder="https://" />
            </Field>
          </TwoCol>

          <Field>
            <span>다른 이름 (별칭)</span>
            <AliasRow>
              <input value={aliasInput} onChange={(e) => setAliasInput(e.target.value)}
                     onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAlias(); } }}
                     placeholder="예: Omniverse, OV" />
              <SmallBtn type="button" onClick={addAlias}><Plus size={13} /> 추가</SmallBtn>
            </AliasRow>
          </Field>
          {aliases.length > 0 && (
            <Chips>
              {aliases.map((a, i) => (
                <Chip key={a}>
                  {a}
                  <button type="button"
                          onClick={() => setAliases((p) => p.filter((_, j) => j !== i))}>
                    <X size={11} />
                  </button>
                </Chip>
              ))}
            </Chips>
          )}
          <Hint>
            기사마다 다른 이름으로 나옵니다. 별칭을 적어 두면 소식을 등록할 때
            <b> 같은 줄에 이어 붙습니다</b> — 여러 줄이 되면 레이더가 잡동사니가 됩니다.
          </Hint>

          {/*
            ⚠️ 부채꼴(분류)은 **하나**여야 그림이 그려진다. 그런데 실제 기술은 여러
               갈래에 얽힌다 — OPC UA 는 데이터·연결이면서 표준화다. 얽힌 나머지를
               여기 남기지 않으면 그 사실이 사라진다.
          */}
          <Field>
            <span>얽힌 다른 갈래 (태그)</span>
            <AliasRow>
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                     onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                     placeholder="예: 표준화, 실시간, 오픈소스" />
              <SmallBtn type="button" onClick={addTag}><Plus size={13} /> 추가</SmallBtn>
            </AliasRow>
          </Field>
          {tags.length > 0 && (
            <Chips>
              {tags.map((a, i) => (
                <Chip key={a}>
                  {a}
                  <button type="button" onClick={() => setTags((p) => p.filter((_, j) => j !== i))}>
                    <X size={11} />
                  </button>
                </Chip>
              ))}
            </Chips>
          )}
          <Hint>
            분류는 <b>레이더에서 어느 부채꼴에 놓을지</b>를 정합니다 — 하나만 고를 수
            있습니다. 걸치는 갈래는 여기 태그로 남기세요.
          </Hint>

          {/*
            ⚠️ CPT 는 **우리 분류가 아니라 외부 표준**이다(DTC Capabilities Periodic
               Table v1.1). 값이 고정이라 고르기만 한다 — 자유 입력을 열면 오타가
               섞이고, 그 순간 업계 기준과 대조가 안 된다.
          */}
          <Field>
            <span>DTC 능력 분류 (CPT v1.1)</span>
            <CptGrid>
              {(cptGroups || []).map((g) => (
                <CptBtn key={g.key} type="button" $on={cpt.includes(g.key)}
                        onClick={() => toggleCpt(g.key)}>
                  <b>{g.label}</b>
                  <small>{g.key}</small>
                </CptBtn>
              ))}
            </CptGrid>
          </Field>
          <Hint>
            Digital Twin Consortium 이 정한 <b>디지털 트윈의 여섯 능력</b>입니다.
            기술 하나가 여럿에 걸칩니다 — 걸치는 대로 고르세요.
            업계 기준으로 <b>우리가 어느 능력을 보고 있는지</b>를 세는 데 씁니다.
          </Hint>

          <Field>
            <span>우리한테 어디에 쓸 만한가</span>
            <textarea value={form.description} onChange={set('description')}
                      placeholder="어느 과제·공정에 닿는지, 무엇이 걸림돌인지" />
          </Field>

          {!edit && canCurate && (
            <Field>
              <span>처음 놓을 단계</span>
              <StageRow>
                {STAGES.map((st) => (
                  <StageBtn key={st.key} type="button" $on={stage === st.key}
                            $color={st.color} title={st.desc}
                            onClick={() => setStage(st.key)}>
                    {st.key}
                  </StageBtn>
                ))}
              </StageRow>
            </Field>
          )}

          {!edit && canCurate && stage !== '관찰' && (
            <Field>
              <span>그 단계로 놓는 이유{stage === '보류' ? ' *' : ''}</span>
              <textarea value={stageReason} onChange={(e) => setStageReason(e.target.value)}
                        placeholder="예: MX 해석 과제에서 이미 쓰고 있다" />
            </Field>
          )}

          {needReason && (
            <Warn>
              <AlertTriangle size={13} />
              <span>
                <b>「보류」로 놓을 때는 이유를 적어야 합니다.</b> 안 쓰기로 한 판단이야말로
                근거가 남아야 6개월 뒤 같은 논의를 처음부터 다시 하지 않습니다.
              </span>
            </Warn>
          )}

          {!edit && !canCurate && (
            <Hint>
              새 기술은 <b>「관찰」로 시작</b>합니다. 단계를 옮기는 것은 관리자·사무국의
              판단이라 따로 열려 있습니다.
            </Hint>
          )}

          {edit && (
            <Hint>
              단계는 여기서 바꾸지 않습니다 — 기술 상세 창에서 바꿉니다(권한이 다릅니다).
            </Hint>
          )}
        </Body>

        <Foot>
          <Spacer />
          <GhostBtn onClick={onClose}>취소</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={!form.name.trim() || needReason || saving}>
            {saving ? '저장하는 중…' : (edit ? '저장' : '추가')}
          </PrimaryBtn>
        </Foot>
      </Panel>
    </Overlay>
  );
};

export default TechFormModal;
