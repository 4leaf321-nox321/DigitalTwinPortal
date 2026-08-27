// styled-components 를 대신하는 최소 구현 — **모양은 안 본다.** 이 시험이 보는 것은
// 「눌렀을 때 무엇이 서버로 가고 화면이 무엇을 그리나」다. 스타일 계산은 빼서 빠르게.
import React from 'react';

const make = (tag) => {
  const C = React.forwardRef((props, ref) => {
    const clean = {};
    for (const k of Object.keys(props)) {
      if (k === 'children' || k.startsWith('$')) continue;          // transient prop
      if (typeof props[k] === 'function' && !k.startsWith('on')) continue;
      clean[k] = props[k];
    }
    return React.createElement(tag, { ...clean, ref }, props.children);
  });
  C.displayName = typeof tag === 'string' ? tag : 'Styled';
  return C;
};

const styled = new Proxy(function (comp) { return () => make(comp); }, {
  get: (_t, tag) => (typeof tag === 'string' ? () => make(tag) : undefined),
  apply: (_t, _this, [comp]) => () => make(comp),
});
export default styled;
export const css = () => '';
export const keyframes = () => '';
export const createGlobalStyle = () => () => null;
export const ThemeProvider = ({ children }) => children;
