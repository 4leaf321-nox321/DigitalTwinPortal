import React, { memo } from 'react';
import { Handle, Position, NodeResizer } from 'reactflow';
import styled from 'styled-components';

// ========== 공통 노드 스타일 ==========
const NodeWrapper = styled.div`
  width: 100%;
  height: 100%;
  min-width: ${props => props.headerOnly ? '120px' : '160px'};
  min-height: ${props => props.headerOnly ? 'auto' : '80px'};
  background: ${props => props.headerOnly ? 'transparent' : 'white'};
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 2px solid ${props => props.selected ? '#fbbf24' : props.borderColor || '#e2e8f0'};
  overflow: hidden;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
  display: flex;
  flex-direction: column;

  &:hover {
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  }

  /* 핸들 가시성 - 선택/호버 시에만 표시 */
  .react-flow__handle {
    opacity: ${props => props.selected ? 1 : 0};
    transition: opacity 0.2s ease;
  }

  &:hover .react-flow__handle {
    opacity: 1;
  }
`;

const NodeHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: ${props => props.bgColor || '#3b82f6'};
  color: white;
  flex-shrink: 0;
  ${props => props.headerOnly && `
    flex: 1;
    border-radius: 6px;
  `}
`;

const NodeTitle = styled.div`
  font-weight: 600;
  font-size: ${props => props.fontSize || '0.8rem'};
  line-height: 1.2;
  flex: 1;
  overflow: hidden;
  white-space: pre-line;
  text-align: ${props => props.textAlign || 'left'};
  color: ${props => props.textColor === 'black' ? '#000000' : '#ffffff'};
`;

const NodeContent = styled.div`
  flex: 1;
  padding: 10px 12px;
  background: white;
  color: #374151;
  font-size: 0.75rem;
  line-height: 1.4;
  overflow: auto;
  display: flex;
  flex-direction: column;
`;

const NodeDescription = styled.div`
  flex: 1;
  overflow: auto;
  white-space: pre-line;
`;

const NodeMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
  flex-shrink: 0;
`;

const MetaTag = styled.span`
  font-size: 0.65rem;
  background: ${props => props.bgColor || '#f1f5f9'};
  color: ${props => props.textColor || '#64748b'};
  padding: 2px 6px;
  border-radius: 4px;
`;

const AttributeBadge = styled.span`
  font-size: 0.6rem;
  background: #e0e7ff;
  color: #4338ca;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  .attr-name {
    font-weight: 600;
  }

  .attr-value {
    font-weight: 400;
  }
`;

const AttributesContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
`;

// ========== 기본 색상 ==========
const DEFAULT_COLOR = '#64748b';

// ========== 공통 리사이저 스타일 ==========
const resizerStyles = {
  lineStyle: {
    borderColor: '#3b82f6',
    borderWidth: 1,
  },
  handleStyle: {
    width: 8,
    height: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  }
};

// ========== 프로세스 노드 ==========
export const ProcessNode = memo(({ data, selected }) => {
  const headerColor = data.color || DEFAULT_COLOR;

  return (
    <NodeWrapper selected={selected} borderColor={headerColor} headerOnly={data.headerOnly}>
      <NodeResizer
        minWidth={data.headerOnly ? 120 : 160}
        minHeight={data.headerOnly ? 40 : 80}
        isVisible={selected}
        lineStyle={{ ...resizerStyles.lineStyle, borderColor: headerColor }}
        handleStyle={{ ...resizerStyles.handleStyle, backgroundColor: headerColor }}
      />
      {/* 각 위치에 source와 target 핸들 모두 배치 */}
      <Handle type="target" position={Position.Top} id="top-target" />
      <Handle type="source" position={Position.Top} id="top-source" />
      <Handle type="target" position={Position.Left} id="left-target" />
      <Handle type="source" position={Position.Left} id="left-source" />
      <NodeHeader bgColor={headerColor} headerOnly={data.headerOnly}>
        <NodeTitle textAlign={data.textAlign} textColor={data.headerTextColor} fontSize={data.fontSize}>{data.label}</NodeTitle>
      </NodeHeader>
      {!data.headerOnly && (
        <NodeContent>
          <NodeDescription>
            {data.description}
          </NodeDescription>
          <NodeMeta>
            {data.담당부서 && <MetaTag>{data.담당부서}</MetaTag>}
          </NodeMeta>
          {data.attributes && data.attributes.length > 0 && (
            <AttributesContainer>
              {data.attributes.map((attr, index) => (
                <AttributeBadge key={index}>
                  <span className="attr-name">{attr.name}:</span>
                  <span className="attr-value">{attr.value}</span>
                </AttributeBadge>
              ))}
            </AttributesContainer>
          )}
        </NodeContent>
      )}
      <Handle type="target" position={Position.Bottom} id="bottom-target" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" />
      <Handle type="target" position={Position.Right} id="right-target" />
      <Handle type="source" position={Position.Right} id="right-source" />
    </NodeWrapper>
  );
});

// ========== 시스템 노드 ==========
export const SystemNode = memo(({ data, selected }) => {
  const headerColor = '#8b5cf6';

  return (
    <NodeWrapper selected={selected} borderColor={headerColor}>
      <NodeResizer
        minWidth={140}
        minHeight={70}
        isVisible={selected}
        lineStyle={{ ...resizerStyles.lineStyle, borderColor: headerColor }}
        handleStyle={{ ...resizerStyles.handleStyle, backgroundColor: headerColor }}
      />
      <Handle type="target" position={Position.Top} id="top-target" />
      <Handle type="source" position={Position.Top} id="top-source" />
      <Handle type="target" position={Position.Left} id="left-target" />
      <Handle type="source" position={Position.Left} id="left-source" />
      <NodeHeader bgColor={headerColor}>
        <NodeTitle>{data.label}</NodeTitle>
      </NodeHeader>
      <NodeContent>
        <NodeDescription>
          {data.description}
        </NodeDescription>
        {data.type && (
          <NodeMeta>
            <MetaTag bgColor="#8b5cf620" textColor="#8b5cf6">{data.type}</MetaTag>
          </NodeMeta>
        )}
        {data.attributes && data.attributes.length > 0 && (
          <AttributesContainer>
            {data.attributes.map((attr, index) => (
              <AttributeBadge key={index}>
                <span className="attr-name">{attr.name}:</span>
                <span className="attr-value">{attr.value}</span>
              </AttributeBadge>
            ))}
          </AttributesContainer>
        )}
      </NodeContent>
      <Handle type="target" position={Position.Bottom} id="bottom-target" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" />
      <Handle type="target" position={Position.Right} id="right-target" />
      <Handle type="source" position={Position.Right} id="right-source" />
    </NodeWrapper>
  );
});

// ========== 데이터 노드 ==========
export const DataNode = memo(({ data, selected }) => {
  const headerColor = '#10b981';

  return (
    <NodeWrapper selected={selected} borderColor={headerColor}>
      <NodeResizer
        minWidth={140}
        minHeight={70}
        isVisible={selected}
        lineStyle={{ ...resizerStyles.lineStyle, borderColor: headerColor }}
        handleStyle={{ ...resizerStyles.handleStyle, backgroundColor: headerColor }}
      />
      <Handle type="target" position={Position.Top} id="top-target" />
      <Handle type="source" position={Position.Top} id="top-source" />
      <Handle type="target" position={Position.Left} id="left-target" />
      <Handle type="source" position={Position.Left} id="left-source" />
      <NodeHeader bgColor={headerColor}>
        <NodeTitle>{data.label}</NodeTitle>
      </NodeHeader>
      <NodeContent>
        <NodeDescription>
          {data.description}
        </NodeDescription>
        {data.format && (
          <NodeMeta>
            <MetaTag bgColor="#10b98120" textColor="#10b981">{data.format}</MetaTag>
          </NodeMeta>
        )}
        {data.attributes && data.attributes.length > 0 && (
          <AttributesContainer>
            {data.attributes.map((attr, index) => (
              <AttributeBadge key={index}>
                <span className="attr-name">{attr.name}:</span>
                <span className="attr-value">{attr.value}</span>
              </AttributeBadge>
            ))}
          </AttributesContainer>
        )}
      </NodeContent>
      <Handle type="target" position={Position.Bottom} id="bottom-target" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" />
      <Handle type="target" position={Position.Right} id="right-target" />
      <Handle type="source" position={Position.Right} id="right-source" />
    </NodeWrapper>
  );
});

// ========== 시작 노드 ==========
export const StartNode = memo(({ data, selected }) => {
  const headerColor = '#22c55e';

  return (
    <NodeWrapper selected={selected} borderColor={headerColor}>
      <NodeResizer
        minWidth={140}
        minHeight={60}
        isVisible={selected}
        lineStyle={{ ...resizerStyles.lineStyle, borderColor: headerColor }}
        handleStyle={{ ...resizerStyles.handleStyle, backgroundColor: headerColor }}
      />
      <Handle type="target" position={Position.Top} id="top-target" />
      <Handle type="source" position={Position.Top} id="top-source" />
      <Handle type="target" position={Position.Left} id="left-target" />
      <Handle type="source" position={Position.Left} id="left-source" />
      <NodeHeader bgColor={headerColor}>
        <NodeTitle>{data.label || '시작'}</NodeTitle>
      </NodeHeader>
      <NodeContent>
        <NodeDescription>
          {data.description}
        </NodeDescription>
        {data.attributes && data.attributes.length > 0 && (
          <AttributesContainer>
            {data.attributes.map((attr, index) => (
              <AttributeBadge key={index}>
                <span className="attr-name">{attr.name}:</span>
                <span className="attr-value">{attr.value}</span>
              </AttributeBadge>
            ))}
          </AttributesContainer>
        )}
      </NodeContent>
      <Handle type="target" position={Position.Bottom} id="bottom-target" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" />
      <Handle type="target" position={Position.Right} id="right-target" />
      <Handle type="source" position={Position.Right} id="right-source" />
    </NodeWrapper>
  );
});

// ========== 종료 노드 ==========
export const EndNode = memo(({ data, selected }) => {
  const headerColor = '#ef4444';

  return (
    <NodeWrapper selected={selected} borderColor={headerColor}>
      <NodeResizer
        minWidth={140}
        minHeight={60}
        isVisible={selected}
        lineStyle={{ ...resizerStyles.lineStyle, borderColor: headerColor }}
        handleStyle={{ ...resizerStyles.handleStyle, backgroundColor: headerColor }}
      />
      <Handle type="target" position={Position.Top} id="top-target" />
      <Handle type="source" position={Position.Top} id="top-source" />
      <Handle type="target" position={Position.Left} id="left-target" />
      <Handle type="source" position={Position.Left} id="left-source" />
      <NodeHeader bgColor={headerColor}>
        <NodeTitle>{data.label || '종료'}</NodeTitle>
      </NodeHeader>
      <NodeContent>
        <NodeDescription>
          {data.description}
        </NodeDescription>
        {data.attributes && data.attributes.length > 0 && (
          <AttributesContainer>
            {data.attributes.map((attr, index) => (
              <AttributeBadge key={index}>
                <span className="attr-name">{attr.name}:</span>
                <span className="attr-value">{attr.value}</span>
              </AttributeBadge>
            ))}
          </AttributesContainer>
        )}
      </NodeContent>
      <Handle type="target" position={Position.Bottom} id="bottom-target" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" />
      <Handle type="target" position={Position.Right} id="right-target" />
      <Handle type="source" position={Position.Right} id="right-source" />
    </NodeWrapper>
  );
});

// ========== 의사결정 노드 ==========
export const DecisionNode = memo(({ data, selected }) => {
  const headerColor = '#f59e0b';

  return (
    <NodeWrapper selected={selected} borderColor={headerColor}>
      <NodeResizer
        minWidth={140}
        minHeight={80}
        isVisible={selected}
        lineStyle={{ ...resizerStyles.lineStyle, borderColor: headerColor }}
        handleStyle={{ ...resizerStyles.handleStyle, backgroundColor: headerColor }}
      />
      <Handle type="target" position={Position.Top} id="top-target" />
      <Handle type="source" position={Position.Top} id="top-source" />
      <Handle type="target" position={Position.Left} id="left-target" />
      <Handle type="source" position={Position.Left} id="left-source" />
      <NodeHeader bgColor={headerColor}>
        <NodeTitle>{data.label || '조건'}</NodeTitle>
      </NodeHeader>
      <NodeContent>
        <NodeDescription>
          {data.description}
        </NodeDescription>
        <NodeMeta>
          <MetaTag bgColor="#22c55e20" textColor="#22c55e">Yes</MetaTag>
          <MetaTag bgColor="#ef444420" textColor="#ef4444">No</MetaTag>
        </NodeMeta>
        {data.attributes && data.attributes.length > 0 && (
          <AttributesContainer>
            {data.attributes.map((attr, index) => (
              <AttributeBadge key={index}>
                <span className="attr-name">{attr.name}:</span>
                <span className="attr-value">{attr.value}</span>
              </AttributeBadge>
            ))}
          </AttributesContainer>
        )}
      </NodeContent>
      <Handle type="target" position={Position.Bottom} id="bottom-target" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" />
      <Handle type="target" position={Position.Right} id="right-target" />
      <Handle type="source" position={Position.Right} id="right-source" />
    </NodeWrapper>
  );
});

// ========== 그룹 노드 ==========
const GroupNodeWrapper = styled.div`
  width: 100%;
  height: 100%;
  min-width: 250px;
  min-height: 180px;
  background: ${props => props.bgColor || 'rgba(59, 130, 246, 0.05)'};
  border: 2px dashed ${props => props.borderColor || '#3b82f6'};
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  /* 핸들 가시성 - 선택/호버 시에만 표시 */
  .react-flow__handle {
    opacity: ${props => props.selected ? 1 : 0};
    transition: opacity 0.2s ease;
  }

  &:hover .react-flow__handle {
    opacity: 1;
  }
`;

const GroupHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: transparent;
  color: ${props => props.textColor || '#3b82f6'};
  flex-shrink: 0;
  border-bottom: 1px solid ${props => props.borderColor || 'rgba(59, 130, 246, 0.3)'};
`;

const GroupContent = styled.div`
  flex: 1;
  padding: 8px;
  position: relative;
`;

const GroupDescription = styled.div`
  position: absolute;
  bottom: 8px;
  left: 8px;
  font-size: 0.7rem;
  color: #64748b;
  background: rgba(255, 255, 255, 0.9);
  padding: 4px 8px;
  border-radius: 4px;
`;

// 색상값으로부터 그룹 스타일 생성 헬퍼
const getGroupColors = (color) => {
  const c = color || DEFAULT_COLOR;
  return {
    bg: `${c}0d`,  // 5% opacity
    border: c,
    text: c,
    headerBorder: `${c}4d`  // 30% opacity
  };
};

export const GroupNode = memo(({ data, selected }) => {
  const colors = getGroupColors(data.color);

  return (
    <GroupNodeWrapper bgColor={colors.bg} borderColor={colors.border} selected={selected}>
      <NodeResizer
        minWidth={250}
        minHeight={180}
        isVisible={selected}
        lineStyle={{ ...resizerStyles.lineStyle, borderColor: colors.border }}
        handleStyle={{ ...resizerStyles.handleStyle, backgroundColor: colors.border }}
      />
      <Handle type="target" position={Position.Top} id="top-target" />
      <Handle type="source" position={Position.Top} id="top-source" />
      <Handle type="target" position={Position.Left} id="left-target" />
      <Handle type="source" position={Position.Left} id="left-source" />
      <GroupHeader textColor={colors.text} borderColor={colors.headerBorder}>
        <NodeTitle style={{ fontWeight: 700, fontSize: '0.9rem', color: colors.text }}>{data.label}</NodeTitle>
      </GroupHeader>
      <GroupContent>
        {data.description && (
          <GroupDescription>{data.description}</GroupDescription>
        )}
      </GroupContent>
      <Handle type="target" position={Position.Bottom} id="bottom-target" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" />
      <Handle type="target" position={Position.Right} id="right-target" />
      <Handle type="source" position={Position.Right} id="right-source" />
    </GroupNodeWrapper>
  );
});

// ========== 구분선 노드 ==========
const DividerWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
`;

const getLineBackground = (color, lineStyle, direction) => {
  const c = color || '#94a3b8';
  if (lineStyle === 'dashed') {
    return direction === 'vertical'
      ? `repeating-linear-gradient(to bottom, ${c} 0px, ${c} 8px, transparent 8px, transparent 12px)`
      : `repeating-linear-gradient(to right, ${c} 0px, ${c} 8px, transparent 8px, transparent 12px)`;
  }
  if (lineStyle === 'dotted') {
    return direction === 'vertical'
      ? `repeating-linear-gradient(to bottom, ${c} 0px, ${c} 4px, transparent 4px, transparent 8px)`
      : `repeating-linear-gradient(to right, ${c} 0px, ${c} 4px, transparent 4px, transparent 8px)`;
  }
  return c;
};

const HorizontalLine = styled.div`
  width: 100%;
  height: ${props => props.lineWidth || 3}px;
  background: ${props => getLineBackground(props.color, props.lineStyle, 'horizontal')};
  border-radius: 2px;
`;

const VerticalLine = styled.div`
  width: ${props => props.lineWidth || 3}px;
  height: 100%;
  background: ${props => getLineBackground(props.color, props.lineStyle, 'vertical')};
  border-radius: 2px;
`;

const DividerLabel = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  padding: 4px 12px;
  font-size: 0.75rem;
  font-weight: 600;
  color: ${props => props.color || '#64748b'};
  white-space: nowrap;
  border-radius: 4px;
`;

export const DividerNode = memo(({ data, selected }) => {
  const isVertical = data.direction === 'vertical';
  const color = data.color || '#94a3b8';
  const lineStyle = data.lineStyle || 'solid';
  const lineWidth = data.lineWidth || 3;

  return (
    <DividerWrapper style={{
      width: isVertical ? '20px' : '100%',
      height: isVertical ? '100%' : '20px',
      minWidth: isVertical ? '20px' : '200px',
      minHeight: isVertical ? '200px' : '20px'
    }}>
      <NodeResizer
        minWidth={isVertical ? 20 : 200}
        minHeight={isVertical ? 200 : 20}
        isVisible={selected}
        lineStyle={{ borderColor: color, borderWidth: 1 }}
        handleStyle={{ width: 8, height: 8, backgroundColor: color, borderRadius: 2 }}
      />
      {isVertical ? (
        <VerticalLine color={color} lineStyle={lineStyle} lineWidth={lineWidth} />
      ) : (
        <HorizontalLine color={color} lineStyle={lineStyle} lineWidth={lineWidth} />
      )}
      {data.label && (
        <DividerLabel color={color}>{data.label}</DividerLabel>
      )}
    </DividerWrapper>
  );
});

// ========== 화살표(쉐브론) 노드 ==========
const ArrowNodeWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  min-width: 140px;
  height: 50px;

  /* 핸들 가시성 - 선택/호버 시에만 표시 */
  .react-flow__handle {
    opacity: ${props => props.selected ? 1 : 0};
    transition: opacity 0.2s ease;
  }

  &:hover .react-flow__handle {
    opacity: 1;
  }
`;

const ArrowShape = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 100%;
  padding: 0 20px 0 16px;
  background: ${props => props.bgColor || '#3b82f6'};
  color: white;
  font-weight: 600;
  font-size: ${props => props.fontSize || '0.85rem'};
  white-space: pre-line;
  text-align: center;
  clip-path: polygon(0% 0%, calc(100% - 20px) 0%, 100% 50%, calc(100% - 20px) 100%, 0% 100%, 20px 50%);

  /* 첫 번째 화살표인 경우 왼쪽을 직선으로 */
  ${props => props.isFirst && `
    clip-path: polygon(0% 0%, calc(100% - 20px) 0%, 100% 50%, calc(100% - 20px) 100%, 0% 100%);
    padding-left: 12px;
  `}
`;

export const ArrowNode = memo(({ data, selected }) => {
  const bgColor = data.color || DEFAULT_COLOR;

  return (
    <ArrowNodeWrapper selected={selected}>
      <NodeResizer
        minWidth={120}
        minHeight={40}
        isVisible={selected}
        lineStyle={{ borderColor: bgColor, borderWidth: 1 }}
        handleStyle={{ width: 8, height: 8, backgroundColor: bgColor, borderRadius: 2 }}
      />
      <Handle type="target" position={Position.Top} id="top-target" />
      <Handle type="source" position={Position.Top} id="top-source" />
      <Handle type="target" position={Position.Left} id="left-target" style={{ left: 0 }} />
      <Handle type="source" position={Position.Left} id="left-source" style={{ left: 0 }} />
      <ArrowShape bgColor={bgColor} isFirst={data.isFirst} fontSize={data.fontSize}>
        <span>{data.label}</span>
      </ArrowShape>
      <Handle type="target" position={Position.Bottom} id="bottom-target" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" />
      <Handle type="target" position={Position.Right} id="right-target" style={{ right: 0 }} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ right: 0 }} />
    </ArrowNodeWrapper>
  );
});

// ========== 노드 타입 매핑 ==========
export const nodeTypes = {
  process: ProcessNode,
  system: SystemNode,
  data: DataNode,
  start: StartNode,
  end: EndNode,
  decision: DecisionNode,
  group: GroupNode,
  divider: DividerNode,
  arrow: ArrowNode,
};
