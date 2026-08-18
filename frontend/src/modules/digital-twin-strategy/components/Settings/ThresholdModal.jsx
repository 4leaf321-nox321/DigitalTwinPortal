import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { X, RotateCcw, BarChart3, Loader2 } from 'lucide-react';

// 진단 임계값 설정.
//
// 어느 값이 맞는지는 실제 데이터를 봐야 알 수 있고, 그 판단은 운영에서 이뤄진다.
// 코드에만 두면 조정할 때마다 배포가 필요해 반복이 끊긴다.

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
  width: min(640px, 100%);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.125rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
`;

const CloseButton = styled.button`
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  padding: 0.25rem;
  border-radius: 0.25rem;
  &:hover { color: #475569; background: #f1f5f9; }
`;

// 항목이 열여덟 개가 됐다. 평평하게 늘어놓으면 **어느 것이 무엇을 정하는지**
// 안 보이고, 그러면 조정해야 할 값을 찾다가 아무것도 안 바꾸게 된다.
const GroupHead = styled.div`
  margin: 1.25rem 0 0.25rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #475569;

  &:first-of-type { margin-top: 0; }
`;

const GroupNote = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 500;
  margin-top: 0.15rem;
  line-height: 1.5;
`;

// 무엇을 정하는 값인지에 따라 묶는다.
//
// ⚠️ **키 앞자리로 가른다.** 정의(definitions.THRESHOLDS)에 묶음 이름을 따로
//    적게 하면 새 항목을 넣을 때 그걸 빠뜨리고, 그러면 그 항목만 목록에서
//    사라진다. 여기서 안 걸린 것은 마지막 묶음이 받는다.
const GROUPS = [
  {
    label: '관측 · 지표',
    note: '포탈 데이터에서 계산한 값이 이 선을 넘으면 발견 사항으로 짚습니다.',
    match: (key) => !key.startsWith('survey_') && !key.startsWith('element_')
      && !key.startsWith('solution_'),
  },
  {
    label: '설문',
    note: '설문 응답에서 무엇을 짚을지. 실제 응답 분포를 보고 조정해야 하는 값들입니다.',
    match: (key) => key.startsWith('survey_'),
  },
  {
    label: '③ 분석 (SWOT 후보)',
    note: '진단 레벨의 어디까지를 강점·약점 후보로 낼지. 발견 사항과는 무관합니다.',
    match: (key) => key.startsWith('element_'),
  },
  {
    label: '④ 솔루션',
    note: '우선순위와 실행 연결. 한 해에 실제로 해내는 양은 조직마다 달라서, '
      + '이 값들은 특히 운영에서 한 바퀴 돌려 보고 정해야 합니다.',
    match: (key) => key.startsWith('solution_'),
  },
];

const Body = styled.div`
  padding: 1rem 1.25rem;
  overflow-y: auto;
`;

const Intro = styled.p`
  margin: 0 0 1rem;
  font-size: 0.8125rem;
  color: #64748b;
  line-height: 1.6;
`;

// ── 「이 값이면 몇 건인가」 ─────────────────────────────────────────────────
//
// ⚠️ **이 화면의 값들은 전부 짐작이다.** 조정 도구가 없으면 조정이 안 일어난다 —
//    지금까지는 값을 바꾸고 저장하고 진단 화면으로 가서 목록을 눈으로 세야 했다.
//
// ⚠️ 값 하나씩만 훑는다. 스물한 개를 한꺼번에 보면 삼 초를 기다려야 하고,
//    사람은 어차피 한 번에 하나를 만진다.
const PeekButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.4rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.3rem;
  background: white;
  color: #64748b;
  font-size: 0.6875rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { border-color: #7c3aed; color: #6d28d9; }
  &:disabled { opacity: 0.5; cursor: wait; }
`;

const Curve = styled.div`
  grid-column: 1 / -1;
  display: flex;
  align-items: flex-end;
  gap: 0.2rem;
  padding: 0.5rem 0 0.25rem;
`;

const Bar = styled.button`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  border: none;
  background: transparent;
  padding: 0;
  font-family: inherit;
  cursor: pointer;

  /* 막대. 지금 값은 진하게 — 기준이 안 보이면 비교가 안 된다. */
  &::before {
    content: '';
    width: 100%;
    height: ${p => p.$height}px;
    border-radius: 0.15rem 0.15rem 0 0;
    background: ${p => (p.$now ? '#7c3aed' : '#ddd6fe')};
  }
  &:hover::before { background: ${p => (p.$now ? '#6d28d9' : '#c4b5fd')}; }
`;

const BarLabel = styled.span`
  font-size: 0.5625rem;
  color: ${p => (p.$now ? '#6d28d9' : '#94a3b8')};
  font-weight: ${p => (p.$now ? 700 : 500)};
  white-space: nowrap;
`;

const CurveNote = styled.div`
  grid-column: 1 / -1;
  font-size: 0.6875rem;
  color: #94a3b8;
  line-height: 1.55;
  padding-bottom: 0.35rem;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr 110px 34px;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid #f1f5f9;
  &:last-child { border-bottom: none; }
`;

const Label = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
`;

const Detail = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.15rem;
  line-height: 1.5;
`;

const Changed = styled.span`
  margin-left: 0.375rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #7c3aed;
`;

const InputWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
`;

const Input = styled.input`
  width: 72px;
  padding: 0.4rem 0.55rem;
  border: 1px solid ${p => (p.$dirty ? '#c4b5fd' : '#e2e8f0')};
  background: ${p => (p.$dirty ? '#faf5ff' : 'white')};
  border-radius: 0.375rem;
  font-size: 0.875rem;
  text-align: right;
  color: #334155;
  &:focus { outline: none; border-color: #7c3aed; }
`;

const Unit = styled.span`
  font-size: 0.75rem;
  color: #94a3b8;
`;

const ResetButton = styled.button`
  border: none;
  background: transparent;
  color: ${p => (p.$active ? '#94a3b8' : '#e2e8f0')};
  cursor: ${p => (p.$active ? 'pointer' : 'default')};
  padding: 0.25rem;
  border-radius: 0.25rem;
  &:hover { color: ${p => (p.$active ? '#7c3aed' : '#e2e8f0')}; }
`;

const Foot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  border-top: 1px solid #e2e8f0;
`;

const Note = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
`;

const Actions = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
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
`;

const ErrorBox = styled.div`
  margin-bottom: 0.75rem;
  padding: 0.6rem 0.85rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.375rem;
  color: #b91c1c;
  font-size: 0.8125rem;
`;

// 무엇을 세는가. 화면이 「12건」의 「건」이 무엇인지 말해야 한다.
const COUNT_LABEL = {
  findings: '발견 사항',
  elementCandidates: '③ 요소 후보',
  nowSolutions: '④ 「먼저 한다」',
};

const ThresholdModal = ({ definitions, values, onSave, onPreview, onClose }) => {
  const [draft, setDraft] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  // 지금 설정이면 몇 건인가. 화면을 열 때 한 번만 센다.
  const [base, setBase] = useState(null);
  // {key: {points, now, counts, flat}} — 훑어 본 값만 들어 있다.
  const [curves, setCurves] = useState({});
  const [peeking, setPeeking] = useState(null);

  useEffect(() => {
    if (!onPreview) return;
    onPreview().then(d => setBase(d?.base || null));
  }, [onPreview]);

  const peek = async (key) => {
    if (curves[key]) {
      setCurves(c => ({ ...c, [key]: null }));   // 다시 누르면 접는다
      return;
    }
    setPeeking(key);
    try {
      const data = await onPreview(key);
      if (data) setCurves(c => ({ ...c, [key]: data }));
    } finally {
      setPeeking(null);
    }
  };

  useEffect(() => {
    const next = {};
    (definitions || []).forEach(d => {
      next[d.key] = String(values?.[d.key] ?? d.default);
    });
    setDraft(next);
  }, [definitions, values]);

  const isDirty = (d) => Number(draft[d.key]) !== d.default;

  const save = async () => {
    setError(null);
    const payload = {};
    for (const d of definitions || []) {
      const raw = String(draft[d.key] ?? '').trim();
      if (raw === '') {
        setError(`${d.label} 을(를) 비울 수 없습니다.`);
        return;
      }
      const n = Number(raw);
      if (Number.isNaN(n)) {
        setError(`${d.label} 은(는) 숫자여야 합니다.`);
        return;
      }
      payload[d.key] = n;
    }
    setSaving(true);
    try {
      await onSave(payload);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const changedCount = (definitions || []).filter(isDirty).length;

  const renderCurve = (d, curve) => {
    const top = Math.max(...curve.points.map(p => p.count), 1);
    return (
      <React.Fragment>
        <Curve>
          {curve.points.map(p => (
            <Bar
              key={p.value}
              $now={p.value === curve.now}
              // 0 건도 자리는 보여야 한다 — 막대가 아예 없으면 안 재 본 것처럼
              // 보인다. 그래서 최소 높이를 준다.
              $height={Math.max(3, Math.round((p.count / top) * 48))}
              title={`${p.value}${d.unit} 이면 ${p.count}건`}
              onClick={() => setDraft(v => ({ ...v, [d.key]: String(p.value) }))}
            >
              <BarLabel $now={p.value === curve.now}>{p.count}</BarLabel>
              <BarLabel $now={p.value === curve.now}>{p.value}</BarLabel>
            </Bar>
          ))}
        </Curve>
        <CurveNote>
          {curve.flat ? (
            <>
              <strong>이 값을 어디로 옮겨도 건수가 안 바뀝니다.</strong> 규칙이
              지금 데이터에서는 안 걸리거나, 이미 전부 걸려 있다는 뜻입니다 —
              이 값은 지금 아무 일도 하지 않습니다.
            </>
          ) : (
            <>
              막대는 <strong>{COUNT_LABEL[curve.counts] || curve.counts}</strong>{' '}
              건수입니다. 눌러서 그 값으로 넣을 수 있습니다.
              진한 막대가 지금 값입니다.
            </>
          )}
        </CurveNote>
      </React.Fragment>
    );
  };

  const renderRow = (d) => (
    <Row key={d.key}>
      <div>
        <Label>
          {d.label}
          {isDirty(d) && <Changed>변경됨</Changed>}
        </Label>
        <Detail>{d.detail}</Detail>
      </div>
      <InputWrap>
        <Input
          type="number"
          $dirty={isDirty(d)}
          value={draft[d.key] ?? ''}
          onChange={e => setDraft(v => ({ ...v, [d.key]: e.target.value }))}
        />
        <Unit>{d.unit}</Unit>
      </InputWrap>
      <ResetButton
        $active={isDirty(d)}
        onClick={() => isDirty(d) && setDraft(v => ({ ...v, [d.key]: String(d.default) }))}
        title={isDirty(d) ? `기본값(${d.default}${d.unit})으로 되돌리기` : '기본값입니다'}
      >
        <RotateCcw size={15} />
      </ResetButton>

      {onPreview && (
        <div style={{ gridColumn: '1 / -1', paddingTop: '0.15rem' }}>
          <PeekButton onClick={() => peek(d.key)} disabled={peeking === d.key}>
            {peeking === d.key
              ? <><Loader2 size={11} /> 세는 중…</>
              : <><BarChart3 size={11} /> {curves[d.key] ? '접기' : '이 값이면 몇 건?'}</>}
          </PeekButton>
        </div>
      )}

      {curves[d.key] && renderCurve(d, curves[d.key])}
    </Row>
  );

  return (
    <Backdrop onClick={onClose}>
      <Panel onClick={e => e.stopPropagation()}>
        <Head>
          <Title>진단 임계값</Title>
          <CloseButton onClick={onClose}><X size={18} /></CloseButton>
        </Head>

        <Body>
          <Intro>
            무엇을 짚고 무엇을 넘길지 정하는 값들입니다. 너무 느슨하면 아무것도 안
            걸리고, 너무 빡빡하면 전부 걸려 정작 중요한 것이 묻힙니다.
            기본값과 다른 항목만 저장되므로, 나중에 기본값이 바뀌면 손대지 않은
            항목은 새 기본값을 따라갑니다.
          </Intro>

          {base && (
            <Intro style={{ marginBottom: '0.75rem', color: '#475569' }}>
              지금 설정이면 <strong>발견 사항 {base.findings}건</strong> ·{' '}
              ③ 요소 후보 {base.elementCandidates}건 ·{' '}
              ④ 「먼저 한다」 {base.nowSolutions}건입니다.
            </Intro>
          )}

          {error && <ErrorBox>{error}</ErrorBox>}

          {GROUPS.map(group => {
            const items = (definitions || []).filter(d => group.match(d.key));
            if (items.length === 0) return null;
            return (
              <React.Fragment key={group.label}>
                <GroupHead>
                  {group.label}
                  <GroupNote>{group.note}</GroupNote>
                </GroupHead>
                {items.map(renderRow)}
              </React.Fragment>
            );
          })}
        </Body>

        <Foot>
          <Note>
            {changedCount ? `기본값과 다른 항목 ${changedCount}개` : '전부 기본값입니다'}
          </Note>
          <Actions>
            <Button onClick={onClose}>취소</Button>
            <PrimaryButton onClick={save} disabled={saving}>
              {saving ? '저장 중…' : '저장'}
            </PrimaryButton>
          </Actions>
        </Foot>
      </Panel>
    </Backdrop>
  );
};

export default ThresholdModal;
