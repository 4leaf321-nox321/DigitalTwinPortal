import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import {
  Download, Lock, Unlock, AlertTriangle, Info, Check,
} from 'lucide-react';
import FlowMap from '../FlowMap';

// ⑤ 기획서 — ①~④ 를 문서로 조립한다.
//
// ⚠️ **여기서 다시 적지 않는다.** 진단·이슈·SWOT·솔루션은 이미 각 단계에 있다.
//    문서가 그것을 옮겨 적게 하면 그 순간부터 둘이 갈라지고, 며칠 뒤에는 어느
//    쪽이 맞는지 아무도 모른다. 사람이 쓰는 것은 어느 단계도 만들어 줄 수 없는
//    것(배경·맺음말)뿐이다.
//
// ⚠️ **빈 장을 감추지 않는다.** 문서로는 깔끔하지만, 읽는 사람은 그 장이 없다는
//    것 자체를 모른 채 "검토했겠거니" 한다.

const Layout = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
`;

const Wrap = styled.div`
  flex: 1 1 auto;
  min-width: 0;
  max-width: 1120px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Head = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.625rem;
  flex-wrap: wrap;
`;

const StepBadge = styled.span`
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: #ede9fe;
  color: #6d28d9;
  font-size: 0.75rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
`;

const Hint = styled.span`
  font-size: 0.8125rem;
  color: #94a3b8;
`;

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  padding: 0.6rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid ${p => (p.$locked ? '#bbf7d0' : '#e2e8f0')};
  background: ${p => (p.$locked ? '#f0fdf4' : 'white')};
`;

const State = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: ${p => (p.$locked ? '#15803d' : '#b45309')};
`;

const Spacer = styled.div`flex: 1;`;

const Button = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.7rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  background: white;
  color: #475569;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { border-color: #7c3aed; color: #6d28d9; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const PrimaryButton = styled(Button)`
  border: none;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  &:hover { color: white; box-shadow: 0 3px 10px rgba(139, 92, 246, 0.3); }
`;

const Notice = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 0.6rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid #fde68a;
  background: #fffdf5;
  color: #92400e;
  font-size: 0.75rem;
  line-height: 1.6;
`;

// 종이처럼 보여야 한다. 이게 문서라는 것이 한눈에 읽혀야 「확정」이 무슨 뜻인지
// 설명하지 않아도 통한다.
const Paper = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 2rem 2.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
`;

const DocTitle = styled.div`
  text-align: center;
  font-size: 1.375rem;
  font-weight: 800;
  color: #1e293b;
`;

const DocSub = styled.div`
  text-align: center;
  font-size: 0.75rem;
  color: ${p => (p.$draft ? '#b45309' : '#94a3b8')};
  margin-top: 0.35rem;
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  opacity: ${p => (p.$off ? 0.45 : 1)};
`;

const SectionHead = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid #e2e8f0;
`;

const SectionTitle = styled.h4`
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1e293b;
`;

const Kind = styled.span`
  padding: 0.05rem 0.35rem;
  border-radius: 0.25rem;
  background: ${p => (p.$manual ? '#fef3c7' : '#f1f5f9')};
  color: ${p => (p.$manual ? '#92400e' : '#64748b')};
  font-size: 0.625rem;
  font-weight: 700;
`;

const Toggle = styled.button`
  margin-left: auto;
  padding: 0.1rem 0.4rem;
  border: 1px solid ${p => (p.$on ? '#e2e8f0' : '#cbd5e1')};
  border-radius: 0.25rem;
  background: ${p => (p.$on ? 'transparent' : '#f1f5f9')};
  color: ${p => (p.$on ? '#cbd5e1' : '#475569')};
  font-size: 0.6875rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { color: #475569; }
`;

const EmptyMark = styled.div`
  padding: 0.5rem 0;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: #b45309;
`;

const Text = styled.p`
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.75;
  color: #334155;
  white-space: pre-wrap;
`;

const Note = styled.p`
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.6;
  color: #94a3b8;
`;

const Bullet = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  font-size: 0.875rem;
  line-height: 1.7;
  color: #334155;

  &::before {
    content: '·';
    flex-shrink: 0;
    color: #cbd5e1;
    font-weight: 800;
  }
`;

const BulletDetail = styled.div`
  font-size: 0.75rem;
  line-height: 1.6;
  color: #94a3b8;
  padding-left: 0.9rem;
  white-space: pre-wrap;
`;

const Tag = styled.span`
  flex-shrink: 0;
  margin-left: 0.35rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #94a3b8;
`;

const TableWrap = styled.div`
  overflow-x: auto;
`;

const Table = styled.table`
  border-collapse: collapse;
  font-size: 0.8125rem;
  th, td {
    border: 1px solid #e2e8f0;
    padding: 0.3rem 0.55rem;
    text-align: center;
    color: #334155;
    white-space: nowrap;
  }
  th { background: #f8fafc; font-weight: 700; color: #475569; }
  td:first-child, th:first-child { text-align: left; }
`;

const Editor = styled.textarea`
  width: 100%;
  min-height: 6rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-family: inherit;
  line-height: 1.7;
  color: #1e293b;
  resize: vertical;
  &:focus { outline: none; border-color: #7c3aed; }
  &:disabled { background: #f8fafc; color: #64748b; }
`;

const Block = ({ block }) => {
  if (block.type === 'text') return <Text>{block.text}</Text>;
  if (block.type === 'note') return <Note>{block.text}</Note>;
  if (block.type === 'table') {
    return (
      <TableWrap>
        <Table>
          <thead>
            <tr>{(block.head || []).map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {(block.rows || []).map((row, i) => (
              <tr key={i}>{row.map((c, j) => <td key={j}>{c}</td>)}</tr>
            ))}
          </tbody>
        </Table>
      </TableWrap>
    );
  }
  if (block.type === 'list') {
    return (
      <div>
        {(block.items || []).map((item, i) => (
          <div key={i}>
            <Bullet>
              <div>
                {item.title}
                {item.tag && <Tag>[{item.tag}]</Tag>}
              </div>
            </Bullet>
            {item.detail && <BulletDetail>{item.detail}</BulletDetail>}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const DocumentView = ({ year, doc, canEdit, onSave, onSetStatus, onExport }) => {
  // 손으로 쓰는 구간의 초안. 글자마다 저장하면 그때마다 문서를 다시 조립한다.
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);

  const sections = doc?.sections || [];
  // 확정본이거나 편집 권한이 없으면 못 고친다. 화면에서는 같은 상태다.
  const confirmed = doc?.status === 'confirmed';
  const locked = confirmed || !canEdit;

  useEffect(() => {
    const next = {};
    sections.filter(s => s.kind === 'manual').forEach(s => {
      next[s.key] = (s.blocks?.[0]?.text) || '';
    });
    setDrafts(next);
    // doc 이 바뀔 때만 초안을 다시 맞춘다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  const dirty = sections.some(s => s.kind === 'manual'
    && (drafts[s.key] ?? '') !== ((s.blocks?.[0]?.text) || ''));

  const saveText = async () => {
    const payload = {};
    sections.filter(s => s.kind === 'manual').forEach(s => {
      payload[s.key] = { text: drafts[s.key] ?? '' };
    });
    setBusy(true);
    try { await onSave(payload); } finally { setBusy(false); }
  };

  const toggle = (key, included) => onSave({ [key]: { included: !included } });

  const flow = [
    { kind: 'group', label: '① ~ ④ 에서' },
    { kind: 'node', id: 'sec-doc', label: '기획서로 조립' },
    { kind: 'branch', into: true, text: <>배경·맺음말만 <strong>사람이</strong></> },
    { kind: 'link', note: '확정하면 굳는다' },
    { kind: 'exit', label: 'Word 내보내기' },
  ];

  if (!doc) return null;

  return (
    <Layout>
      <FlowMap items={flow} />
      <Wrap>
        <Head>
          <StepBadge>5</StepBadge>
          <Title>기획서</Title>
          <Hint>
            앞 단계를 <strong>조립합니다.</strong> 여기서 다시 적지 않습니다 —
            진단을 고치면 이 문서도 따라 바뀝니다.
          </Hint>
        </Head>

        <Bar $locked={confirmed}>
          <State $locked={confirmed}>
            {confirmed ? <Lock size={14} /> : <Unlock size={14} />}
            {confirmed
              ? `확정본 · ${(doc.confirmedAt || '').slice(0, 10)}`
              : '초안 — 앞 단계를 고치면 따라 바뀝니다'}
          </State>
          <Spacer />
          {dirty && !locked && (
            <PrimaryButton onClick={saveText} disabled={busy}>
              <Check size={14} /> 글 저장
            </PrimaryButton>
          )}
          {/* 확정·되돌리기는 편집 권한자만. 내보내기는 조회로 충분하다. */}
          {canEdit && (
            <Button onClick={() => onSetStatus(confirmed ? 'draft' : 'confirmed')}>
              {confirmed ? <><Unlock size={14} /> 초안으로 되돌리기</>
                         : <><Lock size={14} /> 이 시점으로 확정</>}
            </Button>
          )}
          <Button onClick={onExport}><Download size={14} /> Word 내보내기</Button>
        </Bar>

        {/* ⚠️ 세어서 보여주기만 한다. 비었다고 막으면 아무 말이나 채워 넣는다. */}
        {doc.summary?.emptyTitles?.length > 0 && (
          <Notice>
            <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <span>
              아직 비어 있는 장: <strong>{doc.summary.emptyTitles.join(' · ')}</strong>.
              그대로 내보내도 되지만, 문서에는 <strong>「아직 비어 있습니다」로
              찍힙니다</strong> — 없는 것을 없다고 적어야 검토가 됩니다.
            </span>
          </Notice>
        )}

        {confirmed && (
          <Notice style={{ borderColor: '#bbf7d0', background: '#f0fdf4', color: '#15803d' }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
            <span>
              확정한 시점의 내용으로 <strong>굳어 있습니다.</strong> 앞 단계를 고쳐도
              이 문서는 안 바뀝니다 — 승인받은 문서가 뒤에서 달라지면 그 문서로 한
              결정을 되짚을 수 없기 때문입니다. 고치려면 초안으로 되돌리세요.
            </span>
          </Notice>
        )}

        <Paper id="sec-doc">
          <div>
            <DocTitle>{year}년 디지털 트윈 전략 기획서</DocTitle>
            <DocSub $draft={!locked}>
              {locked ? `확정 ${(doc.confirmedAt || '').slice(0, 10)}`
                      : '초안 — 확정 전입니다'}
            </DocSub>
          </div>

          {sections.map(s => (
            <Section key={s.key} $off={!s.included}>
              <SectionHead>
                <SectionTitle>{s.title}</SectionTitle>
                <Kind $manual={s.kind === 'manual'}>
                  {s.kind === 'manual' ? '직접 작성' : '자동 조립'}
                </Kind>
                {canEdit && !confirmed && (
                  <Toggle $on={s.included} onClick={() => toggle(s.key, s.included)}>
                    {s.included ? '빼기' : '넣기'}
                  </Toggle>
                )}
              </SectionHead>

              {!s.included ? (
                <Note>이 장은 문서에서 뺐습니다. 목차에는 남습니다 — 왜 빠졌는지
                  다음 사람이 알 수 있어야 합니다.</Note>
              ) : s.kind === 'manual' ? (
                <Editor
                  value={drafts[s.key] ?? ''}
                  disabled={locked}
                  onChange={e => setDrafts(d => ({ ...d, [s.key]: e.target.value }))}
                  placeholder={s.hint}
                />
              ) : s.empty ? (
                <EmptyMark>
                  아직 비어 있습니다. {s.hint}
                </EmptyMark>
              ) : (
                s.blocks.map((b, i) => <Block key={i} block={b} />)
              )}
            </Section>
          ))}
        </Paper>
      </Wrap>
    </Layout>
  );
};

export default DocumentView;
