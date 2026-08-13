import React, { useRef, useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import * as d3 from 'd3';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

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
  gap: 12px;
  flex-wrap: wrap;
`;

const ChartControls = styled.div`
  display: flex;
  gap: 8px;
`;

const AxisSelect = styled.select`
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

const ScaleControls = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding-left: 8px;
  border-left: 1px solid #e2e8f0;
`;

const ScaleLabel = styled.span`
  font-size: 10px;
  color: #64748b;
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
  width: 24px;
  height: 24px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: white;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #8b5cf6;
    color: #8b5cf6;
    background: #faf5ff;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const ZoomInfo = styled.span`
  font-size: 10px;
  color: #64748b;
  min-width: 40px;
  text-align: center;
`;

const ChartWrapper = styled.div`
  padding: 16px;
  height: 380px;
`;

const SVGContainer = styled.svg`
  width: 100%;
  height: 100%;

  .axis path,
  .axis line {
    stroke: #94a3b8;
    stroke-width: 1;
  }

  .axis text {
    font-size: 10px;
    fill: #334155;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .grid line {
    stroke: #e2e8f0;
    stroke-dasharray: 2,2;
  }

  .grid path {
    stroke-width: 0;
  }

  .line {
    fill: none;
    stroke: #10b981;
    stroke-width: 2;
  }

  .dot {
    fill: #10b981;
    stroke: white;
    stroke-width: 2;
    cursor: pointer;
    pointer-events: all;
  }

  .dots-group {
    pointer-events: all;
  }

  .brush .selection {
    fill: rgba(16, 185, 129, 0.2);
    stroke: #10b981;
    stroke-width: 1;
  }

  .brush .overlay {
    cursor: crosshair;
  }

  .axis-label {
    font-size: 11px;
    fill: #1e293b;
    font-weight: 500;
  }
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

const AXIS_OPTIONS = [
  { key: 'oscillationStrain', label: 'Strain (%)' },
  { key: 'oscillationStress', label: 'Stress (MPa)' },
  { key: 'storageModulus', label: "Storage Modulus (MPa)" },
  { key: 'lossModulus', label: "Loss Modulus (MPa)" },
  { key: 'tanDelta', label: 'Tan(delta)' },
  { key: 'temperature', label: 'Temperature (°C)' },
];

const StrainSweepChart = ({ data = [] }) => {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [xAxisKey, setXAxisKey] = useState('oscillationStrain');
  const [yAxisKey, setYAxisKey] = useState('storageModulus');
  const [xLogScale, setXLogScale] = useState(false);
  const [yLogScale, setYLogScale] = useState(false);
  const [pointTooltip, setPointTooltip] = useState({ visible: false, x: 0, y: 0, xValue: 0, yValue: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoomDomain, setZoomDomain] = useState(null);

  const originalDomainRef = useRef({ x: null, y: null });

  const resetZoom = useCallback(() => {
    setZoomDomain(null);
    setZoomLevel(1);
  }, []);

  const handleZoomIn = useCallback(() => {
    if (!zoomDomain && originalDomainRef.current.x) {
      const xDomain = originalDomainRef.current.x;
      const yDomain = originalDomainRef.current.y;
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
    if (!data.length || !svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const containerRect = containerRef.current.getBoundingClientRect();
    const margin = { top: 20, right: 20, bottom: 55, left: 60 };
    const width = containerRect.width - margin.left - margin.right;
    const height = containerRect.height - margin.top - margin.bottom;

    if (width <= 0 || height <= 0) return;

    const sortedData = [...data].sort((a, b) => a[xAxisKey] - b[xAxisKey]);

    const filteredData = sortedData.filter(d => {
      const xVal = d[xAxisKey];
      const yVal = d[yAxisKey];
      if (xVal === null || yVal === null) return false;
      if (xLogScale && xVal <= 0) return false;
      if (yLogScale && yVal <= 0) return false;
      return true;
    });

    if (filteredData.length === 0) return;

    const xExtent = d3.extent(filteredData, d => d[xAxisKey]);
    const yExtent = d3.extent(filteredData, d => d[yAxisKey]);

    let xDomain, yDomain;

    if (xLogScale) {
      xDomain = [Math.max(xExtent[0] * 0.9, 1e-10), xExtent[1] * 1.1];
    } else {
      xDomain = [Math.min(0, xExtent[0]), xExtent[1] * 1.05];
    }

    if (yLogScale) {
      yDomain = [Math.max(yExtent[0] * 0.9, 1e-10), yExtent[1] * 1.1];
    } else {
      yDomain = [Math.min(0, yExtent[0]), yExtent[1] * 1.05];
    }

    originalDomainRef.current = { x: xDomain, y: yDomain };

    const currentXDomain = zoomDomain ? zoomDomain.x : xDomain;
    const currentYDomain = zoomDomain ? zoomDomain.y : yDomain;

    const xScale = xLogScale
      ? d3.scaleLog().domain(currentXDomain).range([0, width]).clamp(true)
      : d3.scaleLinear().domain(currentXDomain).range([0, width]);

    const yScale = yLogScale
      ? d3.scaleLog().domain(currentYDomain).range([height, 0]).clamp(true)
      : d3.scaleLinear().domain(currentYDomain).range([height, 0]);

    svg.append('defs')
      .append('clipPath')
      .attr('id', 'ss-chart-clip')
      .append('rect')
      .attr('width', width)
      .attr('height', height);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // 그리드용 축 생성 (레이블 없음)
    const xGridGen = xLogScale ? d3.axisBottom(xScale).ticks(5).tickSize(-height).tickFormat('') : d3.axisBottom(xScale).ticks(8).tickSize(-height).tickFormat('');
    const yGridGen = yLogScale ? d3.axisLeft(yScale).ticks(5).tickSize(-width).tickFormat('') : d3.axisLeft(yScale).ticks(6).tickSize(-width).tickFormat('');

    g.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height})`)
      .call(xGridGen);

    g.append('g')
      .attr('class', 'grid')
      .call(yGridGen);

    // 축 생성 (레이블 포함)
    const xAxisGenerator = xLogScale ? d3.axisBottom(xScale).ticks(5, '~s') : d3.axisBottom(xScale).ticks(8);
    const yAxisGenerator = yLogScale ? d3.axisLeft(yScale).ticks(5, '~s') : d3.axisLeft(yScale).ticks(6);

    g.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${height})`)
      .call(xAxisGenerator);

    g.append('g')
      .attr('class', 'axis y-axis')
      .call(yAxisGenerator);

    const xLabel = AXIS_OPTIONS.find(o => o.key === xAxisKey)?.label || xAxisKey;
    svg.append('text')
      .attr('x', margin.left + width / 2)
      .attr('y', margin.top + height + 45)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#64748b')
      .text(xLabel + (xLogScale ? ' (Log)' : ''));

    const yLabel = AXIS_OPTIONS.find(o => o.key === yAxisKey)?.label || yAxisKey;
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(margin.top + height / 2))
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#64748b')
      .text(yLabel + (yLogScale ? ' (Log)' : ''));

    const chartArea = g.append('g')
      .attr('clip-path', 'url(#ss-chart-clip)');

    const line = d3.line()
      .x(d => xScale(d[xAxisKey]))
      .y(d => yScale(d[yAxisKey]))
      .curve(d3.curveMonotoneX)
      .defined(d => {
        const x = xScale(d[xAxisKey]);
        const y = yScale(d[yAxisKey]);
        return isFinite(x) && isFinite(y);
      });

    chartArea.append('path')
      .datum(filteredData)
      .attr('class', 'line')
      .attr('d', line);

    const brush = d3.brush()
      .extent([[0, 0], [width, height]])
      .on('end', (event) => {
        if (!event.selection) return;

        const [[x0, y0], [x1, y1]] = event.selection;

        if (Math.abs(x1 - x0) < 10 || Math.abs(y1 - y0) < 10) {
          g.select('.brush').call(brush.move, null);
          return;
        }

        const newXDomain = [xScale.invert(x0), xScale.invert(x1)];
        const newYDomain = [yScale.invert(y1), yScale.invert(y0)];

        setZoomDomain({ x: newXDomain, y: newYDomain });
        setZoomLevel(prev => prev * 2);

        g.select('.brush').call(brush.move, null);
      });

    g.append('g')
      .attr('class', 'brush')
      .call(brush);

    const dotsGroup = g.append('g').attr('class', 'dots-group');

    dotsGroup.selectAll('.dot')
      .data(filteredData)
      .enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(d[xAxisKey]))
      .attr('cy', d => yScale(d[yAxisKey]))
      .attr('r', 4)
      .style('pointer-events', 'all')
      .on('mouseover', function(event, d) {
        event.stopPropagation();
        d3.select(this).attr('r', 6).style('fill', '#059669');
        const rect = containerRef.current.getBoundingClientRect();
        setPointTooltip({
          visible: true,
          x: event.clientX - rect.left,
          y: event.clientY - rect.top - 35,
          xValue: d[xAxisKey],
          yValue: d[yAxisKey]
        });
      })
      .on('mouseout', function() {
        d3.select(this).attr('r', 4).style('fill', '#10b981');
        setPointTooltip({ visible: false, x: 0, y: 0, xValue: 0, yValue: 0 });
      });

    svg.on('click', (event) => {
      if (event.target.classList.contains('selection')) return;

      const isCtrl = event.ctrlKey || event.metaKey;
      const isShift = event.shiftKey;

      if (isCtrl) {
        const mouseX = event.offsetX - margin.left;
        const mouseY = event.offsetY - margin.top;

        if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;

        const xRatio = mouseX / width;
        const yRatio = mouseY / height;

        const currentX = zoomDomain ? zoomDomain.x : xDomain;
        const currentY = zoomDomain ? zoomDomain.y : yDomain;

        const xRange = currentX[1] - currentX[0];
        const yRange = currentY[1] - currentY[0];

        const newXRange = xRange * 0.5;
        const newYRange = yRange * 0.5;

        const newXDomain = [
          currentX[0] + (xRange - newXRange) * xRatio,
          currentX[1] - (xRange - newXRange) * (1 - xRatio)
        ];
        const newYDomain = [
          currentY[0] + (yRange - newYRange) * (1 - yRatio),
          currentY[1] - (yRange - newYRange) * yRatio
        ];

        setZoomDomain({ x: newXDomain, y: newYDomain });
        setZoomLevel(prev => Math.min(prev * 2, 32));
      } else if (isShift) {
        if (zoomDomain) {
          const xRange = zoomDomain.x[1] - zoomDomain.x[0];
          const yRange = zoomDomain.y[1] - zoomDomain.y[0];
          const newXDomain = [zoomDomain.x[0] - xRange * 0.5, zoomDomain.x[1] + xRange * 0.5];
          const newYDomain = [zoomDomain.y[0] - yRange * 0.5, zoomDomain.y[1] + yRange * 0.5];

          if (newXDomain[0] <= originalDomainRef.current.x[0] &&
              newXDomain[1] >= originalDomainRef.current.x[1]) {
            setZoomDomain(null);
            setZoomLevel(1);
          } else {
            setZoomDomain({ x: newXDomain, y: newYDomain });
            setZoomLevel(prev => Math.max(prev / 2, 1));
          }
        }
      } else {
        if (!event.target.classList.contains('dot')) {
          setZoomDomain(null);
          setZoomLevel(1);
        }
      }
    });

  }, [data, xAxisKey, yAxisKey, xLogScale, yLogScale, zoomDomain, resetZoom]);

  useEffect(() => {
    resetZoom();
  }, [xAxisKey, yAxisKey, xLogScale, yLogScale, resetZoom]);

  const formatValue = (value) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      if (Math.abs(value) < 0.0001 && value !== 0) {
        return value.toExponential(3);
      }
      return value.toFixed(4).replace(/\.?0+$/, '');
    }
    return value;
  };

  return (
    <Container>
      <Header>
        <Title>Strain Sweep 그래프</Title>
        <ControlsRow>
          <ChartControls>
            <AxisSelect value={xAxisKey} onChange={(e) => setXAxisKey(e.target.value)}>
              {AXIS_OPTIONS.map(opt => (
                <option key={opt.key} value={opt.key}>X: {opt.label}</option>
              ))}
            </AxisSelect>
            <AxisSelect value={yAxisKey} onChange={(e) => setYAxisKey(e.target.value)}>
              {AXIS_OPTIONS.map(opt => (
                <option key={opt.key} value={opt.key}>Y: {opt.label}</option>
              ))}
            </AxisSelect>
          </ChartControls>

          <ScaleControls>
            <ScaleLabel>Scale:</ScaleLabel>
            <ToggleButton type="button" active={xLogScale} onClick={() => setXLogScale(!xLogScale)}>
              X Log
            </ToggleButton>
            <ToggleButton type="button" active={yLogScale} onClick={() => setYLogScale(!yLogScale)}>
              Y Log
            </ToggleButton>
          </ScaleControls>

          <ZoomControls>
            <ZoomButton type="button" onClick={handleZoomOut} disabled={zoomLevel <= 1} title="축소">
              <ZoomOut size={14} />
            </ZoomButton>
            <ZoomInfo>{zoomLevel.toFixed(0)}x</ZoomInfo>
            <ZoomButton type="button" onClick={handleZoomIn} disabled={zoomLevel >= 32} title="확대">
              <ZoomIn size={14} />
            </ZoomButton>
            <ZoomButton type="button" onClick={resetZoom} disabled={zoomLevel === 1} title="원래대로">
              <RotateCcw size={14} />
            </ZoomButton>
          </ZoomControls>
        </ControlsRow>
      </Header>

      <ChartWrapper ref={containerRef} style={{ position: 'relative' }}>
        {data.length === 0 ? (
          <EmptyState>
            측정 데이터가 없습니다.
          </EmptyState>
        ) : (
          <>
            <SVGContainer ref={svgRef} />
            {pointTooltip.visible && (
              <PointTooltip style={{ left: pointTooltip.x, top: pointTooltip.y, transform: 'translateX(-50%)' }}>
                X: {formatValue(pointTooltip.xValue)} | Y: {formatValue(pointTooltip.yValue)}
              </PointTooltip>
            )}
          </>
        )}
      </ChartWrapper>
      <HelpText>드래그: 영역 확대 | Ctrl+클릭: 확대 | Shift+클릭: 축소 | 클릭: 원래대로</HelpText>
    </Container>
  );
};

export default StrainSweepChart;
