import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import styled from 'styled-components';

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

const formatScheduleDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dayName = DAY_NAMES[d.getDay()];
  return `${month}/${day} (${dayName})`;
};

const getWeekNumber = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  const oneJan = new Date(d.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((d - oneJan) / 86400000) + 1;
  return Math.ceil((dayOfYear + oneJan.getDay()) / 7);
};

// Stable color palette for matched agenda groups
const LINK_COLORS = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#6366f1', '#14b8a6', '#f97316',
];

// ============== Styled Components ==============

const Wrapper = styled.div`
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0;
  height: calc(100vh - 200px);
`;

const HeaderRow = styled.div`
  display: flex;
  gap: 0;
  flex-shrink: 0;
  margin-bottom: 0.75rem;
`;

const HeaderCell = styled.div`
  flex: 1;
  min-width: 0;
`;

const HeaderSpacer = styled.div`
  width: 120px;
  min-width: 120px;
  flex-shrink: 0;
`;

const DiagramScrollArea = styled.div`
  flex: 1;
  overflow-y: auto;
  min-height: 0;
`;

const DiagramArea = styled.div`
  display: flex;
  gap: 0;
  position: relative;
  align-items: flex-start;
`;

const SidePanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
`;

const SidePanelHeader = styled.div`
  text-align: center;
  font-size: 0.95rem;
  font-weight: 700;
  color: ${props => props.$color || '#475569'};
  padding: 0.5rem;
  background: ${props => props.$bg || '#f8fafc'};
  border-radius: 0.5rem;
  border: 1px solid ${props => props.$borderColor || '#e2e8f0'};
`;

const MiddleCanvas = styled.div`
  width: 120px;
  min-width: 120px;
  position: relative;
  flex-shrink: 0;
`;

const SvgOverlay = styled.svg`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  pointer-events: none;
`;

const RoundCard = styled.div`
  background: white;
  border-radius: 0.5rem;
  border: 1px solid #e2e8f0;
  overflow: hidden;
`;

const RoundHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background: ${props => props.$bg || '#f8f7ff'};
  border-bottom: 1px solid #e2e8f0;
`;

const RoundBadge = styled.span`
  font-weight: 700;
  font-size: 0.9rem;
  color: ${props => props.$color || '#7c3aed'};
`;

const RoundMeta = styled.span`
  font-size: 0.8rem;
  color: #64748b;
`;

const AgendaRow = styled.div`
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;

  &:last-child {
    border-bottom: none;
  }
`;

const AgendaCategory = styled.span`
  font-size: 0.78rem;
  font-weight: 600;
  color: #94a3b8;
`;

const AgendaText = styled.div`
  font-size: 0.9rem;
  color: #334155;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
`;

const MatchDot = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.$color};
  margin-right: 0.375rem;
  flex-shrink: 0;
`;

const AgendaTextRow = styled.div`
  display: flex;
  align-items: flex-start;
`;

const EmptyMessage = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
  font-size: 0.95rem;
`;

/* ── Timeline row ── */

const TimelineRow = styled.div`
  display: flex;
  gap: 0;
  align-items: stretch;
  min-height: ${props => props.$minHeight || 'auto'};
`;

const TimelineCell = styled.div`
  flex: 1;
  min-width: 0;
  padding: 0.375rem 0;
`;

const TimelineMiddle = styled.div`
  width: 120px;
  min-width: 120px;
  flex-shrink: 0;
  position: relative;
`;

const DateLabel = styled.div`
  font-size: 0.7rem;
  color: #94a3b8;
  text-align: center;
  padding: 0.25rem 0;
  font-weight: 500;
`;

const EmptySlot = styled.div`
  min-height: 2.5rem;
`;

// ============== Component ==============

const ReportPlanCrossView = ({ ceoRounds, cfoRounds, issueRounds }) => {
  const canvas1Ref = useRef(null); // ceo ↔ cfo
  const canvas2Ref = useRef(null); // cfo ↔ issue
  const diagramRef = useRef(null);
  const ceoRefs = useRef({});
  const cfoRefs = useRef({});
  const issueRefs = useRef({});
  const [lines1, setLines1] = useState([]);
  const [lines2, setLines2] = useState([]);
  const [canvasHeight, setCanvasHeight] = useState(400);

  // Find agendas matching across any two of the three tabs.
  // Match dot/line colors are reused across panels, so an agenda that appears
  // in all three is colored the same in every panel.
  const { matches, matchColorMap } = useMemo(() => {
    const matchMap = new Map();
    const sources = [
      { rounds: ceoRounds, key: 'ceo' },
      { rounds: cfoRounds, key: 'cfo' },
      { rounds: issueRounds, key: 'issue' },
    ];

    sources.forEach(({ rounds, key }) => {
      (rounds || []).forEach((round, ri) => {
        round.items.forEach((item, ii) => {
          if (item.agenda && item.agenda.trim()) {
            const k = item.agenda.trim();
            if (!matchMap.has(k)) matchMap.set(k, { ceo: [], cfo: [], issue: [] });
            matchMap.get(k)[key].push({ ri, ii });
          }
        });
      });
    });

    const crossMatches = [];
    const colorMap = new Map();
    let colorIdx = 0;

    matchMap.forEach((val, agendaText) => {
      const presence =
        (val.ceo.length > 0 ? 1 : 0) +
        (val.cfo.length > 0 ? 1 : 0) +
        (val.issue.length > 0 ? 1 : 0);
      if (presence >= 2) {
        const color = LINK_COLORS[colorIdx % LINK_COLORS.length];
        crossMatches.push({
          agendaText,
          ceo: val.ceo,
          cfo: val.cfo,
          issue: val.issue,
          color,
        });
        colorMap.set(agendaText, color);
        colorIdx++;
      }
    });

    return { matches: crossMatches, matchColorMap: colorMap };
  }, [ceoRounds, cfoRounds, issueRounds]);

  // Build date-aligned timeline rows for 3 columns
  const timelineRows = useMemo(() => {
    const indexByDate = (rounds, sideKey) => {
      const out = {};
      (rounds || []).forEach((r, ri) => {
        const key = r.schedule || `_no_date_${sideKey}_${ri}`;
        if (!out[key]) out[key] = [];
        out[key].push({ round: r, ri });
      });
      return out;
    };

    const ceoByDate = indexByDate(ceoRounds, 'ceo');
    const cfoByDate = indexByDate(cfoRounds, 'cfo');
    const issueByDate = indexByDate(issueRounds, 'issue');

    const allDates = new Set();
    [ceoRounds, cfoRounds, issueRounds].forEach(arr => {
      (arr || []).forEach(r => { if (r.schedule) allDates.add(r.schedule); });
    });
    const sortedDates = [...allDates].sort();

    const undated = (rounds) =>
      (rounds || [])
        .map((r, ri) => ({ round: r, ri }))
        .filter(x => !x.round.schedule);
    const undatedCeo = undated(ceoRounds);
    const undatedCfo = undated(cfoRounds);
    const undatedIssue = undated(issueRounds);

    const rows = [];

    sortedDates.forEach(date => {
      const ceoList = ceoByDate[date] || [];
      const cfoList = cfoByDate[date] || [];
      const issueList = issueByDate[date] || [];
      const maxLen = Math.max(ceoList.length, cfoList.length, issueList.length);
      for (let i = 0; i < maxLen; i++) {
        rows.push({
          date,
          ceo: ceoList[i] || null,
          cfo: cfoList[i] || null,
          issue: issueList[i] || null,
          showDate: i === 0,
        });
      }
    });

    const maxUndated = Math.max(undatedCeo.length, undatedCfo.length, undatedIssue.length);
    for (let i = 0; i < maxUndated; i++) {
      rows.push({
        date: null,
        ceo: undatedCeo[i] || null,
        cfo: undatedCfo[i] || null,
        issue: undatedIssue[i] || null,
        showDate: i === 0,
      });
    }

    return rows;
  }, [ceoRounds, cfoRounds, issueRounds]);

  // Compute SVG lines for both connector canvases
  const computeLines = useCallback(() => {
    if (diagramRef.current) {
      setCanvasHeight(diagramRef.current.scrollHeight);
    }

    const computeFor = (canvasEl, leftRefsObj, leftPrefix, leftPositions, rightRefsObj, rightPrefix, rightPositions, color) => {
      if (!canvasEl) return [];
      const canvasRect = canvasEl.getBoundingClientRect();
      const out = [];
      leftPositions.forEach(lp => {
        const leftEl = leftRefsObj.current[`${leftPrefix}-${lp.ri}-${lp.ii}`];
        if (!leftEl) return;
        rightPositions.forEach(rp => {
          const rightEl = rightRefsObj.current[`${rightPrefix}-${rp.ri}-${rp.ii}`];
          if (!rightEl) return;
          const leftRect = leftEl.getBoundingClientRect();
          const rightRect = rightEl.getBoundingClientRect();
          const y1 = leftRect.top + leftRect.height / 2 - canvasRect.top;
          const y2 = rightRect.top + rightRect.height / 2 - canvasRect.top;
          out.push({ y1, y2, color });
        });
      });
      return out;
    };

    const c1 = canvas1Ref.current;
    const c2 = canvas2Ref.current;
    const newLines1 = [];
    const newLines2 = [];

    matches.forEach(({ ceo, cfo, issue, color }) => {
      newLines1.push(...computeFor(c1, ceoRefs, 'ceo', ceo, cfoRefs, 'cfo', cfo, color));
      newLines2.push(...computeFor(c2, cfoRefs, 'cfo', cfo, issueRefs, 'issue', issue, color));
    });

    setLines1(newLines1);
    setLines2(newLines2);
  }, [matches]);

  useEffect(() => {
    const timer = setTimeout(computeLines, 100);
    window.addEventListener('resize', computeLines);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', computeLines);
    };
  }, [computeLines, ceoRounds, cfoRounds, issueRounds]);

  const allEmpty =
    (!ceoRounds || ceoRounds.length === 0) &&
    (!cfoRounds || cfoRounds.length === 0) &&
    (!issueRounds || issueRounds.length === 0);

  if (allEmpty) {
    return (
      <Wrapper>
        <EmptyMessage>모든 탭에 데이터가 없습니다.</EmptyMessage>
      </Wrapper>
    );
  }

  const renderRoundCard = (entry, side, accentColor, accentBg) => {
    if (!entry) return <EmptySlot />;
    const { round, ri } = entry;
    const refsObj =
      side === 'ceo' ? ceoRefs :
      side === 'cfo' ? cfoRefs :
      issueRefs;

    const roundLabel = side === 'cfo'
      ? `${getWeekNumber(round.schedule) ? getWeekNumber(round.schedule) + '주차 주간회의' : '주간회의 날짜 미정'}`
      : `${round.roundNumber}회차`;

    return (
      <RoundCard>
        <RoundHeader $bg={accentBg}>
          <RoundBadge $color={accentColor}>{roundLabel}</RoundBadge>
          <RoundMeta>
            {round.schedule ? formatScheduleDate(round.schedule) : '일정 미정'}
          </RoundMeta>
        </RoundHeader>
        {round.items.map((item, ii) => {
          if (!item.agenda) return null;
          const refKey = `${side}-${ri}-${ii}`;
          const matchColor = matchColorMap.get(item.agenda?.trim());

          return (
            <AgendaRow
              key={item.id}
              ref={el => { refsObj.current[refKey] = el; }}
            >
              {item.category && (
                <AgendaCategory>{item.category}</AgendaCategory>
              )}
              <AgendaTextRow>
                {matchColor && <MatchDot $color={matchColor} />}
                <AgendaText>{item.agenda}</AgendaText>
              </AgendaTextRow>
            </AgendaRow>
          );
        })}
      </RoundCard>
    );
  };

  const renderConnectorCanvas = (canvasRef, lines) => (
    <MiddleCanvas ref={canvasRef}>
      {timelineRows.map((_, idx) => (
        <TimelineMiddle key={`mid-${idx}`} />
      ))}
      <SvgOverlay style={{ height: canvasHeight }}>
        {lines.map((line, i) => {
          const midX = 60;
          return (
            <path
              key={i}
              d={`M 0 ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, 120 ${line.y2}`}
              fill="none"
              stroke={line.color}
              strokeWidth="2"
              strokeOpacity="0.6"
            />
          );
        })}
      </SvgOverlay>
    </MiddleCanvas>
  );

  return (
    <Wrapper>
      {/* 고정 헤더 */}
      <HeaderRow>
        <HeaderCell>
          <SidePanelHeader $color="#7c3aed" $bg="#f5f3ff" $borderColor="#ddd6fe">
            대표 이사 협의체
          </SidePanelHeader>
        </HeaderCell>
        <HeaderSpacer />
        <HeaderCell>
          <SidePanelHeader $color="#0369a1" $bg="#f0f9ff" $borderColor="#bae6fd">
            CFO 주간 회의
          </SidePanelHeader>
        </HeaderCell>
        <HeaderSpacer />
        <HeaderCell>
          <SidePanelHeader $color="#9d174d" $bg="#fdf2f8" $borderColor="#fbcfe8">
            DX 디지털 트윈 이슈 점검 회의
          </SidePanelHeader>
        </HeaderCell>
      </HeaderRow>

      {/* 스크롤 영역 */}
      <DiagramScrollArea>
        <DiagramArea ref={diagramRef}>
          <SidePanel>
            {timelineRows.map((row, idx) => (
              <TimelineCell key={`ceo-${idx}`}>
                {renderRoundCard(row.ceo, 'ceo', '#7c3aed', '#f8f7ff')}
              </TimelineCell>
            ))}
          </SidePanel>

          {renderConnectorCanvas(canvas1Ref, lines1)}

          <SidePanel>
            {timelineRows.map((row, idx) => (
              <TimelineCell key={`cfo-${idx}`}>
                {renderRoundCard(row.cfo, 'cfo', '#0369a1', '#f0f9ff')}
              </TimelineCell>
            ))}
          </SidePanel>

          {renderConnectorCanvas(canvas2Ref, lines2)}

          <SidePanel>
            {timelineRows.map((row, idx) => (
              <TimelineCell key={`issue-${idx}`}>
                {renderRoundCard(row.issue, 'issue', '#9d174d', '#fdf2f8')}
              </TimelineCell>
            ))}
          </SidePanel>
        </DiagramArea>
      </DiagramScrollArea>
    </Wrapper>
  );
};

export default ReportPlanCrossView;
