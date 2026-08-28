import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { X, Check, Search } from 'lucide-react';
import maturityApi from '../../services/maturityApi';

// 수행 디지털 트윈 과제 고르기 창(2026-08-29) — 칸 옆 드롭다운은 후보 둘만 띄우고,
// 「상세」로 이 창을 열어 **과제 목록을 사업부·프로세스·글자로 좁혀** 고른다.
// 여럿을 한꺼번에 골라 담는다(고른 것은 위에 칩으로). 이미 매단 것은 「매달림」으로 표시.

const Backdrop = styled.div`position: fixed; inset: 0; background: rgba(15, 23, 42, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 1.5rem;`;
const Box = styled.div`width: min(76rem, 96vw); height: min(46rem, 92vh); background: white; border-radius: 0.75rem; box-shadow: 0 20px 60px rgba(15,23,42,0.3); display: flex; flex-direction: column; overflow: hidden;`;
const Head = styled.div`display: flex; align-items: center; gap: 0.5rem; padding: 0.8rem 1.1rem; border-bottom: 1px solid #e2e8f0; h3 { margin: 0; font-size: 1rem; color: #1e293b; flex: 1; } small { color: #94a3b8; font-size: 0.75rem; }`;
const IconBtn = styled.button`border: none; background: transparent; color: #64748b; cursor: pointer; padding: 0.25rem; border-radius: 0.3rem; &:hover { background: #f1f5f9; }`;
const Bar = styled.div`display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; padding: 0.6rem 1.1rem; border-bottom: 1px solid #e2e8f0; background: #f8fafc;
  select, input { padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem; background: white; }
  input { flex: 1; min-width: 12rem; }
`;
const Picked = styled.div`display: flex; flex-wrap: wrap; gap: 0.3rem; padding: 0.5rem 1.1rem; border-bottom: 1px solid #e2e8f0; min-height: 2.4rem; align-items: center;`;
const Chip = styled.span`display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.55rem; border-radius: 999px; background: #dbeafe; color: #1e40af; font-size: 0.75rem; font-weight: 600;
  button { border: none; background: transparent; color: inherit; cursor: pointer; display: inline-flex; padding: 0; }
`;
const Scroll = styled.div`flex: 1; min-height: 0; overflow: auto;`;
const Table = styled.table`width: 100%; border-collapse: collapse; font-size: 0.8125rem;
  th { position: sticky; top: 0; background: #f8fafc; z-index: 1; text-align: left; font-size: 0.6875rem; color: #64748b; font-weight: 700; padding: 0.4rem 0.6rem; border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
  td { padding: 0.35rem 0.6rem; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
  tbody tr { cursor: pointer; }
  tbody tr:hover { background: #f8fafc; }
`;
const Mark = styled.span`display: inline-flex; width: 1rem; height: 1rem; border-radius: 0.25rem; border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#cbd5e1')}; background: ${p => (p.$on ? '#1d4ed8' : 'white')}; color: white; align-items: center; justify-content: center;`;
const Foot = styled.div`display: flex; gap: 0.5rem; align-items: center; padding: 0.6rem 1.1rem; border-top: 1px solid #e2e8f0; background: #f8fafc;`;
const Button = styled.button`padding: 0.35rem 0.9rem; border: 1px solid ${p => (p.$primary ? '#1d4ed8' : '#cbd5e1')}; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer;
  background: ${p => (p.$primary ? '#1d4ed8' : 'white')}; color: ${p => (p.$primary ? 'white' : '#475569')}; &:disabled { opacity: 0.45; cursor: not-allowed; }
`;
const Muted = styled.div`padding: 1rem 1.1rem; font-size: 0.8125rem; color: #94a3b8;`;

const ProjectPickerModal = ({ divisionId, divisions = [], already = [], onPick, onClose }) => {
  const [division, setDivision] = useState(divisionId ?? 'all');
  const [process, setProcess] = useState('');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState(null);
  const [sel, setSel] = useState([]);
  useEffect(() => {
    setRows(null);
    maturityApi.listProjects(division === 'all' ? 'all' : division)
      .then(r => setRows(Array.isArray(r.data) ? r.data : []))
      .catch(() => setRows([]));
  }, [division]);
  const processes = useMemo(() => [...new Set((rows || []).map(r => r.process).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko')), [rows]);
  const shown = useMemo(() => (rows || []).filter(r => {
    if (process && r.process !== process) return false;
    const t = q.trim().toLowerCase();
    if (t && !`${r.code || ''} ${r.title || ''} ${r.pl_name || ''}`.toLowerCase().includes(t)) return false;
    return true;
  }), [rows, process, q]);
  const toggle = (p) => setSel(s => (s.some(x => x.uuid === p.uuid) ? s.filter(x => x.uuid !== p.uuid) : [...s, p]));
  return (
    <Backdrop onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Box role="dialog" aria-label="과제 고르기">
        <Head>
          <h3>수행 디지털 트윈 과제 고르기</h3>
          <small>{rows == null ? '' : `${shown.length}건`}</small>
          <IconBtn type="button" onClick={onClose} aria-label="닫기"><X size={18} /></IconBtn>
        </Head>
        <Bar>
          <select value={division} onChange={e => { setDivision(e.target.value === 'all' ? 'all' : Number(e.target.value)); setProcess(''); }} aria-label="사업부">
            <option value="all">사업부 전체</option>
            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={process} onChange={e => setProcess(e.target.value)} aria-label="프로세스">
            <option value="">프로세스 전체</option>
            {processes.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="과제명·코드·PL 로 찾기" aria-label="과제 찾기" />
          <Search size={14} color="#94a3b8" />
        </Bar>
        <Picked>
          {sel.length === 0 ? <Muted style={{ padding: 0 }}>표에서 고르면 여기 담깁니다 — 여럿 고를 수 있습니다.</Muted>
            : sel.map(p => (
              <Chip key={p.uuid}>{p.code || p.title}
                <button type="button" onClick={() => toggle(p)} aria-label={`${p.title} 빼기`}><X size={11} /></button>
              </Chip>
            ))}
        </Picked>
        <Scroll>
          {rows == null ? <Muted>불러오는 중…</Muted> : shown.length === 0 ? <Muted>조건에 맞는 과제가 없습니다.</Muted> : (
            <Table>
              <thead><tr><th style={{ width: '2rem' }} /><th>코드</th><th>과제명</th><th>사업부</th><th>프로세스</th><th>연도</th><th>상태</th><th>PL</th></tr></thead>
              <tbody>
                {shown.map(p => {
                  const on = sel.some(x => x.uuid === p.uuid);
                  const had = already.includes(p.uuid);
                  return (
                    <tr key={p.uuid} onClick={() => !had && toggle(p)} title={had ? '이미 매달린 과제입니다' : ''}>
                      <td>{had ? <Chip>매달림</Chip> : <Mark $on={on}>{on && <Check size={11} />}</Mark>}</td>
                      <td>{p.code || '—'}</td>
                      <td>{p.title}</td>
                      <td>{p.division || '—'}</td>
                      <td>{p.process || '—'}</td>
                      <td>{p.year || '—'}</td>
                      <td>{p.status || '—'}</td>
                      <td>{p.pl_name || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Scroll>
        <Foot>
          <Button type="button" $primary disabled={sel.length === 0} onClick={() => { onPick(sel); onClose(); }}>고른 {sel.length}건 매달기</Button>
          <Button type="button" onClick={onClose}>취소</Button>
        </Foot>
      </Box>
    </Backdrop>
  );
};

export default ProjectPickerModal;
