import React, { useRef, useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { getRefTemperatures } from '../../utils/freqTempFileParser';

// 테이블 인덱스별 그룹화
const getTableGroups = (data) => {
  const groups = {};
  data.forEach(d => {
    const tableIndex = d.tableIndex ?? 0;
    if (!groups[tableIndex]) {
      groups[tableIndex] = [];
    }
    groups[tableIndex].push(d);
  });
  return groups;
};

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
  flex-wrap: wrap;
  gap: 8px;
`;

const Title = styled.h4`
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
`;

const ControlsRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const ChartSelect = styled.select`
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

const ToggleButton = styled.button`
  padding: 3px 8px;
  border: 1px solid ${props => props.active ? '#8b5cf6' : '#d1d5db'};
  border-radius: 4px;
  font-size: 10px;
  background: ${props => props.active ? '#f3e8ff' : 'white'};
  color: ${props => props.active ? '#8b5cf6' : '#64748b'};
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #8b5cf6;
    background: #faf5ff;
  }
`;

const ZoomControls = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding-left: 8px;
  border-left: 1px solid #e2e8f0;
`;

const ZoomButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #8b5cf6;
    color: #8b5cf6;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ZoomInfo = styled.span`
  font-size: 10px;
  color: #64748b;
  min-width: 32px;
  text-align: center;
`;

const ChartWrapper = styled.div`
  padding: 16px;
  height: 380px;
`;

const SVGContainer = styled.svg`
  width: 100%;
  height: 100%;

  .axis path, .axis line {
    stroke: #94a3b8;
    stroke-width: 1;
  }
  .axis text {
    font-size: 10px;
    fill: #334155;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  .grid line { stroke: #e2e8f0; stroke-dasharray: 2,2; }
  .grid path { stroke-width: 0; }
  .line { fill: none; stroke-width: 2; }
  .dot { stroke: white; stroke-width: 1.5; cursor: pointer; }
  .brush .selection { fill: rgba(139, 92, 246, 0.2); stroke: #8b5cf6; }
  .brush .overlay { cursor: crosshair; }
  .legend text { font-size: 10px; fill: #334155; }
  .axis-label { font-size: 11px; fill: #1e293b; font-weight: 500; }
`;

const EmptyState = styled.div`
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-size: 13px;
`;

const HelpText = styled.div`
  font-size: 9px;
  color: #94a3b8;
  text-align: center;
  padding: 4px 0;
  border-top: 1px solid #f1f5f9;
  background: #fafbfc;
`;

const PointTooltip = styled.div`
  position: absolute;
  padding: 6px 10px;
  background: rgba(30, 41, 59, 0.95);
  color: white;
  border-radius: 4px;
  font-size: 10px;
  pointer-events: none;
  z-index: 100;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  font-family: 'Consolas', 'Monaco', monospace;
`;

// 차트 타입 정의
const CHART_TYPES = [
  { key: 'freqModulus', label: 'Frequency vs Modulus', xKey: 'frequency', yKeys: ['storageModulus', 'lossModulus'], dataType: 'tempSweep' },
  { key: 'tempModulus', label: 'Temperature vs Modulus', xKey: 'temperature', yKeys: ['storageModulus', 'lossModulus'], dataType: 'tempSweep' },
  { key: 'freqTanDelta', label: 'Frequency vs Tan(δ)', xKey: 'frequency', yKeys: ['tanDelta'], dataType: 'tempSweep' },
  { key: 'tempTanDelta', label: 'Temperature vs Tan(δ)', xKey: 'temperature', yKeys: ['tanDelta'], dataType: 'tempSweep' },
  { key: 'shiftFactors', label: 'Shift Factors (aT)', xKey: 'temperature', yKeys: ['aT'], dataType: 'shiftFactors' },
  { key: 'masterCurve', label: 'Master Curve', xKey: 'frequency', yKeys: ['storageModulus', 'lossModulus'], dataType: 'masterCurve' },
  { key: 'masterTanDelta', label: 'Master Curve Tan(δ)', xKey: 'frequency', yKeys: ['tanDelta'], dataType: 'masterCurve' },
];

// 색상 팔레트
const COLORS = ['#8b5cf6', '#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#6366f1', '#14b8a6'];
const TEMP_COLORS = d3.scaleSequential(d3.interpolateTurbo);

const FreqTempChart = ({
  tempSweepData = [],
  shiftFactorsData = [],
  masterCurveData = [],
  tempSweepTables = []
}) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [chartType, setChartType] = useState('freqModulus');
  const [xLogScale, setXLogScale] = useState(true);
  const [yLogScale, setYLogScale] = useState(false);
  const [pointTooltip, setPointTooltip] = useState({ visible: false, x: 0, y: 0, text: '' });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomDomain, setZoomDomain] = useState(null);

  const originalDomainRef = useRef({ x: null, y: null });

  const resetZoom = useCallback(() => {
    setZoomDomain(null);
    setZoomLevel(1);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!zoomDomain && originalDomainRef.current.x) {
      const { x: xDomain, y: yDomain } = originalDomainRef.current;
      const xRange = xDomain[1] - xDomain[0];
      const yRange = yDomain[1] - yDomain[0];
      setZoomDomain({
        x: [xDomain[0] + xRange * 0.25, xDomain[1] - xRange * 0.25],
        y: [yDomain[0] + yRange * 0.25, yDomain[1] - yRange * 0.25]
      });
      setZoomLevel(2);
    } else if (zoomDomain) {
      const xRange = zoomDomain.x[1] - zoomDomain.x[0];
      const yRange = zoomDomain.y[1] - zoomDomain.y[0];
      setZoomDomain({
        x: [zoomDomain.x[0] + xRange * 0.25, zoomDomain.x[1] - xRange * 0.25],
        y: [zoomDomain.y[0] + yRange * 0.25, zoomDomain.y[1] - yRange * 0.25]
      });
      setZoomLevel(prev => Math.min(prev * 2, 32));
    }
  }, [zoomDomain]);

  const handleZoomOut = useCallback(() => {
    if (zoomDomain) {
      const xRange = zoomDomain.x[1] - zoomDomain.x[0];
      const yRange = zoomDomain.y[1] - zoomDomain.y[0];
      const newXDomain = [zoomDomain.x[0] - xRange * 0.5, zoomDomain.x[1] + xRange * 0.5];
      const newYDomain = [zoomDomain.y[0] - yRange * 0.5, zoomDomain.y[1] + yRange * 0.5];

      if (newXDomain[0] <= originalDomainRef.current.x[0] &&
          newXDomain[1] >= originalDomainRef.current.x[1]) {
        resetZoom();
      } else {
        setZoomDomain({ x: newXDomain, y: newYDomain });
        setZoomLevel(prev => Math.max(prev / 2, 1));
      }
    }
  }, [zoomDomain, resetZoom]);

  useEffect(() => {
    const chartConfig = CHART_TYPES.find(c => c.key === chartType);
    if (!chartConfig || !svgRef.current || !containerRef.current) return;

    // 데이터 선택
    let data;
    if (chartConfig.dataType === 'tempSweep') {
      data = tempSweepData;
    } else if (chartConfig.dataType === 'shiftFactors') {
      data = shiftFactorsData;
    } else if (chartConfig.dataType === 'masterCurve') {
      data = masterCurveData;
    }

    if (!data || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const containerRect = containerRef.current.getBoundingClientRect();
    const margin = { top: 20, right: 100, bottom: 55, left: 60 };
    const width = containerRect.width - margin.left - margin.right;
    const height = containerRect.height - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    const { xKey, yKeys } = chartConfig;

    // 데이터 필터링
    const filteredData = data.filter(d => {
      const xVal = d[xKey];
      if (xLogScale && xVal <= 0) return false;
      return yKeys.some(yKey => {
        const yVal = d[yKey];
        if (yVal === null || yVal === undefined) return false;
        if (yLogScale && yVal <= 0) return false;
        return true;
      });
    });

    if (filteredData.length === 0) return;

    // X 도메인 계산
    const xExtent = d3.extent(filteredData, d => d[xKey]);
    let xDomain;
    if (xLogScale) {
      xDomain = [Math.max(xExtent[0] * 0.5, 1e-15), xExtent[1] * 2];
    } else {
      const xPadding = (xExtent[1] - xExtent[0]) * 0.05;
      xDomain = [xExtent[0] - xPadding, xExtent[1] + xPadding];
    }

    // Y 도메인 계산 (모든 yKeys 고려)
    let yMin = Infinity, yMax = -Infinity;
    yKeys.forEach(yKey => {
      filteredData.forEach(d => {
        const val = d[yKey];
        if (val !== null && val !== undefined && isFinite(val)) {
          if (val < yMin) yMin = val;
          if (val > yMax) yMax = val;
        }
      });
    });

    let yDomain;
    if (yLogScale) {
      yDomain = [Math.max(yMin * 0.5, 1e-15), yMax * 2];
    } else {
      const yPadding = (yMax - yMin) * 0.1;
      yDomain = [Math.min(0, yMin - yPadding), yMax + yPadding];
    }

    originalDomainRef.current = { x: xDomain, y: yDomain };

    const currentXDomain = zoomDomain ? zoomDomain.x : xDomain;
    const currentYDomain = zoomDomain ? zoomDomain.y : yDomain;

    // 스케일 설정
    const xScale = xLogScale
      ? d3.scaleLog().domain(currentXDomain).range([0, width]).clamp(true)
      : d3.scaleLinear().domain(currentXDomain).range([0, width]);

    const yScale = yLogScale
      ? d3.scaleLog().domain(currentYDomain).range([height, 0]).clamp(true)
      : d3.scaleLinear().domain(currentYDomain).range([height, 0]);

    // 클립 패스
    svg.append('defs')
      .append('clipPath')
      .attr('id', 'ft-chart-clip')
      .append('rect')
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // 그리드용 축 생성 (레이블 없음)
    const xGridGen = xLogScale ? d3.axisBottom(xScale).ticks(5).tickSize(-height).tickFormat('') : d3.axisBottom(xScale).ticks(8).tickSize(-height).tickFormat('');
    const yGridGen = yLogScale ? d3.axisLeft(yScale).ticks(5).tickSize(-width).tickFormat('') : d3.axisLeft(yScale).ticks(6).tickSize(-width).tickFormat('');

    g.append('g').attr('class', 'grid').attr('transform', `translate(0,${height})`).call(xGridGen);
    g.append('g').attr('class', 'grid').call(yGridGen);

    // 축 생성 (레이블 포함)
    const xAxisGen = xLogScale ? d3.axisBottom(xScale).ticks(5, '~s') : d3.axisBottom(xScale).ticks(8);
    const yAxisGen = yLogScale ? d3.axisLeft(yScale).ticks(5, '~s') : d3.axisLeft(yScale).ticks(6);

    g.append('g').attr('class', 'axis x-axis').attr('transform', `translate(0,${height})`).call(xAxisGen);
    g.append('g').attr('class', 'axis y-axis').call(yAxisGen);

    // X축 레이블
    svg.append('text')
      .attr('class', 'axis-label')
      .attr('x', margin.left + width / 2)
      .attr('y', margin.top + height + 45)
      .attr('text-anchor', 'middle')
      .text(xKey.charAt(0).toUpperCase() + xKey.slice(1) + (xLogScale ? ' (Log)' : ''));

    // Y축 레이블
    const yLabel = chartConfig.yKeys.length > 1 ? 'Modulus (MPa)' : chartConfig.yKeys[0];
    svg.append('text')
      .attr('class', 'axis-label')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(margin.top + height / 2))
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .text(yLabel + (yLogScale ? ' (Log)' : ''));

    // 차트 영역
    const chartArea = g.append('g').attr('clip-path', 'url(#ft-chart-clip)');

    // 테이블별 색상 맵핑 (tempSweep의 경우)
    let tableColorScale;
    let tableGroups;
    let tableIndices;
    if (chartConfig.dataType === 'tempSweep') {
      tableGroups = getTableGroups(filteredData);
      tableIndices = Object.keys(tableGroups).map(k => parseInt(k)).sort((a, b) => a - b);
      tableColorScale = d3.scaleOrdinal().domain(tableIndices).range(COLORS.slice(0, tableIndices.length));
    }

    // 데이터 그리기
    yKeys.forEach((yKey, yIndex) => {
      const color = yIndex === 0 ? '#8b5cf6' : '#ef4444';

      if (chartConfig.dataType === 'tempSweep') {
        // 테이블별로 그룹화하여 그리기
        tableIndices.forEach((tableIndex, idx) => {
          const tableData = tableGroups[tableIndex] || [];
          const sortedData = [...tableData].sort((a, b) => a[xKey] - b[xKey]);
          const lineColor = tableColorScale(tableIndex);

          const line = d3.line()
            .x(d => xScale(d[xKey]))
            .y(d => yScale(d[yKey]))
            .defined(d => d[yKey] !== null && isFinite(xScale(d[xKey])) && isFinite(yScale(d[yKey])));

          chartArea.append('path')
            .datum(sortedData)
            .attr('class', 'line')
            .attr('d', line)
            .attr('stroke', lineColor)
            .attr('opacity', 0.8);

          // 테이블 정보 가져오기
          const tableInfo = tempSweepTables.find(t => t.index === tableIndex);
          const tableLabel = tableInfo?.temperature !== null ? `${tableInfo.temperature}°C` : `테이블 ${tableIndex + 1}`;

          chartArea.selectAll(`.dot-${yKey}-${tableIndex}`)
            .data(sortedData.filter(d => d[yKey] !== null))
            .enter()
            .append('circle')
            .attr('class', 'dot')
            .attr('cx', d => xScale(d[xKey]))
            .attr('cy', d => yScale(d[yKey]))
            .attr('r', 3)
            .attr('fill', lineColor)
            .on('mouseover', function(event, d) {
              d3.select(this).attr('r', 5);
              const rect = containerRef.current.getBoundingClientRect();
              setPointTooltip({
                visible: true,
                x: event.clientX - rect.left,
                y: event.clientY - rect.top - 35,
                text: `${tableLabel} | ${yKey}: ${formatValue(d[yKey])}`
              });
            })
            .on('mouseout', function() {
              d3.select(this).attr('r', 3);
              setPointTooltip({ visible: false, x: 0, y: 0, text: '' });
            });
        });
      } else {
        // 단일 라인
        const sortedData = [...filteredData].sort((a, b) => a[xKey] - b[xKey]);

        const line = d3.line()
          .x(d => xScale(d[xKey]))
          .y(d => yScale(d[yKey]))
          .defined(d => d[yKey] !== null && isFinite(xScale(d[xKey])) && isFinite(yScale(d[yKey])));

        chartArea.append('path')
          .datum(sortedData)
          .attr('class', 'line')
          .attr('d', line)
          .attr('stroke', color);

        chartArea.selectAll(`.dot-${yKey}`)
          .data(sortedData.filter(d => d[yKey] !== null))
          .enter()
          .append('circle')
          .attr('class', 'dot')
          .attr('cx', d => xScale(d[xKey]))
          .attr('cy', d => yScale(d[yKey]))
          .attr('r', 3)
          .attr('fill', color)
          .on('mouseover', function(event, d) {
            d3.select(this).attr('r', 5);
            const rect = containerRef.current.getBoundingClientRect();
            setPointTooltip({
              visible: true,
              x: event.clientX - rect.left,
              y: event.clientY - rect.top - 35,
              text: `X: ${formatValue(d[xKey])} | Y: ${formatValue(d[yKey])}`
            });
          })
          .on('mouseout', function() {
            d3.select(this).attr('r', 3);
            setPointTooltip({ visible: false, x: 0, y: 0, text: '' });
          });
      }
    });

    // 범례
    const legend = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${margin.left + width + 10}, ${margin.top})`);

    if (chartConfig.dataType === 'tempSweep') {
      tableIndices.slice(0, 8).forEach((tableIndex, i) => {
        const tableInfo = tempSweepTables.find(t => t.index === tableIndex);
        const tableLabel = tableInfo?.temperature !== null ? `${tableInfo.temperature}°C` : `T${tableIndex + 1}`;
        const ly = i * 14;
        legend.append('rect').attr('x', 0).attr('y', ly).attr('width', 10).attr('height', 10).attr('fill', tableColorScale(tableIndex));
        legend.append('text').attr('x', 14).attr('y', ly + 9).text(tableLabel);
      });
    } else {
      yKeys.forEach((yKey, i) => {
        const color = i === 0 ? '#8b5cf6' : '#ef4444';
        const ly = i * 14;
        legend.append('rect').attr('x', 0).attr('y', ly).attr('width', 10).attr('height', 10).attr('fill', color);
        legend.append('text').attr('x', 14).attr('y', ly + 9).text(yKey);
      });
    }

    // 브러시
    const brush = d3.brush()
      .extent([[0, 0], [width, height]])
      .on('end', (event) => {
        if (!event.selection) return;
        const [[x0, y0], [x1, y1]] = event.selection;
        if (Math.abs(x1 - x0) < 10 || Math.abs(y1 - y0) < 10) {
          g.select('.brush').call(brush.move, null);
          return;
        }
        setZoomDomain({
          x: [xScale.invert(x0), xScale.invert(x1)],
          y: [yScale.invert(y1), yScale.invert(y0)]
        });
        setZoomLevel(prev => prev * 2);
        g.select('.brush').call(brush.move, null);
      });

    g.append('g').attr('class', 'brush').call(brush);

    // 클릭 이벤트
    svg.on('click', (event) => {
      if (event.target.classList.contains('selection')) return;
      const isCtrl = event.ctrlKey || event.metaKey;
      const isShift = event.shiftKey;

      if (!isCtrl && !isShift && !event.target.classList.contains('dot')) {
        resetZoom();
      }
    });

  }, [tempSweepData, shiftFactorsData, masterCurveData, tempSweepTables, chartType, xLogScale, yLogScale, zoomDomain, resetZoom]);

  useEffect(() => {
    resetZoom();
  }, [chartType, xLogScale, yLogScale, resetZoom]);

  const formatValue = (value) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      if (Math.abs(value) < 0.0001 && value !== 0) return value.toExponential(3);
      if (Math.abs(value) >= 1e6) return value.toExponential(3);
      return value.toFixed(4).replace(/\.?0+$/, '');
    }
    return value;
  };

  const hasData = tempSweepData.length > 0 || shiftFactorsData.length > 0 || masterCurveData.length > 0;

  return (
    <Container>
      <Header>
        <Title>Freq-Temp 그래프</Title>
        <ControlsRow>
          <ChartSelect value={chartType} onChange={(e) => setChartType(e.target.value)}>
            {CHART_TYPES.map(ct => (
              <option key={ct.key} value={ct.key}>{ct.label}</option>
            ))}
          </ChartSelect>
          <ToggleButton type="button" active={xLogScale} onClick={() => setXLogScale(!xLogScale)}>X Log</ToggleButton>
          <ToggleButton type="button" active={yLogScale} onClick={() => setYLogScale(!yLogScale)}>Y Log</ToggleButton>
          <ZoomControls>
            <ZoomButton type="button" onClick={handleZoomOut} disabled={zoomLevel <= 1}><ZoomOut size={12} /></ZoomButton>
            <ZoomInfo>{zoomLevel.toFixed(0)}x</ZoomInfo>
            <ZoomButton type="button" onClick={handleZoomIn} disabled={zoomLevel >= 32}><ZoomIn size={12} /></ZoomButton>
            <ZoomButton type="button" onClick={resetZoom} disabled={zoomLevel === 1}><RotateCcw size={12} /></ZoomButton>
          </ZoomControls>
        </ControlsRow>
      </Header>

      <ChartWrapper ref={containerRef} style={{ position: 'relative' }}>
        {!hasData ? (
          <EmptyState>데이터가 없습니다.</EmptyState>
        ) : (
          <>
            <SVGContainer ref={svgRef} />
            {pointTooltip.visible && (
              <PointTooltip style={{ left: pointTooltip.x, top: pointTooltip.y, transform: 'translateX(-50%)' }}>
                {pointTooltip.text}
              </PointTooltip>
            )}
          </>
        )}
      </ChartWrapper>
      <HelpText>드래그: 영역 확대 | 클릭: 원래대로</HelpText>
    </Container>
  );
};

export default FreqTempChart;
