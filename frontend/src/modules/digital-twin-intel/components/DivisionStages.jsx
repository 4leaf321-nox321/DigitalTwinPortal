import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import { RotateCcw, Loader2 } from 'lucide-react';

import api from '../services/api';
import { STAGES } from './RadarBoard';
import { Field, Hint } from './modalStyles';

/**
 * **사업부별 단계** — 「우리 사업부는 어디까지 왔나」.
 *
 * ⚠️⚠️ **전사 값이 정본이고, 남기는 것은 예외뿐이다.** 사업부 8개 × 역량 39개 =
 *    312칸을 채우게 하면 아무도 안 채우고, 채운 것도 곧 낡아 **표 전체를 못 믿게
 *    된다.** 그래서 이 표는 사업부를 전부 세워 두되 **안 정한 칸은 「전사」라고
 *    적는다** — 빈칸으로 두면 「아직 안 정함」이 결함처럼 보이지만, 그것이 정상이고
 *    오히려 기본값이다.
 *
 * ⚠️ 이 표가 있어야 사업부 비교가 성립한다. 도구 단위로는 원리적으로 불가능하다 —
 *    MX 가 LS-DYNA 도입, VD 가 RADIOSS 도입이면 둘 다 「도입」인데 서로 다른 줄이라
 *    누가 앞섰는지 읽을 수 없다.
 */
const Grid = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const Row = styled.li`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border: 1px solid ${(p) => (p.$diff ? '#c7d2fe' : '#f1f5f9')};
  background: ${(p) => (p.$diff ? '#eef2ff' : '#fff')};
  border-radius: 0.4375rem;

  > b {
    flex: 0 0 4.5rem;
    font-size: 0.75rem;
    color: #0f172a;
  }

  select {
    flex: 0 0 6rem;
    font-size: 0.75rem;
    padding: 0.1875rem 0.25rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.3125rem;
    background: #fff;
    color: #0f172a;
  }

  /* 전사를 따르는 줄은 **읽히되 눈에 안 걸려야** 한다 — 그게 정상 상태다. */
  small {
    flex: 1;
    min-width: 0;
    font-size: 0.6875rem;
    color: #64748b;
    line-height: 1.45;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const Same = styled.span`
  flex: 0 0 6rem;
  font-size: 0.75rem;
  color: #94a3b8;
`;

const Undo = styled.button`
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

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: #64748b;

  b { color: #0f172a; }
`;

const DivisionStages = ({ tech, canCurate, onChanged, showError }) => {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(null);
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    if (!tech?.uuid) return;
    setFailed(null);
    api.divisionStages(tech.uuid)
      .then((d) => setData(d))
      .catch((e) => setFailed(e.message || '불러오지 못했습니다.'));
  }, [tech?.uuid]);

  useEffect(() => { load(); }, [load]);

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

  const apply = async (division, stage) => {
    /*
      ⚠️ '보류' 는 **이유가 있어야** 서버가 받는다. 전사와 다르게 접는 판단이라
         이유가 더 중요하다 — 여기서 미리 물어야 400 을 받고 되돌아오지 않는다.
    */
    let reason = '';
    if (stage === '보류') {
      reason = window.prompt(
        `${division} 는 「보류」로 봅니다. 왜 지금은 아니라고 보나요?\n\n`
        + '안 쓰기로 한 판단이야말로 근거가 남아야 합니다 — '
        + '안 남기면 6개월 뒤 같은 논의를 처음부터 다시 합니다.') || '';
      if (!reason.trim()) return;
    }
    setBusy(division);
    try {
      await api.setDivisionStage(tech.uuid, division, stage, reason || undefined);
      load();
      if (onChanged) onChanged();
    } catch (e) {
      if (showError) showError(e.message);
    } finally {
      setBusy('');
    }
  };

  const revert = async (division) => {
    setBusy(division);
    try {
      await api.clearDivisionStage(tech.uuid, division);
      load();
      if (onChanged) onChanged();
    } catch (e) {
      if (showError) showError(e.message);
    } finally {
      setBusy('');
    }
  };

  const diffCount = (data.overrides || []).length;

  return (
    <Field>
      <span>사업부별로 어디까지 왔나</span>
      <Head>
        전사 <b>{data.companyStage}</b>
        {diffCount > 0
          ? <> · 다르게 보는 사업부 <b>{diffCount}</b></>
          : ' · 아직 전부 전사 값을 따릅니다'}
      </Head>

      <Grid>
        {divisions.map((d) => {
          const o = byDivision[d];
          return (
            <Row key={d} $diff={Boolean(o)}>
              <b>{d}</b>
              {canCurate
                ? (
                  <select value={o ? o.stage : data.companyStage}
                          disabled={busy === d}
                          onChange={(e) => apply(d, e.target.value)}>
                    {STAGES.map((st) => (
                      <option key={st.key} value={st.key}>
                        {st.key}{st.key === data.companyStage ? ' (전사)' : ''}
                      </option>
                    ))}
                  </select>
                )
                : <Same>{o ? o.stage : `${data.companyStage} (전사)`}</Same>}

              {busy === d && <Loader2 size={12} />}

              <small title={o?.reason || ''}>
                {o
                  ? `${o.reason || '이유 없음'}${o.changedAt
                      ? ` · ${String(o.changedAt).slice(0, 10)}` : ''}`
                  : '전사 값을 따릅니다'}
              </small>

              {/*
                ⚠️ **되돌리기가 있어야 한다.** 예외를 지우면 전사를 다시 따라가는데,
                   그 길이 없으면 한 번 다르게 정한 사업부는 전사가 움직여도
                   **옛 값에 붙박인다** — 그게 표를 못 믿게 만드는 방식이다.
              */}
              {o && canCurate && (
                <Undo type="button" onClick={() => revert(d)}
                      title="예외를 지우고 전사 값을 따릅니다">
                  <RotateCcw size={10} /> 전사로
                </Undo>
              )}
            </Row>
          );
        })}
      </Grid>

      {canCurate && (
        <Hint>
          전사와 <b>같은 값</b>으로 되돌리면 예외가 지워집니다 — 「전사와 같다」와
          「아직 안 정했다」는 같은 뜻이라, 굳이 남겨 두면 전사가 움직였을 때 그
          사업부만 옛 값에 붙박입니다.
        </Hint>
      )}
    </Field>
  );
};

export default DivisionStages;
