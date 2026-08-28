// 눌러 보는 시험의 손발 — render · click · type · select · byText.
//
// type 은 **prototype 의 value setter** 로 값을 넣고 input 이벤트를 쏜다. 요소의 value 에
// 그냥 대입하면 React 의 값 추적기가 「안 바뀜」으로 보고 onChange 를 안 부른다.
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let root = null;
export const render = async (el) => {
  if (!root) root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(el); });
  await act(async () => { await sleep(20); });
};
export const unmount = async () => { if (root) { await act(async () => { root.unmount(); }); root = null; } };

export const click = async (el) => {
  if (!el) throw new Error('누를 요소가 없습니다');
  await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); await sleep(5); });
};
export const type = async (input, value) => {
  if (!input) throw new Error('칠 칸이 없습니다');
  // textarea 도 친다 — 제 원형의 value setter 를 써야 React 가 바뀜을 본다
  const proto = input instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(5);
  });
};
export const keydown = async (el, key) => {
  await act(async () => {
    el.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    await sleep(5);
  });
};
export const select = async (sel, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  await act(async () => { setter.call(sel, value); sel.dispatchEvent(new Event('change', { bubbles: true })); await sleep(5); });
};
export const settle = async (ms = 30) => { await act(async () => { await sleep(ms); }); };

export const byText = (tag, text) =>
  [...document.querySelectorAll(tag)].find(e => e.textContent.trim() === text)
  || [...document.querySelectorAll(tag)].find(e => e.textContent.includes(text));
export const html = () => document.body.innerHTML.replace(/<!-- -->/g, '');

/** 가짜 fetch — 무엇이 어떤 몸으로 갔는지 적고, 답은 handler 가 만든다. */
export const fakeFetch = (handler) => {
  const calls = [];
  const f = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ url, method, body });
    const data = handler({ url, method, body });
    return { ok: true, status: 200, json: async () => ({ success: true, data }) };
  };
  window.fetch = f; globalThis.fetch = f;
  return calls;
};

/** 한 파일의 검사 모음 — 틀린 것을 세고 마지막에 요약한다. */
export const suite = () => {
  let bad = 0;
  const say = (ok, m) => { if (!ok) bad += 1; console.log(`  ${ok ? '맞음' : '틀림'} ${m}`); };
  const done = () => { console.log(bad ? `\n틀림 ${bad}건` : '\n전부 맞음'); return bad; };
  return { say, done };
};
