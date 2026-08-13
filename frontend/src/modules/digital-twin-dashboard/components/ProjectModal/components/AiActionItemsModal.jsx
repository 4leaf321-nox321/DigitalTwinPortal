/**
 * 붙여넣기 → 액션아이템 — 회의록·메일·주간보고에서 **해야 할 일**을 뽑아 목록에 넣는다.
 *
 * 🚦 전체 지도: 루트 `디지털트윈_AI기능_지도.md`
 *    같은 폴더의 `AiFillPanel` 과 짝이다(그쪽은 폼의 칸, 여기는 액션아이템 목록).
 *
 * ⚠️ **완료 표시는 뽑지 않는다.** 액션아이템의 완료 여부가 과제 진행률과 진행상태를
 *    정하고(서버가 파생시키고 모순이면 400), 회의록의 "A 끝냄" 한 줄을 모델이 완료로
 *    읽으면 **과제 진척이 조용히 움직인다.** 전부 미완료로 들어가고, 완료 체크는
 *    사람이 목록에서 한다 — 그 화면에는 완료일·액티비티 파생이 이미 걸려 있다.
 *
 * ⚠️ **여기서 저장하지 않는다.** 목록에 담길 뿐이고 저장은 편집창의 저장 버튼이 한다.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { Sparkles, Loader2, Check, X, AlertTriangle, CalendarRange } from 'lucide-react';

import { extractActionItems } from '../../../services/aiFormApi';

const AiActionItemsModal = ({
  isOpen, onClose, projectUuid, projectYear, existingTitles = [], onAdd,
}) => {
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);       // {items, notes}
  const [picked, setPicked] = useState(() => new Set());

  /**
   * 바깥을 눌러 닫을 때, **눌린 곳이 실제로 바깥이었는지** 본다.
   *
   * 텍스트를 드래그로 선택하다 손을 창 밖에서 떼면 click 의 target 이 바깥(오버레이)이
   * 되어 창이 닫힌다 — 붙여넣은 회의록이 통째로 날아간다. 그래서 **누르기 시작한
   * 곳까지** 봐야 한다.
   */
  const pressedOutside = useRef(false);

  // 열 때마다 처음부터. 지난번 결과가 남아 있으면 **다른 과제의 항목을 그대로 추가**하는
  // 사고가 난다(편집창은 이전/다음 과제로 넘어가면서 살아 있다).
  useEffect(() => {
    if (isOpen) {
      setSource('');
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
    if (!source.trim()) {
      setError('붙여넣을 글을 입력하세요.');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const data = await extractActionItems({
        uuid: projectUuid,
        text: source,
        existing: existingTitles,
      });
      setResult(data);
      // 이미 있는 것과 겹치는 항목은 **꺼 둔다.** 켜 두면 같은 회의록을 두 번 붙여넣었을 때
      // 목록이 조용히 두 배가 되고, 액션아이템이 늘면 진행률이 함께 내려간다.
      setPicked(new Set(
        (data.items || []).map((it, i) => (it.duplicate ? null : i)).filter((i) => i !== null)
      ));
    } catch (err) {
      setError(err.message || 'AI 서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, [busy, source, projectUuid, existingTitles]);

  const toggle = (i) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const add = () => {
    const items = (result?.items || []).filter((_, i) => picked.has(i));
    if (!items.length) return;
    onAdd(items);
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
          <h2><Sparkles size={18} /> AI로 액션아이템 뽑기</h2>
          <IconBtn type="button" onClick={onClose} title="닫기"><X size={18} /></IconBtn>
        </Header>

        <Content>
          <Label>과제 내용을 입력하세요</Label>
          <TextArea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            /*
              예시를 **서술형으로** 둔다. 목록 예시만 보여주면 사용자가 "목록을 이미
              갖고 있어야 쓰는 기능" 으로 읽는다 — 실제로는 과제 설명을 그대로 넣어도
              단계로 나눠 준다(그게 이 기능의 값어치다).
            */
            placeholder={'과제 설명을 그대로 넣어도 됩니다. 서술형이면 일의 단계로 나눠 줍니다.\n\n'
              + '예) 5G 안테나 해석 정확도를 높이기 위해 측정 데이터를 확보하고,\n'
              + '해석 모델을 보정한 뒤, 실측과 비교해 검증 체계를 만든다.\n\n'
              + '회의록·메일처럼 할 일이 줄로 적힌 글도 그대로 넣으면 됩니다.'}
            rows={8}
            disabled={busy}
            autoFocus
          />

          <Caution>
            <AlertTriangle size={14} />
            <span>
              뽑은 항목은 <strong>전부 미완료</strong>로 들어갑니다. 완료 표시는 추가한 뒤
              직접 체크하세요 — <strong>진행률이 액션아이템에서 계산</strong>되기 때문입니다.
              목표일은 {projectYear}년 안의 날짜만 들어갑니다.
            </span>
          </Caution>

          <Row>
            <RunBtn type="button" onClick={run} disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              {busy ? '뽑는 중…' : '액션아이템 뽑기'}
            </RunBtn>
            {existingTitles.length > 0 && (
              <Hint>이미 있는 {existingTitles.length}건과 겹치는 항목은 자동으로 꺼 둡니다.</Hint>
            )}
          </Row>

          {error && <Alert><AlertTriangle size={14} />{error}</Alert>}

          {result && (
            <Result>
              {items.length === 0 ? (
                <Empty>해야 할 일을 찾지 못했습니다. 할 일이 드러나게 적힌 부분을 붙여넣어 보세요.</Empty>
              ) : (
                <>
                  <ResultHead>후보 {items.length}건 — 넣을 것만 남기세요.</ResultHead>
                  {items.map((it, i) => (
                    <Item key={i} className={picked.has(i) ? 'on' : ''}>
                      <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} />
                      <div className="body">
                        <div className="title">
                          {it.제목}
                          {it.duplicate && <DupTag>이미 있음</DupTag>}
                          {it.목표일 && (
                            <DateTag><CalendarRange size={11} /> {it.목표일}</DateTag>
                          )}
                        </div>
                        {(it.세부항목목록 || []).length > 0 && (
                          <ul className="details">
                            {it.세부항목목록.map((d, j) => <li key={j}>{d.내용}</li>)}
                          </ul>
                        )}
                      </div>
                    </Item>
                  ))}
                </>
              )}
              {(result.notes || []).map((n, i) => <Note key={i}>{n}</Note>)}
            </Result>
          )}
        </Content>

        <Footer>
          <GhostBtn type="button" onClick={onClose}>닫기</GhostBtn>
          <AddBtn type="button" onClick={add} disabled={picked.size === 0}>
            <Check size={15} /> 선택 {picked.size}건 목록에 추가
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
  max-width: 720px;
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

const Label = styled.label`
  font-size: 0.8125rem;
  font-weight: 600;
  color: #374151;
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;

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

const Hint = styled.span`
  font-size: 0.6875rem;
  color: #64748b;
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
    font-size: 0.8125rem;
    font-weight: 600;
    color: #111827;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
    word-break: break-word;
  }
  .details {
    margin: 0.375rem 0 0;
    padding-left: 1.125rem;
    font-size: 0.75rem;
    color: #4b5563;
    line-height: 1.6;
  }
`;

const DupTag = styled.span`
  font-size: 0.625rem;
  font-weight: 600;
  color: #b45309;
  background: #fef3c7;
  border-radius: 0.25rem;
  padding: 0.0625rem 0.3125rem;
`;

const DateTag = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  font-size: 0.6875rem;
  font-weight: 500;
  color: #0e7490;
  background: #cffafe;
  border-radius: 0.25rem;
  padding: 0.0625rem 0.3125rem;
`;

const Note = styled.div`
  font-size: 0.6875rem;
  color: #64748b;
  line-height: 1.5;
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

export default AiActionItemsModal;
