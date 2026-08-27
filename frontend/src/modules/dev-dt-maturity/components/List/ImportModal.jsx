import React, { useState } from 'react';
import styled from 'styled-components';
import { X, Download, Check, AlertTriangle } from 'lucide-react';
import maturityApi from '../../services/maturityApi';

// 가져오기 — 틀 → 손보기 → 미리보기 → 넣기. (PLAN 6절)
//
// ⚠️ 미리보기는 아무것도 저장하지 않는다. 오류 줄도 목록에 남긴다 — 빼면
//    「왜 이 줄이 사라졌지」가 된다.
// ⚠️ 정확도 열은 「정확도 열도 넣기」를 켤 때만 쓴다. 근거는 「표 가져오기 (출처)」.

const Backdrop = styled.div`
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1.5rem;
`;
const Panel = styled.div`
  background: white; border-radius: 0.75rem; width: min(880px, 100%); max-height: 90vh;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25); display: flex; flex-direction: column; overflow: hidden;
`;
const Head = styled.div`display: flex; align-items: center; gap: 0.5rem; padding: 1rem 1.25rem 0.75rem; border-bottom: 1px solid #e2e8f0;`;
const Title = styled.h3`margin: 0; font-size: 1rem; font-weight: 700; color: #1e293b;`;
const CloseButton = styled.button`
  margin-left: auto; border: none; background: transparent; color: #94a3b8; cursor: pointer;
  padding: 0.25rem; border-radius: 0.25rem; &:hover { color: #475569; background: #f1f5f9; }
`;
const Body = styled.div`overflow-y: auto; padding: 0.75rem 1.25rem 1.25rem; display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.8125rem; color: #475569;`;
const Step = styled.div`display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; line-height: 1.6;`;
const Num = styled.span`
  flex-shrink: 0; width: 1.4rem; height: 1.4rem; border-radius: 50%; background: #eff6ff; color: #1d4ed8;
  font-size: 0.75rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center;
`;
const Textarea = styled.textarea`
  width: 100%; min-height: 160px; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.375rem;
  font-family: ui-monospace, monospace; font-size: 0.75rem; box-sizing: border-box;
`;
const Input = styled.input`padding: 0.35rem 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; font-family: inherit; font-size: 0.8125rem; width: ${p => p.$w || 'auto'};`;
const Button = styled.button`
  padding: 0.4rem 0.8rem; border: 1px solid #cbd5e1; border-radius: 0.375rem; background: white; color: #475569;
  font-size: 0.8125rem; font-weight: 600; font-family: inherit; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem;
  &:hover:not(:disabled) { border-color: #1d4ed8; color: #1d4ed8; } &:disabled { opacity: 0.4; cursor: not-allowed; }
`;
const Primary = styled(Button)`background: #1d4ed8; border-color: transparent; color: white;`;
const Notice = styled.div`
  display: flex; gap: 0.4rem; align-items: flex-start; padding: 0.6rem 0.75rem; border-radius: 0.5rem;
  background: ${p => (p.$bad ? '#fef2f2' : p.$ok ? '#f0fdf4' : '#fffbeb')};
  border: 1px solid ${p => (p.$bad ? '#fecaca' : p.$ok ? '#bbf7d0' : '#fde68a')};
  color: ${p => (p.$bad ? '#991b1b' : p.$ok ? '#15803d' : '#92400e')}; line-height: 1.5;
`;
const Preview = styled.div`max-height: 260px; overflow: auto; border: 1px solid #e2e8f0; border-radius: 0.375rem;`;
const PRow = styled.div`
  display: flex; gap: 0.5rem; padding: 0.3rem 0.5rem; border-bottom: 1px solid #f1f5f9; font-size: 0.75rem;
  color: ${p => (p.$err ? '#991b1b' : '#1e293b')}; background: ${p => (p.$err ? '#fef2f2' : 'white')};
`;

const ImportModal = ({ divisionId, divisionName, canEdit, denyReason, reconcile, onClose, onDone }) => {
  const [text, setText] = useState('');
  const [label, setLabel] = useState('');
  const [withAccuracy, setWithAccuracy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    try {
      const blob = await maturityApi.downloadTemplate(divisionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `maturity_${divisionName || divisionId}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setErr(e.message); }
  };
  const doPreview = async () => {
    setBusy(true); setResult(null);
    try { setPreview((await maturityApi.importPreview(divisionId, text)).data); setErr(null); }
    catch (e) { setErr(e.message); setPreview(null); }
    finally { setBusy(false); }
  };
  const doApply = async () => {
    setBusy(true);
    try {
      setResult((await maturityApi.importApply(divisionId, text, withAccuracy, label || null)).data);
      setPreview(null); setErr(null); onDone();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Backdrop onClick={onClose}>
      <Panel onClick={e => e.stopPropagation()}>
        <Head>
          <Title>가져오기 — {divisionName}</Title>
          <CloseButton onClick={onClose} title="닫기"><X size={18} /></CloseButton>
        </Head>
        <Body>
          {denyReason && <Notice><AlertTriangle size={14} /> <span>{denyReason} 틀은 내려받을 수 있습니다.</span></Notice>}
          <Step>
            <Num>1</Num>
            <Button onClick={download}><Download size={13} /> 틀 내려받기</Button>
            <span>로드맵의 시험 항목과 연결 과제를 한 줄씩 뽑은 CSV. 과제 단위로 묶인 것은 <strong>시뮬레이션 단위로 쪼개서</strong> 채우세요.</span>
          </Step>
          <Step><Num>2</Num><span>엑셀에서 채운 뒤 <strong>머리글째 복사</strong>해 아래에 붙입니다(탭 구분). 정확도(%) 열은 비워도 됩니다.</span></Step>
          <Textarea value={text} onChange={e => setText(e.target.value)} disabled={!canEdit}
                    placeholder="사업부	시험 항목	세부	적용 제품군	시뮬레이션	모델 종류	정확도(%)	로드맵 항목 id	대시보드 과제 uuid" />
          <Step>
            <Num>3</Num>
            <Button disabled={!canEdit || !text.trim() || busy} onClick={doPreview}>미리보기</Button>
            <span>저장하지 않고 무엇이 새로 생기고 무엇이 걸리는지 셉니다.</span>
          </Step>
          {err && <Notice $bad><AlertTriangle size={14} /> <span>{err}</span></Notice>}
          {preview && (
            <>
              <div>
                새 시험 <strong>{preview.summary.new_subjects}</strong> · 새 시뮬레이션 <strong>{preview.summary.new_agents}</strong> ·
                새 쌍 <strong>{preview.summary.new_pairs}</strong> · 이미 있는 쌍 {preview.summary.existing_pairs} ·
                정확도 값 {preview.summary.accuracy_values} · <span style={{ color: preview.summary.errors ? '#b91c1c' : undefined }}>오류 {preview.summary.errors}</span>
              </div>
              <Preview>
                {preview.rows.map(r => (
                  <PRow key={r.line} $err={r.status === 'error'}>
                    <span style={{ minWidth: '2.5rem', color: '#94a3b8' }}>{r.line}행</span>
                    <span style={{ flex: 1 }}>{r.subject} × {r.agent}{r.accuracy != null && ` · ${r.accuracy}%`}</span>
                    <span>{r.status === 'error' ? r.errors.join(' / ') : r.status === 'exists' ? '있음' : '새로'}</span>
                  </PRow>
                ))}
              </Preview>
            </>
          )}
          <Step>
            <Num>4</Num>
            <label style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
              <input type="checkbox" checked={withAccuracy} onChange={e => setWithAccuracy(e.target.checked)} /> 정확도 열도 넣기
            </label>
            <Input $w="15rem" placeholder="출처 (예: MX_가상검증_2026Q3.xlsx)" value={label} onChange={e => setLabel(e.target.value)} />
            <Primary disabled={!canEdit || !preview || busy || preview.summary.rows === preview.summary.errors} onClick={doApply}>
              <Check size={13} /> 넣기
            </Primary>
            <span>오류 없는 줄만. 이름이 같으면 있는 것을 씁니다 — 두 번 넣어도 같습니다.</span>
          </Step>
          {result && (
            <Notice $ok>
              <Check size={14} />
              <span>넣었습니다 — 시험 {result.done.subjects} · 시뮬레이션 {result.done.agents} · 쌍 {result.done.pairs} · 정확도 {result.done.accuracy}
                {result.done.skipped ? ` · 오류라 건너뛴 줄 ${result.done.skipped}` : ''}</span>
            </Notice>
          )}
          {reconcile && (reconcile.missing_here.length > 0 || reconcile.only_here.length > 0) && (
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              로드맵과 어긋남 — 로드맵에는 있는데 여기 없는 시험 <strong>{reconcile.missing_here.length}</strong>
              {reconcile.missing_here.length > 0 && <> ({reconcile.missing_here.slice(0, 6).join(', ')}{reconcile.missing_here.length > 6 ? ' …' : ''})</>}
              {' '}· 여기만 있는 시험 <strong>{reconcile.only_here.length}</strong>. 세기만 합니다 — 맞추라고 강제하지 않습니다.
            </div>
          )}
        </Body>
      </Panel>
    </Backdrop>
  );
};

export default ImportModal;
