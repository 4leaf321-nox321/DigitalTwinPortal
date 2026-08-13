/**
 * 붙여넣기 → 참여인력 후보 — 회의록·메일에서 **이름만** 뽑고, 계정은 사람이 고른다.
 *
 * 🚦 전체 지도: 루트 `디지털트윈_AI기능_지도.md`
 *
 * 🚨 **같은 폴더의 다른 AI 화면들과 규칙이 하나 다르다.**
 *    `AiFillPanel`·`AiActionItemsModal` 은 AI 가 만든 값을 사람이 **확인**하면 되지만,
 *    여기는 AI 가 값을 만들지 않는다 — 이름만 찾아 오고 **누구인지는 사람이 고른다.**
 *
 *    왜: 참여인력에 들어간 사람은 그 과제를 **고칠 수 있게 된다**(`is_project_member`).
 *    그리고 원문에는 동명이인을 가릴 정보가 없다. 후보가 하나뿐이어도 자동으로 넣지
 *    않는다 — 이름이 같은 다른 사람일 수 있고, 틀렸을 때의 대가가 편집 권한이다.
 *
 * ⚠️ 계정을 못 찾은 이름도 **버리지 않고 보여준다.** 아직 가입 안 한 사람일 수 있고,
 *    knoxId(사내 이메일 @앞부분)를 미리 넣어 두면 가입하는 순간 권한이 생긴다.
 *    다만 이 창에서는 넣지 않는다 — 짐작으로 적을 값이 아니라서, 아래 입력줄에서
 *    자동완성으로 고르게 안내한다.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import styled from 'styled-components';
import { Users, Loader2, Check, X, AlertTriangle, ShieldAlert } from 'lucide-react';

import { extractPeople } from '../../../services/aiFormApi';

const AiPeopleModal = ({ isOpen, onClose, projectUuid, existingNames = [], onAdd }) => {
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);      // {people, notes}
  const [chosen, setChosen] = useState({});        // {행번호: knoxId}
  const pressedOutside = useRef(false);

  // 열 때마다 처음부터. 남겨 두면 **다른 과제에 앞 과제의 사람**을 넣게 된다.
  useEffect(() => {
    if (isOpen) {
      setSource('');
      setError('');
      setResult(null);
      setChosen({});
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
      const data = await extractPeople({
        uuid: projectUuid, text: source, existing: existingNames,
      });
      setResult(data);
      // **아무것도 미리 고르지 않는다.** 후보가 하나뿐이어도 사람이 눌러야 한다 —
      // 미리 골라 두면 그대로 넘겨 버리게 되고, 그게 이 화면이 막으려는 바로 그 일이다.
      setChosen({});
    } catch (err) {
      setError(err.message || 'AI 서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, [busy, source, projectUuid, existingNames]);

  const pick = (idx, knoxId) => {
    setChosen((prev) => {
      const next = { ...prev };
      if (next[idx] === knoxId) delete next[idx];   // 다시 누르면 해제
      else next[idx] = knoxId;
      return next;
    });
  };

  const add = () => {
    const people = result?.people || [];
    const rows = [];
    Object.entries(chosen).forEach(([idx, knoxId]) => {
      const person = people[Number(idx)];
      const hit = (person?.candidates || []).find((c) => c.knoxId === knoxId);
      if (hit) rows.push({ 이름: hit.이름, knoxId: hit.knoxId, 부서: hit.부서 || '' });
    });
    if (!rows.length) return;
    onAdd(rows);
    onClose();
  };

  if (!isOpen) return null;

  const people = result?.people || [];
  const pickedCount = Object.keys(chosen).length;

  return (
    <Overlay
      onMouseDown={(e) => { pressedOutside.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (e.target === e.currentTarget && pressedOutside.current) onClose(); }}
    >
      <Panel onClick={(e) => e.stopPropagation()}>
        <Header>
          <h2><Users size={18} /> AI로 참여인력 찾기</h2>
          <IconBtn type="button" onClick={onClose} title="닫기"><X size={18} /></IconBtn>
        </Header>

        <Content>
          <Label>회의록 · 메일 · 조직도를 붙여넣으세요</Label>
          <TextArea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={'예)\n참석: 홍길동 책임, 김철수 선임\n힌지 해석은 이영희 프로가 맡기로 함'}
            rows={7}
            disabled={busy}
            autoFocus
          />

          <Caution>
            <ShieldAlert size={14} />
            <span>
              <strong>AI 는 이름만 찾습니다.</strong> 누구인지는 직접 고르세요 —
              여기 넣은 사람은 <strong>이 과제를 수정할 수 있게 됩니다.</strong>
            </span>
          </Caution>

          <Row>
            <RunBtn type="button" onClick={run} disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : <Users size={14} />}
              {busy ? '찾는 중…' : '사람 찾기'}
            </RunBtn>
            {existingNames.length > 0 && (
              <Hint>이미 등록된 {existingNames.length}명은 빼고 찾습니다.</Hint>
            )}
          </Row>

          {error && <Alert><AlertTriangle size={14} />{error}</Alert>}

          {result && (
            <Result>
              {people.length === 0 ? (
                <Empty>이름을 찾지 못했습니다. 참석자가 적힌 부분을 붙여넣어 보세요.</Empty>
              ) : (
                <>
                  <ResultHead>
                    찾은 이름 {people.length}명 — <strong>계정을 골라야</strong> 넣을 수 있습니다.
                  </ResultHead>
                  {people.map((person, i) => (
                    <Person key={i} className={chosen[i] ? 'on' : ''}>
                      <div className="head">
                        <strong>{person.이름}</strong>
                        {person.동명이인 && <DupTag>동명이인 {person.candidates.length}명</DupTag>}
                        {person.candidates.length === 0 && <NoneTag>계정 없음</NoneTag>}
                      </div>
                      {person.근거 && <div className="why">“{person.근거}”</div>}

                      {person.candidates.length === 0 ? (
                        <div className="none">
                          이 이름으로 가입한 계정이 없습니다. 아직 가입 전이거나 표기가 다를 수
                          있습니다 — 아래 <strong>참여인력 입력줄</strong>에서 직접 찾아 넣으세요.
                        </div>
                      ) : (
                        <div className="cands">
                          {person.candidates.map((c) => (
                            <Cand
                              key={c.knoxId || c.이름}
                              type="button"
                              className={chosen[i] === c.knoxId ? 'on' : ''}
                              onClick={() => pick(i, c.knoxId)}
                            >
                              <span className="id">{c.knoxId || '(knoxId 없음)'}</span>
                              <span className="dept">{c.부서 || '부서 미상'}</span>
                            </Cand>
                          ))}
                        </div>
                      )}
                    </Person>
                  ))}
                </>
              )}
              {(result.notes || []).map((n, i) => <Note key={i}>{n}</Note>)}
            </Result>
          )}
        </Content>

        <Footer>
          <GhostBtn type="button" onClick={onClose}>닫기</GhostBtn>
          <AddBtn type="button" onClick={add} disabled={pickedCount === 0}>
            <Check size={15} /> 고른 {pickedCount}명 추가
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
  max-width: 680px;
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
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  color: #b91c1c;
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
  gap: 0.5rem;
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

const Person = styled.div`
  padding: 0.625rem 0.75rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: #f9fafb;

  &.on { border-color: #67e8f9; background: #f0fdff; }

  .head {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    color: #111827;
  }
  .why {
    margin-top: 0.1875rem;
    font-size: 0.6875rem;
    color: #6b7280;
    word-break: break-word;
  }
  .cands { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: 0.5rem; }
  .none {
    margin-top: 0.375rem;
    font-size: 0.6875rem;
    color: #b45309;
    line-height: 1.6;
  }
`;

const Cand = styled.button`
  display: inline-flex;
  align-items: baseline;
  gap: 0.375rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #fff;
  cursor: pointer;
  font-size: 0.75rem;
  color: #334155;

  &:hover { border-color: #06b6d4; }
  &.on { background: #0891b2; border-color: #0891b2; color: #fff; }
  &.on .dept { color: rgba(255, 255, 255, 0.85); }

  .id { font-weight: 600; }
  .dept { font-size: 0.6875rem; color: #64748b; }
`;

const DupTag = styled.span`
  font-size: 0.625rem;
  font-weight: 600;
  color: #b45309;
  background: #fef3c7;
  border-radius: 0.25rem;
  padding: 0.0625rem 0.3125rem;
`;

const NoneTag = styled.span`
  font-size: 0.625rem;
  font-weight: 600;
  color: #64748b;
  background: #e2e8f0;
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

export default AiPeopleModal;
