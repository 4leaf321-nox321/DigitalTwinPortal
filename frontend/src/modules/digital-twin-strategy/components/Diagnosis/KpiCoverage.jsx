import React from 'react';
import styled from 'styled-components';

// 지표 쪽에서 본 공백.
// 사업부별 집계는 "이 조직이 지표에 얼마나 걸려 있나"를 보지만, 뒤집어서
// "이 지표를 실제로 미는 과제가 있는가"를 봐야 드러나는 것이 있다.
//
// ⚠️ 등급은 순서척도라 합치지 않는다. 주/보조/간접을 각각 센다.

const Wrap = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  overflow-x: auto;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(180px, 1.6fr) repeat(4, 72px) minmax(140px, 1fr);
  min-width: 640px;
`;

const Cell = styled.div`
  padding: 0.65rem 0.875rem;
  border-bottom: 1px solid #f1f5f9;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
`;

const HeadCell = styled(Cell)`
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #475569;
  justify-content: ${p => (p.$center ? 'center' : 'flex-start')};
`;

const NameCell = styled(Cell)`
  font-weight: 600;
  color: ${p => (p.$alert ? '#b91c1c' : '#1e293b')};
`;

const NumCell = styled(Cell)`
  justify-content: center;
  font-weight: 700;
  color: ${p => p.$color || '#334155'};
  background: ${p => p.$bg || 'transparent'};
`;

const DivCell = styled(Cell)`
  color: #64748b;
  font-size: 0.8125rem;
`;

const Empty = styled.div`
  padding: 1.5rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.875rem;
`;

const KpiCoverage = ({ coverage }) => {
  if (!coverage?.length) {
    return <Wrap><Empty>지표 연결 데이터가 없습니다.</Empty></Wrap>;
  }

  return (
    <Wrap>
      <Grid>
        <HeadCell>지표</HeadCell>
        <HeadCell $center title="이 과제가 없으면 목표 달성이 어렵다">주</HeadCell>
        <HeadCell $center title="기여하지만 다른 과제로도 대체 가능하다">보조</HeadCell>
        <HeadCell $center title="기반·환경을 만든다">간접</HeadCell>
        <HeadCell $center title="등급을 정하지 않은 연결">미지정</HeadCell>
        <HeadCell>다루는 사업부</HeadCell>

        {coverage.map(row => {
          const noPrimary = row.primary === 0;
          return (
            <React.Fragment key={row.kpi}>
              <NameCell $alert={noPrimary} title={noPrimary ? '주기여로 미는 과제가 없습니다' : ''}>
                {row.kpi}
              </NameCell>
              <NumCell
                $color={noPrimary ? '#b91c1c' : '#047857'}
                $bg={noPrimary ? '#fef2f2' : undefined}
              >
                {row.primary}
              </NumCell>
              <NumCell>{row.support}</NumCell>
              <NumCell>{row.indirect}</NumCell>
              <NumCell $color={row.unset ? '#b45309' : '#cbd5e1'}>
                {row.unset}
              </NumCell>
              <DivCell title={row.divisions.join(', ')}>
                {row.divisions.length ? row.divisions.join(', ') : '—'}
              </DivCell>
            </React.Fragment>
          );
        })}
      </Grid>
    </Wrap>
  );
};

export default KpiCoverage;
