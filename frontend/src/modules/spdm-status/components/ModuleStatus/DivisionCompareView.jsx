import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { ArrowLeft, Link2, Download } from 'lucide-react';
import { downloadCSV } from '../../../../shared/utils/csvUtils';
import { spdmApi } from '../../services/spdmApi';

const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  background: #fafbfc;
`;

const BackButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  background: white;
  cursor: pointer;
  color: #64748b;
  &:hover { background: #f1f5f9; color: #1e293b; }
`;

const Title = styled.h3`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const SelectorBar = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  flex-shrink: 0;
`;

const SelectorGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
`;

const SelectorLabel = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  white-space: nowrap;
`;

const Select = styled.select`
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  color: #1e293b;
  background: white;
  cursor: pointer;
  &:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.1);
  }
`;

const VsSeparator = styled.span`
  font-size: 0.8125rem;
  font-weight: 700;
  color: #8b5cf6;
`;

const ScrollArea = styled.div`
  flex: 1;
  overflow: auto;
  padding: 1rem;
`;

const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 0.875rem;
  padding: 3rem 2rem;
`;

/* ─── Matrix Table ─── */

const MatrixTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
`;

const ColGroupCategory = styled.col`
  width: 120px;
`;

const MatrixTh = styled.th`
  padding: 0.625rem 0.875rem;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
  text-align: left;
  position: sticky;
  top: 0;
  z-index: 1;
`;

const CategoryTd = styled.td`
  padding: 0.75rem;
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  vertical-align: top;
  font-size: 0.8125rem;
  font-weight: 700;
  color: #6d28d9;
  text-align: center;
`;

const CellTd = styled.td`
  padding: 0.5rem;
  border: 1px solid #e2e8f0;
  vertical-align: top;
  background: white;
`;

/* ─── Module Card ─── */

const ModuleCard = styled.div`
  padding: 0.5rem 0.625rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  transition: box-shadow 0.1s;

  & + & {
    margin-top: 0.375rem;
  }

  &:hover {
    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
  }
`;

const CardName = styled.div`
  font-size: 0.8125rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.375rem;
  line-height: 1.3;
`;

const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 500;
  line-height: 1.4;
  background: ${p => p.$bg || '#f1f5f9'};
  color: ${p => p.$color || '#475569'};
`;

const EmptyCell = styled.div`
  color: #cbd5e1;
  font-size: 0.75rem;
  font-style: italic;
  padding: 0.5rem 0.25rem;
  text-align: center;
`;

const DownloadButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  background: white;
  cursor: pointer;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  margin-left: auto;
  transition: all 0.15s ease;

  &:hover {
    background: #f1f5f9;
    color: #1e293b;
    border-color: #cbd5e1;
  }
`;

const CardDescription = styled.div`
  font-size: 0.6875rem;
  color: #64748b;
  margin-top: 0.25rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

/* ─── Component ─── */

const DivisionCompareView = ({ departments, onBack }) => {
  const [divisionA, setDivisionA] = useState('');
  const [divisionB, setDivisionB] = useState('');
  const [modulesA, setModulesA] = useState([]);
  const [modulesB, setModulesB] = useState([]);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);

  useEffect(() => {
    if (!divisionA) { setModulesA([]); return; }
    let cancelled = false;
    setLoadingA(true);
    spdmApi.getModules(divisionA)
      .then(data => { if (!cancelled) setModulesA(data); })
      .catch(() => { if (!cancelled) setModulesA([]); })
      .finally(() => { if (!cancelled) setLoadingA(false); });
    return () => { cancelled = true; };
  }, [divisionA]);

  useEffect(() => {
    if (!divisionB) { setModulesB([]); return; }
    let cancelled = false;
    setLoadingB(true);
    spdmApi.getModules(divisionB)
      .then(data => { if (!cancelled) setModulesB(data); })
      .catch(() => { if (!cancelled) setModulesB([]); })
      .finally(() => { if (!cancelled) setLoadingB(false); });
    return () => { cancelled = true; };
  }, [divisionB]);

  const divAName = useMemo(
    () => departments.find(d => String(d.id) === String(divisionA))?.name || '사업부 A',
    [departments, divisionA]
  );
  const divBName = useMemo(
    () => departments.find(d => String(d.id) === String(divisionB))?.name || '사업부 B',
    [departments, divisionB]
  );

  /**
   * Build rows: one row per category.
   * Each row has { category, modsA: Module[], modsB: Module[] }
   */
  const rows = useMemo(() => {
    const catSet = new Map(); // category → { a: [], b: [] }

    for (const m of modulesA) {
      const cats = (m.categories && m.categories.length > 0) ? m.categories : ['미분류'];
      cats.forEach(cat => {
        if (!catSet.has(cat)) catSet.set(cat, { a: [], b: [] });
        catSet.get(cat).a.push(m);
      });
    }
    for (const m of modulesB) {
      const cats = (m.categories && m.categories.length > 0) ? m.categories : ['미분류'];
      cats.forEach(cat => {
        if (!catSet.has(cat)) catSet.set(cat, { a: [], b: [] });
        catSet.get(cat).b.push(m);
      });
    }

    return [...catSet.entries()]
      .sort((x, y) => {
        if (x[0] === '미분류') return 1;
        if (y[0] === '미분류') return -1;
        return x[0].localeCompare(y[0]);
      })
      .map(([cat, { a, b }]) => ({ category: cat, modsA: a, modsB: b }));
  }, [modulesA, modulesB]);

  const handleDownloadCSV = () => {
    const csvData = rows.map(({ category, modsA, modsB }) => {
      const formatMods = (mods) => {
        if (mods.length === 0) return { names: '-', systems: '-', links: '-' };
        return {
          names: mods.map(m => m.name).join('; '),
          systems: mods.map(m => m.systemType || '-').join('; '),
          links: mods.map(m => {
            const ls = (m.links || []).filter(l => l.from && l.to);
            if (ls.length === 0) return '-';
            return ls.map(l => `${l.from}→${l.to}${l.method ? `(${l.method})` : ''}`).join(', ');
          }).join('; ')
        };
      };

      const a = formatMods(modsA);
      const b = formatMods(modsB);

      return {
        '모듈 구분': category,
        [`${divAName} 모듈명`]: a.names,
        [`${divAName} 시스템`]: a.systems,
        [`${divAName} 연계`]: a.links,
        [`${divBName} 모듈명`]: b.names,
        [`${divBName} 시스템`]: b.systems,
        [`${divBName} 연계`]: b.links,
      };
    });

    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    downloadCSV(csvData, `DivisionCompare_${dateStr}.csv`);
  };

  const loading = loadingA || loadingB;
  const bothSelected = divisionA && divisionB;

  return (
    <Container>
      <Header>
        <BackButton onClick={onBack}>
          <ArrowLeft size={16} />
        </BackButton>
        <Title>사업부 비교</Title>
        {bothSelected && !loading && rows.length > 0 && (
          <DownloadButton onClick={handleDownloadCSV}>
            <Download size={14} />
            CSV 저장
          </DownloadButton>
        )}
      </Header>

      <SelectorBar>
        <SelectorGroup>
          <SelectorLabel>A</SelectorLabel>
          <Select value={divisionA} onChange={e => setDivisionA(e.target.value)}>
            <option value="">사업부 선택...</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </Select>
        </SelectorGroup>
        <VsSeparator>vs</VsSeparator>
        <SelectorGroup>
          <SelectorLabel>B</SelectorLabel>
          <Select value={divisionB} onChange={e => setDivisionB(e.target.value)}>
            <option value="">사업부 선택...</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </Select>
        </SelectorGroup>
      </SelectorBar>

      <ScrollArea>
        {!bothSelected && (
          <EmptyState>두 사업부를 선택하면 모듈 구분별 비교 매트릭스가 표시됩니다.</EmptyState>
        )}
        {bothSelected && loading && (
          <EmptyState>모듈 로딩 중...</EmptyState>
        )}
        {bothSelected && !loading && rows.length === 0 && (
          <EmptyState>선택한 사업부에 모듈이 없습니다.</EmptyState>
        )}
        {bothSelected && !loading && rows.length > 0 && (
          <MatrixTable>
            <colgroup>
              <ColGroupCategory />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr>
                <MatrixTh>모듈 구분</MatrixTh>
                <MatrixTh>{divAName} ({modulesA.length})</MatrixTh>
                <MatrixTh>{divBName} ({modulesB.length})</MatrixTh>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ category, modsA, modsB }) => (
                <tr key={category}>
                  <CategoryTd>{category}</CategoryTd>
                  <CellTd>
                    {modsA.length > 0 ? modsA.map(m => (
                      <ModuleCardItem key={m.id} mod={m} />
                    )) : (
                      <EmptyCell>-</EmptyCell>
                    )}
                  </CellTd>
                  <CellTd>
                    {modsB.length > 0 ? modsB.map(m => (
                      <ModuleCardItem key={m.id} mod={m} />
                    )) : (
                      <EmptyCell>-</EmptyCell>
                    )}
                  </CellTd>
                </tr>
              ))}
            </tbody>
          </MatrixTable>
        )}
      </ScrollArea>
    </Container>
  );
};

/* ─── Module Card Sub-component ─── */

const ModuleCardItem = ({ mod }) => {
  const modLinks = (mod.links || []).filter(l => l.from && l.to);
  return (
    <ModuleCard>
      <CardName>{mod.name}</CardName>
      <BadgeRow>
        {mod.systemType && (
          <Badge $bg="#dbeafe" $color="#1d4ed8">{mod.systemType}</Badge>
        )}
        {modLinks.length > 0 && (
          <Badge $bg="#fef3c7" $color="#92400e">
            <Link2 size={10} />
            연계 {modLinks.length > 1 ? `${modLinks.length}건` : ''}
          </Badge>
        )}
        {modLinks.map((link, idx) => (
          <React.Fragment key={idx}>
            {link.method && (
              <Badge $bg="#e0e7ff" $color="#4338ca">{link.method}</Badge>
            )}
            <Badge $bg="#f1f5f9" $color="#475569">
              {link.from} → {link.to}
            </Badge>
          </React.Fragment>
        ))}
      </BadgeRow>
      {mod.description && (
        <CardDescription>{mod.description}</CardDescription>
      )}
    </ModuleCard>
  );
};

export default DivisionCompareView;
