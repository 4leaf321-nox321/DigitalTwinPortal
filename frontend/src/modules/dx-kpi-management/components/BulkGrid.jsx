/**
 * 일괄 입력 격자 — **행은 KPI, 열은 날짜.**
 *
 * 무엇이 불편했나
 *     예전 일괄 입력은 **KPI 한 개**에 (날짜, 값) 줄을 여러 개 다는 방식이었다.
 *     그래서 한 사업부의 KPI 열 개를 넣으려면 좌측에서 KPI 를 열 번 바꿔 가며
 *     같은 일을 열 번 했다. 정작 원본(주간보고·엑셀)은 **KPI × 기간 표**라
 *     모양이 서로 달라서, 보고 옮겨 적는 내내 눈이 왔다 갔다 했다.
 *
 *     그래서 화면을 원본과 **같은 모양**으로 맞춘다. 표를 보고 표에 넣는다.
 *
 * ⚠️ 값 합성 규칙(분수 → 하나의 값)은 **화면 다른 곳과 같아야 한다** —
 *    단위가 '%' 면 (분자/분모)×100, 아니면 분자/분모 · 소수 한 자리.
 *    여기서 다르게 계산하면 단건으로 넣은 값과 격자로 넣은 값이 서로 달라진다.
 *    그래서 계산을 이 파일에 두지 않고 **부모가 넘겨준 것을 쓴다**(`computeFraction`).
 *
 * ⚠️ **빈 칸은 저장하지 않는다.** 격자는 비어 있는 칸이 많은 것이 정상이고,
 *    빈 칸을 0 으로 저장하면 없는 실적이 0 으로 남아 달성률이 망가진다.
 */
import React, { useCallback, useMemo, useRef } from 'react';
import styled from 'styled-components';

const BulkGrid = ({
  kpis,                 // [{label, unit, category, valueType}]
  dates,                // ['2026-01-31', …] 열
  values,               // { [kpi]: { [date]: {value, numerator, denominator} } }
  onDatesChange,
  onChange,             // (kpi, date, field, val)
  onPasteBlock,         // (kpi, date, rows[][])  — 격자에 통째로 붙일 때
  computeFraction,      // (num, den, unit) → 미리보기 문자열 | null
  addDays,              // (ymd, n) → 'YYYY-MM-DD'
  todayStr,
}) => {
  const lastFocus = useRef(null);

  const cell = (kpi, date) => (values[kpi]?.[date]) || {};

  const filled = useMemo(() => {
    let n = 0;
    // `cell` 을 부르지 않고 `values` 를 직접 본다 — `cell` 은 렌더마다 새로 만들어져
    // 의존성으로 적을 수가 없고, 적지 않으면 린트가 "빠뜨렸다" 고 옳게 지적한다.
    kpis.forEach(k => dates.forEach(d => {
      const c = (values[k.label] || {})[d] || {};
      if (k.valueType === 'fraction' ? (c.numerator && c.denominator) : c.value) n += 1;
    }));
    return n;
  }, [kpis, dates, values]);

  /*
    열을 늘리는 기준은 **맨 앞 기준 날짜에서 +7일씩**이다.

    KPI 는 주 단위로 적히는데 예전에는 「월말」로만 열을 늘릴 수 있어서, 주간 값을
    넣으려면 열두 칸을 만든 뒤 날짜를 하나하나 고쳐야 했다.

    ⚠️ **마지막 날짜 기준**으로 더한다(가장 큰 날짜). 가운데 열의 날짜를 손으로
       고쳐 순서가 흐트러져도 새 열이 과거로 끼어들지 않는다.
  */
  const lastDate = useMemo(() => {
    const filledDates = dates.filter(Boolean);
    if (!filledDates.length) return '';
    return filledDates.reduce((a, b) => (a > b ? a : b));
  }, [dates]);

  const addWeeks = (n) => {
    let base = lastDate || todayStr();
    const next = [...dates];
    for (let i = 0; i < n; i += 1) {
      // 첫 열이 아예 없으면 기준 날짜부터 시작한다(더하지 않는다).
      base = (next.filter(Boolean).length === 0 && i === 0) ? base : addDays(base, 7);
      if (base && !next.includes(base)) next.push(base);
    }
    onDatesChange(next);
  };

  const setDate = (idx, next) => {
    if (!next) return;
    const dup = dates.some((d, i) => d === next && i !== idx);
    if (dup) return;                    // 같은 날짜 열이 둘이면 어느 값이 이길지 모른다
    onDatesChange(dates.map((d, i) => (i === idx ? next : d)));
  };

  /**
   * 엑셀에서 긁어 온 덩이를 그 칸부터 채운다 — 아래로 KPI, 오른쪽으로 날짜.
   *
   * 한 칸짜리(줄바꿈·탭 없음)는 **브라우저 기본 붙여넣기**에 맡긴다.
   * 가로채면 커서 위치에 끼워 넣기 같은 평범한 동작이 사라진다.
   */
  const handlePaste = useCallback((e, kpiIdx, dateIdx) => {
    const text = e.clipboardData.getData('text') || '';
    if (!text.includes('\t') && !/\r?\n/.test(text.trim())) return;
    e.preventDefault();
    const rows = text.replace(/\r\n/g, '\n').split('\n')
      .filter(l => l.trim() !== '')
      .map(l => l.split('\t').map(c => c.trim()));
    onPasteBlock(kpiIdx, dateIdx, rows);
  }, [onPasteBlock]);

  return (
    <Wrap>
      <Bar>
        <BarLabel>기간 {dates.length}칸 · 입력된 칸 {filled}개</BarLabel>
        <Spacer />
        {lastDate && <BarNote>마지막 열 {lastDate.slice(5).replace('-', '/')}</BarNote>}
        <SmallBtn type="button" onClick={() => addWeeks(1)}>+ 7일</SmallBtn>
        <SmallBtn type="button" onClick={() => addWeeks(4)}>+ 4주</SmallBtn>
        <SmallBtn type="button" onClick={() => addWeeks(12)}>+ 12주</SmallBtn>
      </Bar>

      <Scroll>
        <Table>
          <thead>
            <tr>
              <Th $sticky $head>KPI</Th>
              {dates.map((d, i) => (
                <Th key={d || i}>
                  <ColHead>
                    <DateInput type="date" value={d}
                               onChange={(e) => setDate(i, e.target.value)} />
                    {dates.length > 1 && (
                      <DropBtn type="button" title="이 열 지우기"
                               onClick={() => onDatesChange(dates.filter((_, j) => j !== i))}>
                        ×
                      </DropBtn>
                    )}
                  </ColHead>
                </Th>
              ))}
              <Th style={{ width: 44 }}>
                <SmallBtn type="button" title="열 추가"
                          onClick={() => onDatesChange([...dates, ''])}>＋</SmallBtn>
              </Th>
            </tr>
          </thead>
          <tbody>
            {kpis.map((k, ki) => (
              <tr key={k.label}>
                <Td $sticky>
                  <KpiName title={k.label}>{k.label}</KpiName>
                  <Unit>{k.category}{k.unit ? ` · ${k.unit}` : ''}</Unit>
                </Td>
                {dates.map((d, di) => {
                  const c = cell(k.label, d);
                  if (k.valueType === 'fraction') {
                    const preview = computeFraction(c.numerator, c.denominator, k.unit);
                    return (
                      <Td key={d || di}>
                        <FracBox>
                          <Cell $narrow placeholder="분자" value={c.numerator || ''}
                                onFocus={() => { lastFocus.current = [ki, di]; }}
                                onChange={(e) => onChange(k.label, d, 'numerator', e.target.value)}
                                onPaste={(e) => handlePaste(e, ki, di)} />
                          <Slash>/</Slash>
                          <Cell $narrow placeholder="분모" value={c.denominator || ''}
                                onChange={(e) => onChange(k.label, d, 'denominator', e.target.value)}
                                onPaste={(e) => handlePaste(e, ki, di)} />
                          <Preview $on={preview !== null}>
                            {preview !== null ? `${preview}${k.unit || ''}` : ''}
                          </Preview>
                        </FracBox>
                      </Td>
                    );
                  }
                  return (
                    <Td key={d || di}>
                      <Cell placeholder="—" value={c.value || ''}
                            onFocus={() => { lastFocus.current = [ki, di]; }}
                            onChange={(e) => onChange(k.label, d, 'value', e.target.value)}
                            onPaste={(e) => handlePaste(e, ki, di)} />
                    </Td>
                  );
                })}
                <Td />
              </tr>
            ))}
          </tbody>
        </Table>
      </Scroll>

      <Foot>
        맨 앞 열이 <b>기준 날짜</b>입니다. 열 머리글에서 바꾸면 되고,
        <b>+ 7일</b>은 마지막 열에서 한 주씩 이어 붙입니다.
        엑셀이나 주간보고 표를 긁어 아무 칸에 붙여 넣으면 <b>그 칸부터 아래·오른쪽으로</b>
        채워집니다. 빈 칸은 저장하지 않습니다.
      </Foot>
    </Wrap>
  );
};

/* ── 스타일 ── */

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
  flex: 1;
`;

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 7px 11px;
  background: #f0f9ff;
  border: 1px dashed #93c5fd;
  border-radius: 8px;
`;

const BarLabel = styled.span`
  font-size: 12px;
  font-weight: 600;
  color: #0369a1;
`;

const Spacer = styled.div`flex: 1;`;

const BarNote = styled.span`
  font-size: 11.5px;
  color: #0369a1;
  font-variant-numeric: tabular-nums;
`;

const SmallBtn = styled.button`
  padding: 4px 9px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
  &:hover { background: #f1f5f9; }
`;

const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
`;

const Table = styled.table`
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12.5px;
`;

const Th = styled.th`
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 5px 7px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;

  ${p => p.$sticky && `
    left: 0;
    z-index: 3;
    border-right: 1px solid #e2e8f0;
  `}
`;

const Td = styled.td`
  padding: 3px 5px;
  border-bottom: 1px solid #f1f5f9;
  background: #fff;
  vertical-align: middle;

  ${p => p.$sticky && `
    position: sticky;
    left: 0;
    z-index: 1;
    border-right: 1px solid #e2e8f0;
    min-width: 150px;
    max-width: 190px;
  `}
`;

const KpiName = styled.div`
  font-weight: 600;
  color: #334155;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const Unit = styled.div`
  font-size: 10.5px;
  color: #94a3b8;
`;

const ColHead = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
`;

const DateInput = styled.input`
  width: 128px;
  padding: 3px 5px;
  font-size: 11.5px;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
`;

const DropBtn = styled.button`
  border: none;
  background: none;
  color: #cbd5e1;
  font-size: 13px;
  cursor: pointer;
  &:hover { color: #ef4444; }
`;

const Cell = styled.input`
  width: ${p => (p.$narrow ? '52px' : '86px')};
  padding: 4px 6px;
  font-size: 12.5px;
  text-align: right;
  border: 1px solid #e2e8f0;
  border-radius: 5px;

  &:focus { outline: 2px solid #c7d2fe; border-color: #6366f1; }
  &::placeholder { color: #e2e8f0; }
`;

const FracBox = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
`;

const Slash = styled.span`
  color: #94a3b8;
`;

const Preview = styled.span`
  min-width: 46px;
  font-size: 11px;
  font-weight: 700;
  color: ${p => (p.$on ? '#0891b2' : '#e2e8f0')};
  white-space: nowrap;
`;

const Foot = styled.div`
  flex-shrink: 0;
  font-size: 11.5px;
  color: #94a3b8;
  line-height: 1.6;
`;

export default BulkGrid;
