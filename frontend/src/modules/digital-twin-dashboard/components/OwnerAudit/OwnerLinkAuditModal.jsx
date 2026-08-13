/**
 * 과제PL·작성자 계정 연결 (설정 ▸ 관리자 구역).
 *
 * 무엇을 하나
 *     운영에 **이름만 적히고 knoxId 가 빈** 과제가 많다. 그 상태에서는
 *       · 과제PL   그 사람이 **자기 과제를 못 고친다** (`is_project_pl` 은 knoxId 로만 본다)
 *       · 작성자   화면에 **'연결 안 됨'** 으로 뜬다 (표시 전용이라 권한과는 무관)
 *     같은 사람이 여러 과제의 PL 이므로 **한 번 고치면 그 사람의 과제가 한꺼번에 풀린다** —
 *     그래서 작업 단위가 과제가 아니라 **사람**이다. (`MemberAuditModal` 과 같은 구조)
 *
 * ⚠️ **동명이인이 이 화면의 가장 큰 위험이다.** 과제PL 의 knoxId 는 곧 편집 권한이라,
 *    잘못 고르면 **엉뚱한 사람이 남의 과제를 고칠 수 있게 된다.** 그래서
 *      · 서버가 후보를 **줄이지 않고 다** 준다 (고르는 것은 사람)
 *      · 후보가 둘 이상이면 **미리 고르지 않는다**
 *      · 대상 과제를 펼쳐 **체크박스로 뺄 수 있게** 한다
 *
 * ⚠️ 이름 매칭은 **정확 일치**가 기본이고, 없을 때만 공백·직함을 지워 넓힌다(`exact=false`).
 *    넓혀서 찾은 것은 배지로 표시해 사람이 한 번 더 보게 한다.
 *
 * ⚠️ 후보가 하나도 없으면 **아직 가입 전**일 수 있다. knoxId 를 미리 넣어 두면 가입하는
 *    순간 권한이 생긴다(서버가 요청마다 대조한다) — 그건 편집창에서 직접 넣는다.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Loader2, Search, AlertTriangle, ChevronRight, ChevronDown, UserCheck, ShieldAlert,
} from 'lucide-react';
import { fetchOwnerLinkAudit, patchOwnerLinks } from '../../services/settingsApi';

const keyOf = (row) => `${row.kind}|${row.name}`;

const OwnerLinkAuditModal = ({ isOpen, onClose, onApplied, showSuccess, showError }) => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [kind, setKind] = useState('all');       // all | pl | author
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState(null);
  const [draft, setDraft] = useState({});        // key → { knoxId, excluded:Set(uuid) }
  const [applying, setApplying] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRows(await fetchOwnerLinkAudit('all'));
    } catch (err) {
      setError(err.message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (kind !== 'all' && r.kind !== kind) return false;
      if (!q) return true;
      return r.name.toLowerCase().includes(q)
        || (r.candidates || []).some((c) => (c.knoxId || '').toLowerCase().includes(q));
    });
  }, [rows, kind, query]);

  const counts = useMemo(() => ({
    all: rows.length,
    pl: rows.filter((r) => r.kind === 'pl').length,
    author: rows.filter((r) => r.kind === 'author').length,
    projects: rows.reduce((n, r) => n + r.projectCount, 0),
  }), [rows]);

  const draftOf = (row) => draft[keyOf(row)] || { knoxId: '', excluded: new Set() };

  const setKnox = (row, knoxId) => {
    const key = keyOf(row);
    setDraft((prev) => ({ ...prev, [key]: { ...draftOf(row), knoxId } }));
  };

  const toggleProject = (row, uuid) => {
    const key = keyOf(row);
    const cur = draftOf(row);
    const next = new Set(cur.excluded);
    if (next.has(uuid)) next.delete(uuid);
    else next.add(uuid);
    setDraft((prev) => ({ ...prev, [key]: { ...cur, excluded: next } }));
  };

  const apply = async (row) => {
    const key = keyOf(row);
    const cur = draftOf(row);
    const uuids = row.projects.map((p) => p.uuid).filter((u) => !cur.excluded.has(u));
    if (!cur.knoxId || uuids.length === 0) return;

    setApplying(key);
    try {
      const res = await patchOwnerLinks({
        kind: row.kind, name: row.name, knoxId: cur.knoxId, projectUuids: uuids,
      });
      showSuccess?.(`${row.kindLabel} "${row.name}" — ${res.updatedCount}개 과제를 `
        + `${cur.knoxId} 계정과 연결했습니다.`
        + (res.skippedCount ? ` (건너뜀 ${res.skippedCount}건)` : ''));
      setOpenKey(null);
      setDraft((prev) => { const n = { ...prev }; delete n[key]; return n; });
      await load();
      // 목록·편집창이 낡은 값을 들고 있으므로 바깥에 알린다
      onApplied?.();
    } catch (err) {
      showError?.(err.message || '계정 연결에 실패했습니다.');
    } finally {
      setApplying(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <Overlay onClick={onClose}>
        <Panel
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
        >
          <Header>
            <h3><UserCheck size={18} /> 과제PL · 작성자 계정 연결</h3>
            <IconBtn type="button" onClick={onClose}><X size={18} /></IconBtn>
          </Header>

          <Lead>
            이름만 적혀 있고 <strong>계정이 안 붙은</strong> 과제입니다.
            과제PL 은 계정이 붙어야 <strong>본인이 자기 과제를 고칠 수 있습니다.</strong>
          </Lead>

          <Toolbar>
            <Tabs>
              {[['all', `전체 ${counts.all}`],
                ['pl', `과제PL ${counts.pl}`],
                ['author', `작성자 ${counts.author}`]].map(([id, label]) => (
                <Tab key={id} type="button" $on={kind === id} onClick={() => setKind(id)}>
                  {label}
                </Tab>
              ))}
            </Tabs>
            <SearchBox>
              <Search size={14} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름 · knoxId 검색"
              />
            </SearchBox>
          </Toolbar>

          <Body>
            {isLoading && <State><Loader2 size={16} /> 불러오는 중…</State>}
            {error && <State $error><AlertTriangle size={16} /> {error}</State>}

            {!isLoading && !error && shown.length === 0 && (
              <State>연결할 것이 없습니다. 모두 계정이 붙어 있습니다.</State>
            )}

            {!isLoading && !error && shown.map((row) => {
              const key = keyOf(row);
              const open = openKey === key;
              const cur = draftOf(row);
              const targetCount = row.projects.filter((p) => !cur.excluded.has(p.uuid)).length;
              const many = (row.candidates || []).length > 1;

              return (
                <Card key={key} $open={open}>
                  <CardHead onClick={() => setOpenKey(open ? null : key)}>
                    {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    <KindTag $pl={row.kind === 'pl'}>{row.kindLabel}</KindTag>
                    <Name>{row.name}</Name>
                    <Count>과제 {row.projectCount}개</Count>
                    {many && <Warn><AlertTriangle size={12} />동명이인 {row.candidates.length}명</Warn>}
                    {!row.candidates?.length && <Muted>계정 없음</Muted>}
                    {row.candidates?.length > 0 && !row.exact && (
                      <Muted title="이름 표기가 달라 공백·직함을 지워 찾았습니다">표기 다름</Muted>
                    )}
                  </CardHead>

                  {open && (
                    <CardBody>
                      {row.kind === 'pl' && (
                        <Danger>
                          <ShieldAlert size={13} />
                          과제PL 로 연결하면 <strong>그 계정이 이 과제들을 수정할 수 있게 됩니다.</strong>
                        </Danger>
                      )}

                      {(row.candidates || []).length === 0 ? (
                        <Empty>
                          이 이름으로 가입한 계정이 없습니다. 아직 가입 전이거나 표기가 다를 수
                          있습니다 — knoxId 를 미리 넣어 두려면 <strong>편집창</strong>에서 넣으세요
                          (가입하는 순간 권한이 생깁니다).
                        </Empty>
                      ) : (
                        <>
                          <SubLabel>계정 고르기</SubLabel>
                          <Cands>
                            {row.candidates.map((c) => (
                              <Cand
                                key={c.knoxId || c.이름}
                                type="button"
                                $on={cur.knoxId === c.knoxId}
                                disabled={!c.knoxId}
                                title={c.knoxId ? '' : '이 계정에는 사내 이메일이 없어 연결할 수 없습니다'}
                                onClick={() => setKnox(row, c.knoxId)}
                              >
                                <b>{c.knoxId || '(knoxId 없음)'}</b>
                                <span>{c.이름} · {c.부서 || '부서 미상'}</span>
                              </Cand>
                            ))}
                          </Cands>
                        </>
                      )}

                      <SubLabel>
                        대상 과제 <em>({targetCount}/{row.projectCount}개 — 체크를 풀면 제외)</em>
                      </SubLabel>
                      <Projects>
                        {row.projects.map((p) => (
                          <label key={p.uuid}>
                            <input
                              type="checkbox"
                              checked={!cur.excluded.has(p.uuid)}
                              onChange={() => toggleProject(row, p.uuid)}
                            />
                            <code>{p.code}</code>
                            <span>{p.title}</span>
                          </label>
                        ))}
                      </Projects>

                      <Actions>
                        <ApplyBtn
                          type="button"
                          disabled={!cur.knoxId || targetCount === 0 || applying === key}
                          onClick={() => apply(row)}
                        >
                          {applying === key
                            ? <><Loader2 size={14} /> 연결하는 중…</>
                            : <>{targetCount}개 과제에 연결</>}
                        </ApplyBtn>
                        {!cur.knoxId && <Hint>계정을 먼저 고르세요.</Hint>}
                      </Actions>
                    </CardBody>
                  )}
                </Card>
              );
            })}
          </Body>

          <Footer>
            <FootNote>
              미연결 {counts.all}명 · 과제 {counts.projects}개
            </FootNote>
            <GhostBtn type="button" onClick={onClose}>닫기</GhostBtn>
          </Footer>
        </Panel>
      </Overlay>
    </AnimatePresence>
  );
};

/* ── 스타일 ── */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2600;
  padding: 1rem;
`;

const Panel = styled(motion.div)`
  background: #fff;
  border-radius: 1rem;
  width: 100%;
  max-width: 820px;
  max-height: calc(100vh - 3rem);
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #0f766e 0%, #115e59 100%);
  color: #fff;

  h3 {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
`;

const IconBtn = styled.button`
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #fff;
  width: 2rem;
  height: 2rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover { background: rgba(255, 255, 255, 0.32); }
`;

const Lead = styled.p`
  margin: 0;
  padding: 0.75rem 1.25rem 0;
  font-size: 0.8125rem;
  color: #475569;
  line-height: 1.6;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  padding: 0.75rem 1.25rem;
`;

const Tabs = styled.div`
  display: flex;
  gap: 0.25rem;
`;

const Tab = styled.button`
  padding: 0.3125rem 0.75rem;
  border: 1px solid ${(p) => (p.$on ? '#0f766e' : '#cbd5e1')};
  background: ${(p) => (p.$on ? '#0f766e' : '#fff')};
  color: ${(p) => (p.$on ? '#fff' : '#475569')};
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
`;

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex: 1;
  min-width: 180px;
  padding: 0.3125rem 0.625rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  color: #94a3b8;

  input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 0.8125rem;
    font-family: inherit;
    color: #0f172a;
  }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0 1.25rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const State = styled.div`
  /* 이것도 Body 의 flex 항목이다. 안 박아 두면 같은 이유로 눌린다. */
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 1.25rem;
  justify-content: center;
  font-size: 0.8125rem;
  color: ${(p) => (p.$error ? '#b91c1c' : '#64748b')};

  svg { animation: ${(p) => (p.$error ? 'none' : 'spin 1s linear infinite')}; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const Card = styled.div`
  /* 🐞 **줄어들지 않게 못 박는다.** 부모(Body)가 세로 flex 인데, 이 카드에
     overflow: hidden 이 걸려 있으면 flex 항목의 자동 최소 크기가 **0 이 된다**
     (Flexbox 명세 §4.5 — min-height: auto 는 overflow 가 visible 일 때만 내용
     크기로 풀린다). 그러면 카드 수가 많아 높이를 넘기는 순간 스크롤이 생기는 대신
     **전부 납작하게 눌려** 목록이 안 보인다.

     개발서버는 연결 대상이 0명이라 끝까지 안 드러났다 — 운영에서 224명이 뜨자
     그제야 터졌다. (2026-08-09) */
  flex-shrink: 0;
  border: 1px solid ${(p) => (p.$open ? '#5eead4' : '#e5e7eb')};
  border-radius: 0.625rem;
  background: ${(p) => (p.$open ? '#f0fdfa' : '#fff')};
  overflow: hidden;
`;

const CardHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-size: 0.8125rem;

  &:hover { background: #f8fafc; }
`;

const KindTag = styled.span`
  font-size: 0.625rem;
  font-weight: 700;
  padding: 0.0625rem 0.375rem;
  border-radius: 0.25rem;
  color: ${(p) => (p.$pl ? '#9a3412' : '#1e40af')};
  background: ${(p) => (p.$pl ? '#ffedd5' : '#dbeafe')};
`;

const Name = styled.strong`
  font-weight: 700;
  color: #0f172a;
`;

const Count = styled.span`
  font-size: 0.75rem;
  color: #64748b;
`;

const Warn = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  margin-left: auto;
  font-size: 0.6875rem;
  font-weight: 600;
  color: #b45309;
`;

const Muted = styled.span`
  margin-left: auto;
  font-size: 0.6875rem;
  color: #94a3b8;
`;

const CardBody = styled.div`
  padding: 0.25rem 0.875rem 0.875rem;
  border-top: 1px dashed #99f6e4;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Danger = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  margin-top: 0.5rem;
  padding: 0.4375rem 0.625rem;
  border-radius: 0.375rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 0.75rem;
  line-height: 1.5;

  svg { flex-shrink: 0; margin-top: 1px; }
`;

const Empty = styled.div`
  padding: 0.5rem 0.625rem;
  border-radius: 0.375rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  color: #92400e;
  font-size: 0.75rem;
  line-height: 1.6;
`;

const SubLabel = styled.div`
  font-size: 0.6875rem;
  font-weight: 700;
  color: #475569;
  margin-top: 0.25rem;

  em { font-style: normal; font-weight: 500; color: #94a3b8; }
`;

const Cands = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
`;

const Cand = styled.button`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.0625rem;
  padding: 0.3125rem 0.625rem;
  border: 1px solid ${(p) => (p.$on ? '#0f766e' : '#cbd5e1')};
  background: ${(p) => (p.$on ? '#0f766e' : '#fff')};
  color: ${(p) => (p.$on ? '#fff' : '#334155')};
  border-radius: 0.5rem;
  cursor: pointer;
  text-align: left;

  b { font-size: 0.75rem; }
  span { font-size: 0.6875rem; opacity: 0.85; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const Projects = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  max-height: 11rem;
  overflow-y: auto;
  padding: 0.375rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: #fff;

  label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: #334155;
    cursor: pointer;
  }
  input { accent-color: #0f766e; }
  code {
    font-family: 'Consolas', monospace;
    font-size: 0.6875rem;
    color: #0f766e;
    background: #f0fdfa;
    padding: 0 0.25rem;
    border-radius: 0.1875rem;
    white-space: nowrap;
  }
  span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
`;

const ApplyBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.4375rem 0.875rem;
  border: none;
  border-radius: 0.5rem;
  background: #0f766e;
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) { background: #115e59; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }

  svg { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const Hint = styled.span`
  font-size: 0.6875rem;
  color: #94a3b8;
`;

const Footer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
`;

const FootNote = styled.span`
  font-size: 0.75rem;
  color: #64748b;
`;

const GhostBtn = styled.button`
  padding: 0.5rem 1rem;
  border: 1px solid #d1d5db;
  border-radius: 0.5rem;
  background: #fff;
  color: #4b5563;
  font-size: 0.875rem;
  cursor: pointer;

  &:hover { background: #f3f4f6; }
`;

export default OwnerLinkAuditModal;
