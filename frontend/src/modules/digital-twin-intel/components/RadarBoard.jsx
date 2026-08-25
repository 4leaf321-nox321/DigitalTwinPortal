import React from 'react';
import styled from 'styled-components';
import { AlertTriangle } from 'lucide-react';

/**
 * 레이더를 **단계별 네 칸**으로 세운다.
 *
 * ⚠️ 표로 세우면 단계가 그냥 한 컬럼이 되고, 그러면 「우리가 어디까지 왔나」가
 *    안 보인다. 레이더의 값은 **칸마다 몇 개가 있는지**를 한눈에 보는 것이다.
 *
 * ⚠️ 순서가 왼쪽부터 도입 → 시험 → 관찰 → 보류 다. 안쪽(이미 쓰는 것)에서
 *    바깥쪽(아직 안 본 것)으로 가는 ThoughtWorks 레이더의 고리 순서 그대로다.
 */
/*
  ⚠️⚠️ **차례가 곧 레이더 고리 차례**다 — 앞이 안쪽(이미 쓰는 것), 뒤가 바깥쪽.
     서버(`models.STAGES`)와 **같은 차례**여야 한다. 갈리면 화면이 다른 고리에 그린다.

  ⚠️ 「감지」와 「관찰」의 차이가 이 층의 요점이다. 앞엣것은 **누가 넣었다**는 사실,
     뒤엣것은 **판단**이다. 안 갈려 있어서 검토하고 동의한 것과 한 번도 안 열어 본
     것이 같아 보였다(504칸 중 24칸만 차 있었는데 나머지가 전부 「관찰」로 보였다).
*/
const STAGES = [
  { key: '도입', desc: '이미 쓰고 있거나 바로 쓸 수 있다', color: '#0f766e', bg: '#f0fdfa', border: '#99f6e4' },
  { key: '시험', desc: '과제 하나에 걸어 보는 중', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  { key: '관찰', desc: '눈여겨보기로 정했다. 아직 안 써 봤다', color: '#a16207', bg: '#fefce8', border: '#fde68a' },
  { key: '감지', desc: '목록에 들어왔다. 아직 아무도 안 봤다', color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0' },
  { key: '보류', desc: '봤고, 지금은 아니라고 판단했다', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
];

const Board = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
  align-items: start;

  @media (max-width: 1400px) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  @media (max-width: 1100px) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  @media (max-width: 640px)  { grid-template-columns: 1fr; }
`;

const Column = styled.section`
  background: ${(p) => p.$bg};
  border: 1px solid ${(p) => p.$border};
  border-radius: 0.75rem;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-height: 8rem;
`;

const ColHead = styled.header`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;

  b {
    font-size: 0.875rem;
    color: ${(p) => p.$color};
  }
  span {
    font-size: 0.6875rem;
    color: #64748b;
    line-height: 1.5;
  }
`;

const Count = styled.span`
  font-weight: 700;
  opacity: 0.7;
`;

const Item = styled.button`
  width: 100%;
  text-align: left;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.5rem 0.625rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.1875rem;

  &:hover { border-color: #a5b4fc; }

  b { font-size: 0.8125rem; color: #0f172a; }
  small { font-size: 0.6875rem; color: #64748b; }

  /* 요약. ⚠️ **이 줄이 레이더를 참고 자료로 만든다** — 이름만 있으면 6개월 뒤
     「이게 뭐였지」가 되고, 그러면 아무도 안 본다. 두 줄에서 자른다. */
  q {
    font-size: 0.6875rem;
    color: #475569;
    line-height: 1.5;
    quotes: none;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3125rem;
`;

/**
 * ⚠️ **이 표시가 이 모듈의 자정 장치다.** 앞선 세 번의 시도(tech_radar ·
 *    tech_archive · digital_twin_solution)는 낡아도 낡은 줄 몰랐다 — 표는 늘
 *    그럴듯해 보인다. 화면이 스스로 「이 줄은 근거가 오래 없다」고 말해야 한다.
 */
const Stale = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  color: #b45309;
  font-size: 0.6875rem;
  font-weight: 600;
`;

/*
  ⚠️ 목록에서는 **역량과 도구가 섞여 나온다**(층으로 걸러 보기 전에는). 딱지가
     없으면 「explicit 해석」과 「LS-DYNA」가 같은 줄로 보이고, 그러면 단계를
     어디에 매기는 것인지가 사람마다 갈린다.
*/
const Kind = styled.span`
  flex-shrink: 0;
  padding: 0 0.3125rem;
  border-radius: 999px;
  font-size: 0.625rem;
  font-weight: 600;
  background: ${(p) => (p.$cap ? '#eef2ff' : '#f1f5f9')};
  color: ${(p) => (p.$cap ? '#4338ca' : '#64748b')};
`;

/* ⚠️ 기본 설정과 다르게 본 줄. 레이더의 ◆ 와 **같은 표시**여야 한다 — 두 화면이
      다른 기호를 쓰면 같은 것인지 알 수 없다. */
const Diff = styled.span`
  flex-shrink: 0;
  color: #4f46e5;
  font-size: 0.6875rem;
  font-weight: 700;
`;

const Empty = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
  padding: 0.5rem 0.25rem;
`;

const RadarBoard = ({ rows, onSelect }) => (
  <Board>
    {STAGES.map((st) => {
      const items = rows.filter((t) => t.stage === st.key);
      return (
        <Column key={st.key} $bg={st.bg} $border={st.border}>
          <ColHead $color={st.color}>
            <b>{st.key} <Count>{items.length}</Count></b>
            <span>{st.desc}</span>
          </ColHead>

          {items.length === 0 && <Empty>없음</Empty>}

          {items.map((t) => (
            <Item key={t.uuid} onClick={() => onSelect(t)}>
              <Row>
                <b>{t.name}</b>
                <Kind $cap={t.kind === 'capability'}>
                  {t.kind === 'capability' ? '역량' : '도구'}
                </Kind>
                {t.isDivisionOverride && (
                  <Diff title={`기본 설정은 「${t.companyStage}」 입니다`}>◆</Diff>
                )}
                {t.isStale && (
                  <Stale title={`근거가 ${t.staleAfterDays}일 넘게 없습니다. 아직 유효한지 확인이 필요합니다`}>
                    <AlertTriangle size={11} /> 낡음
                  </Stale>
                )}
              </Row>
              {t.summary && <q>{t.summary}</q>}
              <small>
                {t.vendor ? `${t.vendor} · ` : ''}
                {t.category || '분류 없음'} · 근거 {t.evidenceCount ?? 0}건
                {(t.children || []).length > 0 && ` · 도구 ${t.children.length}개`}
                {/* ⚠️ 여러 역량에 걸칠 수 있다 — 하나만 적으면 나머지가 숨는다. */}
                {(t.capabilities || []).length > 0
                  && ` · ${t.capabilities.map((c) => c.name).join(' · ')} 아래`}
                {/* ⚠️ 사업부 눈일 때는 **무엇으로 하는지**가 단계보다 먼저 궁금하다. */}
                {(t.divisionTools || []).length > 0
                  && ` · ${t.division}: ${t.divisionTools.join(' · ')}`}
              </small>
            </Item>
          ))}
        </Column>
      );
    })}
  </Board>
);

export { STAGES };
export default RadarBoard;
