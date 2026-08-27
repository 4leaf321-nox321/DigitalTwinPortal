import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import maturityApi from '../../services/maturityApi';
import { PairPanel } from './PairModal';

// 쌍 상세를 **옆에** 심는다 — 목록 탭에서 시뮬레이션 칸을 누르면 오른쪽에 뜬다.
// 속(PairPanel)은 모달과 같은 부품이다. 읽기만 여기서 하고, 저장은 속이 한다.

const Box = styled.section`
  border: 1px solid #e2e8f0; border-radius: 0.5rem; background: white; min-height: 0; height: 100%;
  display: flex; flex-direction: column; overflow: hidden;
`;
const Empty = styled.div`
  flex: 1; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 0.8125rem;
  padding: 2rem; text-align: center; line-height: 1.6;
`;

const PairSide = ({ pairId, axes, onChanged, onClose }) => {
  const [pair, setPair] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pairId) { setPair(null); return undefined; }
    let alive = true;
    setPair(null);
    maturityApi.getPair(pairId)
      .then(r => { if (alive) { setPair(r.data); setError(null); } })
      .catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [pairId]);

  if (!pairId) {
    return (
      <Box>
        <Empty>왼쪽 표에서 <strong>&nbsp;시뮬레이션&nbsp;</strong> 칸을 누르면<br />그 시험 × 시뮬레이션의 사다리가 여기에 나옵니다.</Empty>
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
