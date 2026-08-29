import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { X, Check, AlertTriangle, ClipboardPaste, Copy } from 'lucide-react';
import maturityApi from '../../services/maturityApi';

/**
 * 일괄 입력 — 「추출」과 같은 머리글의 표를 붙여넣어 한 번에 세운다(2026-08-30).
 *
 * 처음 세팅할 때 시스템·조직·시험 항목·시뮬레이션을 화면에서 하나씩 만들면 몇 시간이 간다.
 * 엑셀로 쓰는 사람이 많으니 **추출한 판을 그대로 채워 돌려주는 길**을 연다.
 *
 * 흐름은 가져오기와 같다 — 머리글 복사 → 붙여넣기 → **미리보기(저장 없음)** → 넣기.
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
const Area = styled.textarea`
  width: 100%; min-height: 9rem; resize: vertical; font-family: ui-monospace, Consolas, monospace; font-size: 0.8125rem;
  border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.6rem; line-height: 1.5;
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
const STATUS = { new: '새로 만듦', exists: '이미 있음', error: '오류' };

const BulkInputModal = ({ divisionId, divisionName, sector, canEdit = true, denyReason, onClose, onChanged }) => {
  const [kinds, setKinds] = useState([]);
  const [kind, setKind] = useState(null);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => {
    maturityApi.bulkKinds(sector).then(r => {
      const list = Array.isArray(r.data) ? r.data : [];
      setKinds(list); setKind(list[0]?.key || null);
    }).catch(e => setError(e.message));
  }, [sector]);
  useEffect(() => { setPreview(null); setDone(null); }, [kind, text]);

  const spec = useMemo(() => kinds.find(k => k.key === kind), [kinds, kind]);
  const header = (spec?.columns || []).join('\t');

  const run = async (dryRun) => {
    setBusy(true); setError(null);
    try {
      const r = await maturityApi.bulkInput({ division_id: divisionId, sector, kind, text, dry_run: dryRun });
      if (dryRun) { setPreview(r.data); setDone(null); } else {
        setDone(r.data); setPreview(r.data);
        if (onChanged) onChanged();
      }
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const okRows = preview ? preview.summary.rows - preview.summary.errors : 0;
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
              <Cols>{header}</Cols>
              <Bar>
                <Button type="button" onClick={() => navigator.clipboard?.writeText(header)}><Copy size={13} /> 머리글 복사</Button>
                <Hint>엑셀에 붙여 채운 뒤, 머리글까지 함께 복사해 아래에 붙여넣으세요.</Hint>
              </Bar>
              <Area value={text} onChange={e => setText(e.target.value)} spellCheck={false}
                    placeholder={`${header}\n…엑셀에서 복사한 표를 여기에 붙여넣으세요`} aria-label="붙여넣기" />
            </>
          )}
          {error && <Notice><AlertTriangle size={14} /> <span>{error}</span></Notice>}
          {preview && (
            <>
              <Hint>
                줄 <strong>{preview.summary.rows}</strong> · 새로 만듦 <strong>{preview.summary.new}</strong> ·
                이미 있음 {preview.summary.exists} · <span style={{ color: preview.summary.errors ? '#b91c1c' : undefined }}>오류 {preview.summary.errors}</span>
                {done ? ' — 넣었습니다.' : ' — 아직 저장하지 않았습니다.'}
              </Hint>
              <Scroll>
                <Table>
                  <thead><tr><th style={{ width: '3.5rem' }}>줄</th><th style={{ width: '6rem' }}>어떻게</th><th>이름</th><th>이유</th></tr></thead>
                  <tbody>
                    {preview.rows.map(r => (
                      <tr key={r.line}>
                        <td>{r.line}</td>
                        <td><Tag $s={r.status}>{STATUS[r.status] || r.status}</Tag></td>
                        <td>{r.name || '—'}</td>
                        <td style={{ color: '#b91c1c' }}>{r.message || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Scroll>
            </>
          )}
        </Body>
        <Foot>
          <Button type="button" disabled={!canEdit || !text.trim() || busy} onClick={() => run(true)}>미리보기</Button>
          <Button type="button" $primary disabled={!canEdit || busy || !preview || okRows === 0 || !!done} onClick={() => run(false)}>
            <Check size={13} /> {done ? '넣었습니다' : `${okRows}줄 넣기`}
          </Button>
          <span style={{ flex: 1 }} />
          <Button type="button" onClick={onClose}>닫기</Button>
        </Foot>
      </Box>
    </Backdrop>
  );
};

export default BulkInputModal;
