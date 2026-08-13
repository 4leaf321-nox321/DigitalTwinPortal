/**
 * AI 에이전트 패널 — 사내 LLM 이 MCP 도구로 과제를 조회·수정한다.
 *
 * 🚦 전체 지도: 루트 `디지털트윈_AI기능_지도.md` (이름이 비슷한 AI 갈래가 여섯이다)
 *
 * ⚠️ **누구나 보이되, 고치는 것은 관리자만이다** (2026-08-08 개방).
 *    쓰기를 좁혀 둔 이유는 기능이 아니라 **관찰**이다 — LLM 이 확인 절차를 지키는지,
 *    엉뚱한 과제를 집지 않는지는 실제로 돌려봐야 안다. 읽기는 그 걱정이 없어 먼저 열었다.
 *
 *    **서버가 강제한다** — 비관리자가 `readonly: false` 를 보내도 서버가 읽기로 되돌리고
 *    `readonlyForced` 로 알려준다(`routes_v2.ai_agent`). 화면의 스위치는 안내일 뿐이다.
 *    그래서 여기서는 **기능을 숨기지 않는다.** 숨기면 "있는 줄도 모르는" 상태가 되는데,
 *    조회는 애초에 누구나 해도 되는 일이다.
 *
 * 기존 `components/AiChatSidebar.jsx` 와 **다른 물건이었다.** 그쪽은 브라우저가
 * `/llm` 을 직접 부르는 일반 대화라 도구를 못 썼다(도구 실행은 브라우저에 둘 수 없다).
 * **2026-08-01 에 그쪽 진입점을 전부 내렸다** — 채팅창이 둘이면 사용자가 어디에
 * 물어야 하는지 알 수 없어서다. 컴포넌트와 백엔드는 남아 있어 되살릴 수 있다.
 *
 * 화면이 반드시 보여줘야 하는 것
 *   · **무슨 도구를 몇 번 썼는지**(trace). AI 가 무엇을 했는지 사람이 볼 수 없으면
 *     "고쳤습니다" 를 믿는 것 말고 할 수 있는 게 없다.
 *   · **읽기 전용 스위치.** 처음 켤 때는 쓰기를 닫고 관찰한다.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Bot, Send, X, Loader2, Wrench, ShieldAlert, Eye, PenLine, Lock } from 'lucide-react';

import Markdown from '../../../shared/components/Markdown';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// 서버로 되보낼 대화 기록. 길면 토큰만 먹고 답은 안 좋아진다(서버도 8턴으로 자른다).
const MAX_HISTORY = 8;

/* ── 창 크기·위치 ────────────────────────────────────────────────────────────
 *
 * **오른쪽·아래에서의 거리(right/bottom)로 잡는다.** left/top 으로 잡으면 크기를
 * 좌상단에서 늘릴 때 원점까지 같이 옮겨야 해서 계산이 두 배가 된다. 이 창은 원래
 * 우하단에 붙어 있으므로, 그 두 변을 고정해 두면 **끌기는 위치만, 크기 조절은 크기만**
 * 바꾸는 단순한 뺄셈이 된다.
 *
 * 손잡이를 **좌상단**에 두는 것도 같은 이유다 — 우하단 모서리는 화면 끝에 붙어 있어
 * 잡기 어렵고, 거기서 늘리면 창이 화면 밖으로 나간다.
 */
const BOX_KEY = 'dtAiPanelBox';
const DEFAULT_BOX = { width: 420, height: 620, right: 24, bottom: 24 };
const MIN_W = 340;
const MIN_H = 360;
const EDGE = 16;          // 화면 끝에 최소한 남길 여백

/** 화면 밖으로 나가거나 못 쓸 만큼 작아지지 않게 가둔다. 창 크기가 바뀔 때도 다시 태운다. */
const clampBox = (box) => {
  const vw = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
  const width = Math.max(MIN_W, Math.min(box.width, Math.max(MIN_W, vw - EDGE * 2)));
  const height = Math.max(MIN_H, Math.min(box.height, Math.max(MIN_H, vh - EDGE * 2)));
  return {
    width,
    height,
    right: Math.max(0, Math.min(box.right, Math.max(0, vw - width))),
    bottom: Math.max(0, Math.min(box.bottom, Math.max(0, vh - height))),
  };
};

const loadBox = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(BOX_KEY) || 'null');
    if (saved && typeof saved.width === 'number') return clampBox({ ...DEFAULT_BOX, ...saved });
  } catch (err) {
    // 값이 깨졌으면 기본값으로 — 창이 안 열리는 것보다 낫다
  }
  return clampBox(DEFAULT_BOX);
};

const AiAgentPanel = ({ isAdmin = false }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);   // {role, content, trace?, meta?}
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [readonly, setReadonly] = useState(true); // 처음엔 읽기 전용으로 시작한다
  const endRef = useRef(null);

  // 창 크기·위치. 다시 열어도 그대로 있어야 한다 — 매번 옮기게 하면 안 쓰게 된다.
  const [box, setBox] = useState(loadBox);
  const boxRef = useRef(box);
  boxRef.current = box;
  const dragRef = useRef(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // 브라우저 창이 작아지면 패널이 화면 밖으로 나갈 수 있다. 그때마다 다시 가둔다.
  useEffect(() => {
    if (!open) return undefined;
    const onResize = () => setBox((b) => clampBox(b));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  /**
   * 끌기 시작. `mode`: 'move'(헤더) | 'resize'(좌상단 손잡이)
   *
   * 포인터 캡처를 쓴다 — 빠르게 끌어 커서가 패널 밖으로 나가도 이벤트가 계속 온다.
   * 안 쓰면 창 밖에서 손을 뗐을 때 **끌기가 안 끝나고 붙어 다닌다.**
   */
  const startDrag = (mode) => (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    // 헤더의 닫기 버튼은 끌기가 아니다
    if (mode === 'move' && e.target.closest?.('button')) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { mode, x: e.clientX, y: e.clientY, box: boxRef.current };
  };

  const onDragMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    // right/bottom 기준이라 **오른쪽·아래로 끌면 값이 줄어든다.** 크기는 좌상단에서
    // 늘리므로 부호가 같다(왼쪽·위로 끌면 커진다).
    setBox(clampBox(d.mode === 'move'
      ? { ...d.box, right: d.box.right - dx, bottom: d.box.bottom - dy }
      : { ...d.box, width: d.box.width - dx, height: d.box.height - dy }));
  };

  const endDrag = (e) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    // 저장은 **손을 뗄 때 한 번**. 끄는 동안 저장하면 1초에 수십 번 쓴다.
    try {
      localStorage.setItem(BOX_KEY, JSON.stringify(boxRef.current));
    } catch (err) {
      // 저장 못 해도 이번 세션에서는 그대로 쓴다
    }
  };

  const resetBox = () => {
    const next = clampBox(DEFAULT_BOX);
    setBox(next);
    try {
      localStorage.setItem(BOX_KEY, JSON.stringify(next));
    } catch (err) { /* 위와 같다 */ }
  };

  const send = useCallback(async (e) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q || busy) return;

    // 보내기 **전에** 화면에 올린다. 응답이 느려도 무엇을 물었는지 보여야 한다.
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setInput('');
    setBusy(true);

    try {
      const res = await fetch(`${API_BASE_URL}/dt-v2/ai/agent`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: q, history, readonly }),
      });

      let data = null;
      try {
        data = await res.json();
      } catch (err) {
        data = null;
      }

      if (!res.ok || !data?.success) {
        // 401 은 flask-jwt-extended 의 {msg} 라 우리 {success,message} 모양이 아니다 —
        // 그대로 두면 "실패했습니다" 만 뜨고 **원인을 알 수가 없다**(MCP 토큰 화면과 같은 함정).
        const text = res.status === 401
          ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
          : (data?.message || `요청이 실패했습니다 (HTTP ${res.status}).`);
        setMessages((prev) => [...prev, { role: 'error', content: text }]);
        return;
      }

      const d = data.data || {};
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: d.answer || '',
        trace: d.trace || [],
        meta: {
          model: d.model,
          toolCalls: d.toolCalls,
          truncated: d.truncated,
          answerEmpty: d.answerEmpty,
          // 서버가 읽기로 되돌렸다. **조용히 넘기면** 사용자는 자기가 고쳐 달라고 한
          // 것이 왜 안 됐는지 알 수가 없다.
          readonlyForced: d.readonlyForced,
        },
      }]);
    } catch (err) {
      console.error('AI agent error:', err);
      setMessages((prev) => [...prev, {
        role: 'error',
        content: 'AI 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      }]);
    } finally {
      setBusy(false);
    }
  }, [input, busy, messages, readonly]);

  const onKeyDown = (e) => {
    // Enter=보내기 / Shift+Enter=줄바꿈. 긴 지시를 쓸 일이 있어 줄바꿈을 막지 않는다.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!open) {
    return (
      <Fab type="button" onClick={() => setOpen(true)}
           title={isAdmin ? 'AI 에이전트' : 'AI 에이전트 (조회 전용)'}>
        <Bot size={22} />
      </Fab>
    );
  }

  return (
    <Panel style={{ width: box.width, height: box.height,
                    right: box.right, bottom: box.bottom }}>
      {/* 크기 손잡이 — 좌상단. 헤더보다 위에 놓되 **헤더의 자식이 아니다**
          (자식이면 헤더의 끌기 핸들러가 같이 걸린다). */}
      <Grip
        onPointerDown={startDrag('resize')}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        title="끌어서 크기 조절"
      />
      <Header
        onPointerDown={startDrag('move')}
        onPointerMove={onDragMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={resetBox}
        title="끌어서 옮기기 · 두 번 누르면 기본 크기·자리로"
      >
        <HeaderTitle>
          <Bot size={18} />
          AI 에이전트
          {!isAdmin && <AdminTag>조회 전용</AdminTag>}
        </HeaderTitle>
        <IconBtn type="button" onClick={() => setOpen(false)} title="닫기">
          <X size={18} />
        </IconBtn>
      </Header>

      <ModeBar>
        <ModeBtn
          type="button"
          className={readonly ? 'active' : ''}
          onClick={() => setReadonly(true)}
          disabled={busy}
        >
          <Eye size={14} /> 읽기만
        </ModeBtn>
        {/*
          비관리자에게도 **버튼을 보여준다**(잠금 표시로). 아예 안 그리면 "이 기능은
          원래 조회만 되는 것" 으로 읽혀서, 관리자에게 요청할 생각조차 못 한다.
          서버가 어차피 읽기로 되돌리므로 화면이 숨길 이유가 없다.
        */}
        <ModeBtn
          type="button"
          className={!readonly ? 'active write' : ''}
          onClick={() => isAdmin && setReadonly(false)}
          disabled={busy || !isAdmin}
          title={isAdmin ? '핵심 항목은 확인을 먼저 받습니다'
                         : '수정은 관리자만 할 수 있습니다'}
        >
          {isAdmin ? <PenLine size={14} /> : <Lock size={14} />} 수정 허용
          {!isAdmin && <LockNote>관리자만</LockNote>}
        </ModeBtn>
        <ModeNote>
          {!isAdmin
            ? '조회만 할 수 있습니다. 과제 수정은 관리자에게 요청하세요.'
            : (readonly
                ? '조회만 합니다. 과제를 고치지 않습니다.'
                : '핵심 항목은 바로 반영되지 않고 확인을 먼저 받습니다.')}
        </ModeNote>
      </ModeBar>

      <Messages>
        {messages.length === 0 && (
          <Empty>
            <Bot size={28} />
            <p>{isAdmin ? '과제를 찾아 달라거나 고쳐 달라고 말해 보세요.'
                        : '과제를 찾아 달라고 말해 보세요.'}</p>
            <Examples>
              <li>“MX 사업부 지연 과제 알려줘”</li>
              <li>“ProjA 진행률 어떻게 변해 왔어?”</li>
              {/* 쓰기 예시는 관리자에게만 — 못 하는 일을 예시로 보여주면 해 보고 막힌다 */}
              {isAdmin && <li>“ProjA 진행률 60으로 올려줘”</li>}
            </Examples>
            <Caution>
              <ShieldAlert size={14} />
              {isAdmin
                ? <>AI 는 <strong>내 권한 그대로</strong> 동작합니다. 내가 못 고치는 과제는 AI 도 못 고칩니다.</>
                : <>AI 는 <strong>내가 볼 수 있는 과제만</strong> 읽습니다. 수정은 관리자만 할 수 있습니다.</>}
            </Caution>
          </Empty>
        )}

        {messages.map((m, i) => (
          <Row key={i} className={m.role}>
            <Bubble className={m.role}>
              {/*
                모델 답만 마크다운으로 그린다. 사람이 친 말은 **글자 그대로** 둔다 —
                자기가 친 것이 다르게 보이면 그게 더 이상하다.
              */}
              {m.role === 'assistant' && m.content
                ? <Answer text={m.content} />
                : (m.content || '(내용 없음)')}
              {m.meta?.answerEmpty && (
                <MetaWarn>모델이 답변 문장을 만들지 못했습니다. 아래 조사 내역을 보세요.</MetaWarn>
              )}
              {m.meta?.readonlyForced && (
                <MetaWarn>수정은 관리자만 할 수 있어 <strong>조회로만</strong> 처리했습니다.</MetaWarn>
              )}
              {/* 무슨 도구를 썼는지 — 이게 없으면 AI 가 한 일을 사람이 볼 수 없다 */}
              {m.trace?.length > 0 && (
                <Trace>
                  <TraceHead>
                    <Wrench size={12} />
                    조사 내역 {m.trace.length}건
                    {m.meta?.truncated && <TruncTag>일부 생략됨</TruncTag>}
                  </TraceHead>
                  {m.trace.map((t, j) => (
                    <TraceRow key={j}>
                      <code>{t.tool}</code>
                      <span>{t.summary}</span>
                    </TraceRow>
                  ))}
                </Trace>
              )}
            </Bubble>
          </Row>
        ))}

        {busy && (
          <Row className="assistant">
            <Bubble className="assistant">
              <Thinking><Loader2 size={14} /> 생각하는 중…</Thinking>
            </Bubble>
          </Row>
        )}
        <div ref={endRef} />
      </Messages>

      <InputForm onSubmit={send}>
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={readonly ? '무엇을 찾아드릴까요?' : '무엇을 하시겠어요?'}
          rows={2}
          disabled={busy}
        />
        <SendBtn type="submit" disabled={busy || !input.trim()} title="보내기 (Enter)">
          <Send size={16} />
        </SendBtn>
      </InputForm>
    </Panel>
  );
};

/* ── 스타일 ── */

const Fab = styled.button`
  position: fixed;
  right: 1.5rem;
  bottom: 1.5rem;          /* 2026-08-01 AiChatSidebar 를 내려서 이 자리가 비었다 */
  z-index: 1400;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(8, 145, 178, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover { transform: translateY(-2px); }
  transition: transform 0.15s;
`;

/* 크기·자리는 **인라인 스타일**로 들어온다(`box`). 여기 값을 다시 쓰면 둘이 싸운다. */
const Panel = styled.div`
  position: fixed;
  z-index: 1400;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

/* 좌상단 크기 손잡이. `touch-action: none` 이 없으면 터치에서 브라우저가 스크롤로 채간다. */
const Grip = styled.div`
  position: absolute;
  left: 0;
  top: 0;
  width: 18px;
  height: 18px;
  z-index: 2;
  cursor: nwse-resize;
  touch-action: none;
  /* 흰 빗금 두 줄 — 헤더(청록) 위에 얹히므로 밝게 그린다 */
  background:
    linear-gradient(135deg, transparent 0 34%, rgba(255, 255, 255, 0.75) 34% 42%,
                    transparent 42% 58%, rgba(255, 255, 255, 0.75) 58% 66%, transparent 66%);
  border-top-left-radius: 12px;

  &:hover { background-color: rgba(255, 255, 255, 0.18); }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
  color: #fff;
  cursor: move;
  touch-action: none;
  user-select: none;
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9375rem;
  font-weight: 600;
`;

const AdminTag = styled.span`
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 0.0625rem 0.375rem;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.22);
`;

/* 잠긴 '수정 허용' 버튼 안의 작은 꼬리표 — 왜 못 누르는지 눌러보기 전에 알려준다 */
const LockNote = styled.span`
  margin-left: 0.25rem;
  font-size: 0.625rem;
  font-weight: 500;
  color: #94a3b8;
`;

const IconBtn = styled.button`
  background: none;
  border: none;
  color: #fff;
  cursor: pointer;
  display: flex;
  padding: 0.25rem;
  border-radius: 4px;
  &:hover { background: rgba(255, 255, 255, 0.18); }
`;

const ModeBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
`;

const ModeBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.625rem;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #fff;
  color: #64748b;
  font-size: 0.75rem;
  cursor: pointer;

  &.active { background: #0891b2; border-color: #0891b2; color: #fff; }
  &.active.write { background: #b45309; border-color: #b45309; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const ModeNote = styled.span`
  flex: 1 1 100%;
  font-size: 0.6875rem;
  color: #64748b;
`;

const Messages = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
`;

const Row = styled.div`
  display: flex;
  &.user { justify-content: flex-end; }
`;

const Bubble = styled.div`
  max-width: 88%;
  padding: 0.625rem 0.75rem;
  border-radius: 10px;
  font-size: 0.8125rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;

  &.user { background: #0891b2; color: #fff; }
  &.assistant { background: #f1f5f9; color: #1e293b; }
  &.error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
`;

/*
  모델 답 — 마크다운으로 그린다. 렌더러는 화면 공용(`shared/components/Markdown`)이라
  관계도 사이드바와 같은 규칙을 쓴다(날 HTML 은 안 그린다).

  🐞 예전에는 글자 그대로 뿌려서 `**굵게**` 의 별표와 표의 `|` 가 그대로 보였다.

  ⚠️ `white-space: pre-wrap` 을 **문단·목록에만** 남긴다. 대화창이라 모델이 넣은
     줄바꿈이 뜻을 갖는데(마크다운은 홑 줄바꿈을 공백으로 접는다), 표나 코드에까지
     걸면 원본 들여쓰기가 그대로 새어 나와 칸이 어긋난다.
*/
const Answer = styled(Markdown)`
  /* white-space 는 물려받는다 — 말풍선의 pre-wrap 이 표·코드까지 따라 들어온다.
     여기서 한 번 끊고, 필요한 곳에만 다시 준다. */
  white-space: normal;
  p, li { white-space: pre-wrap; }
`;

const MetaWarn = styled.div`
  margin-top: 0.5rem;
  font-size: 0.6875rem;
  color: #b45309;
`;

const Trace = styled.div`
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed #cbd5e1;
`;

const TraceHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #475569;
  margin-bottom: 0.25rem;
`;

const TruncTag = styled.span`
  margin-left: auto;
  font-weight: 500;
  color: #b45309;
`;

const TraceRow = styled.div`
  display: flex;
  gap: 0.375rem;
  font-size: 0.6875rem;
  color: #64748b;
  padding: 0.0625rem 0;

  code {
    font-family: 'Consolas', 'Monaco', monospace;
    background: #e2e8f0;
    padding: 0 0.25rem;
    border-radius: 3px;
    white-space: nowrap;
  }
  span { min-width: 0; word-break: break-word; }
`;

const Thinking = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  color: #64748b;

  svg { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const Empty = styled.div`
  margin: auto;
  text-align: center;
  color: #94a3b8;
  font-size: 0.8125rem;

  svg { color: #cbd5e1; }
  p { margin: 0.5rem 0 0.75rem; }
`;

const Examples = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0 0 1rem;
  font-size: 0.75rem;
  color: #64748b;

  li { padding: 0.125rem 0; }
`;

const Caution = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  text-align: left;
  font-size: 0.6875rem;
  color: #64748b;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 0.5rem;

  svg { flex-shrink: 0; margin-top: 1px; }
  strong { color: #475569; }
`;

const InputForm = styled.form`
  display: flex;
  gap: 0.5rem;
  padding: 0.625rem 0.75rem;
  border-top: 1px solid #e2e8f0;
`;

const TextArea = styled.textarea`
  flex: 1;
  resize: none;
  padding: 0.5rem 0.625rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-family: inherit;
  line-height: 1.5;
  outline: none;

  &:focus { border-color: #0891b2; }
  &:disabled { background: #f1f5f9; }
`;

const SendBtn = styled.button`
  align-self: flex-end;
  width: 38px;
  height: 38px;
  border: none;
  border-radius: 8px;
  background: #0891b2;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover:not(:disabled) { background: #0e7490; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

export default AiAgentPanel;
