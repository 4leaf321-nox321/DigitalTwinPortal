import React, { useState } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';

// 진단 격차에서 뽑은 이슈 후보.
//
// 백지에서 시작하지 않게 하는 장치다. 다만 **자동으로 이슈가 되지는 않는다** —
// 격차가 곧 이슈는 아니기 때문이다. 목표를 높게 잡아서 생긴 격차일 수도 있고,
// 그건 이슈가 아니라 목표를 고칠 일이다. 사람이 고른다.

const Wrap = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  overflow: hidden;
`;

const Head = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border: none;
  background: #f8fafc;
  cursor: pointer;
  font: inherit;
  text-align: left;
  color: #475569;

  &:hover { background: #f1f5f9; }
`;

const HeadTitle = styled.span`
  font-size: 0.875rem;
  font-weight: 600;
  color: #334155;
`;

const Count = styled.span`
  font-size: 0.8125rem;
  font-weight: 700;
  color: #7c3aed;
`;

const Hint = styled.span`
  font-size: 0.8125rem;
  color: #94a3b8;
  margin-left: auto;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
`;

const Item = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid #f1f5f9;

  &:hover { background: #fafafa; }
`;

const Body = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
`;

const Detail = styled.div`
  font-size: 0.8125rem;
  color: #64748b;
  line-height: 1.5;
  margin-top: 0.15rem;
`;

const Group = styled.span`
  display: inline-block;
  padding: 0.1rem 0.45rem;
  margin-right: 0.4rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  background: #eef2ff;
  color: #4f46e5;
`;

const AddButton = styled.button`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.35rem 0.65rem;
  border: 1px solid #ddd6fe;
  border-radius: 0.375rem;
  background: #f5f3ff;
  color: #6d28d9;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;

  &:hover { background: #ede9fe; border-color: #c4b5fd; }
`;

const Empty = styled.div`
  padding: 1.25rem 1rem;
  border-top: 1px solid #f1f5f9;
  color: #94a3b8;
  font-size: 0.8125rem;
  line-height: 1.6;
`;

const Bundle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.6rem 0.75rem;
  margin-bottom: 0.4rem;
  background: #faf5ff;
  border: 1px solid #ddd6fe;
  border-radius: 0.5rem;
`;

const BundleInput = styled.input`
  flex: 1;
  min-width: 12rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-family: inherit;
  color: #1e293b;
  &:focus { outline: none; border-color: #7c3aed; }
`;

const BundleButton = styled.button`
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 0.375rem;
  background: #7c3aed;
  color: white;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const Check = styled.input`
  margin-top: 0.2rem;
  flex-shrink: 0;
`;

const CandidatePanel = ({ candidates, onPick, onBundle }) => {
  const [open, setOpen] = useState(false);
  // 묶어서 새 난제로 만들 후보들. **여기가 없으면** 후보 여럿을 한 난제로
  // 묶으려면 하나씩 「난제 비움」으로 저장해 고아로 만든 뒤 다시 골라야 한다 —
  // 세 건이면 대화상자를 네 번 연다.
  const [picked, setPicked] = useState([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (key) => setPicked(prev => (
    prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]
  ));

  const bundle = async () => {
    const name = title.trim();
    if (!name || picked.length === 0) return;
    setBusy(true);
    try {
      const chosen = candidates.filter(c => picked.includes(c.key));
      const ok = await onBundle({
        title: name,
        new_issues: chosen.map(c => ({
          title: c.title,
          description: c.detail,
          division_id: c.division_id,
          source_type: c.source_type,
          source_ref: c.source_ref,
        })),
      });
      if (ok !== false) {
        setPicked([]);
        setTitle('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Wrap>
      <Head onClick={() => setOpen(v => !v)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <HeadTitle>진단 격차에서 가져오기</HeadTitle>
        {candidates.length > 0 && <Count>{candidates.length}건</Count>}
        <Hint>목표를 정한 항목 중 차이가 큰 것</Hint>
      </Head>

      {open && (
        <List>
          {candidates.length === 0 ? (
            <Empty>
              가져올 격차가 없습니다. 진단에서 <strong>목표 수준</strong>이나
              {' '}<strong>지표 목표값</strong>을 정하면 현재와의 차이가 여기에 후보로 뜹니다.
              목표를 안 정하면 격차를 말할 수 없습니다.
            </Empty>
          ) : (
            <>
              {/* 여러 후보를 관통하는 하나가 보이면 그것이 난제다. 하나씩
                  이슈로 만들어 고아로 쌓았다가 다시 묶는 것과 결과는 같지만,
                  그 길은 대화상자를 후보 수 + 1 번 연다. */}
              <Bundle>
                <BundleInput
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={picked.length > 0
                    ? `고른 ${picked.length}건을 관통하는 난제는 무엇입니까?`
                    : '아래에서 묶을 후보를 고르면 새 난제로 만들 수 있습니다'}
                  disabled={picked.length === 0}
                />
                <BundleButton
                  disabled={busy || picked.length === 0 || !title.trim()}
                  onClick={bundle}
                >
                  {picked.length > 0
                    ? `${picked.length}건을 새 난제로`
                    : '새 난제로 묶기'}
                </BundleButton>
              </Bundle>

              {candidates.map(c => (
                <Item key={c.key}>
                  <Check
                    type="checkbox"
                    checked={picked.includes(c.key)}
                    onChange={() => toggle(c.key)}
                    aria-label={`${c.title} 묶기`}
                  />
                  <Body>
                    <Title><Group>{c.group}</Group>{c.title}</Title>
                    <Detail>{c.detail}</Detail>
                  </Body>
                  <AddButton onClick={() => onPick(c)}
                             title="이 격차 하나를 이슈로 만듭니다">
                    <Plus size={13} />
                    이슈로
                  </AddButton>
                </Item>
              ))}
            </>
          )}
        </List>
      )}
    </Wrap>
  );
};

export default CandidatePanel;
