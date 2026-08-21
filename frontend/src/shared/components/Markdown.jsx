/**
 * 마크다운 렌더러 — **화면 어디서나 쓰는 하나.**
 *
 * LLM 이 쓴 글은 마크다운 표기를 섞어 낸다(`**굵게**` 가 대표적이다). 그걸 글자
 * 그대로 보여 주면 별표가 그대로 뜨고, 지워 버리면 원문이 훼손된다.
 * 여기서 한 번만 제대로 그리고, 쓰는 쪽은 `<Markdown text={...} />` 만 부른다.
 *
 * ⚠️ **날 HTML 을 그리지 않는다.** `rehype-raw` 를 달지 않았으므로 글 안의 `<script>`
 *    같은 것은 **글자로** 나온다. 글의 출처가 LLM 이라 이 방어를 빼면 안 된다 —
 *    나중에 표를 넣겠다고 `rehype-raw` 를 다는 변경을 하지 말 것.
 *
 * ⚠️ **한 문단짜리 글에도 쓴다.** 그래서 문단 여백을 0 으로 두고, 여백은 쓰는 쪽이
 *    정한다 — 안 그러면 좁은 패널에서 위아래가 벌어져 자리를 먹는다.
 *
 * 표·목록도 그린다(`remark-gfm`). 다만 **관계도 서술은 지금 한 문단으로 못 박혀
 * 있다**(`graph_narrate.py` 7번 규칙) — 서버가 계산한 숫자를 LLM 이 표로 다시
 * 옮겨 적으면 한 화면에 서로 다른 숫자 두 벌이 같은 무게로 놓이기 때문이다.
 * 그 제한은 프롬프트가 하는 일이고, 이 파일은 오는 대로 그린다.
 */
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styled from 'styled-components';

const Markdown = ({ text, className }) => {
  if (!text) return null;
  return (
    <Wrap className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{String(text)}</ReactMarkdown>
    </Wrap>
  );
};

/*
  좁은 패널에 들어가는 일이 많아 기본 여백을 걷어낸다.
  글자 크기·색은 **물려받는다** — 쓰는 쪽의 글과 같아 보여야 한다.
*/
const Wrap = styled.div`
  font-size: inherit;
  color: inherit;
  line-height: inherit;
  word-break: break-word;

  > *:first-child { margin-top: 0; }
  > *:last-child { margin-bottom: 0; }

  p { margin: 0 0 0.5em; }
  strong { font-weight: 700; }
  em { font-style: italic; }

  ul, ol { margin: 0 0 0.5em; padding-left: 1.15em; }
  li { margin: 0.1em 0; }
  li > p { margin: 0; }

  h1, h2, h3, h4, h5, h6 {
    margin: 0.6em 0 0.3em;
    font-size: 1.05em;
    font-weight: 700;
  }

  code {
    padding: 0 3px;
    border-radius: 3px;
    background: rgba(100, 116, 139, 0.12);
    font-size: 0.94em;
  }

  pre {
    margin: 0 0 0.5em;
    padding: 8px 10px;
    overflow-x: auto;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;

    code { padding: 0; background: none; }
  }

  blockquote {
    margin: 0 0 0.5em;
    padding-left: 0.7em;
    border-left: 3px solid #e2e8f0;
    color: #64748b;
  }

  /* 표는 좁은 자리에서 넘칠 수 있다 — 가로로 굴러가게 둔다 */
  table {
    display: block;
    max-width: 100%;
    overflow-x: auto;
    border-collapse: collapse;
    margin: 0 0 0.5em;
  }
  th, td {
    padding: 3px 7px;
    border: 1px solid #e2e8f0;
    text-align: left;
    white-space: nowrap;
  }
  th { background: #f8fafc; font-weight: 600; }

  a { color: #2563eb; text-decoration: underline; }
  hr { margin: 0.6em 0; border: none; border-top: 1px solid #e2e8f0; }
`;

export default Markdown;
