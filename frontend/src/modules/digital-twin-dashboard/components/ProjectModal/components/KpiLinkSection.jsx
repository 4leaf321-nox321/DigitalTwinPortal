/**
 * 과제 ↔ DX KPI 연결 편집
 *
 * 왜 이 화면이 있나
 *     DX KPI(가상 검증률·One Time Pass율 …)는 `dx_kpi_management` 모듈에 있고,
 *     거기엔 과제를 가리키는 값이 없었다. 그 연결을 사람이 선언하는 자리가 여기다.
 *
 * ★ 연결은 지표만이 아니라 **(지표 × 대상 사업부)** 다 (2026-08-01)
 *     KPI 는 사업부별로 따로 측정된다 — 'MX 의 가상검증률' 과 'VD 의 가상검증률' 은
 *     다른 숫자다(`kpi_records` 가 division 별로 쌓인다).
 *       · MX·VD·DA·NW·의료기기  지표를 직접 관리한다 → 대상은 **자기 사업부 고정**
 *       · GTR·SR·CS            기능조직이라 자기 지표가 없다 → **지원할 사업부를 고른다**
 *     기능조직의 기여를 소속으로 집계하면 GTR 칸에 찍히고 정작 MX 칸은 과소 계상된다.
 *
 * 경영성과(과제 성과 탭)와 다르다
 *     경영성과는 금액·시간이라 여러 과제가 물리면 쪼개야 한다 → 기여도(%)가 있다.
 *     DX KPI 는 비율·건수 지표라 쪼갤 게 없다 → 연관이 있는가 없는가뿐이다.
 *
 * 개수를 제한하지 않는다
 *     시뮬레이션 기술개발 같은 과제는 가상검증·OTP·리드타임에 비슷하게 영향을 준다.
 *     많이 걸린 과제는 노이즈가 아니라 **기반 과제**다.
 *
 * 저장 시점
 *     스스로 저장하지 않는다. 선택 상태를 부모에게 올려주고 부모의 '저장' 한 번에
 *     다른 변경과 같이 나간다.
 *
 * 두 가지 모드 (2026-08-24)
 *     `projectUuid` 있음   편집창. 연결된 목록까지 서버에서 받는다.
 *     `division` 만 있음   **신규 추가창.** 아직 uuid 가 없으므로 후보만 받고
 *                          연결 목록은 빈 배열에서 시작한다.
 *     ⚠️ 신규창은 사업부를 **폼에서** 읽어 넘긴다. 편집창은 저장된 값으로 서버가
 *        정하지만 추가창은 사용자가 고르는 중이라 서버가 알 방법이 없다.
 *     ⚠️ 사업부가 바뀌면 **고른 것을 버리는 것은 부모(AddProjectModal)의 일**이다.
 *        여기서 비우면 편집창에서도 발동해 **이미 저장된 연결이 날아간다.**
 *
 * 사업부 코드 매핑을 여기 두지 않는다
 *     서버가 `divisions[].code` 로 내려준다(`field_maps.DIVISION_KPI_CODE` 가 단일 출처).
 *     화면이 자기 표를 들면 반드시 갈리고, 그러면 "의료기기 과제가 medical 지표에
 *     해당 없음" 으로 보이는 조용한 어긋남이 난다.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Target, AlertCircle, Loader2, ChevronRight, ChevronDown, Building2, Sparkles } from 'lucide-react';

import AiKpiSuggestModal from './AiKpiSuggestModal';

import { fetchProjectKpiLinksV2, fetchKpiLinkOptions, saveSystemSettings }
  from '../../../services/settingsApi';

/* 분류 정렬 — 매트릭스(KpiMatrixView)와 **같은 순서**를 쓴다.
   두 화면에서 같은 것이 다른 자리에 있으면 같은 것으로 안 보인다.
   '플랫폼' 은 지표가 아니라 만드는 것이라 늘 맨 뒤. */
const CATEGORY_ORDER = ['개발', '제조', '품질', '플랫폼'];

/**
 * 기여 등급. 값·판정 기준은 **서버(routes_v2.KPI_RELATION_TYPES)와 같은 문구**를 쓴다.
 * 두 곳이 갈리면 사람마다 다르게 채우고, 그러면 필터도 그래프도 못 믿는다.
 *
 * ⚠️ 순서척도라 **더하지 않는다.** 세는 것은 등급별로 따로 센다.
 */
/**
 * 지표를 **새로 체크할 때** 붙는 기본 등급 (2026-08-07 요청).
 *
 * 대부분의 연결이 주기여라 매번 고르게 하면 그 클릭이 그냥 비용이다. 아니면 눌러서
 * 보조·간접으로 바꾸거나, 선택된 칩을 한 번 더 눌러 미지정으로 되돌리면 된다.
 *
 * ⚠️ **이미 있는 연결을 건드리는 게 아니다.** 서버 주석(`Dt2ProjectKpi.relation_type`)의
 *    "기존 행을 일괄로 채우지 않는다 — 아무도 판단하지 않은 값이 데이터가 된다" 는
 *    그대로 유효하다. 여기서 값이 붙는 건 사람이 방금 그 지표를 체크한 순간뿐이고,
 *    화면에 칩으로 보이므로 숨은 값이 아니다.
 *
 * ⚠️ 이미 체크된 지표에 **대상만 추가**하는 자리(`toggleKpiTarget`·대상 선택)는
 *    이 기본값을 쓰지 않는다. 거기서는 같은 지표의 기존 등급을 물려받아야 한다 —
 *    옛 데이터의 '미지정' 을 여기 기본값으로 조용히 덮으면 안 된다.
 */
const DEFAULT_RELATION = 'primary';

/**
 * 기여 방법은 **여러 개**다 (2026-08-07). `note` 한 칸에 줄바꿈으로 이어 담는다.
 *
 * 왜 컬럼을 안 바꾸나 — `note` 는 `String(300)` 이고 이 입력은 원래 한 줄짜리
 * `<input>` 이었다. 즉 **기존 값에 줄바꿈이 없다.** 줄바꿈을 구분자로 삼으면 옛 값이
 * 그대로 '방법 1개' 로 읽히고, 마이그레이션도 기존 화면 수정도 필요 없다.
 * (서버도 같은 규칙을 쓴다 — `routes_v2.NOTE_SEP`)
 */
const NOTE_SEP = '\n';
const parseMethods = (note) =>
  String(note || '').split(NOTE_SEP).map((x) => x.trim()).filter(Boolean);
const joinMethods = (list) => list.join(NOTE_SEP);

/** note 한 칸의 최대 길이 — 서버 컬럼이 `String(300)` 이다. 넘으면 저장이 잘린다. */
const NOTE_MAX = 300;

const RELATION_TYPES = [
  { value: 'primary', label: '주기여', hint: '이 과제가 없으면 그 KPI 목표 달성이 어렵다',
    bg: '#dbeafe', fg: '#1d4ed8', bd: '#2563eb' },
  { value: 'support', label: '보조기여', hint: '기여하지만 다른 과제로도 대체 가능하다',
    bg: '#e0e7ff', fg: '#4338ca', bd: '#6366f1' },
  { value: 'indirect', label: '간접기여', hint: '기반·환경을 만든다 (플랫폼·표준화 등)',
    bg: '#f3f4f6', fg: '#4b5563', bd: '#9ca3af' },
];

/* ── 기여 방법 고르기 (2026-08-07) ────────────────────────────────────────────
   자유 텍스트였던 것을 **사전에서 고르는 방식**으로 바꿨다. 같은 뜻을 사람마다 다른
   문장으로 쓰면 나중에 묶어 셀 수가 없다. 다만 사전에 없는 것도 적을 수 있어야 한다 —
   막아 두면 현장이 엉뚱한 항목을 고르거나 아예 안 쓴다. 새로 적은 문구는 사전에 넣는다. */
const MethodChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 0.3rem;
`;

const MethodChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.12rem 0.4rem;
  border-radius: 999px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  color: #3730a3;
  font-size: 0.74rem;
  button {
    border: 0;
    background: none;
    padding: 0;
    line-height: 1;
    color: #6366f1;
    cursor: pointer;
    font-size: 0.85rem;
    &:hover { color: #3730a3; }
    &:disabled { color: #c7d2fe; cursor: not-allowed; }
  }
`;

const MethodPickRow = styled.div`
  display: flex;
  gap: 0.3rem;
  align-items: center;
  flex-wrap: wrap;
`;

const MethodSelect = styled.select`
  flex: 1 1 12rem;
  min-width: 0;
  padding: 0.28rem 0.4rem;
  border: 1px solid #d1d5db;
  border-radius: 0.35rem;
  font-size: 0.76rem;
  color: #374151;
  background: #fff;
  &:disabled { background: #f3f4f6; }
`;

const MethodFree = styled.input`
  flex: 1 1 12rem;
  min-width: 0;
  padding: 0.28rem 0.4rem;
  border: 1px solid #d1d5db;
  border-radius: 0.35rem;
  font-size: 0.76rem;
  &:disabled { background: #f3f4f6; }
`;

const MethodMini = styled.button`
  flex-shrink: 0;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 0.35rem;
  padding: 0.24rem 0.5rem;
  font-size: 0.72rem;
  color: #4b5563;
  cursor: pointer;
  &:hover { border-color: #6366f1; color: #4338ca; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const MethodWarn = styled.div`
  font-size: 0.7rem;
  color: #b45309;
  margin-top: 0.2rem;
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  /* 위 여백 없음 — 기본정보 탭에서 앞 섹션과 띄우려고 margin-top: 1.5rem 을 두었는데,
     별도 탭으로 빠지면서(2026-08-06) 탭 상단에 빈 24px 로만 남았다. */
`;

const SectionTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: #374151;
  margin: 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #e5e7eb;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CountBadge = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  color: ${(p) => (p.$zero ? '#b45309' : '#1d4ed8')};
  background: ${(p) => (p.$zero ? '#fef3c7' : '#dbeafe')};
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
`;

/* AI 진입점은 청록으로 통일한다 (폼 채우기·액션아이템·참여인력과 같은 색) */
const AiSuggestBtn = styled.button`
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  border: 1px solid #0891b2;
  border-radius: 999px;
  background: #fff;
  color: #0891b2;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) { background: #ecfeff; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Hint = styled.p`
  margin: 0;
  font-size: 0.78rem;
  color: #6b7280;
  line-height: 1.5;
`;

/** 지원 대상 사업부 선택 — 기능조직 과제에만 나온다. */
const TargetBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.65rem 0.8rem;
  border: 1px solid ${(p) => (p.$warn ? '#fdba74' : '#e5e7eb')};
  background: ${(p) => (p.$warn ? '#fff7ed' : '#f9fafb')};
  border-radius: 0.5rem;
`;

const TargetLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: ${(p) => (p.$warn ? '#c2410c' : '#374151')};
`;

const TargetChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
`;

const Chip = styled.button`
  border: 1px solid ${(p) => (p.$on ? '#2563eb' : '#d1d5db')};
  background: ${(p) => (p.$on ? '#2563eb' : '#fff')};
  color: ${(p) => (p.$on ? '#fff' : '#4b5563')};
  border-radius: 999px;
  padding: 0.25rem 0.7rem;
  font-size: 0.8rem;
  font-weight: ${(p) => (p.$on ? 600 : 500)};
  cursor: ${(p) => (p.$disabled ? 'not-allowed' : 'pointer')};
  opacity: ${(p) => (p.$disabled ? 0.55 : 1)};
  &:hover { border-color: ${(p) => (p.$disabled ? '#d1d5db' : '#2563eb')}; }
`;

/* 지표 줄 안의 대상 토글. 상단 Chip 과 같은 뜻이지만 줄 안에 들어가서 더 작다. */
const RowChip = styled.button`
  border: 1px solid ${(p) => (p.$on ? '#2563eb' : '#d1d5db')};
  background: ${(p) => (p.$on ? '#eff6ff' : '#fff')};
  color: ${(p) => (p.$on ? '#1d4ed8' : '#9ca3af')};
  border-radius: 999px;
  padding: 0.08rem 0.45rem;
  font-size: 0.68rem;
  font-weight: ${(p) => (p.$on ? 700 : 500)};
  cursor: ${(p) => (p.$disabled ? 'not-allowed' : 'pointer')};
  opacity: ${(p) => (p.$disabled ? 0.55 : 1)};
  text-decoration: ${(p) => (p.$on ? 'none' : 'line-through')};
  &:hover { border-color: ${(p) => (p.$disabled ? '#d1d5db' : '#2563eb')}; }
`;

const RowChips = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
  font-size: 0.72rem;
  color: #6b7280;
`;

const OwnTargetNote = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: #4b5563;
`;

const DivPill = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  color: #1d4ed8;
  background: #dbeafe;
  border-radius: 0.3rem;
  padding: 0.1rem 0.4rem;
`;

const CategoryBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

/* PlatformBox 는 걷어냈다 (2026-08-06) — 플랫폼 구축이 '플랫폼' 분류의
   보통 카드가 되면서 따로 담을 상자가 없어졌다. */

const CategoryLabel = styled.div`
  font-size: 0.78rem;
  font-weight: 700;
  color: #6b7280;
  letter-spacing: 0.02em;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.4rem;
`;

const Item = styled.label`
  display: flex;
  /* 그리드 아이템은 기본이 min-width:auto 라 내용보다 작아지지 않는다.
     안쪽 입력칸 때문에 칸이 밀리는 것을 막으려면 여기서도 풀어야 한다. */
  min-width: 0;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid ${(p) => (p.$checked ? '#3b82f6' : '#e5e7eb')};
  background: ${(p) => (p.$checked ? '#eff6ff' : '#fff')};
  border-radius: 0.5rem;
  cursor: ${(p) => (p.$disabled ? 'not-allowed' : 'pointer')};
  opacity: ${(p) => (p.$disabled ? 0.55 : 1)};
  transition: border-color 0.15s ease, background 0.15s ease;
  &:hover { border-color: ${(p) => (p.$disabled ? '#e5e7eb' : '#93c5fd')}; }
  input { margin-top: 0.15rem; cursor: inherit; flex-shrink: 0; }
`;

const ItemBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  flex: 1;
`;

const ItemLabel = styled.span`
  font-size: 0.84rem;
  color: #1f2937;
  font-weight: ${(p) => (p.$checked ? 600 : 500)};
  word-break: keep-all;
`;

const Tag = styled.span`
  font-size: 0.68rem;
  color: #6b7280;
  background: #f3f4f6;
  border-radius: 0.25rem;
  padding: 0.05rem 0.3rem;
  margin-left: 0.35rem;
  white-space: nowrap;
`;

const ScopeTag = styled(Tag)`
  color: #047857;
  background: #d1fae5;
`;

const NoteInput = styled.input`
  border: 1px solid #e5e7eb;
  border-radius: 0.35rem;
  padding: 0.25rem 0.45rem;
  font-size: 0.75rem;
  color: #374151;
  width: 100%;
  /* ⚠️ input 은 기본 size=20 만큼의 **고유 최소 폭**을 갖는다.
     그게 그리드 칸(minmax(260px,1fr))보다 크면 카드 밖으로 삐져나온다.
     width:100% 만으로는 안 잡힌다 — 최소 폭을 직접 0 으로 내려야 한다.
     (주석에 백틱을 쓰지 말 것 — 템플릿 리터럴이 거기서 끊긴다) */
  min-width: 0;
  max-width: 100%;
  flex: 1;
  &::placeholder { color: #b0b7c3; }
  &:focus { outline: none; border-color: #93c5fd; }
`;

/* 대상별 메모 한 줄 — 라벨(사업부) + 입력칸 */
const NoteRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
`;

const NoteRowLabel = styled.span`
  font-size: 0.68rem;
  font-weight: 700;
  color: #1d4ed8;
  background: #dbeafe;
  border-radius: 0.25rem;
  padding: 0.1rem 0.35rem;
  flex-shrink: 0;
  min-width: 2.6rem;
  text-align: center;
`;

/* 기여 등급 선택 — 지표 줄 안의 3단 토글 */
const RelRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-wrap: wrap;
  font-size: 0.72rem;
  color: #6b7280;
`;

const RelChip = styled.button`
  border: 1px solid ${(p) => (p.$on ? p.$bd : '#e5e7eb')};
  background: ${(p) => (p.$on ? p.$bg : '#fff')};
  color: ${(p) => (p.$on ? p.$fg : '#9ca3af')};
  border-radius: 999px;
  padding: 0.08rem 0.5rem;
  font-size: 0.68rem;
  font-weight: ${(p) => (p.$on ? 700 : 500)};
  cursor: ${(p) => (p.$disabled ? 'not-allowed' : 'pointer')};
  opacity: ${(p) => (p.$disabled ? 0.55 : 1)};
  &:hover { border-color: ${(p) => (p.$disabled ? '#e5e7eb' : p.$bd)}; }
`;

const SplitToggle = styled.button`
  align-self: flex-start;
  border: none;
  background: none;
  padding: 0;
  font-size: 0.68rem;
  color: #6b7280;
  text-decoration: underline;
  cursor: pointer;
  &:hover { color: #2563eb; }
`;

const OtherToggle = styled.button`
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: 1px dashed #d1d5db;
  border-radius: 0.4rem;
  background: transparent;
  color: #6b7280;
  font-size: 0.78rem;
  cursor: pointer;
  &:hover { border-color: #9ca3af; color: #374151; }
`;

const StateRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: ${(p) => (p.$error ? '#b91c1c' : '#6b7280')};
`;

const Spin = styled(Loader2)`
  animation: kpiSpin 1s linear infinite;
  @keyframes kpiSpin { to { transform: rotate(360deg); } }
`;


/**
 * 기여 방법 고르기 — **여러 개**를 칩으로 쌓는다. (2026-08-07)
 *
 * @param value      note 문자열 (줄바꿈으로 이어진 방법들)
 * @param options    이 지표에 정의된 방법 목록 (설정 ▸ KPI 기여방법)
 * @param onChange   새 note 문자열
 * @param onDefine   사전에 없던 문구를 새로 적었을 때 — 사전에 넣어 달라는 요청
 *
 * ⚠️ 300자(서버 컬럼)를 넘기지 않게 여기서 막는다. 넘겨서 저장하면 조용히 잘린다.
 */
const MethodPicker = ({ value, options, onChange, onDefine, disabled, placeholder }) => {
  const picked = parseMethods(value);
  const [free, setFree] = useState('');
  const [typing, setTyping] = useState(false);

  const rest = (options || []).filter((o) => !picked.includes(o));
  const used = joinMethods(picked).length;

  const add = (v) => {
    const t = String(v || '').trim();
    if (!t || picked.includes(t)) return;
    const next = joinMethods([...picked, t]);
    if (next.length > NOTE_MAX) return;      // 위 경고가 이미 떠 있다
    onChange(next);
    if (!(options || []).includes(t) && onDefine) onDefine(t);
    setFree('');
    setTyping(false);
  };

  const remove = (t) => onChange(joinMethods(picked.filter((x) => x !== t)));

  const wouldOverflow = (t) =>
    joinMethods([...picked, String(t || '').trim()]).length > NOTE_MAX;

  return (
    <div>
      {picked.length > 0 && (
        <MethodChips>
          {picked.map((m) => (
            <MethodChip key={m} title={m}>
              {m}
              <button type="button" disabled={disabled}
                      title="빼기" onClick={() => remove(m)}>×</button>
            </MethodChip>
          ))}
        </MethodChips>
      )}

      <MethodPickRow>
        {!typing ? (
          <>
            <MethodSelect
              value=""
              disabled={disabled || rest.length === 0}
              onChange={(e) => add(e.target.value)}
            >
              <option value="">
                {rest.length ? (placeholder || '기여 방법 고르기…')
                             : (options || []).length ? '고를 수 있는 방법을 다 넣었습니다'
                                                      : '정의된 기여 방법이 없습니다'}
              </option>
              {rest.map((o) => (
                <option key={o} value={o} disabled={wouldOverflow(o)}>
                  {wouldOverflow(o) ? `${o} (길이 초과)` : o}
                </option>
              ))}
            </MethodSelect>
            <MethodMini type="button" disabled={disabled} onClick={() => setTyping(true)}>
              직접 입력
            </MethodMini>
          </>
        ) : (
          <>
            <MethodFree
              autoFocus
              value={free}
              maxLength={140}
              placeholder="새 기여 방법 (Enter 로 추가 · 목록에도 들어갑니다)"
              disabled={disabled}
              onChange={(e) => setFree(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); add(free); }
                if (e.key === 'Escape') { setFree(''); setTyping(false); }
              }}
            />
            <MethodMini type="button" disabled={disabled || !free.trim() || wouldOverflow(free)}
                        onClick={() => add(free)}>추가</MethodMini>
            <MethodMini type="button" onClick={() => { setFree(''); setTyping(false); }}>
              취소
            </MethodMini>
          </>
        )}
      </MethodPickRow>

      {used > NOTE_MAX - 40 && (
        <MethodWarn>
          {`기여 방법 길이 ${used}/${NOTE_MAX}자 — 더 넣으려면 기존 것을 빼거나 문구를 줄이세요.`}
        </MethodWarn>
      )}
    </div>
  );
};

const KpiLinkSection = ({ projectUuid, division = null, value, onLoaded, onChange,
                         readOnly = false, settingsData = {} }) => {
  const [available, setAvailable] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [projectDivision, setProjectDivision] = useState(null);
  const [isFunctional, setIsFunctional] = useState(false);
  // ★ 선택된 대상 사업부는 **독립 상태**다. 연결 목록에서 역산하면 안 된다.
  //   지표를 하나도 안 고른 상태에서는 대상을 담을 연결 자체가 없어서,
  //   칩을 눌러도 아무 일이 안 일어나고 **대상 없이는 지표를 못 고르는 교착**이 된다.
  //   (2026-08-01 화면 확인에서 실제로 걸렸다)
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showOthers, setShowOthers] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  // 메모를 대상별로 갈라 쓰는 지표들. 기본은 비어 있다 —
  // 대부분 대상이 달라도 기여 방식이 같아서, 하나로 쓰는 게 기본이다.
  const [splitNoteIds, setSplitNoteIds] = useState(new Set());

  /**
   * 기여 방법 사전 — 설정(`kpiContributionMethods`)이 정본이고, 여기서 새로 적은 문구는
   * **바로 목록에 보이게** 지역 겹침(`localMethods`)으로 얹는다. 서버 저장은 따로 나간다.
   *
   * 저장은 admin·dt_office 만 된다(서버 규칙). 권한이 없으면 조용히 실패하고, 그래도
   * **이번 세션에서는 목록에 보이며 연결에는 정상 저장된다** — 사전에만 안 남는다.
   * 막아서 못 쓰게 하는 것보다 낫다.
   */
  const [localMethods, setLocalMethods] = useState({});

  const methodDict = useMemo(() => {
    const base = settingsData?.kpiContributionMethods || {};
    const out = { ...base };
    Object.entries(localMethods).forEach(([k, list]) => {
      out[k] = [...new Set([...(base[k] || []), ...list])];
    });
    return out;
  }, [settingsData, localMethods]);

  const methodsFor = (kid) => methodDict[String(kid)] || [];

  const defineMethod = (kid, text) => {
    const key = String(kid);
    setLocalMethods((prev) => {
      const cur = prev[key] || [];
      if (cur.includes(text)) return prev;
      return { ...prev, [key]: [...cur, text] };
    });
    const merged = { ...methodDict };
    merged[key] = [...new Set([...(merged[key] || []), text])];
    saveSystemSettings({ kpiContributionMethods: merged })
      .catch((e) => console.warn('[DT] 기여방법 사전 저장 실패(연결에는 정상 저장됩니다):', e.message));
  };

  const loadedRef = useRef(null);
  const loadedTargetsRef = useRef(null);
  const hasProject = Boolean(projectUuid);

  useEffect(() => {
    // 편집창은 uuid 로, 신규창은 사업부로 불러온다. 신규창은 사업부를 아직 안 골랐어도
    // 후보 지표는 보여 준다 — 탭이 빈 화면이면 무엇을 하는 자리인지 알 수 없다.
    let alive = true;
    setLoading(true);
    setError(null);
    setShowOthers(false);
    loadedRef.current = null;

    const req = hasProject
      ? fetchProjectKpiLinksV2(projectUuid)
      : fetchKpiLinkOptions(division);

    req
      .then((data) => {
        if (!alive) return;
        setAvailable(data.available || []);
        setDivisions(data.divisions || []);
        setProjectDivision(data.projectDivision || null);
        setIsFunctional(Boolean(data.isFunctionalOrg));
        // 신규창에는 `items` 가 없다(걸 과제가 아직 없다) — 빈 배열에서 시작한다.
        const items = (data.items || []).map((it) => ({
          kpiDefinitionId: it.kpiDefinitionId,
          targetDivision: it.targetDivision || '',
          note: it.note || '',
          // 미지정은 null 로 들고 있는다. '' 로 바꾸면 '안 고름' 과 '고르고 비움' 이 섞인다.
          relationType: it.relationType || null,
        }));

        // 대상 초기값 — 기능조직은 저장된 연결에서 읽고(없으면 빈 상태로 고르게 한다),
        // 사업부 과제는 서버가 준 자기 사업부로 고정한다.
        const order = (data.divisions || []).filter((d) => d.isKpiOwner).map((d) => d.name);
        const saved = new Set(items.map((i) => i.targetDivision).filter(Boolean));
        const initialTargets = data.isFunctionalOrg
          ? order.filter((n) => saved.has(n))
          : (data.defaultTargets || []);
        setTargets(initialTargets);

        loadedRef.current = items;
        loadedTargetsRef.current = initialTargets;
        // ★ 기준선을 정하는 유일한 경로. 사용자의 클릭은 기준선이 되지 않는다.
        onLoaded(items);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message || 'KPI 목록을 불러오지 못했습니다.');
      })
      .finally(() => { if (alive) setLoading(false); });

    return () => { alive = false; };
    // ⚠️ `division` 이 의존성에 있어야 신규창에서 사업부를 바꿀 때 다시 부른다.
    //    편집창은 이 prop 을 안 넘기므로(null 고정) 동작이 그대로다.
  }, [projectUuid, hasProject, division]); // eslint-disable-line react-hooks/exhaustive-deps

  // 부모가 값을 비웠는데 uuid 는 그대로면 위 이펙트는 다시 돌지 않는다.
  // 그대로 두면 체크가 사라진 채 **빈 목록으로 저장**된다.
  // 대상도 같이 되돌린다 — 연결만 서버 값이고 대상은 편집 중이면 둘이 어긋난다.
  useEffect(() => {
    if (value == null && loadedRef.current != null) {
      if (loadedTargetsRef.current) setTargets(loadedTargetsRef.current);
      onLoaded(loadedRef.current);
    }
  });

  const links = value || [];

  const ownerDivisions = useMemo(
    () => divisions.filter((d) => d.isKpiOwner), [divisions]);
  const codeOf = useMemo(() => {
    const m = new Map(divisions.map((d) => [d.name, d.code]));
    return (name) => m.get(name) || '';
  }, [divisions]);

  const checkedIds = useMemo(
    () => new Set(links.map((l) => l.kpiDefinitionId)), [links]);

  /** 이 지표를 지금 대상들 중 어디에 걸 수 있는가. 전사 공통(divisions 빈 배열)은 전부. */
  const applicableTargets = (k) => {
    const scope = k.divisions || [];
    if (scope.length === 0) return targets;
    return targets.filter((t) => scope.includes(codeOf(t)));
  };

  const locked = readOnly || loading || Boolean(error);
  const needTarget = isFunctional && targets.length === 0;

  const toggleTarget = (name) => {
    if (locked || !isFunctional) return;

    if (targets.includes(name)) {
      // 대상을 빼면 그 대상의 연결만 사라진다.
      setTargets(targets.filter((t) => t !== name));
      onChange(links.filter((l) => l.targetDivision !== name));
      return;
    }

    // ★ 대상 선택은 **연결과 별개로 먼저 기록된다.**
    //    지표를 아직 안 골랐으면 만들 연결이 없는데, 그때 상태를 안 바꾸면
    //    칩이 안 켜지고 지표도 영영 잠긴다.
    setTargets(ownerDivisions.map((d) => d.name)
      .filter((n) => n === name || targets.includes(n)));   // 표시 순서 유지

    // 이미 체크된 지표가 있으면 그 대상 줄을 만들어 준다.
    //   — 단, 그 사업부가 관리하지 않는 지표는 만들지 않는다.
    const add = [];
    checkedIds.forEach((kid) => {
      const k = available.find((x) => x.kpiDefinitionId === kid);
      const scope = k?.divisions || [];
      if (scope.length && !scope.includes(codeOf(name))) return;
      const note = links.find((l) => l.kpiDefinitionId === kid)?.note || '';
      const rel = links.find((l) => l.kpiDefinitionId === kid)?.relationType ?? null;
      add.push({ kpiDefinitionId: kid, targetDivision: name, note, relationType: rel });
    });
    if (add.length) onChange([...links, ...add]);
  };

  const toggleKpi = (k) => {
    if (locked) return;
    if (checkedIds.has(k.kpiDefinitionId)) {
      onChange(links.filter((l) => l.kpiDefinitionId !== k.kpiDefinitionId));
      return;
    }
    const ts = applicableTargets(k);
    if (ts.length === 0) return;
    onChange([...links, ...ts.map((t) => ({
      kpiDefinitionId: k.kpiDefinitionId, targetDivision: t, note: '',
      relationType: DEFAULT_RELATION,
    }))]);
  };

  /**
   * AI 가 추천하고 **사람이 고른** 지표를 건다 (AiKpiSuggestModal).
   *
   * 지표 id 만 받아서 **`toggleKpi` 와 같은 길로** 만든다 — 대상 사업부·기여 등급
   * 규칙(자기 사업부만 / 기능조직은 골라야 함 / 사업부 전용 지표)을 여기서 다시 쓰면
   * 손으로 체크한 것과 AI 로 넣은 것이 **다른 모양**이 된다.
   *
   * 걸 수 없는 지표(그 대상이 관리하지 않는 지표)는 조용히 건너뛴다 — 목록에서
   * 애초에 체크가 막혀 있는 것들과 같은 이유다.
   */
  const applyAiSuggestions = (ids) => {
    if (locked) return;
    const add = [];
    (ids || []).forEach((kid) => {
      if (checkedIds.has(kid)) return;                 // 이미 걸려 있다
      const k = available.find((x) => x.kpiDefinitionId === kid);
      if (!k) return;
      const ts = applicableTargets(k);
      if (ts.length === 0) return;
      ts.forEach((t) => add.push({
        kpiDefinitionId: kid, targetDivision: t, note: '',
        relationType: DEFAULT_RELATION,
      }));
    });
    if (add.length) onChange([...links, ...add]);
  };

  /** 이 지표가 지금 걸려 있는 대상들 */
  const targetsOfKpi = (kid) => links
    .filter((l) => l.kpiDefinitionId === kid)
    .map((l) => l.targetDivision);

  /**
   * **지표 하나의 대상만** 켜고 끈다 (2026-08-06).
   *
   * 왜 필요한가
   *   대상은 과제 단위로 고르고 체크한 지표를 거기에 **곱해서** 걸어 왔다.
   *   그런데 "이 지표는 MX 만, 저 지표는 VD 만" 인 경우가 실제로 있다
   *   (기능조직 과제 — GTR·SR·CS). 곱셈만 되면 그걸 표현할 방법이 없었다.
   *   스키마는 원래 (과제, 지표, 대상) 단위라 담을 수 있었는데 화면이 막고 있었다.
   *
   * 흔한 경우는 그대로 둔다 — 지표를 체크하면 **고른 대상 전부**에 걸린다.
   * 여기는 그 기본값에서 빼는 '예외' 만 만든다.
   * 마지막 하나까지 끄면 지표 자체를 뗀 것으로 본다(빈 연결을 남기지 않는다).
   */
  const toggleKpiTarget = (k, t) => {
    if (locked) return;
    const kid = k.kpiDefinitionId;
    const on = targetsOfKpi(kid);
    if (on.includes(t)) {
      onChange(links.filter((l) => !(l.kpiDefinitionId === kid && l.targetDivision === t)));
      return;
    }
    const note = links.find((l) => l.kpiDefinitionId === kid)?.note || '';
    const rel = links.find((l) => l.kpiDefinitionId === kid)?.relationType ?? null;
    onChange([...links, { kpiDefinitionId: kid, targetDivision: t, note, relationType: rel }]);
  };

  /**
   * 기여 내용 메모.
   *
   * `target` 을 주면 **그 대상 줄만**, 안 주면 그 지표의 모든 줄에 같은 값을 넣는다.
   * 기본이 후자인 이유 — 대부분은 대상이 달라도 기여 방식이 같아서, 매번 대상 수만큼
   * 쓰게 하면 같은 문장을 복사하는 일이 된다.
   *
   * 대상별로 갈라 쓰는 건 사용자가 '대상별로 다르게' 를 켰을 때만이다(2026-08-06).
   * 스키마는 원래 (과제, 지표, 대상) 줄마다 note 를 갖는다.
   */
  const setNote = (kid, note, target = null) => {
    if (locked) return;
    onChange(links.map((l) => {
      if (l.kpiDefinitionId !== kid) return l;
      if (target !== null && l.targetDivision !== target) return l;
      return { ...l, note };
    }));
  };

  /**
   * 기여 등급 설정. 같은 값을 다시 누르면 **미지정으로 되돌린다** —
   * 잘못 골랐을 때 빠져나갈 길이 없으면 아무거나 눌러두게 된다.
   * `target` 을 주면 그 대상 줄만, 안 주면 그 지표의 모든 줄에.
   */
  const setRelation = (kid, value, target = null) => {
    if (locked) return;
    onChange(links.map((l) => {
      if (l.kpiDefinitionId !== kid) return l;
      if (target !== null && l.targetDivision !== target) return l;
      return { ...l, relationType: l.relationType === value ? null : value };
    }));
  };

  /** 이 지표에 붙은 등급 (대상별로 갈렸으면 여러 개) */
  const relationsOf = (kid) => [...new Set(
    links.filter((l) => l.kpiDefinitionId === kid).map((l) => l.relationType || null))];

  /** 등급 미지정 줄 수 — 필수로 안 하는 대신 이 숫자로 빈 곳을 드러낸다 */
  const unsetRelationCount = useMemo(
    () => links.filter((l) => !l.relationType).length, [links]);

  /** 이 지표의 메모가 대상별로 갈려 있는가 (서버에서 그렇게 온 경우 포함) */
  const noteSplit = (kid) => {
    const notes = links.filter((l) => l.kpiDefinitionId === kid).map((l) => l.note || '');
    return notes.length > 1 && new Set(notes).size > 1;
  };

  const { grouped, otherList } = useMemo(() => {
    const usable = [];
    const others = [];
    (available || []).forEach((k) => {
      /*
        플랫폼 구축도 **다른 분류와 똑같이** 다룬다 (2026-08-06).

        한때 따로 상자(PlatformBox)에 담았다. 항목이 '개발/제조/품질 플랫폼 구축'
        셋이라 분류 그룹에 넣으면 분류와 이름이 겹쳤기 때문이다. 셋을 하나로
        합치면서(b83c0e5a4f12) 분류가 '플랫폼', 이름이 '플랫폼 구축' 으로 갈려
        겹칠 일이 없어졌다.

        성격이 다르다는 건 **자리**가 아니라 카드가 말한다 — 목표·실적이 없고
        아래 안내 문구가 무엇인지 설명한다. 자리까지 갈라 두면 "여기는 딴 세상"
        으로 보여, 정작 고를 과제가 위만 훑다가 '기여 KPI 없음' 으로 남았다.
      */
      const scope = k.divisions || [];
      const fits = scope.length === 0
        || targets.some((t) => scope.includes(codeOf(t)))
        || checkedIds.has(k.kpiDefinitionId);   // 이미 걸린 건 항상 보인다
      (fits ? usable : others).push(k);
    });

    const byCat = new Map();
    usable.forEach((k) => {
      const c = k.category || '기타';
      if (!byCat.has(c)) byCat.set(c, []);
      byCat.get(c).push(k);
    });
    const rank = (k) => ((k.divisions || []).length === 0 ? 0 : 1);
    for (const list of byCat.values()) list.sort((a, b) => rank(a) - rank(b));

    return {
      grouped: [...byCat.entries()].sort((a, b) => {
        const ia = CATEGORY_ORDER.indexOf(a[0]);
        const ib = CATEGORY_ORDER.indexOf(b[0]);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      }),
      otherList: others,
    };
  }, [available, targets, checkedIds, codeOf]);

  const renderItem = (k) => {
    const checked = checkedIds.has(k.kpiDefinitionId);
    const scope = k.divisions || [];
    const ts = applicableTargets(k);
    const disabled = locked || needTarget || (!checked && ts.length === 0);
    const note = links.find((l) => l.kpiDefinitionId === k.kpiDefinitionId)?.note || '';
    const scopeNames = scope.length
      ? ownerDivisions.filter((d) => scope.includes(d.code)).map((d) => d.name)
      : [];
    return (
      <Item key={k.kpiDefinitionId} $checked={checked} $disabled={disabled}>
        <input type="checkbox" checked={checked} disabled={disabled}
               onChange={() => toggleKpi(k)} />
        <ItemBody>
          <ItemLabel $checked={checked}>
            {k.label}
            {k.unit ? <Tag>{k.unit}</Tag> : null}
            {/* 플랫폼 구축엔 '전 사업부' 를 붙이지 않는다 — 측정 범위를 말하는
                꼬리표라, 측정하지 않는 항목에 붙으면 뜻이 없다. */}
            {(k.kind || 'metric') !== 'metric'
              ? null
              : (scope.length === 0
                  ? <Tag>전 사업부</Tag>
                  : <ScopeTag>{scopeNames.join(', ') || scope.join(', ').toUpperCase()}</ScopeTag>)}
          </ItemLabel>
          {checked && ts.length === 1 && (
            <Hint style={{ fontSize: '0.72rem' }}>대상: {ts[0]}</Hint>
          )}
          {/* 대상이 둘 이상일 때만 고를 거리가 생긴다. 하나뿐이면 위처럼 글로만 알린다. */}
          {checked && ts.length > 1 && (
            <RowChips>
              <span>대상:</span>
              {ts.map((t) => (
                <RowChip
                  key={t}
                  type="button"
                  $on={targetsOfKpi(k.kpiDefinitionId).includes(t)}
                  $disabled={locked}
                  disabled={locked}
                  title={targetsOfKpi(k.kpiDefinitionId).includes(t)
                    ? `${t} 에서 이 지표를 뺀다`
                    : `${t} 에도 이 지표를 건다`}
                  onClick={() => toggleKpiTarget(k, t)}
                >
                  {t}
                </RowChip>
              ))}
            </RowChips>
          )}

          {/*
            기여 등급 — 대상 아래, 메모 위. "어느 지표에 · 얼마나 · 어떻게" 순서다.
            같은 값을 다시 누르면 미지정으로 돌아간다(빠져나갈 길이 없으면 아무거나 눌러둔다).
            대상별로 갈려 있으면 칩을 켜지 않고 그 사실만 알린다 — 여기서 누르면
            갈린 값이 한꺼번에 덮이기 때문이다.
          */}
          {checked && (() => {
            const kid = k.kpiDefinitionId;
            const rels = relationsOf(kid);
            const mixed = rels.length > 1;
            const cur = mixed ? null : rels[0];
            return (
              <RelRow>
                <span>등급:</span>
                {RELATION_TYPES.map((r) => (
                  <RelChip
                    key={r.value}
                    type="button"
                    $on={cur === r.value}
                    $bg={r.bg} $fg={r.fg} $bd={r.bd}
                    $disabled={locked}
                    disabled={locked}
                    title={`${r.label} — ${r.hint}`}
                    onClick={() => setRelation(kid, r.value)}
                  >
                    {r.label}
                  </RelChip>
                ))}
                {mixed && <span style={{ color: '#b45309' }}>대상별로 다름</span>}
                {!mixed && !cur && <span style={{ color: '#b45309' }}>미지정</span>}
              </RelRow>
            );
          })()}

          {checked && (() => {
            const kid = k.kpiDefinitionId;
            const on = targetsOfKpi(kid);
            // 서버에서 이미 갈려 온 경우도 갈린 모드로 연다 —
            // 하나로 보여주면 어느 한쪽 값이 조용히 다른 쪽을 덮는다.
            const split = splitNoteIds.has(kid) || noteSplit(kid);
            if (!split) {
              return (
                <>
                  <MethodPicker
                    value={note}
                    options={methodsFor(kid)}
                    disabled={locked}
                    placeholder="어떻게 기여하는지 고르기 (선택)"
                    onChange={(v) => setNote(kid, v)}
                    onDefine={(t) => defineMethod(kid, t)}
                  />
                  {/* 대상이 둘 이상일 때만 갈라 쓸 일이 생긴다 */}
                  {on.length > 1 && !locked && (
                    <SplitToggle
                      type="button"
                      onClick={() => setSplitNoteIds((prev) => new Set(prev).add(kid))}
                    >
                      대상별로 다르게 쓰기
                    </SplitToggle>
                  )}
                </>
              );
            }
            return (
              <>
                {on.map((t) => (
                  <NoteRow key={t}>
                    <NoteRowLabel>{t}</NoteRowLabel>
                    <MethodPicker
                      value={links.find((l) => l.kpiDefinitionId === kid && l.targetDivision === t)?.note || ''}
                      options={methodsFor(kid)}
                      disabled={locked}
                      placeholder={`${t} 에 어떻게 기여하는지 고르기`}
                      onChange={(v) => setNote(kid, v, t)}
                      onDefine={(x) => defineMethod(kid, x)}
                    />
                  </NoteRow>
                ))}
                {!locked && (
                  <SplitToggle
                    type="button"
                    title="첫 대상의 내용을 나머지에도 넣는다"
                    onClick={() => {
                      const first = links.find((l) => l.kpiDefinitionId === kid)?.note || '';
                      setSplitNoteIds((prev) => {
                        const n = new Set(prev); n.delete(kid); return n;
                      });
                      setNote(kid, first);
                    }}
                  >
                    하나로 합치기
                  </SplitToggle>
                )}
              </>
            );
          })()}
        </ItemBody>
      </Item>
    );
  };

  if (!hasProject) {
    return (
      <Container>
        <SectionTitle><Target size={16} /> DX KPI 연결</SectionTitle>
        <Hint>
          과제를 먼저 저장하면 이 과제가 어떤 DX KPI(가상 검증률·One Time Pass율 등)에
          기여하는지 연결할 수 있습니다.
        </Hint>
      </Container>
    );
  }

  return (
    <Container>
      <SectionTitle>
        <Target size={16} /> DX KPI 연결
        <CountBadge $zero={checkedIds.size === 0}>{checkedIds.size}개 지표</CountBadge>
        {isFunctional && targets.length > 1 && (
          <CountBadge>{links.length}건 연결</CountBadge>
        )}
        {/* 등급은 **필수로 하지 않는다** — 강제하면 아무거나 찍고, 그러면 필터가
            더 못 믿을 값이 된다. 대신 빈 곳을 이 숫자로 드러낸다. */}
        {unsetRelationCount > 0 && (
          <CountBadge $zero title="기여 등급을 아직 안 고른 연결입니다">
            등급 미지정 {unsetRelationCount}건
          </CountBadge>
        )}
        {/*
          AI 추천 — **연결을 만들지 않는다.** 후보와 근거를 보여주고 사람이 고른 것만
          `toggleKpi` 로 건다. 그래서 대상 사업부·기여 등급 규칙이 이 파일 한 곳에만 남는다.
          (서버는 AI 의 KPI 쓰기를 여전히 403 으로 막고 있다 — AiKpiSuggestModal 머리말)
        */}
        {projectUuid && !readOnly && (
          <AiSuggestBtn type="button" disabled={locked}
                        onClick={() => setIsAiOpen(true)}
                        title="과제 내용을 읽고 기여할 만한 지표를 근거와 함께 추천합니다">
            <Sparkles size={13} /> AI 추천
          </AiSuggestBtn>
        )}
      </SectionTitle>

      <AiKpiSuggestModal
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
        projectUuid={projectUuid}
        canApply={!needTarget}
        onApply={applyAiSuggestions}
      />

      {loading && <StateRow><Spin size={14} /> 불러오는 중…</StateRow>}
      {error && <StateRow $error><AlertCircle size={14} /> {error}</StateRow>}

      {!loading && !error && (
        <>
          {/* 대상 사업부 — DX KPI 는 사업부별로 따로 측정되므로 '누구의 지표' 인지가 필요하다 */}
          {isFunctional ? (
            <TargetBox $warn={needTarget}>
              <TargetLabel $warn={needTarget}>
                <Building2 size={14} />
                지원 대상 사업부
                {needTarget && ' — 먼저 골라야 지표를 선택할 수 있습니다'}
              </TargetLabel>
              <Hint>
                <b>{projectDivision}</b>는 기능조직이라 자체 KPI 가 없습니다.
                이 과제가 <b>어느 사업부의 지표</b>에 기여하는지 고르세요. 여러 곳도 됩니다.
              </Hint>
              <TargetChips>
                {ownerDivisions.map((d) => (
                  <Chip
                    key={d.name}
                    type="button"
                    $on={targets.includes(d.name)}
                    $disabled={locked}
                    disabled={locked}
                    onClick={() => toggleTarget(d.name)}
                  >
                    {d.name}
                  </Chip>
                ))}
              </TargetChips>
              {/*
                대상만 고르면 저장할 것이 없다 — 연결은 (지표 × 대상) 이라
                지표를 하나도 안 고르면 남길 행이 없다. 저장 후 다시 열었을 때
                칩이 꺼져 있는 걸 보고 "저장이 안 됐다" 고 오해하기 쉬워 미리 알린다.
              */}
              {targets.length > 0 && checkedIds.size === 0 && (
                <StateRow>
                  <AlertCircle size={13} />
                  대상만 골라서는 저장되지 않습니다. 기여하는 지표를 하나 이상 선택하세요.
                </StateRow>
              )}
            </TargetBox>
          ) : (
            <OwnTargetNote>
              <Building2 size={14} />
              대상: <DivPill>{projectDivision || '사업부 미지정'}</DivPill> 의 지표
              <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                (사업부 과제는 자기 사업부 지표에 연결됩니다)
              </span>
            </OwnTargetNote>
          )}

          {/* 등급을 넣으면서(2026-08-06) 안내가 필요해졌다. 예전 문구는
              "기여도(%)를 나누지 않습니다" 였는데, 등급이 생기면서 반쯤 틀린 말이 됐다.
              여전히 %는 안 나눈다 — 다만 얼마나 기여하는지는 등급으로 고른다. */}
          <Hint>
            관련 있는 지표를 <b>모두</b> 고르고, 얼마나 기여하는지 <b>등급</b>을 정하세요.
            기여도(%)는 나누지 않습니다.
          </Hint>

          {grouped.length === 0 && (
            <StateRow><AlertCircle size={14} /> 선택할 수 있는 DX KPI 지표가 없습니다.</StateRow>
          )}

          {grouped.map(([category, list]) => (
            <CategoryBlock key={category}>
              <CategoryLabel>{category}</CategoryLabel>
              <Grid>{list.map(renderItem)}</Grid>
            </CategoryBlock>
          ))}


          {/*
            지금 대상에서 관리하지 않는 지표. 기본으로 접어 둔다 —
            보이지 않으면 오클릭이 없고, 펼치는 행동 자체가 확인이 된다.
            (체크된 것은 위 목록에 남으므로 여기 없어도 해제할 수 있다)
          */}
          {otherList.length > 0 && (
            <>
              <OtherToggle type="button" onClick={() => setShowOthers((v) => !v)}>
                {showOthers ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                선택한 대상이 관리하지 않는 지표 {otherList.length}개
                {showOthers ? '' : ' 보기'}
              </OtherToggle>
              {showOthers && (
                <>
                  <Hint>
                    아래 지표는 <b>{targets.join(' · ') || '선택한 대상'}</b>에서 측정하지
                    않습니다. 연결하려면 그 지표를 관리하는 사업부를 대상에 먼저 추가하세요.
                  </Hint>
                  <Grid>{otherList.map(renderItem)}</Grid>
                </>
              )}
            </>
          )}
        </>
      )}
    </Container>
  );
};

export default KpiLinkSection;
