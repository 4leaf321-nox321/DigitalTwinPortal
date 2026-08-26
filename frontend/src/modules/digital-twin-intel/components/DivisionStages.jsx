import React, { forwardRef, useCallback, useEffect,
                useImperativeHandle, useState } from 'react';
import styled from 'styled-components';
import { RotateCcw, Loader2, Pencil, AlertTriangle } from 'lucide-react';

import api from '../services/api';
import { STAGES } from './RadarBoard';
import { Field, Hint } from './modalStyles';

/**
 * **사업부별 단계** — 「우리 사업부는 어디까지 · 왜 · 무엇으로」.
 *
 * ⚠️⚠️ **드롭다운으로 단계만 고르게 두면 안 된다.** 한 번 눌러 「MX 도입」이 박히는데
 *    왜 그런지도, 무엇으로 하는지도 아무 데도 없으면, 이 표는 앞선 세 번의
 *    시도(tech_radar · tech_archive · digital_twin_solution)와 똑같아진다 —
 *    적혀는 있는데 아무도 왜인지 모르는 표. 「MX 도입」 네 글자는 6개월 뒤 아무
 *    뜻도 아니다. 그래서 줄을 펴서 **단계 · 이유 · 쓰는 도구**를 함께 받는다.
 *
 * ⚠️⚠️ **기본 설정 값이 정본이고, 남기는 것은 예외뿐이다.** 사업부 8개 × 역량 39개 =
 *    312칸을 채우게 하면 아무도 안 채운다. 안 정한 칸은 「기본 설정을 따름」이고,
 *    그것이 결함이 아니라 기본값이다.
 *
 * ⚠️ **기본 설정을 따르면서 도구만 적을 수 있다.** 가장 흔한 경우가 「기본 설정도 도입,
 *    우리도 도입, 우리는 LS-DYNA」인데, 예외를 만들어야만 도구를 적을 수 있으면
 *    그 경우를 아예 못 적는다.
 */
import { FOLLOW, asDraft, divisionDirty, divisionNeedsReason }
  from '../utils/stageSave';

const Grid = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const Row = styled.li`
  border: 1px solid ${(p) => (p.$diff ? '#c7d2fe' : '#f1f5f9')};
  background: ${(p) => (p.$diff ? '#eef2ff' : '#fff')};
  border-radius: 0.4375rem;
  padding: 0.375rem 0.5rem;
`;

const Line = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;

  > b {
    flex: 0 0 4.5rem;
    font-size: 0.75rem;
    color: #0f172a;
  }
`;

const Stage = styled.span`
  flex: 0 0 5rem;
  font-size: 0.75rem;
  font-weight: ${(p) => (p.$diff ? 700 : 400)};
  color: ${(p) => (p.$diff ? '#3730a3' : '#94a3b8')};
`;

/* 적어 둔 것. ⚠️ **이 줄이 이 화면의 알맹이다** — 「MX 도입」이 아니라
   「MX 도입 · LS-DYNA · 3년째 쓰는 중」이라야 6개월 뒤에도 뜻이 있다. */
const Said = styled.small`
  flex: 1;
  min-width: 0;
  font-size: 0.6875rem;
  color: #475569;
  line-height: 1.45;
  /* ⚠️ **도구 이름이 여기 들어 있다** — 자르면 무엇으로 하는지가 안 보인다.
     이유가 길면 줄을 접는다. */
  white-space: normal;
  word-break: keep-all;

  em { font-style: normal; color: #4338ca; font-weight: 600; }
  i { font-style: normal; color: #94a3b8; }
`;

const IconBtn = styled.button`
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
  border-radius: 0.3125rem;
  padding: 0.1875rem 0.375rem;
  font-size: 0.625rem;
  cursor: pointer;

  &:hover { border-color: #a5b4fc; color: #4f46e5; }
`;

const Form = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4375rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #cbd5e1;

  label {
    display: flex;
    flex-direction: column;
    gap: 0.1875rem;
    font-size: 0.6875rem;
    color: #475569;
  }

  select, input {
    font-size: 0.75rem;
    padding: 0.3125rem 0.375rem;
    border: 1px solid #cbd5e1;
    border-radius: 0.3125rem;
    background: #fff;
    color: #0f172a;
  }
`;

const Tools = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
`;

const ToolChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1875rem 0.5rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$on ? '#818cf8' : '#e2e8f0')};
  background: ${(p) => (p.$on ? '#eef2ff' : '#fff')};
  color: ${(p) => (p.$on ? '#3730a3' : '#64748b')};
  font-weight: ${(p) => (p.$on ? 600 : 400)};

  &:hover { border-color: #a5b4fc; }
`;

const Buttons = styled.div`
  display: flex;
  gap: 0.375rem;
  align-items: center;

  button {
    font-size: 0.6875rem;
    padding: 0.3125rem 0.625rem;
    border-radius: 0.3125rem;
    cursor: pointer;
  }
`;

const Cancel = styled.button`
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #64748b;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: #64748b;

  b { color: #0f172a; }
`;

const Need = styled.p`
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  color: #b45309;
`;

/*
  `initialData` · `initialOpen` 은 **화면에서는 안 쓴다.** 이 컴포넌트는 열릴 때
  서버에 묻는데, 서버 렌더에서는 그 효과가 안 돌아 껍데기만 뜬다 — 그러면 이 판의
  알맹이인 **폼이 한 번도 안 그려진 채로 나간다.** 검사가 폼까지 닿게 낸 자리다.

  ⚠️ 나중에 「그 사업부 칸을 바로 펴서 열기」가 필요해지면 이 자리를 그대로 쓴다.
*/
const DivisionStages = forwardRef(({ tech, canCurate, onChanged, showError,
                                    onDraftState,
                                    initialData = null, initialOpen = '' }, ref) => {
  const [data, setData] = useState(initialData);
  const [failed, setFailed] = useState(null);
  const [open, setOpen] = useState(initialOpen);   // 펴 놓은 사업부
  const [draft, setDraft] = useState(() => (
    initialOpen && initialData
      ? asDraft((initialData.overrides || [])
          .find((x) => x.division === initialOpen))
      : null));
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!tech?.uuid) return;
    setFailed(null);
    api.divisionStages(tech.uuid)
      .then((d) => setData(d))
      .catch((e) => setFailed(e.message || '불러오지 못했습니다.'));
  }, [tech?.uuid]);

  useEffect(() => { load(); }, [load]);

  /*
    ⚠️⚠️ **저장은 창 아래 「단계 저장」 한 곳에서만 한다.** 여기 안에도 저장 단추를
       두었더니, 사업부만 바꾼 사람에게는 아래 큰 단추가 죽은 채로 남아 고장으로
       읽혔다(2026-08-26 신고). 이 칸은 **무엇을 적어 놨는지 위로 알리기만** 하고,
       실제로 보내는 일은 창이 한다.

    ⚠️ 그래서 아래 훅과 파생값은 전부 `if (!data)` **위**에 있어야 한다 — 밑으로
       내리면 못 불러온 동안 훅 수가 달라져 React 가 터진다.
  */
  // ⚠️ 규칙 자체는 `utils/stageSave` 에 있다 — 시험이 붙어 있는 쪽이 정본이다.
  const storedOf = (d) => (data?.overrides || []).find((x) => x.division === d) || null;
  const needReason = divisionNeedsReason(draft);
  const dirty = Boolean(open) && divisionDirty(storedOf(open), draft);

  // ⚠️ 오류와 알림은 **부르는 쪽**이 맡는다 — 기본 설정과 함께 보내야 하기 때문이다.
  const save = async () => {
    if (!draft || !open) return;
    setBusy(true);
    try {
      await api.setDivisionStage(tech.uuid, open, draft.stage,
                                 draft.reason.trim(), draft.tools);
      setOpen('');
      setDraft(null);
      load();
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (onDraftState) onDraftState({ division: open, dirty, needReason });
  }, [open, dirty, needReason, onDraftState]);

  useImperativeHandle(ref, () => ({ save }));

  /*
    ⚠️ **못 불러왔을 때 조용히 사라지면 안 된다.** 이 칸이 없어진 것인지 못 불러온
       것인지 구별이 안 되고, 사무국은 「사업부별로 정하는 자리가 어디 갔지」만
       남는다. 껍데기는 늘 세우고 속만 바꿔 끼운다.
  */
  if (!data) {
    return (
      <Field>
        <span>사업부별로 어디까지 왔나</span>
        <Hint>{failed ? `불러오지 못했습니다 — ${failed}` : '불러오는 중…'}</Hint>
      </Field>
    );
  }

  const byDivision = {};
  (data.overrides || []).forEach((o) => { byDivision[o.division] = o; });
  const divisions = data.divisions || [];
  if (!divisions.length) return null;

  const choices = data.toolChoices || [];
  // ⚠️ 이제 줄이 있다는 것이 곧 「적었다」이다 — 견줄 기본 설정이 없다.
  const saidCount = (data.overrides || []).length;

  const edit = (d) => {
    setOpen(d);
    setDraft(asDraft(byDivision[d]));
  };

  const toggleTool = (uuid) => setDraft((p) => ({
    ...p,
    tools: p.tools.includes(uuid)
      ? p.tools.filter((u) => u !== uuid)
      : [...p.tools, uuid],
  }));

  const revert = async (d) => {
    setBusy(true);
    try {
      await api.clearDivisionStage(tech.uuid, d);
      setOpen('');
      load();
      if (onChanged) onChanged();
    } catch (e) {
      if (showError) showError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Field>
      <span>사업부별로 어디까지 · 왜 · 무엇으로</span>
      <Head>
        {saidCount > 0
          ? <>적은 사업부 <b>{saidCount}</b> / {divisions.length}</>
          : '아직 어느 사업부도 안 적었습니다'}
      </Head>

      <Grid>
        {divisions.map((d) => {
          const o = byDivision[d];
          const diff = Boolean(o && o.stage);
          const editing = open === d;
          return (
            <Row key={d} $diff={diff}>
              <Line>
                <b>{d}</b>
                <Stage $diff={diff}>{diff ? o.stage : '아직 안 적음'}</Stage>

                {/*
                  ⚠️ **적어 둔 것을 한 줄로 보여준다.** 단계만 보이면 「왜」와
                     「무엇으로」를 채울 이유가 안 생긴다 — 안 보이는 칸은 안 채운다.
                */}
                <Said title={o ? `${(o.toolNames || []).join(' · ')} ${o.reason || ''}` : ''}>
                  {o && (o.toolNames || []).length > 0
                    && <em>{o.toolNames.join(' · ')}</em>}
                  {o && (o.toolNames || []).length > 0 && (o.reason ? ' · ' : '')}
                  {o && o.reason}
                  {(!o || (!(o.toolNames || []).length && !o.reason))
                    && <i>아직 아무것도 안 적혔습니다</i>}
                </Said>

                {o && o.changedAt && !editing && (
                  <Said as="small" style={{ flex: '0 0 auto', color: '#94a3b8' }}>
                    {String(o.changedAt).slice(0, 10)}
                  </Said>
                )}

                {canCurate && !editing && (
                  <IconBtn type="button" onClick={() => edit(d)}>
                    <Pencil size={10} /> 고치기
                  </IconBtn>
                )}
              </Line>

              {editing && draft && (
                <Form>
                  <label>
                    단계
                    <select value={draft.stage}
                            onChange={(e) => setDraft((p) => ({ ...p, stage: e.target.value }))}>
                      {/* ⚠️ 「아직 안 정함」을 고르고 저장하면 이 줄이 사라진다 —
                          빈 줄을 남기면 「적은 사업부」 셈이 부풀고 못 믿게 된다. */}
                      <option value={FOLLOW}>아직 안 정함</option>
                      {STAGES.map((st) => (
                        <option key={st.key} value={st.key}>{st.key} — {st.desc}</option>
                      ))}
                    </select>
                  </label>

                  {/*
                    ⚠️⚠️ **이유는 「보류」에만 묻는다**(2026-08-26). 예전에는 단계를
                       적는 것이 곧 「기본 설정과 다르게 본다」는 주장이라 늘 물었다.
                       이제 단계는 주장이 아니라 사실이다 — 다만 **안 쓰기로 한
                       판단**은 근거가 남아야 한다.
                  */}
                  {draft.stage !== FOLLOW && (
                    <label>
                      왜 그렇게 보는지{draft.stage === '보류' ? ' *' : ''}
                      <input value={draft.reason} autoFocus
                             onChange={(e) => setDraft((p) => ({ ...p, reason: e.target.value }))}
                             placeholder={draft.stage === '보류'
                               ? '예: 라이선스가 과제 예산을 넘는다'
                               : '예: 차체 충돌 해석이 본업이라 3년째 상시 사용 (안 적어도 됩니다)'} />
                    </label>
                  )}

                  <label>
                    무엇으로 하나
                    {choices.length === 0
                      ? (
                        <Hint>
                          이 역량에 매달린 도구가 없습니다. 먼저 도구를 이 역량에
                          매달아 주세요 — <b>안 매달린 도구는 여기서 고를 수
                          없습니다.</b> 그래야 「어느 사업부가 무엇을 쓰나」를
                          되짚을 수 있습니다.
                        </Hint>
                      )
                      : (
                        <Tools>
                          {choices.map((c) => (
                            <ToolChip key={c.uuid} type="button"
                                      $on={draft.tools.includes(c.uuid)}
                                      onClick={() => toggleTool(c.uuid)}>
                              {c.name}
                            </ToolChip>
                          ))}
                        </Tools>
                      )}
                  </label>

                  {needReason && (
                    <Need>
                      <AlertTriangle size={11} />
                      <b>안 쓰기로 한 판단</b>입니다. 이유 없는 줄은 6개월 뒤 아무
                      뜻도 아니고, 그때 같은 논의를 처음부터 다시 합니다.
                    </Need>
                  )}

                  <Buttons>
                    {/* ⚠️ 저장은 **창 아래 「단계 저장」 하나뿐**이다. 여기 또
                        두면 어느 것이 무엇을 보내는지 아무도 모른다. */}
                    <Cancel type="button"
                            onClick={() => { setOpen(''); setDraft(null); }}>
                      그만두기
                    </Cancel>
                    {busy && <Loader2 size={12} />}
                    {/*
                      ⚠️ **적어 둔 것을 통째로 무르는 자리다.** 위에서 「아직 안
                         정함」을 골라도 같은 일이 일어난다 — 단계 없는 줄은 남길
                         수 없기 때문이다.
                    */}
                    {o && (
                      <IconBtn type="button" style={{ marginLeft: 'auto' }}
                               onClick={() => revert(d)}
                               title="이 사업부에 적어 둔 것을 전부 지웁니다">
                        <RotateCcw size={10} /> 적어 둔 것 지우기
                      </IconBtn>
                    )}
                  </Buttons>
                </Form>
              )}
            </Row>
          );
        })}
      </Grid>

      {canCurate && (
        <Hint>
          역량 자체에는 단계가 없습니다 — <b>단계는 사업부마다</b> 답이 다르기
          때문입니다. 여기 적은 것이 레이더의 점이 되고, 안 적은 역량은 점이
          없습니다. 도구를 고르려면 <b>단계도 함께</b> 골라야 합니다.
        </Hint>
      )}
    </Field>
  );
});

DivisionStages.displayName = 'DivisionStages';

export default DivisionStages;
