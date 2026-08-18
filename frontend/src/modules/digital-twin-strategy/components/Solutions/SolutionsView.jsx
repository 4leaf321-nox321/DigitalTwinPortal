import React, { useState } from 'react';
import styled from 'styled-components';
import {
  Plus, Trash2, Link2, X, Check, AlertTriangle, Info, Minus, Ban, Target,
  Search, Briefcase,
} from 'lucide-react';
import FlowMap from '../FlowMap';
import DivisionFilter, {
  countByDivision, inDivision,
} from '../DivisionFilter';

// ④ 솔루션 — TOWS.
//
// ⚠️ **조합 격자를 그리지 않는다.** 강점 5개 × 기회 5개면 25칸이고, 그걸 채우라고
//    내밀면 이 모듈이 계속 피해 온 「격자 채우기」가 그대로 재현된다. 스물다섯 개의
//    솔루션을 적을 조직은 없고, 억지로 채운 것은 읽히지 않는다.
//
//    대신 네 갈래를 **바구니**로 둔다. 솔루션을 적을 때 무엇과 무엇을 엮은 것인지를
//    고르게 한다 — **빈 칸이 아니라 빈 목록**이라 채울 의무가 없다.
//
// ⚠️ **엮는 것을 강요하지 않는다.** 근거를 대야만 저장되게 막으면 사람은 아무거나
//    골라 붙인다. 그러면 근거란이 거짓말을 하기 시작한다.

const Layout = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
`;

const Wrap = styled.div`
  flex: 1;
  min-width: 0;
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

const Notice = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 0.6rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #fde68a;
  background: #fffdf5;
  color: #92400e;
  font-size: 0.75rem;
  line-height: 1.6;
`;

const Baskets = styled.div`
  display: grid;
  gap: 0.875rem;
  grid-template-columns: 1fr;
  @media (min-width: 62rem) { grid-template-columns: 1fr 1fr; }
`;

const Basket = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.875rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-top: 3px solid ${p => p.$color};
  border-radius: 0.625rem;
`;

const BasketHead = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  flex-wrap: wrap;
`;

const Tows = styled.span`
  font-size: 0.875rem;
  font-weight: 800;
  color: ${p => p.$color};
  letter-spacing: 0.02em;
`;

const BasketTitle = styled.span`
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1e293b;
`;

const Count = styled.span`
  margin-left: auto;
  font-size: 0.75rem;
  color: #94a3b8;
`;

// 첫 화면 안내. **솔루션이 하나라도 생기면 사라진다** — 설명이 필요한 곳은 빈
// 상태이고, 이미 아는 사람에게 계속 설명하면 그 자리가 낭비된다.
// (② 이슈의 "이 난제를 넘으려면 무엇을 해야 합니까?" 와 같은 규칙)
const Guide = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.875rem 1rem;
  border: 1px solid #ddd6fe;
  border-radius: 0.625rem;
  background: #faf8ff;
`;

const GuideTitle = styled.div`
  font-size: 0.8125rem;
  font-weight: 700;
  color: #6d28d9;
`;

const GuideStep = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-size: 0.8125rem;
  line-height: 1.65;
  color: #334155;
`;

const GuideNum = styled.span`
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  margin-top: 0.15rem;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  font-size: 0.6875rem;
  font-weight: 800;
  color: white;
  background: ${p => (p.$done ? '#7c3aed' : '#c4b5fd')};
`;

const GuideCount = styled.strong`
  color: ${p => (p.$zero ? '#b45309' : '#0f766e')};
`;

const GuideLink = styled.button`
  margin-left: 0.4rem;
  padding: 0.1rem 0.4rem;
  border: 1px solid #c4b5fd;
  border-radius: 0.3rem;
  background: white;
  color: #6d28d9;
  font-size: 0.75rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  &:hover { background: #ede9fe; }
`;

// 바구니와 같은 상자인데 갈래 색 띠가 없다. 사분면은 네 갈래와 나란한 것이
// 아니라 **같은 솔루션들을 다른 눈으로 보는 곳**이라, 같은 모양이면 다섯 번째
// 바구니로 읽힌다.
const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.875rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.625rem;
`;

const BoxHead = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
`;

const BoxTitle = styled.span`
  font-size: 0.875rem;
  font-weight: 700;
  color: #1e293b;
`;

const BasketNote = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.55;
`;

const Card = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border-radius: 0.375rem;
  background: #f8fafc;
`;

const CardBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const CardTitle = styled.div`
  font-size: 0.8125rem;
  line-height: 1.55;
  color: #1e293b;
  font-weight: 600;
`;

const CardDetail = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  margin-top: 0.2rem;
  line-height: 1.55;
`;

const Basis = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-top: 0.35rem;
`;

const Chip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
  border: 1px solid ${p => (p.$on ? p.$color : '#e2e8f0')};
  background: ${p => (p.$on ? `${p.$color}12` : 'white')};
  color: ${p => (p.$on ? p.$color : '#64748b')};
  font-size: 0.6875rem;
  font-weight: 600;
  font-family: inherit;
  line-height: 1.5;
  text-align: left;
  cursor: ${p => (p.$static ? 'default' : 'pointer')};
  &:hover { border-color: ${p => p.$color}; }
`;

const KindMark = styled.span`
  flex-shrink: 0;
  width: 0.95rem;
  height: 0.95rem;
  border-radius: 0.2rem;
  display: inline-grid;
  place-items: center;
  font-size: 0.625rem;
  font-weight: 800;
  color: white;
  background: ${p => p.$color};
`;

const NoBasis = styled.span`
  font-size: 0.6875rem;
  color: #cbd5e1;
`;

// 요소가 어느 사업부 것인가 — ③ 분석과 같은 자리.
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
  &:hover { background: ${p => p.$danger ? '#fef2f2' : '#f1f5f9'};
            color: ${p => p.$danger ? '#dc2626' : '#475569'}; }
`;

const Empty = styled.div`
  padding: 0.6rem 0.4rem;
  color: #94a3b8;
  font-size: 0.8125rem;
  line-height: 1.6;
`;

const Composer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.6rem;
  border: 1px solid #ddd6fe;
  border-radius: 0.5rem;
  background: #faf8ff;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.4rem 0.55rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-family: inherit;
  color: #1e293b;
  &:focus { outline: none; border-color: #7c3aed; }
`;

const PickLabel = styled.div`
  font-size: 0.6875rem;
  font-weight: 700;
  color: #6d28d9;
  margin-bottom: 0.2rem;
`;

const PickRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
`;

const ComposerFoot = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.6rem;
  border: 1px dashed #cbd5e1;
  border-radius: 0.375rem;
  background: transparent;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  align-self: flex-start;
  &:hover { border-color: #7c3aed; color: #6d28d9; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const SaveButton = styled(AddButton)`
  border: none;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  &:hover { color: white; box-shadow: 0 3px 10px rgba(139, 92, 246, 0.3); }
`;

// ── AX-5R 게이트 ───────────────────────────────────────────────────────────
//
// ⚠️ **막는 관문이 아니다.** 다섯을 다 채워야 저장되게 하면 사람은 아무 말이나
//    적어 넣고, 그러면 게이트란 전체가 거짓말이 된다. 안 채워진 것은 보이기만 한다.
const GateStrip = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
  margin-top: 0.35rem;
`;

const GateMark = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.1rem 0.35rem;
  border-radius: 0.25rem;
  border: 1px solid ${p => (p.$done ? '#bbf7d0' : '#e2e8f0')};
  background: ${p => (p.$done ? '#f0fdf4' : 'white')};
  color: ${p => {
    if (p.$na) return '#94a3b8';
    return p.$done ? '#15803d' : '#cbd5e1';
  }};
  font-size: 0.6875rem;
  font-weight: 600;
  font-family: inherit;
  line-height: 1.6;
  cursor: pointer;
  &:hover { border-color: #7c3aed; color: #6d28d9; }
`;

const GateScore = styled.span`
  font-size: 0.6875rem;
  font-weight: 700;
  color: ${p => (p.$full ? '#15803d' : '#b45309')};
`;

const GateRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid #f1f5f9;
  &:last-of-type { border-bottom: none; }
`;

const GateQuestion = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: #64748b;
`;

const GateName = styled.span`
  font-weight: 700;
  color: #1e293b;
`;

const NaToggle = styled.button`
  margin-left: auto;
  padding: 0.05rem 0.35rem;
  border-radius: 0.25rem;
  border: 1px solid ${p => (p.$on ? '#cbd5e1' : 'transparent')};
  background: ${p => (p.$on ? '#f1f5f9' : 'transparent')};
  color: ${p => (p.$on ? '#475569' : '#cbd5e1')};
  font-size: 0.6875rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { color: #475569; border-color: #cbd5e1; }
`;

const GateError = styled.div`
  font-size: 0.6875rem;
  color: #b91c1c;
`;

// ── 사분면 ─────────────────────────────────────────────────────────────────
//
// ⚠️ **안 매긴 솔루션은 사분면에 안 올린다.** 0 으로 놓으면 아직 판단하지 않은 솔루션이
//    「영향 낮음 × 어려움」 칸으로 굴러떨어져 '하지 않는다'로 읽힌다. 안 매긴
//    것은 칸 밖에 따로 세어 보여준다.
const Quad = styled.div`
  display: grid;
  gap: 0.5rem;
  grid-template-columns: 1fr;
  @media (min-width: 62rem) { grid-template-columns: 1fr 1fr; }
`;

const QuadCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-height: 5rem;
  padding: 0.6rem 0.7rem;
  border-radius: 0.5rem;
  border: 1px solid ${p => p.$strong ? '#ddd6fe' : '#e2e8f0'};
  background: ${p => p.$strong ? '#faf8ff' : '#f8fafc'};
`;

const QuadHead = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
`;

const QuadName = styled.span`
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1e293b;
`;

const QuadAxis = styled.span`
  font-size: 0.6875rem;
  color: #94a3b8;
`;

const QuadItem = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.3rem;
  font-size: 0.75rem;
  line-height: 1.55;
  color: #334155;
`;

const Score = styled.select`
  padding: 0.05rem 0.2rem;
  border: 1px solid transparent;
  border-radius: 0.25rem;
  background: transparent;
  color: ${p => (p.$set ? '#475569' : '#cbd5e1')};
  font-size: 0.6875rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  &:hover { border-color: #cbd5e1; background: white; }
`;

// ── 과제 선택 ──────────────────────────────────────────────────────────────
//
// 지표(열여섯 개)처럼 칩으로 다 펴 놓지 않고 검색해서 고른다.
//
// 과제는 한 해에 200여 건, 사업부별로는 30~100건이다(개발 DB 실측). 다 펴 놓아도
// 못 볼 양은 아니지만, 그러면 바구니 하나가 화면을 덮는다. 열자마자 **그 사업부의
// 올해 과제가 떠 있고** 검색으로 좁히는 편이, 200줄을 훑는 것보다 빠르다.
const SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
`;

const SearchInput = styled.input`
  flex: 1;
  min-width: 0;
  padding: 0.35rem 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-family: inherit;
  color: #1e293b;
  &:focus { outline: none; border-color: #7c3aed; }
`;

const Results = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  max-height: 13rem;
  overflow-y: auto;
  margin-top: 0.3rem;
`;

const Result = styled.button`
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  width: 100%;
  padding: 0.3rem 0.4rem;
  border: none;
  border-radius: 0.3rem;
  background: ${p => (p.$on ? '#f5f3ff' : 'transparent')};
  box-shadow: ${p => (p.$on ? 'inset 3px 0 0 #7c3aed' : 'none')};
  color: #334155;
  font-size: 0.75rem;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
  &:hover { background: ${p => (p.$on ? '#f5f3ff' : '#f8fafc')}; }
`;

const Code = styled.span`
  flex-shrink: 0;
  font-weight: 700;
  color: #6d28d9;
`;

const Meta = styled.span`
  margin-left: auto;
  flex-shrink: 0;
  font-size: 0.6875rem;
  color: #94a3b8;
`;

// 요소가 이보다 많으면 칩으로 다 펴 놓지 않는다.
//
// ⚠️ 지금은 약점 12개라 견디지만, **약점 후보만 40건**이라 다 올리면 한 줄에
//    마흔 개가 늘어선다. 그때는 고르는 것이 아니라 찾는 일이 된다.
//    과제와 달리 요소는 이미 화면에 다 있으므로 **서버에 묻지 않고** 거른다.
const ELEMENT_SEARCH_AT = 8;

const ElementSearch = styled.input`
  width: 100%;
  padding: 0.3rem 0.5rem;
  margin-bottom: 0.3rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-family: inherit;
  color: #1e293b;
  &:focus { outline: none; border-color: #7c3aed; }
`;

const PickScroll = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  max-height: 9rem;
  overflow-y: auto;
`;

const KIND = {
  S: { label: '강점', color: '#0f766e' },
  W: { label: '약점', color: '#b45309' },
  O: { label: '기회', color: '#1d4ed8' },
  T: { label: '위협', color: '#b91c1c' },
};

// 네 갈래. **이름 자체가 「무엇을 무엇으로 푸는가」다** — 그래서 바구니마다
// 엮을 수 있는 요소가 정해져 있다.
const TOWS = [
  {
    key: 'SO', kinds: ['S', 'O'], color: '#0f766e',
    title: '강점으로 기회를 잡는다',
    note: '잘하는 것을 더 크게 쓰는 솔루션입니다. 가장 먼저 손대는 곳입니다.',
  },
  {
    key: 'WO', kinds: ['W', 'O'], color: '#1d4ed8',
    title: '기회를 빌려 약점을 메운다',
    note: '지금 부족한 것을 바깥의 변화에 얹어 채우는 솔루션입니다.',
  },
  {
    key: 'ST', kinds: ['S', 'T'], color: '#b45309',
    title: '강점으로 위협을 막는다',
    note: '버틸 수 있는 근거가 있는 곳. 무엇으로 막을지를 적습니다.',
  },
  {
    key: 'WT', kinds: ['W', 'T'], color: '#b91c1c',
    title: '약점과 위협이 겹친다',
    note: '가장 위험한 자리입니다. 이기는 솔루션이 아니라 피하거나 줄이는 것이어도 됩니다.',
  },
];

const SCORES = [1, 2, 3, 4, 5];

// 4 이상을 '높음'으로 본다. 3은 '보통'이라 먼저 할 이유가 되지 못한다.
// **이 규칙을 화면에 적는다** — 어디서 갈렸는지 안 보이면 칸 배치가 임의로 읽힌다.
const HIGH = 4;

// 사분면 네 칸. 「하지 않는다」도 칸으로 둔다 — 안 하기로 한 것도 판단이고,
// 그것이 안 남으면 내년에 같은 것을 다시 검토한다(이슈의 dropped 와 같은 이유).
const QUADRANTS = [
  { key: 'now', impact: true, easy: true, name: '먼저 한다',
    axis: '영향 큼 · 할 만함', strong: true },
  { key: 'prepare', impact: true, easy: false, name: '준비해서 한다',
    axis: '영향 큼 · 어려움', strong: true },
  { key: 'spare', impact: false, easy: true, name: '틈틈이',
    axis: '영향 작음 · 할 만함', strong: false },
  { key: 'no', impact: false, easy: false, name: '하지 않는다',
    axis: '영향 작음 · 어려움', strong: false },
];

const SolutionsView = ({
  solutions, elements, divisions, gateDefinitions, kpiDefinitions,
  linkedProjects, nowMax, onSearchProjects, canEdit,
  onCreate, onUpdate, onDelete, onGatesSave, onGoAnalysis,
}) => {
  // null 이면 전체. 사업부를 고르면 그 사업부 것과 **전사 공통**을 함께 본다.
  const [division, setDivision] = useState(null);
  const [composing, setComposing] = useState(null);   // 적고 있는 바구니
  const [draft, setDraft] = useState({ title: '', detail: '', ids: [] });
  const [editing, setEditing] = useState(null);       // 근거를 고치는 솔루션
  const [gateFor, setGateFor] = useState(null);       // 게이트를 답하는 솔루션
  const [gateDraft, setGateDraft] = useState({});     // {gate: {answer, status}}
  const [gateError, setGateError] = useState(null);
  // 과제 검색. **솔루션 하나를 고칠 때만** 열리므로 상태 하나로 충분하다.
  const [projectQuery, setProjectQuery] = useState('');
  // 요소 고르기의 검색어. {kind: '검색어'}
  const [elementQuery, setElementQuery] = useState({});
  const [projectHits, setProjectHits] = useState({ items: [], total: 0 });

  const gates = gateDefinitions || [];
  const answered = (s) => gates.filter(g => (s.gates || {})[g.key]).length;
  const kpiById = (id) => (kpiDefinitions || []).find(k => k.id === id);
  // 못 찾는 과제는 조용히 빠진다 — 지워진 과제다(서버가 안 내려준다).
  const projectByUuid = (uuid) => (linkedProjects || {})[uuid];

  const findProjects = async (q, divisionId) => {
    setProjectQuery(q);
    const found = await onSearchProjects({ q, divisionId });
    setProjectHits(found || { items: [], total: 0 });
  };

  const openGates = (s) => {
    setGateError(null);
    setGateFor(s.id);
    // 지금 답을 그대로 담아 연다. 비운 채 저장하면 지우기다.
    const next = {};
    gates.forEach(g => {
      const cur = (s.gates || {})[g.key];
      next[g.key] = { answer: cur?.answer || '', status: cur?.status || 'answered' };
    });
    setGateDraft(next);
  };

  const saveGates = async (s) => {
    // ⚠️ '해당 없음'인데 이유가 없으면 막는다. 그걸 통과시키면 안 답한 것과
    //    구별이 안 되면서 화면에서는 다 채운 것처럼 보인다(서버도 거절한다).
    const naEmpty = gates.find(g => gateDraft[g.key]?.status === 'na'
      && !gateDraft[g.key]?.answer.trim());
    if (naEmpty) {
      setGateError(`${naEmpty.label}: 해당 없는 이유를 적어야 합니다.`);
      return;
    }
    // 바뀐 것만 보낸다.
    const entries = gates.map(g => ({
      gate: g.key,
      answer: (gateDraft[g.key]?.answer || '').trim(),
      status: gateDraft[g.key]?.status || 'answered',
    })).filter(e => {
      const cur = (s.gates || {})[e.gate];
      return e.answer !== (cur?.answer || '')
        || (e.answer && e.status !== (cur?.status || 'answered'));
    });
    if (entries.length === 0) { setGateFor(null); return; }

    const ok = await onGatesSave(s.id, entries);
    if (ok !== false) setGateFor(null);
  };

  const divisionName = (id) => divisions.find(d => d.id === id)?.name || null;
  const shown = (solutions || []).filter(s => inDivision(s, division));
  // 엮을 후보도 지금 보고 있는 범위에 맞춘다. MX 를 보면서 NW 의 약점을 엮으면
  // 그 솔루션은 MX 화면에서 근거가 안 보인다.
  const pickable = (elements || []).filter(e => inDivision(e, division));
  const byKind = (kind) => pickable.filter(e => e.kind === kind);
  const elementById = (id) => (elements || []).find(e => e.id === id);

  const openComposer = (towsKey) => {
    setComposing(towsKey);
    setDraft({ title: '', detail: '', ids: [] });
  };

  const toggle = (list, id) => (
    list.includes(id) ? list.filter(x => x !== id) : [...list, id]
  );

  const save = async (towsKey) => {
    const title = draft.title.trim();
    if (!title) return;
    const ok = await onCreate({
      tows: towsKey,
      title,
      detail: draft.detail.trim() || null,
      division_id: division,
      element_ids: draft.ids,
    });
    if (ok !== false) setComposing(null);
  };

  // 요소를 고르는 자리. 바구니가 허용하는 종류만 내민다 — SO 에 위협을 엮으면
  // 그 솔루션이 무엇을 푸는 것인지 이름과 내용이 어긋난다(서버도 거절한다).
  const picker = (kinds, ids, onToggle) => kinds.map(kind => {
    const all = byKind(kind);
    const q = (elementQuery[kind] || '').trim();
    // ⚠️ **고른 것은 검색어와 상관없이 늘 보인다.** 안 그러면 검색하는 사이에
    //    이미 엮은 것이 사라져, 무엇을 골랐는지 모른 채 고르게 된다.
    const items = q
      ? all.filter(e => ids.includes(e.id) || e.title.includes(q))
      : all;
    const Row = all.length > ELEMENT_SEARCH_AT ? PickScroll : PickRow;

    return (
      <div key={kind}>
        <PickLabel>
          {KIND[kind].label}에서
          {all.length > ELEMENT_SEARCH_AT && ` · ${items.length}/${all.length}`}
        </PickLabel>
        {all.length === 0 ? (
          <NoBasis>
            ③ 분석에 {KIND[kind].label}이(가) 아직 없습니다 — 엮지 않고 적어도 됩니다.
          </NoBasis>
        ) : (
          <>
            {all.length > ELEMENT_SEARCH_AT && (
              <ElementSearch
                value={elementQuery[kind] || ''}
                onChange={ev => setElementQuery(
                  v => ({ ...v, [kind]: ev.target.value }))}
                placeholder={`${KIND[kind].label} ${all.length}개 중에서 찾기`}
              />
            )}
            <Row>
              {items.length === 0 ? (
                <NoBasis>찾은 {KIND[kind].label}이(가) 없습니다.</NoBasis>
              ) : items.map(e => (
                <Chip
                  key={e.id}
                  type="button"
                  $on={ids.includes(e.id)}
                  $color={KIND[kind].color}
                  onClick={() => onToggle(e.id)}
                >
                  <KindMark $color={KIND[kind].color}>{kind}</KindMark>
                  {e.title}
                  {ids.includes(e.id) && <Check size={11} />}
                </Chip>
              ))}
            </Row>
          </>
        )}
      </div>
    );
  });

  const card = (s) => {
    const linked = (s.element_ids || [])
      .map(elementById)
      .filter(Boolean);   // 요소가 지워졌으면 조용히 빠진다. 없는 것을 있는 척하지 않는다.
    const spec = TOWS.find(t => t.key === s.tows);

    return (
      <Card key={s.id}>
        <CardBody>
          <CardTitle>{s.title}</CardTitle>
          {s.detail && <CardDetail>{s.detail}</CardDetail>}

          <Basis>
            <Where
              disabled={!canEdit}
              value={s.division_id ?? ''}
              onChange={ev => onUpdate(s.id, {
                division_id: ev.target.value === '' ? null : Number(ev.target.value),
              })}
              title="이 솔루션이 어느 사업부의 것인지"
            >
              <option value="">전사 (모든 사업부에 보임)</option>
              {divisions.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Where>

            {linked.map(e => (
              <Chip key={e.id} as="span" $static $on $color={KIND[e.kind].color}>
                <KindMark $color={KIND[e.kind].color}>{e.kind}</KindMark>
                {e.title}
              </Chip>
            ))}
            {linked.length === 0 && <NoBasis>엮은 요소 없음</NoBasis>}

            {/* 이 솔루션을 실제로 해내는 과제. **여기가 비면 아직 말뿐이다.** */}
            {(s.project_uuids || []).map(projectByUuid).filter(Boolean).map(p => (
              <Chip key={p.uuid} as="span" $static $on $color="#0f766e"
                    title={`${p.year}년 · ${p.division || '사업부 없음'}`}>
                <Briefcase size={10} />
                {p.code || p.title}
              </Chip>
            ))}

            {/* 지표에 걸린 솔루션. 전략과 실행이 여기서 이어진다. */}
            {(s.kpi_ids || []).map(kpiById).filter(Boolean).map(k => (
              <Chip key={k.id} as="span" $static $on $color="#7c3aed">
                <Target size={10} />
                {k.label}
              </Chip>
            ))}

            {canEdit && (
            <IconButton
              onClick={() => {
                const open = editing === s.id;
                setEditing(open ? null : s.id);
                if (!open) {
                  // 열자마자 고를 것이 보여야 한다. 빈 검색창만 있으면
                  // 무엇을 쳐야 할지 몰라 그냥 닫는다.
                  setProjectHits({ items: [], total: 0 });
                  findProjects('', s.division_id ?? division);
                }
              }}
              title="엮은 요소 · 지표 · 과제 고치기"
            >
              <Link2 size={13} />
            </IconButton>
            )}

            {/* ⚠️ 비울 수 있어야 한다. 근거 없이 매긴 숫자는 사분면을 거짓말로
                만든다 — 이슈의 영향도·실행가능성과 같은 규칙이다. */}
            <Score
              disabled={!canEdit}
              $set={s.impact != null}
              value={s.impact ?? ''}
              onChange={ev => onUpdate(s.id, {
                impact: ev.target.value === '' ? null : Number(ev.target.value),
              })}
              title="이 솔루션이 통하면 얼마나 달라지는가. 근거가 없으면 비워두세요."
            >
              <option value="">영향 —</option>
              {SCORES.map(n => <option key={n} value={n}>영향 {n}</option>)}
            </Score>
            <Score
              disabled={!canEdit}
              $set={s.feasibility != null}
              value={s.feasibility ?? ''}
              onChange={ev => onUpdate(s.id, {
                feasibility: ev.target.value === '' ? null : Number(ev.target.value),
              })}
              title="올해 손댈 수 있는가. 근거가 없으면 비워두세요."
            >
              <option value="">실행 —</option>
              {SCORES.map(n => <option key={n} value={n}>실행 {n}</option>)}
            </Score>
          </Basis>

          {editing === s.id && (
            <Composer style={{ marginTop: '0.4rem' }}>
              {picker(spec?.kinds || [], s.element_ids || [], (id) => onUpdate(s.id, {
                element_ids: toggle(s.element_ids || [], id),
              }))}

              {/* 이 솔루션이 움직이려는 지표. ① 진단이 짚는 'KPI 에 안 걸린 과제'가
                  여기서 반대편에서 닫힌다 — 다만 여기서도 **의무는 아니다.** */}
              <div>
                <PickLabel>움직이려는 지표</PickLabel>
                {(kpiDefinitions || []).length === 0 ? (
                  <NoBasis>등록된 지표가 없습니다.</NoBasis>
                ) : (
                  <PickRow>
                    {(kpiDefinitions || []).map(k => (
                      <Chip
                        key={k.id}
                        type="button"
                        $on={(s.kpi_ids || []).includes(k.id)}
                        $color="#7c3aed"
                        onClick={() => onUpdate(s.id, {
                          kpi_ids: toggle(s.kpi_ids || [], k.id),
                        })}
                      >
                        <Target size={10} />
                        {k.label}
                        {(s.kpi_ids || []).includes(k.id) && <Check size={11} />}
                      </Chip>
                    ))}
                  </PickRow>
                )}
              </div>

              {/* ⚠️ **지표는 겨냥이고 과제는 실행이다.** 「가상검증률을 올리겠다」는
                  겨냥이지, 그것을 누가 무엇으로 하는지는 과제가 답한다. 여기가
                  비어 있으면 그 솔루션은 아직 말뿐이고, 그 사실이 ① 진단에
                  「전략에 안 걸린 과제」로도 나타난다. */}
              <div>
                <PickLabel>이것을 해내는 과제</PickLabel>
                <SearchRow>
                  <Search size={13} color="#94a3b8" />
                  <SearchInput
                    value={projectQuery}
                    onChange={e => findProjects(e.target.value,
                                                s.division_id ?? division)}
                    placeholder="과제 이름이나 번호로 찾기 (비우면 올해 것부터)"
                  />
                </SearchRow>
                {/* ⚠️ **잘렸으면 잘렸다고 말한다.** 조용히 상한에서 끊으면
                    찾던 과제가 없는 것과 구별이 안 된다. */}
                {projectHits.truncated && (
                  <NoBasis>
                    {projectHits.total}건 중 일부만 보입니다 — 이름으로 좁혀 주세요.
                  </NoBasis>
                )}
                <Results>
                  {(projectHits.items || []).length === 0 ? (
                    <NoBasis>
                      {projectQuery
                        ? '찾은 과제가 없습니다.'
                        : '이 사업부의 올해 과제가 없습니다. 이름으로 찾아보세요.'}
                    </NoBasis>
                  ) : projectHits.items.map(p => {
                    const on = (s.project_uuids || []).includes(p.uuid);
                    return (
                      <Result
                        key={p.uuid}
                        type="button"
                        $on={on}
                        onClick={() => onUpdate(s.id, {
                          project_uuids: toggle(s.project_uuids || [], p.uuid),
                        })}
                      >
                        <Code>{p.code}</Code>
                        {p.title}
                        <Meta>
                          {p.year} · {p.division || '—'}
                          {on && ' ✓'}
                        </Meta>
                      </Result>
                    );
                  })}
                </Results>
              </div>

              <ComposerFoot>
                <AddButton onClick={() => setEditing(null)}>
                  <Check size={13} /> 다 골랐습니다
                </AddButton>
              </ComposerFoot>
            </Composer>
          )}

          {/* AX-5R — 이 솔루션을 정말 할 수 있는가. 표시일 뿐 막지 않는다. */}
          {gates.length > 0 && (
            <GateStrip>
              {gates.map(g => {
                const cur = (s.gates || {})[g.key];
                return (
                  <GateMark
                    key={g.key}
                    $done={!!cur}
                    $na={cur?.status === 'na'}
                    onClick={() => {
                      if (!canEdit) return;   // 보기만 하는 사람에게는 표시다
                      return gateFor === s.id ? setGateFor(null) : openGates(s);
                    }}
                    title={cur ? `${g.question} — ${cur.answer}` : g.question}
                  >
                    {cur?.status === 'na' ? <Ban size={10} />
                      : cur ? <Check size={10} /> : <Minus size={10} />}
                    {g.label}
                  </GateMark>
                );
              })}
              <GateScore $full={answered(s) === gates.length}>
                {answered(s)}/{gates.length}
              </GateScore>
            </GateStrip>
          )}

          {gateFor === s.id && (
            <Composer style={{ marginTop: '0.4rem' }}>
              <PickLabel>이 솔루션을 정말 할 수 있는가 (AX-5R)</PickLabel>
              {gates.map(g => (
                <GateRow key={g.key}>
                  <GateQuestion>
                    <GateName>{g.label}</GateName>
                    {g.question}
                    <NaToggle
                      $on={gateDraft[g.key]?.status === 'na'}
                      onClick={() => setGateDraft(d => ({
                        ...d,
                        [g.key]: {
                          ...d[g.key],
                          status: d[g.key]?.status === 'na' ? 'answered' : 'na',
                        },
                      }))}
                      title="해당 없음 — 다만 왜 해당 없는지는 적어야 합니다"
                    >
                      해당 없음
                    </NaToggle>
                  </GateQuestion>
                  <Input
                    value={gateDraft[g.key]?.answer || ''}
                    onChange={e => setGateDraft(d => ({
                      ...d, [g.key]: { ...d[g.key], answer: e.target.value },
                    }))}
                    placeholder={gateDraft[g.key]?.status === 'na'
                      ? '왜 해당 없는지'
                      : '비워 두면 안 답한 것으로 둡니다'}
                  />
                </GateRow>
              ))}
              {gateError && <GateError>{gateError}</GateError>}
              <ComposerFoot>
                <SaveButton onClick={() => saveGates(s)}>
                  <Check size={13} /> 저장
                </SaveButton>
                <AddButton onClick={() => setGateFor(null)}>
                  <X size={13} /> 닫기
                </AddButton>
              </ComposerFoot>
            </Composer>
          )}
        </CardBody>

        {canEdit && (
          <IconButton $danger onClick={() => onDelete(s.id)} title="삭제">
            <Trash2 size={13} />
          </IconButton>
        )}
      </Card>
    );
  };

  // 어느 갈래가 아예 못 만들어지는지. **진행을 막지는 않는다** — 비어 있다고
  // 틀린 것이 아니고, O·T 는 설문을 돌리기 전에는 빌 수밖에 없다.
  const missing = TOWS.filter(t => t.kinds.some(k => byKind(k).length === 0));

  // 빈 바구니에 내미는 한 줄. **실제 요소 한 짝**을 예로 든다.
  //
  // ⚠️ 조사(을/를·으로)를 요소 이름 뒤에 붙이지 않는다. 「…」 뒤에는 받침을 볼 수
  //    없어 늘 어색해지고, 그렇다고 조사 판별기를 두기엔 여기 한 곳뿐이다.
  //    그래서 이름은 「A」 × 「B」 로만 세우고 묻는 말은 그 뒤에 따로 붙인다.
  const invite = (t) => {
    const lacking = t.kinds.filter(k => byKind(k).length === 0);
    if (lacking.length) {
      return `③ 분석의 ${lacking.map(k => KIND[k].label).join('·')} 칸이 비어 `
        + '있습니다. 채우면 여기서 엮을 수 있습니다.';
    }
    const [a, b] = t.kinds.map(k => byKind(k)[0]);
    return `예를 들어 「${a.title}」 × 「${b.title}」 — 이 둘을 엮으면 무슨 솔루션이 나옵니까?`;
  };

  // 다섯 질문에 다 답하지 않은 솔루션. 세기만 한다.
  const incomplete = gates.length
    ? shown.filter(s => answered(s) < gates.length).length
    : 0;

  // 사분면. **둘 다 매긴 솔루션만 올라간다.**
  const scored = shown.filter(s => s.impact != null && s.feasibility != null);
  const unscored = shown.filter(s => s.impact == null || s.feasibility == null);
  const inQuadrant = (s, q) => (
    (s.impact >= HIGH) === q.impact && (s.feasibility >= HIGH) === q.easy
  );

  // ⚠️ **다 1순위면 순위를 안 정한 것과 같다.** 사분면은 무엇이 급한지 가르지만
  //    조직이 한 해에 해내는 양은 못 본다. 세어서 짚기만 하고 막지는 않는다.
  //
  //    **지금 보는 범위**로 센다 — 사업부를 골라 놓고 전사 숫자를 띄우면
  //    화면에 세 건이 보이는데 "열두 건"이라고 말하는 꼴이 된다.
  const nowCount = scored.filter(s => inQuadrant(s, QUADRANTS[0])).length;
  const crowded = nowMax > 0 && nowCount > nowMax;

  // 실행으로 안 이어진 솔루션. 지표만 걸고 과제가 없으면 아직 말뿐이다.
  const wordsOnly = shown.filter(s => !(s.project_uuids || []).length);

  const flow = [
    { kind: 'group', label: '③ 분석 SWOT 에서' },
    { kind: 'node', id: 'sec-tows-so', label: 'SO 강점 × 기회' },
    { kind: 'node', id: 'sec-tows-wo', label: 'WO 약점 × 기회' },
    { kind: 'node', id: 'sec-tows-st', label: 'ST 강점 × 위협' },
    { kind: 'node', id: 'sec-tows-wt', label: 'WT 약점 × 위협' },
    { kind: 'branch', into: true, text: <>엮은 요소가 <strong>그 솔루션의 근거</strong></> },
    { kind: 'branch', into: true, text: <>솔루션마다 <strong>AX-5R 다섯 질문</strong></> },
    { kind: 'link', note: '영향 × 실행가능성으로' },
    { kind: 'node', id: 'sec-portfolio', label: '무엇부터 하는가' },
    { kind: 'branch', into: true, text: <>지표와 <strong>과제</strong>에 걸어</> },
    { kind: 'exit', label: '⑤ 기획서 (다음 단계)' },
  ];

  return (
    <Layout>
      <FlowMap items={flow} />
      <Wrap>
        <DivisionFilter
          divisions={divisions}
          value={division}
          onChange={setDivision}
          counts={countByDivision(solutions || [], divisions)}
        />

        <Head>
          <StepBadge>4</StepBadge>
          <Title>
            솔루션{division !== null && ` · ${divisionName(division)}`}
          </Title>
          <Hint>
            ③ 분석의 <strong>SWOT 을 엮어 솔루션을 냅니다.</strong> 「무엇으로 무엇을
            푸는가」가 갈래 이름입니다.
          </Hint>
        </Head>

        {/* 첫 화면에서 무엇을 해야 하는지. 솔루션이 하나라도 생기면 사라진다 —
            이미 아는 사람에게 계속 설명하면 그 자리가 낭비된다. */}
        {shown.length === 0 && (
          <Guide>
            <GuideTitle>여기서 하는 일</GuideTitle>
            <GuideStep>
              {/* 한 갈래라도 엮을 수 있으면 이 단계는 지난 것이다. */}
              <GuideNum $done={missing.length < TOWS.length}>1</GuideNum>
              <div>
                <strong>③ 분석에서 SWOT 을 채웁니다.</strong> 지금 {' '}
                {['S', 'W', 'O', 'T'].map((k, i) => (
                  <React.Fragment key={k}>
                    {i > 0 && ' · '}
                    <GuideCount $zero={byKind(k).length === 0}>
                      {KIND[k].label} {byKind(k).length}
                    </GuideCount>
                  </React.Fragment>
                ))}
                {' '}건입니다.
                {canEdit && onGoAnalysis && (
                  <GuideLink onClick={onGoAnalysis}>③ 분석으로 가기</GuideLink>
                )}
              </div>
            </GuideStep>
            <GuideStep>
              <GuideNum>2</GuideNum>
              <div>
                <strong>아래 네 바구니에 솔루션을 적습니다.</strong> 적을 때 무엇과
                무엇을 엮은 것인지 고릅니다 — 그것이 그 솔루션의 근거입니다.
                <BasketNote>
                  네 칸을 다 채우는 표가 아닙니다. 한 갈래에 솔루션이 하나뿐이어도,
                  어떤 갈래가 통째로 비어도 됩니다.
                </BasketNote>
              </div>
            </GuideStep>
            <GuideStep>
              <GuideNum>3</GuideNum>
              <div>
                <strong>솔루션마다 다섯 질문에 답하고, 영향·실행가능성을 매깁니다.</strong>
                {' '}그러면 「무엇부터 하는가」 사분면이 아래에 생깁니다. 지표에 걸면
                실행과 이어집니다.
              </div>
            </GuideStep>
          </Guide>
        )}

        {missing.length > 0 && (
          <Notice>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <span>
              {missing.length === TOWS.length ? (
                <>
                  ③ 분석이 비어 있어 <strong>지금은 어느 갈래도 엮을 것이 없습니다.</strong>
                  {' '}솔루션은 그래도 적을 수 있지만, 근거 없이 적은 솔루션은 나중에 왜 그렇게
                  정했는지 아무도 설명하지 못합니다.
                </>
              ) : (
                <>
                  엮을 요소가 없는 갈래: <strong>{missing.map(t => t.key).join(', ')}</strong>.
                  ③ 분석에서 그 칸을 먼저 채우면 근거를 달 수 있습니다. 그 전에도 솔루션은
                  적을 수 있습니다.
                </>
              )}
            </span>
          </Notice>
        )}

        {/* ⚠️ 세어서 보여주기만 한다. 다 채우라고 막으면 아무 말이나 들어온다 —
            "그럴듯한 전략"과 "실행 가능한 전략"을 가르는 표시일 뿐이다. */}
        {incomplete > 0 && (
          <Notice style={{ borderColor: '#e2e8f0', background: '#f8fafc', color: '#64748b' }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <span>
              다섯 질문(<strong>{gates.map(g => g.label).join(' · ')}</strong>)에 다
              답하지 않은 솔루션이 <strong>{incomplete}건</strong> 있습니다. 답하지
              않아도 넘어갑니다 — 다만 실행 단계에서 막히는 자리가 대개 여기입니다.
            </span>
          </Notice>
        )}

        <Baskets>
          {TOWS.map(t => {
            const items = shown.filter(s => s.tows === t.key);
            return (
              <Basket key={t.key} id={`sec-tows-${t.key.toLowerCase()}`} $color={t.color}>
                <BasketHead>
                  <Tows $color={t.color}>{t.key}</Tows>
                  <BasketTitle>{t.title}</BasketTitle>
                  <Count>{items.length}건</Count>
                </BasketHead>
                <BasketNote>{t.note}</BasketNote>

                {/* ⚠️ 빈 상태에 "아직 없습니다"만 두면 백지와 같다. **엮을 짝
                    하나를 실제 요소로 보여준다** — 격자를 그리지 않으면서도
                    이 갈래가 무엇을 묻는 자리인지 한 줄로 전해진다. */}
                {items.length === 0 && composing !== t.key && (
                  <Empty>{invite(t)}</Empty>
                )}
                {items.map(card)}

                {!canEdit ? null : composing === t.key ? (
                  <Composer>
                    <Input
                      autoFocus
                      value={draft.title}
                      onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') save(t.key); }}
                      placeholder="무엇을 하겠다는 것인지 (예: 가상검증 범위를 신모델까지 넓힌다)"
                    />
                    <Input
                      value={draft.detail}
                      onChange={e => setDraft(d => ({ ...d, detail: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') save(t.key); }}
                      placeholder="왜 이 솔루션인지 (선택)"
                    />
                    {picker(t.kinds, draft.ids,
                      (id) => setDraft(d => ({ ...d, ids: toggle(d.ids, id) })))}
                    <ComposerFoot>
                      <SaveButton disabled={!draft.title.trim()} onClick={() => save(t.key)}>
                        <Check size={13} /> 저장
                      </SaveButton>
                      <AddButton onClick={() => setComposing(null)}>
                        <X size={13} /> 취소
                      </AddButton>
                    </ComposerFoot>
                  </Composer>
                ) : (
                  <AddButton onClick={() => openComposer(t.key)}>
                    <Plus size={13} /> 솔루션 추가
                  </AddButton>
                )}
              </Basket>
            );
          })}
        </Baskets>

        {/* 사분면 — 같은 솔루션들을 다른 눈으로 본다. 새로 적는 곳이 아니다. */}
        {shown.length > 0 && (
          <Section id="sec-portfolio">
            <BoxHead>
              <BoxTitle>무엇부터 하는가</BoxTitle>
              <Count>
                영향 × 실행가능성. <strong>4 이상</strong>을 「큼·할 만함」으로 봅니다.
              </Count>
            </BoxHead>

            {crowded && (
              <Notice>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
                <span>
                  「먼저 한다」에 <strong>{nowCount}건</strong>이 들어 있습니다
                  {division !== null && ` (${divisionName(division)} 기준)`}.
                  기준은 {nowMax}건입니다 — <strong>다 1순위면 순위를 정하지 않은
                  것과 같습니다.</strong> 영향이나 실행가능성을 다시 보거나,
                  올해 안 할 것을 덜어내야 합니다. (기준은 ⚙ 설정에서 바꿉니다)
                </span>
              </Notice>
            )}

            <Quad>
              {QUADRANTS.map(q => {
                const items = scored.filter(s => inQuadrant(s, q));
                return (
                  <QuadCell key={q.key} $strong={q.strong}>
                    <QuadHead>
                      <QuadName>{q.name}</QuadName>
                      <QuadAxis>{q.axis}</QuadAxis>
                      <Count>{items.length}건</Count>
                    </QuadHead>
                    {items.length === 0
                      ? <NoBasis>없습니다.</NoBasis>
                      : items.map(s => (
                        <QuadItem key={s.id}>
                          <Tows $color={TOWS.find(t => t.key === s.tows)?.color}
                                style={{ fontSize: '0.6875rem' }}>
                            {s.tows}
                          </Tows>
                          {s.title}
                          <QuadAxis>
                            {s.impact}×{s.feasibility}
                          </QuadAxis>
                        </QuadItem>
                      ))}
                  </QuadCell>
                );
              })}
            </Quad>

            {/* ⚠️ 안 매긴 것을 낮은 점수로 밀어 넣지 않는다. 그러면 아직 판단하지
                않은 솔루션이 '하지 않는다' 칸에서 조용히 사라진다. */}
            {wordsOnly.length > 0 && (
              <BasketNote style={{ marginTop: '0.5rem' }}>
                <strong>해낼 과제가 안 걸린 솔루션 {wordsOnly.length}건.</strong>{' '}
                지표는 겨냥이고 과제는 실행입니다 — 여기가 비어 있으면 그 솔루션은
                아직 말뿐입니다. 반대쪽(어느 솔루션에도 안 걸린 과제)은 ① 진단이
                발견 사항으로 짚습니다.
              </BasketNote>
            )}

            {unscored.length > 0 && (
              <BasketNote style={{ marginTop: '0.5rem' }}>
                아직 안 매긴 솔루션이 <strong>{unscored.length}건</strong> 있어 어느 칸에도
                올라가지 않았습니다: {unscored.map(s => s.title).join(' · ')}.
                근거가 없으면 비워 두는 것이 맞습니다 — 다만 <strong>안 매긴 것은 낮은
                점수가 아닙니다.</strong>
              </BasketNote>
            )}
          </Section>
        )}

        <Notice style={{ borderColor: '#e2e8f0', background: '#f8fafc', color: '#64748b' }}>
          <Info size={14} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
          <span>
            엮은 요소는 <strong>근거</strong>입니다. ③ 분석에서 그 요소를 지우면 여기서도
            사라지지만, <strong>솔루션 자체는 남습니다</strong> — 근거가 없어진 것이지 솔루션이
            틀린 것은 아니기 때문입니다.
          </span>
        </Notice>
      </Wrap>
    </Layout>
  );
};

export default SolutionsView;
