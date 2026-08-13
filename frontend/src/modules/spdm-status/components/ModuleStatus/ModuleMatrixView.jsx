import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronRight, ArrowRight, Package, Link2, Download } from 'lucide-react';

// ===== 색상 =====
const SYSTEM_COLORS = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
  '#ec4899', '#6366f1', '#f97316', '#14b8a6',
  '#ef4444', '#06b6d4', '#84cc16', '#a855f7',
];
const getSystemColor = (index) => SYSTEM_COLORS[index % SYSTEM_COLORS.length];

// ===== Styled Components =====
const Container = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 1.25rem;
  gap: 1.25rem;
`;

const ScrollArea = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
`;

// --- Summary ---
const SummaryRow = styled.div`
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  flex-shrink: 0;
`;

const SummaryCard = styled.div`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.625rem 1rem;
  text-align: center;
  min-width: 90px;
`;

const SummaryValue = styled.div`
  font-size: 1.125rem;
  font-weight: 700;
  color: #1e293b;
`;

const SummaryLabel = styled.div`
  font-size: 0.6875rem;
  color: #64748b;
  margin-top: 2px;
`;

// --- Section ---
const Section = styled.div`
  display: flex;
  flex-direction: column;
`;

const SectionTitle = styled.h3`
  font-size: 0.875rem;
  font-weight: 700;
  color: #475569;
  margin: 0 0 0.75rem 0;
`;

// --- System Group ---
const SystemGroup = styled.div`
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  overflow: hidden;
  margin-bottom: 0.5rem;
`;

const SystemHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  background: ${props => props.$bg || '#f8fafc'};
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;

  &:hover {
    filter: brightness(0.97);
  }
`;

const SystemDot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${props => props.$color};
  flex-shrink: 0;
`;

const SystemName = styled.span`
  font-size: 0.8125rem;
  font-weight: 700;
  color: #1e293b;
`;

const SystemCount = styled.span`
  font-size: 0.6875rem;
  color: #64748b;
  font-weight: 500;
`;

const SystemLinkBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 4px;
  font-size: 0.625rem;
  font-weight: 600;
  color: #92400e;
  margin-left: auto;
`;

const ChevronIcon = styled.span`
  display: flex;
  align-items: center;
  color: #94a3b8;
  flex-shrink: 0;
`;

// --- Module Table ---
const ModuleTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const ModuleTh = styled.th`
  padding: 0.5rem 0.75rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #64748b;
  background: #f1f5f9;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  white-space: nowrap;

  &:last-child {
    text-align: left;
  }
`;

const ModuleTr = styled.tr`
  transition: background 0.1s ease;

  &:hover {
    background: #f8fafc;
  }

  &:not(:last-child) td {
    border-bottom: 1px solid #f1f5f9;
  }
`;

const ModuleTd = styled.td`
  padding: 0.5rem 0.75rem;
  font-size: 0.8125rem;
  color: #334155;
  vertical-align: middle;
`;

const ModuleNameCell = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-weight: 500;
  white-space: nowrap;
`;

const CategoryBadge = styled.span`
  display: inline-flex;
  padding: 1px 6px;
  background: #f1f5f9;
  color: #64748b;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
`;

const LinkInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #92400e;
`;

const LinkSystemTag = styled.span`
  padding: 1px 6px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 4px;
  font-size: 0.6875rem;
  white-space: nowrap;
`;

const LinkMethodTag = styled.span`
  padding: 1px 6px;
  background: #f1f5f9;
  border-radius: 4px;
  font-size: 0.6875rem;
  color: #64748b;
  font-weight: 500;
`;

const NoLink = styled.span`
  color: #cbd5e1;
  font-size: 0.75rem;
`;

// --- Matrix ---
const MatrixWrapper = styled.div`
  overflow: auto;
`;

const Matrix = styled.table`
  border-collapse: collapse;
  min-width: 100%;
`;

const MatrixTh = styled.th`
  padding: 0.5rem 0.625rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: #475569;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  text-align: center;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 2;
`;

const MatrixThCorner = styled(MatrixTh)`
  position: sticky;
  left: 0;
  z-index: 3;
  background: #f1f5f9;
`;

const MatrixThRow = styled(MatrixTh)`
  position: sticky;
  left: 0;
  z-index: 1;
  text-align: right;
  background: #f8fafc;
`;

const MatrixTd = styled.td`
  padding: 0.375rem 0.5rem;
  font-size: 0.75rem;
  text-align: left;
  vertical-align: top;
  border: 1px solid #e2e8f0;
  background: ${props => props.$self ? '#f1f5f9' : props.$hasValue ? '#fffdf5' : 'white'};
  color: ${props => props.$hasValue ? '#1e293b' : '#cbd5e1'};
  min-width: 120px;
`;

const CellModuleList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const CellModule = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 4px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #92400e;
  line-height: 1.3;
`;

const CellMethod = styled.span`
  font-size: 0.625rem;
  font-weight: 500;
  color: #a16207;
  background: #fef9c3;
  padding: 0 4px;
  border-radius: 3px;
  white-space: nowrap;
`;

const CellEmpty = styled.span`
  display: block;
  text-align: center;
  color: #cbd5e1;
`;

const EmptyState = styled.div`
  color: #94a3b8;
  font-size: 0.875rem;
  text-align: center;
  padding: 3rem;
`;

const DownloadButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
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

// ===== Component =====
const ModuleMatrixView = ({ modules }) => {
  const [collapsedSystems, setCollapsedSystems] = useState(new Set());

  const { systems, systemModules, colorMap, matrix, totalLinked } = useMemo(() => {
    // 시스템별 모듈 그룹화
    const sysMap = new Map();
    modules.forEach(mod => {
      const sys = mod.systemType || '미분류';
      if (!sysMap.has(sys)) sysMap.set(sys, []);
      sysMap.get(sys).push(mod);
    });

    // 연계 대상 시스템도 포함
    modules.forEach(mod => {
      const modLinks = mod.links || [];
      modLinks.forEach(link => {
        if (link.from && !sysMap.has(link.from)) sysMap.set(link.from, []);
        if (link.to && !sysMap.has(link.to)) sysMap.set(link.to, []);
      });
    });

    const systems = [...sysMap.keys()].sort();
    const colorMap = {};
    systems.forEach((name, i) => { colorMap[name] = getSystemColor(i); });

    // 시스템별 모듈 + 연계 수
    const systemModules = {};
    systems.forEach(sys => {
      const mods = sysMap.get(sys) || [];
      const linkedCount = mods.reduce((sum, m) => sum + (m.links || []).filter(l => l.from && l.to).length, 0);
      systemModules[sys] = { modules: mods, linkedCount };
    });

    // 시스템 간 매트릭스: { from: { to: [{ mod, link }] } }
    const matrix = {};
    systems.forEach(from => {
      matrix[from] = {};
      systems.forEach(to => { matrix[from][to] = []; });
    });

    let totalLinked = 0;
    modules.forEach(mod => {
      const modLinks = (mod.links || []).filter(l => l.from && l.to);
      modLinks.forEach(link => {
        if (matrix[link.from]?.[link.to]) {
          matrix[link.from][link.to].push({ mod, link });
          totalLinked++;
        }
      });
    });

    return { systems, systemModules, colorMap, matrix, totalLinked };
  }, [modules]);

  const toggleSystem = (sys) => {
    setCollapsedSystems(prev => {
      const next = new Set(prev);
      if (next.has(sys)) next.delete(sys);
      else next.add(sys);
      return next;
    });
  };

  const handleDownloadCSV = () => {
    const escape = (val) => {
      if (val == null) return '';
      const s = String(val);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const lines = [];

    // Section 1: 시스템별 모듈 현황
    lines.push(['시스템', '모듈명', '구분', '연계From', '연계To', '연계방식'].map(escape).join(','));
    systems.forEach(sys => {
      const { modules: sysMods } = systemModules[sys];
      sysMods.forEach(mod => {
        const cats = (mod.categories || []).join('; ');
        const modLinks = (mod.links || []).filter(l => l.from && l.to);
        if (modLinks.length === 0) {
          lines.push([sys, mod.name, cats, '', '', ''].map(escape).join(','));
        } else {
          modLinks.forEach(link => {
            lines.push([sys, mod.name, cats, link.from || '', link.to || '', link.method || ''].map(escape).join(','));
          });
        }
      });
    });

    // Blank row separator
    lines.push('');

    // Section 2: 시스템 간 연계 매트릭스
    lines.push(['From \\ To', ...systems].map(escape).join(','));
    systems.forEach(from => {
      const row = [from];
      systems.forEach(to => {
        const mods = matrix[from]?.[to] || [];
        if (from === to) {
          row.push('-');
        } else if (mods.length > 0) {
          row.push(mods.map(item => `${item.mod.name}${item.link.method ? `(${item.link.method})` : ''}`).join('; '));
        } else {
          row.push('');
        }
      });
      lines.push(row.map(escape).join(','));
    });

    const csvContent = lines.join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    a.download = `ModuleMatrix_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (modules.length === 0) {
    return (
      <Container>
        <EmptyState>
          <Package size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
          <div>모듈이 없습니다.</div>
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container>
      <SummaryRow>
        <SummaryCard>
          <SummaryValue>{modules.length}</SummaryValue>
          <SummaryLabel>전체 모듈</SummaryLabel>
        </SummaryCard>
        <SummaryCard>
          <SummaryValue>{systems.length}</SummaryValue>
          <SummaryLabel>시스템 수</SummaryLabel>
        </SummaryCard>
        <SummaryCard>
          <SummaryValue>{totalLinked}</SummaryValue>
          <SummaryLabel>연계 건수</SummaryLabel>
        </SummaryCard>
        <DownloadButton onClick={handleDownloadCSV}>
          <Download size={14} />
          CSV 저장
        </DownloadButton>
      </SummaryRow>

      <ScrollArea>
        {/* ===== 시스템별 모듈 현황 ===== */}
        <Section>
          <SectionTitle>시스템별 모듈 현황</SectionTitle>
          {systems.map(sys => {
            const { modules: sysMods, linkedCount } = systemModules[sys];
            const color = colorMap[sys];
            const isCollapsed = collapsedSystems.has(sys);

            return (
              <SystemGroup key={sys}>
                <SystemHeader
                  $bg={`${color}10`}
                  onClick={() => toggleSystem(sys)}
                >
                  <ChevronIcon>
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </ChevronIcon>
                  <SystemDot $color={color} />
                  <SystemName>{sys}</SystemName>
                  <SystemCount>({sysMods.length}개 모듈)</SystemCount>
                  {linkedCount > 0 && (
                    <SystemLinkBadge>
                      <Link2 size={10} />
                      연계 {linkedCount}건
                    </SystemLinkBadge>
                  )}
                </SystemHeader>

                {!isCollapsed && sysMods.length > 0 && (
                  <ModuleTable>
                    <thead>
                      <tr>
                        <ModuleTh style={{ width: 'auto', whiteSpace: 'nowrap' }}>모듈명</ModuleTh>
                        <ModuleTh style={{ width: '30%' }}>구분</ModuleTh>
                        <ModuleTh>연계 정보</ModuleTh>
                      </tr>
                    </thead>
                    <tbody>
                      {sysMods.map(mod => {
                        const modLinks = (mod.links || []).filter(l => l.from && l.to);
                        const isLinked = modLinks.length > 0;
                        return (
                          <ModuleTr key={mod.id}>
                            <ModuleTd>
                              <ModuleNameCell>
                                <Package size={13} style={{ color: isLinked ? '#f59e0b' : '#94a3b8', flexShrink: 0 }} />
                                {mod.name}
                              </ModuleNameCell>
                            </ModuleTd>
                            <ModuleTd>
                              {mod.categories && mod.categories.length > 0 ? (
                                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                  {mod.categories.map(cat => (
                                    <CategoryBadge key={cat}>{cat}</CategoryBadge>
                                  ))}
                                </div>
                              ) : (
                                <NoLink>-</NoLink>
                              )}
                            </ModuleTd>
                            <ModuleTd>
                              {isLinked ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                  {modLinks.map((link, idx) => (
                                    <LinkInfo key={idx}>
                                      <LinkSystemTag>{link.from}</LinkSystemTag>
                                      <ArrowRight size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
                                      <LinkSystemTag>{link.to}</LinkSystemTag>
                                      {link.method && (
                                        <LinkMethodTag>{link.method}</LinkMethodTag>
                                      )}
                                    </LinkInfo>
                                  ))}
                                </div>
                              ) : (
                                <NoLink>-</NoLink>
                              )}
                            </ModuleTd>
                          </ModuleTr>
                        );
                      })}
                    </tbody>
                  </ModuleTable>
                )}

                {!isCollapsed && sysMods.length === 0 && (
                  <div style={{ padding: '0.75rem', color: '#94a3b8', fontSize: '0.75rem', textAlign: 'center' }}>
                    소속 모듈 없음 (연계 대상으로만 등록됨)
                  </div>
                )}
              </SystemGroup>
            );
          })}
        </Section>

        {/* ===== 시스템 간 연계 매트릭스 ===== */}
        {systems.length > 1 && (
          <Section>
            <SectionTitle>시스템 간 연계 매트릭스</SectionTitle>
            <MatrixWrapper>
              <Matrix>
                <thead>
                  <tr>
                    <MatrixThCorner>From ＼ To</MatrixThCorner>
                    {systems.map(sys => (
                      <MatrixTh key={sys}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <SystemDot $color={colorMap[sys]} />
                          {sys}
                        </span>
                      </MatrixTh>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {systems.map(from => (
                    <tr key={from}>
                      <MatrixThRow>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {from}
                          <SystemDot $color={colorMap[from]} />
                        </span>
                      </MatrixThRow>
                      {systems.map(to => {
                        const mods = matrix[from]?.[to] || [];
                        const isSelf = from === to;
                        return (
                          <MatrixTd
                            key={to}
                            $self={isSelf}
                            $hasValue={mods.length > 0 && !isSelf}
                          >
                            {isSelf ? (
                              <CellEmpty>-</CellEmpty>
                            ) : mods.length > 0 ? (
                              <CellModuleList>
                                {mods.map((item, idx) => (
                                  <CellModule key={`${item.mod.id}-${idx}`}>
                                    <span>{item.mod.name}</span>
                                    {item.link.method && (
                                      <CellMethod>{item.link.method}</CellMethod>
                                    )}
                                  </CellModule>
                                ))}
                              </CellModuleList>
                            ) : (
                              <CellEmpty>-</CellEmpty>
                            )}
                          </MatrixTd>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </Matrix>
            </MatrixWrapper>
          </Section>
        )}
      </ScrollArea>

    </Container>
  );
};

export default ModuleMatrixView;
