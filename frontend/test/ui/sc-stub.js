// styled-components 를 대신하는 최소 구현 — **모양은 안 본다.** 이 시험이 보는 것은
// 「눌렀을 때 무엇이 서버로 가고 화면이 무엇을 그리나」다. 스타일 계산은 빼서 빠르게.
import React from 'react';

const make = (tag, attrs) => {
  const C = React.forwardRef((rawProps, ref) => {
    const extra = typeof attrs === 'function' ? attrs(rawProps) : (attrs || {});
    const props = { ...extra, ...rawProps };
    if (extra.className && rawProps.className) props.className = `${extra.className} ${rawProps.className}`;
    else if (extra.className) props.className = extra.className;
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

const tagFn = (tag) => {
  const f = () => make(tag);
  f.attrs = (a) => () => make(tag, a);           // styled.div.attrs({ className: ... })`...`
  return f;
};
const styled = new Proxy(function (comp) { return tagFn(comp); }, {
  get: (_t, tag) => (typeof tag === 'string' ? tagFn(tag) : undefined),
  apply: (_t, _this, [comp]) => tagFn(comp),
});
export default styled;
export const css = () => '';
export const keyframes = () => '';
export const createGlobalStyle = () => () => null;
export const ThemeProvider = ({ children }) => children;
