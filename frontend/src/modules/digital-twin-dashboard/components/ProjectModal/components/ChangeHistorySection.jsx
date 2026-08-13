/**
 * 과제 1건의 변경 이력 (편집창 '변경 이력' 탭).
 *
 * 서버(`GET /dt-v2/projects/<uuid>/changes`)는 **행 하나 = 필드 하나**로 준다.
 * 저장 한 번이 여러 행이 되므로, 같은 `rowVersion` 끼리 **묶어서 저장 1건 = 카드 1개**로
 * 보여준다. 안 묶으면 과제명·진행률·상태를 한 번에 고친 것이 세 줄로 흩어져 읽기 어렵다.
 *
 * 값 표시 규칙은 활동로그 화면과 **공용**이다(`utils/changeFormat.js`) — 배열은 원소 단위로,
 * 긴 값은 줄이고 원문은 툴팁으로.
 */
import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Clock, User, Loader2, Bot, Terminal, Upload, Wand2 } from 'lucide-react';
import { fetchProjectChangesV2, fetchProjectHistoryV2 } from '../../../services/settingsApi';
import { toChangeEntry, isHiddenField } from '../../../utils/changeFormat';

// 서버가 적는 값 (`Dt2ProjectChange.source`). AI 가 쓰기 시작하면 이 구분이 핵심이 된다.
//
// `ai` 와 `ai_fill` 은 **다른 일이다.**
//   ai       에이전트가 **스스로** 고쳤다 (확인 절차 202 를 거친 값)
//   ai_fill  AI 가 편집창의 칸을 채워 주고 **사람이 보고 저장했다**
// 되짚을 때 성격이 다르므로 갈라 둔다. 배지 색은 같은 보라 계열이되 글자로 구분한다.
const SOURCE_META = {
  ui: { label: '사용자', color: '#3b82f6', Icon: User },
  ai: { label: 'AI', color: '#8b5cf6', Icon: Bot },
  ai_fill: { label: 'AI 도움', color: '#a855f7', Icon: Wand2 },
  script: { label: '스크립트', color: '#6b7280', Icon: Terminal },
  import: { label: '이관', color: '#0ea5e9', Icon: Upload },
};

const formatWhen = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
       + `${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** 같은 저장(= 같은 rowVersion)끼리 묶는다. 서버가 이미 최신순으로 준다. */
const groupBySave = (rows) => {
  const groups = [];
  const index = new Map();
  for (const row of rows) {
    const key = row.rowVersion;
    if (!index.has(key)) {
      const group = {
        rowVersion: key,
        changedAt: row.changedAt,
        actor: row.actor,
        onBehalfOf: row.onBehalfOf,
        source: row.source,
        reason: row.reason,
        entries: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    const group = index.get(key);
    // 한 저장 안에서 사유가 붙은 행이 있으면 대표로 올린다 (AI 는 대개 한 번만 적는다)
    if (!group.reason && row.reason) group.reason = row.reason;
    // 칸마다 출처를 들고 간다 — **한 저장 안에 출처가 섞인다.**
    // AI 도우미가 채운 칸과 사람이 직접 친 칸이 같은 저장에 함께 실리기 때문에,
    // 저장 단위로 하나만 표시하면 둘 중 하나는 거짓이 된다.
    group.entries.push({
      ...toChangeEntry(row.fieldLabel || row.field, row.before, row.after),
      source: row.source,
    });
  }
  // 저장 머리의 배지는 **가장 많이 나온 출처**로 정한다(대표값). 칸마다 다른 것은
  // 아래 줄에서 각자 배지를 단다.
  groups.forEach(g => {
    const count = {};
    g.entries.forEach(e => { count[e.source] = (count[e.source] || 0) + 1; });
    const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
    if (top) g.source = top[0];
    g.mixed = Object.keys(count).length > 1;
  });
  return groups;
};

/**
 * 바뀐 칸만 강조한다. `changedFields` 는 **컬럼명** 배열이다
 * (`status`·`progress`·`action_total`… — 파생 지표라 field_maps 와 무관하다).
 */
const didChange = (row, ...cols) =>
  cols.some(c => (row.changedFields || []).includes(c));

const monthRange = (row) => {
  // ⚠️ 월 번호(1~12)다. 날짜가 아니다.
  const s = row.startMonth == null ? '?' : `${row.startMonth}월`;
  const e = row.endMonth == null ? '?' : `${row.endMonth}월`;
  return `${s} ~ ${e}`;
};

const ChangeHistorySection = ({ projectUuid }) => {
  const [view, setView] = useState('metrics');   // metrics | changes
  const [rows, setRows] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fieldFilter, setFieldFilter] = useState('ALL');

  const load = useCallback(async () => {
    if (!projectUuid) return;
    setIsLoading(true);
    setError(null);
    try {
      // 둘 다 한 번에 받는다 — 토글할 때마다 다시 부르면 깜빡인다
      const [changes, hist] = await Promise.all([
        fetchProjectChangesV2(projectUuid),
        fetchProjectHistoryV2(projectUuid),
      ]);
      // 서버가 만드는 사본(담당자·관리자 등)은 **여기서 걷어낸다.** 화면에 없는
      // 칸이 바뀌었다고 나오면 읽는 사람이 헷갈린다 — 이유는 changeFormat.js 참조.
      // 걸러 낸 뒤에 묶으므로, 사본만 들어 있던 저장은 카드 자체가 안 생긴다.
      setRows(changes.filter(r => !isHiddenField(r.field, r.fieldLabel)));
      setHistory(hist);
    } catch (err) {
      setError(err.message);
      setRows([]);
      setHistory([]);
    } finally {
      setIsLoading(false);
    }
  }, [projectUuid]);

  useEffect(() => { load(); }, [load]);

  // 필터 목록은 **실제로 나온 필드**로 만든다 — 고정 목록을 두면 서버에 필드가 늘 때 갈린다
  const fields = [...new Set(rows.map(r => r.fieldLabel || r.field))].sort();
  const visible = fieldFilter === 'ALL'
    ? rows
    : rows.filter(r => (r.fieldLabel || r.field) === fieldFilter);
  const groups = groupBySave(visible);

  if (isLoading) {
    return (
      <Empty><Loader2 size={32} className="spin" /><p>변경 이력을 불러오는 중…</p></Empty>
    );
  }

  if (error) {
    return (
      <Empty>
        <Clock size={32} />
        <p>변경 이력을 불러오지 못했습니다.</p>
        <ErrorText>{error}</ErrorText>
        <RetryButton type="button" onClick={load}>다시 시도</RetryButton>
      </Empty>
    );
  }

  return (
    <Wrap>
      <Tabs>
        <TabButton type="button" $on={view === 'metrics'} onClick={() => setView('metrics')}>
          지표 추이
        </TabButton>
        <TabButton type="button" $on={view === 'changes'} onClick={() => setView('changes')}>
          변경 내역
        </TabButton>
      </Tabs>

      {view === 'metrics' ? (
        <MetricsView history={history} />
      ) : (
        <ChangesView
          rows={rows} groups={groups} fields={fields}
          fieldFilter={fieldFilter} setFieldFilter={setFieldFilter}
        />
      )}
    </Wrap>
  );
};

/**
 * 지표 추이 — **그 시점의 값**을 그대로 보여준다.
 *
 * 화면 다른 곳의 진척률은 액션아이템 완료 비율로 매번 다시 계산되어 **소급 변경된다**
 * (액션아이템을 추가하면 분모가 바뀌어 과거 숫자도 달라진다). 이 표는 그때 기록된
 * 분자·분모라 안 바뀐다 — **두 값이 다른 것이 정상이고, 그 차이가 정보다.**
 */
const MetricsView = ({ history }) => {
  if (history.length === 0) {
    return (
      <Empty>
        <Clock size={32} />
        <p>아직 기록된 지표 변화가 없습니다.</p>
        <Hint>진행률·진행상태·액션아이템·이슈·기간이 바뀔 때마다 한 줄씩 쌓입니다.</Hint>
      </Empty>
    );
  }

  return (
    <>
      <Note>
        각 줄은 <strong>그 시점에 기록된 값</strong>입니다. 목록·대시보드의 진척률은 지금
        데이터로 다시 계산한 값이라 <strong>다를 수 있고, 다른 것이 정상</strong>입니다 —
        액션아이템이 늘면 분모가 바뀌어 과거 숫자까지 달라지기 때문입니다.
        <br />
        <strong>2026-07-29</strong>부터 수집했고 그 이전 기간은 없습니다.
      </Note>
      <Table>
        <thead>
          <tr>
            <Th>시점</Th><Th>진행상태</Th><Th>진행률</Th>
            <Th>액션아이템</Th><Th>이슈</Th><Th>기간</Th>
          </tr>
        </thead>
        <tbody>
          {history.map((row, i) => (
            <tr key={`${row.observedAt}-${i}`}>
              <Td>
                {formatWhen(row.observedAt)}
                {row.changeKind === 'seed' && <Seed>최초</Seed>}
              </Td>
              <Td $hi={didChange(row, 'status')}>{row.status || '-'}</Td>
              <Td $hi={didChange(row, 'progress')}>
                {row.progress == null ? '-' : `${row.progress}%`}
              </Td>
              <Td $hi={didChange(row, 'action_total', 'action_done')}>
                {row.actionTotal == null ? '-' : `${row.actionDone ?? 0}/${row.actionTotal}`}
              </Td>
              <Td $hi={didChange(row, 'issue_total', 'issue_open')}>
                {row.issueTotal == null ? '-' : `${row.issueOpen ?? 0}/${row.issueTotal}`}
              </Td>
              <Td $hi={didChange(row, 'start_month', 'end_month')}>{monthRange(row)}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Legend>
        진하게 표시된 칸이 <strong>직전 기록에서 바뀐 값</strong>입니다.
        액션아이템은 <code>완료/전체</code>, 이슈는 <code>미해결/전체</code>.
        기간은 <strong>월 번호</strong>입니다.
      </Legend>
    </>
  );
};

const ChangesView = ({ rows, groups, fields, fieldFilter, setFieldFilter }) => {
  return (
    <>
      <TopBar>
        <Note>
          {/* 빈 화면을 보고 "고장났나?" 하지 않도록 한계를 먼저 알린다 */}
          이 과제에 대한 <strong>2026-07-31(V2 전환) 이후</strong>의 변경만 기록됩니다.
          그 이전 이력은 <strong>설정 ▸ 최근 수정 사항</strong>에서 확인하세요.
        </Note>
        {fields.length > 1 && (
          <FilterSelect value={fieldFilter} onChange={(e) => setFieldFilter(e.target.value)}>
            <option value="ALL">전체 항목</option>
            {fields.map(f => <option key={f} value={f}>{f}</option>)}
          </FilterSelect>
        )}
      </TopBar>

      {groups.length === 0 ? (
        <Empty>
          <Clock size={32} />
          <p>{rows.length === 0 ? '아직 기록된 변경이 없습니다.' : '이 항목의 변경이 없습니다.'}</p>
        </Empty>
      ) : (
        groups.map(group => {
          const meta = SOURCE_META[group.source] || SOURCE_META.ui;
          const { Icon } = meta;
          return (
            <SaveCard key={group.rowVersion}>
              <SaveHead>
                <When>{formatWhen(group.changedAt)}</When>
                <Who>{group.actor || '(알 수 없음)'}</Who>
                {group.onBehalfOf && <OnBehalf>{group.onBehalfOf} 대신</OnBehalf>}
                <SourceBadge color={meta.color}>
                  <Icon size={11} />{meta.label}
                </SourceBadge>
                <Version>v{group.rowVersion}</Version>
              </SaveHead>

              {group.reason && <Reason>{group.reason}</Reason>}

              {group.entries.map((entry, i) => (
                <Row key={`${entry.key}-${i}`}>
                  <FieldName>
                    {entry.key}
                    {/* 저장 머리의 배지와 다른 칸만 따로 표시한다 — 다 붙이면 소음이다 */}
                    {group.mixed && entry.source !== group.source && (() => {
                      const m = SOURCE_META[entry.source] || SOURCE_META.ui;
                      return <FieldSource color={m.color}>{m.label}</FieldSource>;
                    })()}
                  </FieldName>
                  {entry.details ? (
                    <Body>
                      <ListSummary>{entry.summary}</ListSummary>
                      {entry.details.map((d, j) => (
                        <DetailRow key={`${d.sign}${d.label}${j}`}>
                          <Sign>{d.sign}</Sign>
                          <DetailLabel>{d.label}</DetailLabel>
                          {d.before !== undefined && (
                            <span>
                              <Before title={d.beforeRaw}>{d.before}</Before>
                              <Arrow>→</Arrow>
                              <After title={d.afterRaw}>{d.after}</After>
                            </span>
                          )}
                        </DetailRow>
                      ))}
                    </Body>
                  ) : (
                    <ValueBody>
                      <Before title={entry.beforeRaw}>{entry.before}</Before>
                      <Arrow>→</Arrow>
                      <After title={entry.afterRaw}>{entry.after}</After>
                    </ValueBody>
                  )}
                </Row>
              ))}
            </SaveCard>
          );
        })
      )}
    </>
  );
};

export default ChangeHistorySection;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
`;

const Tabs = styled.div`
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid #e5e7eb;
`;

const TabButton = styled.button`
  padding: 0.5rem 0.875rem;
  border: none;
  border-bottom: 2px solid ${p => (p.$on ? '#2563eb' : 'transparent')};
  background: none;
  color: ${p => (p.$on ? '#1f2937' : '#9ca3af')};
  font-size: 0.875rem;
  font-weight: ${p => (p.$on ? 600 : 500)};
  cursor: pointer;

  &:hover {
    color: #1f2937;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;
`;

const Th = styled.th`
  padding: 0.5rem 0.625rem;
  border-bottom: 1px solid #e5e7eb;
  text-align: left;
  font-weight: 600;
  color: #6b7280;
  white-space: nowrap;
`;

const Td = styled.td`
  padding: 0.5rem 0.625rem;
  border-bottom: 1px solid #f3f4f6;
  white-space: nowrap;
  color: ${p => (p.$hi ? '#1f2937' : '#9ca3af')};
  font-weight: ${p => (p.$hi ? 600 : 400)};
  background: ${p => (p.$hi ? '#eff6ff' : 'transparent')};
`;

const Seed = styled.span`
  margin-left: 0.375rem;
  padding: 0.0625rem 0.3125rem;
  border-radius: 0.1875rem;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 0.6875rem;
`;

const Legend = styled.p`
  margin: 0;
  font-size: 0.75rem;
  line-height: 1.6;
  color: #9ca3af;

  code {
    padding: 0 0.1875rem;
    border-radius: 0.1875rem;
    background: #f3f4f6;
  }
`;

const Hint = styled.span`
  font-size: 0.75rem;
  color: #9ca3af;
`;

const TopBar = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
`;

const Note = styled.p`
  flex: 1;
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
  color: #6b7280;
`;

const FilterSelect = styled.select`
  flex: 0 0 auto;
  padding: 0.375rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  background: white;
  color: #374151;
`;

const SaveCard = styled.div`
  padding: 0.875rem 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  background: white;
`;

const SaveHead = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.625rem;
`;

const When = styled.span`
  font-size: 0.8125rem;
  font-weight: 600;
  color: #1f2937;
`;

const Who = styled.span`
  font-size: 0.8125rem;
  color: #374151;
`;

const OnBehalf = styled.span`
  font-size: 0.75rem;
  color: #6b7280;
`;

const SourceBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  padding: 0.125rem 0.4375rem;
  border-radius: 0.25rem;
  background: ${props => props.color};
  color: white;
  font-size: 0.6875rem;
  font-weight: 600;
`;

const Version = styled.span`
  margin-left: auto;
  font-size: 0.6875rem;
  color: #9ca3af;
`;

const Reason = styled.p`
  margin: 0 0 0.625rem;
  padding: 0.375rem 0.625rem;
  border-left: 2px solid #d1d5db;
  font-size: 0.8125rem;
  color: #4b5563;
  background: #f9fafb;
`;

const Row = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.1875rem 0;
  font-size: 0.8125rem;
  line-height: 1.5;
`;

const FieldName = styled.span`
  flex: 0 0 auto;
  min-width: 8rem;
  color: #374151;
  font-weight: 600;
`;

/* 한 저장 안에서 **다른 출처인 칸**에만 붙는 작은 표식 */
const FieldSource = styled.span`
  margin-left: 0.375rem;
  padding: 0 0.25rem;
  border-radius: 0.1875rem;
  font-size: 0.625rem;
  font-weight: 600;
  color: ${p => p.color};
  background: ${p => p.color}1a;
`;

const Body = styled.span`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
  color: #6b7280;
  word-break: break-all;
`;

/*
  값 한 쌍(전 → 후)을 담는 자리. **한 줄로 흐른다.**

  🐞 예전에는 세로 flex 인 `Body` 를 그대로 썼다. 그러면 전·화살표·후가 각각
     flex 항목이 되어 `방사 패턴 / → / 개요그림` 처럼 **세 줄**로 끊겼다.
     값 하나가 세 줄을 먹으면 이력을 훑을 수가 없다.

  `overflow-wrap: anywhere` 는 uuid 같은 긴 덩어리만 잘라 준다 — `break-all` 과 달리
  넘치지 않으면 안 자른다.
*/
const ValueBody = styled.span`
  min-width: 0;
  color: #6b7280;
  overflow-wrap: anywhere;
`;

const ListSummary = styled.span`
  color: #4b5563;
`;

const DetailRow = styled.span`
  display: flex;
  align-items: baseline;
  gap: 0.375rem;
  padding-left: 0.5rem;
`;

const Sign = styled.span`
  flex: 0 0 auto;
  width: 0.75rem;
  color: #9ca3af;
`;

const DetailLabel = styled.span`
  flex: 0 0 auto;
  color: #6b7280;
`;

const Before = styled.span`
  color: #9ca3af;
  text-decoration: line-through;
`;

const Arrow = styled.span`
  margin: 0 0.25rem;
  color: #9ca3af;
`;

const After = styled.span`
  color: #1f2937;
  font-weight: 500;
`;

const Empty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2.5rem 1rem;
  color: #9ca3af;

  p {
    margin: 0;
    font-size: 0.875rem;
  }

  .spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const ErrorText = styled.span`
  font-size: 0.75rem;
  color: #ef4444;
`;

const RetryButton = styled.button`
  margin-top: 0.25rem;
  padding: 0.25rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  color: #374151;
  font-size: 0.8125rem;
  cursor: pointer;

  &:hover {
    background: #f9fafb;
  }
`;
