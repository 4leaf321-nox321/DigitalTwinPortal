import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Trash2, Link2, AlertTriangle, Pencil, Plus, X, ChevronRight } from 'lucide-react';
import maturityApi from '../../services/maturityApi';
import { fetchProjectDetail } from '../../services/projectApi';
import { isSampleMode } from '../../sample/sampleStore';
import ProjectDetailModal from '../../../digital-twin-dashboard/components/Dashboard/ProjectDetailModal';
import PairSide from '../Pair/PairSide';

// 목록 — 왼쪽은 시험 × 시뮬레이션 표(시험 칸은 같은 것끼리 합침), 오른쪽은 고른 연계의 상세.
// (PLAN 7-5, 2026-08-28 요청)
//
//   왼쪽   1열 시험(셀 합치기) · 2열 시뮬레이션(누르면 오른쪽에 그 연계) · 끊기
//          아래에 잇기 폼. 표가 길어지면 표만 스크롤된다.
//   오른쪽 연계 상세 — 모달의 속(PairPanel)을 그대로 심는다. 모달은 안 띄운다.
//
// 시험 항목·시뮬레이션의 추가·수정·삭제와 가져오기는 **헤더 단추**가 여는 창에서 한다.
// 「전체」면 사업부별로 묶여 보이고, 잇기는 사업부를 먼저 고른다(연계은 같은 사업부끼리만).
// ⚠️ 연결을 끊으면 평가·이력이 같이 간다 — 확인 문구에 그 수를 넣는다.

const Wrap = styled.div`
  flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(30rem, 1fr) minmax(0, 1.35fr); gap: 1rem;
  @media (max-width: 1100px) { grid-template-columns: 1fr; grid-auto-rows: minmax(20rem, auto); }
`;
const Left = styled.section`
  min-height: 0; display: flex; flex-direction: column; border: 1px solid #e2e8f0; border-radius: 0.5rem; background: white; overflow: hidden;
`;
const BoxHead = styled.div`
  flex-shrink: 0; display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.75rem; background: #f8fafc;
  border-bottom: 1px solid #e2e8f0; font-size: 0.875rem; font-weight: 700; color: #1e293b;
`;
const Count = styled.span`font-size: 0.75rem; color: #94a3b8; font-weight: 400;`;
const Hint = styled.span`margin-left: auto; font-size: 0.75rem; color: #94a3b8; font-weight: 400;`;
const Scroll = styled.div`flex: 1; min-height: 0; overflow: auto;`;
const Table = styled.table`
  width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.8125rem;
  th { position: sticky; top: 0; z-index: 1; background: #f8fafc; text-align: left; font-size: 0.6875rem; font-weight: 700; color: #64748b;
       padding: 0.4rem 0.6rem; border-bottom: 1px solid #e2e8f0; }
  td { padding: 0.35rem 0.6rem; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
`;
const SubjectCell = styled.td`
  font-weight: 600; color: #1e293b; background: transparent; border-right: 1px solid #e2e8f0; vertical-align: top !important;
  /* 좁으면 줄을 바꾼다 — 연필이 칸 밖으로 밀리지 않게. 다만 **anywhere 는 안 된다** —
     최소 너비가 한 글자가 되어 좁은 화면에서 이 칸부터 짜이고 이름이 세로로 선다
     (2026-08-31, 디지털 스레드의 구간에서 드러났다). */
  overflow-wrap: break-word; min-width: 10rem;
  small { display: block; font-weight: 400; color: #94a3b8; font-size: 0.6875rem; }
  position: relative; padding-right: 1.8rem !important;
`;
// 호버하면 뜨는 연필 — 누르면 그 항목이 골라진 채 관리 창이 열린다. 칸의 클릭(연계 고르기)과는 따로.
const EditBtn = styled.button`
  position: absolute; top: 0.3rem; right: 0.3rem; border: 1px solid #e2e8f0; background: white; color: #64748b; border-radius: 0.3rem;
  width: 1.4rem; height: 1.4rem; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0;
  td:hover > & { opacity: 1; } &:hover { border-color: #1d4ed8; color: #1d4ed8; } &:focus { opacity: 1; }
`;
const GroupRow = styled.td`
  font-size: 0.6875rem; font-weight: 700; color: #1e40af; background: #eff6ff; padding: 0.3rem 0.6rem !important;
`;
const SimCell = styled.td`
  color: #1e293b; font-weight: 600; position: relative; padding-right: 1.8rem !important;
  overflow-wrap: break-word; min-width: 9rem;
  small { color: #94a3b8; font-size: 0.6875rem; margin-left: 0.4rem; }
`;
// 미평가 배지 — 티는 나되 시끄럽지 않게(호박색).
const Badge = styled.span`
  display: inline-block; margin-left: 0.4rem; padding: 0 0.45rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600;
  background: #fef3c7; color: #92400e; border: 1px solid #fde68a; vertical-align: 1px;
`;
// 시험 항목 묶음마다 얼룩말(흰색/옅은 회색) + 묶음이 바뀌는 곳은 경계선을 한 단계 진하게 — 헤더를 칠하지 않고 경계를 세운다(2026-08-28).
// 줄 전체가 눌린다 — 척도를 여는 곳이 「시뮬레이션 칸」뿐이면 아무도 못 알아챈다(2026-08-29).
// 고른 줄은 왼쪽에 파란 띠, 지나가면 옅게 물든다. 시험 칸(묶음 머리)과 단추들은 제 일을 한다.
const GroupTr = styled.tr`
  background: ${p => (p.$on ? '#eff6ff' : p.$band ? '#f8fafc' : 'white')};
  ${p => (p.$click ? 'cursor: pointer;' : '')}
  ${p => (p.$first ? '& > td { border-top: 2px solid #cbd5e1; }' : '')}
  ${p => (p.$click ? `&:hover > td { background: ${p.$on ? '#dbeafe' : '#f1f5f9'}; }` : '')}
  & > td:first-child { box-shadow: ${p => (p.$on ? 'inset 3px 0 0 #1d4ed8' : 'none')}; }
`;
// 줄 끝의 「>」 — 여기가 열린다는 표시. 지나가면 진해진다.
const Go = styled.td`
  color: ${p => (p.$on ? '#1d4ed8' : '#cbd5e1')}; text-align: right; padding-right: 0.2rem !important;
  tr:hover & { color: #1d4ed8; }
`;
const Muted = styled.td`color: #94a3b8; font-style: italic;`;
const DeptCell = styled.td`color: #475569; font-size: 0.75rem; overflow-wrap: break-word; min-width: 6rem; small { color: #cbd5e1; }`;
// 사용 툴 · 디지털 트윈 연결 과제 — 제 열로 뺐다(2026-08-29). 과제는 코드가 아니라 **이름**으로.
const ToolCell = styled.td`color: #64748b; font-size: 0.75rem; overflow-wrap: break-word; min-width: 7rem; small { color: #cbd5e1; }`;
const ProjCell = styled.td`
  small { color: #cbd5e1; font-size: 0.75rem; }
  display: flex; flex-wrap: wrap; gap: 0.2rem; align-items: center;   /* 과제가 여럿이면 배지가 줄줄이 감긴다 */
`;
// 디지털 트윈 연결 과제 — 배지로(2026-08-29). 없어진 과제는 옅은 회색 점선.
// 누르면 대시보드의 **결과 보고 화면**이 그대로 뜬다(편집 창이 아니다).
const ProjBadge = styled.button`
  display: inline-block; max-width: 100%; padding: 0.05rem 0.5rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 600;
  font-family: inherit; cursor: ${p => (p.$gone ? 'default' : 'pointer')};
  background: ${p => (p.$gone ? '#f8fafc' : '#eff6ff')}; color: ${p => (p.$gone ? '#94a3b8' : '#1e40af')};
  border: 1px ${p => (p.$gone ? 'dashed' : 'solid')} ${p => (p.$gone ? '#e2e8f0' : '#bfdbfe')};
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  &:hover:not(:disabled) { background: #dbeafe; border-color: #1d4ed8; }
`;
const Icon = styled.button`
  border: none; background: transparent; color: #94a3b8; cursor: pointer; padding: 0.15rem; border-radius: 0.25rem;
  &:hover { color: #b91c1c; background: #fef2f2; } &:disabled { opacity: 0.3; cursor: not-allowed; }
`;
const Backdrop = styled.div`position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; z-index: 60;`;
const Box = styled.div`width: min(46rem, 94vw); display: flex; flex-direction: column; gap: 0.6rem; background: white; border-radius: 0.75rem; padding: 1rem 1.25rem; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.3);`;
const Form = styled.form`display: flex; gap: 0.4rem; padding: 0.2rem 0; flex-wrap: wrap; align-items: center;`;
const Select = styled.select`padding: 0.3rem 0.45rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem; max-width: 18rem;`;
const Button = styled.button`
  padding: 0.4rem 0.8rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; background: white; color: #475569;
  font-size: 0.8125rem; font-weight: 600; font-family: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem;
  &:hover:not(:disabled) { border-color: #1d4ed8; color: #1d4ed8; } &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const Sub = styled.span`color: #94a3b8; font-size: 0.75rem; white-space: nowrap;`;
const Notice = styled.div`
  flex-shrink: 0; display: flex; gap: 0.4rem; align-items: flex-start; padding: 0.5rem 0.75rem; margin: 0.5rem 0.75rem 0; border-radius: 0.5rem;
  background: ${p => (p.$bad ? '#fef2f2' : '#fffbeb')}; border: 1px solid ${p => (p.$bad ? '#fecaca' : '#fde68a')};
  color: ${p => (p.$bad ? '#991b1b' : '#92400e')}; font-size: 0.8125rem; line-height: 1.5;
`;

const ListView = ({ divisionId, divisions = [], denyReason, axes = [], pairId, onOpenPair, onClosePair, onEditSubject, onEditAgent, onChanged, refreshKey,
                    sector = 'simulation', sectorDef = null }) => {
  // 이름표는 **부문이 정한다** — 「시험」·「시뮬레이션」은 시뮬레이션 부문의 말이다.
  const SUBJ = sectorDef?.subject_label || '시험 항목';
  const AGENT = sectorDef?.agent_label || '시뮬레이션';
  const isSim = sector === 'simulation';
  const allMode = divisionId === 'all';
  const [subjects, setSubjects] = useState([]);
  const [agents, setAgents] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [error, setError] = useState(null);
  const [link, setLink] = useState({ division_id: '', subject_id: '', agent_id: '' });
  const [linkOpen, setLinkOpen] = useState(false);   // 연계 추가는 상단 단추의 모달에서(2026-08-28)

  const canTouch = (divId) => (allMode ? !divisions.find(x => x.id === divId)?.deny_reason : !denyReason);
  // 연결 과제 배지 — 누르면 대시보드의 결과 보고 화면. 샘플 뷰에서는 부르지 않는다(개발 uuid 라 없다).
  const [project, setProject] = useState(null);
  const [projectError, setProjectError] = useState(null);
  const openProject = async (uuid) => {
    if (isSampleMode()) { setProjectError('샘플 뷰에서는 과제 보고 화면을 열 수 없습니다 — 실제 자료에서 보세요.'); return; }
    setProjectError(null);
    try { setProject(await fetchProjectDetail(uuid)); } catch (e) { setProjectError(e.message); }
  };
  const divName = (id) => divisions.find(x => x.id === id)?.name || '';

  const load = async () => {
    try {
      // 로드맵과의 어긋남은 「가져오기」 창에서만 센다 — 목록 밑의 줄은 뺐다(2026-08-28).
      const [s, a, b] = await Promise.all([
        // ⚠️ 부문을 반드시 실어 보낸다 — 안 보내면 서버가 시뮬레이션으로 답해
        //    모니터링 화면에 시험 × 시뮬레이션이 나온다(2026-08-30).
        maturityApi.listSubjects(divisionId, sector), maturityApi.listAgents(divisionId, sector),
        maturityApi.getBoard(divisionId, sector),
      ]);
      setSubjects(s.data); setAgents(a.data);
      setPairs(allMode
        ? b.data.boards.flatMap(x => x.subjects.flatMap(sub => sub.pairs.map(p => ({ ...p, division_id: x.division_id }))))
        : b.data.subjects.flatMap(x => x.pairs.map(p => ({ ...p, division_id: divisionId }))));
      setError(null);
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { if (divisionId) load(); }, [divisionId, sector, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn) => { try { await fn(); load(); if (onChanged) onChanged(); } catch (e) { setError(e.message); } };

  // 표의 줄 — 시험마다 그 연계들. 연계 없는 시험도 한 줄 차지한다(잇는 것을 잊지 않게).
  const rows = useMemo(() => {
    const bySubject = {};
    pairs.forEach(p => { (bySubject[p.subject_id] = bySubject[p.subject_id] || []).push(p); });
    const order = divisions.map(x => x.id);
    const list = [...subjects].sort((a, b) => (allMode ? order.indexOf(a.division_id) - order.indexOf(b.division_id) : 0) || (a.order ?? 0) - (b.order ?? 0) || a.id - b.id);
    return list.map(s => ({ subject: s, pairs: bySubject[s.id] || [] }));
  }, [subjects, pairs, divisions, allMode]);

  // 잇기 — 전체면 사업부를 먼저 고른다. 이미 이어진 짝은 목록에서 뺀다.
  const linkDivision = allMode ? Number(link.division_id) || null : divisionId;
  const linkSubjects = useMemo(() => subjects.filter(s => !allMode || s.division_id === linkDivision), [subjects, allMode, linkDivision]);
  const linkAgents = useMemo(() => agents.filter(a => !allMode || a.division_id === linkDivision), [agents, allMode, linkDivision]);
  const linkedAgents = useMemo(() => new Set(
    pairs.filter(p => String(p.subject_id) === link.subject_id).map(p => p.agent_id)), [pairs, link.subject_id]);
  const canLink = linkDivision != null && canTouch(linkDivision);
  const touchable = divisions.filter(x => !x.deny_reason);

  const cut = (p) => {
    const n = Object.values(p.assessments).filter(Boolean).length;
    if (window.confirm(`연결을 끊습니다. 평가 ${n}건과 이력이 같이 사라집니다.`)) {
      run(() => maturityApi.deletePair(p.id));
      if (pairId === p.id && onClosePair) onClosePair();
    }
  };

  let lastDiv = null;
  return (
    <Wrap>
      <Left>
        <BoxHead>
          <Link2 size={14} /> {SUBJ} × {AGENT} <Count>연계 {pairs.length}</Count>
          {(allMode ? touchable.length > 0 : !denyReason) && (
            <Button type="button" onClick={() => setLinkOpen(true)} style={{ marginLeft: '0.5rem', background: '#1d4ed8', borderColor: '#1d4ed8', color: 'white' }}><Plus size={13} /> 연계 추가</Button>
          )}
          <Hint>{SUBJ} {subjects.length} · {AGENT} {agents.length} — 줄을 누르면 오른쪽에 평가 척도가 열립니다</Hint>
        </BoxHead>
        {error && <Notice $bad><AlertTriangle size={14} /> <span>{error}</span></Notice>}
        {projectError && (
          <Notice><AlertTriangle size={14} /> <span>{projectError}</span>
            <Icon type="button" title="닫기" onClick={() => setProjectError(null)} style={{ marginLeft: 'auto' }}><X size={14} /></Icon>
          </Notice>
        )}
        {!allMode && denyReason && <Notice><AlertTriangle size={14} /> <span>{denyReason} 조회는 그대로 하실 수 있습니다.</span></Notice>}
        <Scroll>
          <Table>
            <thead><tr>
              <th style={{ width: '20%' }}>{SUBJ}</th><th style={{ width: '20%' }}>{AGENT}</th>
              <th style={{ width: '16%' }}>사용 툴</th><th style={{ width: '11%' }}>담당 부서</th>
              <th style={{ width: '29%' }}>디지털 트윈 연결 과제</th><th style={{ width: '1.2rem' }} /><th style={{ width: '2.5rem' }} />
            </tr></thead>
            <tbody>
              {rows.length === 0 && <tr><Muted colSpan={7}>아직 {SUBJ}이 없습니다. 헤더의 「{SUBJ} 관리」{isSim ? '나 「가져오기」' : ''}로 넣으세요.</Muted></tr>}
              {rows.map(({ subject: s, pairs: ps }, gi) => {
                const groupRow = allMode && s.division_id !== lastDiv
                  ? <tr key={`g-${s.division_id}`}><GroupRow colSpan={7}>{divName(s.division_id)}</GroupRow></tr>
                  : null;
                lastDiv = s.division_id;
                const span = Math.max(1, ps.length);
                const cell = (
                  <SubjectCell rowSpan={span} onClick={e => e.stopPropagation()}>
                    {s.name}
                    {onEditSubject && (
                      <EditBtn type="button" title={`${SUBJ} 관리에서 열기`} aria-label={`${s.name} 편집`}
                               onClick={e => { e.stopPropagation(); onEditSubject(s.id); }}><Pencil size={11} /></EditBtn>
                    )}
                  </SubjectCell>
                );
                if (ps.length === 0) {
                  return (
                    <React.Fragment key={s.id}>
                      {groupRow}
                      <GroupTr $band={gi % 2 === 1} $first>{cell}<Muted colSpan={5}>아직 이은 {AGENT}이 없습니다.</Muted><td /></GroupTr>
                    </React.Fragment>
                  );
                }
                return (
                  <React.Fragment key={s.id}>
                    {groupRow}
                    {ps.map((p, i) => (
                      <GroupTr key={p.id} $band={gi % 2 === 1} $first={i === 0} $on={p.id === pairId} $click
                               onClick={() => onOpenPair(p.id)} title="누르면 오른쪽에 이 연계의 평가 척도가 나옵니다">
                        {i === 0 && cell}
                        <SimCell>
                          {p.agent?.name}
                          {p.unassessed.length > 0 && <Badge title={`아직 안 매긴 축: ${p.unassessed.length}`}>미평가 {p.unassessed.length}개</Badge>}
                          {onEditAgent && (
                            <EditBtn type="button" title={`${AGENT} 관리에서 열기`} aria-label={`${p.agent?.name} 편집`}
                                     onClick={e => { e.stopPropagation(); onEditAgent(p.agent_id); }}><Pencil size={11} /></EditBtn>
                          )}
                        </SimCell>
                        <ToolCell title={(p.agent?.tools || []).join(' · ')}>
                          {(p.agent?.tools || []).length > 0 ? p.agent.tools.join(', ') : <small>—</small>}
                        </ToolCell>
                        <DeptCell>{p.agent?.department_name || <small>—</small>}</DeptCell>
                        <ProjCell>
                          {(p.agent?.projects || []).length > 0
                            ? p.agent.projects.map(x => (
                              <ProjBadge key={x.uuid} type="button" $gone={!x.title} disabled={!x.title}
                                         title={`${x.code ? `${x.code} · ` : ''}${x.title || '없어진 과제'}${x.year ? ` · ${x.year}` : ''}${x.status ? ` · ${x.status}` : ''} — 누르면 과제 보고 화면`}
                                         onClick={e => { e.stopPropagation(); openProject(x.uuid); }}>
                                {x.title || '없어진 과제'}
                              </ProjBadge>))
                            : <small>—</small>}
                        </ProjCell>
                        <Go $on={p.id === pairId}><ChevronRight size={14} /></Go>
                        <td>
                          <Icon disabled={!canTouch(p.division_id)} title="연결 끊기 — 평가·이력이 같이 사라집니다"
                                onClick={e => { e.stopPropagation(); cut(p); }}>
                            <Trash2 size={14} />
                          </Icon>
                        </td>
                      </GroupTr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </Table>
        </Scroll>
      </Left>

      <PairSide pairId={pairId} axes={axes} onChanged={() => { load(); if (onChanged) onChanged(); }} onClose={onClosePair} />
      {linkOpen && (allMode ? touchable.length > 0 : !denyReason) && (
        <Backdrop onClick={() => setLinkOpen(false)}>
          <Box onClick={e => e.stopPropagation()} role="dialog" aria-label="연계 추가">
          <BoxHead><Link2 size={14} /> 연계 추가 — {SUBJ} × {AGENT}<span style={{ flex: 1 }} /><Icon type="button" onClick={() => setLinkOpen(false)} aria-label="닫기" title="닫기" style={{ color: '#64748b' }}><X size={16} /></Icon></BoxHead>
          <Form onSubmit={e => { e.preventDefault(); if (!canLink || !link.subject_id || !link.agent_id) return;
            run(async () => { await maturityApi.createPair(Number(link.subject_id), Number(link.agent_id)); setLink(l => ({ ...l, subject_id: '', agent_id: '' })); setLinkOpen(false); }); }}>
            {allMode && (
              <Select value={link.division_id} onChange={e => setLink({ division_id: e.target.value, subject_id: '', agent_id: '' })}>
                <option value="">사업부</option>
                {touchable.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
            )}
            <Select value={link.subject_id} disabled={allMode && !linkDivision}
                    onChange={e => setLink(l => ({ ...l, subject_id: e.target.value, agent_id: '' }))}>
              <option value="">{SUBJ}</option>
              {linkSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <span>×</span>
            <Select value={link.agent_id} disabled={!link.subject_id}
                    onChange={e => setLink(l => ({ ...l, agent_id: e.target.value }))}>
              <option value="">{AGENT}</option>
              {/* 이미 연계된 것도 **남겨 두되 고를 수 없게** 한다(2026-08-30) — 목록에서 사라지면
                  왜 없는지 알 길이 없어 「공정마다 고를 수 있는 수단이 다르다」로 잘못 읽힌다.
                  규칙은 하나뿐이다: 같은 짝을 두 번 잇지 않는다(평가가 두 벌 생긴다). */}
              {linkAgents.map(a => (
                <option key={a.id} value={a.id} disabled={linkedAgents.has(a.id)}>
                  {a.name}{linkedAgents.has(a.id) ? ' — 연계 완료' : ''}
                </option>
              ))}
            </Select>
            <Button type="submit" disabled={!canLink || !link.subject_id || !link.agent_id}><Link2 size={13} /> 잇기</Button>
            {allMode && <Sub>연계는 같은 사업부끼리만 잇습니다.</Sub>}
          </Form>
          </Box>
        </Backdrop>
      )}

      {/* 연결 과제의 결과 보고 화면 — 대시보드의 것을 그대로 띄운다(읽기 전용) */}
      {project && <ProjectDetailModal project={project} onClose={() => setProject(null)} />}
    </Wrap>
  );
};

export default ListView;
