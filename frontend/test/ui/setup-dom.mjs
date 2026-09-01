// jsdom 을 **React 보다 먼저** 세운다.
//
// ⚠️ import 는 끌어올려지므로 시험 파일에서 이 파일을 **첫 import** 로 둬야 한다. 안 그러면
//    React DOM 이 DOM 없는 채로 초기화되어 input 이벤트 지원 감지가 꺼지고, 글자를 쳐도
//    onChange 가 안 온다 — 2026-08-28 에 이것 때문에 「저장이 안 된다」는 가짜 결함을 봤다.
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.MouseEvent = dom.window.MouseEvent;
// ESC 로 빠져나오는 자리(전체 화면 등)를 시험하려면 이것도 있어야 한다
globalThis.KeyboardEvent = dom.window.KeyboardEvent;
globalThis.Event = dom.window.Event;
// framer-motion(대시보드의 과제 보고 창)이 찾는 것들 — 없으면 mount 에서 터진다
globalThis.SVGElement = dom.window.SVGElement;
globalThis.Element = dom.window.Element;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame?.bind(dom.window) || (cb => setTimeout(cb, 0));
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame?.bind(dom.window) || clearTimeout;
window.localStorage.setItem('accessToken', 'test-token');
globalThis.localStorage = window.localStorage;
window.confirm = () => true;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// reactflow(계획 화면의 순서도)가 찾는 것 — jsdom 에는 없다. 크기를 재는 물건이라
// 시험에서는 「아무 일도 안 하는」 것으로 충분하다(레이아웃은 어차피 계산되지 않는다).
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = NoopResizeObserver;
window.ResizeObserver = NoopResizeObserver;
// DOMMatrixReadOnly — reactflow 가 transform 을 읽을 때 쓴다
if (!globalThis.DOMMatrixReadOnly) {
  globalThis.DOMMatrixReadOnly = class { constructor() { this.m22 = 1; } };
}
