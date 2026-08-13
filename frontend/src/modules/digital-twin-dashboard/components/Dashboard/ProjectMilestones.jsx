/**
 * 액션아이템 마일스톤 타임라인 — **결과 보고서와 '모든 과제 현황' 상세 보기가 같이 쓴다.**
 *
 * 왜 하나로 합쳤나
 *     상세 보기는 액션아이템을 **체크 목록**으로, 보고서는 **가로 타임라인**으로 그렸다.
 *     같은 값을 두 양식으로 보여주면 사람이 다른 것으로 읽는다 — 2026-08-08 에
 *     보고서 쪽 양식으로 합쳤다.
 *
 * 무엇을 보여주나
 *     · 점 = 액션아이템 하나. 채워진 점이 완료
 *     · 가로 막대 = **마지막 완료 지점까지**의 진행(항목 순서 기준)
 *     · 아래에 제목·목표일·완료일
 *
 * ⚠️ 여기 진행률(`x/y (z%)`)은 **액티비티(세부항목) 단위**로 센다 — 액션아이템만 세면
 *    "5개 중 2개" 처럼 굵게 나와서 과제 진척률(서버가 파생시키는 값)과 어긋나 보인다.
 * ⚠️ 항목이 많으면 가로로 길어진다. 감싸는 쪽이 `overflow-x: auto` 를 갖고 있다.
 */
import React from 'react';
import styled from 'styled-components';
import { Clock, CheckCircle2 } from 'lucide-react';

/** 액티비티까지 세는 진행률. 액티비티가 없는 항목은 그 자체로 1건. */
export const getActionItemProgress = (project) => {
  const items = project?.액션아이템목록 || [];
  if (items.length === 0) return { total: 0, completed: 0, rate: 0 };
  let total = 0;
  let completed = 0;
  items.forEach((item) => {
    const details = item.세부항목목록 || [];
    if (details.length > 0) {
      total += details.length;
      completed += details.filter((d) => d.완료여부).length;
    } else {
      total += 1;
      completed += item.완료여부 ? 1 : 0;
    }
  });
  return { total, completed, rate: total ? Math.round((completed / total) * 100) : 0 };
};

/** `2026-03-31` → `3/31`. 화면이 좁아 연도는 뺀다(과제년도가 위에 있다). */
const formatDate = (d) => {
  if (!d) return null;
  const parts = String(d).split('-');
  if (parts.length >= 3) return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
  if (parts.length === 2) return `${parseInt(parts[0], 10)}/${parseInt(parts[1], 10)}`;
  return d;
};

const ProjectMilestones = ({ project }) => {
  const items = project?.액션아이템목록 || [];
  if (items.length === 0) return null;

  // 막대는 **마지막으로 완료된 항목**까지 채운다 — 중간에 건너뛴 완료가 있어도
  // "여기까지 왔다" 를 보여주는 것이 이 그림의 뜻이다.
  let lastCompletedIdx = -1;
  items.forEach((item, i) => { if (item.완료여부) lastCompletedIdx = i; });
  const fillPercent = items.length <= 1
    ? (lastCompletedIdx >= 0 ? 100 : 0)
    : ((lastCompletedIdx + 1) / items.length) * 100;

  return (
    <MilestoneWrapper>
      {/*
        점과 이름을 **한 격자 안에** 넣는다. 칸을 나누는 규칙이 하나뿐이라
        어긋날 수가 없다. (왜 이렇게 하는지는 아래 `MilestoneGrid` 주석 참고)
      */}
      <MilestoneGrid $count={items.length}>
        <MilestoneTrackCell>
          <MilestoneTrack $count={items.length}>
            <MilestoneTrackFill $percent={fillPercent} />
          </MilestoneTrack>
        </MilestoneTrackCell>

        {items.map((item, idx) => (
          <MilestoneDotCell key={`dot-${idx}`} $col={idx + 1}>
            <MilestoneDot $completed={item.완료여부} />
          </MilestoneDotCell>
        ))}

        {items.map((item, idx) => {
          const targetDate = formatDate(item.목표일);
          const completedDate = formatDate(item.완료일);
          return (
            <MilestoneContent key={`body-${idx}`} $col={idx + 1}>
              <MilestoneConnector $completed={item.완료여부} />
              <MilestoneName $completed={item.완료여부}>
                {item.제목 || `액션아이템 ${idx + 1}`}
              </MilestoneName>
              <MilestoneDates>
                {targetDate && (
                  <MilestoneDateTag $type="target">
                    <Clock size={10} />
                    목표 {targetDate}
                  </MilestoneDateTag>
                )}
                {completedDate && item.완료여부 && (
                  <MilestoneDateTag $type="completed">
                    <CheckCircle2 size={10} />
                    완료 {completedDate}
                  </MilestoneDateTag>
                )}
                {!item.완료여부 && !targetDate && (
                  <MilestoneDateTag $type="pending">진행중</MilestoneDateTag>
                )}
              </MilestoneDates>
            </MilestoneContent>
          );
        })}
      </MilestoneGrid>
    </MilestoneWrapper>
  );
};

/* ── 스타일 — **보고서에서 그대로 옮겨온 것이다.** 여기를 고치면 보고서도 바뀐다. ── */

export const MilestoneBadge = styled.span`
  margin-left: 0.5rem;
  font-size: 0.7rem;
  padding: 0.125rem 0.5rem;
  background: #e0e7ff;
  color: #4338ca;
  border-radius: 9999px;
  font-weight: 600;
  vertical-align: middle;
`;

const MilestoneWrapper = styled.div`
  overflow-x: auto;
  padding: 0.25rem 0;
`;

/*
  점(1행)과 이름(2행)을 담는 **하나의** 격자.

  🐞 예전에는 격자가 둘이었다 — 점줄과 이름줄이 각각 `repeat(N, 1fr)` 을 따로 폈다.
     `1fr` 의 최소폭은 **그 칸 안의 내용**이 정한다(`minmax(auto, 1fr)`). 점줄의 내용은
     20px 짜리 점이고 이름줄의 내용은 제목 글자와 `white-space: nowrap` 인 날짜 꼬리표라,
     칸이 좁아지면 두 격자가 **서로 다른 폭**으로 자리를 잡는다.
     항목이 적을 때는 자리가 남아 티가 안 나다가, 마일스톤이 많아져 폭이 모자라는
     순간부터 점과 이름이 어긋난다.

  이제 한 격자에 두 줄을 넣고 칸 번호를 **직접 지정**한다. 칸을 나누는 규칙이 하나뿐이니
  어긋날 수가 없다 — 폭이 얼마든, 항목이 몇 개든.

  `minmax(...)` 로 최소폭을 못 박는 것도 같은 이유다. 날짜 꼬리표는 안 줄어들므로,
  자리가 모자라면 칸을 찌그러뜨리는 대신 **가로로 넘겨** 감싸는 쪽이 굴리게 둔다.
*/
const MIN_COL = '6.5rem';   // 「목표 3/31」 꼬리표가 안 눌리는 최소 폭

const MilestoneGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(${props => props.$count}, minmax(${MIN_COL}, 1fr));
  grid-template-rows: auto auto;
  position: relative;
`;

/* 가로 바가 놓일 자리 — 1행 전체를 덮는다(점과 같은 줄). */
const MilestoneTrackCell = styled.div`
  grid-row: 1;
  grid-column: 1 / -1;
  position: relative;
`;

/* 가로 바: 첫 점 중심 ~ 마지막 점 중심 */
const MilestoneTrack = styled.div`
  position: absolute;
  top: 50%;
  left: calc(100% / ${props => props.$count} / 2);
  right: calc(100% / ${props => props.$count} / 2);
  height: 4px;
  transform: translateY(-50%);
  background: #e2e8f0;
  border-radius: 2px;
`;

const MilestoneTrackFill = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: ${props => props.$percent}%;
  background: linear-gradient(90deg, #16a34a 0%, #86efac 100%);
  border-radius: 2px;
  transition: width 0.3s ease;
`;

const MilestoneDotCell = styled.div`
  grid-row: 1;
  grid-column: ${props => props.$col};
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  z-index: 2;
  padding: 0.5rem 0;
`;

const MilestoneDot = styled.div`
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: ${props => props.$completed ? '#16a34a' : 'white'};
  border: 3px solid ${props => props.$completed ? '#16a34a' : '#cbd5e1'};
  box-shadow: ${props => props.$completed
    ? '0 0 0 3px rgba(22, 163, 106, 0.15)'
    : '0 0 0 3px rgba(203, 213, 225, 0.2)'};
`;

/* 점 아래 내용 — **같은 격자의 2행**이다. 칸 번호를 점과 똑같이 준다. */
const MilestoneContent = styled.div`
  grid-row: 2;
  grid-column: ${props => props.$col};
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0 0.375rem;
  min-width: 0;          /* 긴 제목이 칸을 밀어내지 않게 */
`;

const MilestoneConnector = styled.div`
  width: 2px;
  height: 14px;
  background: ${props => props.$completed ? '#86efac' : '#e2e8f0'};
  margin-bottom: 0.375rem;
`;

const MilestoneName = styled.div`
  font-size: 0.78rem;
  font-weight: 600;
  color: ${props => props.$completed ? '#16a34a' : '#1e293b'};
  line-height: 1.35;
  word-break: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
  max-width: 100%;
  margin-bottom: 0.25rem;
`;

const MilestoneDates = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
`;

const MilestoneDateTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.125rem 0.45rem;
  border-radius: 9999px;
  font-size: 0.65rem;
  font-weight: 600;
  white-space: nowrap;
  background: ${props => {
    if (props.$type === 'completed') return '#dcfce7';
    if (props.$type === 'target') return '#e0e7ff';
    return '#f3f4f6';
  }};
  color: ${props => {
    if (props.$type === 'completed') return '#16a34a';
    if (props.$type === 'target') return '#4f46e5';
    return '#64748b';
  }};
`;

export default ProjectMilestones;
