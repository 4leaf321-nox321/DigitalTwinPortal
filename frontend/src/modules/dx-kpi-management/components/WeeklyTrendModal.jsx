/**
 * 주간 주요 동향 — **한 주차를 사업부 × 개발/제조 격자로 한꺼번에** 적는다.
 *
 * 무엇이 불편했나
 *     예전에는 (사업부, 구분, 주차) 조합 **하나**를 고르고 코멘트를 적은 뒤 창을 닫았다.
 *     그런데 주간보고는 한 주차에 사업부 다섯 곳 × 개발·제조 두 갈래를 함께 쓴다.
 *     그래서 같은 일을 열 번 반복하며 매번 창을 열고 닫아야 했다.
 *
 * 격자는 **행이 사업부 × 개발/제조, 열이 주차**다. 밀린 주차를 몰아 쓸 때
 * 같은 사업부의 지난주 글을 옆 칸에서 보며 이어 쓸 수 있다.
 *
 * ⚠️ 여러 줄 글이라 칸이 좁으면 못 쓴다. 그래서 창을 넓히고 **열마다 최소 너비**를
 *    준 뒤 표를 **가로로 굴린다** — 주차를 많이 열어도 칸이 안 줄어든다.
 *
 * ⚠️ **수정은 예전 그대로 한 건씩**이다(목록에서 항목을 눌러 들어온 경우).
 *    고치는 그 한 건이 대상인데 격자를 띄우면 옆 칸을 실수로 건드리게 된다.
 *
 * ⚠️ **빈 칸은 저장하지 않는다.** 지우려면 목록에서 그 항목을 열어 삭제한다 —
 *    격자에서 지운 것인지 아직 안 쓴 것인지 구분할 수 없기 때문이다.
 */
import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
`;

const Modal = styled.div`
  background: #fff;
  border-radius: 16px;
  width: min(1240px, 96vw);
  max-width: 92vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
`;

const Close = styled.button`
  background: none;
  border: none;
  font-size: 22px;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
  &:hover { color: #475569; }
`;

const Body = styled.div`
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  overflow-y: auto;
  flex: 1;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 13px;
  font-weight: 600;
  color: #475569;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
`;

const Select = styled.select`
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  color: #334155;
  background: #fff;
  outline: none;
  &:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15); }
`;

const Textarea = styled.textarea`
  padding: 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
  color: #334155;
  resize: vertical;
  min-height: 140px;
  font-family: inherit;
  line-height: 1.55;
  outline: none;
  &:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.15); }
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 16px 24px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  flex-shrink: 0;
`;

const Btn = styled.button`
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
`;

const Cancel = styled(Btn)`
  background: #fff;
  color: #64748b;
  border-color: #e2e8f0;
  &:hover { background: #f1f5f9; }
`;

const Submit = styled(Btn)`
  background: #8b5cf6;
  color: #fff;
  &:hover { background: #7c3aed; }
  &:disabled { background: #c4b5fd; cursor: not-allowed; }
`;

const Delete = styled(Btn)`
  background: #fff;
  color: #ef4444;
  border-color: #fecaca;
  &:hover { background: #fef2f2; }
`;

const Hint = styled.div`
  font-size: 12px;
  color: #94a3b8;
  margin-top: 2px;
`;

const WeekStrip = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #64748b;
`;

const WeekChip = styled.button`
  padding: 2px 8px;
  font-size: 11.5px;
  font-weight: 700;
  border-radius: 9999px;
  cursor: pointer;
  border: 1px solid ${(p) => (p.$on ? '#6366f1' : '#e2e8f0')};
  background: ${(p) => (p.$on ? '#eef2ff' : '#fff')};
  color: ${(p) => (p.$on ? '#4338ca' : '#64748b')};
  font-variant-numeric: tabular-nums;
`;

/* 열 하나의 최소 너비. 여러 줄 글을 쓰는 칸이라 이보다 좁으면 못 쓴다.
   주차를 많이 열면 표가 가로로 굴러가고, 칸 크기는 그대로 남는다. */
const COL_MIN = 250;

const GridScroll = styled.div`
  /* 부모(Body)가 세로 flex 라 overflow 가 걸린 이 상자는 자동 최소 크기가 0 이 된다.
     사업부가 늘어 열 줄이 넘어가면 표가 통째로 눌린다(Flexbox §4.5). */
  flex-shrink: 0;
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
`;

const GridTable = styled.table`
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
`;

const ColHead = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
`;

const RowName = styled.div`
  font-weight: 700;
  color: #334155;
  font-size: 12.5px;
`;

const RowCat = styled.div`
  font-size: 11.5px;
  color: #64748b;
`;

const GTh = styled.th`
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 6px 8px;
  text-align: left;
  font-weight: 600;
  color: #475569;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;

  ${(p) => p.$sticky && `
    left: 0;
    z-index: 3;
    border-right: 1px solid #e2e8f0;
  `}
`;

const GTd = styled.td`
  position: relative;
  padding: 4px 5px;
  vertical-align: top;
  background: #fff;
  border-bottom: 1px solid #f1f5f9;
  /* 사업부가 바뀌는 자리에 선을 하나 — 열 줄이 이어지면 어디까지가 한 사업부인지 흐려진다 */
  border-top: ${(p) => (p.$top ? '1px solid #e2e8f0' : 'none')};

  ${(p) => p.$sticky && `
    position: sticky;
    left: 0;
    z-index: 1;
    border-right: 1px solid #e2e8f0;
    padding-top: 10px;
    white-space: nowrap;
  `}
`;

const CellArea = styled.textarea`
  width: 100%;
  min-width: ${COL_MIN - 24}px;
  min-height: 86px;
  padding: 7px 9px;
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.6;
  color: #1e293b;
  border: 1px solid ${(p) => (p.$touched ? '#93c5fd' : '#e2e8f0')};
  background: ${(p) => (p.$touched ? '#f0f9ff' : '#fff')};
  border-radius: 7px;
  resize: vertical;
  box-sizing: border-box;

  &:focus { outline: 2px solid #c7d2fe; border-color: #6366f1; }
`;

const Mark = styled.span`
  position: absolute;
  top: 8px;
  right: 12px;
  font-size: 10px;
  font-weight: 700;
  pointer-events: none;
`;

const SavedMark = styled(Mark)`color: #cbd5e1;`;
const ChangedMark = styled(Mark)`color: #0369a1;`;

const WeekPick = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
`;

const PickChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 700;
  color: #4338ca;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 7px;
`;

const PickX = styled.button`
  border: none;
  background: none;
  color: #a5b4fc;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  &:hover { color: #ef4444; }
`;

const PlainBtn = styled.button`
  padding: 4px 9px;
  font-size: 11.5px;
  font-weight: 600;
  color: #475569;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  cursor: pointer;
  &:hover { background: #f1f5f9; }
`;

const SavedMark2 = styled.span`
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
`;

const ChangedMark2 = styled.span`
  font-size: 11px;
  font-weight: 700;
  color: #0369a1;
`;

/**
 * 엑셀 클립보드(TSV) → 2차원 배열. **따옴표 규칙을 지킨다.**
 *
 * 엑셀은 탭·줄바꿈·따옴표가 든 칸을 `"..."` 로 감싸고, 안의 따옴표는 `""` 로 겹쳐 쓴다.
 * 그래서 그냥 줄바꿈으로 자르면 **여러 줄짜리 칸 하나가 여러 줄로 쪼개진다** —
 * 주간 동향은 여러 줄 글이라 이 경우가 오히려 흔하다.
 */
const parseClipboardTable = (text) => {
  const src = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuote = false;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (inQuote) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cell += '"'; i += 2; continue; }
        inQuote = false; i += 1; continue;
      }
      cell += ch; i += 1; continue;
    }
    if (ch === '"' && cell === '') { inQuote = true; i += 1; continue; }
    if (ch === '\t') { row.push(cell); cell = ''; i += 1; continue; }
    if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i += 1; continue; }
    cell += ch; i += 1;
  }
  row.push(cell);
  rows.push(row);
  // 끝의 빈 줄은 버린다 — 엑셀이 마지막에 줄바꿈을 하나 붙인다
  while (rows.length && rows[rows.length - 1].every(c => c === '')) rows.pop();
  return rows;
};

const CATEGORIES = ['개발', '제조'];

const WeeklyTrendModal = ({
  open,
  onClose,
  onSubmit,
  onSubmitMany,
  onDelete,
  divisions,
  weeks,
  defaultYear,
  initial,
  trends = [],          // 이미 저장된 것 — 격자에 채우고, 어느 주차가 찼는지 보여준다
}) => {
  const [year, setYear] = useState(defaultYear);
  const [division, setDivision] = useState(divisions[0]?.name || '');
  const [category, setCategory] = useState('개발');
  const [week, setWeek] = useState(1);
  const [content, setContent] = useState('');
  // 격자 초안: `주차|사업부|구분` → 내용. 저장된 것과 다른 칸만 저장 대상이 된다.
  const [draft, setDraft] = useState({});
  // 열어 둔 주차들. 여러 개를 한 번에 채워 함께 저장한다.
  const [selWeeks, setSelWeeks] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setYear(initial.year || defaultYear);
      setDivision(initial.division || divisions[0]?.name || '');
      setCategory(initial.category || '개발');
      setWeek(initial.week || 1);
      setContent(initial.content || '');
    } else {
      setYear(defaultYear);
      setDivision(divisions[0]?.name || '');
      setCategory('개발');
      const now = new Date();
      const startOfYear = new Date(now.getFullYear(), 0, 1);
      const days = Math.floor((now - startOfYear) / 86400000);
      const isoWeek = Math.min(Math.max(Math.ceil((days + startOfYear.getDay() + 1) / 7), 1), weeks.length || 53);
      setWeek(isoWeek);
      setContent('');
      setDraft({});
      setSelWeeks([isoWeek]);
    }
  }, [open, initial, defaultYear, divisions, weeks.length]);

  const isEdit = !!(initial && initial.id);

  const canSubmit = useMemo(() => division && category && year && week && content.trim().length > 0, [division, category, year, week, content]);

  /** 고를 수 있는 주차 번호. 부모가 준 목록이 없으면 1~53. */
  const weekNums = useMemo(() => (weeks.length
    ? weeks.map((w, i) => parseInt(w, 10) || (i + 1))
    : Array.from({ length: 53 }, (_, i) => i + 1)), [weeks]);

  const key = (w, d, c) => `${w}|${d}|${c}`;

  /** 이 연도에 **이미 저장된** 내용 — `주차|사업부|구분` 으로 찾는다. 격자의 바탕이다. */
  const savedHere = useMemo(() => {
    const m = {};
    trends.forEach(t => {
      if (t.year === Number(year)) m[key(t.week, t.division, t.category)] = t.content || '';
    });
    return m;
  }, [trends, year]);

  /** 내용이 있는 주차 — 어디까지 썼는지 한눈에 보이게. */
  const filledWeeks = useMemo(() => {
    const set = new Set();
    trends.forEach(t => {
      if (t.year === Number(year) && (t.content || '').trim()) set.add(t.week);
    });
    return [...set].sort((a, b) => a - b);
  }, [trends, year]);

  /**
   * 격자의 줄 순서 — **개발/제조를 먼저, 그 안에서 사업부.**
   * 주간보고가 그 순서로 쓰이므로 눈이 문서와 같은 길로 움직인다.
   */
  const gridRows = useMemo(() => CATEGORIES.flatMap(c =>
    divisions.map((d, di) => ({ category: c, division: d, first: di === 0 }))),
  [divisions]);

  const cellValue = (w, d, c) => {
    const k = key(w, d, c);
    return draft[k] !== undefined ? draft[k] : (savedHere[k] || '');
  };

  const addWeek = (w) => {
    const n = Number(w);
    if (!n || selWeeks.includes(n)) return;
    setSelWeeks(prev => [...prev, n].sort((a, b) => a - b));
  };
  const dropWeek = (w) => setSelWeeks(prev => prev.filter(x => x !== w));

  /**
   * 저장할 것 — **손댔고 내용이 있는 칸만.**
   * 저장된 것과 글자가 같으면 보내지 않는다(같은 값을 다시 쓰는 요청은 낭비다).
   */
  const pending = useMemo(() => {
    const out = [];
    selWeeks.forEach(w => {
      divisions.forEach(d => {
        CATEGORIES.forEach(c => {
          const k = key(w, d.name, c);
          const text = (draft[k] ?? '').trim();
          if (draft[k] === undefined) return;          // 손대지 않았다
          if (!text) return;                            // 빈 칸은 저장하지 않는다
          if (text === (savedHere[k] || '').trim()) return;
          out.push({ year: Number(year), week: w,
                     division: d.name, category: c, content: text });
        });
      });
    });
    return out;
  }, [draft, savedHere, divisions, year, selWeeks]);

  /**
   * 엑셀에서 긁어 온 표를 **칸마다 나눠** 넣는다. 그 칸부터 아래·오른쪽으로.
   *
   * ⚠️ **탭이 있을 때만 표로 본다.** 이 칸에 들어가는 것은 여러 줄 글이라,
   *    줄바꿈만 보고 표로 판단하면 워드에서 긁어 온 문단이 줄마다 다른 사업부로
   *    흩어진다. 엑셀은 칸을 탭으로 가르므로 탭이 곧 "표" 라는 표시다.
   *
   * ⚠️ 엑셀은 **줄바꿈이 든 칸을 따옴표로 감싼다**(`"첫 줄
둘째 줄"`). 그대로 두면
   *    따옴표가 글에 남으므로, 탭이 없는 한 칸짜리라도 감싸져 있으면 벗겨서 넣는다.
   */
  const handleCellPaste = (e, rowIdx, weekIdx) => {
    const text = e.clipboardData.getData('text') || '';
    if (!text) return;

    if (!text.includes('\t')) {
      // 표가 아니다 — 다만 엑셀이 한 칸을 감쌌을 수 있다.
      const m = /^"([\s\S]*)"\r?\n?$/.exec(text);
      if (!m) return;                       // 그냥 글 → 브라우저 기본 붙여넣기
      e.preventDefault();
      const row = gridRows[rowIdx];
      const w = selWeeks[weekIdx];
      if (!row || !w) return;
      setDraft(p => ({
        ...p,
        [`${w}|${row.division.name}|${row.category}`]: m[1].replace(/""/g, '"'),
      }));
      return;
    }

    e.preventDefault();
    const table = parseClipboardTable(text);
    setDraft(prev => {
      const next = { ...prev };
      table.forEach((cols, r) => {
        const row = gridRows[rowIdx + r];
        if (!row) return;
        cols.forEach((val, c) => {
          const w = selWeeks[weekIdx + c];
          if (!w) return;
          next[`${w}|${row.division.name}|${row.category}`] = val;
        });
      });
      return next;
    });
  };

  if (!open) return null;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ year: Number(year), division, category, week: Number(week), content: content.trim() });
  };

  /** 격자 저장 — **창을 닫지 않는다.** 주차를 바꿔 이어서 쓰는 것이 흔한 쓰임이다. */
  const handleSubmitGrid = async () => {
    if (pending.length === 0) return;
    setBusy(true);
    try {
      await onSubmitMany(pending);
      setDraft({});
    } finally {
      setBusy(false);
    }
  };

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={(e) => e.stopPropagation()}>
        <Header>
          <Title>{isEdit ? '주간 주요 동향 수정' : '주간 주요 동향 추가'}</Title>
          <Close onClick={onClose}>&times;</Close>
        </Header>
        <Body>
          <Row>
            <Field>
              <Label>연도</Label>
              <Select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {[year - 1, year, year + 1].map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </Select>
            </Field>
            {isEdit ? (
              <Field>
                <Label>주차</Label>
                <Select value={week} onChange={(e) => setWeek(Number(e.target.value))}>
                  {weekNums.map((num) => (
                    <option key={num} value={num}>{num}주차</option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field style={{ flex: 1 }}>
                <Label>주차 <span style={{ color: '#94a3b8', fontWeight: 400 }}>(여러 개를 한 번에)</span></Label>
                <WeekPick>
                  {selWeeks.map(w => (
                    <PickChip key={w}>
                      {w}주차
                      {selWeeks.length > 1 && (
                        <PickX type="button" title="이 주차 닫기"
                               onClick={() => dropWeek(w)}>×</PickX>
                      )}
                    </PickChip>
                  ))}
                  <Select
                    value=""
                    style={{ width: 108 }}
                    onChange={(e) => { addWeek(e.target.value); e.target.value = ''; }}
                  >
                    <option value="">+ 주차 추가</option>
                    {weekNums.filter(n => !selWeeks.includes(n))
                      .map(n => <option key={n} value={n}>{n}주차</option>)}
                  </Select>
                  {/* 밀린 주차를 몰아 쓰는 일이 흔하다 — 최근 몇 주를 한 번에 연다 */}
                  <PlainBtn type="button" onClick={() => {
                    const base = selWeeks.length ? Math.max(...selWeeks) : week;
                    [1, 2, 3].forEach(k => addWeek(base - k));
                  }}>이전 3주 열기</PlainBtn>
                </WeekPick>
              </Field>
            )}
            {isEdit && (
              <Field>
                <Label>구분</Label>
                <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
            )}
          </Row>

          {isEdit ? (
            <>
              <Field>
                <Label>사업부</Label>
                <Select value={division} onChange={(e) => setDivision(e.target.value)}>
                  {divisions.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </Select>
              </Field>
              <Field>
                <Label>주요 동향 코멘트</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="해당 사업부의 개발/제조 주요 동향을 몇 줄로 작성하세요."
                />
                <Hint>같은 사업부/구분/주차 조합으로 다시 저장하면 기존 코멘트가 덮어써집니다.</Hint>
              </Field>
            </>
          ) : (
            <>
              {/* 어디까지 썼는지 — 주차를 옮겨 다니며 쓰므로 표시가 있어야 한다 */}
              {filledWeeks.length > 0 && (
                <WeekStrip>
                  <span>내용이 있는 주차</span>
                  {filledWeeks.map(w => (
                    <WeekChip key={w} type="button" $on={selWeeks.includes(w)}
                              title={selWeeks.includes(w) ? '이미 열려 있습니다' : '이 주차를 엽니다'}
                              onClick={() => addWeek(w)}>
                      {w}
                    </WeekChip>
                  ))}
                </WeekStrip>
              )}

              <GridScroll>
                <GridTable>
                  <thead>
                    <tr>
                      <GTh $sticky style={{ minWidth: 128 }}>사업부 · 구분</GTh>
                      {selWeeks.map(w => {
                        const n = pending.filter(x => x.week === w).length;
                        return (
                          <GTh key={w} style={{ minWidth: COL_MIN }}>
                            <ColHead>
                              <b>{w}주차</b>
                              {filledWeeks.includes(w) && <SavedMark2>기록</SavedMark2>}
                              {n > 0 && <ChangedMark2>{n}건</ChangedMark2>}
                              {selWeeks.length > 1 && (
                                <PickX type="button" title="이 주차 닫기"
                                       onClick={() => dropWeek(w)}>×</PickX>
                              )}
                            </ColHead>
                          </GTh>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {gridRows.map(({ division: d, category: c, first }, ri) => (
                      <tr key={`${c}|${d.id}`}>
                        {/* 구분은 그 묶음의 첫 줄에만 — 열 줄 내내 되풀이하면 눈이 헷갈린다 */}
                        <GTd $sticky $top={first}>
                          <RowName>{first ? c : ''}</RowName>
                          <RowCat>{d.name}</RowCat>
                        </GTd>
                        {selWeeks.map((w, wi) => {
                          const k = `${w}|${d.name}|${c}`;
                          const saved = (savedHere[k] || '').trim();
                          const touched = draft[k] !== undefined
                            && (draft[k] ?? '').trim() !== saved;
                          return (
                            <GTd key={w} $top={first}>
                              <CellArea
                                $touched={touched}
                                value={cellValue(w, d.name, c)}
                                onChange={(e) => setDraft(p => ({ ...p, [k]: e.target.value }))}
                                onPaste={(e) => handleCellPaste(e, ri, wi)}
                                placeholder={saved ? '' : `${d.name} ${c}`}
                              />
                              {saved && !touched && <SavedMark>저장됨</SavedMark>}
                              {touched && <ChangedMark>바뀜</ChangedMark>}
                            </GTd>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </GridTable>
              </GridScroll>
              <Hint>
                빈 칸은 저장하지 않습니다. 지우려면 목록에서 그 항목을 열어 삭제하세요.
                주차를 여러 개 열어 두면 <b>한 번에 저장</b>됩니다.
                열이 화면을 넘으면 표를 가로로 밀어서 보세요.
                <b>엑셀에서 여러 칸을 복사해 붙이면</b> 그 칸부터 아래·오른쪽으로 나뉘어 들어갑니다.
              </Hint>
            </>
          )}
        </Body>
        <Footer>
          <div>
            {isEdit && onDelete && (
              <Delete type="button" onClick={() => onDelete(initial.id)}>삭제</Delete>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Cancel type="button" onClick={onClose}>{isEdit ? '취소' : '닫기'}</Cancel>
            {isEdit ? (
              <Submit type="button" onClick={handleSubmit} disabled={!canSubmit}>저장</Submit>
            ) : (
              <Submit type="button" onClick={handleSubmitGrid}
                      disabled={busy || pending.length === 0}>
                {busy ? '저장 중…' : `${pending.length}건 저장`}
              </Submit>
            )}
          </div>
        </Footer>
      </Modal>
    </Overlay>
  );
};

export default WeeklyTrendModal;
