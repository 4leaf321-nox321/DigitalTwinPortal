import React, { useState } from 'react';
import styled from 'styled-components';
import { Plus, Trash2 } from 'lucide-react';

// 진단의 산출물. 올해 넘어야 할 결정적 지점 1~3개.
//
// 격자를 다 채우는 것이 진단의 끝이 아니다. 점수 수십 개가 아니라 이 몇 줄이
// 다음 단계(② 이슈)로 넘어간다. 많이 만들면 의미가 없다 — 전부가 중요하면
// 아무것도 중요하지 않다.

const RECOMMENDED_MAX = 3;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
`;

const Card = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 1rem 1.125rem;
  background: white;
  border: 1px solid #ddd6fe;
  border-left: 3px solid #7c3aed;
  border-radius: 0.5rem;
`;

const Index = styled.div`
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: #7c3aed;
  color: white;
  font-size: 0.8125rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Body = styled.div`
  flex: 1;
  min-width: 0;
`;

const TitleInput = styled.input`
  width: 100%;
  border: none;
  padding: 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e293b;
  background: transparent;

  &:focus { outline: none; }
`;

const RationaleInput = styled.textarea`
  width: 100%;
  margin-top: 0.375rem;
  padding: 0.5rem 0.625rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #475569;
  font-family: inherit;
  resize: vertical;
  min-height: 2.5rem;

  &:focus { outline: none; border-color: #7c3aed; }
`;

const IconButton = styled.button`
  flex-shrink: 0;
  padding: 0.375rem;
  border: none;
  background: transparent;
  color: #cbd5e1;
  cursor: pointer;
  border-radius: 0.25rem;

  &:hover { color: #dc2626; background: #fef2f2; }
`;

const AddButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.75rem;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  background: white;
  color: #64748b;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;

  &:hover { border-color: #7c3aed; color: #7c3aed; }
`;

const Empty = styled.div`
  padding: 1.75rem 1.25rem;
  text-align: center;
  color: #94a3b8;
  background: white;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.6;
`;

const Warn = styled.div`
  padding: 0.625rem 1rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 0.375rem;
  color: #92400e;
  font-size: 0.8125rem;
`;

const CruxPanel = ({ cruxes, onAdd, onUpdate, onDelete }) => {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const submit = () => {
    const title = draft.trim();
    if (title) onAdd({ title });
    setDraft('');
    setAdding(false);
  };

  return (
    <Wrap>
      {!cruxes?.length && !adding && (
        <Empty>
          아직 고른 핵심 난제가 없습니다.<br />
          위 <strong>발견 사항</strong>에서 <strong>[핵심 난제로 ↓]</strong>를 눌러
          1~3개만 옮기세요. 여기 적은 것이 <strong>② 이슈</strong>에서 할 일로
          이어집니다.
        </Empty>
      )}

      {(cruxes || []).map((c, i) => (
        <Card key={c.id}>
          <Index>{i + 1}</Index>
          <Body>
            <TitleInput
              defaultValue={c.title}
              key={`t-${c.id}-${c.title}`}
              onBlur={e => {
                const v = e.target.value.trim();
                if (v && v !== c.title) onUpdate(c.id, { title: v });
                else e.target.value = c.title;
              }}
            />
            <RationaleInput
              defaultValue={c.rationale || ''}
              key={`r-${c.id}-${c.rationale || ''}`}
              placeholder="왜 이것이 핵심 난제인가. 근거 없이 고르면 그냥 인상입니다."
              onBlur={e => {
                if ((c.rationale || '') !== e.target.value) {
                  onUpdate(c.id, { rationale: e.target.value });
                }
              }}
            />
          </Body>
          <IconButton onClick={() => onDelete(c.id)} title="삭제">
            <Trash2 size={16} />
          </IconButton>
        </Card>
      ))}

      {cruxes?.length > RECOMMENDED_MAX && (
        <Warn>
          핵심 난제가 {cruxes.length}개입니다. 전부가 중요하면 아무것도 중요하지 않습니다 —
          {RECOMMENDED_MAX}개 이하로 좁히는 것을 권합니다.
        </Warn>
      )}

      {adding ? (
        <Card>
          <Index>{(cruxes?.length || 0) + 1}</Index>
          <Body>
            <TitleInput
              autoFocus
              value={draft}
              placeholder="올해 넘어야 할 결정적 지점"
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') { setDraft(''); setAdding(false); }
              }}
              onBlur={submit}
            />
          </Body>
        </Card>
      ) : (
        <AddButton onClick={() => setAdding(true)}>
          <Plus size={16} />
          핵심 난제 직접 추가
        </AddButton>
      )}
    </Wrap>
  );
};

export default CruxPanel;
