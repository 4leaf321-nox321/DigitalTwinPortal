import React, { useState } from 'react';
import styled from 'styled-components';
import {
  Sparkles, AlertTriangle, Check, Loader2, Target, BarChart3, Info,
} from 'lucide-react';

import api from '../services/api';
import { Field, Hint, Warn } from './modalStyles';

const Box = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.6875rem 0.75rem;
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  border-radius: 0.5rem;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #5b21b6;
`;

const RunBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  margin-left: auto;
  padding: 0.3125rem 0.6875rem;
  border: none;
  border-radius: 0.4375rem;
  background: #7c3aed;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) { background: #6d28d9; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }

  svg:first-child { animation: ${(p) => (p.$busy ? 'spin 1s linear infinite' : 'none')}; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const Lead = styled.p`
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.7;
  color: #1e293b;
`;

const SoWhat = styled.p`
  margin: 0;
  padding: 0.4375rem 0.5625rem;
  background: #fff;
  border-left: 3px solid #7c3aed;
  border-radius: 0.25rem;
  font-size: 0.8125rem;
  line-height: 1.65;
  color: #312e81;
`;

const Row = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.4375rem;
  padding: 0.375rem 0.5rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 0.4375rem;
  font-size: 0.75rem;

  > svg { flex-shrink: 0; margin-top: 0.125rem; color: #94a3b8; }
  b { color: #0f172a; }
  small { display: block; color: #64748b; line-height: 1.5; margin-top: 0.0625rem; }
`;

const Pick = styled.button`
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  padding: 0.1875rem 0.5rem;
  border: 1px solid ${(p) => (p.$on ? '#0f766e' : '#cbd5e1')};
  background: ${(p) => (p.$on ? '#0f766e' : '#fff')};
  color: ${(p) => (p.$on ? '#fff' : '#475569')};
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;

  &:disabled { opacity: 0.6; cursor: default; }
`;

const Chips = styled.div`
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
`;

const Chip = styled.span`
  padding: 0.125rem 0.4375rem;
  background: #ede9fe;
  border: 1px solid #ddd6fe;
  border-radius: 999px;
  font-size: 0.6875rem;
  color: #5b21b6;
`;

/**
 * 사내 LLM 이 낸 정리와 **연결 후보**.
 *
 * ⚠️⚠️ **제안이지 연결이 아니다.** 여기 뜬 것은 후보일 뿐이고, [연결] 을 눌러야
 *    저장된다. 자동으로 걸면 근거 없는 연결이 쌓이고, 그러면 연결 자체를 아무도
 *    안 믿게 된다 — 안 믿는 연결은 없는 것과 같다.
 *
 * ⚠️ 서버가 **후보 목록에 실제로 있는 것만** 통과시킨다. 모델이 지어낸 것은
 *    `dropped` 로 와서 아래에 그대로 보인다 — 조용히 숨기면 "가끔 이상하다" 를
 *    쫓을 수 없다.
 */
const AssistPanel = ({ kind, uuid, onLinked, showError }) => {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(null);
  const [state, setState] = useState({});   // key → 'saving' | 'done'
  const [off, setOff] = useState(false);    // LLM 이 꺼져 있음

  const run = async () => {
    setBusy(true);
    try {
      setOut(await api.suggest(kind, uuid));
      setOff(false);
    } catch (e) {
      // 503 = 기능이 꺼진 것이지 고장이 아니다. 다르게 안내한다.
      if (e.status === 503) setOff(true);
      else showError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const link = async (targetKind, targetRef, relevance) => {
    const key = `${targetKind}:${targetRef}`;
    setState((p) => ({ ...p, [key]: 'saving' }));
    try {
      await api.addLink({
        subjectKind: kind, subjectUuid: uuid, targetKind, targetRef, relevance,
        // 사람이 고른 것이지만 문장은 AI 가 썼다. 그 사실을 남긴다.
        origin: 'llm',
      });
      setState((p) => ({ ...p, [key]: 'done' }));
      onLinked();
    } catch (e) {
      setState((p) => ({ ...p, [key]: undefined }));
      showError(e.message);
    }
  };

  return (
    <Box>
      <Head>
        <Sparkles size={14} /> AI 정리
        <RunBtn onClick={run} disabled={busy} $busy={busy}>
          {busy ? <Loader2 size={13} /> : <Sparkles size={13} />}
          {busy ? '읽는 중…' : (out ? '다시 읽기' : '읽고 정리하기')}
        </RunBtn>
      </Head>

      {off && (
        <Hint>
          AI 정리는 <b>LLM 서버가 켜져 있어야</b> 씁니다. 나머지 기능은 그대로 됩니다.
        </Hint>
      )}

      {!out && !off && !busy && (
        <Hint>
          원문을 읽고 <b>요약ㆍ분류ㆍ우리 과제·지표와의 연결 후보</b>를 냅니다.
          제안일 뿐이라 <b>[연결]을 눌러야</b> 저장됩니다.
        </Hint>
      )}

      {out && (
        <>
          {out.summary && <Lead>{out.summary}</Lead>}
          {out.soWhat && <SoWhat>{out.soWhat}</SoWhat>}

          {(out.category || (out.tags || []).length > 0 || (out.cpt || []).length > 0) && (
            <Chips>
              {out.category && <Chip>분류 · {out.category}</Chip>}
              {(out.tags || []).map((t) => <Chip key={t}>#{t}</Chip>)}
              {(out.cpt || []).map((c) => <Chip key={c}>{c}</Chip>)}
            </Chips>
          )}

          {(out.projects || []).length > 0 && (
            <Field>
              <span>관련 있어 보이는 과제</span>
              {out.projects.map((p) => {
                const st = state[`project:${p.uuid}`];
                return (
                  <Row key={p.uuid}>
                    <Target size={13} />
                    <span>
                      <b>{p.title}</b>
                      {p.division ? ` · ${p.division}` : ''}
                      {p.why && <small>{p.why}</small>}
                    </span>
                    <Pick $on={st === 'done'} disabled={Boolean(st)}
                          onClick={() => link('project', p.uuid, p.why)}>
                      {st === 'done' ? <><Check size={11} /> 연결됨</>
                        : st === 'saving' ? '잇는 중…' : '연결'}
                    </Pick>
                  </Row>
                );
              })}
            </Field>
          )}

          {(out.kpis || []).length > 0 && (
            <Field>
              <span>움직일 만한 DX KPI</span>
              {out.kpis.map((k) => {
                const st = state[`kpi:${k.id}`];
                return (
                  <Row key={k.id}>
                    <BarChart3 size={13} />
                    <span>
                      <b>{k.label}</b>
                      {k.why && <small>{k.why}</small>}
                    </span>
                    <Pick $on={st === 'done'} disabled={Boolean(st)}
                          onClick={() => link('kpi', String(k.id), k.why)}>
                      {st === 'done' ? <><Check size={11} /> 연결됨</>
                        : st === 'saving' ? '잇는 중…' : '연결'}
                    </Pick>
                  </Row>
                );
              })}
            </Field>
          )}

          {(out.projects || []).length === 0 && (out.kpis || []).length === 0 && (
            <Hint>
              맞는 과제·지표를 못 찾았습니다. <b>억지로 채우는 것보다 낫습니다</b> —
              후보 {out.candidateCounts?.projects ?? 0}개 과제, {out.candidateCounts?.kpis ?? 0}개
              지표 중에서 골랐습니다.
            </Hint>
          )}

          {/* ⚠️ 조용히 숨기면 "가끔 이상하다" 를 쫓을 수 없다. */}
          {(out.dropped || []).length > 0 && (
            <Warn>
              <AlertTriangle size={13} />
              <span>
                <b>AI 가 없는 것을 가리켜 {out.dropped.length}건을 뺐습니다.</b>{' '}
                {out.dropped.join(' ')}
              </span>
            </Warn>
          )}

          <Hint>
            <Info size={11} style={{ verticalAlign: '-0.1em' }} /> {out.model} 이 읽었습니다.
            <b> 확인하고 고르세요</b> — 여기 뜬 것은 제안이고, 누른 것만 저장됩니다.
          </Hint>
        </>
      )}
    </Box>
  );
};

export default AssistPanel;
