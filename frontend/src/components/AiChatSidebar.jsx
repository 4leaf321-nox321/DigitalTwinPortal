/**
 * 일반 AI 대화 사이드바 — **브라우저가 `/llm` 을 직접 부른다. 도구는 못 쓴다.**
 *
 * 🚦 **2026-08-01 현재 화면 어디에도 붙어 있지 않다.**
 *    메인·DT 대시보드·문서자동작성 세 곳의 mount 를 전부 주석 처리했다.
 *    이유 — DT 대시보드에 도구를 쓰는 `AiAgentPanel` 이 생겨 **채팅창이 둘**이 됐고,
 *    사용자가 어느 쪽에 물어야 하는지 알 수 없었다. 코드는 되살릴 수 있게 남겨 뒀다.
 *
 * 🚦 **`AiAgentPanel.jsx` 와 헷갈리지 말 것** —
 *      · 이 파일          브라우저 → `/llm` → localhost:8080. **도구 없음**
 *      · AiAgentPanel     브라우저 → 백엔드 → LLM. **도구 9개 + 권한 검사**
 *    데이터를 고치는 기능은 여기 붙이면 안 된다(브라우저에는 권한 검사가 없다).
 *
 * 전체 지도: 루트 `디지털트윈_AI기능_지도.md`
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Bot, User, Trash2, ChevronDown, RefreshCw, Zap } from 'lucide-react';

const LLM_API_URL = '/llm/v1/chat/completions';
const AI_CONTEXT_API = '/api/ai/context';
const AI_ANALYZE_API = '/api/ai/analyze';

// Sliding window: keep only the last N messages for LLM context
const MAX_HISTORY_MESSAGES = 6;

// ---- Styled Components ----

const ToggleButton = styled(motion.button)`
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(79, 70, 229, 0.4);
  z-index: 1000;
  transition: box-shadow 0.3s ease;

  &:hover {
    box-shadow: 0 6px 28px rgba(79, 70, 229, 0.6);
  }
`;

const Panel = styled(motion.div)`
  position: fixed;
  top: 0;
  right: 0;
  width: 400px;
  height: 100vh;
  background: #ffffff;
  border-left: 1px solid #e2e8f0;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.08);
  z-index: 1001;
  display: flex;
  flex-direction: column;

  @media (max-width: 480px) {
    width: 100vw;
  }
`;

const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
  background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
  color: white;
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  font-size: 1rem;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
`;

const IconBtn = styled.button`
  background: rgba(255, 255, 255, 0.15);
  border: none;
  color: white;
  padding: 0.375rem;
  border-radius: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;

  &:hover {
    background: rgba(255, 255, 255, 0.3);
  }
`;

const MessagesArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: #f8fafc;

  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 3px;
  }
`;

const MessageRow = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  flex-direction: ${({ $isUser }) => ($isUser ? 'row-reverse' : 'row')};
`;

const Avatar = styled.div`
  width: 32px;
  height: 32px;
  min-width: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $isUser }) => ($isUser ? '#e0e7ff' : '#f0fdf4')};
  color: ${({ $isUser }) => ($isUser ? '#4f46e5' : '#16a34a')};
`;

const Bubble = styled.div`
  max-width: 80%;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  font-size: 0.875rem;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  background: ${({ $isUser }) => ($isUser ? '#4f46e5' : '#ffffff')};
  color: ${({ $isUser }) => ($isUser ? '#ffffff' : '#1e293b')};
  border: ${({ $isUser }) => ($isUser ? 'none' : '1px solid #e2e8f0')};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  ${({ $isUser }) => $isUser && 'border-bottom-right-radius: 0.25rem;'}
  ${({ $isUser }) => !$isUser && 'border-bottom-left-radius: 0.25rem;'}
`;

const bounce = keyframes`
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
`;

const TypingDots = styled.div`
  display: flex;
  gap: 4px;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
  border-bottom-left-radius: 0.25rem;

  span {
    width: 8px;
    height: 8px;
    background: #94a3b8;
    border-radius: 50%;
    animation: ${bounce} 1.2s infinite ease-in-out;
  }
  span:nth-child(1) { animation-delay: 0s; }
  span:nth-child(2) { animation-delay: 0.15s; }
  span:nth-child(3) { animation-delay: 0.3s; }
`;

const InputArea = styled.div`
  padding: 1rem;
  border-top: 1px solid #e2e8f0;
  background: white;
`;

const InputRow = styled.form`
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
`;

const TextArea = styled.textarea`
  flex: 1;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.625rem 0.875rem;
  font-size: 0.875rem;
  resize: none;
  outline: none;
  font-family: inherit;
  line-height: 1.5;
  max-height: 120px;
  background: #f8fafc;
  color: #1e293b;
  transition: border-color 0.2s;

  &:focus {
    border-color: #4f46e5;
    background: white;
  }

  &::placeholder {
    color: #94a3b8;
  }
`;

const SendButton = styled.button`
  width: 40px;
  height: 40px;
  border-radius: 0.75rem;
  background: ${({ disabled }) => (disabled ? '#e2e8f0' : 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)')};
  color: ${({ disabled }) => (disabled ? '#94a3b8' : 'white')};
  border: none;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;

  &:hover:not(:disabled) {
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
  }
`;

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  gap: 0.75rem;
  text-align: center;
  padding: 2rem;

  p {
    font-size: 0.875rem;
    line-height: 1.5;
  }
`;

const ScrollDownBtn = styled.button`
  position: absolute;
  bottom: 5.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  color: #64748b;
  z-index: 2;

  &:hover {
    background: #f1f5f9;
  }
`;

const ErrorBubble = styled(Bubble)`
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
`;

const ContextBadge = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  margin: 0 1rem;
  border-radius: 0.5rem;
  background: ${({ $loaded }) => ($loaded ? '#f0fdf4' : '#fefce8')};
  border: 1px solid ${({ $loaded }) => ($loaded ? '#bbf7d0' : '#fef08a')};
  color: ${({ $loaded }) => ($loaded ? '#16a34a' : '#a16207')};
  font-size: 0.75rem;

  button {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
  }
`;

const FaqBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.65rem;
  color: #7c3aed;
  background: #f3f0ff;
  padding: 0.125rem 0.5rem;
  border-radius: 0.75rem;
  margin-bottom: 0.25rem;
  font-weight: 500;
`;

// ---- Component ----

const AiChatSidebar = ({ pageContext, pageName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [serverContext, setServerContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const textareaRef = useRef(null);

  // Fetch context from backend API when panel opens
  const fetchContext = useCallback(async () => {
    if (!pageName) return;
    setContextLoading(true);
    try {
      const res = await fetch(`${AI_CONTEXT_API}?page=${encodeURIComponent(pageName)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.context) {
          setServerContext(data.context);
        }
      }
    } catch (err) {
      console.error('AI 컨텍스트 로드 실패:', err);
    } finally {
      setContextLoading(false);
    }
  }, [pageName]);

  useEffect(() => {
    if (isOpen && pageName) {
      fetchContext();
    }
  }, [isOpen, pageName, fetchContext]);

  // Effective context: server API > prop
  const effectiveContext = serverContext || pageContext || null;

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!showScrollDown) {
      scrollToBottom();
    }
  }, [messages, isLoading, showScrollDown, scrollToBottom]);

  // Detect if user scrolled up
  const handleScroll = () => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setShowScrollDown(!atBottom);
  };

  // Auto-resize textarea
  const handleInputChange = (e) => {
    setInput(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  };

  // Parse SSE streaming response
  const processStream = async (response, onToken) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.slice(6);
        if (dataStr === '[DONE]') return;

        try {
          const parsed = JSON.parse(dataStr);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) onToken(token);
        } catch {
          // skip malformed JSON chunks
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      // Step 1: Call analyze API for intent classification + server-side analysis
      let analyzeResult = null;
      try {
        const analyzeRes = await fetch(AI_ANALYZE_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ page: pageName || 'main', query: text }),
        });
        if (analyzeRes.ok) {
          analyzeResult = await analyzeRes.json();
        }
      } catch {
        // Analyze API failed, fall through to LLM
      }

      // Step 2: If FAQ match, show instantly (no LLM call)
      if (analyzeResult?.type === 'faq') {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: analyzeResult.answer,
          source: 'faq',
        }]);
        setIsLoading(false);
        return;
      }

      // Step 3: Build messages for LLM
      const systemContent = analyzeResult?.type === 'analysis'
        ? analyzeResult.context  // Server-computed analysis as system prompt
        : effectiveContext || '';

      // Sliding window: only send last N messages to LLM
      const recentMessages = newMessages
        .filter(m => m.role !== 'error')
        .slice(-MAX_HISTORY_MESSAGES)
        .map(m => ({ role: m.role, content: m.content }));

      const apiMessages = [];
      if (systemContent) {
        apiMessages.push({ role: 'system', content: systemContent });
      }
      apiMessages.push(...recentMessages);

      // Step 4: Call LLM (try streaming first, fallback to non-streaming)
      const source = analyzeResult?.type === 'analysis' ? 'analysis' : 'llm';

      let streamingSucceeded = false;
      try {
        const response = await fetch(LLM_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'default',
            messages: apiMessages,
            temperature: 0.3,
            max_tokens: 2048,
            stream: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`서버 응답 오류 (${response.status})`);
        }

        const contentType = response.headers.get('Content-Type') || '';

        if (contentType.includes('text/event-stream')) {
          // SSE streaming response
          let accumulated = '';
          const assistantIdx = newMessages.length;

          setMessages(prev => [...prev, { role: 'assistant', content: '', source }]);

          await processStream(response, (token) => {
            accumulated += token;
            const current = accumulated;
            setMessages(prev => {
              const updated = [...prev];
              if (updated.length > assistantIdx) {
                updated[assistantIdx] = { ...updated[assistantIdx], content: current };
              }
              return updated;
            });
          });

          if (accumulated) {
            streamingSucceeded = true;
            setMessages(prev => {
              const updated = [...prev];
              if (updated.length > assistantIdx) {
                updated[assistantIdx] = { ...updated[assistantIdx], content: accumulated };
              }
              return updated;
            });
          }
        } else {
          // JSON response (LLM server doesn't support streaming or returned JSON)
          const data = await response.json();
          const assistantContent = data.choices?.[0]?.message?.content || '';
          if (assistantContent) {
            streamingSucceeded = true;
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: assistantContent,
              source,
            }]);
          }
        }
      } catch (streamErr) {
        console.warn('스트리밍 요청 실패, non-streaming으로 재시도:', streamErr.message);
      }

      // Fallback: non-streaming retry
      if (!streamingSucceeded) {
        const fallbackRes = await fetch(LLM_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'default',
            messages: apiMessages,
            temperature: 0.3,
            max_tokens: 2048,
            stream: false,
          }),
        });

        if (!fallbackRes.ok) {
          throw new Error(`서버 응답 오류 (${fallbackRes.status})`);
        }

        const data = await fallbackRes.json();
        const assistantContent = data.choices?.[0]?.message?.content || '응답을 받지 못했습니다.';

        // Remove empty placeholder if streaming left one
        setMessages(prev => {
          const cleaned = prev.filter((m, i) => !(i === prev.length - 1 && m.role === 'assistant' && !m.content));
          return [...cleaned, { role: 'assistant', content: assistantContent, source }];
        });
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'error', content: `오류: ${err.message}\n\nLLM 서버(localhost:8080)가 실행 중인지 확인해주세요.` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <>
      {/* Floating toggle button – hidden when panel is open */}
      <AnimatePresence>
        {!isOpen && (
          <ToggleButton
            onClick={() => setIsOpen(true)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <MessageSquare size={24} />
          </ToggleButton>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <Panel
            initial={{ x: 400 }}
            animate={{ x: 0 }}
            exit={{ x: 400 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          >
            {/* Header */}
            <PanelHeader>
              <HeaderLeft>
                <Bot size={20} />
                AI 어시스턴트
              </HeaderLeft>
              <HeaderActions>
                {pageName && (
                  <IconBtn onClick={fetchContext} title="컨텍스트 새로고침">
                    <RefreshCw size={14} />
                  </IconBtn>
                )}
                <IconBtn onClick={clearChat} title="대화 초기화">
                  <Trash2 size={16} />
                </IconBtn>
                <IconBtn onClick={() => setIsOpen(false)} title="닫기">
                  <X size={18} />
                </IconBtn>
              </HeaderActions>
            </PanelHeader>

            {/* Context status */}
            {pageName && (
              <ContextBadge $loaded={!!serverContext}>
                {contextLoading
                  ? '페이지 컨텍스트 로딩 중...'
                  : serverContext
                    ? '페이지 컨텍스트 연동됨'
                    : '컨텍스트 로드 실패'}
                {!contextLoading && (
                  <button onClick={fetchContext} title="새로고침">
                    <RefreshCw size={11} />
                  </button>
                )}
              </ContextBadge>
            )}

            {/* Messages */}
            <MessagesArea ref={messagesAreaRef} onScroll={handleScroll}>
              {messages.length === 0 && !isLoading ? (
                <EmptyState>
                  <Bot size={48} strokeWidth={1.2} />
                  <p>
                    안녕하세요! AI 어시스턴트입니다.<br />
                    궁금한 것을 물어보세요.
                  </p>
                </EmptyState>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <MessageRow key={i} $isUser={msg.role === 'user'}>
                      <Avatar $isUser={msg.role === 'user'}>
                        {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                      </Avatar>
                      <div>
                        {msg.source === 'faq' && msg.role === 'assistant' && (
                          <FaqBadge><Zap size={10} /> 즉시 응답</FaqBadge>
                        )}
                        {msg.source === 'analysis' && msg.role === 'assistant' && (
                          <FaqBadge><Zap size={10} /> 데이터 분석</FaqBadge>
                        )}
                        {msg.role === 'error' ? (
                          <ErrorBubble $isUser={false}>{msg.content}</ErrorBubble>
                        ) : (
                          <Bubble $isUser={msg.role === 'user'}>{msg.content}</Bubble>
                        )}
                      </div>
                    </MessageRow>
                  ))}
                  {isLoading && (
                    <MessageRow $isUser={false}>
                      <Avatar $isUser={false}>
                        <Bot size={16} />
                      </Avatar>
                      <TypingDots>
                        <span /><span /><span />
                      </TypingDots>
                    </MessageRow>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </MessagesArea>

            {/* Scroll-down button */}
            {showScrollDown && (
              <ScrollDownBtn onClick={scrollToBottom}>
                <ChevronDown size={18} />
              </ScrollDownBtn>
            )}

            {/* Input */}
            <InputArea>
              <InputRow onSubmit={handleSubmit}>
                <TextArea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="메시지를 입력하세요... (Shift+Enter: 줄바꿈)"
                  disabled={isLoading}
                />
                <SendButton type="submit" disabled={!input.trim() || isLoading}>
                  <Send size={18} />
                </SendButton>
              </InputRow>
            </InputArea>
          </Panel>
        )}
      </AnimatePresence>
    </>
  );
};

export default AiChatSidebar;
