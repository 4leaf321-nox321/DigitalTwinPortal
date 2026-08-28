// react-force-graph-2d 를 대신하는 최소 구현 — **그림은 안 본다.** 캔버스는 jsdom 에서 못 그리고,
// 그렸다 한들 픽셀을 눌러 볼 수도 없다. 이 시험이 보는 것은 「무엇이 노드·간선으로 갔고,
// 간선을 누르면 무엇이 열리나」다. 그리는 규칙 자체는 utils/systemGraph 의 node 시험이 본다.
import React from 'react';

const ForceGraph2D = React.forwardRef(({ graphData, linkColor, linkWidth, linkCurvature, linkLineDash, onLinkClick, onNodeClick, nodeLabel }, ref) => {
  React.useImperativeHandle(ref, () => ({
    d3Force: () => ({ strength: () => ({ distanceMax: () => {} }), distance: () => ({ strength: () => {} }) }),
    d3ReheatSimulation: () => {},
    zoomToFit: () => {},
  }), []);
  const val = (fn, l) => (typeof fn === 'function' ? fn(l) : fn);
  return React.createElement('div', { 'data-fg': String((graphData?.nodes || []).length) },
    (graphData?.nodes || []).map(n => React.createElement('span', {
      key: n.id, 'data-fg-node': String(n.id), 'data-kind': n.kind, title: val(nodeLabel, n),
      onClick: () => onNodeClick && onNodeClick(n),
    }, n.label)),
    (graphData?.links || []).map((l, i) => React.createElement('button', {
      key: i, type: 'button', 'data-fg-link': String(i),
      'data-color': val(linkColor, l), 'data-width': String(val(linkWidth, l)),
      'data-curve': String(val(linkCurvature, l)), 'data-dash': val(linkLineDash, l) ? '1' : '',
      onClick: () => onLinkClick && onLinkClick(l),
    }, l.name)));
});
ForceGraph2D.displayName = 'ForceGraph2D';
export default ForceGraph2D;
