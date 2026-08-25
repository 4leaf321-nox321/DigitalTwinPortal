import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { X, Radar, AlertTriangle, ExternalLink, Trash2, Pencil, History, Merge,
  Columns } from 'lucide-react';

import api from '../services/api';
import AssistPanel from './AssistPanel';
import { STAGES } from './RadarBoard';
import DivisionStages from './DivisionStages';
import {
  Overlay, Panel, Head, CloseBtn, Body, Foot, Field, Hint, Warn,
  PrimaryBtn, GhostBtn, Spacer,
} from './modalStyles';

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

  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Evidence = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;

  li {
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 0.5rem 0.625rem;
    display: flex;
    flex-direction: column;
    gap: 0.1875rem;
  }
  b { font-size: 0.8125rem; color: #0f172a; }
  small { font-size: 0.6875rem; color: #64748b; }
  em { font-style: normal; font-size: 0.75rem; color: #334155; }
  a { color: #4f46e5; font-size: 0.6875rem; text-decoration: none; display: inline-flex; align-items: center; gap: 0.125rem; }
`;

const Links = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  li {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
    flex-wrap: wrap;
    padding: 0.3125rem 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.4375rem;
    font-size: 0.75rem;
  }
  em {
    font-style: normal;
    font-size: 0.625rem;
    font-weight: 700;
    color: #64748b;
    background: #f1f5f9;
    border-radius: 0.25rem;
    padding: 0.0625rem 0.3125rem;
  }
  b { color: #0f172a; }
  small { color: #64748b; width: 100%; line-height: 1.5; }
`;

/* ⚠️ 못 무르는 기능은 안 쓰는 기능이다. 잘못 건 연결을 여기서 끊는다. */
const UnlinkBtn = styled.button`
  margin-left: auto;
  border: none;
  background: none;
  color: #cbd5e1;
  cursor: pointer;
  padding: 0 0 0 0.25rem;
  display: flex;

  &:hover { color: #dc2626; }
`;

const Lead = styled.p`
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.7;
  color: ${(p) => (p.$empty ? '#94a3b8' : '#1e293b')};
  font-style: ${(p) => (p.$empty ? 'italic' : 'normal')};
`;

/* 사실 몇 가지를 표 대신 두 칸으로. 표를 쓰면 값이 없을 때 빈 줄이 커 보인다. */
const Facts = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0.5rem 0.625rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  li { display: flex; gap: 0.5rem; font-size: 0.75rem; }
  b { color: #64748b; font-weight: 600; min-width: 5.5rem; }
  span { color: #334155; }
  a { color: #4f46e5; text-decoration: none; display: inline-flex; align-items: center; gap: 0.1875rem; }
  a:hover { text-decoration: underline; }
`;

const Together = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3125rem;

  button {
    display: inline-flex;
    align-items: baseline;
    gap: 0.3125rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid #e2e8f0;
    background: #fff;
    border-radius: 0.4375rem;
    cursor: pointer;
    font: inherit;
  }
  button:hover { border-color: #a5b4fc; background: #eef2ff; }
  b { font-size: 0.75rem; color: #0f172a; }
  em { font-style: normal; font-size: 0.625rem; color: #6366f1; }
  small { font-size: 0.625rem; color: #94a3b8; }
`;

/*
  ⚠️ 제목 옆에 **층을 붙인다.** 「explicit 해석」과 「LS-DYNA」가 같은 모양으로
     열리면 지금 보는 것이 무엇인지 알 수 없고, 그러면 단계를 어디에 매길지도
     사람마다 갈린다 — 단계는 **역량에** 매기는 것이다.
*/
const Kind = styled.span`
  flex-shrink: 0;
  padding: 0.125rem 0.4375rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
  background: ${(p) => (p.$cap ? '#eef2ff' : '#f1f5f9')};
  color: ${(p) => (p.$cap ? '#4338ca' : '#475569')};
  border: 1px solid ${(p) => (p.$cap ? '#c7d2fe' : '#e2e8f0')};
`;

const Kids = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3125rem;

  button {
    display: inline-flex;
    align-items: center;
    gap: 0.3125rem;
    padding: 0.3125rem 0.5625rem;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    cursor: pointer;

    &:hover { border-color: #a5b4fc; }

    b { font-size: 0.75rem; color: #0f172a; font-weight: 600; }
    em { font-style: normal; font-size: 0.6875rem; color: #64748b; }
  }
`;

/* 지금 무엇 기준으로 보고 있는지. ⚠️ 경고(노랑)와 색을 달리한다 — 잘못된 것이
   아니라 **다른 눈으로 보고 있다**는 안내다. */
const Lens = styled.p`
  margin: 0;
  padding: 0.4375rem 0.625rem;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 0.4375rem;
  font-size: 0.75rem;
  color: #3730a3;
  line-height: 1.6;

  b { font-weight: 700; }
`;

const Body2 = styled.p`
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.7;
  color: #334155;
  white-space: pre-wrap;
`;

const HistBtn = styled.button`
  margin-left: 0.375rem;
  border: none;
  background: none;
  color: #6366f1;
  font-size: 0.6875rem;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;

  &:hover { text-decoration: underline; }
`;

const Hist = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  li {
    padding: 0.3125rem 0.5rem;
    border-left: 2px solid #c7d2fe;
    background: #f8fafc;
    border-radius: 0 0.25rem 0.25rem 0;
    font-size: 0.75rem;
  }
  b { color: #0f172a; margin-right: 0.375rem; }
  span { color: #94a3b8; font-size: 0.6875rem; }
  small { display: block; color: #475569; margin-top: 0.125rem; line-height: 1.5; }
`;

const DangerBtn = styled(GhostBtn)`
  color: #b91c1c;
  border-color: #fecaca;

  &:hover { background: #fef2f2; }
`;

/**
 * 기술 한 줄의 상세. **왜 이 단계인지**를 근거 소식으로 읽는 자리다.
 *
 * ⚠️ 근거를 못 읽으면 레이더는 「누가 왜 그렇게 판단했는지 모르는 표」가 된다.
 *    그것이 앞선 세 번의 시도가 죽은 방식이다 — 단계는 적혀 있는데 근거가 없어
 *    아무도 못 고치고, 못 고치니 낡고, 낡으니 안 본다.
 */

/**
 * 이미 걸린 포털 연결.
 *
 * ⚠️ 대상이 지워졌으면 서버가 `missing` 으로 알려 준다. 조용히 빈칸으로 두면
 *    「이름 없는 연결」이 남고, 그러면 그 줄을 지울지 고칠지 아무도 못 정한다.
 */
const LinkList = ({ rows, onRemove }) => {
  if (!rows || !rows.length) return null;
  const label = { project: '과제', kpi: 'KPI', sw: '보유 SW' };
  return (
    <Field>
      <span>이어 둔 우리 것 ({rows.length})</span>
      <Links>
        {rows.map((l) => (
          <li key={l.id}>
            <em>{label[l.targetKind] || l.targetKind}</em>
            <b>{l.label || (l.missing ? '(지워진 대상)' : l.targetRef)}</b>
            {l.relevance && <small>{l.relevance}</small>}
            {onRemove && (
              <UnlinkBtn onClick={() => onRemove(l)} title="이 연결을 끊습니다">
                <X size={11} />
              </UnlinkBtn>
            )}
          </li>
        ))}
      </Links>
    </Field>
  );
};

const TechModal = ({ tech, onClose, onChanged, onDelete, onEdit, onMerge,
                    division, onDivisionChanged,
                    onOpenTech, onCompare, canCurate, showError }) => {
  const [evidence, setEvidence] = useState(null);
  const [links, setLinks] = useState([]);
  const [changes, setChanges] = useState(null);
  const [related, setRelated] = useState([]);
  // ⚠️ 도구일 때만 묻는다. 역량은 자기 밑 도구를 이미 들고 있다.
  const [usedBy, setUsedBy] = useState([]);
  const [stage, setStage] = useState(tech?.stage || '관찰');
  const [reason, setReason] = useState(tech?.stage_reason || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tech) return;
    setStage(tech.stage);
    setReason(tech.stage_reason || '');
    setEvidence(null);
    api.techEvidence(tech.uuid)
      .then(setEvidence)
      .catch(() => setEvidence([]));
    api.listLinks('tech', tech.uuid).then(setLinks).catch(() => setLinks([]));
    api.relatedTech(tech.uuid).then(setRelated).catch(() => setRelated([]));
    // ⚠️ 역량한테는 안 묻는다 — 역량은 자기 밑 도구를 이미 들고 있고, 「이 역량을
    //    쓰는 사업부」는 바로 아래 사업부 표가 그대로 보여준다.
    setUsedBy([]);
    if (tech.kind !== 'capability') {
      api.usedBy(tech.uuid).then(setUsedBy).catch(() => setUsedBy([]));
    }
  }, [tech]);

  const reloadLinks = () =>
    api.listLinks('tech', tech.uuid).then(setLinks).catch(() => {});

  const dropLink = async (l) => {
    try {
      await api.removeLink(l.id);
      reloadLinks();
    } catch (e) { showError(e.message); }
  };

  const dropEvidence = async (newsUuid) => {
    try {
      await api.removeEvidence(newsUuid, tech.uuid);
      setEvidence((p) => (p || []).filter((r) => r.news.uuid !== newsUuid));
    } catch (e) { showError(e.message); }
  };

  const loadChanges = () =>
    api.listChanges('tech', tech.uuid).then(setChanges).catch(() => setChanges([]));

  if (!tech) return null;

  const stageChanged = stage !== tech.stage || (reason || '') !== (tech.stage_reason || '');
  // ⚠️ 서버와 **같은 규칙**이다. 여기서만 막으면 서버가 400 을 내고, 서버에만 있으면
  //    사용자가 눌러 보고서야 안다. 둘 다 있어야 한다.
  const needReason = stage === '보류' && !reason.trim();

  const applyStage = async () => {
    setBusy(true);
    try {
      const updated = await api.setStage(tech.uuid, stage, reason.trim() || undefined);
      onChanged(updated);
    } catch (e) {
      showError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay onClick={onClose}>
      <Panel $wide="42rem" onClick={(e) => e.stopPropagation()}>
        <Head>
          <Radar size={17} color="#4f46e5" />
          <h2>{tech.name}</h2>
          <Kind $cap={tech.kind === 'capability'}>
            {tech.kind === 'capability' ? '역량' : '도구'}
          </Kind>
          <CloseBtn onClick={onClose}><X size={18} /></CloseBtn>
        </Head>

        <Body>
          {/*
            ⚠️ **지금 보고 있는 단계가 어느 기준인지 먼저 말한다.** 사업부 눈으로
               연 창에서 그냥 「도입」이라고만 쓰여 있으면 전사가 도입인 줄 안다 —
               그 오해가 그대로 회의에 들어간다.
          */}
          {(tech.divisionTools || []).length > 0 && !tech.isDivisionOverride && (
            <Lens>
              <b>{tech.division}</b> 는 전사({tech.companyStage})를 따르고,
              이것을 <b>{tech.divisionTools.join(' · ')}</b> 로 합니다.
              {tech.divisionStageReason ? ` — ${tech.divisionStageReason}` : ''}
            </Lens>
          )}

          {tech.isDivisionOverride && (
            <Lens>
              <b>{tech.division}</b> 기준으로 <b>{tech.stage}</b> 입니다.
              {(tech.divisionTools || []).length > 0
                && <> 이것을 <b>{tech.divisionTools.join(' · ')}</b> 로 합니다.</>}
              전사는 <b>{tech.companyStage}</b> 입니다
              {tech.divisionStageAt
                ? ` (${String(tech.divisionStageAt).slice(0, 10)}부터).` : '.'}
              {tech.divisionStageReason ? ` — ${tech.divisionStageReason}` : ''}
            </Lens>
          )}

          {tech.isStale && (
            <Warn>
              <AlertTriangle size={13} />
              <span>
                <b>근거가 {tech.staleAfterDays}일 넘게 없습니다.</b> 아직 유효한 판단인지
                확인이 필요합니다 — 새 소식을 등록하면서 이 기술을 걸면 갱신됩니다.
              </span>
            </Warn>
          )}

          {/* ⚠️ 요약이 먼저 온다 — 「이게 뭐냐」에 먼저 답해야 한다. */}
          {tech.summary
            ? <Lead>{tech.summary}</Lead>
            : <Lead $empty>한 줄 요약이 없습니다. [고치기] 에서 채워 주세요 —
                           이름만으로는 6개월 뒤 무엇이었는지 알 수 없습니다.</Lead>}

          {/*
            ⚠️ **역량 밑의 도구를 여기서 보여준다.** 역량만 있으면 「그래서 뭘로
               하나」에 답을 못 하고, 그러면 사업부가 실제로 무엇을 쓰는지가
               어디에도 안 남는다.
          */}
          {tech.kind === 'capability' && (
            <Field>
              <span>
                무엇으로 하나 {(tech.children || []).length > 0
                  ? `(${tech.children.length}개)` : ''}
              </span>
              {(tech.children || []).length === 0
                ? <Hint>
                    아직 매달린 도구가 없습니다. 도구를 고칠 때 「어느 역량에 속하나」
                    에서 이 역량을 고르면 여기에 모이고, <b>그 도구의 소식이 이 역량의
                    근거로 함께 셉니다.</b>
                  </Hint>
                : (
                  <Kids>
                    {tech.children.map((c) => (
                      <li key={c.uuid}>
                        <button type="button"
                                onClick={() => onOpenTech && onOpenTech(c)}>
                          <b>{c.name}</b>
                          <em>{c.stage}</em>
                        </button>
                      </li>
                    ))}
                  </Kids>
                )}
            </Field>
          )}

          {/*
            ⚠️⚠️ **되짚는 쪽이 없으면 적을 이유가 절반으로 준다.** 「무엇으로 하나」를
               채워도 「LS-DYNA 를 누가 쓰나」에 답이 안 나오면, 채운 사람이 그게
               어디에 쓰이는지 못 본다 — 그러면 다음부터 안 채운다.
          */}
          {usedBy.length > 0 && (
            <Field>
              <span>이 도구를 쓰는 사업부 ({usedBy.length})</span>
              <Kids>
                {usedBy.map((u) => (
                  <li key={`${u.division}-${u.capabilityUuid}`}>
                    <button type="button"
                            onClick={() => onOpenTech
                              && onOpenTech({ uuid: u.capabilityUuid })}>
                      <b>{u.division}</b>
                      <em>
                        {u.capability}
                        {u.stage ? ` · ${u.stage}` : ''}
                      </em>
                    </button>
                  </li>
                ))}
              </Kids>
            </Field>
          )}

          {tech.kind !== 'capability' && tech.parentUuid && (
            <Field>
              <span>어느 역량인가</span>
              <Kids>
                <li>
                  <button type="button"
                          onClick={() => onOpenTech
                            && onOpenTech({ uuid: tech.parentUuid })}>
                    <b>{tech.parentName || '상위 역량'}</b>
                    <em>레이더에는 이쪽이 섭니다</em>
                  </button>
                </li>
              </Kids>
            </Field>
          )}

          <Facts>
            <li><b>공급사</b><span>{tech.vendor || '—'}</span></li>
            <li><b>분류</b><span>{tech.category || '—'}</span></li>
            {/* ⚠️ 「어디서 왔나」만 있고 「언제」가 없으면 못 믿는다. */}
            {tech.movedFrom && (
              <li>
                <b>단계 이동</b>
                <span>
                  {tech.movedFrom} → {tech.stage}
                  {tech.movedAt ? ` · ${String(tech.movedAt).slice(0, 10)}` : ''}
                </span>
              </li>
            )}
            <li>
              <b>공식 문서</b>
              <span>
                {tech.url
                  ? <a href={tech.url} target="_blank" rel="noreferrer">
                      바로가기 <ExternalLink size={11} />
                    </a>
                  : '—'}
              </span>
            </li>
            {(tech.aliases || []).length > 0 && (
              <li><b>다른 이름</b><span>{tech.aliases.join(' · ')}</span></li>
            )}
            {(tech.divisions || []).length > 0 && (
              <li><b>관련 사업부</b><span>{tech.divisions.join(' · ')}</span></li>
            )}
            {/* 부채꼴은 하나뿐이라 **얽힌 갈래는 여기서만 읽힌다.** */}
            {(tech.tags || []).length > 0 && (
              <li><b>얽힌 갈래</b><span>{tech.tags.join(' · ')}</span></li>
            )}
            {(tech.cpt || []).length > 0 && (
              <li>
                <b>DTC 능력</b>
                <span title="Digital Twin Consortium Capabilities Periodic Table v1.1">
                  {tech.cpt.join(' · ')}
                </span>
              </li>
            )}
          </Facts>

          {/*
            ⚠️ 레이더는 기술을 **하나씩 따로** 보여준다. 그런데 실제 판단은 「이걸
               하려면 저것도 필요한가」다 — OpenUSD 없이 Omniverse 를 말할 수 없다.
               그 정보는 근거 표에 **이미 있었는데 아무 데도 안 보였다.**
          */}
          {related.length > 0 && (
            <Field>
              <span>자주 함께 나오는 기술</span>
              <Together>
                {related.map((r) => (
                  <li key={r.uuid}>
                    <button type="button" onClick={() => onOpenTech && onOpenTech(r)}>
                      <b>{r.name}</b>
                      <em>{r.stage}</em>
                      <small>소식 {r.together}건에 같이</small>
                    </button>
                  </li>
                ))}
              </Together>
            </Field>
          )}

          {tech.description && (
            <Field>
              <span>우리한테 어디에 쓸 만한가</span>
              <Body2>{tech.description}</Body2>
            </Field>
          )}

          {tech.stage_reason && (
            <Field>
              <span>지금 단계로 정한 이유</span>
              <Body2>{tech.stage_reason}</Body2>
            </Field>
          )}

          {/*
            ⚠️ 단계를 「조직의 판단」이라며 좁혀 놓고 기록이 없으면 좁힌 의미가 절반이다.
               「왜 작년에 도입이었다가 보류로 내려갔지」에 답할 수 있어야 한다.
          */}
          <Field>
            <span>
              단계가 바뀐 기록
              {changes === null && (
                <HistBtn onClick={loadChanges}><History size={11} /> 보기</HistBtn>
              )}
            </span>
            {changes !== null && changes.length === 0 && (
              <Hint>아직 단계를 옮긴 적이 없습니다.</Hint>
            )}
            {changes !== null && changes.length > 0 && (
              <Hist>
                {changes.map((c) => (
                  <li key={c.id}>
                    <b>{c.before_value} → {c.after_value}</b>
                    <span>{(c.created_at || '').slice(0, 10)}
                      {c.actor_name ? ` · ${c.actor_name}` : ''}</span>
                    {c.reason && <small>{c.reason}</small>}
                  </li>
                ))}
              </Hist>
            )}
          </Field>

          <Field>
            <span>레이더 단계</span>
            <StageRow>
              {STAGES.map((st) => (
                <StageBtn key={st.key} type="button" $on={stage === st.key} $color={st.color}
                          disabled={!canCurate}
                          title={canCurate ? st.desc : '단계 변경은 관리자·사무국만 할 수 있습니다'}
                          onClick={() => setStage(st.key)}>
                  {st.key}
                </StageBtn>
              ))}
            </StageRow>
          </Field>

          {!canCurate && (
            <Hint>
              단계는 <b>관리자·사무국만</b> 바꿉니다. 개인 의견이 아니라 조직이 어디까지
              왔는지의 표기라, 아무나 바꾸면 아무도 그 표기를 안 믿게 되기 때문입니다.
            </Hint>
          )}

          {canCurate && (
            <Field>
              <span>이 단계로 정한 이유{stage === '보류' ? ' *' : ''}</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)}
                        placeholder="예: 라이선스 비용이 과제 예산을 넘는다" />
            </Field>
          )}

          {canCurate && needReason && (
            <Warn>
              <AlertTriangle size={13} />
              <span>
                <b>「보류」로 옮길 때는 이유를 적어야 합니다.</b> 안 쓰기로 한 판단이야말로
                근거가 남아야 6개월 뒤 같은 논의를 처음부터 다시 하지 않습니다.
              </span>
            </Warn>
          )}

          {/*
            ⚠️ **단계를 바꾸는 자리 가까이 둔다.** 멀리 두면 전사만 바꾸고 사업부는
               안 건드리게 되고, 그러면 사업부 값이 조용히 옛것으로 남는다.
          */}
          <DivisionStages tech={tech} canCurate={canCurate}
                          onChanged={onDivisionChanged} showError={showError} />

          <LinkList rows={links} onRemove={dropLink} />

          <AssistPanel kind="tech" uuid={tech.uuid}
                       onLinked={reloadLinks} showError={showError} />

          <Field>
            <span>근거가 된 소식 {evidence ? `(${evidence.length}건)` : ''}</span>
            {evidence === null && <Hint>불러오는 중…</Hint>}
            {evidence !== null && evidence.length === 0 && (
              <Hint>
                아직 근거가 없습니다. 소식을 등록할 때 이 기술을 걸면 여기에 쌓입니다.
              </Hint>
            )}
            {evidence !== null && evidence.length > 0 && (
              <Evidence>
                {evidence.map((row) => (
                  <li key={row.news.uuid}>
                    <b>{row.news.title}</b>
                    <small>{row.news.published_at || '날짜 미상'}{row.news.source ? ` · ${row.news.source}` : ''}</small>
                    {row.note && <em>{row.note}</em>}
                    {row.news.url && (
                      <a href={row.news.url} target="_blank" rel="noreferrer">
                        원문 <ExternalLink size={11} />
                      </a>
                    )}
                    {/* 잘못 걸린 근거를 끊는다 — 걸 수 있으면 끊을 수도 있어야 한다. */}
                    <UnlinkBtn onClick={() => dropEvidence(row.news.uuid)}
                               title="이 소식을 근거에서 뺍니다">
                      <X size={11} />
                    </UnlinkBtn>
                  </li>
                ))}
              </Evidence>
            )}
          </Field>
        </Body>

        <Foot>
          {canCurate && (
            <DangerBtn onClick={() => onDelete(tech)}>
              <Trash2 size={13} /> 지우기
            </DangerBtn>
          )}
          {/* 두 줄이 됐을 때 합치는 자리. 되돌릴 수 없어 사무국만. */}
          {canCurate && onMerge && (
            <GhostBtn onClick={() => onMerge(tech)} title="이 기술을 다른 기술에 합칩니다">
              <Merge size={13} /> 합치기
            </GhostBtn>
          )}
          {onCompare && (
            <GhostBtn onClick={() => onCompare(tech)}
                      title="다른 기술과 나란히 놓고 봅니다">
              <Columns size={13} /> 견주기
            </GhostBtn>
          )}
          {/* 고치기는 **누구나** — 설명을 채우는 것은 판단이 아니라 기여다. */}
          <GhostBtn onClick={() => onEdit(tech)}>
            <Pencil size={13} /> 고치기
          </GhostBtn>
          <Spacer />
          <GhostBtn onClick={onClose}>닫기</GhostBtn>
          {canCurate && (
            <PrimaryBtn onClick={applyStage} disabled={!stageChanged || needReason || busy}>
              {busy ? '바꾸는 중…' : '단계 저장'}
            </PrimaryBtn>
          )}
        </Foot>
      </Panel>
    </Overlay>
  );
};

export default TechModal;
