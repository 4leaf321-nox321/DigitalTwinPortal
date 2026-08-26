import React from 'react';
import styled from 'styled-components';
import { X, Columns, ExternalLink, AlertTriangle } from 'lucide-react';

import { STAGES } from './RadarBoard';
import { Overlay, Panel, Head, CloseBtn, Body, Foot, Hint, GhostBtn, Spacer }
  from './modalStyles';

const Grid = styled.div`
  display: grid;
  grid-template-columns: 7rem 1fr 1fr;
  gap: 0;
  font-size: 0.8125rem;

  @media (max-width: 640px) { grid-template-columns: 5.5rem 1fr 1fr; }
`;

const Th = styled.div`
  padding: 0.5rem 0.625rem;
  font-weight: 700;
  color: #0f172a;
  border-bottom: 2px solid #e2e8f0;
  font-size: 0.875rem;

  small { display: block; font-size: 0.6875rem; color: #64748b; font-weight: 500; }
`;

const Label = styled.div`
  padding: 0.5rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  background: #f8fafc;
  border-bottom: 1px solid #eef2f7;
`;

/**
 * ⚠️ **다른 값을 눈에 띄게 한다.** 견주기의 값은 「무엇이 같은가」가 아니라
 *    「어디서 갈리는가」다. 같은 값을 흐리게 두면 다른 줄이 저절로 도드라진다.
 */
const Cell = styled.div`
  padding: 0.5rem 0.625rem;
  border-bottom: 1px solid #eef2f7;
  line-height: 1.6;
  color: ${(p) => (p.$same ? '#94a3b8' : '#1e293b')};
  background: ${(p) => (p.$diff ? '#fffdf5' : 'transparent')};
  word-break: break-word;

  a { color: #4f46e5; text-decoration: none; display: inline-flex; align-items: center; gap: 0.1875rem; }
  a:hover { text-decoration: underline; }
`;

const Pill = styled.span`
  display: inline-block;
  padding: 0.125rem 0.4375rem;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #fff;
  background: ${(p) => p.$color};
`;

const Stale = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  color: #b45309;
  font-size: 0.6875rem;
  font-weight: 600;
  margin-left: 0.25rem;
`;

const dash = '—';
const listOf = (v) => ((v || []).length ? v.join(' · ') : dash);
const stageColor = (k) => (STAGES.find((s) => s.key === k) || {}).color || '#64748b';

/**
 * 그 줄이 **어디에 있나.**
 *
 * ⚠️⚠️ 역량은 제 단계가 없다 — 사업부가 적은 자리들이 곧 답이다. 하나로 뭉뚱그릴
 *    수 없어 **여럿을 나란히** 놓는다. 아무도 안 적었으면 그렇다고 말한다.
 */
const StageOf = ({ t }) => {
  if (t.stage) return <Pill $color={stageColor(t.stage)}>{t.stage}</Pill>;
  const marks = t.divisionMarks || [];
  if (!marks.length) {
    return <Pill $color="#94a3b8">아직 안 적힘</Pill>;
  }
  return marks.map((m) => (
    <Pill key={m.division} $color={stageColor(m.stage)}>
      {m.division} {m.stage}
    </Pill>
  ));
};

/**
 * 두 기술을 나란히 놓고 본다.
 *
 * ⚠️ **칸이 비어 있으면 견줄 것이 없다.** 그래서 빈 칸은 「—」로 또렷하게 두고,
 *    양쪽 다 비면 그 줄 자체가 흐려진다 — 무엇을 채워야 하는지가 그 자리에서 보인다.
 *
 * ⚠️ 단계가 다르면 그 줄을 물들인다. 견주는 이유가 대개 **「우리가 왜 이건 시험인데
 *    저건 보류인가」**라서다.
 */
const CompareModal = ({ a, b, onClose, onOpen }) => {
  if (!a || !b) return null;

  const rows = [
    ['한 줄 요약', a.summary, b.summary],
    ['공급사', a.vendor, b.vendor],
    ['분류', a.category, b.category],
    ['얽힌 갈래', listOf(a.tags), listOf(b.tags)],
    ['DTC 능력', listOf(a.cpt), listOf(b.cpt)],
    ['근거', `${a.evidenceCount ?? 0}건`, `${b.evidenceCount ?? 0}건`],
    ['그 단계로 정한 이유', a.stage_reason, b.stage_reason],
    ['우리한테 쓸 만한가', a.description, b.description],
  ];

  const head = (t) => (
    <Th>
      <button type="button"
              style={{ border: 'none', background: 'none', padding: 0, font: 'inherit',
                       cursor: 'pointer', color: 'inherit', textAlign: 'left' }}
              onClick={() => onOpen && onOpen(t)}>
        {t.name}
      </button>
      {/* ⚠️ 역량에는 공급사가 없다 — 「미상」이라 적으면 채워야 할 빈칸처럼 보인다. */}
      <small>{t.kind === 'capability' ? '역량' : (t.vendor || '공급사 미상')}</small>
    </Th>
  );

  return (
    <Overlay onClick={onClose}>
      <Panel $wide="52rem" onClick={(e) => e.stopPropagation()}>
        <Head>
          <Columns size={17} color="#4f46e5" />
          <h2>견주기</h2>
          <CloseBtn onClick={onClose}><X size={18} /></CloseBtn>
        </Head>

        <Body>
          <Grid>
            <Th />
            {head(a)}
            {head(b)}

            {/*
              ⚠️⚠️ **역량에는 단계가 없다**(2026-08-26). 그대로 찍으면 **빈 회색
                 알약**이 뜨고, 정작 답인 「누가 어디에 있나」는 어디에도 안 나온다.
            */}
            <Label>단계</Label>
            <Cell $diff={a.stage !== b.stage}>
              <StageOf t={a} />
              {a.isStale && <Stale><AlertTriangle size={11} /> 낡음</Stale>}
              {a.movedFrom && <Stale style={{ color: '#0f766e' }}>{a.movedFrom}→</Stale>}
            </Cell>
            <Cell $diff={a.stage !== b.stage}>
              <StageOf t={b} />
              {b.isStale && <Stale><AlertTriangle size={11} /> 낡음</Stale>}
              {b.movedFrom && <Stale style={{ color: '#0f766e' }}>{b.movedFrom}→</Stale>}
            </Cell>

            {rows.map(([label, va, vb]) => {
              const bothEmpty = !va && !vb;
              const differ = !bothEmpty && (va || dash) !== (vb || dash);
              return (
                <React.Fragment key={label}>
                  <Label>{label}</Label>
                  <Cell $same={bothEmpty} $diff={differ}>{va || dash}</Cell>
                  <Cell $same={bothEmpty} $diff={differ}>{vb || dash}</Cell>
                </React.Fragment>
              );
            })}

            <Label>공식 문서</Label>
            {[a, b].map((t, i) => (
              <Cell key={i} $same={!t.url}>
                {t.url
                  ? <a href={t.url} target="_blank" rel="noreferrer">
                      바로가기 <ExternalLink size={11} />
                    </a>
                  : dash}
              </Cell>
            ))}
          </Grid>

          <Hint>
            <b>노란 줄이 갈리는 곳</b>입니다. 양쪽 다 비어 있는 줄은 흐리게 뒀습니다 —
            <b> 채워야 할 칸</b>이 그 자리에서 보입니다.
          </Hint>
        </Body>

        <Foot>
          <Spacer />
          <GhostBtn onClick={onClose}>닫기</GhostBtn>
        </Foot>
      </Panel>
    </Overlay>
  );
};

export default CompareModal;
