import React, { useState } from 'react';
import styled from 'styled-components';
import { X, Radar, AlertTriangle, Plus, Layers } from 'lucide-react';

import { STAGES, STAGE_NEW } from './RadarBoard';
import CapabilityPicker from './CapabilityPicker';
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

/*
  층 고르기. ⚠️ **드롭다운으로 두지 않았다** — 이 창에서 가장 먼저 정해야 하는
  것이고, 두 값의 뜻이 서로 다르다는 것을 글로 읽혀야 하기 때문이다.
*/
const KindRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.375rem;
`;

const KindBtn = styled.button`
  text-align: left;
  padding: 0.5rem 0.625rem;
  border: 1px solid ${(p) => (p.$on ? '#818cf8' : '#e2e8f0')};
  background: ${(p) => (p.$on ? '#eef2ff' : '#fff')};
  border-radius: 0.5rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;

  &:disabled { cursor: not-allowed; opacity: 0.55; }

  b { font-size: 0.8125rem; color: ${(p) => (p.$on ? '#3730a3' : '#0f172a')}; }
  small { font-size: 0.6875rem; color: #64748b; line-height: 1.45; }
`;

/* 역량 고르기 단추. ⚠️ **고른 것이 이름으로 보여야** 한다 — 「고르기」만 있으면
   눌러 보기 전에는 무엇이 골라졌는지 알 수 없다. */
const PickBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4375rem;
  width: 100%;
  text-align: left;
  padding: 0.4375rem 0.5625rem;
  border-radius: 0.4375rem;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$set ? '#818cf8' : '#cbd5e1')};
  background: ${(p) => (p.$set ? '#eef2ff' : '#fff')};
  color: ${(p) => (p.$set ? '#3730a3' : '#64748b')};

  &:hover { border-color: #a5b4fc; }

  /* ⚠️ **이름은 안 자른다.** 무엇을 골랐는지 확인하는 자리인데 잘리면 확인이
     안 된다. 길면 줄을 접어 단추가 조금 높아질 뿐이다. */
  b { flex: 1; min-width: 0; font-size: 0.8125rem; font-weight: ${(p) => (p.$set ? 600 : 400)};
      white-space: normal; word-break: keep-all; line-height: 1.4; }
  em { font-style: normal; font-size: 0.6875rem; color: #6366f1; flex-shrink: 0; }
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
                        capabilities, canCurate, saving }) => {
  const edit = Boolean(initial);
  const hasChildren = (initial?.children || []).length > 0;
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
  /*
    ⚠️ **기본은 도구다.** 들어오는 것의 대부분이 제품이라, 기본을 역량으로 두면
       역량 목록이 곧바로 잡동사니가 된다.
  */
  const [kind, setKind] = useState(initial?.kind || 'tool');
  // ⚠️ **여럿이다.** 한 도구가 여러 역량에 걸린다(546개 중 58개).
  const [capUuids, setCapUuids] = useState(initial?.capabilityUuids || []);

  /*
    ⚠️⚠️ **칸마다 어느 층의 사실인지 다르다.** 둘 다에 다 보여 주면 「역량의 공급사」
       같은 것을 적게 되고, 그 값은 **아무 데도 안 쓰이면서 화면만 어지럽힌다.**
       규칙은 두 줄이다 (서버도 같은 규칙을 본다 — models.py 참고).

           공급사 · 제품 주소       **도구에만.** 역량은 파는 회사가 없다
           분야 · 태그 · DTC 분류   **레이더에 서는 줄에만**
                                    (= 역량이거나, 아직 안 매단 도구)

    ⚠️ 자료로 확인 — 역량 39개 중 공급사ㆍ주소가 적힌 것 0개. 반대로 매달린 도구는
       부채꼴에 안 서는데 116개가 전부 분류를 들고 있었고, 그중 3개는 상위 역량과
       **다른 부채꼴**이었다. 안 그려지니 어긋난 줄도 몰랐다.
  */
  const [pickerOpen, setPickerOpen] = useState(false);
  const isCap = kind === 'capability';
  const showVendor = !isCap;
  const showSector = isCap || capUuids.length === 0;
  const capNames = (capabilities || [])
    .filter((c) => capUuids.includes(c.uuid)).map((c) => c.name);
  /*
    새로 만들 때만 단계를 여기서 고른다. 편집은 전용 길(권한이 다르다)로 간다.

    ⚠️⚠️ **기본값은 서버와 같아야 한다**(2026-08-26 점검). 여기만 「관찰」이라
       아무도 안 본 것이 「지켜보기로 정했다」로 들어갔다. 서버는 「감지」로 만든다.
  */
  const [stage, setStage] = useState(initial?.stage || STAGE_NEW);
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

  /*
    ⚠️⚠️ **역량은 단계를 안 갖는다**(2026-08-26). 역량인데 「보류」를 골라 두면
       서버가 버릴 값 때문에 「추가」 단추가 **영영 안 켜졌다.** 아래에서 칸 자체를
       안 그리므로 여기서도 안 묻는다.
  */
  // ⚠️ 단계를 여기서 안 정하니 물을 이유도 없다(2026-08-27).
  const needReason = false;

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
    /*
      ⚠️ **안 보이는 칸은 안 보낸다.** 화면에서만 감추고 값을 그대로 실어 보내면,
         역량으로 바꿔 저장했을 때 옛 공급사가 조용히 되살아난다. 서버도 같은
         규칙으로 한 번 더 막지만, 두 곳이 같은 말을 해야 한다.
      ⚠️ 다만 **분류ㆍ태그ㆍCPT 는 지우지 않는다** — 나중에 떼어 내면 그 도구가
         다시 레이더에 서므로 그때 필요하다. 안 보낼 뿐이다.
    */
    const body = { ...form, kind };
    if (!showVendor) { body.vendor = ''; body.url = ''; }
    if (showSector) {
      body.tags = tags;
      body.cpt = cpt;
    }
    body.aliases = aliases;
    // ⚠️ 역량은 다른 것 밑에 못 매단다. 층을 바꿔 놓고 상위가 남으면 서버가 물린다.
    body.capabilityUuids = kind === 'capability' ? [] : capUuids;
    /*
      ⚠️ **역량은 단계를 안 보낸다.** 서버도 버리지만, 보내면 「그런 것이 있나 보다」로
         읽히고 다음 사람이 칸을 만든다. 단계는 사업부 줄에만 산다.
    */
    // ⚠️ 단계는 안 보낸다 — 서버도 버린다. 보내면 「그런 것이 있나 보다」로 읽힌다.
    onSave(body);
  };

  return (
    <Overlay onClick={onClose}>
      {/* ⚠️ 층 고르기가 두 칸으로 서고 CPT 가 세 칸으로 서는 창이라 좁으면 답답하다. */}
      <Panel $wide="52rem" onClick={(e) => e.stopPropagation()}>
        <Head>
          <Radar size={17} color="#4f46e5" />
          <h2>{edit ? '기술 고치기' : '기술 추가'}</h2>
          <CloseBtn onClick={onClose}><X size={18} /></CloseBtn>
        </Head>

        <Body>
          {/*
            ⚠️ **층을 맨 위에서 묻는다.** 뒤에 두면 이름부터 적고 넘어가 버리고,
               그러면 전부 도구로 쌓여 사업부 비교가 원리적으로 불가능해진다 —
               MX 가 LS-DYNA, VD 가 RADIOSS 면 둘 다 「도입」인데 서로 다른 줄이라
               누가 앞섰는지 읽을 수 없다.
          */}
          <Field>
            <span>층 *</span>
            <KindRow>
              <KindBtn type="button" $on={kind === 'tool'}
                       disabled={hasChildren}
                       title={hasChildren
                         ? '매달린 도구가 있어 지금은 못 내립니다'
                         : '제품 하나. 소식은 이 이름으로 들어옵니다'}
                       onClick={() => setKind('tool')}>
                <b>도구</b>
                <small>제품ㆍ규격ㆍ오픈소스. 소식이 걸리는 자리 (LS-DYNA, OpenUSD)</small>
              </KindBtn>
              <KindBtn type="button" $on={kind === 'capability'}
                       title="여러 도구가 같은 일을 할 때 그 「일」을 역량으로 둡니다"
                       onClick={() => setKind('capability')}>
                <b>역량</b>
                <small>도구를 묶는 「하는 일」. 레이더에 서는 자리 (explicit 해석)</small>
              </KindBtn>
            </KindRow>
          </Field>

          {/*
            ⚠️⚠️ **드롭다운으로 두면 못 고른다.** 역량이 수십 개인데 한 줄로 늘어놓으면
               「어떤 걸 골라야 하지」가 되고, 그러면 아무거나 고르거나 그냥 안 고른다 —
               안 고른 도구는 미아가 되어 **어느 사업부 표에도 안 나온다**
               (2026-08-25 신고). 분야로 묶어 보여주는 창을 따로 띄운다.
          */}
          {kind === 'tool' && (
            <Field>
              <span>소속 역량</span>
              <PickBtn type="button" $set={capUuids.length > 0}
                       onClick={() => setPickerOpen(true)}>
                <Layers size={14} />
                {/* ⚠️ 고른 것을 **전부** 적는다 — 하나만 적으면 나머지가 숨는다. */}
                <b>{capNames.length
                  ? capNames.join(' · ')
                  : '소속 없음 — 눌러서 고르세요'}</b>
                <em>{capUuids.length ? `바꾸기 (${capUuids.length})` : '고르기'}</em>
              </PickBtn>
            </Field>
          )}
          {kind === 'tool' && (
            <Hint>
              매달면 <b>레이더에는 역량만 서고</b> 이 도구의 소식은 그 역량의 근거로
              함께 셉니다. 안 매달아도 됩니다 — 그때는 지금처럼 혼자 레이더에 섭니다.
            </Hint>
          )}
          {edit && hasChildren && (
            <Warn>
              <AlertTriangle size={13} />
              <span>
                이 역량에 도구 {initial.children.length}개가 매달려 있어 <b>도구로 못
                내립니다.</b> 먼저 그 도구들을 다른 역량으로 옮기거나 떼어 내세요 —
                그냥 내리면 매달려 있던 것이 레이더에 한꺼번에 쏟아집니다.
              </span>
            </Warn>
          )}

          {showVendor ? (
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
          ) : (
            <Field>
              <span>이름 *</span>
              <input value={form.name} onChange={set('name')}
                     placeholder="예: explicit 해석 · 유동 해석 (CFD)" />
            </Field>
          )}

          <Field>
            <span>요약</span>
            <input value={form.summary} onChange={set('summary')}
                   placeholder="이게 무엇인지 한 문장으로" />
          </Field>
          {/* ⚠️ 요약이 이 창에서 가장 중요한 칸이다 — 목록에서 이것만 읽는다. */}
          <Hint>
            <b>목록에 이 문장이 보입니다.</b> 이름만 적힌 줄은 6개월 뒤 「이게 뭐였지」가
            되고, 그러면 아무도 레이더를 안 봅니다.
          </Hint>

          {(showSector || showVendor) && (
            <TwoCol>
              {showSector && (
                <Field>
                  <span>분야</span>
                  <select value={form.category} onChange={set('category')}>
                    <option value="">고르지 않음</option>
                    {(categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              )}
              {showVendor && (
                <Field>
                  <span>공식 문서·제품 주소</span>
                  <input value={form.url} onChange={set('url')} placeholder="https://" />
                </Field>
              )}
            </TwoCol>
          )}

          {/*
            ⚠️ **왜 분류 칸이 없는지 말해 준다.** 그냥 사라지면 「어디 갔지」가 되고,
               사람은 없어진 칸을 찾느라 시간을 쓴다.
          */}
          {!showSector && (
            <Hint>
              <b>분야ㆍ태그ㆍDTC 분류는 여기에 없습니다.</b> 이 도구는 역량
              「{capNames.join(' · ') || '상위'}」 밑에 매달려 있어 <b>레이더에 따로 서지
              않습니다</b> — 부채꼴은 그 역량의 것을 따릅니다. 따로 두면 서로
              어긋나도 아무 데도 안 보여서 모르고 지나갑니다.
            </Hint>
          )}

          <Field>
            <span>별칭</span>
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
            ⚠️ 분류와 **한 몸**이라 분류가 없는 자리(매달린 도구)에는 같이 없다.
          */}
          {showSector && (
          <Field>
            <span>태그</span>
            <AliasRow>
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                     onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                     placeholder="예: 표준화, 실시간, 오픈소스" />
              <SmallBtn type="button" onClick={addTag}><Plus size={13} /> 추가</SmallBtn>
            </AliasRow>
          </Field>
          )}
          {showSector && tags.length > 0 && (
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
          {showSector && (
            <Hint>
              분류는 <b>레이더에서 어느 부채꼴에 놓을지</b>를 정합니다 — 하나만 고를 수
              있습니다. 걸치는 갈래는 여기 태그로 남기세요.
            </Hint>
          )}

          {/*
            ⚠️ CPT 는 **우리 분류가 아니라 외부 표준**이다(DTC Capabilities Periodic
               Table v1.1). 값이 고정이라 고르기만 한다 — 자유 입력을 열면 오타가
               섞이고, 그 순간 업계 기준과 대조가 안 된다.
          */}
          {showSector && (
          <Field>
            <span>DTC 분류</span>
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
          )}
          {showSector && (
            <Hint>
              Digital Twin Consortium 이 정한 <b>디지털 트윈의 여섯 능력</b>입니다.
              기술 하나가 여럿에 걸칩니다 — 걸치는 대로 고르세요.
              업계 기준으로 <b>우리가 어느 능력을 보고 있는지</b>를 세는 데 씁니다.
              {/* ⚠️ 이름 그대로 **능력(capabilities)의 주기율표**다 — 제품이 아니라
                     역량에 붙는 것이 맞다. */}
            </Hint>
          )}

          <Field>
            <span>용도</span>
            <textarea value={form.description} onChange={set('description')}
                      placeholder="어느 과제·공정에 닿는지, 무엇이 걸림돌인지" />
          </Field>

          {/*
            ⚠️⚠️ **단계 칸이 아예 없다**(2026-08-27). 역량도 도구도 제 단계를 안
               갖는다 — 「우리가 이걸 어디까지 쓰나」는 사업부마다 답이 다르다.
               그려 두면 골라도 서버가 버리는, 아무 일도 안 하는 칸이 된다.
          */}
          {!edit && canCurate && (
            <Hint>
              단계는 여기서 안 정합니다. <b>사업부마다 답이 달라서</b> 만든 뒤
              「사업부 적기」에서 사업부별로 적습니다.
            </Hint>
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

        {/*
          ⚠️ **Panel 안에 둔다.** 바깥 Overlay 밑에 두면 고르기 창을 누른 클릭이
             거기까지 올라가 **폼이 통째로 닫힌다.** Panel 이 이미 막고 있다.
        */}
        {/*
          ⚠️⚠️ **열 때마다 새로 만든다**(2026-08-26). 고르기 창은 골라 둔 것을
             `useState` 초기값으로 한 번만 잡는다. 늘 남겨 두면 「그만두기」로 닫아도
             고른 것이 안 물러지고, 다시 열면 그만둔 선택이 골라진 채로 되살아난다.
        */}
        {pickerOpen && (
        <CapabilityPicker
          isOpen
          capabilities={(capabilities || []).filter((c) => c.uuid !== initial?.uuid)}
          categories={categories}
          multi
          values={capUuids}
          noneLabel="소속 없음 — 레이더에 혼자 섭니다"
          onDone={(list) => { setCapUuids(list); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)} />
        )}

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
