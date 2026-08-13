/**
 * AI 폼 채우기 — 붙여넣은 글에서 값을 만들어 **편집 폼의 칸에 넣는다.**
 *
 * 🚦 전체 지도: 루트 `디지털트윈_AI기능_지도.md` (이름이 비슷한 AI 갈래가 여럿이다)
 *    · `AiAgentPanel`  대시보드 우하단. LLM 이 **도구로 스스로 고친다**(관리자 전용)
 *    · `AiFillPanel`(이 파일) 편집창 안. LLM 은 **값을 제안만** 한다
 *
 * 설계의 전부는 **"AI 는 채우기만 하고 저장은 사람이 한다"** 다.
 *   · 값이 폼에 들어갈 뿐이라 **저장 경로가 평소와 완전히 같다** — 권한·낙관적 락·
 *     변경 이력이 그대로 걸린다. 확인 대기(202)가 필요 없는 이유이기도 하다.
 *   · 대신 **적용 전에 before → after 를 반드시 보여준다.** 저장하고 나면 변경 이력에
 *     사람이 고친 것으로 남아(`source='ui'`) AI 가 채운 칸인지 알 수 없다.
 *     그 화면이 유일한 관문이다 — 자동 적용을 넣지 말 것.
 *
 * ⚠️ `과제상세설명` 만 서식 있는 편집기(Quill)라 값이 HTML 이다. **서버와는 일반
 *    텍스트로만 주고받고** 변환은 여기서 한다 — 모델에게 HTML 을 만들게 하면 화면이
 *    못 읽는 태그가 섞이고, 현재 값을 HTML 째로 보내면 프롬프트가 태그로 뒤덮인다.
 */
import React, { useState, useCallback } from 'react';
import styled from 'styled-components';
import { Wand2, Loader2, ChevronDown, ChevronRight, Check, AlertTriangle, X } from 'lucide-react';

import { fillProjectForm } from '../../../services/aiFormApi';

// 값이 HTML 인 칸. 지금은 하나뿐이지만 늘어날 수 있어 집합으로 둔다.
const RICH_TEXT_KEYS = new Set(['과제상세설명']);

// 월 번호로 보여줄 칸 (값은 1~12 숫자다 — 날짜가 아니다).
const MONTH_KEYS = new Set(['시작', '종료']);

const CURRENT_VALUE_MAX = 2000;   // 프롬프트에 실을 현재 값 상한 (문자열)
const CURRENT_OBJECT_MAX = 4000;  // 〃 (객체 — 상세 과제 정보 섹션)

/* ── 값 변환 ──────────────────────────────────────────────────────────────── */

/**
 * HTML → 일반 텍스트.
 *
 * `innerHTML` 대신 **DOMParser** 를 쓴다 — 만들어지는 문서가 비활성(inert)이라
 * `<img onerror=…>` 같은 것이 실행되지도, 외부 요청을 내지도 않는다.
 */
export const richTextToPlain = (html) => {
  const s = String(html ?? '');
  if (!s || !/<[a-z][\s\S]*>/i.test(s)) return s;      // 원래부터 일반 텍스트면 그대로
  const prepared = s
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  const doc = new DOMParser().parseFromString(prepared, 'text/html');
  return (doc.body?.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
};

const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/**
 * 일반 텍스트 → Quill 이 읽는 HTML.
 *
 * **반드시 이스케이프한다.** 모델이 만든 문자열이 그대로 편집기에 들어가는 자리라,
 * `<` 하나만 새어도 서식이 깨지거나 원치 않는 태그가 저장된다.
 */
export const plainToRichText = (text) => String(text ?? '')
  .split(/\r?\n/)
  .map((line) => (line.trim() === '' ? '<p><br></p>' : `<p>${escapeHtml(line)}</p>`))
  .join('');

/**
 * 서버에 보낼 "지금 화면이 들고 있는 값".
 *
 * **어떤 칸을 채울 수 있는지는 서버가 정한다** — 여기서 목록을 추리면 화이트리스트가
 * 두 곳이 되고 반드시 갈린다. 그래서 단순한 값(문자열·숫자·참거짓)을 그냥 다 보내고,
 * 서버가 자기 목록에 있는 것만 골라 쓴다.
 */
const buildCurrent = (formData) => {
  const out = {};
  Object.entries(formData || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    if (key.startsWith('이미지_')) return;

    // 배열은 안 보낸다 — 이 도우미가 채우는 칸에 배열은 없고(액션아이템·이슈·성과는
    // 각자의 화면이 다룬다), 통째로 실으면 프롬프트만 무거워진다.
    if (Array.isArray(value)) return;

    // 객체는 **작을 때만.** 상세 과제 정보 7섹션이 여기 해당한다.
    // 크기로 거르는 이유: 어떤 칸을 채울 수 있는지는 서버가 정한다 — 화면이 키 목록을
    // 추리면 화이트리스트가 두 곳이 되고 반드시 갈린다.
    if (typeof value === 'object') {
      try {
        const json = JSON.stringify(value);
        if (json.length <= CURRENT_OBJECT_MAX) out[key] = value;
      } catch (err) {
        // 순환 참조 같은 것은 그냥 건너뛴다
      }
      return;
    }

    const v = RICH_TEXT_KEYS.has(key) ? richTextToPlain(value) : value;
    out[key] = typeof v === 'string' ? v.slice(0, CURRENT_VALUE_MAX) : v;
  });
  return out;
};

/** 상세정보 섹션 → 화면에 보여줄 줄 목록 `[{text, depth}]` */
const detailLines = (section) => {
  const items = Array.isArray(section?.items) ? section.items : [];
  const out = [];
  items.forEach((it) => {
    const text = String(it?.text ?? '').trim();
    if (!text) return;
    out.push({ text, depth: 0 });
    (Array.isArray(it?.children) ? it.children : []).forEach((k) => {
      const kt = String(k?.text ?? '').trim();
      if (kt) out.push({ text: kt, depth: 1 });
    });
  });
  return out;
};

/** `상세정보_과제개요` → `과제개요`. 접두어는 탭 배지가 이미 말해 준다. */
const sectionLabel = (key) => String(key || '').replace(/^상세정보_/, '');

const showValue = (key, value) => {
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  // **빈 값 판정이 월 번호보다 먼저다.** 순서가 바뀌면 안 채워진 칸의 지금 값이
  // "undefined월" 로 뜬다(시작·종료는 비어 있을 수 있다).
  if (value === null || value === undefined || value === '') return '(비어 있음)';
  if (MONTH_KEYS.has(key)) return `${value}월`;
  const s = RICH_TEXT_KEYS.has(key) ? richTextToPlain(value) : String(value);
  if (!s.trim()) return '(비어 있음)';
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
};

/* ── 컴포넌트 ─────────────────────────────────────────────────────────────── */

const AiFillPanel = ({ projectUuid, formData, onApply }) => {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState('');
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);     // {patch, notes, skipped}
  const [picked, setPicked] = useState(() => new Set());
  const [applied, setApplied] = useState('');

  const run = useCallback(async () => {
    if (busy) return;
    if (!source.trim() && !instruction.trim()) {
      setError('붙여넣을 글이나 지시를 입력하세요.');
      return;
    }
    setBusy(true);
    setError('');
    setApplied('');
    setResult(null);
    try {
      const data = await fillProjectForm({
        uuid: projectUuid,
        text: source,
        instruction,
        current: buildCurrent(formData),
      });
      setResult(data);
      // 처음엔 **전부 선택**해 둔다. 어차피 사람이 훑어보고 끄는 화면이라,
      // 하나씩 켜게 하면 제안이 여러 칸일 때 클릭만 늘어난다.
      setPicked(new Set(Object.keys(data.patch || {})));
    } catch (err) {
      setError(err.message || 'AI 서버에 연결하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, [busy, source, instruction, projectUuid, formData]);

  const toggle = (key) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const apply = () => {
    const patch = result?.patch || {};
    const out = {};
    Object.entries(patch).forEach(([key, info]) => {
      if (!picked.has(key)) return;
      out[key] = RICH_TEXT_KEYS.has(key) ? plainToRichText(info.value) : info.value;
    });
    const count = Object.keys(out).length;
    if (!count) return;

    onApply(out);
    setResult(null);
    setPicked(new Set());
    setApplied(`${count}칸을 폼에 넣었습니다. 값을 확인하고 저장하세요 — 아직 저장되지 않았습니다.`);
  };

  const patchEntries = Object.entries(result?.patch || {});

  return (
    <Wrap>
      <Head type="button" onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <Wand2 size={15} />
        <strong>AI로 채우기</strong>
        {/*
          "회의록" 을 여기서 뺐다 — 그 말은 **옆 탭의 액션아이템 뽑기**가 하는 일이라,
          같은 말을 두 곳에 쓰면 사용자가 어느 쪽에 붙여넣어야 하는지 모른다.
          여기는 **과제 자체를 설명하는 글**을 받는다.
        */}
        <HeadNote>과제 정보를 붙여넣으면 칸에 넣을 값을 만들어 줍니다. 저장은 직접 누릅니다.</HeadNote>
      </Head>

      {open && (
        <Body>
          <Label>과제 정보 (기획서 · 보고서 · 과제 설명 등)</Label>
          <TextArea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="여기에 붙여넣으세요. 글에 없는 내용은 채우지 않습니다."
            rows={5}
            disabled={busy}
          />

          <Label>추가 지시 (선택)</Label>
          <TextInput
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="예) 상세설명만 다듬어줘 / 과제명은 그대로 둬"
            disabled={busy}
          />

          <Row>
            <RunBtn type="button" onClick={run} disabled={busy}>
              {busy ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />}
              {busy ? '만드는 중…' : '값 만들기'}
            </RunBtn>
            <Hint>
              사람(참여인력·과제PL)·진행률·진행상태는 채우지 않습니다 —
              권한과 진척 계산이 걸린 값이라 직접 정해야 합니다.
            </Hint>
          </Row>

          {error && <Alert className="error"><AlertTriangle size={14} />{error}</Alert>}
          {applied && <Alert className="ok"><Check size={14} />{applied}</Alert>}

          {result && (
            <Result>
              {patchEntries.length === 0 ? (
                <Empty>바꿀 값을 찾지 못했습니다. 원문을 더 구체적으로 적거나 지시를 덧붙여 보세요.</Empty>
              ) : (
                <>
                  <ResultHead>
                    제안 {patchEntries.length}칸 — 넣을 것만 남기고 <strong>적용</strong>을 누르세요.
                  </ResultHead>
                  {patchEntries.map(([key, info]) => (
                    <Change key={key} className={picked.has(key) ? 'on' : ''}>
                      <input
                        type="checkbox"
                        checked={picked.has(key)}
                        onChange={() => toggle(key)}
                      />
                      <div className="body">
                        <div className="name">
                          {sectionLabel(key)}
                          <TabTag>{info.tab}</TabTag>
                        </div>
                        {/*
                          종류마다 다르게 그린다. 상세 과제 정보는 계층 목록이라
                          한 줄로 뭉개면 무엇이 들어가는지 볼 수가 없다 —
                          **보고서에 그대로 실릴 문구**라 더더욱 보여야 한다.
                        */}
                        {info.kind === 'detail' ? (
                          <>
                            <DetailBlock className="before">
                              {detailLines(formData?.[key]).length === 0
                                ? <li className="empty">(비어 있음)</li>
                                : detailLines(formData?.[key]).slice(0, 4).map((ln, i) => (
                                    <li key={i} className={ln.depth ? 'child' : ''}>{ln.text}</li>
                                  ))}
                            </DetailBlock>
                            <DetailBlock className="after">
                              {detailLines(info.value).map((ln, i) => (
                                <li key={i} className={ln.depth ? 'child' : ''}>{ln.text}</li>
                              ))}
                            </DetailBlock>
                          </>
                        ) : (
                          <>
                            <div className="before">{showValue(key, formData?.[key])}</div>
                            <div className="after">{showValue(key, info.value)}</div>
                          </>
                        )}
                      </div>
                    </Change>
                  ))}
                  <ApplyRow>
                    <ApplyBtn type="button" onClick={apply} disabled={picked.size === 0}>
                      <Check size={14} /> 선택 {picked.size}칸 적용
                    </ApplyBtn>
                    <GhostBtn type="button" onClick={() => setResult(null)}>
                      <X size={14} /> 버리기
                    </GhostBtn>
                  </ApplyRow>
                </>
              )}

              {(result.notes || []).map((n, i) => (
                <Note key={`n${i}`}>{n}</Note>
              ))}
              {/* 버려진 칸을 조용히 넘기지 않는다 — 사용자는 AI 가 그 칸을 안 건드린 줄 안다 */}
              {(result.skipped || []).map((s, i) => (
                <Note key={`s${i}`} className="warn">
                  <strong>{s.key}</strong> 는 넣지 않았습니다 — {s.why}
                </Note>
              ))}
            </Result>
          )}
        </Body>
      )}
    </Wrap>
  );
};

/* ── 스타일 ── */

const Wrap = styled.div`
  border: 1px solid #cffafe;
  background: #f0fdff;
  border-radius: 0.75rem;
  margin-bottom: 1rem;
  overflow: hidden;
`;

const Head = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  color: #0e7490;
  font-size: 0.875rem;

  strong { font-weight: 600; }
  &:hover { background: #ecfeff; }
`;

const HeadNote = styled.span`
  font-size: 0.75rem;
  color: #64748b;
  font-weight: 400;

  @media (max-width: 900px) { display: none; }
`;

const Body = styled.div`
  padding: 0 0.875rem 0.875rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const Label = styled.label`
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
  margin-top: 0.25rem;
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-family: inherit;
  line-height: 1.5;
  resize: vertical;

  &:focus { outline: none; border-color: #06b6d4; box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.12); }
  &:disabled { background: #f1f5f9; }
`;

const TextInput = styled.input`
  width: 100%;
  padding: 0.4375rem 0.625rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  font-family: inherit;

  &:focus { outline: none; border-color: #06b6d4; box-shadow: 0 0 0 3px rgba(6, 182, 212, 0.12); }
  &:disabled { background: #f1f5f9; }
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 0.375rem;
`;

const Hint = styled.span`
  flex: 1;
  min-width: 220px;
  font-size: 0.6875rem;
  color: #64748b;
  line-height: 1.5;
`;

const RunBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.875rem;
  border: none;
  border-radius: 0.5rem;
  background: #0891b2;
  color: #fff;
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover:not(:disabled) { background: #0e7490; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const Alert = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  margin-top: 0.5rem;
  padding: 0.5rem 0.625rem;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  line-height: 1.5;

  svg { flex-shrink: 0; margin-top: 1px; }
  &.error { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
  &.ok { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
`;

const Result = styled.div`
  margin-top: 0.625rem;
  padding-top: 0.625rem;
  border-top: 1px dashed #a5f3fc;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const ResultHead = styled.div`
  font-size: 0.75rem;
  color: #475569;
`;

const Empty = styled.div`
  font-size: 0.75rem;
  color: #64748b;
  padding: 0.5rem 0;
`;

const Change = styled.label`
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  cursor: pointer;

  &.on { border-color: #67e8f9; background: #fbffff; }

  input { margin-top: 0.1875rem; accent-color: #0891b2; }
  .body { min-width: 0; flex: 1; }
  .name { font-size: 0.8125rem; font-weight: 600; color: #0f172a; display: flex; align-items: center; gap: 0.375rem; }

  /* 지금 값 → 바뀔 값. 순서가 곧 뜻이라 색으로도 갈라 둔다 */
  .before {
    font-size: 0.75rem; color: #94a3b8; margin-top: 0.1875rem;
    text-decoration: line-through; word-break: break-word; white-space: pre-wrap;
  }
  .after {
    font-size: 0.8125rem; color: #0f172a; margin-top: 0.125rem;
    word-break: break-word; white-space: pre-wrap;
  }
`;

/* 상세 과제 정보 — 계층 목록. 지금 값은 흐리게(취소선 없이: 줄이 여러 개라
   취소선을 그으면 읽을 수가 없다), 새 값은 진하게. */
const DetailBlock = styled.ul`
  list-style: none;
  margin: 0.25rem 0 0;
  padding: 0;
  font-size: 0.75rem;
  line-height: 1.6;

  li { position: relative; padding-left: 0.75rem; word-break: break-word; }
  li::before { content: '·'; position: absolute; left: 0.125rem; }
  li.child { padding-left: 1.5rem; }
  li.child::before { content: '-'; left: 0.875rem; }
  li.empty::before { content: ''; }

  &.before { color: #94a3b8; }
  &.after { color: #0f172a; font-size: 0.8125rem; }
`;

const TabTag = styled.span`
  font-size: 0.625rem;
  font-weight: 500;
  color: #0e7490;
  background: #cffafe;
  border-radius: 0.25rem;
  padding: 0.0625rem 0.3125rem;
`;

const ApplyRow = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.25rem;
`;

const ApplyBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.875rem;
  border: none;
  border-radius: 0.5rem;
  background: #0891b2;
  color: #fff;
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover:not(:disabled) { background: #0e7490; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const GhostBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4375rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  background: #fff;
  color: #64748b;
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover { background: #f8fafc; }
`;

const Note = styled.div`
  font-size: 0.6875rem;
  color: #64748b;
  line-height: 1.5;

  &.warn { color: #b45309; }
  strong { font-weight: 600; }
`;

export default AiFillPanel;
