import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { Database, Settings, Link2 } from 'lucide-react';
import RoadmapSettingsModal from './RoadmapSettingsModal';

const Wrapper = styled.div`
  flex: 1;
  overflow: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const FiltersRow = styled.div`
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
`;

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`;

const FilterLabel = styled.span`
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  margin-right: 2px;
  flex-shrink: 0;
`;

const FilterButton = styled.button`
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: ${props => props.$active ? '600' : '500'};
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid ${props => props.$active ? '#06b6d4' : '#e2e8f0'};
  background: ${props => props.$active ? '#ecfeff' : 'white'};
  color: ${props => props.$active ? '#0891b2' : '#64748b'};

  &:hover {
    border-color: ${props => props.$active ? '#06b6d4' : '#cbd5e1'};
    background: ${props => props.$active ? '#ecfeff' : '#f8fafc'};
  }
`;

const FilterDivider = styled.div`
  width: 1px;
  height: 24px;
  background: #e2e8f0;
`;

/* ── Stats ── */
const StatsContainer = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const StatGroup = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 180px;
`;

const StatGroupTitle = styled.div`
  font-size: 0.7rem;
  font-weight: 700;
  color: #0e7490;
  text-transform: uppercase;
  letter-spacing: 0.03em;
`;

const StatRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
`;

const StatBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.7rem;
  color: ${props => props.$color || '#64748b'};
  font-weight: 500;
  white-space: nowrap;
`;

const StatValue = styled.span`
  font-weight: 700;
  font-size: 0.8rem;
`;

/* ── Table ── */
const TableContainer = styled.div`
  overflow: auto;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  max-height: calc(100vh - 260px);
`;

const Table = styled.table`
  width: auto;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
`;

const HeaderCell = styled.th`
  position: sticky;
  top: 0;
  background: #f8fafc;
  padding: 10px 16px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #334155;
  text-align: center;
  border-bottom: 2px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  white-space: nowrap;
  z-index: 10;
  width: calc((100vw - 200px) / 6);
  min-width: calc((100vw - 200px) / 6);

  &:first-child {
    position: sticky;
    left: 0;
    z-index: 20;
    background: #f1f5f9;
    width: 20%;
    min-width: 20%;
    text-align: left;
  }

  &:last-child {
    border-right: none;
  }
`;

const CategoryHeaderRow = styled.tr`
  background: #f0f9ff;
`;

const CategoryCell = styled.td`
  padding: 8px 14px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #0e7490;
  background: #f0f9ff;
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  position: sticky;
  left: 0;
  z-index: 5;

  &:last-child {
    border-right: none;
  }
`;

const CategorySpanCell = styled.td`
  padding: 8px 14px;
  background: #f0f9ff;
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;

  &:last-child {
    border-right: none;
  }
`;

const ItemRow = styled.tr`
  background: ${props => props.$odd ? '#f8fbff' : '#ffffff'};
`;

const RowHeaderCell = styled.td`
  position: sticky;
  left: 0;
  background: ${props => props.$odd ? '#f0f4fa' : '#fafbfc'};
  padding: 8px 14px;
  font-size: 0.8rem;
  font-weight: 500;
  color: #334155;
  border-bottom: 1px solid #e2e8f0;
  border-right: 2px solid #e2e8f0;
  white-space: nowrap;
  z-index: 5;
`;

const Cell = styled.td`
  padding: 6px 10px;
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  vertical-align: middle;
  background: ${props => props.$odd
    ? (props.$hasItems ? '#f8fbff' : '#f0f4f8')
    : (props.$hasItems ? '#fff' : '#fafafa')
  };
`;

const CellContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const TaskItem = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: ${props => {
    switch (props.$status) {
      case '완료': return '#f0fdf4';
      case '진행': return '#eff6ff';
      case '계획': return '#fffbeb';
      default: return '#f1f5f9';
    }
  }};
  border: 1px solid ${props => {
    switch (props.$status) {
      case '완료': return '#bbf7d0';
      case '진행': return '#bfdbfe';
      case '계획': return '#fde68a';
      default: return '#e2e8f0';
    }
  }};
  border-radius: 4px;
  font-size: 0.75rem;
  color: #334155;
`;

const TaskName = styled.span`
  white-space: normal;
  word-break: break-word;
`;

const StatusDot = styled.span`
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: ${props => {
    switch (props.$status) {
      case '완료': return '#16a34a';
      case '진행': return '#2563eb';
      case '계획': return '#d97706';
      default: return '#94a3b8';
    }
  }};
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #94a3b8;
  gap: 12px;
`;

const EmptyIcon = styled.div`
  color: #cbd5e1;
`;

const EmptyText = styled.div`
  font-size: 1rem;
  font-weight: 500;
`;

const EmptySubText = styled.div`
  font-size: 0.85rem;
`;

const EmptyCellText = styled.div`
  color: #cbd5e1;
  font-size: 0.7rem;
  text-align: center;
  padding: 4px;
`;

const SettingsButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: white;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  gap: 4px;
  transition: all 0.2s ease;
  &:hover { border-color: #06b6d4; color: #0891b2; background: #ecfeff; }
`;

const MergedCell = styled.td`
  padding: 6px 10px;
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #e2e8f0;
  vertical-align: middle;
  background: #fff;
`;

const ToggleButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border: 1px solid ${p => p.$active ? '#06b6d4' : '#e2e8f0'};
  border-radius: 6px;
  background: ${p => p.$active ? '#ecfeff' : 'white'};
  color: ${p => p.$active ? '#0891b2' : '#64748b'};
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  gap: 4px;
  transition: all 0.2s ease;
  &:hover { border-color: #06b6d4; color: #0891b2; background: #ecfeff; }
`;

const TaskItemWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const LinkedDtList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding-left: 10px;
`;

const LinkedDtChip = styled.span`
  font-size: 0.62rem;
  padding: 1px 6px;
  border-radius: 8px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  color: #0369a1;
  white-space: nowrap;
  line-height: 1.4;
`;

const ItemDetailBadgeList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  margin-top: 4px;
`;

const ItemDetailBadge = styled.span`
  display: inline-block;
  padding: 1px 7px;
  border-radius: 8px;
  font-size: 0.65rem;
  font-weight: 500;
  background: #ecfeff;
  color: #0e7490;
  border: 1px solid #a5f3fc;
  white-space: nowrap;
`;

const RoadmapView = ({ tasks, divisions = [], categories = [], productFamilies = [], roadmapConfig, onSaveRoadmapConfig }) => {
  const [filterDivisionId, setFilterDivisionId] = useState('');
  const [filterProductFamilies, setFilterProductFamilies] = useState([]);
  const [filterCategories, setFilterCategories] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showLinks, setShowLinks] = useState(false);

  // 사업부 + 제품군 + 구분 필터 적용
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    let result = tasks;
    if (filterDivisionId) {
      result = result.filter(t => t.divisionId === filterDivisionId);
    }
    if (filterProductFamilies.length > 0) {
      result = result.filter(t => Array.isArray(t.productFamily) && filterProductFamilies.some(fp => t.productFamily.includes(fp)));
    }
    if (filterCategories.length > 0) {
      result = result.filter(t => filterCategories.includes(t.category));
    }
    return result;
  }, [tasks, filterDivisionId, filterProductFamilies, filterCategories]);

  // 사업부 필터에 맞는 제품군만 표시
  const filteredProductFamilyOptions = useMemo(() => {
    if (!filterDivisionId) return productFamilies;
    return productFamilies.filter(pf => pf.divisionId === filterDivisionId);
  }, [productFamilies, filterDivisionId]);

  // 구분별 통계 (셀 합치기 규칙 내 동일 과제명 중복 제거)
  const stats = useMemo(() => {
    // 합쳐진 셀 안에서 동일 과제명이면 중복으로 간주 → 제외할 id 수집
    const skipIds = new Set();
    const mergeRules = roadmapConfig?.cellMerge || [];
    if (mergeRules.length > 0) {
      mergeRules.forEach(rule => {
        const matched = filteredTasks.filter(t =>
          t.category === rule.category &&
          (rule.year === '__current__'
            ? (t.status === '완료' || !t.year)
            : (t.year === rule.year && t.status !== '완료')) &&
          rule.items.includes(t.testItem)
        );
        const byName = new Map();
        matched.forEach(t => {
          if (!byName.has(t.name)) byName.set(t.name, []);
          byName.get(t.name).push(t);
        });
        byName.forEach(tasks => {
          for (let i = 1; i < tasks.length; i++) skipIds.add(tasks[i].id);
        });
      });
    }

    // testItem별로 모든 testItemDetail을 수집 (같은 항목의 여러 task에서 detail 모음)
    const itemDetailsMap = new Map(); // testItem → Set of detail parts
    filteredTasks.forEach(task => {
      if (skipIds.has(task.id) || !task.testItem) return;
      if (!itemDetailsMap.has(task.testItem)) {
        itemDetailsMap.set(task.testItem, new Set());
      }
      if (task.testItemDetail) {
        task.testItemDetail.split(',').map(s => s.trim()).filter(Boolean)
          .forEach(part => itemDetailsMap.get(task.testItem).add(part));
      }
    });

    // 항목 수 계산: detail이 있으면 고유 detail 수, 없으면 1
    const getItemSubCount = (testItem) => {
      const details = itemDetailsMap.get(testItem);
      return (details && details.size > 0) ? details.size : 1;
    };

    const byCat = new Map();

    filteredTasks.forEach(task => {
      if (skipIds.has(task.id)) return;
      const cat = task.category || '미분류';
      if (!byCat.has(cat)) {
        byCat.set(cat, { total: 0, 완료: 0, 진행: 0, 계획: 0, items: new Set(), itemCount: 0 });
      }
      const s = byCat.get(cat);
      s.total++;
      if (task.status === '완료') s['완료']++;
      else if (task.status === '진행') s['진행']++;
      else if (task.status === '계획') s['계획']++;
      if (task.testItem && !s.items.has(task.testItem)) {
        s.items.add(task.testItem);
        s.itemCount += getItemSubCount(task.testItem);
      }
    });

    const groups = [];
    byCat.forEach((v, cat) => {
      groups.push({ category: cat, ...v });
    });

    // 전체 합산
    const all = { total: 0, 완료: 0, 진행: 0, 계획: 0, items: new Set(), itemCount: 0 };
    filteredTasks.forEach(t => {
      if (skipIds.has(t.id)) return;
      all.total++;
      if (t.status === '완료') all['완료']++;
      else if (t.status === '진행') all['진행']++;
      else if (t.status === '계획') all['계획']++;
      if (t.testItem && !all.items.has(t.testItem)) {
        all.items.add(t.testItem);
        all.itemCount += getItemSubCount(t.testItem);
      }
    });

    // 분류별 통계 (itemClassification 기반)
    const itemClassification = roadmapConfig?.itemClassification || {};
    const byClass = new Map();
    filteredTasks.forEach(t => {
      if (skipIds.has(t.id)) return;
      const cls = (t.testItem && itemClassification[t.testItem]) || '';
      if (!cls) return;
      if (!byClass.has(cls)) {
        byClass.set(cls, { total: 0, 완료: 0, 진행: 0, 계획: 0, items: new Set(), itemCount: 0 });
      }
      const s = byClass.get(cls);
      s.total++;
      if (t.status === '완료') s['완료']++;
      else if (t.status === '진행') s['진행']++;
      else if (t.status === '계획') s['계획']++;
      if (t.testItem && !s.items.has(t.testItem)) {
        s.items.add(t.testItem);
        s.itemCount += getItemSubCount(t.testItem);
      }
    });
    const classGroups = [];
    byClass.forEach((v, cls) => {
      classGroups.push({ classification: cls, ...v });
    });

    return { groups, all, classGroups };
  }, [filteredTasks, roadmapConfig]);

  // 로드맵 테이블 데이터
  const { categoryRows, yearColumns } = useMemo(() => {
    if (!filteredTasks || filteredTasks.length === 0) {
      return { categoryRows: [], yearColumns: [] };
    }

    const yearSet = new Set();
    filteredTasks.forEach(t => {
      if (t.status !== '완료' && t.year) {
        yearSet.add(t.year);
      }
    });
    const sortedYears = [...yearSet].sort();

    const categoryMap = new Map();

    filteredTasks.forEach(task => {
      const cat = task.category || '미분류';
      const item = task.testItem || '미지정';

      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, new Map());
      }
      const itemMap = categoryMap.get(cat);

      if (!itemMap.has(item)) {
        itemMap.set(item, { completed: [], byYear: {}, details: new Set() });
      }
      const bucket = itemMap.get(item);

      if (task.testItemDetail) {
        bucket.details.add(task.testItemDetail);
      }

      if (task.status === '완료') {
        bucket.completed.push(task);
      } else if (task.year) {
        if (!bucket.byYear[task.year]) {
          bucket.byYear[task.year] = [];
        }
        bucket.byYear[task.year].push(task);
      } else {
        bucket.completed.push(task);
      }
    });

    // order 기준 오름차순 정렬 헬퍼
    const sortByOrder = (arr) => arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const rows = [];
    categoryMap.forEach((itemMap, cat) => {
      const items = [];
      itemMap.forEach((data, itemName) => {
        // 셀 내 과제를 order 기준 오름차순 정렬
        sortByOrder(data.completed);
        Object.values(data.byYear).forEach(sortByOrder);
        items.push({ itemName, ...data, details: [...data.details] });
      });

      // itemOrder 설정이 있으면 해당 순서로 정렬
      const orderList = roadmapConfig?.itemOrder?.[cat];
      if (orderList && orderList.length > 0) {
        items.sort((a, b) => {
          const idxA = orderList.indexOf(a.itemName);
          const idxB = orderList.indexOf(b.itemName);
          // 순서에 없는 항목은 뒤로
          const posA = idxA === -1 ? Infinity : idxA;
          const posB = idxB === -1 ? Infinity : idxB;
          return posA - posB;
        });
      }

      rows.push({ category: cat, items });
    });

    return { categoryRows: rows, yearColumns: sortedYears };
  }, [filteredTasks, roadmapConfig]);

  // cellMerge 규칙을 빠르게 조회할 수 있는 맵 생성
  // key: "category|year|itemName" → { isMaster, rowspan, mergedItems(다른 항목들의 데이터 참조용) }
  const mergeInfo = useMemo(() => {
    const info = {};
    const rules = roadmapConfig?.cellMerge || [];
    if (rules.length === 0) return info;

    categoryRows.forEach(({ category, items }) => {
      rules.forEach(rule => {
        if (rule.category !== category) return;
        const year = rule.year;
        // 규칙의 items 중 실제 존재하는 항목만, 테이블 렌더링 순서로 정렬
        const ruleItems = items
          .filter(i => rule.items.includes(i.itemName))
          .map(i => i.itemName);
        if (ruleItems.length < 2) return;

        ruleItems.forEach((itemName, idx) => {
          const key = `${category}|${year}|${itemName}`;
          if (idx === 0) {
            info[key] = { isMaster: true, rowspan: ruleItems.length, mergedItemNames: ruleItems };
          } else {
            info[key] = { isMaster: false };
          }
        });
      });
    });
    return info;
  }, [categoryRows, roadmapConfig]);

  const renderTask = (t) => {
    const linked = showLinks && Array.isArray(t.connectedDtTask) && t.connectedDtTask.length > 0;
    if (!linked) {
      return (
        <TaskItem key={t.id} $status={t.status}>
          <StatusDot $status={t.status} />
          <TaskName title={t.name}>{t.name}</TaskName>
        </TaskItem>
      );
    }
    return (
      <TaskItemWrapper key={t.id}>
        <TaskItem $status={t.status}>
          <StatusDot $status={t.status} />
          <TaskName title={t.name}>{t.name}</TaskName>
        </TaskItem>
        <LinkedDtList>
          {t.connectedDtTask.map(p => (
            <LinkedDtChip key={p.projectId} title={`${p.projectName} (${p.year || ''})`}>
              {p.projectName}
            </LinkedDtChip>
          ))}
        </LinkedDtList>
      </TaskItemWrapper>
    );
  };

  if (!tasks || tasks.length === 0) {
    return (
      <Wrapper>
        <EmptyState>
          <EmptyIcon>
            <Database size={48} strokeWidth={1.5} />
          </EmptyIcon>
          <EmptyText>등록된 과제가 없습니다</EmptyText>
          <EmptySubText>"새 과제 추가" 버튼을 클릭하여 과제를 등록하세요</EmptySubText>
        </EmptyState>
      </Wrapper>
    );
  }

  const totalCols = 2 + yearColumns.length;

  return (
    <Wrapper>
      {/* 필터 */}
      <FiltersRow>
        <FilterGroup>
          <FilterLabel>사업부</FilterLabel>
          <FilterButton $active={filterDivisionId === ''} onClick={() => { setFilterDivisionId(''); setFilterProductFamilies([]); }}>
            전체
          </FilterButton>
          {divisions.map(div => (
            <FilterButton
              key={div.id}
              $active={filterDivisionId === div.id}
              onClick={() => {
                setFilterDivisionId(div.id);
                // 선택된 제품군 중 해당 사업부에 속하지 않는 것들 제거
                setFilterProductFamilies(prev =>
                  prev.filter(name => {
                    const pf = productFamilies.find(p => p.name === name);
                    return pf && pf.divisionId === div.id;
                  })
                );
              }}
            >
              {div.name}
            </FilterButton>
          ))}
        </FilterGroup>
        <FilterDivider />
        <FilterGroup>
          <FilterLabel>구분</FilterLabel>
          <FilterButton $active={filterCategories.length === 0} onClick={() => setFilterCategories([])}>
            전체
          </FilterButton>
          {categories.map(cat => (
            <FilterButton
              key={cat}
              $active={filterCategories.includes(cat)}
              onClick={() => {
                setFilterCategories(prev =>
                  prev.includes(cat)
                    ? prev.filter(c => c !== cat)
                    : [...prev, cat]
                );
              }}
            >
              {cat}
            </FilterButton>
          ))}
        </FilterGroup>
        {filteredProductFamilyOptions.length > 0 && (
          <>
            <FilterDivider />
            <FilterGroup>
              <FilterLabel>적용 제품군</FilterLabel>
              <FilterButton $active={filterProductFamilies.length === 0} onClick={() => setFilterProductFamilies([])}>
                전체
              </FilterButton>
              {filteredProductFamilyOptions.map(pf => (
                <FilterButton
                  key={pf.name}
                  $active={filterProductFamilies.includes(pf.name)}
                  onClick={() => {
                    setFilterProductFamilies(prev =>
                      prev.includes(pf.name)
                        ? prev.filter(n => n !== pf.name)
                        : [...prev, pf.name]
                    );
                  }}
                >
                  {pf.name}
                </FilterButton>
              ))}
            </FilterGroup>
          </>
        )}
        <FilterDivider />
        <ToggleButton $active={showLinks} onClick={() => setShowLinks(v => !v)}>
          <Link2 size={14} />
          연결 표시
        </ToggleButton>
        <SettingsButton onClick={() => setSettingsOpen(true)}>
          <Settings size={14} />
          로드맵 표 설정
        </SettingsButton>
      </FiltersRow>

      {/* 통계 */}
      <StatsContainer>
        <StatGroup>
          <StatGroupTitle>전체</StatGroupTitle>
          <StatRow>
            <StatBadge $color="#334155">총 <StatValue>{stats.all.total}</StatValue></StatBadge>
            <StatBadge $color="#16a34a">완료 <StatValue>{stats.all['완료']}</StatValue></StatBadge>
            <StatBadge $color="#2563eb">진행 <StatValue>{stats.all['진행']}</StatValue></StatBadge>
            <StatBadge $color="#d97706">계획 <StatValue>{stats.all['계획']}</StatValue></StatBadge>
            <StatBadge $color="#7c3aed">항목 <StatValue>{stats.all.itemCount}</StatValue></StatBadge>
          </StatRow>
        </StatGroup>
        {stats.groups.map(g => (
          <StatGroup key={g.category}>
            <StatGroupTitle>{g.category}</StatGroupTitle>
            <StatRow>
              <StatBadge $color="#334155">총 <StatValue>{g.total}</StatValue></StatBadge>
              <StatBadge $color="#16a34a">완료 <StatValue>{g['완료']}</StatValue></StatBadge>
              <StatBadge $color="#2563eb">진행 <StatValue>{g['진행']}</StatValue></StatBadge>
              <StatBadge $color="#d97706">계획 <StatValue>{g['계획']}</StatValue></StatBadge>
              <StatBadge $color="#7c3aed">항목 <StatValue>{g.itemCount}</StatValue></StatBadge>
            </StatRow>
          </StatGroup>
        ))}
      </StatsContainer>
      {stats.classGroups.length > 0 && (
        <StatsContainer>
          {stats.classGroups.map(g => (
            <StatGroup key={g.classification}>
              <StatGroupTitle>{g.classification}</StatGroupTitle>
              <StatRow>
                <StatBadge $color="#334155">총 <StatValue>{g.total}</StatValue></StatBadge>
                <StatBadge $color="#16a34a">완료 <StatValue>{g['완료']}</StatValue></StatBadge>
                <StatBadge $color="#2563eb">진행 <StatValue>{g['진행']}</StatValue></StatBadge>
                <StatBadge $color="#d97706">계획 <StatValue>{g['계획']}</StatValue></StatBadge>
                <StatBadge $color="#7c3aed">항목 <StatValue>{g.itemCount}</StatValue></StatBadge>
              </StatRow>
            </StatGroup>
          ))}
        </StatsContainer>
      )}

      {/* 테이블 */}
      {filteredTasks.length === 0 ? (
        <EmptyState>
          <EmptyIcon>
            <Database size={48} strokeWidth={1.5} />
          </EmptyIcon>
          <EmptyText>해당 필터 조건의 과제가 없습니다</EmptyText>
        </EmptyState>
      ) : (
        <TableContainer>
          <Table>
            <thead>
              <tr>
                <HeaderCell>항목</HeaderCell>
                <HeaderCell>현재</HeaderCell>
                {yearColumns.map(year => (
                  <HeaderCell key={year}>{year}</HeaderCell>
                ))}
              </tr>
            </thead>
            <tbody>
              {categoryRows.map(({ category, items }) => (
                <React.Fragment key={category}>
                  <CategoryHeaderRow>
                    <CategoryCell>{category}</CategoryCell>
                    {Array.from({ length: totalCols - 1 }, (_, i) => (
                      <CategorySpanCell key={i} />
                    ))}
                  </CategoryHeaderRow>
                  {items.map(({ itemName, completed, byYear, details }, itemIdx) => (
                    <ItemRow key={`${category}-${itemName}`} $odd={itemIdx % 2 === 1}>
                      <RowHeaderCell $odd={itemIdx % 2 === 1}>
                        {itemName}
                        {details && details.length > 0 && (
                          <ItemDetailBadgeList>
                            {details.map(d => (
                              <ItemDetailBadge key={d}>{d}</ItemDetailBadge>
                            ))}
                          </ItemDetailBadgeList>
                        )}
                      </RowHeaderCell>
                      {(() => {
                        const cKey = `${category}|__current__|${itemName}`;
                        const cmi = mergeInfo[cKey];
                        if (cmi && !cmi.isMaster) return null;
                        if (cmi && cmi.isMaster) {
                          const allCompleted = [];
                          cmi.mergedItemNames.forEach(mn => {
                            const found = items.find(i => i.itemName === mn);
                            if (found) allCompleted.push(...found.completed);
                          });
                          const seen = new Set();
                          const unique = allCompleted.filter(t => {
                            if (seen.has(t.name)) return false;
                            seen.add(t.name);
                            return true;
                          });
                          return (
                            <MergedCell rowSpan={cmi.rowspan}>
                              <CellContent>
                                {unique.length > 0
                                  ? unique.map(renderTask)
                                  : <EmptyCellText>-</EmptyCellText>
                                }
                              </CellContent>
                            </MergedCell>
                          );
                        }
                        return (
                          <Cell $hasItems={completed.length > 0} $odd={itemIdx % 2 === 1}>
                            <CellContent>
                              {completed.length > 0
                                ? (() => {
                                    const seen = new Set();
                                    return completed.filter(t => {
                                      if (seen.has(t.name)) return false;
                                      seen.add(t.name);
                                      return true;
                                    }).map(renderTask);
                                  })()
                                : <EmptyCellText>-</EmptyCellText>
                              }
                            </CellContent>
                          </Cell>
                        );
                      })()}
                      {yearColumns.map(year => {
                        const mKey = `${category}|${year}|${itemName}`;
                        const mi = mergeInfo[mKey];

                        // 이 셀이 합쳐져서 숨겨져야 하는 경우
                        if (mi && !mi.isMaster) return null;

                        // 이 셀이 합치기 마스터인 경우: 모든 합쳐진 항목의 과제를 모아서 표시
                        if (mi && mi.isMaster) {
                          const allTasks = [];
                          mi.mergedItemNames.forEach(mn => {
                            const found = items.find(i => i.itemName === mn);
                            if (found && found.byYear[year]) {
                              allTasks.push(...found.byYear[year]);
                            }
                          });
                          // 동일 과제명 중복 제거 (첫 번째 인스턴스만 유지)
                          const seen = new Set();
                          const uniqueTasks = allTasks.filter(t => {
                            if (seen.has(t.name)) return false;
                            seen.add(t.name);
                            return true;
                          });
                          return (
                            <MergedCell key={year} rowSpan={mi.rowspan}>
                              <CellContent>
                                {uniqueTasks.length > 0
                                  ? uniqueTasks.map(renderTask)
                                  : <EmptyCellText>-</EmptyCellText>
                                }
                              </CellContent>
                            </MergedCell>
                          );
                        }

                        // 일반 셀 (동일 과제명 중복 제거)
                        const yearTasks = byYear[year] || [];
                        const seenNames = new Set();
                        const uniqueYearTasks = yearTasks.filter(t => {
                          if (seenNames.has(t.name)) return false;
                          seenNames.add(t.name);
                          return true;
                        });
                        return (
                          <Cell key={year} $hasItems={uniqueYearTasks.length > 0} $odd={itemIdx % 2 === 1}>
                            <CellContent>
                              {uniqueYearTasks.length > 0
                                ? uniqueYearTasks.map(renderTask)
                                : <EmptyCellText>-</EmptyCellText>
                              }
                            </CellContent>
                          </Cell>
                        );
                      })}
                    </ItemRow>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}

      <RoadmapSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={(config) => {
          onSaveRoadmapConfig(config);
          setSettingsOpen(false);
        }}
        roadmapConfig={roadmapConfig}
        tasks={tasks}
        categories={categories}
        divisions={divisions}
      />
    </Wrapper>
  );
};

export default RoadmapView;
