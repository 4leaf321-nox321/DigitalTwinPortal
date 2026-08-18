import React, { useState } from 'react';
import styled from 'styled-components';
import { X, ArrowDown, AlertTriangle } from 'lucide-react';

// 발견 사항을 핵심 난제로 올릴 때 **제목을 다시 쓰게 한다.**
//
// ⚠️ 한동안 발견 사항 제목을 그대로 복사했다. 그랬더니 난제 목록이 이렇게 됐다
//    (2026-08-17 한 사이클 실측):
//
//        · NW 과제 55.0% 가 성과를 정의하지 않았습니다      이슈 없음
//        · DA 과제의 72.2% 를 DA1팀이 맡고 있습니다        이슈 없음
//        · "시뮬레이션 활용률"을 주기여로 미는 과제가 없습니다  이슈 없음
//
//    전부 **관측**이지 「넘어야 할 지점」이 아니다. 그리고 관측은 그 자체로는
//    할 일이 안 나오니 이슈가 0건으로 남는다. 열 개 중 여덟 개가 그랬다.
//    이 목록이 기획서 첫 장에 그대로 실린다.
//
// ⚠️ **발견 사항 문장은 근거로 내려간다.** 지우지 않는다 — 왜 이것을 난제로
//    골랐는지가 거기 있다. 사람이 쓰는 것은 그 사실이 **말하는 바**다.

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1.5rem;
`;

const Panel = styled.div`
  background: white;
  border-radius: 0.75rem;
  width: min(560px, 100%);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
`;

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 1.125rem 1.25rem 0.75rem;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
`;

const CloseButton = styled.button`
  margin-left: auto;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  &:hover { color: #475569; background: #f1f5f9; }
`;

const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0 1.25rem 1rem;
`;

// 근거. 읽기 전용이다 — 관측을 사람이 고치면 그건 더 이상 관측이 아니다.
const Source = styled.div`
  padding: 0.6rem 0.75rem;
  border-radius: 0.5rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: #334155;
`;

const SourceLabel = styled.div`
  font-size: 0.6875rem;
  font-weight: 700;
  color: #94a3b8;
  margin-bottom: 0.2rem;
`;

const Ask = styled.label`
  display: block;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1e293b;
`;

const Hint = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.6;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.9375rem;
  font-family: inherit;
  color: #1e293b;
  &:focus { outline: none; border-color: #7c3aed; }
`;

const Warn = styled.div`
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

const Foot = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.875rem 1.25rem;
  border-top: 1px solid #e2e8f0;
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid #e2e8f0;
  background: white;
  color: #475569;
  &:hover { border-color: #cbd5e1; }
`;

const PrimaryButton = styled(Button)`
  border: none;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  &:hover { box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3); }
  &:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
`;

// 이보다 많으면 난제가 아니라 목록이다. CruxPanel 의 경고와 같은 수.
const RECOMMENDED_MAX = 3;

const PromoteCrux = ({ finding, cruxCount, onConfirm, onCancel }) => {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const value = title.trim();
    if (!value) return;
    setBusy(true);
    try {
      await onConfirm({
        title: value,
        // 발견 사항 문장이 근거로 내려간다. 「왜 이것이 난제인가」가 여기 있다.
        rationale: [finding.title, finding.detail].filter(Boolean).join('\n'),
        division_id: finding.division_id ?? null,
        source_finding: finding.key,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Backdrop onClick={onCancel}>
      <Panel onClick={e => e.stopPropagation()}>
        <Head>
          <Title>핵심 난제로 올리기</Title>
          <CloseButton onClick={onCancel}><X size={18} /></CloseButton>
        </Head>

        <Body>
          <div>
            <SourceLabel>근거로 남습니다 — 고칠 수 없습니다</SourceLabel>
            <Source>
              {finding.title}
              {finding.detail && (
                <div style={{ color: '#94a3b8', marginTop: '0.25rem' }}>
                  {finding.detail}
                </div>
              )}
            </Source>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <ArrowDown size={16} color="#cbd5e1" />
          </div>

          <div>
            <Ask htmlFor="crux-title">
              이 사실이 말하는 「넘어야 할 지점」은 무엇입니까?
            </Ask>
            <Hint style={{ margin: '0.25rem 0 0.4rem' }}>
              위 문장을 그대로 옮기지 마세요. 그건 <strong>관측</strong>이지
              넘어야 할 지점이 아닙니다 — 관측은 그 자체로는 할 일이 안 나와서,
              이슈가 하나도 안 달린 난제로 남습니다.
              <br />
              예: 「NW 과제 55%가 성과를 정의하지 않았습니다」 →{' '}
              <strong>「성과를 정하지 않고 과제를 시작한다」</strong>
            </Hint>
            <Input
              id="crux-title"
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              placeholder="올해 넘어야 할 결정적 지점"
            />
          </div>

          {cruxCount >= RECOMMENDED_MAX && (
            <Warn>
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: '0.15rem' }} />
              <span>
                핵심 난제가 이미 <strong>{cruxCount}개</strong>입니다. 넷 이상이면
                난제가 아니라 목록이 됩니다 — 이 사실이 <strong>기존 난제 아래의
                이슈</strong>로 들어갈 수 있는지 먼저 보세요.
              </span>
            </Warn>
          )}
        </Body>

        <Foot>
          <Button onClick={onCancel}>취소</Button>
          <PrimaryButton disabled={!title.trim() || busy} onClick={submit}>
            {busy ? '올리는 중…' : '핵심 난제로'}
          </PrimaryButton>
        </Foot>
      </Panel>
    </Backdrop>
  );
};

export default PromoteCrux;
