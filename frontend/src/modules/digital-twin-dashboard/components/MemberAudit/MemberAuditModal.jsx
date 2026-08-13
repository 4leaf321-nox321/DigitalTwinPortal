/**
 * 참여인력 계정 점검 (설정 ▸ 관리자 구역).
 *
 * 무엇을 하나
 *     컷오버 후 참여인력의 knoxId 는 곧 **편집 권한**이다(`is_project_member`가 요청마다
 *     대조한다). 운영 실측에서 고유 knoxId 282개 중 131개가 계정과 안 맞았다.
 *     같은 사람이 여러 과제에 참여하므로 **한 번 고치면 그 사람이 낀 모든 과제가 풀린다** —
 *     그래서 작업 단위가 과제가 아니라 **사람**이다.
 *
 * ⚠️ SSO 가 없어 **본인이 직접 가입**해야 한다. 다만 knoxId 는 사내 이메일 @앞부분이라
 *    **가입 전에도 미리 채워둘 수 있고**, 그러면 가입하는 순간 권한이 생긴다.
 *    그래서 '가입 대기'는 손댈 것이 아니다 — 손댈 것은 **knoxId 가 비었거나 틀린** 경우뿐.
 *
 * ⚠️ **동명이인이 이 화면의 가장 큰 위험이다.** 이름만으로 묶으면 엉뚱한 사람 과제까지
 *    바뀌어 **잘못된 사람에게 편집 권한이 간다.** 그래서 (이름+부서)로 묶고, 같은 이름이
 *    다른 묶음에도 있으면 경고하며, **대상 과제를 펼쳐 체크박스로 고르게** 한다.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Loader2, Search, BadgeCheck, AlertTriangle, Clock, ChevronRight, ChevronDown,
} from 'lucide-react';
import { fetchMemberAudit, patchMemberKnox, searchUsers } from '../../services/settingsApi';

const keyOf = (row) => `${row.name}|${row.dept}`;

/** 배지 상태 — 편집창 참여인력 배지와 같은 기준이어야 한다. */
const statusOf = (row) => {
  if (row.matched && row.via === 'knoxId') return 'ok';
  // ⚠️ 2026-08-11 서버가 이름 매칭을 버렸다 → 이 갈래는 `matched === false` 다.
  //    그래도 어느 계정인지는 알려주므로(`via === 'name'`) 채워 넣을 값이 있다.
  if (row.via === 'name') return 'name';
  if (!row.knoxIds || row.knoxIds.length === 0) return 'empty';
  return 'wait';                                            // 미가입이거나 표기 오류
};

const STATUS_META = {
  ok:    { label: '연결됨',     tone: 'ok',   Icon: BadgeCheck },
  name:  { label: 'knoxId 필요', tone: 'warn', Icon: AlertTriangle },
  empty: { label: 'knoxId 없음', tone: 'warn', Icon: AlertTriangle },
  wait:  { label: '가입 대기',   tone: 'wait', Icon: Clock },
};

const MemberAuditModal = ({ isOpen, onClose, onApplied, showSuccess, showError }) => {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [onlyTodo, setOnlyTodo] = useState(true);
  const [query, setQuery] = useState('');
  const [openKey, setOpenKey] = useState(null);
  const [draft, setDraft] = useState({});        // key → { knoxId, excluded:Set(uuid) }
  const [applying, setApplying] = useState(null);
  const [suggest, setSuggest] = useState([]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRows(await fetchMemberAudit());
    } catch (err) {
      setError(err.message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  // 같은 이름이 몇 개 묶음에 걸쳐 있나 — 동명이인 경고에 쓴다
  const nameSpread = useMemo(() => {
    const map = {};
    rows.forEach(r => { map[r.name] = (map[r.name] || 0) + 1; });
    return map;
  }, [rows]);

  const summary = useMemo(() => {
    const c = { ok: 0, name: 0, empty: 0, wait: 0 };
    rows.forEach(r => { c[statusOf(r)] += 1; });
    return c;
  }, [rows]);

  const visible = rows.filter(r => {
    // '손댈 것' = knoxId 로 제대로 연결된 것 **말고** 전부.
    // '가입 대기' 도 표기 오류일 수 있어 포함한다 — 서버는 둘을 구분할 수 없다.
    if (onlyTodo && statusOf(r) === 'ok') return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (r.name || '').toLowerCase().includes(q)
      || (r.dept || '').toLowerCase().includes(q)
      || (r.knoxIds || []).some(k => (k || '').toLowerCase().includes(q));
  });

  const draftOf = (key) => draft[key] || { knoxId: '', excluded: new Set() };
  const setDraftOf = (key, patch) =>
    setDraft(prev => ({ ...prev, [key]: { ...draftOf(key), ...patch } }));

  const toggleProject = (key, uuid) => {
    const cur = draftOf(key);
    const next = new Set(cur.excluded);
    if (next.has(uuid)) next.delete(uuid); else next.add(uuid);
    setDraftOf(key, { excluded: next });
  };

  const runSearch = async (text) => {
    if (!text || text.trim().length < 1) { setSuggest([]); return; }
    try {
      setSuggest(await searchUsers(text.trim()));
    } catch {
      setSuggest([]);   // 검색 실패는 조용히 — 직접 입력 경로가 살아 있다
    }
  };

  const apply = async (row) => {
    const key = keyOf(row);
    const d = draftOf(key);
    const knoxId = (d.knoxId || '').trim();
    if (!knoxId) {
      showError && showError('새 knoxId 를 입력하거나 사용자를 검색해 고르세요.');
      return;
    }
    const targets = (row.projects || [])
      .filter(p => !d.excluded.has(p.uuid))
      .map(p => p.uuid);
    if (targets.length === 0) {
      showError && showError('적용할 과제를 하나 이상 선택하세요.');
      return;
    }

    setApplying(key);
    try {
      const result = await patchMemberKnox({
        name: row.name, dept: row.dept, knoxId,
        // 지금 값이 이것인 원소만 바꾼다. 빈 값도 대상이므로 '' 를 함께 보낸다.
        matchKnoxIds: [...(row.knoxIds || []), ''],
        projectUuids: targets,
      });
      showSuccess && showSuccess(
        `${row.name || '(이름 없음)'} — 과제 ${result.updated}건에 반영했습니다.`
      );
      setOpenKey(null);
      setDraft(prev => { const n = { ...prev }; delete n[key]; return n; });
      await load();
      // 화면의 과제 목록에는 옛 knoxId 가 남아 있다 — 앱이 서버 데이터를 다시 받게 한다
      onApplied && onApplied();
    } catch (err) {
      showError && showError(`일괄 수정 실패: ${err.message}`);
    } finally {
      setApplying(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <Overlay onClick={onClose}>
        <Container
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
        >
          <Head>
            <div>
              <h3>참여인력 계정 점검</h3>
              <Sub>
                참여인력의 knoxId 가 계정과 연결돼야 <strong>본인이 자기 과제를 수정</strong>할 수
                있습니다. knoxId 는 사내 이메일 @앞부분이라 <strong>가입 전에도 미리 채워둘 수
                있고</strong>, 그러면 가입하는 순간 권한이 생깁니다.
              </Sub>
            </div>
            <CloseButton type="button" onClick={onClose}><X size={20} /></CloseButton>
          </Head>

          <Toolbar>
            <Counts>
              전체 {rows.length}명
              <Chip $tone="ok">연결됨 {summary.ok}</Chip>
              <Chip $tone="warn">knoxId 필요 {summary.name}</Chip>
              <Chip $tone="warn">knoxId 없음 {summary.empty}</Chip>
              <Chip $tone="wait">가입 대기 {summary.wait}</Chip>
            </Counts>
            <Filters>
              <label>
                <input type="checkbox" checked={onlyTodo}
                       onChange={(e) => setOnlyTodo(e.target.checked)} />
                손댈 것만 보기
              </label>
              <SearchBox>
                <Search size={14} />
                <input value={query} onChange={(e) => setQuery(e.target.value)}
                       placeholder="이름·부서·knoxId 검색" />
              </SearchBox>
            </Filters>
          </Toolbar>

          <Body>
            {isLoading ? (
              <Empty><Loader2 size={32} className="spin" /><p>불러오는 중…</p></Empty>
            ) : error ? (
              <Empty>
                <AlertTriangle size={32} />
                <p>불러오지 못했습니다.</p>
                <ErrText>{error}</ErrText>
                <SmallButton type="button" onClick={load}>다시 시도</SmallButton>
              </Empty>
            ) : visible.length === 0 ? (
              <Empty>
                <BadgeCheck size={32} />
                <p>{onlyTodo ? '손댈 것이 없습니다.' : '표시할 참여인력이 없습니다.'}</p>
              </Empty>
            ) : visible.map(row => {
              const key = keyOf(row);
              const st = statusOf(row);
              const meta = STATUS_META[st];
              const { Icon } = meta;
              const open = openKey === key;
              const d = draftOf(key);
              const dup = (nameSpread[row.name] || 0) > 1;

              return (
                <Card key={key} $open={open}>
                  <CardHead type="button" onClick={() => setOpenKey(open ? null : key)}>
                    {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    <Name>{row.name || <Muted>(이름 없음)</Muted>}</Name>
                    <Dept>{row.dept || <Muted>(부서 없음)</Muted>}</Dept>
                    <Knox>{(row.knoxIds || []).join(', ') || <Muted>(없음)</Muted>}</Knox>
                    <Chip $tone={meta.tone}><Icon size={11} />{meta.label}</Chip>
                    <Count>{row.projectCount}건</Count>
                  </CardHead>

                  {open && (
                    <CardBody>
                      {dup && (
                        <Warn>
                          <AlertTriangle size={14} />
                          같은 이름이 <strong>다른 부서에도 {nameSpread[row.name] - 1}곳</strong>{' '}
                          있습니다. 동명이인일 수 있으니 <strong>아래 과제 목록을 확인</strong>하세요.
                        </Warn>
                      )}
                      {st === 'name' && (
                        <Warn>
                          <AlertTriangle size={14} />
                          이름은 <strong>{row.userName}</strong> 계정과 같지만 knoxId 가 없어
                          <strong>이 사람은 자기 과제를 수정할 수 없습니다.</strong>
                          아래에서 knoxId 를 채우면 바로 열립니다.
                        </Warn>
                      )}

                      <Field>
                        <label>새 knoxId</label>
                        <InputWrap>
                          <input
                            value={d.knoxId}
                            placeholder="가입자는 이름으로 검색, 미가입자는 직접 입력"
                            onChange={(e) => { setDraftOf(key, { knoxId: e.target.value }); }}
                          />
                          <SmallButton type="button" onClick={() => runSearch(d.knoxId || row.name)}>
                            <Search size={13} /> 사용자 검색
                          </SmallButton>
                        </InputWrap>
                        {suggest.length > 0 && (
                          <Suggest>
                            {suggest.map(u => (
                              <li key={u.id}>
                                <button type="button" onClick={() => {
                                  const local = u.email ? u.email.split('@')[0] : '';
                                  setDraftOf(key, { knoxId: local });
                                  setSuggest([]);
                                }}>
                                  {u.name} <Muted>{u.email}</Muted>
                                  {u.department && <Muted> · {u.department}</Muted>}
                                </button>
                              </li>
                            ))}
                          </Suggest>
                        )}
                      </Field>

                      <Field>
                        <label>
                          적용할 과제 ({row.projects.length - d.excluded.size}/{row.projects.length})
                        </label>
                        <ProjectList>
                          {row.projects.map(p => (
                            <li key={p.uuid}>
                              <label>
                                <input type="checkbox"
                                       checked={!d.excluded.has(p.uuid)}
                                       onChange={() => toggleProject(key, p.uuid)} />
                                <code>{p.code || '(코드없음)'}</code> {p.title}
                              </label>
                            </li>
                          ))}
                        </ProjectList>
                      </Field>

                      <Actions>
                        <PrimaryButton type="button"
                                       disabled={applying === key}
                                       onClick={() => apply(row)}>
                          {applying === key
                            ? '적용 중…'
                            : `${row.projects.length - d.excluded.size}건에 적용`}
                        </PrimaryButton>
                      </Actions>
                    </CardBody>
                  )}
                </Card>
              );
            })}
          </Body>
        </Container>
      </Overlay>
    </AnimatePresence>
  );
};

export default MemberAuditModal;

const TONE = {
  ok:   { bg: '#ecfdf5', fg: '#047857', bd: '#a7f3d0' },
  warn: { bg: '#fffbeb', fg: '#b45309', bd: '#fde68a' },
  wait: { bg: '#f3f4f6', fg: '#4b5563', bd: '#e5e7eb' },
};

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background: rgba(0, 0, 0, 0.45);
`;

const Container = styled(motion.div)`
  display: flex;
  flex-direction: column;
  width: min(960px, 100%);
  max-height: 100%;
  border-radius: 0.75rem;
  background: white;
  overflow: hidden;
`;

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.5rem 1rem;
  border-bottom: 1px solid #e5e7eb;

  h3 { margin: 0 0 0.375rem; font-size: 1.0625rem; color: #111827; }
`;

const Sub = styled.p`
  margin: 0;
  max-width: 62ch;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: #6b7280;
`;

const CloseButton = styled.button`
  flex: 0 0 auto;
  border: none;
  background: none;
  color: #6b7280;
  cursor: pointer;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid #f3f4f6;
  background: #fafafa;
`;

const Counts = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: #374151;
`;

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  padding: 0.0625rem 0.4375rem;
  border: 1px solid ${p => TONE[p.$tone].bd};
  border-radius: 0.25rem;
  background: ${p => TONE[p.$tone].bg};
  color: ${p => TONE[p.$tone].fg};
  font-size: 0.6875rem;
  font-weight: 600;
  white-space: nowrap;
`;

const Filters = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8125rem;
  color: #374151;

  label { display: inline-flex; align-items: center; gap: 0.3125rem; cursor: pointer; }
`;

const SearchBox = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.3125rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  color: #9ca3af;

  input { border: none; outline: none; font-size: 0.8125rem; width: 12rem; color: #374151; }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.5rem 1.5rem;
`;

const Card = styled.div`
  margin-bottom: 0.5rem;
  border: 1px solid ${p => (p.$open ? '#c7d2fe' : '#e5e7eb')};
  border-radius: 0.5rem;
  overflow: hidden;
`;

const CardHead = styled.button`
  display: grid;
  grid-template-columns: 1rem 9rem 10rem 1fr auto auto;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.625rem 0.75rem;
  border: none;
  background: white;
  text-align: left;
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover { background: #f9fafb; }
`;

const Name = styled.span` color: #111827; font-weight: 600; `;
const Dept = styled.span` color: #6b7280; `;
const Knox = styled.span` color: #4b5563; font-family: monospace; word-break: break-all; `;
const Count = styled.span` color: #9ca3af; white-space: nowrap; `;
const Muted = styled.span` color: #9ca3af; `;

const CardBody = styled.div`
  padding: 0.875rem 0.75rem 1rem 2.25rem;
  border-top: 1px solid #f3f4f6;
  background: #fcfcfd;
`;

const Warn = styled.p`
  display: flex;
  align-items: flex-start;
  gap: 0.375rem;
  margin: 0 0 0.75rem;
  padding: 0.5rem 0.625rem;
  border: 1px solid #fde68a;
  border-radius: 0.375rem;
  background: #fffbeb;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: #92400e;
`;

const Field = styled.div`
  margin-bottom: 0.875rem;

  > label {
    display: block;
    margin-bottom: 0.3125rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #6b7280;
  }
`;

const InputWrap = styled.div`
  display: flex;
  gap: 0.375rem;

  input {
    flex: 1;
    padding: 0.375rem 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
  }
`;

const Suggest = styled.ul`
  margin: 0.375rem 0 0;
  padding: 0;
  list-style: none;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  background: white;
  max-height: 12rem;
  overflow-y: auto;

  button {
    display: block;
    width: 100%;
    padding: 0.375rem 0.625rem;
    border: none;
    background: none;
    text-align: left;
    font-size: 0.8125rem;
    color: #374151;
    cursor: pointer;

    &:hover { background: #f3f4f6; }
  }
`;

const ProjectList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  max-height: 14rem;
  overflow-y: auto;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  background: white;

  li + li { border-top: 1px solid #f3f4f6; }

  label {
    display: flex;
    align-items: center;
    gap: 0.4375rem;
    padding: 0.3125rem 0.625rem;
    font-size: 0.8125rem;
    color: #374151;
    cursor: pointer;
  }

  code {
    padding: 0 0.25rem;
    border-radius: 0.1875rem;
    background: #f3f4f6;
    color: #4b5563;
  }
`;

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const PrimaryButton = styled.button`
  padding: 0.375rem 0.875rem;
  border: none;
  border-radius: 0.375rem;
  background: #2563eb;
  color: white;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;

  &:disabled { background: #9ca3af; cursor: default; }
`;

const SmallButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.625rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  color: #374151;
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover { background: #f9fafb; }
`;

const Empty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 3rem 1rem;
  color: #9ca3af;

  p { margin: 0; font-size: 0.875rem; }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const ErrText = styled.span` font-size: 0.75rem; color: #ef4444; `;
