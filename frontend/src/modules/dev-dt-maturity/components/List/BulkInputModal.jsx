import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { X, Check, AlertTriangle, ClipboardPaste, Copy, Download } from 'lucide-react';
import maturityApi from '../../services/maturityApi';
import { applyPaste, emptyGrid, isUnknown, toText, usedRows } from '../../utils/bulkGrid';

/**
 * 일괄 입력 — 「추출」과 같은 머리글의 표를 붙여넣어 한 번에 세운다(2026-08-30).
 *
 * 처음 세팅할 때 시스템·조직·시험 항목·시뮬레이션을 화면에서 하나씩 만들면 몇 시간이 간다.
 * 엑셀로 쓰는 사람이 많으니 **추출한 판을 그대로 채워 돌려주는 길**을 연다.
 *
 * 흐름 — 표에 적거나 **엑셀에서 붙여넣기**(Ctrl+V) → 미리보기(저장 없음) → 넣기.
 * ⚠️ 고를 수 있는 값이 정해진 칸은 **드롭다운**이다. 빈 상자에 글자를 적게 하면 무엇을 쓸 수
 *    있는지 알 수 없어 사람이 추측해서 적게 된다(2026-08-30 요청).
 *    붙여넣은 값이 목록에 있으면 골라지고, 없으면 「못 찾음」으로 빨갛게 남는다.
 * ⚠️ 미리보기는 오류 줄도 그대로 남긴다. 빼면 몇 번째 줄이 틀렸는지 알 수 없다.
 * ⚠️ 평가는 여기서 안 받는다 — 근거가 필수이고 이력이 남는 자리라 표로 쓸어 넣으면 안 된다.
 */

const Backdrop = styled.div`position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1.5rem;`;
const Box = styled.div`background: white; border-radius: 0.75rem; width: min(72rem, 96vw); height: min(46rem, 92vh); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.25);`;
const Head = styled.div`display: flex; align-items: center; gap: 0.5rem; padding: 0.85rem 1.15rem; border-bottom: 1px solid #e2e8f0; h3 { margin: 0; font-size: 1rem; color: #1e293b; }`;
const IconBtn = styled.button`margin-left: auto; border: none; background: transparent; color: #94a3b8; cursor: pointer; padding: 0.25rem; border-radius: 0.25rem; &:hover { color: #475569; background: #f1f5f9; }`;
const Body = styled.div`flex: 1; min-height: 0; overflow: auto; padding: 0.9rem 1.15rem; display: flex; flex-direction: column; gap: 0.7rem;`;
const Bar = styled.div`display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;`;
const Chip = styled.button`
  padding: 0.3rem 0.8rem; border-radius: 999px; font-family: inherit; font-size: 0.8125rem; font-weight: 600; cursor: pointer;
  border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#cbd5e1')}; background: ${p => (p.$on ? '#1d4ed8' : 'white')}; color: ${p => (p.$on ? 'white' : '#475569')};
`;
const Hint = styled.p`margin: 0; font-size: 0.8125rem; color: #64748b; line-height: 1.6;`;
const Cols = styled.code`display: block; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.4rem; padding: 0.45rem 0.6rem; font-size: 0.75rem; color: #334155; overflow-x: auto; white-space: nowrap;`;
// 적는 표 — 셀 하나가 열 하나. 고를 수 있는 칸은 select, 나머지는 input.
const GridWrap = styled.div`border: 1px solid #cbd5e1; border-radius: 0.5rem; overflow: auto; max-height: 22rem;`;
const Grid = styled.table`
  border-collapse: separate; border-spacing: 0; width: 100%; font-size: 0.8125rem;
  th { position: sticky; top: 0; z-index: 1; background: #f1f5f9; color: #334155; font-weight: 700; font-size: 0.75rem;
       padding: 0.35rem 0.5rem; text-align: left; white-space: nowrap; border-bottom: 1px solid #cbd5e1; }
  th.no, td.no { width: 2.4rem; text-align: right; color: #94a3b8; background: #f8fafc; font-weight: 400; }
  td { padding: 0; border-bottom: 1px solid #eef2f7; border-right: 1px solid #f1f5f9; }
  input, select {
    width: 100%; border: none; background: transparent; font-family: inherit; font-size: 0.8125rem;
    padding: 0.3rem 0.45rem; outline: none; color: #1e293b;
    &:focus { background: #eff6ff; box-shadow: inset 0 0 0 2px #1d4ed8; border-radius: 2px; }
  }
  td.bad input, td.bad select { background: #fef2f2; color: #b91c1c; }
`;
const Table = styled.table`width: 100%; border-collapse: collapse; font-size: 0.8125rem;
  th { position: sticky; top: 0; background: #f8fafc; text-align: left; font-size: 0.6875rem; color: #64748b; padding: 0.3rem 0.5rem; border-bottom: 1px solid #e2e8f0; }
  td { padding: 0.3rem 0.5rem; border-bottom: 1px solid #f1f5f9; }
`;
const Tag = styled.span`display: inline-block; padding: 0 0.5rem; border-radius: 999px; font-size: 0.6875rem; font-weight: 700;
  background: ${p => (p.$s === 'new' ? '#dcfce7' : p.$s === 'error' ? '#fee2e2' : '#f1f5f9')};
  color: ${p => (p.$s === 'new' ? '#166534' : p.$s === 'error' ? '#b91c1c' : '#64748b')};
`;
const Scroll = styled.div`max-height: 18rem; overflow: auto; border: 1px solid #e2e8f0; border-radius: 0.5rem;`;
const Notice = styled.div`display: flex; gap: 0.4rem; align-items: flex-start; padding: 0.55rem 0.7rem; border-radius: 0.5rem; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: 0.8125rem;`;
const Foot = styled.div`display: flex; gap: 0.5rem; align-items: center; padding: 0.65rem 1.15rem; border-top: 1px solid #e2e8f0; background: #f8fafc;`;
const Button = styled.button`
  padding: 0.35rem 0.9rem; border: 1px solid ${p => (p.$primary ? '#1d4ed8' : '#cbd5e1')}; border-radius: 0.375rem; font-family: inherit;
  font-size: 0.8125rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;
  background: ${p => (p.$primary ? '#1d4ed8' : 'white')}; color: ${p => (p.$primary ? 'white' : '#475569')};
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;
const STATUS = { new: '새로 만듦', exists: '이미 있음', update: '고침', same: '그대로', error: '오류' };
// 바뀔 값 — 미리보기에서 **눈으로 보고** 올린다(2026-08-30)
const Diff = styled.div`
  font-size: 0.75rem; color: #334155; line-height: 1.6;
  b { font-weight: 600; color: #64748b; margin-right: 0.25rem; }
  del { color: #94a3b8; text-decoration: line-through; }
  ins { color: #1d4ed8; text-decoration: none; font-weight: 600; }
`;

const BulkInputModal = ({ divisionId, divisionName, sector, canEdit = true, denyReason, onClose, onChanged }) => {
  const [kinds, setKinds] = useState([]);
  const [kind, setKind] = useState(null);
  const [grid, setGrid] = useState([]);
  const [at, setAt] = useState({ r: 0, c: 0 });      // 붙여넣기가 시작될 칸
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  // 있는 것을 고칠까 — **기본은 꺼짐.** 예전 표를 실수로 붙여넣어 지금 자료를 되돌리는
  // 일이 나면 안 된다. 켜면 미리보기가 무엇이 무엇으로 바뀌는지 말해 준다(2026-08-30).
  const [update, setUpdate] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    maturityApi.bulkKinds(sector, divisionId).then(r => {
      const list = Array.isArray(r.data) ? r.data : [];
      setKinds(list); setKind(list[0]?.key || null);
    }).catch(e => setError(e.message));
  }, [sector, divisionId]);
  const spec = useMemo(() => kinds.find(k => k.key === kind), [kinds, kind]);
  const header = (spec?.columns || []).join('\t');
  // 종류를 바꾸면 표를 새로 짠다 — 열이 달라지므로 앞의 값은 뜻이 없다.
  useEffect(() => { if (spec) setGrid(emptyGrid(spec.columns)); setPreview(null); setDone(null); setAt({ r: 0, c: 0 }); }, [spec]);

  const setCell = (r, c, v) => {
    setPreview(null); setDone(null);
    setGrid(g => g.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)));
  };
  const onPaste = (e) => {
    const text = e.clipboardData?.getData('text/plain');
    if (!text || !spec) return;
    e.preventDefault();
    setPreview(null); setDone(null);
    setGrid(g => applyPaste(g, spec.columns, spec.choices || {}, text, at.r, at.c));
  };
  const rowCount = usedRows(grid).length;

  /** 지금 자료를 표에 채운다 — 이걸로 시작해야 엑셀에서 고칠 것이 생긴다. */
  const loadNow = async () => {
    if (!spec) return;
    setBusy(true); setError(null); setPreview(null); setDone(null);
    try {
      const r = await maturityApi.bulkRows(sector, kind, divisionId);
      const rows = r.data?.rows || [];
      // 빈 줄 몇을 붙여 둔다 — 불러온 뒤 새 줄도 바로 적을 수 있게
      setGrid([...rows.map(x => spec.columns.map((_, i) => x[i] ?? '')), ...emptyGrid(spec.columns, 3)]);
      setAt({ r: 0, c: 0 });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  /** 머리글까지 통째로 — 엑셀에 그대로 붙는다(탭으로 나눈다). */
  const copyTable = async () => {
    const text = toText(grid, spec.columns);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { setError('클립보드에 못 넣었습니다 — 표를 끌어 골라 Ctrl+C 하세요.'); }
  };

  const run = async (dryRun) => {
    setBusy(true); setError(null);
    try {
      const r = await maturityApi.bulkInput({
        division_id: divisionId, sector, kind, text: toText(grid, spec.columns), dry_run: dryRun,
        mode: update ? 'update' : 'add',
      });
      if (dryRun) { setPreview(r.data); setDone(null); } else {
        setDone(r.data); setPreview(r.data);
        if (onChanged) onChanged();
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const okRows = preview ? preview.summary.rows - preview.summary.errors : 0;
  const willChange = preview ? (preview.summary.new + (preview.summary.updated || 0)) : 0;
  // ⚠️ 고치기를 켰다 껐다 하면 미리보기의 뜻이 달라진다 — 다시 보게 한다.
  const setMode = (v) => { setUpdate(v); setPreview(null); setDone(null); };
  return (
    <Backdrop onClick={onClose}>
      <Box onClick={e => e.stopPropagation()} role="dialog" aria-label="일괄 입력">
        <Head>
          <ClipboardPaste size={16} color="#1d4ed8" />
          <h3>일괄 입력 — {divisionName || '전체'}</h3>
          <IconBtn onClick={onClose} title="닫기" aria-label="닫기"><X size={16} /></IconBtn>
        </Head>
        <Body>
          {denyReason && <Notice><AlertTriangle size={14} /> <span>{denyReason}</span></Notice>}
          <Bar aria-label="종류">
            {kinds.map(k => <Chip key={k.key} type="button" $on={kind === k.key} onClick={() => setKind(k.key)}>{k.label}</Chip>)}
          </Bar>
          {spec && (
            <>
              <Hint>
                {spec.hint} 「추출」로 받은 판의 머리글을 그대로 쓰면 됩니다 — <strong>필요한 열: {spec.required.join(' · ')}</strong>
              </Hint>
              <Bar>
                <Button type="button" onClick={() => navigator.clipboard?.writeText(header)}><Copy size={13} /> 머리글 복사</Button>
                <Button type="button" onClick={() => setGrid(g => [...g, spec.columns.map(() => '')])}>줄 더하기</Button>
                {/* ⚠️ 불러오기가 있어야 「엑셀에서 고치기」가 시작된다 — 빈 표에서 시작하면
                    있는 것을 다시 적어야 한다(2026-08-30). */}
                <Button type="button" disabled={busy} onClick={loadNow}
                        title="지금 저장된 자료를 이 표에 채웁니다 — 고쳐서 되넣을 수 있습니다">
                  <Download size={13} /> 지금 자료 불러오기
                </Button>
                <Button type="button" disabled={!rowCount} onClick={copyTable}
                        title="머리글까지 클립보드로 — 엑셀에 그대로 붙습니다">
                  <Copy size={13} /> {copied ? '복사했습니다' : '표 복사'}
                </Button>
                <Button type="button" onClick={() => setGrid(emptyGrid(spec.columns))}>비우기</Button>
                <Hint>엑셀에서 복사해 표 안에 <strong>Ctrl+V</strong> — 고를 수 있는 칸은 목록에 있으면 골라지고, 없으면 빨갛게 남습니다.</Hint>
              </Bar>
              <GridWrap onPaste={onPaste}>
                <Grid aria-label="일괄 입력 표">
                  <thead>
                    <tr>
                      <th className="no" />
                      {spec.columns.map(c => (
                        <th key={c}>{c}{spec.required.includes(c) ? ' *' : ''}{(spec.choices || {})[c] ? ' ▾' : ''}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grid.map((row, r) => (
                      <tr key={r}>
                        <td className="no">{r + 1}</td>
                        {spec.columns.map((col, c) => {
                          const options = (spec.choices || {})[col];
                          const bad = isUnknown(row[c], options);
                          return (
                            <td key={col} className={bad ? 'bad' : undefined}
                                title={bad ? `목록에 없는 값입니다 — ${row[c]}` : undefined}>
                              {options ? (
                                <select value={bad ? '' : (row[c] || '')} aria-label={`${r + 1}행 ${col}`}
                                        onFocus={() => setAt({ r, c })} onChange={e => setCell(r, c, e.target.value)}>
                                  <option value="">{bad ? `못 찾음: ${row[c]}` : '—'}</option>
                                  {options.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              ) : (
                                <input value={row[c] || ''} aria-label={`${r + 1}행 ${col}`} spellCheck={false}
                                       onFocus={() => setAt({ r, c })} onChange={e => setCell(r, c, e.target.value)} />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </Grid>
              </GridWrap>
            </>
          )}
          {spec && (
            <Hint as="label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={update} onChange={e => setMode(e.target.checked)}
                     aria-label="있는 것은 고치기" />
              <span>
                <strong>있는 것은 고치기</strong> — 이름이 같으면 나머지 칸을 덮어씁니다.
                끄면 <strong>새것만</strong> 들어갑니다(있는 것은 건너뜁니다).
                {' '}빈 칸은 지우지 않습니다 — 비우려면 그 항목을 열어 지우세요.
              </span>
            </Hint>
          )}
          {error && <Notice><AlertTriangle size={14} /> <span>{error}</span></Notice>}
          {preview && (
            <>
              <Hint>
                줄 <strong>{preview.summary.rows}</strong> · 새로 만듦 <strong>{preview.summary.new}</strong>
                {update && <> · 고침 <strong style={{ color: '#b45309' }}>{preview.summary.updated || 0}</strong></>}
                {' '}· {update ? '고칠 것 없음' : '이미 있음'} {update ? preview.summary.exists : preview.summary.exists}
                {' '}· <span style={{ color: preview.summary.errors ? '#b91c1c' : undefined }}>오류 {preview.summary.errors}</span>
                {done ? ' — 넣었습니다.' : ' — 아직 저장하지 않았습니다.'}
              </Hint>
              <Scroll>
                <Table>
                  <thead><tr><th style={{ width: '3.5rem' }}>줄</th><th style={{ width: '6rem' }}>어떻게</th><th style={{ width: '12rem' }}>이름</th><th>바뀌는 값 · 이유</th></tr></thead>
                  <tbody>
                    {preview.rows.map(r => (
                      <tr key={r.line}>
                        <td>{r.line}</td>
                        <td><Tag $s={r.status}>{STATUS[r.status] || r.status}</Tag></td>
                        <td>{r.name || '—'}</td>
                        <td>
                          {/* ⚠️ 덮어쓰기는 **눈으로 보고** 올린다 — 무엇이 무엇으로 바뀌는지 여기서 읽는다. */}
                          {(r.changes || []).length > 0 && (
                            <Diff>
                              {r.changes.map(c => (
                                <div key={c.field}>
                                  <b>{c.col}</b>
                                  <del>{String(c.before ?? '') || '(비어 있음)'}</del>
                                  {' → '}
                                  <ins>{String(c.after ?? '')}</ins>
                                </div>
                              ))}
                            </Diff>
                          )}
                          {r.message && <span style={{ color: '#b91c1c' }}>{r.message}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Scroll>
            </>
          )}
        </Body>
        <Foot>
          <Button type="button" disabled={!canEdit || !rowCount || busy} onClick={() => run(true)}>미리보기 ({rowCount}줄)</Button>
          {/* ⚠️ 미리보기를 봐야 열린다. 바뀔 것이 없으면(전부 「그대로」) 누를 것도 없다. */}
          <Button type="button" $primary disabled={!canEdit || busy || !preview || willChange === 0 || !!done}
                  onClick={() => run(false)}>
            <Check size={13} /> {done ? '넣었습니다'
              : update ? `새로 ${preview?.summary.new || 0} · 고침 ${preview?.summary.updated || 0} 넣기`
              : `${okRows}줄 넣기`}
          </Button>
          <span style={{ flex: 1 }} />
          <Button type="button" onClick={onClose}>닫기</Button>
        </Foot>
      </Box>
    </Backdrop>
  );
};

export default BulkInputModal;
