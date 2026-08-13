import React, { useState } from 'react';
import styled from 'styled-components';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { FREQ_TEMP_COLUMNS, SHIFT_FACTORS_COLUMNS, MASTER_CURVE_COLUMNS, getUniqueTemperatures, getRefTemperatures } from '../../utils/freqTempFileParser';

const Container = styled.div`
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
`;

const Title = styled.h4`
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
`;

const RowCount = styled.span`
  font-size: 12px;
  color: #64748b;
  margin-left: 8px;
  font-weight: 400;
`;

const TabsContainer = styled.div`
  display: flex;
  border-bottom: 1px solid #e2e8f0;
  background: #fafbfc;
`;

const Tab = styled.button`
  padding: 10px 16px;
  border: none;
  background: ${props => props.active ? 'white' : 'transparent'};
  font-size: 12px;
  font-weight: 500;
  color: ${props => props.active ? '#8b5cf6' : '#64748b'};
  cursor: pointer;
  border-bottom: 2px solid ${props => props.active ? '#8b5cf6' : 'transparent'};
  transition: all 0.2s;

  &:hover {
    color: #8b5cf6;
  }
`;

const FilterContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
`;

const FilterLabel = styled.span`
  font-size: 11px;
  color: #64748b;
`;

const FilterSelect = styled.select`
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  font-size: 11px;
  background: white;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: #8b5cf6;
  }
`;

const TableWrapper = styled.div`
  max-height: 380px;
  overflow: auto;

  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
`;

const Thead = styled.thead`
  background: #f1f5f9;
  position: sticky;
  top: 0;
  z-index: 1;
`;

const Th = styled.th`
  padding: 8px 8px;
  text-align: right;
  font-weight: 600;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
  min-width: 70px;

  &:first-child {
    text-align: center;
    min-width: 40px;
  }
`;

const Tbody = styled.tbody``;

const Tr = styled.tr`
  &:hover {
    background: #fafbfc;
  }

  &:not(:last-child) td {
    border-bottom: 1px solid #f1f5f9;
  }
`;

const Td = styled.td`
  padding: 6px 8px;
  color: #1e293b;
  text-align: right;
  font-family: 'Consolas', 'Monaco', monospace;

  &:first-child {
    text-align: center;
    color: #64748b;
  }
`;

const EmptyState = styled.div`
  padding: 32px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
`;

const formatValue = (value) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') {
    if (Math.abs(value) < 0.0001 && value !== 0) {
      return value.toExponential(3);
    }
    if (Math.abs(value) >= 1e6) {
      return value.toExponential(3);
    }
    return value.toFixed(4).replace(/\.?0+$/, '');
  }
  return value;
};

const FreqTempDataTable = ({
  tempSweepData = [],
  shiftFactorsData = [],
  masterCurveData = [],
  tempSweepTables = [],
  readOnly = false
}) => {
  const [activeTab, setActiveTab] = useState('tempSweep');
  const [selectedTableIndex, setSelectedTableIndex] = useState('all');
  const [selectedRefTemp, setSelectedRefTemp] = useState('all');

  const refTemperatures = getRefTemperatures(shiftFactorsData, masterCurveData);

  // 테이블 인덱스 기반 필터링
  const filteredTempSweepData = selectedTableIndex === 'all'
    ? tempSweepData
    : tempSweepData.filter(d => d.tableIndex === parseInt(selectedTableIndex));

  const filteredShiftFactors = selectedRefTemp === 'all'
    ? shiftFactorsData
    : shiftFactorsData.filter(d => d.refTemperature === parseFloat(selectedRefTemp));

  const filteredMasterCurve = selectedRefTemp === 'all'
    ? masterCurveData
    : masterCurveData.filter(d => d.refTemperature === parseFloat(selectedRefTemp));

  // 테이블별 데이터 수 계산
  const getTableRowCount = (tableIndex) => {
    return tempSweepData.filter(d => d.tableIndex === tableIndex).length;
  };

  const renderTempSweepTable = () => (
    <>
      {tempSweepTables.length > 1 && (
        <FilterContainer>
          <FilterLabel>온도 테이블:</FilterLabel>
          <FilterSelect value={selectedTableIndex} onChange={(e) => setSelectedTableIndex(e.target.value)}>
            <option value="all">전체 ({tempSweepData.length}행)</option>
            {tempSweepTables.map(table => (
              <option key={table.index} value={table.index}>
                {table.temperature !== null ? `${table.temperature}°C` : `테이블 ${table.index + 1}`} ({getTableRowCount(table.index)}행)
              </option>
            ))}
          </FilterSelect>
        </FilterContainer>
      )}
      <TableWrapper>
        {filteredTempSweepData.length === 0 ? (
          <EmptyState>데이터가 없습니다.</EmptyState>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>#</Th>
                {FREQ_TEMP_COLUMNS.map(col => (
                  <Th key={col.key}>{col.label}{col.unit ? ` (${col.unit})` : ''}</Th>
                ))}
              </tr>
            </Thead>
            <Tbody>
              {filteredTempSweepData.map((row, index) => (
                <Tr key={row.id || index}>
                  <Td>{index + 1}</Td>
                  {FREQ_TEMP_COLUMNS.map(col => (
                    <Td key={col.key}>{formatValue(row[col.key])}</Td>
                  ))}
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </TableWrapper>
    </>
  );

  const renderShiftFactorsTable = () => (
    <>
      {refTemperatures.length > 1 && (
        <FilterContainer>
          <FilterLabel>참조 온도:</FilterLabel>
          <FilterSelect value={selectedRefTemp} onChange={(e) => setSelectedRefTemp(e.target.value)}>
            <option value="all">전체</option>
            {refTemperatures.map(temp => (
              <option key={temp} value={temp}>{temp}°C</option>
            ))}
          </FilterSelect>
        </FilterContainer>
      )}
      <TableWrapper>
        {filteredShiftFactors.length === 0 ? (
          <EmptyState>Shift Factors 데이터가 없습니다.</EmptyState>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>#</Th>
                {refTemperatures.length > 1 && <Th>Ref T (°C)</Th>}
                {SHIFT_FACTORS_COLUMNS.map(col => (
                  <Th key={col.key}>{col.label}{col.unit ? ` (${col.unit})` : ''}</Th>
                ))}
              </tr>
            </Thead>
            <Tbody>
              {filteredShiftFactors.map((row, index) => (
                <Tr key={row.id || index}>
                  <Td>{index + 1}</Td>
                  {refTemperatures.length > 1 && <Td>{row.refTemperature}</Td>}
                  {SHIFT_FACTORS_COLUMNS.map(col => (
                    <Td key={col.key}>{formatValue(row[col.key])}</Td>
                  ))}
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </TableWrapper>
    </>
  );

  const renderMasterCurveTable = () => (
    <>
      {refTemperatures.length > 1 && (
        <FilterContainer>
          <FilterLabel>참조 온도:</FilterLabel>
          <FilterSelect value={selectedRefTemp} onChange={(e) => setSelectedRefTemp(e.target.value)}>
            <option value="all">전체</option>
            {refTemperatures.map(temp => (
              <option key={temp} value={temp}>{temp}°C</option>
            ))}
          </FilterSelect>
        </FilterContainer>
      )}
      <TableWrapper>
        {filteredMasterCurve.length === 0 ? (
          <EmptyState>Master Curve 데이터가 없습니다.</EmptyState>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>#</Th>
                {refTemperatures.length > 1 && <Th>Ref T (°C)</Th>}
                {MASTER_CURVE_COLUMNS.map(col => (
                  <Th key={col.key}>{col.label}{col.unit ? ` (${col.unit})` : ''}</Th>
                ))}
              </tr>
            </Thead>
            <Tbody>
              {filteredMasterCurve.map((row, index) => (
                <Tr key={row.id || index}>
                  <Td>{index + 1}</Td>
                  {refTemperatures.length > 1 && <Td>{row.refTemperature}</Td>}
                  {MASTER_CURVE_COLUMNS.map(col => (
                    <Td key={col.key}>{formatValue(row[col.key])}</Td>
                  ))}
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </TableWrapper>
    </>
  );

  const totalCount = tempSweepData.length + shiftFactorsData.length + masterCurveData.length;

  return (
    <Container>
      <Header>
        <Title>
          Freq-Temp 데이터
          <RowCount>({totalCount}행)</RowCount>
        </Title>
      </Header>

      <TabsContainer>
        <Tab type="button" active={activeTab === 'tempSweep'} onClick={() => setActiveTab('tempSweep')}>
          온도 스윕 ({tempSweepData.length})
        </Tab>
        <Tab type="button" active={activeTab === 'shiftFactors'} onClick={() => setActiveTab('shiftFactors')}>
          Shift Factors ({shiftFactorsData.length})
        </Tab>
        <Tab type="button" active={activeTab === 'masterCurve'} onClick={() => setActiveTab('masterCurve')}>
          Master Curve ({masterCurveData.length})
        </Tab>
      </TabsContainer>

      {activeTab === 'tempSweep' && renderTempSweepTable()}
      {activeTab === 'shiftFactors' && renderShiftFactorsTable()}
      {activeTab === 'masterCurve' && renderMasterCurveTable()}
    </Container>
  );
};

export default FreqTempDataTable;
