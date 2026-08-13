/**
 * 과제·성과 추이 — **무엇이 언제 늘고 줄었나.**
 *
 *   과제   날짜별 **사업부별 총 과제 수**(완료 포함, **취소 제외**). 올라가면 새로
 *          편성된 것, 내려가면 지워진 것이라 **곡선 자체가 편성 이력**이다.
 *   성과   **성과 속성 카드마다 한 장씩**, 「목표 변화량 vs 실적 변화량」. 현재값을
 *          0 으로 놓고 얼마나 움직였나를 절대값으로 그려, 두 선의 거리가 곧 남은 몫이다.
 *          카드가 이미 어떤 성과를 묶을지·합계인지 평균인지·어느 사업부 배율을 쓸지 정해 놨다.
 *
 * ⚠️ 카드를 **한 그림에 겹치지 않는다.** 단위가 억원·hrs·%·건으로 섞여 있어서
 *    한 세로축에 얹으면 큰 단위가 작은 단위를 바닥에 눌러 붙인다.
 *
 * 역할 나눔
 *     `trend_view.py`        원시 시계열만 (환산·집계 안 함)
 *     `utils/unitConversion` 단위 환산과 카드 집계
 *     이 파일                 무엇을 볼지 고르고 그리는 곳
 *
 * ⚠️ 서버가 주는 성과 값은 **환산 전 원본**이다. 단위가 5종(%·hrs·억원·건·종)이라
 *    그냥 더하면 안 되고, 카드가 정한 대로 환산한 뒤 합쳐야 한다.
 *
 * ⚠️ **이관으로 생성일이 찍힌 과제가 있다.** 응답의 `estimated` 가 그 날짜를 알려주고,
 *    차트에 그 자리를 표시한다 — 숨기면 "그날 200개가 생겼다" 로 읽힌다.
 */
import React, {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
} from 'recharts';
import {
  AlertTriangle, Info, Loader2, RefreshCw, StickyNote, TrendingUp,
} from 'lucide-react';

import {
  fetchPerformanceTrend, fetchProjectTrend, fetchTrendNotes,
} from '../../services/trendApi';
import { cardDeltaAt, defaultActiveConversions } from '../../utils/unitConversion';
import NoteModal from './NoteModal';

const TrendView = ({
  settingsData = {}, divisionColors = {}, currentYear, onYearChange,
}) => {
  // 연도는 **대시보드 전체와 같은 값**을 쓴다(`currentYear`). 화면마다 따로 고르게
  // 하면 탭을 옮길 때마다 연도가 튀어서 같은 해를 보고 있다고 믿기 어려워진다.
  const years = useMemo(() => (currentYear ? [currentYear] : []), [currentYear]);
  const [projects, setProjects] = useState(null);
  const [perfs, setPerfs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // 환산은 기본으로 **켜 둔 규칙**을 따른다 — 「모든 성과 현황」에서 관리자가
  // 저장한 값이 정본이다. 여기서 따로 고르게 하면 두 화면의 숫자가 갈린다.
  const [useConversion, setUseConversion] = useState(true);

  const conv = useMemo(() => ({
    conversions: settingsData?.unitConversions || [],
    active: useConversion ? defaultActiveConversions(settingsData) : {},
    year: years[0] || currentYear,
  }), [settingsData, useConversion, years, currentYear]);

  // 사업부 탭 — `null` 이면 전체. 다른 대시보드(「과제-KPI 연결」)와 같은 조작이다.
  // **서버에 넘겨 다시 받는다** — 화면에서 선만 숨기면 합계가 전체 값 그대로라
  // "MX 만 보는데 합계는 전사" 라는 어긋난 그림이 된다.
  const [division, setDivision] = useState(null);

  /*
    ── 날짜 메모 ──
    곡선은 *무엇이* 바뀌었는지는 말해도 *왜* 는 말하지 못한다. 그 한 줄을
    날짜에 붙여 둔다. 쓰기는 사무국·관리자만이라 `canEdit` 을 서버가 알려 준다
    (눌러 본 다음에 403 을 만나게 하지 않는다).
  */
  const [notes, setNotes] = useState([]);
  const [canEditNotes, setCanEditNotes] = useState(false);
  const [noteError, setNoteError] = useState(null);
  const [noteAt, setNoteAt] = useState(null);   // {date} — 열려 있는 메모 창
  // 말풍선 접기. 메모가 많아지면 곡선을 가리므로 끌 수 있어야 한다.
  const [showNotes, setShowNotes] = useState(true);

  const scope = useMemo(
    () => ({ years, divisions: division ? [division] : [] }), [years, division]);

  const loadNotes = useCallback(() => {
    fetchTrendNotes(scope)
      .then(d => {
        setNotes(d.notes || []);
        setCanEditNotes(!!d.canEdit);
        setNoteError(null);
      })
      // 메모는 곁다리다. 못 읽었다고 차트까지 못 보게 하지 않는다.
      //
      // ⚠️ 다만 **조용히 삼키지는 않는다.** 그러면 버튼도 표식도 안 나타나서,
      //    기능이 고장 난 것인지 아예 없는 것인지 화면만 봐서는 알 수가 없다.
      .catch(err => { setNotes([]); setNoteError(err.message); });
  }, [scope]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchProjectTrend(scope), fetchPerformanceTrend(scope)])
      .then(([p, f]) => { setProjects(p); setPerfs(f); })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
    loadNotes();
  }, [scope, loadNotes]);

  useEffect(() => { load(); }, [load]);

  /** 날짜 → 그날의 메모들. 같은 날 여러 사업부 메모가 붙을 수 있다. */
  const notesByDate = useMemo(() => {
    const m = new Map();
    notes.forEach(n => {
      if (!m.has(n.date)) m.set(n.date, []);
      m.get(n.date).push(n);
    });
    return m;
  }, [notes]);


  /**
   * 탭에 늘어놓을 사업부. **설정의 표준 순서**를 서버가 이미 지켜서 주므로
   * 그 순서를 그대로 쓴다(여기서 다시 정렬하면 범례와 탭이 어긋난다).
   *
   * ⚠️ 사업부를 고른 응답에는 그 사업부만 들어 있다. 그러면 탭이 하나로 줄어
   * 되돌아갈 길이 사라지므로, **전체를 봤을 때의 목록을 기억해 둔다.**
   */
  const [allDivisions, setAllDivisions] = useState([]);
  useEffect(() => {
    if (!division && projects?.series?.length) {
      setAllDivisions(projects.series.map(s => ({
        name: s.division, color: s.color,
      })));
    }
  }, [division, projects]);

  /* ── 과제 차트 데이터 ── */
  const projectRows = useMemo(() => {
    if (!projects?.dates?.length) return [];
    return projects.dates.map((date, i) => {
      // 🐞 `ts` 가 있어야 가로축이 **시간**이 된다. 날짜 문자열을 그대로 쓰면
      //    recharts 가 범주로 보고 **순서대로 등간격** 배치한다 — 1월에 몰린 눈금이
      //    넓게 퍼지고, 8/9 와 12/31 이 5개월 떨어져 있는데 한 칸으로 붙는다.
      const row = { date, ts: dayTs(date), 합계: projects.total[i] };
      projects.series.forEach(s => { row[s.division] = s.counts[i]; });
      return row;
    });
  }, [projects]);

  /**
   * 차트를 누르면 그 날짜의 메모를 연다. 눈금이 아닌 곳을 눌러도 recharts 가
   * **가장 가까운 눈금**을 집어 주므로 날짜를 따로 고를 필요가 없다.
   *
   * 🐞 **recharts 3 부터 차트 `onClick` 이 `activePayload` 를 주지 않는다.**
   *    (3.8.0 `externalEventsMiddleware` 확인) 넘어오는 것은
   *    `{activeCoordinate, activeDataKey, activeIndex, activeLabel,
   *      activeTooltipIndex, isTooltipActive}` 뿐이다.
   *    그래서 `activePayload[0].payload.date` 는 늘 undefined 였고
   *    **누르면 아무 일도 일어나지 않았다.** 이제 `activeIndex` 로 행을 찾는다.
   *
   *    ⚠️ `activeIndex` 가 없을 때 `Number(null)` 은 0 이다. 그대로 두면
   *       빈 곳을 눌러도 **첫 날짜**가 열린다 — 반드시 걸러야 한다.
   */
  const openNoteAt = useCallback((e) => {
    const raw = e?.activeIndex;
    const i = (raw === null || raw === undefined || raw === '') ? -1 : Number(raw);
    const date = (Number.isInteger(i) && i >= 0 ? projectRows[i]?.date : undefined)
      || e?.activePayload?.[0]?.payload?.date;   // 옛 recharts 대비
    if (!date) return;
    if (!canEditNotes && !notesByDate.has(date)) return;   // 볼 것도 쓸 것도 없다
    setNoteAt({ date });
  }, [canEditNotes, notesByDate, projectRows]);

  const projectAxis = useMemo(() => timeAxis(projects?.range), [projects]);
  const perfAxis = useMemo(() => timeAxis(perfs?.range), [perfs]);

  /*
    ── 성과 차트 데이터 — 카드마다 **따로** 한 장 ──

    카드를 한 그림에 겹치지 않는 이유: 카드마다 단위가 다르다(억원·hrs·%·건).
    한 세로축에 얹으면 억원 몇 백이 % 몇 십을 바닥에 눌러 붙여 아무것도 안 보인다.

    순서는 **서버가 준 그대로** 둔다. `kpi_dashboard_cards.order` 순이라
    「모든 성과 현황」·KPI 대시보드가 늘어놓는 순서와 같다 — 여기서 다시 정렬하면
    같은 카드를 두 화면에서 다른 자리에서 찾게 된다.
  */
  const cardSeries = useMemo(() => {
    if (!perfs?.dates?.length) return [];
    // 달성률 배지는 **오늘 자리**의 값으로 계산한다.
    //
    // 🐞 처음엔 "둘 다 값이 있는 마지막 시점" 을 썼다. 그런데 카드에 걸린 성과가
    //    전부 지워진 카드(개발 DB: 「개발 비용(MX)」의 성과 4건이 8/2 에 삭제)가
    //    **7월의 12% 를 지금 값처럼** 달고 있었다. 지금 없는 것은 없다고 해야 한다.
    const tix = perfs.dates.indexOf(perfs.today);
    return (perfs.cards || []).map(card => {
      let unit = '';
      const rows = perfs.dates.map((date, i) => {
        const d = cardDeltaAt(card, i, conv);
        if (!unit) unit = d.unit;
        // 값이 없는 시점은 **선을 잇지 않는다**(null). 0 으로 두면 "안 움직였다" 가 된다.
        return { date, ts: dayTs(date), 목표: d.target, 실적: d.actual };
      });
      const nowRow = tix >= 0 ? rows[tix] : null;
      // 오늘 값이 있는 카드인가. 없으면(성과가 다 지워진 카드) **마지막 기록**을
      // 보여 주되 "언제까지" 를 밝힌다 — 그냥 「목표 — · 실적 —」 로 두면
      // 선이 7월에서 끊긴 이유를 화면 어디에서도 알 수 없다.
      const live = !!nowRow && (nowRow.목표 != null || nowRow.실적 != null);
      const shown = live ? nowRow
        : [...rows].reverse().find(r => r.목표 != null || r.실적 != null) || null;
      return {
        key: cardKey(card), card, rows, unit, live, empty: !shown,
        stat: shown && {
          date: shown.date, 목표: shown.목표, 실적: shown.실적,
          // 남은 몫(+) 또는 초과분(−). **둘 다 있을 때만** 낸다 — 실적 미입력은
          // "0 을 했다" 가 아니라 "모른다" 라서, 목표 전부를 남은 몫이라 할 수 없다.
          gap: (shown.목표 != null && shown.실적 != null)
            ? shown.목표 - shown.실적 : null,
          rate: (shown.목표 && shown.실적 != null)
            ? (shown.실적 / shown.목표) * 100 : null,
        },
      };
    });
  }, [perfs, conv]);

  const emptyCount = cardSeries.filter(c => c.empty).length;

  /*
    한 화면에 **2열 × 2줄 = 4개**. 나머지는 스크롤.

    🐞 이걸 CSS 만으로 두 번 시도해서 두 번 다 틀렸다.
         ① 한 장을 176px 로 못 박음 → 패널이 더 크면 **아래가 텅 빔**
         ② grid-auto-rows 를 퍼센트로 줌 → 스크롤 컨테이너의 높이를
            브라우저가 불확정으로 봐서 퍼센트가 안 풀리고, minmax 의 아래쪽인
            140px 로 떨어져 **한 화면에 4줄**이 나왔다.

    그래서 **재서 넣는다.** 보이는 높이가 유일한 정답이고, 그건 레이아웃이
    끝나야 알 수 있다. 창 크기·사업부 탭 줄바꿈으로 높이가 변하므로
    ResizeObserver 로 계속 따라간다.
  */
  const scrollRef = useRef(null);
  const [rowH, setRowH] = useState(0);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    // 첫 그림부터 맞게 — useEffect 로 두면 4줄이 한 번 보였다가 접힌다.
    const measure = () => setRowH(
      Math.max(MIN_ROW_H, Math.floor((el.clientHeight - GRID_GAP_PX) / 2)));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /*
    말풍선이 그림 밖으로 나가지 않게 **차트 너비를 잰다.**
    `ReferenceLine` 이 label 에 주는 `viewBox` 는 세로선의 x 와 그림 높이뿐이라
    좌우 경계를 알 수 없다(recharts 3.8). 1/1·12/31 처럼 가장자리 날짜의
    말풍선은 이 값이 없으면 절반이 잘려 나간다.
  */
  const chartRef = useRef(null);
  const [chartW, setChartW] = useState(0);
  useLayoutEffect(() => {
    const el = chartRef.current;
    if (!el) return undefined;
    const measure = () => setChartW(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <Wrap initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Head>
        <Title><TrendingUp size={18} />과제·성과 추이</Title>
        <Spacer />
        <GhostBtn onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} />다시 읽기
        </GhostBtn>
        {/* 연도 위젯 — 「과제-KPI 연결」·「전체 요약」과 **같은 모양·같은 자리**(우측 끝).
            같은 대시보드 안의 화면들이라 조작이 다르면 탭을 옮길 때마다 헤맨다. */}
        <YearSelector>
          <YearButton onClick={() => onYearChange && onYearChange(currentYear - 1)}
                      title="이전 연도">‹</YearButton>
          <YearDisplay>{currentYear}년</YearDisplay>
          <YearButton onClick={() => onYearChange && onYearChange(currentYear + 1)}
                      title="다음 연도">›</YearButton>
        </YearSelector>
      </Head>

      {error && <Banner $warn><AlertTriangle size={15} />{error}</Banner>}

      {/* 사업부 탭 — 「과제-KPI 연결」과 같은 모양·같은 조작 */}
      {allDivisions.length > 0 && (
        <DivTabBar>
          <DivTab $on={!division} onClick={() => setDivision(null)}>전체</DivTab>
          {allDivisions.map(d => (
            <DivTab key={d.name} $on={division === d.name}
                    onClick={() => setDivision(division === d.name ? null : d.name)}>
              <DivDot style={{ background: divisionColors[d.name] || d.color || '#cbd5e1' }} />
              {d.name}
            </DivTab>
          ))}
        </DivTabBar>
      )}

      <Panels>
        {/* ── 과제 ───────────────────────────────────────────────── */}
        <Panel>
          <PanelHead>
            <PanelTitle>사업부별 과제 수</PanelTitle>
            <PanelMeta>
              {/* 🐞 처음엔 "차트를 누르세요" 를 `title` 툴팁에만 적었다. 올려놔야
                  보이는 안내는 **없는 것과 같다** — 관리자도 켜는 법을 못 찾았다.
                  그래서 누를 수 있는 버튼을 눈에 보이게 둔다. */}
              {canEditNotes && (
                <AddNoteBtn
                  onClick={() => setNoteAt({ date: noteDefaultDate(projects) })}
                  title="날짜별로 왜 늘고 줄었는지 적어 둡니다. 차트의 날짜를 눌러도 열립니다.">
                  <StickyNote size={12} />메모 쓰기
                </AddNoteBtn>
              )}
              {notes.length > 0 && (
                <Toggle $on={showNotes} onClick={() => setShowNotes(v => !v)}
                        title={showNotes
                          ? '말풍선을 접습니다. 날짜 표식은 남습니다.'
                          : '메모를 말풍선으로 펼쳐 봅니다.'}>
                  말풍선 {showNotes ? '켬' : '끔'} · {notes.length}
                </Toggle>
              )}
              {noteError && (
                <NoteWarn title={noteError}>
                  <AlertTriangle size={12} />메모를 못 읽었습니다
                </NoteWarn>
              )}
              {projects && <span>과제 {projects.projectCount}건</span>}
            </PanelMeta>
          </PanelHead>

          <ChartBox ref={chartRef}>
            {loading && <Overlay><Loader2 size={18} className="spin" />읽는 중…</Overlay>}
            {!loading && projectRows.length === 0 && (
              <Overlay><Info size={18} />그릴 과제가 없습니다.</Overlay>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectRows} onClick={openNoteAt}
                         style={{ cursor: canEditNotes ? 'pointer' : 'default' }}
                         margin={{ top: 26, right: 20, bottom: 4, left: -8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                {/* 시간 축 — 날짜 사이 거리가 **실제 간격**으로 그려진다 */}
                <XAxis dataKey="ts" type="number" scale="time"
                       domain={projectAxis.domain} ticks={projectAxis.ticks}
                       tickFormatter={projectAxis.format}
                       tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip content={<Tip suffix="건" />} />
                {/* 🐞 `itemSorter` 기본값이 'value' 라 **범례를 알파벳순으로 다시 정렬한다.**
                    서버가 표준 순서(MX·VD·DA…)로 줘도 범례에서 뒤집혀서, 선 색과
                    범례를 눈으로 짝지을 수 없었다. null 이면 선언 순서를 그대로 쓴다. */}
                <Legend wrapperStyle={{ fontSize: 11 }} itemSorter={null} />
                {/* 이관으로 생성일이 찍힌 날 — 숨기면 "그날 다 생겼다" 로 읽힌다 */}
                {(projects?.estimated || []).map(e => (
                  <ReferenceLine key={e.date} x={dayTs(e.date)} stroke="#f59e0b"
                                 strokeDasharray="4 3"
                                 label={{ value: `이관 ${e.total}건`, position: 'top',
                                          fontSize: 10, fill: '#b45309' }} />
                ))}
                {/* 오늘 자리에 선을 하나 긋는다 — 축이 12월까지라 어디까지가
                    실제이고 어디부터가 아직 안 온 날인지 보여야 한다 */}
                {projects?.today && (
                  <ReferenceLine x={dayTs(projects.today)} stroke="#94a3b8"
                                 strokeDasharray="2 3"
                                 label={{ value: '오늘', position: 'insideTop',
                                          fontSize: 10, fill: '#64748b' }} />
                )}
                {/* 메모가 달린 날 — 곡선이 왜 움직였는지 아는 자리다.
                    선을 **연하게** 긋는다. 「이관」·「오늘」보다 튀면 안 된다.

                    켜면 말풍선, 끄면 📌 표식만. **끈다고 자리까지 지우지는 않는다** —
                    메모가 있다는 사실은 남아야 접었다는 걸 알고 다시 펼 수 있다. */}
                {[...notesByDate.entries()].map(([d, ns], i) => (
                  <ReferenceLine key={`n-${d}`} x={dayTs(d)} stroke="#a5b4fc"
                                 strokeDasharray="1 3"
                                 label={showNotes
                                   ? (
                                     <NoteBubble notes={ns} row={i} boxW={chartW}
                                                 onOpen={() => setNoteAt({ date: d })} />
                                   )
                                   : { value: '📌', position: 'insideBottom',
                                       fontSize: 11 }} />
                ))}
                {(projects?.series || []).map(s => (
                  <Line key={s.division} type="stepAfter" dataKey={s.division}
                        stroke={divisionColors[s.division] || s.color || '#94a3b8'}
                        strokeWidth={1.6} dot={false} connectNulls={false} />
                ))}
                <Line type="stepAfter" dataKey="합계" stroke="#1e293b"
                      strokeWidth={2} strokeDasharray="5 3" dot={false}
                      connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartBox>
        </Panel>

        {/* ── 성과 ───────────────────────────────────────────────── */}
        <Panel>
          <PanelHead>
            <PanelTitle>성과 속성별 목표 대비 추이</PanelTitle>
            <PanelMeta>
              <Swatch $color={DELTA.목표.color} $alpha="26" />목표
              <Swatch $color={DELTA.실적.color} $alpha="6b" />실적
              <Toggle $on={useConversion} onClick={() => setUseConversion(v => !v)}>
                환산 {useConversion ? '켬' : '끔'}
              </Toggle>
            </PanelMeta>
          </PanelHead>
          {/* 한 화면에 2열 × 2줄 = 4개. 나머지는 이 영역만 굴려서 본다 —
              카드가 늘어도 옆의 과제 패널과 높이가 어긋나지 않아야 한다. */}
          <MiniWrap>
            {loading && <Overlay><Loader2 size={18} className="spin" />읽는 중…</Overlay>}
            {!loading && cardSeries.length === 0 && (
              <Overlay><Info size={18} />그릴 성과 속성 카드가 없습니다.</Overlay>
            )}
            <MiniScroll ref={scrollRef}
                        style={rowH ? { gridAutoRows: `${rowH}px` } : undefined}>
              {cardSeries.map(cs => (
                <Mini key={cs.key}>
                  <MiniHead>
                    <MiniTitle title={`${cs.card.name} · ${cs.card.division} · ${cs.card.logic}`}>
                      {cs.card.name}
                    </MiniTitle>
                    <MiniDiv
                      style={{ background: divisionColors[cs.card.division] || '#94a3b8' }}>
                      {cs.card.division}
                    </MiniDiv>
                    {/* 배지는 **오늘** 상태만 찍는다. 지난 값을 여기 달면
                        지금 그런 것처럼 읽힌다(아래 요약줄이 날짜를 밝히고 맡는다). */}
                    {cs.live && cs.stat?.rate != null && (
                      <Rate $good={cs.stat.rate >= 100}
                            title="달성률 = 실적 변화량 ÷ 목표 변화량">
                        {Math.round(cs.stat.rate).toLocaleString()}%
                      </Rate>
                    )}
                  </MiniHead>
                  {/* 그래프를 안 읽어도 결론이 한 줄로 잡히게 */}
                  {cs.stat && (
                    <MiniSub $stale={!cs.live}>
                      {!cs.live && <Dim>{shortDate(cs.stat.date)}까지</Dim>}
                      <span>목표 {cs.stat.목표 == null ? '—' : fmtVal(cs.stat.목표)}</span>
                      <Dim>·</Dim>
                      <span>실적 {cs.stat.실적 == null ? '—' : fmtVal(cs.stat.실적)}</span>
                      {cs.unit && <Dim>{cs.unit}</Dim>}
                      {cs.live && cs.stat.gap != null && (
                        <Gap $over={cs.stat.gap < 0}>
                          {cs.stat.gap < 0 ? '초과' : '남은'} {fmtVal(Math.abs(cs.stat.gap))}
                        </Gap>
                      )}
                      {!cs.live && cs.stat.rate != null && (
                        <Gap>{Math.round(cs.stat.rate).toLocaleString()}%</Gap>
                      )}
                    </MiniSub>
                  )}
                  <MiniBox>
                    {cs.empty && <MiniEmpty>아직 값이 없습니다</MiniEmpty>}
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={cs.rows}
                                 margin={{ top: 12, right: 12, bottom: 0, left: -22 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="ts" type="number" scale="time"
                               domain={perfAxis.domain} ticks={perfAxis.ticks}
                               tickFormatter={perfAxis.format}
                               tick={{ fontSize: 9, fill: '#94a3b8' }} />
                        <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} width={44} />
                        <Tooltip content={<MiniTip unit={cs.unit} />} />
                        {perfs?.today && (
                          <ReferenceLine x={dayTs(perfs.today)} stroke="#cbd5e1"
                                         strokeDasharray="2 3" />
                        )}
                        {/*
                          목표를 **먼저** 깔아 통이 되고, 실적이 그 위에 얹혀 채움이 된다.
                          겹치지 않고 남은 위쪽 여백이 곧 **남은 몫**이라, 뺄셈을 눈이
                          대신 해 준다. 실적이 통보다 크면 목표 점선 위로 솟아 초과가 보인다.

                          둘 다 `stepAfter` 다 — 값은 기록될 때만 바뀌므로 그 사이는
                          평평한 게 사실이다. 실적만 곡선으로 두면 계단 모서리에서
                          곡선이 튀어올라 **넘지도 않은 통을 넘은 것처럼** 그려진다.

                          🐞 점을 안 찍으면 **값이 한 시점뿐인 계열이 아예 안 보인다**
                             (면적·선은 두 점 사이에만 그려진다). 개발 DB 의
                             「개발 시간(MX)」이 7/28 한 점뿐이라 빈 칸처럼 보였다.
                        */}
                        <Area type="stepAfter" dataKey="목표" stroke={DELTA.목표.color}
                              strokeWidth={1.4} strokeDasharray="5 3"
                              fill={DELTA.목표.color} fillOpacity={0.1}
                              dot={{ r: 1.8 }} connectNulls={false}
                              isAnimationActive={false} />
                        <Area type="stepAfter" dataKey="실적" stroke={DELTA.실적.color}
                              strokeWidth={2}
                              fill={DELTA.실적.color} fillOpacity={0.42}
                              dot={{ r: 2.4 }} connectNulls={false}
                              isAnimationActive={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </MiniBox>
                </Mini>
              ))}
            </MiniScroll>
          </MiniWrap>

          {emptyCount > 0 && (
            <Basis>
              <Info size={12} />
              값이 아직 없는 카드 {emptyCount}개도 자리는 그대로 뒀습니다
              (「모든 성과 현황」과 같은 순서로 보기 위해서입니다).
            </Basis>
          )}
        </Panel>
      </Panels>

      {noteAt && (
        <NoteModal
          date={noteAt.date}
          /* 창이 **최신 목록**을 그때그때 추린다. 저장·삭제 뒤에도 창을 닫지 않으므로
             한 벌 복사해 넘기면 목록만 옛것으로 남는다. */
          allNotes={notes}
          division={division}
          divisions={allDivisions.map(d => d.name)}
          scope={scope}
          canEdit={canEditNotes}
          onClose={() => setNoteAt(null)}
          onChanged={loadNotes}
        />
      )}
    </Wrap>
  );
};

/* 같은 이름의 카드가 사업부별로 여럿이라(「품질 비용」이 넷) 이름만으로는 못 가른다. */
const cardKey = (card) => `${card.name} (${card.division})`;

/**
 * 'YYYY-MM-DD' → 그날 0시의 타임스탬프.
 *
 * `new Date('2026-01-01')` 은 **UTC 자정**으로 읽혀 시간대에 따라 하루 밀린다.
 * `T00:00:00` 을 붙이면 **그 자리 시간**으로 읽혀 날짜가 안 흔들린다.
 */
const dayTs = (d) => (typeof d === 'string'
  ? new Date(`${d}T00:00:00`).getTime() : d);

/**
 * 시간 축 설정 — 눈금은 **달의 첫날**로 놓는다.
 *
 * 눈금을 데이터가 있는 날짜에 두면, 1월에 몰린 값들 때문에 눈금이 왼쪽에만
 * 빽빽하게 붙고 나머지 반년이 눈금 없이 비어 버린다. 달마다 하나면 고르게 읽힌다.
 */
const timeAxis = (range) => {
  const from = range?.from ? dayTs(range.from) : null;
  const to = range?.to ? dayTs(range.to) : null;
  if (from == null || to == null) {
    return { domain: ['dataMin', 'dataMax'], ticks: undefined, format: fmtTick };
  }
  const ticks = [];
  const cur = new Date(from);
  cur.setDate(1);
  while (cur.getTime() <= to) {
    const t = cur.getTime();
    if (t >= from) ticks.push(t);
    cur.setMonth(cur.getMonth() + 1);
  }
  return { domain: [from, to], ticks, format: fmtTick };
};

/* ── 차트 위의 말풍선 ──
   `ReferenceLine` 의 `label` 로 넘기면 recharts 가 `viewBox` 를 붙여 복제해 준다.
   세로선의 `viewBox` 는 `{x: 선의 x픽셀, y: 그림 위쪽, width: 0, height: 그림 높이}` 다
   (recharts 3.8 `ReferenceLine` 의 `rectWithCoords`). 좌우 경계는 안 주므로
   잘림을 막으려면 **차트 너비를 따로 재서** 넘겨야 한다. */
const BUBBLE_W = 152;
const BUBBLE_HEAD = 13;     // 날짜 머리줄
const BUBBLE_LINE = 12;     // 메모 한 줄
const BUBBLE_PAD = 5;       // 아래 여백
const BUBBLE_ROWS = 2;      // 날짜가 붙어 있을 때 위아래로 엇갈려 놓는다
/* 한 말풍선에 보여 줄 최대 줄 수. 넘으면 마지막 줄이 「+N 더」가 된다.
   무제한으로 늘리면 메모가 쌓인 날짜에서 말풍선이 그림을 통째로 덮는다. */
const BUBBLE_MAX_LINES = 3;
/* 엇갈릴 때 내려가는 거리. **가장 큰 말풍선**을 기준으로 잡아야 위아래가 겹치지 않는다. */
const BUBBLE_ROW_STEP =
  BUBBLE_HEAD + BUBBLE_MAX_LINES * BUBBLE_LINE + BUBBLE_PAD + 8;

export const bubbleHeight = (count) =>
  BUBBLE_HEAD + Math.min(count, BUBBLE_MAX_LINES) * BUBBLE_LINE + BUBBLE_PAD;

/** 한 줄에 들어갈 만큼만. 나머지는 올려놓거나 눌러서 본다. */
const clip = (text, max) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/**
 * 그 날짜의 메모를 **다 보여 준다.**
 *
 * 🐞 처음엔 첫 줄만 그리고 머리에 `+2` 만 붙였다. 사업부별로 나눠 적은 메모가
 *    그래서 하나만 보였고, 나머지는 눌러야만 존재를 알 수 있었다.
 *    사업부마다 한 줄씩 적는 것이 이 기능의 주된 쓰임이라 그 줄들이 곧 내용이다.
 */
const NoteBubble = ({ viewBox, notes = [], row = 0, boxW = 0, onOpen }) => {
  if (!viewBox || !notes.length) return null;

  // 넘치는 것은 마지막 줄을 「+N 더」로 바꿔 알린다 — 조용히 자르지 않는다.
  const over = notes.length > BUBBLE_MAX_LINES;
  const shown = over ? notes.slice(0, BUBBLE_MAX_LINES - 1) : notes;
  const h = bubbleHeight(notes.length);

  const cx = viewBox.x;
  const top = (viewBox.y || 0) + 18 + (row % BUBBLE_ROWS) * BUBBLE_ROW_STEP;

  // 가장자리 날짜(1/1·12/31)에서는 말풍선이 그림 밖으로 나간다. 안으로 당기고,
  // **꼬리는 원래 날짜 자리에 남겨** 어느 날인지 흐려지지 않게 한다.
  let x = cx - BUBBLE_W / 2;
  if (boxW) x = Math.max(2, Math.min(x, boxW - BUBBLE_W - 2));
  const tail = Math.max(x + 9, Math.min(cx, x + BUBBLE_W - 9));

  return (
    <g onClick={onOpen} style={{ cursor: 'pointer' }}>
      <rect x={x} y={top} width={BUBBLE_W} height={h} rx={6}
            fill="#eef2ff" stroke="#c7d2fe" />
      {/* 꼬리 — 어느 날짜의 말풍선인지 가리킨다 */}
      <path d={`M ${tail - 4} ${top + h} L ${tail} ${top + h + 5} `
               + `L ${tail + 4} ${top + h} Z`}
            fill="#eef2ff" stroke="#c7d2fe" />
      <text x={x + 7} y={top + 10} fontSize={9} fontWeight={700} fill="#4f46e5">
        {shortDate(notes[0].date)}
        {notes.length > 1 ? ` · ${notes.length}건` : ''}
      </text>
      {shown.map((n, i) => (
        <text key={n.id} x={x + 7} y={top + BUBBLE_HEAD + 9 + i * BUBBLE_LINE}
              fontSize={9}>
          {/* 사업부는 색으로 갈라 둔다 — 줄이 여럿이면 어느 줄이 어디 것인지가 먼저다 */}
          <tspan fill="#4f46e5" fontWeight={700}>
            {n.division && n.division !== '전체' ? n.division : '전사'}
          </tspan>
          <tspan fill="#334155" dx={4}>{clip(n.text, 12)}</tspan>
        </text>
      ))}
      {over && (
        <text x={x + 7}
              y={top + BUBBLE_HEAD + 9 + (BUBBLE_MAX_LINES - 1) * BUBBLE_LINE}
              fontSize={9} fill="#6366f1" fontWeight={700}>
          {`+${notes.length - shown.length}건 더 — 눌러서 보기`}
        </text>
      )}
      {/* 전문은 올려놓으면 보인다. 잘린 글을 보려고 창을 열게 하지 않는다. */}
      <title>
        {notes.map(n => `[${n.division || '전체'}] ${n.text}`).join('\n')}
      </title>
    </g>
  );
};

/**
 * 「메모 쓰기」로 새로 열 때의 기본 날짜.
 *
 * 보고 있는 해의 **오늘**이 기본이다. 다른 해를 보고 있으면 오늘이 그 축 밖이라
 * 무의미하므로, 그때는 그 해의 마지막 눈금을 쓴다.
 */
const noteDefaultDate = (projects) => {
  const dates = projects?.dates || [];
  const today = projects?.today;
  if (today && dates.includes(today)) return today;
  return dates[dates.length - 1] || today || '';
};

/** 'YYYY-MM-DD' → '7/28'. 좁은 카드 머리에 연도까지 쓸 자리가 없다. */
const shortDate = (d) => {
  const [, m, day] = String(d).split('-');
  return `${Number(m)}/${Number(day)}`;
};

const fmtTick = (ts) => {
  const d = new Date(ts);
  const m = d.getMonth() + 1;
  // 1월에는 연도를 함께 — 해가 바뀌는 자리를 눈으로 잡을 수 있게.
  return m === 1 ? `${String(d.getFullYear()).slice(2)}.1월` : `${m}월`;
};

/* 목표는 기준선, 실적은 그 기준을 향해 가는 선. 색을 고정해 카드마다 같게 읽힌다. */
const DELTA = {
  목표: { color: '#2563eb' },   // KPI 카드의 「목표」 글자색과 같은 파랑
  실적: { color: '#059669' },   // KPI 카드의 「실적」 글자색과 같은 초록
};

/** 소수점이 길게 늘어지면 툴팁이 읽히지 않는다. 정수는 그대로, 나머지는 두 자리. */
const fmtVal = (v) => (typeof v === 'number'
  ? (Number.isInteger(v) ? v.toLocaleString()
    : v.toLocaleString(undefined, { maximumFractionDigits: 2 }))
  : v);

/**
 * 과제 차트 툴팁. 값이 없는 계열은 뺀다 — 사업부가 여덟이라 `-` 줄이 늘어서면
 * 정작 읽을 것을 못 찾는다.
 */
const Tip = ({ active, payload, suffix }) => {
  if (!active || !payload?.length) return null;
  const rows = payload.filter(p => p.value != null);
  if (!rows.length) return null;
  // 가로축이 타임스탬프라 `label` 은 숫자다. 원래 날짜 문자열을 그대로 쓴다.
  const day = payload[0]?.payload?.date;
  return (
    <TipBox>
      <TipDate>{day}</TipDate>
      {rows.map(p => (
        <TipRow key={p.dataKey}>
          <TipDot style={{ background: p.color }} />
          <span>{p.dataKey}</span>
          <b>{fmtVal(p.value)}{suffix || ''}</b>
        </TipRow>
      ))}
    </TipBox>
  );
};

/**
 * 성과 미니 차트의 툴팁 — **결론까지** 적는다.
 *
 * 목표·실적만 보여 주면 툴팁 안에서도 뺄셈을 사람이 해야 한다. 이 화면의 질문이
 * "이 중 얼마를 했나" 라서, 남은 몫과 달성률을 같이 적어야 답이 된다.
 */
const MiniTip = ({ active, payload, unit }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row || (row.목표 == null && row.실적 == null)) return null;
  const t = row.목표;
  const a = row.실적;
  const gap = (t != null && a != null) ? t - a : null;
  const rate = (t && a != null) ? (a / t) * 100 : null;
  const u = unit ? ` ${unit}` : '';
  return (
    <TipBox>
      <TipDate>{row.date}</TipDate>
      <TipRow>
        <TipDot style={{ background: DELTA.목표.color }} />
        <span>목표</span><b>{t == null ? '—' : `${fmtVal(t)}${u}`}</b>
      </TipRow>
      <TipRow>
        <TipDot style={{ background: DELTA.실적.color }} />
        <span>실적</span><b>{a == null ? '—' : `${fmtVal(a)}${u}`}</b>
      </TipRow>
      {gap != null && (
        <TipRow>
          <TipDot style={{ background: 'transparent' }} />
          <span>{gap < 0 ? '초과' : '남은'}</span>
          <b>{fmtVal(Math.abs(gap))}{u}</b>
        </TipRow>
      )}
      {rate != null && (
        <TipRow>
          <TipDot style={{ background: 'transparent' }} />
          <span>달성률</span><b>{Math.round(rate).toLocaleString()}%</b>
        </TipRow>
      )}
    </TipBox>
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

const Spacer = styled.div`flex: 1;`;

/* 연도 위젯 — `KpiMatrixView` 의 것과 **같은 모양**이다. 같은 대시보드 안에서
   조작이 다르면 탭을 옮길 때마다 헤맨다. */
const YearSelector = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
`;

const YearButton = styled.button`
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  &:hover { background: #e2e8f0; }
`;

const YearDisplay = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
  min-width: 60px;
  text-align: center;
`;

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

const Banner = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  font-size: 0.8125rem;
  border-radius: 0.5rem;
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
`;

/* 사업부 탭 — `KpiMatrixView` 의 DivTabBar 와 같은 모양이다. */
const DivTabBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.15rem 0 0.6rem;
  border-bottom: 1px solid #e2e8f0;
`;

const DivTab = styled.button`
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.8rem;
  border-radius: 0.5rem;
  border: 1px solid ${p => (p.$on ? '#6366f1' : '#e2e8f0')};
  background: ${p => (p.$on ? '#6366f1' : '#fff')};
  color: ${p => (p.$on ? '#fff' : '#64748b')};
  font-size: 0.8rem;
  font-weight: ${p => (p.$on ? 700 : 500)};
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: ${p => (p.$on ? '#4f46e5' : '#f8fafc')};
    border-color: ${p => (p.$on ? '#4f46e5' : '#cbd5e1')};
  }
`;

const DivDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
`;

const Panels = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
  flex: 1;
  min-height: 0;

  @media (max-width: 1280px) {
    grid-template-columns: 1fr;
  }
`;

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 340px;
  min-width: 0;
  padding: 0.75rem 0.875rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
`;

const PanelHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PanelTitle = styled.h3`
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1e293b;
`;

const PanelMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
  font-size: 0.75rem;
  color: #94a3b8;
`;

const Toggle = styled.button`
  padding: 0.15rem 0.5rem;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 9999px;
  cursor: pointer;
  border: 1px solid ${p => (p.$on ? '#0891b2' : '#e2e8f0')};
  background: ${p => (p.$on ? '#cffafe' : 'white')};
  color: ${p => (p.$on ? '#0e7490' : '#94a3b8')};
`;

/* ── 날짜 메모 ── */

const AddNoteBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.15rem 0.5rem;
  margin-right: 0.35rem;
  border-radius: 9999px;
  border: 1px solid #c7d2fe;
  font-size: 0.7rem;
  font-weight: 700;
  color: #4f46e5;
  background: #eef2ff;
  cursor: pointer;

  &:hover { background: #e0e7ff; border-color: #a5b4fc; }
`;

const NoteWarn = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  margin-right: 0.35rem;
  color: #b45309;
  cursor: help;
`;

const Basis = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  margin: 0.35rem 0 0.15rem;
  font-size: 0.7rem;
  color: #94a3b8;
  line-height: 1.5;

  svg { flex-shrink: 0; margin-top: 2px; }
`;

const ChartBox = styled.div`
  position: relative;
  flex: 1;
  min-height: 260px;
  margin-top: 0.35rem;
`;

/* ── 성과 속성 카드 하나짜리 작은 차트들 ──
   여백은 **px 로 못 박는다.** 줄 높이를 JS 가 계산하는데, rem 이면 루트 글꼴에
   따라 값이 달라져 계산과 실제가 어긋난다. */
const GRID_GAP_PX = 10;
/* 패널이 아주 낮을 때의 바닥 — 이보다 얇으면 제목·요약줄과 축 글씨가 겹친다.
   이때는 2줄이 안 들어가도 어쩔 수 없다(읽히는 쪽이 낫다). */
const MIN_ROW_H = 150;

const MiniWrap = styled.div`
  position: relative;
  display: flex;
  /* 패널에 남은 높이를 **다 쓴다.**

     🐞 처음엔 한 장을 176px 로 못 박고 max-height 로 2줄까지만 보이게 했다.
        그런데 옆의 과제 패널이 더 커서 행 높이가 그보다 커지면, 이 영역은
        363px 에서 멈추고 **아래가 텅 비었다.** 높이는 남는 만큼 쓰고,
        "2줄" 은 아래 grid-auto-rows 가 반씩 나눠 갖는 것으로 지킨다. */
  flex: 1;
  min-height: 0;
  /* 안쪽 내용이 이 상자를 밀어 키우지 못하게 막는다 — 키우면 "재서 넣은 줄 높이"가
     다시 상자를 키우는 되먹임이 생긴다. 스크롤은 안쪽이 알아서 한다. */
  overflow: hidden;
  margin-top: 0.35rem;
`;

const MiniScroll = styled.div`
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  /* 줄 높이는 **화면에서 재서** 인라인으로 덮어쓴다(위 useLayoutEffect 참고).
     여기 값은 재기 전 한 프레임용 자리표다 — 퍼센트를 써 봤지만 스크롤
     컨테이너에서는 안 풀린다. */
  grid-auto-rows: ${MIN_ROW_H}px;
  gap: ${GRID_GAP_PX}px;
  align-content: start;
  padding-right: 0.3rem;

  /* 좁아지면 한 줄에 하나 — 두 개를 억지로 밀어 넣으면 축 글씨가 겹친다 */
  @media (max-width: 720px) { grid-template-columns: 1fr; }

  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
  &::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
`;

const Mini = styled.div`
  display: flex;
  flex-direction: column;
  /* 높이는 **줄(track)이 정한다.** 여기서 못 박으면 위의 "반씩 나눠 갖기" 가
     무의미해지고 다시 아래가 빈다. min-height 0 은 안의 차트가 줄어들 수 있게. */
  height: 100%;
  min-height: 0;
  min-width: 0;
  box-sizing: border-box;
  padding: 0.4rem 0.5rem 0.3rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: #fff;
`;

const MiniHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 0;
`;

const MiniTitle = styled.div`
  font-size: 0.78rem;
  font-weight: 700;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const MiniDiv = styled.span`
  flex-shrink: 0;
  padding: 0.05rem 0.35rem;
  border-radius: 9999px;
  font-size: 0.62rem;
  font-weight: 700;
  color: #fff;
`;

/* 한 줄 요약 — 그래프를 안 읽어도 결론이 잡히게.
   지난 기록(`$stale`)은 색을 죽여 지금 값과 헷갈리지 않게 한다. */
const MiniSub = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.1rem;
  font-size: 0.68rem;
  color: ${p => (p.$stale ? '#94a3b8' : '#475569')};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
`;

const Dim = styled.span`
  color: #cbd5e1;
`;

const Gap = styled.span`
  margin-left: auto;
  padding-left: 0.3rem;
  font-weight: 700;
  color: ${p => (p.$over ? '#047857' : '#64748b')};
`;

const Rate = styled.span`
  flex-shrink: 0;
  margin-left: auto;
  padding: 0.05rem 0.4rem;
  border-radius: 9999px;
  font-size: 0.68rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: ${p => (p.$good ? '#047857' : '#b45309')};
  background: ${p => (p.$good ? '#d1fae5' : '#fef3c7')};
`;

const MiniBox = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
`;

const MiniEmpty = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  color: #cbd5e1;
`;

/* 범례 조각 — 선이 아니라 **면**이라 차트와 같은 모양으로 보여 준다.
   `$alpha` 는 16진수 두 자리로, 차트의 fillOpacity 와 눈으로 맞춰 둔 값이다. */
const Swatch = styled.span`
  width: 11px;
  height: 8px;
  border-radius: 2px;
  border: 1px solid ${p => p.$color};
  background: ${p => `${p.$color}${p.$alpha}`};
  margin-left: 0.35rem;
`;

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.85);
  color: #64748b;
  font-size: 0.8125rem;
  text-align: center;
  padding: 1rem;

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const TipBox = styled.div`
  padding: 0.4rem 0.55rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
  font-size: 0.72rem;
`;

const TipDate = styled.div`
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 0.2rem;
`;

const TipRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: #475569;
  b { margin-left: auto; color: #1e293b; font-variant-numeric: tabular-nums; }
`;

const TipDot = styled.span`
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;
`;

export default TrendView;
