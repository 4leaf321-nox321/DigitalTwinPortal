import React, { useMemo } from 'react';
import styled from 'styled-components';

const Wrapper = styled.div`
  flex: 1;
  overflow: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const StatsRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const StatBadge = styled.span`
  font-size: 0.75rem;
  color: ${p => p.$color || '#64748b'};
  font-weight: 500;
  & > strong { font-weight: 700; }
`;

const GridContainer = styled.div`
  flex: 1;
  overflow: auto;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #e2e8f0;
`;

const Table = styled.div`
  display: grid;
  grid-template-columns: 200px repeat(${p => p.$cols}, auto);
  width: fit-content;
  min-width: 100%;
`;

/* ── 헤더 셀 ── */
const CornerCell = styled.div`
  position: sticky;
  top: 0;
  left: 0;
  z-index: 4;
  background: #f1f5f9;
  color: #64748b;
  font-size: 0.7rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border-right: 1px solid #e2e8f0;
  border-bottom: 2px solid #cbd5e1;
  padding: 8px 4px;
`;

const DivHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: 3;
  background: #f1f5f9;
  color: #1e293b;
  font-size: 0.72rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  border-right: 1px solid #e2e8f0;
  border-bottom: 2px solid #cbd5e1;
  padding: 8px 6px;
  word-break: keep-all;
`;

const ClassLabel = styled.div`
  position: sticky;
  left: 0;
  z-index: 2;
  background: #f8fafc;
  color: #1e293b;
  font-size: 0.72rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  border-right: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  padding: 6px 8px;
  word-break: keep-all;
`;

/* ── 셀: 타일들을 담는 컨테이너 ── */
const CellBox = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  border-right: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  padding: 2px;
  min-height: 110px;
`;

const TILE_SIZE = 110;

// 구분(category)별 색상 팔레트 (어두운 배경 + 흰 글씨)
const CATEGORY_COLORS = {
  '시뮬레이션':   { bg: '#2563eb', border: '#1d4ed8', text: '#ffffff' },
  '검증 자동화':  { bg: '#16a34a', border: '#15803d', text: '#ffffff' },
  '설계 자동화':  { bg: '#d97706', border: '#b45309', text: '#ffffff' },
};
const DEFAULT_CAT_COLOR = { bg: '#64748b', border: '#475569', text: '#ffffff' };
const getCatColor = (cat) => CATEGORY_COLORS[cat] || DEFAULT_CAT_COLOR;

/* ── 개별 타일 (정사각형) ── */
const Tile = styled.div`
  width: ${TILE_SIZE}px;
  height: ${TILE_SIZE}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 4px;
  text-align: center;
  border: 1px solid ${p => p.$catColor?.border || '#e2e8f0'};
  background: ${p => p.$catColor?.bg || '#f1f5f9'};
  cursor: default;
  transition: filter 0.15s;
  &:hover { filter: brightness(0.93); }
`;

const TileText = styled.div`
  font-size: 0.62rem;
  font-weight: 600;
  line-height: 1.35;
  color: ${p => p.$catColor?.text || '#475569'};
  word-break: keep-all;
  overflow-wrap: break-word;
`;

const TileDetail = styled.div`
  font-size: 0.56rem;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 2px;
`;


const EmptyText = styled.div`
  text-align: center;
  padding: 40px 0;
  font-size: 0.9rem;
  color: #94a3b8;
`;

const SeedbedView = ({ tasks = [], divisions = [], roadmapConfig }) => {
  const itemClassification = roadmapConfig?.itemClassification || {};

  // 활성 사업부
  const activeDivisions = useMemo(() => {
    const divIds = new Set(tasks.map(t => t.divisionId).filter(Boolean));
    return divisions.filter(d => divIds.has(d.id));
  }, [tasks, divisions]);

  // 분류 목록
  const classifications = useMemo(() => {
    const set = new Set();
    const seen = new Set();
    tasks.forEach(t => {
      if (!t.testItem || seen.has(t.testItem)) return;
      seen.add(t.testItem);
      set.add(itemClassification[t.testItem] || '미분류');
    });
    const sorted = [...set].filter(c => c !== '미분류').sort();
    if (set.has('미분류')) sorted.push('미분류');
    return sorted;
  }, [tasks, itemClassification]);

  // 셀 데이터: { `${testItem}__${divisionId}` → { status, details, names } }
  const cellData = useMemo(() => {
    const m = {};
    tasks.forEach(t => {
      if (!t.testItem) return;
      const key = `${t.testItem}__${t.divisionId || ''}`;
      if (!m[key]) {
        m[key] = { statuses: new Set(), categories: new Set(), details: new Set(), names: [] };
      }
      const entry = m[key];
      if (t.status) entry.statuses.add(t.status);
      if (t.category) entry.categories.add(t.category);
      if (t.testItemDetail) {
        t.testItemDetail.split(',').map(s => s.trim()).filter(Boolean)
          .forEach(d => entry.details.add(d));
      }
      entry.names.push(t.name);
    });
    const result = {};
    Object.entries(m).forEach(([key, entry]) => {
      let status = '계획';
      if (entry.statuses.has('진행')) status = '진행';
      else if (entry.statuses.has('완료') && entry.statuses.size === 1) status = '완료';
      const category = [...entry.categories][0] || '';
      result[key] = { status, category, details: [...entry.details], names: entry.names };
    });
    return result;
  }, [tasks]);

  // 분류별 항목 목록
  const itemsByClass = useMemo(() => {
    const map = {};
    const seen = new Set();
    tasks.forEach(t => {
      if (!t.testItem || seen.has(t.testItem)) return;
      seen.add(t.testItem);
      const cls = itemClassification[t.testItem] || '미분류';
      if (!map[cls]) map[cls] = [];
      map[cls].push(t.testItem);
    });
    return map;
  }, [tasks, itemClassification]);

  // 분류별 → 사업부별 타일 목록
  const matrixTiles = useMemo(() => {
    const result = {};
    classifications.forEach(cls => {
      result[cls] = {};
      activeDivisions.forEach(d => {
        const tiles = [];
        (itemsByClass[cls] || []).forEach(testItem => {
          const cell = cellData[`${testItem}__${d.id}`];
          if (cell) {
            tiles.push({ testItem, ...cell });
          }
        });
        result[cls][d.id] = tiles;
      });
    });
    return result;
  }, [classifications, activeDivisions, itemsByClass, cellData]);

  // 통계
  const stats = useMemo(() => {
    let totalItems = 0;
    let totalSubItems = 0;
    classifications.forEach(cls => {
      (itemsByClass[cls] || []).forEach(testItem => {
        totalItems++;
        const detailSet = new Set();
        activeDivisions.forEach(d => {
          const cell = cellData[`${testItem}__${d.id}`];
          if (cell) cell.details.forEach(det => detailSet.add(det));
        });
        totalSubItems += detailSet.size > 0 ? detailSet.size : 1;
      });
    });
    return { totalItems, totalSubItems, classifications: classifications.length, divisions: activeDivisions.length };
  }, [classifications, itemsByClass, activeDivisions, cellData]);

  if (tasks.length === 0) {
    return <Wrapper><EmptyText>과제 데이터가 없습니다.</EmptyText></Wrapper>;
  }

  if (classifications.length === 0) {
    return <Wrapper><EmptyText>항목 분류가 설정되지 않았습니다. 설정에서 항목 분류를 지정하세요.</EmptyText></Wrapper>;
  }

  const colCount = activeDivisions.length;

  return (
    <Wrapper>
      <StatsRow>
        <StatBadge $color="#334155">분류 <strong>{stats.classifications}</strong></StatBadge>
        <StatBadge $color="#334155">사업부 <strong>{stats.divisions}</strong></StatBadge>
        <StatBadge $color="#7c3aed">항목 <strong>{stats.totalItems}</strong></StatBadge>
        <StatBadge $color="#0891b2">세부항목 <strong>{stats.totalSubItems}</strong></StatBadge>
      </StatsRow>

      <GridContainer>
        <Table $cols={colCount}>
          {/* 헤더 행 */}
          <CornerCell>분류 / 사업부</CornerCell>
          {activeDivisions.map(d => (
            <DivHeader key={d.id}>{d.name}</DivHeader>
          ))}

          {/* 분류별 행 */}
          {classifications.map(cls => (
            <React.Fragment key={cls}>
              <ClassLabel>{cls}</ClassLabel>
              {activeDivisions.map(d => {
                const tiles = matrixTiles[cls]?.[d.id] || [];
                return (
                  <CellBox key={d.id}>
                    {tiles.map((tile, idx) => {
                      const catColor = getCatColor(tile.category);
                      return (
                        <Tile
                          key={`${tile.testItem}-${idx}`}
                          $catColor={catColor}
                          title={`${tile.testItem}\n사업부: ${d.name}\n구분: ${tile.category || '-'}${tile.details.length > 0 ? '\n상세: ' + tile.details.join(', ') : ''}${tile.names.length > 0 ? '\n과제: ' + tile.names.join(', ') : ''}\n상태: ${tile.status}`}
                        >
                          <TileText $catColor={catColor}>{tile.testItem}</TileText>
                          {tile.details.length > 0 && (
                            <TileDetail>{tile.details.length}건</TileDetail>
                          )}
                        </Tile>
                      );
                    })}
                  </CellBox>
                );
              })}
            </React.Fragment>
          ))}
        </Table>
      </GridContainer>
    </Wrapper>
  );
};

export default SeedbedView;
