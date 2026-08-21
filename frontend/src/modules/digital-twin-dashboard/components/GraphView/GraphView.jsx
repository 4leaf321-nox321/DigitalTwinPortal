/**
 * 관계도 탭 — 과제·성과·KPI·사람·조직을 한 장에서 본다.
 *
 * 예전 「지식 그래프 저장」과 무엇이 다른가
 *     그것은 브라우저에서 만든 노드·엣지를 **다른 모듈의 표에 찍어 두는** 것이었다.
 *     저장한 순간에 얼어붙어 과제명을 바꿔도 옛 이름이 남았고, 과제-성과 **또는**
 *     과제-인력 둘 중 하나만 볼 수 있었으며, 색·크기가 노드에 박혀 저장됐다.
 *     여기는 **저장하지 않는다.** 서버가 `dt2_*` 를 읽어 매번 지금 값을 준다.
 *
 * 역할 나눔 — 셋이 겹치지 않는다
 *     `graph_view.py`   무엇이 노드가 되고 무엇이 이어지는가 (권한 포함)
 *     `graphPaint.js`   어떻게 보이는가 (색·모양·크기)
 *     이 파일            무엇을 볼지 사람이 고르는 곳 (필터·레이어·범례)
 *
 * 노드를 누르면 **이미 있는 `ProjectDetailModal`** 이 뜬다 — 보고서와 같은 양식이라
 * 여기서 본 과제와 다른 화면에서 본 과제가 같아 보인다.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import {
  Loader2, RefreshCw, Network, AlertTriangle, Info, X, Shuffle,
  Sparkles, ChevronDown,
} from 'lucide-react';

import { fetchGraph, fetchGraphOptions } from '../../services/graphViewApi';
import {
  fetchBrief, fetchDivisions, fetchGaps, fetchHidden, fetchIssues, fetchKeyProjects,
  fetchKpiBriefing, fetchReadiness, fetchRisky, fetchSchedule, fetchStalled, narrate,
} from '../../services/graphAgentApi';
import ProjectDetailModal from '../Dashboard/ProjectDetailModal';
import AgentPanel from './AgentPanel';
import {
  COLOR_MODES, EDGE_COLORS, EDGE_LABELS, LAYERS, NODE_TYPES, nodeColor,
} from './graphPaint';
import GraphCanvas from './GraphCanvas';

/**
 * 레이어 하나가 만드는 관계 이름들. 범례가 켜진 레이어만 보여주는 데 쓴다.
 * `contains` 는 성과 분류(대→소→성과)와 조직(사업부→프로세스→과제)이 함께 쓴다 —
 * 아래 범례에서 한 번만 나오게 걸러 준다.
 */
const LAYER_RELATIONS = {
  perf: ['measures', 'contains'],
  card: ['in_card'],
  kpi: ['contributes'],
  dep: ['precedes'],
  org: ['contains', 'handled_by'],
  people: ['led_by', 'authored_by', 'member_of', 'belongs_to'],
  action: ['has_item'],
};

const GraphView = ({
  projects = [],
  performances = [],
  // 색표는 **앱이 쓰는 것을 그대로 받는다.** 여기서 따로 만들면 같은 사업부가
  // 화면마다 다른 색이 된다(규칙 복제 금지).
  divisionColors: appDivisionColors = {},
  statusColors = {},
  currentYear,
}) => {
  const [options, setOptions] = useState(null);
  const [years, setYears] = useState(currentYear ? [currentYear] : []);
  const [divisions, setDivisions] = useState([]);
  const [layers, setLayers] = useState(['perf', 'card', 'kpi', 'dep', 'org']);
  const [colorMode, setColorMode] = useState('type');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [focus, setFocus] = useState(null);         // 고른 노드(객체)
  const [detailProject, setDetailProject] = useState(null);
  // 끌어다 고정해 둔 노드를 전부 풀고 다시 계산시키는 신호.
  const [relayoutSignal, setRelayoutSignal] = useState(0);

  /* ── AI 분석 ────────────────────────────────────────────────────────────
     `analysis` 는 숫자, `narrative` 는 문장이다. **따로 온다** —
     분석 GET 은 LLM 을 안 타서 빠르고, 서술은 그 뒤에 붙는다.
     그래서 LLM 이 느려도 화면이 안 멈추고, 죽어도 숫자는 남는다. */
  const [analysis, setAnalysis] = useState(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentError, setAgentError] = useState(null);
  const [narrative, setNarrative] = useState(null);
  const [narrating, setNarrating] = useState(false);
  const [activeStep, setActiveStep] = useState(null);
  // 분석이 짚은 집합. 있으면 그래프가 **이것만** 진하게 남긴다.
  const [highlightRefs, setHighlightRefs] = useState(null);
  const [agentMenuOpen, setAgentMenuOpen] = useState(false);

  /*
    ── 우측 사이드바 너비 ──

    `null` 이면 **자동**이다 — 평소 260px, 분석을 열면 380px 로 넓어진다.
    한 번이라도 손으로 끌면 그 값이 정본이 되어 자동 조절을 멈춘다.
    사람이 정한 것을 화면이 되돌리면 끌 이유가 없어진다.

    다시 자동으로 돌리려면 손잡이를 **두 번 누른다**(또는 Home 키).
  */
  const bodyRef = useRef(null);
  const [sideW, setSideW] = useState(() => {
    const v = Number(localStorage.getItem(SIDE_KEY));
    return Number.isFinite(v) && v >= SIDE_MIN ? v : null;
  });
  const [dragging, setDragging] = useState(false);

  const wideSide = Boolean(analysis || agentLoading || agentError);
  const sideWidth = sideW ?? (wideSide ? SIDE_WIDE : SIDE_BASE);

  useEffect(() => {
    if (sideW == null) localStorage.removeItem(SIDE_KEY);
    else localStorage.setItem(SIDE_KEY, String(sideW));
  }, [sideW]);

  /** 캔버스가 사라지면 관계도가 아니게 된다 — 사이드바는 전체의 60% 까지만. */
  const clampSide = useCallback((w) => {
    const box = bodyRef.current?.getBoundingClientRect();
    const max = box ? Math.max(SIDE_MIN, box.width * 0.6) : 640;
    return Math.round(Math.min(Math.max(w, SIDE_MIN), max));
  }, []);

  /*
    창이 좁아지면 저장해 둔 너비를 다시 묶는다.

    ⚠️ 없으면 이렇게 깨진다: 큰 화면에서 900px 로 넓혀 두면 그 값이 저장되는데,
       작은 화면에서 열면 그대로 900px 을 써서 **캔버스가 사라진다.**
       `clampSide` 는 끌 때만 도는 계산이라 여기서 한 번 더 걸어 준다.
  */
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => {
      setSideW(w => (w == null ? w : clampSide(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [clampSide]);

  const onGripDown = useCallback((e) => {
    e.preventDefault();                       // 끌 때 글자가 선택되지 않게
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
  }, []);

  const onGripMove = useCallback((e) => {
    if (!dragging) return;
    const box = bodyRef.current?.getBoundingClientRect();
    if (!box) return;
    // 오른쪽 패널이라 **오른쪽 끝에서 커서까지**가 곧 너비다.
    setSideW(clampSide(box.right - e.clientX));
  }, [dragging, clampSide]);

  const onGripUp = useCallback((e) => {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setDragging(false);
  }, [dragging]);

  // 마우스를 못 쓰는 경우를 위해 — 손잡이에 초점을 두고 좌우 화살표.
  const onGripKey = useCallback((e) => {
    const step = e.shiftKey ? 48 : 12;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSideW(w => clampSide((w ?? sideWidth) + step));   // 왼쪽 = 패널이 넓어진다
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSideW(w => clampSide((w ?? sideWidth) - step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSideW(null);
    }
  }, [clampSide, sideWidth]);

  // 앱의 색표가 먼저다. 서버가 준 사업부 색은 **거기 없는 이름만** 채운다
  // (설정에 새 사업부가 생겼는데 앱 상수에 아직 없는 경우).
  const divisionColors = useMemo(() => {
    const map = { ...appDivisionColors };
    (options?.divisions || []).forEach(d => {
      if (d?.name && d.color && !map[d.name]) map[d.name] = d.color;
    });
    return map;
  }, [appDivisionColors, options]);

  useEffect(() => {
    let alive = true;
    fetchGraphOptions()
      .then(o => { if (alive) setOptions(o); })
      .catch(err => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchGraph({ years, divisions, layers })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [years, divisions, layers]);

  useEffect(() => { load(); }, [load]);

  const toggle = (list, setList, value) =>
    setList(list.includes(value) ? list.filter(v => v !== value) : [...list, value]);

  /**
   * 한 번 누름 — **종류에 상관없이 똑같이** 초점만 옮긴다 (2026-08-09 요청).
   *
   * 예전에는 과제만 누르는 즉시 상세 모달이 떴다. 그러면 과제는 "이웃 보기" 를
   * 아예 못 한다 — 누르는 순간 모달이 덮어 버리기 때문이다. 관계도에서 제일 자주
   * 하는 일이 "이게 무엇과 엮였나" 인데 그것만 과제에서 막혀 있던 셈이다.
   */
  const handleNodeClick = useCallback((node) => {
    setFocus(node || null);
  }, []);

  /**
   * 두 번 누름 — 상세를 연다. 지금은 과제만 열 곳이 있다.
   *
   * 성과·KPI·사람에는 아직 상세 화면이 없다. 그래서 아무 일도 안 일어난다 —
   * 없는 화면을 지어내는 것보다 낫고, 초점은 첫 번째 누름에서 이미 옮겨져 있다.
   */
  /**
   * 분석 하나를 돌린다. **숫자를 먼저 그리고 문장을 나중에 붙인다.**
   *
   * `run` 은 분석 GET 을 부르는 함수다. 서술은 그 결과가 온 뒤에 따로 부르고,
   * 실패해도 **분석을 지우지 않는다** — 문장이 없다고 숫자를 오류로 덮으면 안 된다.
   */
  const runAnalysis = useCallback(async (run) => {
    setAgentLoading(true);
    setAgentError(null);
    setNarrative(null);
    setActiveStep(null);
    setHighlightRefs(null);
    setAgentMenuOpen(false);
    let result = null;
    try {
      result = await run();
      setAnalysis(result);
    } catch (err) {
      setAgentError(err.message);
      setAnalysis(null);
    } finally {
      setAgentLoading(false);
    }
    if (!result) return;

    setNarrating(true);
    try {
      setNarrative(await narrate(result));
    } catch (err) {
      // 서술 호출 자체가 실패해도 분석은 그대로 둔다.
      setNarrative({ narrative: null, error: err.message });
    } finally {
      setNarrating(false);
    }
  }, []);

  const scope = useMemo(() => ({ years, divisions }), [years, divisions]);

  /**
   * 열면 **한 장이 이미 떠 있다.**
   *
   * ⚠️ 예전에는 들어와도 우측이 「범례」였고, 「AI 분석 ▾」을 눌러 목록에서 하나를
   *    고르기 전까지는 아무 분석도 없었다. 안 눌러 본 사람에게는 이 도구가
   *    **없는 것과 같았다**(2026-08-21 신고).
   *
   * 무엇을 띄우나 — 「지금 급한 것」이다. 여섯 분석을 한 번에 돌려 **겹쳐 걸리는
   * 것**부터 세운다. 한 번에 하나씩만 보면 교차를 사람 머릿속에서 해야 하는데,
   * 진짜 위험한 것은 두 갈래에 동시에 걸리는 것이라 그건 아무도 못 보고 있었다.
   *
   * ⚠️ **딱 한 번만 돈다.** 「범례로 돌아가기」를 누르면 analysis 가 비는데, 그때
   *    다시 돌면 범례를 영영 볼 수 없다. 그래서 상태가 아니라 ref 로 기억한다 —
   *    다시 그려도 값이 안 풀린다.
   *
   * ⚠️ 그래프가 온 **뒤에** 돈다. 먼저 돌면 사람이 아직 아무것도 못 본 상태에서
   *    분석부터 뜬다.
   */
  const closeAgent = useCallback(() => {
    setAnalysis(null);
    setAgentError(null);
    setNarrative(null);
    setActiveStep(null);
    setHighlightRefs(null);
  }, []);

  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRanRef.current) return;
    if (loading || error || !data) return;
    autoRanRef.current = true;
    runAnalysis(() => fetchBrief(scope, currentYear));
  }, [loading, error, data, scope, runAnalysis, currentYear]);

  /**
   * 필터가 바뀌면 **떠 있는 분석을 닫고 새 범위로 다시 연다.**
   *
   * ⚠️ 분석은 연도ㆍ사업부 범위에 매여 있다. 필터만 바꾸고 패널을 그대로 두면
   *    **2025년을 골라 놓고 2026년 분석을 읽게 된다.** 예전에도 그랬지만 그때는
   *    직접 고른 사람만 봤다 — 이제 늘 떠 있으니 반드시 맞춰야 한다.
   *
   * ⚠️ 사람이 골라 둔 분석도 함께 닫힌다. 아쉽지만 **범위가 어긋난 숫자를 그대로
   *    두는 것보다 낫다.** (고른 것을 새 범위로 다시 돌리려면 runAnalysis 가
   *    무엇을 돌렸는지 기억해야 한다 — 그건 따로 할 일이다.)
   *
   * 첫 그림에서는 아무것도 안 한다. 그때는 닫을 것도 없고, 위 훅이 알아서 연다.
   */
  const scopeKeyRef = useRef(null);
  useEffect(() => {
    const key = JSON.stringify(scope);
    if (scopeKeyRef.current === null) { scopeKeyRef.current = key; return; }
    if (scopeKeyRef.current === key) return;
    scopeKeyRef.current = key;
    closeAgent();
    autoRanRef.current = false;
  }, [scope, closeAgent]);

  const openKpiBriefing = useCallback((kpiId) => {
    runAnalysis(() => fetchKpiBriefing(kpiId, scope));
  }, [runAnalysis, scope]);

  /** 패널의 단계·항목을 누르면 그래프가 그 집합만 남긴다. 다시 누르면 푼다. */
  const pickRefs = useCallback((key, refs) => {
    setActiveStep(prev => (prev === key ? null : key));
    setHighlightRefs(prev => (activeStep === key
      ? null
      : new Set((refs || []).filter(Boolean))));
  }, [activeStep]);

  const handleNodeActivate = useCallback((node) => {
    if (!node || node.type !== 'project') return;
    const uuid = node.ref.slice('project:'.length);
    const full = (projects || []).find(p => p.uuid === uuid);
    if (full) setDetailProject(full);
  }, [projects]);

  const stats = data?.stats;

  return (
    <Wrap initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Head>
        <Title><Network size={18} />관계도</Title>
        <Sub>
          과제를 가운데 두고 성과·DX KPI·선행 과제·사업부가 어떻게 엮여 있는지 봅니다.
          한 번 누르면 <b>이웃만</b>, 과제를 두 번 누르면 <b>상세</b>가 열립니다.
          <b>저장하지 않습니다</b> — 열 때마다 지금 값을 읽습니다.
        </Sub>
        <Spacer />
        {/*
          검증된 질문 목록. **자유 질의를 먼저 열지 않는다** — 로컬 LLM 에 의도
          파싱까지 맡기면 답이 흔들린다. `버튼 → 결정적 계산 → LLM 서술` 순서를
          먼저 굳히고, 자유 질의는 그 위에 얹는다(계획서 §3).
        */}
        <AgentMenuWrap>
          <PrimaryBtn onClick={() => setAgentMenuOpen(v => !v)} disabled={loading}>
            <Sparkles size={14} />AI 분석
            <ChevronDown size={13} />
          </PrimaryBtn>
          {agentMenuOpen && (
            <AgentMenu>
              {/* 묶음 없이 맨 위. 이것 하나가 아래 여섯을 한 번에 본다. */}
              <AgentMenuItem onClick={() => runAnalysis(() => fetchBrief(scope, currentYear))}>
                지금 급한 것
                <em>아래 분석들을 한 번에 보고 겹쳐 걸리는 것부터</em>
              </AgentMenuItem>
              <AgentMenuGroup>지금 무엇이 막혔나</AgentMenuGroup>
              <AgentMenuItem onClick={() => runAnalysis(() => fetchStalled(scope))}>
                멈춘 과제
                <em>진행 중이라는데 진척이 그대로인 과제 (이력을 봅니다)</em>
              </AgentMenuItem>
              <AgentMenuItem onClick={() => runAnalysis(() => fetchSchedule(scope))}>
                일정 쏠림
                <em>미완료 액션의 목표일이 한 달에 몰린 과제</em>
              </AgentMenuItem>
              <AgentMenuItem onClick={() => runAnalysis(() => fetchIssues(scope))}>
                이슈 적체
                <em>오래 남은 미해결 이슈, 대응 액션이 없는 과제</em>
              </AgentMenuItem>
              <AgentMenuItem onClick={() => runAnalysis(() => fetchRisky(scope, 5))}>
                위험 지표 Top 5
                <em>달성률이 낮거나 실적이 없는 지표</em>
              </AgentMenuItem>

              <AgentMenuGroup>선언과 실제가 맞나</AgentMenuGroup>
              <AgentMenuItem onClick={() => runAnalysis(() => fetchKeyProjects(scope))}>
                중점과제의 말과 실제
                <em>중점이라 표시했는데 연결·진행이 따라오지 않는 과제</em>
              </AgentMenuItem>
              <AgentMenuItem onClick={() => runAnalysis(() => fetchHidden(scope, 12))}>
                숨은 연결
                <em>직접 이어지지 않았는데 드문 고리로 묶인 과제 쌍</em>
              </AgentMenuItem>

              <AgentMenuGroup>채울 곳 찾기</AgentMenuGroup>
              <AgentMenuItem onClick={() => runAnalysis(() => fetchGaps(scope))}>
                데이터 공백 리포트
                <em>먼저 볼 것 — 위 분석들의 신뢰도를 정합니다</em>
              </AgentMenuItem>
              <AgentMenuItem onClick={() => runAnalysis(() => fetchReadiness(scope))}>
                보고 준비도
                <em>「결과 보고서」 를 쓰기 전 채울 곳</em>
              </AgentMenuItem>
              <AgentMenuItem onClick={() => runAnalysis(() => fetchDivisions(scope))}>
                사업부별 데이터 채움
                <em>어디부터 채울지 — 진행률·달성률은 일부러 뺐습니다</em>
              </AgentMenuItem>

              <AgentMenuHint>
                KPI 를 분석하려면 지표 노드를 <b>오른쪽 버튼</b>으로 누르거나,
                위험 지표 목록에서 <b>분석</b>을 누르세요.
              </AgentMenuHint>
            </AgentMenu>
          )}
        </AgentMenuWrap>
        {/*
          끌어다 놓은 노드는 그 자리에 **고정된다**(점선 테두리). 그래야 방금 옮긴
          것이 제자리로 돌아가지 않고 주변도 덜 출렁인다. 이 버튼이 그 고정을 푼다.
        */}
        <GhostBtn onClick={() => setRelayoutSignal(n => n + 1)} disabled={loading}
                  title="끌어다 고정해 둔 노드를 풀고 처음부터 자리를 잡습니다">
          <Shuffle size={14} />배치 다시 계산
        </GhostBtn>
        <GhostBtn onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />다시 읽기
        </GhostBtn>
      </Head>

      <Controls>
        <Group>
          <GroupLabel>연도</GroupLabel>
          <Chips>
            <Chip $on={years.length === 0} onClick={() => setYears([])}>전체</Chip>
            {(options?.years || []).map(y => (
              <Chip key={y} $on={years.includes(y)} onClick={() => toggle(years, setYears, y)}>
                {y}
              </Chip>
            ))}
          </Chips>
        </Group>

        <Group>
          <GroupLabel>사업부</GroupLabel>
          <Chips>
            <Chip $on={divisions.length === 0} onClick={() => setDivisions([])}>전체</Chip>
            {(options?.divisions || []).map(d => (
              <Chip
                key={d.name}
                $on={divisions.includes(d.name)}
                $accent={d.color}
                onClick={() => toggle(divisions, setDivisions, d.name)}
              >
                {d.name}
              </Chip>
            ))}
          </Chips>
        </Group>

        <Group>
          <GroupLabel>보여줄 관계</GroupLabel>
          <Chips>
            {LAYERS.map(l => (
              <Chip
                key={l.key}
                $on={layers.includes(l.key)}
                title={l.hint}
                onClick={() => toggle(layers, setLayers, l.key)}
              >
                {l.label}
              </Chip>
            ))}
          </Chips>
        </Group>

        <Group>
          <GroupLabel>색 기준</GroupLabel>
          <Chips>
            {COLOR_MODES.map(m => (
              <Chip key={m.key} $on={colorMode === m.key} onClick={() => setColorMode(m.key)}>
                {m.label}
              </Chip>
            ))}
          </Chips>
        </Group>
      </Controls>

      {data?.truncated && (
        <Banner $warn>
          <AlertTriangle size={15} />
          노드가 {stats?.nodeCount}개로 너무 많습니다(상한 {data.maxNodes}).
          연도·사업부를 좁히거나 「액션아이템」 레이어를 꺼 보세요.
          <em>자르지 않고 전부 그리므로 느릴 수 있습니다.</em>
        </Banner>
      )}
      {error && (
        <Banner $warn><AlertTriangle size={15} />{error}</Banner>
      )}
      {layers.length === 0 && (
        <Banner><Info size={15} />관계를 하나도 안 켰습니다. 위에서 하나 이상 고르세요.</Banner>
      )}

      <Body ref={bodyRef} $w={sideWidth} $dragging={dragging}>
        <CanvasBox>
          {loading && <Overlay><Loader2 size={20} className="spin" />읽는 중…</Overlay>}
          {!loading && data && stats?.nodeCount === 0 && (
            <Overlay>
              <Info size={20} />
              조건에 맞는 과제가 없습니다. 연도·사업부를 넓혀 보세요.
            </Overlay>
          )}
          <GraphCanvas
            data={data}
            colorMode={colorMode}
            divisionColors={divisionColors}
            focusRef={focus?.ref || null}
            highlightRefs={highlightRefs}
            relayoutSignal={relayoutSignal}
            onNodeClick={handleNodeClick}
            onNodeActivate={handleNodeActivate}
            onAnalyze={(node) =>
              openKpiBriefing(Number(node.ref.slice('kpi:'.length)))}
          />
        </CanvasBox>

        {/* 너비 손잡이 — 끌어서 조절, 두 번 누르면 자동으로 되돌린다.
            손잡이 표시(가운데 세로 막대)가 없으면 아무도 여기를 잡을 생각을 못 한다. */}
        <Grip
          role="separator"
          aria-orientation="vertical"
          aria-label="사이드바 너비 조절"
          aria-valuenow={sideWidth}
          aria-valuemin={SIDE_MIN}
          tabIndex={0}
          title={'끌어서 너비 조절 · 두 번 누르면 자동\n'
                 + '(초점을 두고 ← → 로도 조절, Home 이면 자동)'}
          $on={dragging}
          $custom={sideW != null}
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          onPointerCancel={onGripUp}
          onDoubleClick={() => setSideW(null)}
          onKeyDown={onGripKey}
        />

        {/*
          분석 중이면 **같은 자리**를 분석 패널이 쓴다(넓어진다). 새 화면도 모달도
          만들지 않는 이유는, 근거가 그래프 위 강조라서 그래프가 가려지면 안 되기 때문이다.
        */}
        {(analysis || agentLoading || agentError) ? (
          <AgentPanel
            analysis={analysis}
            loading={agentLoading}
            error={agentError}
            narrative={narrative}
            narrating={narrating}
            activeStep={activeStep}
            onPickRefs={pickRefs}
            onOpenKpi={openKpiBriefing}
            onBack={closeAgent}
          />
        ) : (
        <Side>
          <SideBlock>
            <SideTitle>한눈에</SideTitle>
            {stats ? (
              <StatGrid>
                <Stat><b>{stats.projectCount}</b><span>과제</span></Stat>
                <Stat><b>{stats.nodeCount}</b><span>노드</span></Stat>
                <Stat><b>{stats.edgeCount}</b><span>연결</span></Stat>
              </StatGrid>
            ) : <Muted>—</Muted>}
          </SideBlock>

          <SideBlock>
            <SideTitle>범례</SideTitle>
            <Legend>
              {Object.entries(NODE_TYPES).map(([key, t]) => (
                <LegendRow key={key}>
                  <Dot $color={t.color} />
                  {t.label}
                  <Count>{stats?.byType?.[key] ?? 0}</Count>
                </LegendRow>
              ))}
            </Legend>
            {colorMode !== 'type' && (
              <Muted>
                지금은 <b>{COLOR_MODES.find(m => m.key === colorMode)?.label}</b>로 칠하는 중입니다.
                색은 <b>과제에만</b> 적용되고 나머지는 종류색 그대로입니다.
              </Muted>
            )}
          </SideBlock>

          <SideBlock>
            <SideTitle>고른 것</SideTitle>
            {focus ? (
              <Focused>
                <FocusHead>
                  <Dot $color={nodeColor(focus, colorMode, divisionColors)} />
                  <strong>{focus.label}</strong>
                  <IconBtn onClick={() => setFocus(null)} title="선택 해제">
                    <X size={13} />
                  </IconBtn>
                </FocusHead>
                <Muted>{NODE_TYPES[focus.type]?.label}</Muted>
                {focus.code && <Kv><span>코드</span>{focus.code}</Kv>}
                {focus.division && <Kv><span>사업부</span>{focus.division}</Kv>}
                {focus.status && <Kv><span>진행상태</span>{focus.status}</Kv>}
                {focus.category && <Kv><span>분류</span>{focus.category}</Kv>}
                {focus.knoxId && <Kv><span>knoxId</span>{focus.knoxId}</Kv>}
                <Kv><span>연결 수</span>{focus.__degree ?? 0}</Kv>
                {focus.type === 'project'
                  ? <Muted><b>두 번 누르면</b> 과제 상세가 열립니다.
                      오른쪽 버튼으로 고정/해제할 수 있습니다.</Muted>
                  : <Muted>이 노드에 걸린 것만 진하게 남았습니다.
                      오른쪽 버튼으로 고정/해제할 수 있습니다.</Muted>}
              </Focused>
            ) : (
              <Muted>
                노드를 <b>한 번</b> 누르면 그것에 걸린 것만 진하게 보이고,
                과제를 <b>두 번</b> 누르면 상세가 열립니다.
                끌어다 놓으면 그 자리에 <b>고정</b>되고(점선 테두리),
                <b>오른쪽 버튼</b>으로 고정을 풉니다.
              </Muted>
            )}
          </SideBlock>

          <SideBlock>
            <SideTitle>연결 색</SideTitle>
            <Legend>
              {[...new Set(LAYERS.filter(l => layers.includes(l.key))
                .flatMap(l => LAYER_RELATIONS[l.key] || []))]
                .map(rel => (
                  <LegendRow key={rel}>
                    <Bar $color={EDGE_COLORS[rel] || '#cbd5e1'} />
                    {EDGE_LABELS[rel] || rel}
                  </LegendRow>
                ))}
            </Legend>
          </SideBlock>
        </Side>
        )}
      </Body>

      <ProjectDetailModal
        project={detailProject}
        onClose={() => setDetailProject(null)}
        performances={performances}
        divisionColors={divisionColors}
        statusColors={statusColors}
      />
    </Wrap>
  );
};

/* ── 스타일 ── */

const Wrap = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 1rem 1.25rem 1.25rem;
  box-sizing: border-box;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const Title = styled.h2`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  color: #1e293b;
`;

const Sub = styled.p`
  margin: 0;
  font-size: 0.8125rem;
  color: #64748b;
  b { color: #334155; }
`;

const Spacer = styled.div`flex: 1;`;

const GhostBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #334155;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  cursor: pointer;

  &:hover:not(:disabled) { background: #f1f5f9; }
  &:disabled { opacity: 0.6; cursor: default; }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const PrimaryBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4rem 0.75rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: white;
  background: #4f46e5;
  border: 1px solid #4f46e5;
  border-radius: 0.5rem;
  cursor: pointer;

  &:hover:not(:disabled) { background: #4338ca; }
  &:disabled { opacity: 0.6; cursor: default; }
`;

const AgentMenuWrap = styled.div`
  position: relative;
`;

const AgentMenu = styled.div`
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 20;
  width: 270px;
  padding: 0.25rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.16);
`;

const AgentMenuItem = styled.button`
  display: block;
  width: 100%;
  padding: 0.4rem 0.5rem;
  text-align: left;
  font-size: 0.78rem;
  font-weight: 600;
  color: #1e293b;
  background: none;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;

  em {
    display: block;
    font-style: normal;
    font-weight: 400;
    font-size: 0.68rem;
    color: #94a3b8;
    margin-top: 1px;
  }
  &:hover { background: #eef2ff; }
`;

const AgentMenuGroup = styled.div`
  padding: 0.35rem 0.5rem 0.15rem;
  font-size: 0.65rem;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.02em;

  &:not(:first-child) {
    border-top: 1px solid #f1f5f9;
    margin-top: 0.2rem;
  }
`;

const AgentMenuHint = styled.div`
  padding: 0.4rem 0.5rem 0.25rem;
  border-top: 1px solid #f1f5f9;
  margin-top: 0.25rem;
  font-size: 0.68rem;
  color: #94a3b8;
  line-height: 1.5;

  b { color: #64748b; }
`;

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
`;

const Group = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
`;

const GroupLabel = styled.span`
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
  flex-shrink: 0;
`;

const Chips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
`;

const Chip = styled.button`
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: 9999px;
  cursor: pointer;
  border: 1px solid ${p => (p.$on ? (p.$accent || '#6366f1') : '#e2e8f0')};
  background: ${p => (p.$on ? (p.$accent || '#6366f1') : 'white')};
  color: ${p => (p.$on ? 'white' : '#64748b')};

  &:hover { border-color: ${p => (p.$accent || '#6366f1')}; }
`;

const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.5rem 0.875rem;
  font-size: 0.8125rem;
  border-radius: 0.5rem;
  background: ${p => (p.$warn ? '#fef3c7' : '#eff6ff')};
  color: ${p => (p.$warn ? '#92400e' : '#1e40af')};
  border: 1px solid ${p => (p.$warn ? '#fcd34d' : '#bfdbfe')};

  em { font-style: normal; opacity: 0.75; }
`;

/* 사이드바 너비 — 자동일 때의 값과 손으로 끌 때의 하한. */
const SIDE_BASE = 260;   // 평소
const SIDE_WIDE = 380;   // 분석 중 (서술과 목록이 260px 에서는 못 읽힌다)
const SIDE_MIN = 220;    // 이보다 좁으면 범례 글자가 줄바꿈으로 무너진다
const SIDE_KEY = 'dt-graph-side-width';

const Body = styled.div`
  display: grid;
  /* 가운데가 손잡이 칸이다. 너비는 위에서 계산해 넘긴다 —
     자동(분석 중 넓어짐)이든 사람이 끈 값이든 결과는 이 한 숫자다.
     **캔버스는 늘 남는다**: 근거가 그래프 위 강조라서 가리면 안 된다(최대 60%). */
  grid-template-columns: 1fr 6px ${p => p.$w}px;
  gap: 0.75rem;
  flex: 1;
  min-height: 0;
  /* 끄는 동안에는 전환을 끈다 — 안 그러면 커서보다 0.18초 늦게 따라와 미끄럽다. */
  transition: ${p => (p.$dragging ? 'none' : 'grid-template-columns 0.18s ease')};
  ${p => (p.$dragging ? 'user-select: none;' : '')}

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const Grip = styled.div`
  position: relative;
  cursor: col-resize;
  border-radius: 3px;
  background: ${p => (p.$on ? '#c7d2fe' : 'transparent')};
  transition: background 0.15s ease;
  /* 손가락으로 끌 때 화면이 같이 스크롤되지 않게 — 포인터 캡처의 짝이다. */
  touch-action: none;

  &:hover { background: #e0e7ff; }
  &:focus-visible { outline: 2px solid #6366f1; outline-offset: 1px; }

  /* 가운데 세로 막대 — 잡는 자리라는 표시. 없으면 아무도 못 찾는다. */
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 3px;
    height: 34px;
    transform: translate(-50%, -50%);
    border-radius: 2px;
    background: ${p => {
      if (p.$on) return '#6366f1';
      return p.$custom ? '#a5b4fc' : '#cbd5e1';   /* 손으로 정한 상태면 진하게 */
    }};
  }

  /* 한 줄로 접히는 폭에서는 조절할 것이 없다 */
  @media (max-width: 1100px) { display: none; }
`;

const CanvasBox = styled.div`
  position: relative;
  min-height: 420px;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow: hidden;
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(248, 250, 252, 0.82);
  color: #64748b;
  font-size: 0.875rem;
  pointer-events: none;

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const Side = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
  overflow-y: auto;
`;

const SideBlock = styled.div`
  padding: 0.75rem 0.875rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
`;

const SideTitle = styled.h3`
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1e293b;
`;

const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.375rem;
  text-align: center;
`;

const Stat = styled.div`
  b { display: block; font-size: 1.05rem; color: #1e40af; }
  span { font-size: 0.7rem; color: #64748b; }
`;

const Legend = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
`;

const LegendRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.75rem;
  color: #475569;
`;

const Dot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${p => p.$color};
  flex-shrink: 0;
`;

const Bar = styled.span`
  width: 16px;
  height: 3px;
  border-radius: 2px;
  background: ${p => p.$color};
  flex-shrink: 0;
`;

const Count = styled.span`
  margin-left: auto;
  font-variant-numeric: tabular-nums;
  color: #94a3b8;
`;

const Muted = styled.p`
  margin: 0.375rem 0 0;
  font-size: 0.72rem;
  color: #94a3b8;
  line-height: 1.5;
  b { color: #64748b; }
`;

const Focused = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`;

const FocusHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  color: #1e293b;
  strong { min-width: 0; word-break: break-word; }
`;

const IconBtn = styled.button`
  margin-left: auto;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
  display: flex;
  &:hover { color: #ef4444; }
`;

const Kv = styled.div`
  display: flex;
  gap: 0.4rem;
  font-size: 0.72rem;
  color: #334155;
  span { color: #94a3b8; min-width: 3.6rem; }
`;

export default GraphView;
