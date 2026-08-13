/**
 * DX KPI 추천 — 과제 내용을 읽고 **연결할 만한 지표 후보**를 낸다.
 *
 * 🚦 전체 지도: 루트 `디지털트윈_AI기능_지도.md`
 *
 * ⚠️ **서버는 AI 의 KPI 쓰기를 403 으로 막아 둔 상태 그대로다**
 *    (`replace_project_kpi_links` — "추측으로 채우면 매트릭스의 빈칸이 가짜로 메워진다").
 *    여기가 예외인 이유는 **연결을 만들지 않기 때문**이다:
 *      · AI 는 후보와 **근거**만 낸다
 *      · **자동으로 체크하지 않는다** — 사람이 하나씩 고른다 (기본 선택 없음)
 *      · 저장은 평소의 KPI 저장 경로 (사람 권한·낙관적 락)
 *    이 셋 중 하나라도 무너지면 막아 둔 이유가 되살아난다. 특히 **기본 선택을 넣지 말 것.**
 *
 * ⚠️ 대상 사업부·기여 방법은 여기서 정하지 않는다. `KpiLinkSection.toggleKpi` 가
 *    서버 규칙(자기 사업부만 / 기능조직은 골라야 함 / 사업부 전용 지표)대로 만든다.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { Link2, Loader2, Check, X, AlertTriangle, Sparkles } from 'lucide-react';

import { suggestKpiLinks } from '../../../services/aiFormApi';

const AiKpiSuggestModal = ({ isOpen, onClose, projectUuid, onApply, canApply }) => {
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);     // {items, notes}
  const [picked, setPicked] = useState(() => new Set());
  const pressedOutside = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setInstruction('');
      setError('');
      setResult(null);
      setPicked(new Set());
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const data = await suggestKpiLinks({ uuid: projectUuid, instruction });
      setResult(data);
      // **아무것도 미리 고르지 않는다.** 미리 골라 두면 그대로 넘겨 버리게 되고,
      // 그게 이 자리가 원래 막혀 있던 이유(가짜로 메워진 빈칸)를 되살린다.
      setPicked(new Set());
    } catch (err) {
      setError(err.message || 'AI 서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, [busy, projectUuid, instruction]);

  const toggle = (id) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const apply = () => {
    const items = (result?.items || []).filter((it) => picked.has(it.kpiDefinitionId));
    if (!items.length) return;
    onApply(items.map((it) => it.kpiDefinitionId));
    onClose();
  };

  if (!isOpen) return null;

  const items = result?.items || [];

  return (
    <Overlay
      onMouseDown={(e) => { pressedOutside.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && pressedOutside.current) onClose(); }}
    >
      <Panel onClick={(e) => e.stopPropagation()}>
        <Header>
          <h2><Link2 size={18} /> AI로 DX KPI 추천받기</h2>
          <IconBtn type="button" onClick={onClose} title="닫기"><X size={18} /></IconBtn>
        </Header>

        <Content>
          <Lead>
            과제명·설명·상세 과제 정보를 읽고 <strong>기여할 만한 지표</strong>를 골라 옵니다.
            붙여넣을 글은 필요 없습니다.
          </Lead>

          <Label>추가 지시 (선택)</Label>
          <TextInput
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="예) 해석 정확도 쪽 지표만 / 플랫폼 구축은 빼줘"
            disabled={busy}
          />

          <Caution>
            <AlertTriangle size={14} />
            <span>
              KPI 연결은 <strong>“이 과제가 무엇에 기여하는가”를 선언하는 값</strong>입니다.
              근거가 약하면 고르지 마세요 — 빈칸을 채우면 <strong>계획의 구멍이 안 보이게</strong> 됩니다.
            </span>
          </Caution>

          <Row>
            <RunBtn type="button" onClick={run} disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              {busy ? '읽는 중…' : '지표 추천받기'}
            </RunBtn>
          </Row>

          {error && <Alert><AlertTriangle size={14} />{error}</Alert>}

          {result && (
            <Result>
              {items.length === 0 ? (
                <Empty>추천할 지표를 찾지 못했습니다. 과제 설명을 채운 뒤 다시 시도해 보세요.</Empty>
              ) : (
                <>
                  <ResultHead>
                    후보 {items.length}개 — <strong>근거를 보고</strong> 고르세요. 기본 선택은 없습니다.
                  </ResultHead>
                  {items.map((it) => (
                    <Item key={it.kpiDefinitionId} className={picked.has(it.kpiDefinitionId) ? 'on' : ''}>
                      <input
                        type="checkbox"
                        checked={picked.has(it.kpiDefinitionId)}
                        onChange={() => toggle(it.kpiDefinitionId)}
                      />
                      <div className="body">
                        <div className="title">
                          {it.label}
                          {it.category && <Tag>{it.category}</Tag>}
                          {it.kind === 'platform' && <Tag className="plat">플랫폼</Tag>}
                        </div>
                        {it.근거
                          ? <div className="why">{it.근거}</div>
                          : <div className="nowhy">근거를 적지 않았습니다 — 직접 판단하세요.</div>}
                      </div>
                    </Item>
                  ))}
                </>
              )}
              {(result.notes || []).map((n, i) => <Note key={i}>{n}</Note>)}
            </Result>
          )}

          {!canApply && (
            <Note className="warn">
              대상 사업부를 먼저 골라야 지표를 연결할 수 있습니다(기능조직 과제).
            </Note>
          )}
        </Content>

        <Footer>
          <GhostBtn type="button" onClick={onClose}>닫기</GhostBtn>
          <AddBtn type="button" onClick={apply} disabled={picked.size === 0 || !canApply}>
            <Check size={15} /> 고른 {picked.size}개 연결
          </AddBtn>
        </Footer>
      </Panel>
    </Overlay>
  );
};

/* ── 스타일 ── */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;      /* 편집창(ModalLayout)이 1000 이다 */
  padding: 1rem;
`;

const Panel = styled.div`
  background: #fff;
  border-radius: 1rem;
  width: 100%;
  max-width: 700px;
  max-height: calc(100vh - 3rem);
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
  color: #fff;

  h2 {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
`;

const IconBtn = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #fff;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover { background: rgba(255, 255, 255, 0.32); }
`;

const Content = styled.div`
  padding: 1rem 1.25rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Lead = styled.p`
  margin: 0;
  font-size: 0.8125rem;
  color: #475569;
  line-height: 1.6;
`;

const Label = styled.label`
  font-size: 0.75rem;
  font-weight: 600;
  color: #374151;
  margin-top: 0.25rem;
`;

const TextInput = styled.input`
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-family: inherit;

  &:focus { outline: none; border-color: #06b6d4; box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.12); }
  &:disabled { background: #f1f5f9; }
`;

const Caution = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  color: #92400e;
  line-height: 1.6;

  svg { flex-shrink: 0; margin-top: 2px; }
  strong { font-weight: 700; }
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const RunBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.5rem;
  background: #0891b2;
  color: #fff;
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover:not(:disabled) { background: #0e7490; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const Alert = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  padding: 0.5rem 0.625rem;
  border-radius: 0.5rem;
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  font-size: 0.75rem;

  svg { flex-shrink: 0; margin-top: 1px; }
`;

const Result = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-top: 0.25rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #e5e7eb;
`;

const ResultHead = styled.div`
  font-size: 0.75rem;
  color: #475569;
`;

const Empty = styled.div`
  font-size: 0.8125rem;
  color: #6b7280;
  padding: 0.75rem;
  text-align: center;
  border: 2px dashed #e5e7eb;
  border-radius: 0.5rem;
`;

const Item = styled.label`
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #f9fafb;
  cursor: pointer;

  &.on { border-color: #67e8f9; background: #f0fdff; }

  input { margin-top: 0.25rem; accent-color: #0891b2; }
  .body { flex: 1; min-width: 0; }
  .title {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
    font-size: 0.8125rem;
    font-weight: 600;
    color: #111827;
    word-break: break-word;
  }
  .why { margin-top: 0.1875rem; font-size: 0.75rem; color: #4b5563; line-height: 1.6; }
  .nowhy { margin-top: 0.1875rem; font-size: 0.75rem; color: #b45309; }
`;

const Tag = styled.span`
  font-size: 0.625rem;
  font-weight: 600;
  color: #0e7490;
  background: #cffafe;
  border-radius: 0.25rem;
  padding: 0.0625rem 0.3125rem;

  &.plat { color: #6d28d9; background: #ede9fe; }
`;

const Note = styled.div`
  font-size: 0.6875rem;
  color: #64748b;
  line-height: 1.5;

  &.warn { color: #b45309; }
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
`;

const AddBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.5rem;
  background: #10b981;
  color: #fff;
  font-size: 0.875rem;
  cursor: pointer;

  &:hover:not(:disabled) { background: #059669; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const GhostBtn = styled.button`
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: #fff;
  color: #4b5563;
  font-size: 0.875rem;
  cursor: pointer;

  &:hover { background: #f3f4f6; }
`;

export default AiKpiSuggestModal;
