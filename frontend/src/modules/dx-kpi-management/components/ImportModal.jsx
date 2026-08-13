/**
 * 주간보고 붙여넣기 반입.
 *
 * 왜 파일이 아니라 붙여넣기인가
 *     원본 워드에 사내 DRM 이 걸려 있다. 파일을 올려도 서버가 받는 것은 암호화된
 *     덩어리라 열 수 없다. 반면 **워드가 화면에 보여주는 글자**는 복사가 되므로,
 *     표를 긁어 붙이면 탭 구분 텍스트로 들어온다.
 *
 * ⚠️ **기준일은 문서에 없다.** 주간보고에 날짜 칸이 아예 없어서 여기서 받는다.
 *    이 값이 없으면 저장 단추가 안 열린다 — 날짜 없는 기록은 쓸모가 없다.
 *
 * ⚠️ **읽자마자 저장하지 않는다.** 읽기 → 확인 → 저장 세 걸음이다.
 *    같은 날짜에 이미 값이 있으면 나란히 보여주고 사람이 고른다.
 *
 * ⚠️ **모르는 이름을 버리지 않는다.** 「설계자동화율」처럼 표기가 다른 것은
 *    여기서 한 번 골라 주면 서버가 별칭으로 남겨, **둘째 주부터는 자동으로 맞는다.**
 *    개발 환경에 진짜 문서가 없는 상황이라 이 학습 통로가 기능의 핵심이다.
 */
import React, { useMemo, useState } from 'react';
import styled from 'styled-components';

import { commitImport, previewImport, suggestImportNames } from '../services/kpiApi';

const CATEGORIES = ['개발', '제조'];

const ImportModal = ({
  open, onClose, onDone, kpiDefinitions = [], defaultYear, weeks = [],
}) => {
  const [tab, setTab] = useState('kpi');          // 'kpi' | 'weekly'
  const [text, setText] = useState('');
  const [baseDate, setBaseDate] = useState('');
  const [year, setYear] = useState(defaultYear || new Date().getFullYear());
  const [week, setWeek] = useState('');
  const [result, setResult] = useState(null);
  const [picked, setPicked] = useState({});       // 행 key → 넣을까
  const [aliasPick, setAliasPick] = useState({}); // 모르는 이름 → 고른 KPI
  // AI 가 제안한 것. **고른 값과 따로 둔다** — 어느 것이 AI 말인지 화면이 표시해야
  // 사람이 그것만 눈여겨볼 수 있다. 합쳐 두면 자기가 고른 것과 구분이 안 된다.
  const [aiPick, setAiPick] = useState({});       // 이름 → {kpi, confidence, why}
  const [aiNote, setAiNote] = useState('');       // AI 가 못 했을 때 보여줄 한 문장
  const [aiBusy, setAiBusy] = useState(false);
  const [catPick, setCatPick] = useState({});     // 주간 동향 구획 → 개발/제조
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  const rowKey = (r, i) => `${i}|${r.division}|${r.kpi}`;

  const reset = () => {
    setResult(null); setPicked({}); setAliasPick({}); setCatPick({});
    setAiPick({}); setAiNote(''); setError(null); setDone(null);
  };

  /**
   * 못 맞춘 이름을 AI 에게 물어본다.
   *
   * ⚠️ **자동으로 저장하지 않는다.** 고른 칸을 채워 줄 뿐이고, 사람이 그대로 두면
   *    그때 별칭이 된다. 틀린 짝을 조용히 넣으면 남의 지표에 숫자가 들어간다.
   * ⚠️ 이미 사람이 고른 칸은 **건드리지 않는다.** 사람 손이 AI 보다 세다.
   */
  const askAi = async () => {
    const names = (result?.unknown || []).map(u => u.name);
    if (!names.length) return;
    setAiBusy(true); setAiNote('');
    try {
      const res = await suggestImportNames(names);
      if (!res.ok) {
        setAiNote(res.reason || 'AI 가 답하지 못했습니다. 직접 골라 주세요.');
        return;
      }
      const marks = {};
      const fills = {};
      (res.suggestions || []).forEach((s) => {
        marks[s.name] = s;
        if (!aliasPick[s.name]) fills[s.name] = s.kpi;
      });
      setAiPick(marks);
      setAliasPick(prev => ({ ...prev, ...fills }));
      const n = Object.keys(fills).length;
      setAiNote(n
        ? `AI 가 ${n}개를 채웠습니다. **맞는지 보고** 고쳐 주세요 — 그대로 저장하면 기억합니다.`
        : `AI 가 짝지을 만한 것을 찾지 못했습니다.${
          res.skipped ? ` (${res.skipped}개는 너무 많아 묻지 않았습니다)` : ''}`);
    } finally {
      setAiBusy(false);
    }
  };

  const read = async () => {
    setBusy(true); setError(null); setDone(null);
    try {
      const data = await previewImport({
        text, kind: tab, baseDate,
        year, week: week ? parseInt(week, 10) : undefined,
      });
      setResult(data);
      // 읽은 것은 **기본으로 켜 둔다** — 하나씩 켜게 하면 스무 번 눌러야 한다.
      const next = {};
      (data.rows || []).forEach((r, i) => { next[rowKey(r, i)] = true; });
      (data.sections || []).forEach((s, i) => { next[`s${i}`] = true; });
      setPicked(next);
      const cats = {};
      (data.sections || []).forEach((s, i) => { cats[`s${i}`] = s.category; });
      setCatPick(cats);
    } catch (err) {
      setError(err.message);
      setResult(null);
    } finally {
      setBusy(false);
    }
  };

  const chosenRows = useMemo(
    () => (result?.rows || []).filter((r, i) => picked[rowKey(r, i)]),
    [result, picked]);

  const chosenSections = useMemo(
    () => (result?.sections || [])
      .map((s, i) => ({ ...s, category: catPick[`s${i}`] || s.category, _i: i }))
      .filter(s => picked[`s${s._i}`]),
    [result, picked, catPick]);

  const aliasList = useMemo(
    () => Object.entries(aliasPick)
      .filter(([, kpi]) => kpi)
      .map(([alias, kpi]) => ({ alias, kpi })),
    [aliasPick]);

  const canSave = tab === 'kpi'
    ? Boolean(baseDate) && (chosenRows.length > 0 || aliasList.length > 0)
    : Boolean(year && week) && chosenSections.length > 0;

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const payload = tab === 'kpi'
        ? { kind: 'kpi', baseDate, rows: chosenRows, aliases: aliasList }
        : {
          kind: 'weekly', year: parseInt(year, 10), week: parseInt(week, 10),
          sections: chosenSections.map(s => ({
            division: s.division, category: s.category, content: s.content,
          })),
        };
      const res = await commitImport(payload);
      setDone(res);
      onDone?.();
      // 이름 연결만 저장한 경우(값은 아직) 다시 읽어야 반영이 보인다.
      if (aliasList.length && !chosenRows.length) await read();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <Overlay onMouseDown={onClose}>
      <Modal onMouseDown={(e) => e.stopPropagation()}>
        <Head>
          <Title>주간보고에서 가져오기</Title>
          <Close type="button" onClick={onClose}>✕</Close>
        </Head>

        <Tabs>
          {[['kpi', 'KPI 지표'], ['weekly', '주간 동향']].map(([id, label]) => (
            <Tab key={id} type="button" $on={tab === id}
                 onClick={() => { setTab(id); reset(); }}>{label}</Tab>
          ))}
        </Tabs>

        <Body>
          <Lead>
            워드에서 {tab === 'kpi' ? '표를 통째로' : '해당 부분을'} 선택해 복사한 뒤
            아래에 붙여 넣으세요. <b>읽기만 하고 바로 저장하지 않습니다.</b>
          </Lead>

          {/* 기준일·주차 — 문서에 없어서 여기서 받는다 */}
          <Row>
            {tab === 'kpi' ? (
              <>
                <Label>기준일 *</Label>
                <Input type="date" value={baseDate}
                       onChange={(e) => setBaseDate(e.target.value)} />
                <Hint>주간보고에는 날짜가 없어 여기서 정합니다. 모든 행에 같이 들어갑니다.</Hint>
              </>
            ) : (
              <>
                <Label>연도 *</Label>
                <Input type="number" value={year} style={{ width: 90 }}
                       onChange={(e) => setYear(e.target.value)} />
                <Label>주차 *</Label>
                <Select value={week} onChange={(e) => setWeek(e.target.value)}>
                  <option value="">선택</option>
                  {weeks.map((w) => (
                    <option key={w} value={parseInt(w, 10)}>{w}</option>
                  ))}
                </Select>
              </>
            )}
          </Row>

          <Textarea
            value={text}
            onChange={(e) => { setText(e.target.value); reset(); }}
            placeholder={tab === 'kpi'
              ? 'KPI\tMX\tVD\tDA …\n가상 검증률\t62\t41 …'
              : 'MX\n개발\n- 설계 자동화 도구 배포 완료\n제조\n- …'}
          />

          <Row>
            <Primary type="button" onClick={read} disabled={busy || !text.trim()}>
              {busy ? '읽는 중…' : '읽기'}
            </Primary>
            {result && (
              <Hint>
                {tab === 'kpi'
                  ? `${result.layout === 'wide' ? '열이 사업부인 표' : '줄마다 한 값인 표'}로 읽었습니다`
                  : `사업부 구획 ${result.sections?.length || 0}개`}
              </Hint>
            )}
          </Row>

          {error && <Banner $err>{error}</Banner>}
          {(result?.warnings || []).map((w, i) => <Banner key={i}>{w}</Banner>)}

          {/* ── 모르는 이름 — 버리지 않고 물어본다 ── */}
          {(result?.unknown || []).length > 0 && (
            <Section>
              <SecTitle>
                모르는 KPI 이름 {result.unknown.length}개
                <SecNote>한 번 골라 주면 다음부터는 자동으로 맞습니다.</SecNote>
                <AiBtn type="button" onClick={askAi} disabled={aiBusy}>
                  {aiBusy ? '물어보는 중…' : 'AI 로 맞춰보기'}
                </AiBtn>
              </SecTitle>
              {aiNote && <Banner>{aiNote}</Banner>}
              {result.unknown.map((u) => {
                const ai = aiPick[u.name];
                // AI 가 제안한 그대로일 때만 표식을 단다 — 사람이 고쳤으면 사람 것이다
                const fromAi = ai && aliasPick[u.name] === ai.kpi;
                return (
                  <UnknownRow key={u.name}>
                    <b>{u.name}</b>
                    <Small>{u.count}회</Small>
                    <Select
                      value={aliasPick[u.name] || ''}
                      onChange={(e) => setAliasPick(p => ({ ...p, [u.name]: e.target.value }))}
                    >
                      <option value="">— 어느 KPI 인가요? —</option>
                      {kpiDefinitions.map((d) => (
                        <option key={d.id} value={d.label}>{d.label}</option>
                      ))}
                    </Select>
                    {fromAi && (
                      <AiTag $low={ai.confidence === 'low'} title={ai.why || ''}>
                        AI 제안{ai.confidence === 'low' ? ' · 확신 낮음' : ''}
                      </AiTag>
                    )}
                  </UnknownRow>
                );
              })}
            </Section>
          )}

          {/* ── KPI 미리보기 ── */}
          {tab === 'kpi' && result?.rows?.length > 0 && (
            <Section>
              <SecTitle>
                읽은 값 {result.rows.length}건
                <SecNote>체크한 것만 저장합니다.</SecNote>
              </SecTitle>
              <Table>
                <thead>
                  <tr>
                    <th style={{ width: 34 }} />
                    <th>사업부</th><th>KPI</th><th>값</th><th>기존 값</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r, i) => {
                    const k = rowKey(r, i);
                    const changed = r.existing && r.existing.value !== r.value;
                    return (
                      <tr key={k}>
                        <td>
                          <input type="checkbox" checked={!!picked[k]}
                                 onChange={() => setPicked(p => ({ ...p, [k]: !p[k] }))} />
                        </td>
                        <td>{r.division}</td>
                        <td>{r.kpi}</td>
                        <td>
                          <b>{r.value}</b>{r.unit}
                          {r.numerator && <Small> ({r.numerator}/{r.denominator})</Small>}
                        </td>
                        <td>
                          {r.existing
                            ? <Was $changed={changed}>{r.existing.value}{r.unit}</Was>
                            : <Small>신규</Small>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Section>
          )}

          {/* ── 주간 동향 미리보기 ── */}
          {tab === 'weekly' && result?.sections?.length > 0 && (
            <Section>
              <SecTitle>
                읽은 구획 {result.sections.length}개
                <SecNote>원문을 그대로 넣습니다. 요약하지 않습니다.</SecNote>
              </SecTitle>
              {result.sections.map((s, i) => (
                <TrendCard key={`s${i}`}>
                  <TrendHead>
                    <input type="checkbox" checked={!!picked[`s${i}`]}
                           onChange={() => setPicked(p => ({ ...p, [`s${i}`]: !p[`s${i}`] }))} />
                    <b>{s.division}</b>
                    <Select value={catPick[`s${i}`] || s.category} style={{ width: 90 }}
                            onChange={(e) => setCatPick(p => ({ ...p, [`s${i}`]: e.target.value }))}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </Select>
                    <Small>{s.lineFrom}번째 줄부터</Small>
                    {s.existing != null && <Was $changed>기존 내용 있음 — 덮어씁니다</Was>}
                  </TrendHead>
                  <Pre>{s.content}</Pre>
                </TrendCard>
              ))}
            </Section>
          )}

          {done && (
            <Banner $ok>
              {done.savedCount}건을 저장했습니다.
              {done.aliasCount ? ` 이름 연결 ${done.aliasCount}개도 기억했습니다.` : ''}
            </Banner>
          )}
        </Body>

        <Foot>
          <Small>
            {tab === 'kpi' && !baseDate && '기준일을 먼저 골라 주세요.'}
            {tab === 'weekly' && (!year || !week) && '연도와 주차를 골라 주세요.'}
          </Small>
          <Spacer />
          <Ghost type="button" onClick={onClose}>닫기</Ghost>
          <Primary type="button" onClick={save} disabled={busy || !canSave}>
            {busy ? '저장 중…'
              : tab === 'kpi'
                ? `${chosenRows.length}건 저장`
                : `${chosenSections.length}개 저장`}
          </Primary>
        </Foot>
      </Modal>
    </Overlay>
  );
};

/* ── 스타일 ── */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2100;
  padding: 16px;
`;

const Modal = styled.div`
  background: #fff;
  border-radius: 16px;
  width: 860px;
  max-width: 96vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  padding: 18px 22px;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const Title = styled.h3`
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #1e293b;
`;

const Close = styled.button`
  margin-left: auto;
  border: none;
  background: none;
  font-size: 16px;
  color: #64748b;
  cursor: pointer;
`;

const Tabs = styled.div`
  display: flex;
  gap: 6px;
  padding: 10px 22px 0;
  flex-shrink: 0;
`;

const Tab = styled.button`
  padding: 7px 14px;
  border-radius: 8px 8px 0 0;
  border: 1px solid ${p => (p.$on ? '#c7d2fe' : 'transparent')};
  border-bottom: none;
  background: ${p => (p.$on ? '#eef2ff' : 'transparent')};
  color: ${p => (p.$on ? '#4338ca' : '#64748b')};
  font-size: 13px;
  font-weight: ${p => (p.$on ? 700 : 500)};
  cursor: pointer;
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px 22px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Lead = styled.p`
  margin: 0;
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
  flex-shrink: 0;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex-shrink: 0;
`;

const Label = styled.span`
  font-size: 12px;
  font-weight: 700;
  color: #475569;
`;

const Hint = styled.span`
  font-size: 12px;
  color: #94a3b8;
`;

const Small = styled.span`
  font-size: 11px;
  color: #94a3b8;
`;

const Input = styled.input`
  padding: 6px 9px;
  font-size: 13px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
`;

const Select = styled.select`
  padding: 6px 9px;
  font-size: 13px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: #fff;
`;

const Textarea = styled.textarea`
  min-height: 130px;
  padding: 10px 12px;
  font-family: 'Consolas', 'D2Coding', monospace;
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre;
  overflow-x: auto;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  resize: vertical;
  flex-shrink: 0;

  &:focus { outline: 2px solid #c7d2fe; border-color: #6366f1; }
`;

const Primary = styled.button`
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: #4f46e5;
  border: 1px solid #4f46e5;
  border-radius: 8px;
  cursor: pointer;
  &:disabled { opacity: 0.5; cursor: default; }
`;

const Ghost = styled.button`
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  cursor: pointer;
`;

const Banner = styled.div`
  flex-shrink: 0;
  padding: 8px 11px;
  font-size: 12.5px;
  line-height: 1.6;
  border-radius: 8px;
  color: ${p => (p.$err ? '#991b1b' : p.$ok ? '#065f46' : '#92400e')};
  background: ${p => (p.$err ? '#fef2f2' : p.$ok ? '#ecfdf5' : '#fffbeb')};
  border: 1px solid ${p => (p.$err ? '#fecaca' : p.$ok ? '#a7f3d0' : '#fde68a')};
`;

const Section = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const SecTitle = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
`;

const SecNote = styled.span`
  font-size: 11.5px;
  font-weight: 500;
  color: #94a3b8;
`;

/* 「AI 로 맞춰보기」 — 제목 줄 오른쪽 끝에 붙는다. 눌러야만 AI 가 돈다. */
const AiBtn = styled.button`
  margin-left: auto;
  flex-shrink: 0;
  padding: 3px 9px;
  font-size: 11.5px;
  font-weight: 600;
  color: #7c3aed;
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  border-radius: 999px;
  cursor: pointer;

  &:hover:not(:disabled) { background: #ede9fe; }
  &:disabled { opacity: 0.6; cursor: default; }
`;

/* AI 가 채운 칸에만 붙는 표식. 확신이 낮으면 색을 달리해 눈에 걸리게 한다. */
const AiTag = styled.span`
  flex-shrink: 0;
  padding: 2px 6px;
  font-size: 10.5px;
  font-weight: 600;
  border-radius: 999px;
  color: ${p => (p.$low ? '#b45309' : '#7c3aed')};
  background: ${p => (p.$low ? '#fef3c7' : '#f5f3ff')};
  border: 1px solid ${p => (p.$low ? '#fcd34d' : '#ddd6fe')};
`;

const UnknownRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 9px;
  font-size: 13px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;

  th, td {
    padding: 5px 8px;
    text-align: left;
    border-bottom: 1px solid #f1f5f9;
  }
  th { color: #64748b; font-weight: 600; background: #f8fafc; }
`;

const Was = styled.span`
  font-size: 11.5px;
  font-weight: ${p => (p.$changed ? 700 : 500)};
  color: ${p => (p.$changed ? '#b45309' : '#94a3b8')};
`;

const TrendCard = styled.div`
  /* 부모(Section)가 세로 flex 인데 여기에 overflow 가 걸려 있어, 안 박아 두면
     구획이 많아질 때 flex 항목의 최소 크기가 0 이 되어 전부 납작해진다.
     (Flexbox §4.5 — 「과제PL 계정 연결」이 이것 때문에 운영에서 터졌다) */
  flex-shrink: 0;
  border: 1px solid #e2e8f0;
  border-radius: 9px;
  overflow: hidden;
`;

const TrendHead = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 9px;
  font-size: 13px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
`;

const Pre = styled.pre`
  /* 지금은 TrendCard 가 블록이라 flex 항목이 아니지만, 나중에 세로 flex 로
     바꾸면 위와 같은 이유로 조용히 눌린다. 미리 박아 둔다. */
  flex-shrink: 0;
  margin: 0;
  padding: 8px 11px;
  font-family: inherit;
  font-size: 12.5px;
  line-height: 1.65;
  color: #334155;
  white-space: pre-wrap;
  max-height: 150px;
  overflow-y: auto;
`;

const Foot = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 22px;
  border-top: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const Spacer = styled.div`flex: 1;`;

export default ImportModal;
