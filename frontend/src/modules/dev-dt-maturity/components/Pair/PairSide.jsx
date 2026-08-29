import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import maturityApi from '../../services/maturityApi';
import { PairPanel } from './PairModal';

// 연계 상세를 **옆에** 심는다 — 목록 탭에서 시뮬레이션 칸을 누르면 오른쪽에 뜬다.
// 속(PairPanel)은 모달과 같은 부품이다. 읽기만 여기서 하고, 저장은 속이 한다.

const Box = styled.section`
  border: 1px solid #e2e8f0; border-radius: 0.5rem; background: white; min-height: 0; height: 100%;
  display: flex; flex-direction: column; overflow: hidden;
`;
// ⚠️ 가운데 맞춤은 **안쪽 문단에** 건다(2026-08-29). 이 칸이 곧바로 flex 면 글자 토막·굵은 글씨가
//    저마다 flex 항목이 되어 제 마음대로 줄이 갈린다(<br> 도 안 듣는다).
const Empty = styled.div`
  flex: 1; display: flex; align-items: center; justify-content: center; padding: 2rem;
  p { margin: 0; max-width: 22rem; text-align: center; color: #94a3b8; font-size: 0.8125rem; line-height: 1.7; }
  strong { color: #475569; font-weight: 700; }
`;

const PairSide = ({ pairId, axes, onChanged, onClose }) => {
  const [pair, setPair] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pairId) { setPair(null); return undefined; }
    let alive = true;
    setPair(null);
    maturityApi.getPair(pairId)
      .then(r => { if (!alive) return; if (!r.data?.id) { setPair(null); setError('없는 연계입니다 — 지워졌거나 샘플에 없는 것입니다.'); return; } setPair(r.data); setError(null); })
      .catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [pairId]);

  if (!pairId) {
    return (
      <Box>
        <Empty><p>왼쪽 표에서 <strong>줄</strong>을 누르면 그 연계의 평가 척도가 여기에 나옵니다.</p></Empty>
      </Box>
    );
  }
  return (
    <Box>
      <PairPanel pair={pair} pairId={pairId} axes={axes} loadError={error} onClose={onClose}
                 onSaved={(data) => { setPair(p => ({ ...p, ...data })); if (onChanged) onChanged(); }} />
    </Box>
  );
};

export default PairSide;
