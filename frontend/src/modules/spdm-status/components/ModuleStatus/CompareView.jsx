import React, { useMemo } from 'react';
import styled from 'styled-components';
import { ArrowLeft, Download } from 'lucide-react';
import { downloadCSV } from '../../../../shared/utils/csvUtils';
import { useModuleCategories } from '../../contexts/ModuleCategoryContext';

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

  &:hover {
    background: #f1f5f9;
    color: #1e293b;
  }
`;

const Title = styled.h3`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const TableWrapper = styled.div`
  flex: 1;
  overflow: auto;
  padding: 1rem;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
`;

const Th = styled.th`
  padding: 0.625rem 0.875rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  text-align: left;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 1;
`;

const KeyTh = styled(Th)`
  width: 200px;
  min-width: 200px;
  position: sticky;
  left: 0;
  z-index: 2;
  background: #f1f5f9;
`;

const Td = styled.td`
  padding: 0.5rem 0.875rem;
  border: 1px solid #e2e8f0;
  color: #1e293b;
  vertical-align: top;
  background: ${props => props.$diff ? '#fef3c7' : 'white'};
`;

const KeyTd = styled(Td)`
  font-weight: 500;
  background: ${props => props.$group ? '#f1f5f9' : '#fafbfc'};
  position: sticky;
  left: 0;
  z-index: 1;
  padding-left: ${props => (props.$depth || 0) * 16 + 12}px;
`;

const GroupRow = styled.tr`
  td {
    background: #f1f5f9;
    font-weight: 600;
    color: #7c3aed;
  }
`;

const EmptyValue = styled.span`
  color: #cbd5e1;
  font-style: italic;
`;

const SectionDivider = styled.tr`
  td {
    padding: 0.375rem 0.875rem;
    background: #e2e8f0;
    font-size: 0.75rem;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
`;

const MetaLabel = styled.span`
  color: #64748b;
  font-weight: 600;
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

/**
 * Flatten spec tree into array of { key, depth, path, values: {moduleId: value} }
 */
const flattenSpecs = (modules) => {
  const allKeys = [];
  const keyMap = new Map();

  const traverse = (nodes, depth, parentPath, moduleId) => {
    if (!nodes) return;
    for (const node of nodes) {
      const path = parentPath ? `${parentPath} > ${node.key}` : node.key;
      if (!node.key) continue;

      if (!keyMap.has(path)) {
        const entry = { key: node.key, depth, path, isGroup: !!node.children, values: {} };
        keyMap.set(path, entry);
        allKeys.push(entry);
      }

      const entry = keyMap.get(path);
      if (node.children) {
        traverse(node.children, depth + 1, path, moduleId);
      } else {
        entry.values[moduleId] = node.value || '';
      }
    }
  };

  modules.forEach(mod => {
    traverse(mod.specs || [], 0, '', mod.id);
  });

  return allKeys;
};

const METADATA_FIELDS = [
  { key: 'categories', label: '모듈 구분' },
  { key: 'systemType', label: '구현 시스템' },
  { key: 'links', label: '연계 모듈' },
  { key: 'description', label: '설명' },
];

const getMetaDisplayValue = (mod, fieldKey) => {
  const val = mod[fieldKey];
  if (fieldKey === 'categories') return Array.isArray(val) && val.length > 0 ? val.join(', ') : '';
  if (fieldKey === 'links') {
    const links = Array.isArray(val) ? val.filter(l => l.from && l.to) : [];
    if (links.length === 0) return '';
    return links.map(l => `${l.from} → ${l.to}${l.method ? ` (${l.method})` : ''}`).join(', ');
  }
  return val || '';
};

const CompareView = ({ modules, onBack, embedded }) => {
  const rows = useMemo(() => flattenSpecs(modules), [modules]);
  const moduleIds = modules.map(m => m.id);

  const metaRows = useMemo(() => {
    return METADATA_FIELDS.map(field => {
      const values = modules.map(mod => getMetaDisplayValue(mod, field.key));
      const nonEmpty = values.filter(v => v);
      const unique = new Set(nonEmpty);
      const hasDiff = unique.size > 1;
      return { ...field, values, hasDiff };
    });
  }, [modules]);

  const handleDownloadCSV = () => {
    const csvData = [];

    // Metadata rows
    metaRows.forEach(({ label, values }) => {
      const row = { '항목': label };
      modules.forEach((mod, i) => {
        row[mod.name] = values[i] || '-';
      });
      csvData.push(row);
    });

    // Spec rows
    rows.forEach(specRow => {
      const entry = { '항목': '  '.repeat(specRow.depth) + specRow.key };
      if (specRow.isGroup) {
        modules.forEach(mod => { entry[mod.name] = ''; });
      } else {
        modules.forEach(mod => {
          entry[mod.name] = specRow.values[mod.id] || '-';
        });
      }
      csvData.push(entry);
    });

    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    downloadCSV(csvData, `Compare_${dateStr}.csv`);
  };

  return (
    <Container style={embedded ? { flex: 'none' } : undefined}>
      {!embedded && (
        <Header>
          <BackButton onClick={onBack}>
            <ArrowLeft size={16} />
          </BackButton>
          <Title>모듈 비교 ({modules.length}개)</Title>
          <DownloadButton onClick={handleDownloadCSV}>
            <Download size={14} />
            CSV 저장
          </DownloadButton>
        </Header>
      )}
      <TableWrapper style={embedded ? { flex: 'none', overflow: 'visible' } : undefined}>
        <Table>
          <thead>
            <tr>
              <KeyTh>항목</KeyTh>
              {modules.map(mod => (
                <Th key={mod.id}>{mod.name}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* 메타데이터 비교 섹션 */}
            <SectionDivider>
              <td colSpan={modules.length + 1}>기본 정보</td>
            </SectionDivider>
            {metaRows.map(({ key, label, values, hasDiff }) => (
              <tr key={`meta-${key}`}>
                <KeyTd><MetaLabel>{label}</MetaLabel></KeyTd>
                {values.map((val, i) => (
                  <Td key={moduleIds[i]} $diff={hasDiff && val}>
                    {val || <EmptyValue>-</EmptyValue>}
                  </Td>
                ))}
              </tr>
            ))}

            {/* 스펙 비교 섹션 */}
            <SectionDivider>
              <td colSpan={modules.length + 1}>스펙</td>
            </SectionDivider>
            {rows.map((row) => {
              if (row.isGroup) {
                return (
                  <GroupRow key={row.path}>
                    <KeyTd $group $depth={row.depth}>{row.key}</KeyTd>
                    {moduleIds.map(id => (
                      <Td key={id} style={{ background: '#f1f5f9' }}></Td>
                    ))}
                  </GroupRow>
                );
              }

              const values = moduleIds.map(id => row.values[id] || '');
              const uniqueValues = new Set(values.filter(v => v));
              const hasDiff = uniqueValues.size > 1;

              return (
                <tr key={row.path}>
                  <KeyTd $depth={row.depth}>{row.key}</KeyTd>
                  {moduleIds.map((id, i) => (
                    <Td key={id} $diff={hasDiff && values[i]}>
                      {values[i] || <EmptyValue>-</EmptyValue>}
                    </Td>
                  ))}
                </tr>
              );
            })}
            {rows.length === 0 && metaRows.length === 0 && (
              <tr>
                <Td colSpan={modules.length + 1} style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>
                  비교할 데이터가 없습니다.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </TableWrapper>
    </Container>
  );
};

export default CompareView;
