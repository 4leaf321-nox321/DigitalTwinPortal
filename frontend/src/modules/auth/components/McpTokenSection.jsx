/**
 * MCP 연결 — 개인 액세스 토큰(PAT) 발급 · 목록 · 폐기 화면.
 *
 * 어디에 붙나
 *     `pages/AccountManagementPage.jsx` 의 **우측 "MCP 연결" 카드** 본문.
 *     "내 계정 정보" 와 좌우로 나란히 놓여 **한 화면에 같이 보인다.**
 *     그 페이지는 `<ProtectedRoute>` 만 걸려 있어 **로그인한 사람 누구나** 들어온다.
 *     PAT 은 개인 것이라(과제 담당자도 자기 토큰이 필요하다) 관리자 전용 자리에 두면 안 된다.
 *
 *     **카드 제목(아이콘·MCP 연결·한 줄 설명)은 페이지가 그린다** — 옆 카드들과 머리 모양을
 *     맞추려는 것이다. 여기서 또 제목을 그리면 한 카드에 제목이 둘이 된다.
 *
 * 화면의 목적은 "토큰 보여주기" 가 아니라 **`claude mcp add` 명령을 통째로 넘겨주기** 다.
 *     토큰만 주면 사용자가 명령을 조립하다 틀린다(참고: ReportArchive 가 같은 결론).
 *
 * ⚠️ 평문은 발급 응답에서 **딱 한 번만** 온다. 목록에는 없다(서버가 해시만 보관).
 *    그래서 발급 결과 블록은 사용자가 닫기 전까지 화면에 남긴다.
 */
import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Copy, Check, Trash2, AlertTriangle, Plus, X, Download, BookOpen } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// MCP 서버 주소. 기본값은 **지금 보고 있는 호스트**다 — MCP 서버는 DT 서버와 같은 장비에 뜨므로
// 사용자가 DT 에 접속한 그 호스트가 곧 MCP 호스트다. 다른 데 띄웠으면 VITE_MCP_URL 로 덮는다.
const MCP_URL = import.meta.env.VITE_MCP_URL
  || `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:3003/mcp`;

// 스킬(사용 안내)을 넣을 폴더를 만들고 탐색기로 열어 준다. 내려받은 파일을 끌어다 놓으면 끝이다.
// **다운로드 폴더에서 파일을 옮기는 명령을 주지 않는다** — OneDrive 로 옮겨 놓은 사람이 많아
// `~\Downloads` 를 가정하면 조용히 실패한다. 폴더를 열어 주는 쪽이 어디에 받았든 통한다.
const SKILL_FOLDER_CMD = 'mkdir -Force $HOME\\.claude\\skills\\digitaltwin | ii';

const EXPIRY_OPTIONS = [
  { days: 30, label: '30일' },
  { days: 90, label: '90일' },
  { days: 180, label: '180일' },
  { days: 365, label: '365일' }
];

/**
 * 서버는 UTC 를 timezone 표기 **없이** 준다(`datetime.utcnow().isoformat()`).
 * 그대로 `new Date()` 에 넣으면 JS 가 로컬시각으로 읽어 9시간 어긋난다 → 날짜가 하루 밀린다.
 */
const toDate = (iso) => {
  if (!iso) return null;
  const tail = iso.slice(10);
  const hasZone = /[Z+]/.test(tail) || /-\d{2}:\d{2}$/.test(tail);
  const d = new Date(hasZone ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const fmtDate = (iso) => {
  const d = toDate(iso);
  return d ? d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) : '—';
};

/**
 * 클립보드 복사.
 *
 * ⚠️ `navigator.clipboard` 는 **보안 컨텍스트(https 또는 localhost)에서만** 존재한다.
 *    사내망 http 로 접속하면 `undefined` 라 그냥 쓰면 조용히 터진다 —
 *    이 화면은 복사가 핵심 기능이므로 구식 방법으로 반드시 대비한다.
 */
const copyText = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    // 아래 대체 경로로 넘어간다
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
};

const McpTokenSection = () => {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);      // { type: 'success'|'error', text }
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [expiresDays, setExpiresDays] = useState(90);
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState(null);        // { token, info } — 평문. 한 번만 온다
  const [copied, setCopied] = useState('');          // 'command' | 'token' | 'folder'
  const [confirmId, setConfirmId] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    'Content-Type': 'application/json'
  });

  /**
   * 401 은 "요청이 실패했다" 가 아니라 **웹 로그인이 만료된 것**이다.
   *
   * 이 페이지는 공통 `authApi`(refresh 재시도가 들어 있다)를 안 쓰고 생 `fetch` 를 쓴다.
   * 그래서 JWT 12시간이 지나면 그냥 401 이 온다. 게다가 그 401 은 flask-jwt-extended 가
   * 만드는 `{msg: ...}` 라 우리 `{success, message}` 모양이 아니어서 `data.message` 가 비고,
   * 손대지 않으면 "폐기에 실패했습니다" 라고만 떠서 **원인을 알 수가 없다.**
   * (2026-08-01 실제 화면 시험 중 세션이 만료되면서 드러났다.)
   */
  const call = async (path, options = {}) => {
    const res = await fetch(`${API_BASE_URL}/auth/me/mcp-tokens${path}`, {
      ...options,
      headers: authHeaders()
    });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    return {
      ok: res.ok && data?.success,
      expired: res.status === 401,
      data: data?.data,
      message: data?.message
    };
  };

  const fail = (r, fallback) =>
    setMessage({
      type: 'error',
      text: r.expired ? '로그인이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.' : (r.message || fallback)
    });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await call('');
      if (r.ok) setTokens(r.data || []);
      else fail(r, '토큰 목록을 불러오지 못했습니다.');
    } catch (err) {
      console.error('MCP token list error:', err);
      setMessage({ type: 'error', text: '토큰 목록을 불러오는 중 오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleIssue = async (e) => {
    e.preventDefault();
    setIssuing(true);
    setMessage(null);
    try {
      const r = await call('', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() || 'MCP 토큰', expiresDays })
      });
      if (r.ok) {
        setIssued(r.data);              // ⚠️ 평문은 여기 말고 어디에도 없다
        setShowForm(false);
        setName('');
        setCopied('');
        load();
      } else {
        fail(r, '토큰 발급에 실패했습니다.');
      }
    } catch (err) {
      console.error('MCP token issue error:', err);
      setMessage({ type: 'error', text: '토큰 발급 중 오류가 발생했습니다.' });
    } finally {
      setIssuing(false);
    }
  };

  const handleRevoke = async (id) => {
    setMessage(null);
    try {
      const r = await call(`/${id}`, { method: 'DELETE' });
      if (r.ok) {
        setMessage({ type: 'success', text: '토큰을 폐기했습니다. 즉시 사용할 수 없습니다.' });
        if (issued?.info?.id === id) setIssued(null);
        load();
      } else {
        fail(r, '토큰 폐기에 실패했습니다.');
      }
    } catch (err) {
      console.error('MCP token revoke error:', err);
      setMessage({ type: 'error', text: '토큰 폐기 중 오류가 발생했습니다.' });
    } finally {
      setConfirmId(null);
    }
  };

  const handleCopy = async (text, which) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(which);
      setTimeout(() => setCopied(''), 2000);
    } else {
      setMessage({ type: 'error', text: '자동 복사에 실패했습니다. 아래 내용을 직접 선택해 복사하세요.' });
    }
  };

  /**
   * 사용 안내(SKILL.md) 내려받기.
   *
   * `call()` 을 쓰지 않는다 — 그건 JSON 을 기대하는데 이건 **마크다운 본문**이다.
   * 서버가 파일을 그대로 보내므로(사본을 만들지 않으려는 것) 여기서 blob 으로 받아 저장한다.
   */
  const handleDownloadSkill = async () => {
    setDownloading(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/dt-v2/skill/digitaltwin`, { headers: authHeaders() });
      if (!res.ok) {
        let serverMsg = null;
        try {
          serverMsg = (await res.json())?.message;   // 401 은 {msg} 라 비어 있다
        } catch (e) {
          serverMsg = null;
        }
        setMessage({
          type: 'error',
          text: res.status === 401
            ? '로그인이 만료되었습니다. 다시 로그인한 뒤 시도해 주세요.'
            : (serverMsg || '사용 안내를 내려받지 못했습니다.')
        });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SKILL.md';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({
        type: 'success',
        text: 'SKILL.md 를 내려받았습니다. 아래 폴더에 넣고 Claude Code 를 다시 시작하세요.'
      });
    } catch (err) {
      console.error('MCP skill download error:', err);
      setMessage({ type: 'error', text: '사용 안내를 내려받는 중 오류가 발생했습니다.' });
    } finally {
      setDownloading(false);
    }
  };

  const command = issued
    ? `claude mcp add --transport http digitaltwin ${MCP_URL} --header "Authorization: Bearer ${issued.token}"`
    : '';

  return (
    <Section>
      {message && (
        <Message className={message.type}>
          {message.type === 'success' ? <Check size={16} /> : <X size={16} />}
          {message.text}
        </Message>
      )}

      {/* 발급 결과 — 평문은 여기서만 볼 수 있다 */}
      {issued && (
        <IssuedBox>
          <IssuedHeader>
            <AlertTriangle size={18} />
            <strong>지금 복사하세요 — 이 토큰은 다시 볼 수 없습니다.</strong>
            <CloseButton type="button" onClick={() => setIssued(null)} title="닫기">
              <X size={16} />
            </CloseButton>
          </IssuedHeader>
          <IssuedBody>
            <FieldLabel>아래 명령을 그대로 터미널에 붙여넣으면 등록이 끝납니다.</FieldLabel>
            <CodeRow>
              <Code>{command}</Code>
              <CopyButton type="button" onClick={() => handleCopy(command, 'command')}>
                {copied === 'command' ? <Check size={14} /> : <Copy size={14} />}
                {copied === 'command' ? '복사됨' : '명령 복사'}
              </CopyButton>
            </CodeRow>

            <FieldLabel style={{ marginTop: '0.75rem' }}>
              다른 MCP 클라이언트(Gemini CLI 등)에는 토큰만 필요할 수 있습니다.
            </FieldLabel>
            <CodeRow>
              <Code className="mono-sm">{issued.token}</Code>
              <CopyButton type="button" className="ghost" onClick={() => handleCopy(issued.token, 'token')}>
                {copied === 'token' ? <Check size={14} /> : <Copy size={14} />}
                {copied === 'token' ? '복사됨' : '토큰만 복사'}
              </CopyButton>
            </CodeRow>
          </IssuedBody>
        </IssuedBox>
      )}

      {/* 발급 폼 */}
      {showForm ? (
        <IssueForm onSubmit={handleIssue}>
          <FormRow>
            <FormGroup style={{ flex: 2 }}>
              <FieldLabel>이름 (어디에 쓰는 토큰인지)</FieldLabel>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 업무용 노트북 Claude Code"
                maxLength={100}
                disabled={issuing}
                autoFocus
              />
            </FormGroup>
            <FormGroup style={{ flex: 1 }}>
              <FieldLabel>유효기간</FieldLabel>
              <Select
                value={expiresDays}
                onChange={(e) => setExpiresDays(Number(e.target.value))}
                disabled={issuing}
              >
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.days} value={o.days}>{o.label}</option>
                ))}
              </Select>
            </FormGroup>
          </FormRow>
          <FormActions>
            <ActionButton type="submit" className="primary" disabled={issuing}>
              {issuing ? '발급 중...' : '발급'}
            </ActionButton>
            <ActionButton type="button" className="secondary" onClick={() => setShowForm(false)} disabled={issuing}>
              취소
            </ActionButton>
          </FormActions>
        </IssueForm>
      ) : (
        <ActionButton type="button" className="primary" onClick={() => { setShowForm(true); setMessage(null); }}>
          <Plus size={16} />
          새 토큰 발급
        </ActionButton>
      )}

      {/* 목록 */}
      <TokenList>
        {loading && tokens.length === 0 && <EmptyRow>불러오는 중...</EmptyRow>}
        {!loading && tokens.length === 0 && (
          <EmptyRow>발급한 토큰이 없습니다.</EmptyRow>
        )}
        {tokens.map((t) => {
          const exp = toDate(t.expiresAt);
          const expired = exp && exp.getTime() < Date.now();
          return (
            <TokenRow key={t.id} className={expired ? 'expired' : ''}>
              <TokenMain>
                <TokenName>
                  {t.name}
                  {expired && <ExpiredBadge>만료됨</ExpiredBadge>}
                </TokenName>
                <TokenMeta>
                  <code>{t.tokenPrefix}…</code>
                  <span>발급 {fmtDate(t.createdAt)}</span>
                  <span>만료 {fmtDate(t.expiresAt)}</span>
                  <span>{t.lastUsedAt ? `마지막 사용 ${fmtDate(t.lastUsedAt)}` : '사용 이력 없음'}</span>
                </TokenMeta>
              </TokenMain>
              {confirmId === t.id ? (
                <ConfirmGroup>
                  <span>폐기할까요?</span>
                  <ActionButton type="button" className="danger sm" onClick={() => handleRevoke(t.id)}>
                    폐기
                  </ActionButton>
                  <ActionButton type="button" className="secondary sm" onClick={() => setConfirmId(null)}>
                    취소
                  </ActionButton>
                </ConfirmGroup>
              ) : (
                <IconButton type="button" onClick={() => setConfirmId(t.id)} title="폐기">
                  <Trash2 size={16} />
                </IconButton>
              )}
            </TokenRow>
          );
        })}
      </TokenList>

      {/*
        사용 안내(Agent Skill) 설치.
        **발급 결과 블록 안에 두지 않는다** — 그 블록은 사용자가 닫으면 사라지는데,
        스킬은 기기마다 한 번 하는 일이라 토큰을 받은 순간이 아니어도 다시 와서 받을 수 있어야 한다.
      */}
      <SkillBox>
        <SkillTitle>
          <BookOpen size={16} />
          AI 사용 안내 설치
          <SkillOptional>선택 · 권장</SkillOptional>
        </SkillTitle>
        <SkillDesc>
          AI 가 <strong>확인 없이 반영하거나</strong>, 액션아이템·이슈 목록을 통째로 덮어쓰는
          실수를 줄여 줍니다. 없어도 동작은 합니다.
        </SkillDesc>
        <ActionButton
          type="button"
          className="secondary"
          onClick={handleDownloadSkill}
          disabled={downloading}
        >
          <Download size={16} />
          {downloading ? '내려받는 중...' : 'SKILL.md 내려받기'}
        </ActionButton>

        <FieldLabel style={{ marginTop: '0.75rem' }}>
          아래 명령을 붙여넣으면 넣을 폴더가 만들어지고 열립니다. 내려받은 SKILL.md 를 그 안에
          옮긴 뒤 Claude Code 를 다시 시작하세요.
        </FieldLabel>
        <CodeRow>
          <Code>{SKILL_FOLDER_CMD}</Code>
          <CopyButton type="button" className="ghost" onClick={() => handleCopy(SKILL_FOLDER_CMD, 'folder')}>
            {copied === 'folder' ? <Check size={14} /> : <Copy size={14} />}
            {copied === 'folder' ? '복사됨' : '명령 복사'}
          </CopyButton>
        </CodeRow>
        <SkillFoot>macOS · Linux 는 <code>mkdir -p ~/.claude/skills/digitaltwin</code></SkillFoot>
      </SkillBox>

      <Hint>
        토큰은 <strong>내 권한 그대로</strong> 동작합니다 — 내가 못 고치는 과제는 AI 도 못 고칩니다.
        AI 가 핵심 항목(과제명·일정·진행상태 등)을 바꾸려 하면 바로 반영하지 않고,
        <strong>무엇이 어떻게 바뀌는지 대화에서 먼저 확인</strong>합니다 — 별도로 승인할 화면은 없습니다.
        유출이 의심되면 폐기 버튼을 누르세요 — <strong>즉시</strong> 무효가 됩니다.
      </Hint>
    </Section>
  );
};

/* ── 스타일 (AccountManagementPage 의 PasswordSection 과 같은 결) ── */

// 자기 카드를 가지므로 위 구분선이 없다. 예전엔 '내 계정 정보' 카드 아래쪽에 얹혀 있어서
// 비밀번호 변경과 갈라 보이려면 `border-top` 이 필요했다.
const Section = styled.div``;

const Message = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  margin-bottom: 0.75rem;

  &.success {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #15803d;
  }
  &.error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c;
  }
`;

const IssuedBox = styled.div`
  border: 1px solid #fbbf24;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 1rem;
`;

const IssuedHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 0.875rem;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.8125rem;

  strong { flex: 1; }
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #92400e;
  display: flex;
  padding: 0.125rem;
  border-radius: 4px;

  &:hover { background: rgba(146, 64, 14, 0.12); }
`;

const IssuedBody = styled.div`
  padding: 0.875rem;
  background: #fffbeb;
`;

const FieldLabel = styled.div`
  font-size: 0.75rem;
  color: #475569;
  margin-bottom: 0.375rem;
  font-weight: 500;
`;

/**
 * 코드와 복사 버튼을 **세로로** 쌓는다 — 폭은 전부 코드에 준다.
 *
 * `claude mcp add …` 는 토큰까지 붙어 150자가 넘는다. 버튼을 옆에 두면 그만큼 코드 폭이
 * 줄어 줄이 잘게 쪼개진다. (예전에는 좌측 400px 패널에 들어가 있어 더 심했다. 지금은
 * 우측 카드로 나와 넓어졌지만, 긴 명령을 한눈에 보는 편이 여전히 낫다.)
 */
const CodeRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.375rem;
`;

const Code = styled.code`
  flex: 1;
  display: block;
  background: #1e293b;
  color: #e2e8f0;
  padding: 0.625rem 0.75rem;
  border-radius: 6px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.75rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  user-select: all;

  &.mono-sm { font-size: 0.6875rem; }
`;

const CopyButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.75rem;
  background: #0066cc;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;

  &:hover { background: #0052a3; }

  &.ghost {
    background: #fff;
    color: #475569;
    border: 1px solid #cbd5e1;
    &:hover { background: #f1f5f9; }
  }
`;

const IssueForm = styled.form`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 0.875rem;
  margin-bottom: 0.75rem;
`;

const FormRow = styled.div`
  display: flex;
  gap: 0.75rem;

  @media (max-width: 640px) { flex-direction: column; }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

const Input = styled.input`
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.8125rem;
  outline: none;

  &:focus { border-color: #0066cc; box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1); }
  &:disabled { background: #f1f5f9; }
`;

const Select = styled.select`
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.8125rem;
  background: #fff;
  outline: none;

  &:focus { border-color: #0066cc; }
`;

const FormActions = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
`;

const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;

  &.primary { background: #0066cc; color: #fff; &:hover { background: #0052a3; } }
  &.secondary { background: #fff; color: #475569; border-color: #cbd5e1; &:hover { background: #f1f5f9; } }
  &.danger { background: #dc2626; color: #fff; &:hover { background: #b91c1c; } }
  &.sm { padding: 0.3125rem 0.625rem; font-size: 0.75rem; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

const TokenList = styled.div`
  margin-top: 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
`;

const EmptyRow = styled.div`
  padding: 1rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.8125rem;
`;

// `flex-wrap` — 폐기 확인이 뜨면 좁은 패널에서 이름·날짜를 짓눌러 3줄로 접는다.
// 자리가 모자라면 확인 버튼이 아래 줄로 내려가게 둔다.
const TokenRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.75rem 0.875rem;
  border-bottom: 1px solid #f1f5f9;

  &:last-child { border-bottom: none; }
  &.expired { background: #fafafa; opacity: 0.75; }
`;

const TokenMain = styled.div`
  flex: 1 1 12rem;
  min-width: 0;
`;

const TokenName = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #1e293b;
`;

const ExpiredBadge = styled.span`
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 0.0625rem 0.375rem;
  border-radius: 4px;
  background: #fee2e2;
  color: #b91c1c;
`;

const TokenMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.25rem;
  font-size: 0.6875rem;
  color: #64748b;

  code {
    font-family: 'Consolas', 'Monaco', monospace;
    background: #f1f5f9;
    padding: 0.0625rem 0.25rem;
    border-radius: 3px;
  }
`;

const ConfirmGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-left: auto;
  font-size: 0.75rem;
  color: #b91c1c;
  white-space: nowrap;
`;

const IconButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #94a3b8;
  display: flex;
  padding: 0.375rem;
  border-radius: 6px;

  &:hover { background: #fef2f2; color: #dc2626; }
`;

const SkillBox = styled.div`
  margin-top: 0.75rem;
  padding: 0.875rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
`;

const SkillTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.375rem;

  svg { color: #0066cc; }
`;

const SkillOptional = styled.span`
  font-size: 0.6875rem;
  font-weight: 500;
  padding: 0.0625rem 0.375rem;
  border-radius: 4px;
  background: #e0f2fe;
  color: #0369a1;
`;

const SkillDesc = styled.p`
  margin: 0 0 0.75rem;
  font-size: 0.75rem;
  line-height: 1.6;
  color: #64748b;

  strong { color: #475569; }
`;

const SkillFoot = styled.div`
  margin-top: 0.5rem;
  font-size: 0.6875rem;
  color: #94a3b8;

  code {
    font-family: 'Consolas', 'Monaco', monospace;
    background: #f1f5f9;
    padding: 0.0625rem 0.25rem;
    border-radius: 3px;
  }
`;

const Hint = styled.p`
  margin: 0.75rem 0 0;
  font-size: 0.75rem;
  line-height: 1.6;
  color: #64748b;

  strong { color: #475569; }
`;

export default McpTokenSection;
