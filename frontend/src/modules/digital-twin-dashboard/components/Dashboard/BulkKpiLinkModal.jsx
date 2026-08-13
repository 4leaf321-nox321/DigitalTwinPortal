/**
 * 과제-KPI 연결 **일괄 편집** — 관리자·사무국. (2026-08-08 요청)
 *
 * 왜 있나
 *     연초에 과제가 한꺼번에 등록되거나, 지표가 새로 생기면 연결을 수십 건 세워야
 *     한다. 과제 편집창을 하나씩 여는 것 말고는 길이 없었다.
 *
 * 세 걸음
 *     ① 대상 고르기   진입점이 골라 준 묶음에서 뺄 것을 뺀다
 *     ② 연결 정의     과제 × 지표 격자. 칸을 눌러 등급을 돌리고, **지표 열마다**
 *                     기여방법을 고른다
 *     ③ 미리보기      서버 dryRun 결과를 유형별로 보여 주고, 눌러야 적용된다
 *
 * ★ 기여방법은 **칸마다** 고른다 (2026-08-08 변경)
 *   처음엔 지표 열 하나에 방법 묶음 하나였는데, 같은 지표라도 과제마다 기여하는
 *   방식이 다르다는 지적을 받았다. 칸을 누르면 그 칸의 등급과 방법을 함께 고른다.
 *   열 머리의 단추는 **빠른 칠하기**로 남겼다 — 20줄을 하나씩 누르는 건 일이다.
 *
 * ★ 그래서 `methodMode`(더하기/갈아끼우기) 선택지가 없다
 *   칸에서 고른 것이 곧 **그 칸의 최종 목록**이다. 화면이 최종 목록을 알고 있으니
 *   서버에는 늘 'replace' 로 보낸다.
 *   ⚠️ 그 대신 **손대지 않은 칸도 현재 방법을 그대로 실어 보내야** 한다.
 *      빈 배열을 보내면 replace 가 남의 기록을 지운다. `cells` 주석 참고.
 *
 * ★ 연결 해제는 **칸마다 하나씩만** (2026-08-08 추가)
 *   '이 열 전부 해제' 같은 것은 일부러 안 만들었다. 한 번의 오조작이 되돌리기
 *   어려운 크기로 번진다. 칸을 열어 빨간 단추를 눌러야 하고, 미리보기가 무엇이
 *   사라지는지(등급·방법 개수까지) 먼저 말한다.
 */

import React, { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { X, Loader2, ChevronLeft, ChevronRight, Check, AlertTriangle, Trash2 } from 'lucide-react';

import { bulkKpiLinks } from '../../services/settingsApi';

/* 등급 — 서버 KPI_RELATION_TYPES 와 **같은 값**이어야 한다. */
const RELS = [
  { key: 'primary', label: '주기여', short: '주', c: '#1d4ed8', bg: '#dbeafe' },
  { key: 'support', label: '보조기여', short: '보', c: '#047857', bg: '#d1fae5' },
  { key: 'indirect', label: '간접기여', short: '간', c: '#b45309', bg: '#fef3c7' },
];
const REL_OF = (k) => RELS.find((r) => r.key === k) || null;

/* 미리보기 유형 — 서버 summary 의 키와 1:1 이다. */
const KINDS = [
  { key: 'created', label: '신규', c: '#047857', bg: '#ecfdf5' },
  { key: 'relation', label: '등급 변경', c: '#b45309', bg: '#fffbeb' },
  { key: 'methods', label: '방법 변경', c: '#1d4ed8', bg: '#eff6ff' },
  { key: 'removed', label: '연결 해제', c: '#b91c1c', bg: '#fef2f2' },
  { key: 'unchanged', label: '그대로', c: '#64748b', bg: '#f8fafc' },
  { key: 'skipped', label: '건너뜀', c: '#b91c1c', bg: '#fef2f2' },
];

const keyOf = (puid, kid, target) => `${puid}|${kid}|${target}`;

const BulkKpiLinkModal = ({
  open, onClose, onDone,
  projects = [],           // 후보 과제 (진입점이 골라 준 묶음)
  kpis = [],               // 지표 정의 [{kpiDefinitionId, label, divisions, kind}]
  divisions = [],          // [{name, code, isKpiOwner}]
  links = [],              // 현재 연결 [[puid, kid, target, note, rel]]
  settingsData,            // 기여방법 사전
  contextLabel,            // 어디서 들어왔는지 (머리말에 그대로 쓴다)
  preselectKpiIds = [],
}) => {
  const [step, setStep] = useState(1);
  const [sel, setSel] = useState(() => new Set());
  const [kpiSel, setKpiSel] = useState(() => new Set());
  /* key → {rel?, methods?} — **덮어쓸 것만** 담는다. 없으면 현재값을 그대로 쓴다. */
  const [grid, setGrid] = useState(() => new Map());
  const [targetByProj, setTargetByProj] = useState(() => new Map());
  /** 열려 있는 칸 편집기 {p, kpi, rect} — 칸을 누르면 그 자리에 뜬다. */
  const [pick, setPick] = useState(null);
  /** 지표 고르기 패널이 열린 자리 (rect) — 열이 많을 때 열을 줄이는 길. */
  const [colPick, setColPick] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');

  const owners = useMemo(() => divisions.filter((d) => d.isKpiOwner), [divisions]);
  const ownerNames = useMemo(() => new Set(owners.map((d) => d.name)), [owners]);
  const codeOf = useMemo(
    () => new Map(divisions.map((d) => [d.name, d.code])), [divisions]);

  /** 지금 있는 연결 — 칸의 '현재값'. key → {rel, methods} */
  const current = useMemo(() => {
    const m = new Map();
    links.forEach(([puid, kid, target, note, rel]) => {
      m.set(keyOf(puid, kid, target || ''), {
        rel: rel || null,
        methods: String(note || '').split('\n').map((x) => x.trim()).filter(Boolean),
      });
    });
    return m;
  }, [links]);

  /* 열릴 때마다 처음 상태로. 남은 값을 물려받으면 지난번 선택이 조용히 섞인다. */
  useEffect(() => {
    if (!open) return;
    setStep(1); setErr(null); setPreview(null); setQ('');
    setGrid(new Map()); setPick(null); setColPick(null);
    setSel(new Set(projects.map((p) => p.uuid)));
    // 기능조직 과제는 지원할 사업부를 지목해야 한다. 후보들의 사업부가 하나뿐이면
    // 그걸 기본값으로 — 진입점이 사업부 화면인 경우가 대부분이라 거의 맞는다.
    const ctx = [...new Set(projects.map((p) => p.division).filter((d) => ownerNames.has(d)))];
    const fallback = ctx.length === 1 ? ctx[0] : (owners[0]?.name || '');
    const t = new Map();
    projects.forEach((p) => {
      t.set(p.uuid, ownerNames.has(p.division) ? p.division : fallback);
    });
    setTargetByProj(t);
    if (preselectKpiIds.length) {
      setKpiSel(new Set(preselectKpiIds));
    } else {
      // 고른 과제 **어디에도 해당 없는** 지표는 빼고 연다. 남겨 봐야 빗금 열이다.
      const codes = new Set(projects
        .map((p) => (ownerNames.has(p.division) ? p.division : fallback))
        .map((n) => codeOf.get(n)).filter(Boolean));
      setKpiSel(new Set(kpis
        .filter((k) => (k.kind || 'metric') === 'metric')
        .filter((k) => !(k.divisions || []).length
          || (k.divisions || []).some((cd) => codes.has(cd)))
        .map((k) => k.kpiDefinitionId)));
    }
  }, [open]);   // eslint-disable-line react-hooks/exhaustive-deps

  const methodDict = settingsData?.kpiContributionMethods || {};
  const methodsFor = (kid) => methodDict[String(kid)] || [];

  const chosen = useMemo(
    () => projects.filter((p) => sel.has(p.uuid)), [projects, sel]);
  const cols = useMemo(
    () => kpis.filter((k) => kpiSel.has(k.kpiDefinitionId)), [kpis, kpiSel]);
  /** 고를 수 있는 지표 전체 — '플랫폼 구축' 같은 비측정 항목은 뺀다. */
  const allCols = useMemo(
    () => kpis.filter((k) => (k.kind || 'metric') === 'metric'), [kpis]);

  const targetOf = (p) => (ownerNames.has(p.division)
    ? p.division
    : (targetByProj.get(p.uuid) || ''));

  /** 그 대상 사업부가 이 지표를 관리하나. 아니면 '해당 없음' 칸이다. */
  const applies = (kpi, target) => {
    const scope = kpi.divisions || [];
    if (!target) return false;
    return !scope.length || scope.includes(codeOf.get(target));
  };

  /**
   * 칸 하나의 상태. **현재값 위에 내가 덮어쓴 것**을 얹어 본다.
   *   had        지금 연결이 있나 (등급이 있나와 **다른 말**이다 — 20% 가 등급 없음)
   *   rel        보여 줄 등급
   *   methods    보여 줄 기여방법 (손 안 댔으면 현재 그대로)
   */
  const cellState = (p, kpi) => {
    const target = targetOf(p);
    const k = keyOf(p.uuid, kpi.kpiDefinitionId, target);
    const cur = current.get(k);
    const g = grid.get(k) || {};
    return {
      k, target,
      had: !!cur,
      curRel: cur?.rel ?? null,
      curMethods: cur?.methods || [],
      rel: 'rel' in g ? g.rel : (cur?.rel ?? null),
      /* ⚠️ `in` 으로 봐야 한다. `g.methods || …` 로 쓰면 **빈 배열이 falsy** 라
         마지막 방법의 체크를 풀었을 때 현재값으로 되돌아가, 눌러도 안 풀리는
         것처럼 보인다. rel 이 `'rel' in g` 인 것과 같은 이유다. */
      methods: 'methods' in g ? g.methods : (cur?.methods || []),
      remove: !!g.remove,
      touched: !!grid.has(k),
    };
  };

  /** 칸 하나를 고쳐 쓴다. 현재값과 같아지면 덮어쓴 것을 지운다(= 안 건드린 상태). */
  const setCell = (p, kpi, patch) => setGrid((prev) => {
    const st = cellState(p, kpi);
    const m = new Map(prev);
    const next = { rel: st.rel, methods: st.methods, ...patch };
    // 해제로 표시한 칸은 '같아졌다'로 지워지면 안 된다 — 해제 자체가 변경이다
    if (next.remove) { m.set(st.k, next); return m; }
    const same = next.rel === st.curRel
      && next.methods.length === st.curMethods.length
      && next.methods.every((x, i) => x === st.curMethods[i]);
    if (same) m.delete(st.k); else m.set(st.k, next);
    return m;
  });

  /** 열 전체 등급 칠하기 — 20줄을 하나씩 누르는 건 일이다. */
  const paintRel = (kpi, rel) => setGrid((prev) => {
    const m = new Map(prev);
    chosen.forEach((p) => {
      const st = cellState(p, kpi);
      if (!applies(kpi, st.target) || st.remove) return;   // 해제로 표시한 칸은 건너뛴다
      const next = { rel, methods: st.methods };
      const same = rel === st.curRel
        && next.methods.length === st.curMethods.length
        && next.methods.every((x, i) => x === st.curMethods[i]);
      if (same) m.delete(st.k); else m.set(st.k, next);
    });
    return m;
  });

  /**
   * 열 전체에 방법 **더하기**. 갈아끼우지 않는다 —
   * 빠른 채우기용이라, 칸마다 다르게 적어 둔 것을 쓸어버리면 안 된다.
   * 칸을 눌러 들어가면 그 칸만 정확히 고칠 수 있다.
   */
  const addMethodsToColumn = (kpi, ms) => setGrid((prev) => {
    const m = new Map(prev);
    chosen.forEach((p) => {
      const st = cellState(p, kpi);
      if (!applies(kpi, st.target) || st.remove) return;
      if (!st.rel && !st.had) return;          // 연결도 등급도 없는 칸은 건드리지 않는다
      const merged = [...st.methods, ...ms.filter((x) => !st.methods.includes(x))];
      m.set(st.k, { rel: st.rel, methods: merged });
    });
    return m;
  });

  /**
   * 보낼 칸들.
   *
   * ⚠️ 서버에 늘 `replace` 로 보낸다 — 화면이 최종 목록을 안다. 그래서
   *    **손대지 않은 칸도 현재 방법을 그대로 실어야** 한다. 빈 배열을 보내면
   *    replace 가 남이 적어 둔 기록을 지운다. (`cellState.methods` 가 손 안 댔을 때
   *    현재값을 돌려주는 이유가 이것이다)
   *
   * 보내는 조건
   *   · 등급이 있거나
   *   · 이미 연결이 있는 칸 (등급이 없어도 — 전체의 20%가 그렇다)
   * 둘 다 아니면 안 보낸다. 서버가 '등급 미지정' 연결을 새로 만들어,
   * 아무도 판단하지 않은 값이 데이터가 되기 때문이다.
   */
  const cells = useMemo(() => {
    const out = [];
    chosen.forEach((p) => {
      cols.forEach((kpi) => {
        const st = cellState(p, kpi);
        if (!applies(kpi, st.target)) return;
        if (st.remove) {
          out.push({
            projectUuid: p.uuid, kpiDefinitionId: kpi.kpiDefinitionId,
            targetDivision: st.target, remove: true,
          });
          return;
        }
        if (!st.rel && !st.had) return;
        out.push({
          projectUuid: p.uuid,
          kpiDefinitionId: kpi.kpiDefinitionId,
          relationType: st.rel,
          methods: st.methods,
          targetDivision: st.target,
        });
      });
    });
    return out;
  }, [chosen, cols, grid, targetByProj, current]);   // eslint-disable-line react-hooks/exhaustive-deps

  /** 내가 실제로 건드린 칸 수 — 미리보기 단추 옆에 낸다. */
  const touched = useMemo(() => grid.size, [grid]);

  const run = (dryRun) => {
    setBusy(true); setErr(null);
    // 미리보기와 실제가 **같은 몸통**이어야 한다 — dryRun 만 다르다
    bulkKpiLinks({ cells, methodMode: 'replace', dryRun })
      .then((d) => {
        setPreview(d);
        if (!dryRun) { onDone && onDone(); }
        else setStep(3);
      })
      .catch((e) => setErr(e.message || '실패했습니다.'))
      .finally(() => setBusy(false));
  };

  if (!open) return null;

  const noTarget = chosen.filter((p) => !targetOf(p));
  const applied = preview && preview.dryRun === false;

  return (
    <Overlay onClick={onClose}>
      <Box onClick={(e) => e.stopPropagation()}>
        <Head>
          <div>
            <h3>KPI 연결 일괄 편집</h3>
            <Ctx>{contextLabel || `과제 ${projects.length}건`}</Ctx>
          </div>
          <Steps>
            {['대상', '연결 정의', '확인'].map((s, i) => (
              <StepDot key={s} $on={step === i + 1} $done={step > i + 1}>
                {i + 1}. {s}
              </StepDot>
            ))}
          </Steps>
          <IconBtn onClick={onClose} aria-label="닫기"><X size={16} /></IconBtn>
        </Head>

        <Body>
          {err && <Bad><AlertTriangle size={14} /> {err}</Bad>}

          {/* ── ① 대상 ─────────────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <Row>
                <Search value={q} onChange={(e) => setQ(e.target.value)}
                        placeholder="과제명·코드로 거르기" />
                <Spacer />
                <Small onClick={() => setSel(new Set(projects.map((p) => p.uuid)))}>모두</Small>
                <Small onClick={() => setSel(new Set())}>해제</Small>
                <Count>{sel.size} / {projects.length}건</Count>
              </Row>
              <List>
                {projects
                  .filter((p) => !q
                    || `${p.code || ''} ${p.title || ''}`.toLowerCase().includes(q.toLowerCase()))
                  .map((p) => {
                    const n = links.filter((l) => l[0] === p.uuid).length;
                    return (
                      <Item key={p.uuid} $on={sel.has(p.uuid)}
                            onClick={() => setSel((prev) => {
                              const s = new Set(prev);
                              if (s.has(p.uuid)) s.delete(p.uuid); else s.add(p.uuid);
                              return s;
                            })}>
                        <input type="checkbox" readOnly checked={sel.has(p.uuid)} />
                        <Div>{p.division}</Div>
                        <Title2>{p.title}</Title2>
                        <Dim>{n ? `연결 ${n}` : '미연결'}</Dim>
                      </Item>
                    );
                  })}
              </List>
            </>
          )}

          {/* ── ② 격자 ─────────────────────────────────────────────────── */}
          {step === 2 && (
            <>
              <Row>
                <Note>
                  <b>칸을 누르면</b> 그 칸의 등급과 기여방법을 고릅니다.
                  열 머리 단추는 그 열 전체를 한 번에 칠합니다.
                  이미 있는 연결은 등급·방법만 바꿀 수 있고 여기서 지울 수는 없습니다.
                  <Legend>
                    <i><Pill $c="#1d4ed8" $bg="#dbeafe" $new>주</Pill> 신규</i>
                    <i><Pill $c="#1d4ed8" $bg="#dbeafe" $moved>주</Pill> 바뀜</i>
                    <i><Pill $c="#1d4ed8" $bg="#dbeafe">주</Pill> 그대로</i>
                    <i><NoGrade>·</NoGrade> 연결만 있고 등급 없음</i>
                    <i><MDot /> 기여방법 있음</i>
                    <i><Gone>&#10005;</Gone> 해제 예정</i>
                  </Legend>
                </Note>
                <Spacer />
                {/* 지표 고르기 — 열이 많으면 가로로 넘쳐 고르기가 힘들다.
                    `kpiSel` 은 처음부터 있었는데 바꿀 길이 없었다 (2026-08-08). */}
                <ColPickBtn type="button" $on={cols.length < allCols.length}
                            onClick={(e) => setColPick(
                              colPick ? null : e.currentTarget.getBoundingClientRect())}>
                  지표 {cols.length}/{allCols.length}
                </ColPickBtn>
              </Row>

              {noTarget.length > 0 && (
                <Bad>
                  <AlertTriangle size={14} />
                  지원할 사업부를 고르지 않은 과제 {noTarget.length}건이 있습니다 — 그 줄은 빠집니다.
                </Bad>
              )}

              <GridWrap>
                <table>
                  <thead>
                    <tr>
                      <th className="lead">과제</th>
                      {cols.map((k) => (
                        <th key={k.kpiDefinitionId}>
                          <ColName title={k.label}>{k.label}</ColName>
                          <ColBtns>
                            {RELS.map((r) => (
                              <MiniBtn key={r.key} $c={r.c}
                                       onClick={() => paintRel(k, r.key)}
                                       title={`이 열 전부 ${r.label}`}>{r.short}</MiniBtn>
                            ))}
                            {/* 열 전체에 방법 **더하기**. 칸마다 적어 둔 것을 안 쓸어버린다 */}
                            <MiniBtn $c="#0f766e"
                                     onClick={(e) => setPick({
                                       col: k,
                                       rect: e.currentTarget.getBoundingClientRect(),
                                     })}
                                     title="이 열 전체에 기여방법 더하기">방법</MiniBtn>
                          </ColBtns>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chosen.map((p) => {
                      const func = !ownerNames.has(p.division);
                      const target = targetOf(p);
                      return (
                        <tr key={p.uuid}>
                          <td className="lead">
                            <LeadName title={p.title}>{p.title}</LeadName>
                            {func ? (
                              <TargetPick
                                value={target}
                                onChange={(e) => setTargetByProj((prev) => {
                                  const m = new Map(prev);
                                  m.set(p.uuid, e.target.value);
                                  return m;
                                })}
                                title="이 과제가 지원할 사업부"
                              >
                                <option value="">지원 사업부 고르기</option>
                                {owners.map((d) => (
                                  <option key={d.name} value={d.name}>{d.name}</option>
                                ))}
                              </TargetPick>
                            ) : <Div>{p.division}</Div>}
                          </td>
                          {cols.map((k) => {
                            const st = cellState(p, k);
                            const na = !applies(k, st.target);
                            const r = REL_OF(st.rel);
                            const isNew = st.rel && !st.had;
                            const moved = st.rel && st.had && st.rel !== st.curRel;
                            const open2 = pick?.p?.uuid === p.uuid
                              && pick?.kpi?.kpiDefinitionId === k.kpiDefinitionId;
                            return (
                              <Cell key={k.kpiDefinitionId} $na={na} $open={open2}
                                    onClick={(e) => {
                                      if (na) return;
                                      /* 빈 칸을 누르면 **주기여로 걸어 둔다** (2026-08-08 요청).
                                         과제 편집창의 KPI 연결과 같은 기본값이다. 대부분이
                                         주기여이고, 아니면 바로 위 단추로 바꾸면 된다.
                                         이미 연결이 있는 칸은 건드리지 않는다. */
                                      if (!st.had && !st.rel) {
                                        setCell(p, k, { rel: 'primary' });
                                      }
                                      setPick({
                                        p, kpi: k,
                                        rect: e.currentTarget.getBoundingClientRect(),
                                      });
                                    }}
                                    title={na
                                      ? `${st.target || '대상 미지정'} 은(는) 이 지표를 관리하지 않습니다`
                                      : `${p.title} → ${k.label}`
                                        + (st.had ? `\n현재: ${REL_OF(st.curRel)?.label || '등급 미지정'}`
                                          + (st.curMethods.length ? ` · 방법 ${st.curMethods.length}개` : '')
                                          : '\n연결 없음')}>
                                {!na && st.remove && <Gone title="연결 해제 예정">✕</Gone>}
                                {!na && !st.remove && r && (
                                  <Pill $c={r.c} $bg={r.bg} $new={isNew} $moved={moved}>
                                    {r.short}
                                  </Pill>
                                )}
                                {!na && !st.remove && !r && st.had && (
                                  <NoGrade title="연결은 있으나 등급 미지정">·</NoGrade>
                                )}
                                {/* 방법이 붙어 있으면 점 하나 — 칸이 좁아 글자는 못 넣는다 */}
                                {!na && !st.remove && st.methods.length > 0
                                  && <MDot title={st.methods.join('\n')} />}
                              </Cell>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </GridWrap>

              {colPick && (
                <>
                  <PickShade onClick={() => setColPick(null)} />
                  <PickPanel
                    style={{
                      left: Math.min(colPick.left, window.innerWidth - 300),
                      top: Math.min(colPick.bottom + 6, window.innerHeight - 320),
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <PickHead>
                      <b>격자에 세울 지표</b>
                      <span>연결 데이터는 그대로입니다 — 보이는 열만 바뀝니다</span>
                    </PickHead>
                    <PickSect>
                      <RelRow style={{ marginBottom: '0.3rem' }}>
                        <RelBtn onClick={() => setKpiSel(
                          new Set(allCols.map((k) => k.kpiDefinitionId)))}>모두</RelBtn>
                        <RelBtn onClick={() => setKpiSel(
                          // 전부 끄면 빈 격자가 된다 — 첫 줄 하나는 남긴다
                          new Set(allCols.slice(0, 1).map((k) => k.kpiDefinitionId)))}>해제</RelBtn>
                      </RelRow>
                      <Opts>
                        {allCols.map((k) => {
                          const on = kpiSel.has(k.kpiDefinitionId);
                          // 고른 과제 어디에도 해당 없는 지표는 켜 봐야 빗금 열이다
                          const useless = !chosen.some((p) => applies(k, targetOf(p)));
                          return (
                            <Opt key={k.kpiDefinitionId} $on={on} aria-selected={on}
                                 onKeyDown={(e) => {
                                   if (e.key === 'Enter' || e.key === ' ') {
                                     e.preventDefault(); e.currentTarget.click();
                                   }
                                 }}
                                 onClick={() => setKpiSel((prev) => {
                                   const n = new Set(prev);
                                   if (n.has(k.kpiDefinitionId)) n.delete(k.kpiDefinitionId);
                                   else n.add(k.kpiDefinitionId);
                                   return n.size ? n : prev;   // 마지막 하나는 못 끈다
                                 })}>
                              <OptMark $on={on}><Check size={13} strokeWidth={3} /></OptMark>
                              <span>{k.label}</span>
                              {useless && <Dim style={{ fontSize: '0.64rem' }}>해당 없음</Dim>}
                            </Opt>
                          );
                        })}
                      </Opts>
                    </PickSect>
                    <PickFoot>
                      <Primary onClick={() => setColPick(null)}>확인</Primary>
                    </PickFoot>
                  </PickPanel>
                </>
              )}

              {/* ── 칸(또는 열) 편집기 ─────────────────────────────────────
                  화면 좌표(fixed)로 띄운다. 격자가 스스로 스크롤하는 상자라
                  그 안에 absolute 로 넣으면 스크롤할 때 따로 논다. */}
              {pick && (() => {
                const isCol = !!pick.col;
                const kpi = isCol ? pick.col : pick.kpi;
                const st = isCol ? null : cellState(pick.p, pick.kpi);
                // 사전에 없어도 이미 적혀 있는 문구는 보여 준다 — 안 그러면
                // "화면에 없는데 데이터에는 있는" 방법이 생긴다
                const opts = [...new Set([
                  ...methodsFor(kpi.kpiDefinitionId),
                  ...(st ? st.methods : []),
                ])];
                // 패널 크기와 **같은 값**을 써야 화면 밖으로 안 나간다 (PICK_W/PICK_H)
                const left = Math.min(Math.max(pick.rect.left, 8),
                                      window.innerWidth - PICK_W - 8);
                const below = pick.rect.bottom + 6;
                const top = below + PICK_H > window.innerHeight
                  ? Math.max(pick.rect.top - PICK_H - 6, 8) : below;
                return (
                  <>
                    <PickShade onClick={() => setPick(null)} />
                    <PickPanel style={{ left, top }} onClick={(e) => e.stopPropagation()}>
                      <PickHead>
                        <b>{isCol ? `${kpi.label} — 열 전체` : pick.p.title}</b>
                        <span>{isCol ? '고른 방법을 이 열 전체에 더합니다' : kpi.label}</span>
                      </PickHead>

                      {!isCol && st.remove && (
                        <PickSect>
                          <Warn>
                            <AlertTriangle size={13} />
                            이 연결은 <b>해제됩니다.</b> 적힌 기여방법도 함께 사라집니다.
                          </Warn>
                        </PickSect>
                      )}

                      {!isCol && !st.remove && (
                        <PickSect>
                          <h5>기여 등급</h5>
                          <RelRow>
                            <RelBtn $on={!st.rel}
                                    onClick={() => setCell(pick.p, pick.kpi, { rel: null })}>
                              {st.had ? '등급 없음' : '연결 안 함'}
                            </RelBtn>
                            {RELS.map((r) => (
                              <RelBtn key={r.key} $on={st.rel === r.key} $c={r.c}
                                      onClick={() => setCell(pick.p, pick.kpi, { rel: r.key })}>
                                {r.label}
                              </RelBtn>
                            ))}
                          </RelRow>
                        </PickSect>
                      )}

                      {!(!isCol && st.remove) && (
                      <PickSect>
                        <h5>기여 방법 {!isCol && `(${st.methods.length}개 선택)`}</h5>
                        {!opts.length ? (
                          <Empty2>
                            이 지표의 방법 사전이 비어 있습니다.<br />
                            <b>설정 ▸ KPI 기여방법</b> 에서 먼저 등록하세요.
                          </Empty2>
                        ) : (
                          <Opts>
                            {opts.map((m) => {
                              const on = isCol
                                ? (pick.picked || []).includes(m)
                                : st.methods.includes(m);
                              return (
                                <Opt key={m} $on={on} aria-selected={on}
                                     onKeyDown={(e) => {
                                       if (e.key === 'Enter' || e.key === ' ') {
                                         e.preventDefault(); e.currentTarget.click();
                                       }
                                     }}
                                     onClick={() => {
                                       if (isCol) {
                                         setPick((prev) => {
                                           const cur2 = prev.picked || [];
                                           return { ...prev,
                                             picked: cur2.includes(m)
                                               ? cur2.filter((x) => x !== m) : [...cur2, m] };
                                         });
                                       } else {
                                         setCell(pick.p, pick.kpi, {
                                           methods: on ? st.methods.filter((x) => x !== m)
                                             : [...st.methods, m],
                                         });
                                       }
                                     }}>
                                  <OptMark $on={on}><Check size={13} strokeWidth={3} /></OptMark>
                                  <span>{m}</span>
                                </Opt>
                              );
                            })}
                          </Opts>
                        )}
                      </PickSect>
                      )}

                      {/* 연결 자체를 없애는 길 — **칸마다 하나씩만**. 열 단위 해제는
                          일부러 안 만들었다(파일 머리말). */}
                      {!isCol && st.had && (
                        <PickSect>
                          <h5>연결 자체를 없애기</h5>
                          {st.remove ? (
                            <UndoBtn onClick={() => setGrid((prev) => {
                              const m = new Map(prev); m.delete(st.k); return m;
                            })}>
                              해제 취소 — 이 연결을 그대로 둡니다
                            </UndoBtn>
                          ) : (
                            <DangerBtn onClick={() => setCell(pick.p, pick.kpi, { remove: true })}>
                              <Trash2 size={12} /> 이 연결 해제
                            </DangerBtn>
                          )}
                        </PickSect>
                      )}

                      <PickFoot>
                        {isCol ? (
                          <>
                            <Small onClick={() => setPick(null)}>취소</Small>
                            <Primary
                              disabled={!(pick.picked || []).length}
                              onClick={() => {
                                addMethodsToColumn(kpi, pick.picked || []);
                                setPick(null);
                              }}
                            >
                              열 전체에 더하기
                            </Primary>
                          </>
                        ) : <Primary onClick={() => setPick(null)}>확인</Primary>}
                      </PickFoot>
                    </PickPanel>
                  </>
                );
              })()}
            </>
          )}

          {/* ── ③ 미리보기 / 결과 ──────────────────────────────────────── */}
          {step === 3 && preview && (
            <>
              <Sums>
                {KINDS.map((k) => (
                  <Sum key={k.key} $c={k.c} $bg={k.bg} $zero={!preview.summary[k.key]}>
                    <b>{preview.summary[k.key]}</b> {k.label}
                  </Sum>
                ))}
              </Sums>
              {applied && (
                <Good><Check size={14} /> 적용했습니다. 과제 {preview.projects}건이 바뀌었습니다.</Good>
              )}
              <PrevWrap>
                <table>
                  <thead>
                    <tr><th>과제</th><th>지표</th><th>대상</th><th>결과</th></tr>
                  </thead>
                  <tbody>
                    {preview.rows
                      /* 그대로인 칸은 아래로 — 볼 것은 바뀌는 것과 건너뛴 것이다 */
                      .slice()
                      .sort((a, b) => (a.kind === 'unchanged') - (b.kind === 'unchanged'))
                      .map((r, i) => {
                        const k = KINDS.find((x) => x.key === r.kind);
                        return (
                          <tr key={i}>
                            <td>{r.title || r.projectUuid}</td>
                            <td>{r.kpiLabel}</td>
                            <td>{r.targetDivision}</td>
                            <td><Tag $c={k.c} $bg={k.bg}>{k.label}</Tag> <Dim>{r.detail}</Dim></td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </PrevWrap>
            </>
          )}
        </Body>

        <Foot>
          {step > 1 && !applied && (
            <Btn onClick={() => { setStep(step - 1); setPreview(null); }}>
              <ChevronLeft size={14} /> 이전
            </Btn>
          )}
          <Spacer />
          {step === 1 && (
            <Primary disabled={!sel.size} onClick={() => setStep(2)}>
              다음 <ChevronRight size={14} />
            </Primary>
          )}
          {step === 2 && (
            <>
              <Count>{cells.length}칸</Count>
              <Primary disabled={!cells.length || busy} onClick={() => run(true)}>
                {busy ? <Loader2 size={14} className="spin" /> : null} 미리보기
              </Primary>
            </>
          )}
          {step === 3 && (applied
            ? <Primary onClick={onClose}>닫기</Primary>
            : (
              <Primary
                $danger={preview.summary.removed > 0}
                disabled={busy || !(preview.summary.created + preview.summary.relation
                                    + preview.summary.methods + preview.summary.removed)}
                onClick={() => run(false)}
              >
                {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                {preview.summary.removed > 0
                  ? ` 적용 (연결 ${preview.summary.removed}건 해제 포함)` : ' 적용'}
              </Primary>
            ))}
        </Foot>
      </Box>
    </Overlay>
  );
};

/* ── 모양 ─────────────────────────────────────────────────────────────────── */

const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 11000;
  background: rgba(15, 23, 42, 0.55);
  display: flex; align-items: center; justify-content: center; padding: 2rem;
`;
/*
  창은 화면 가로의 **80%** 다 (2026-08-08 요청). 지표 열이 많으면 격자가 가로로
  넘쳐 고르기가 힘들다는 지적.

  다만 폭만으로는 안 풀린다 — 지표 16개면 열만 2160px 라 80%(1920 화면에서 1536px)
  로도 넘친다. 그래서 같이 한 것 셋:
    ① 열 최소폭을 7.5→6rem, 과제 열을 15→13rem 으로 줄이고 지표명은 **두 줄까지** 접는다
    ② 조작줄에 **지표 고르기**를 달아 필요한 열만 남긴다 (kpiSel 상태는 원래 있었는데
       바꿀 길이 없었다)
    ③ 고른 과제 어디에도 **해당 없는 지표는 처음부터 빼고** 연다 — 사업부 전용
       지표가 남의 사업부 격자에 빗금으로만 서 있을 이유가 없다
  작은 화면에서 80% 가 되레 좁아지지 않게 바닥(min-width)을 둔다.
*/
const Box = styled.div`
  background: #fff; border-radius: 0.9rem;
  width: 80vw; min-width: min(96vw, 1040px); max-width: 96vw;
  height: min(860px, 92vh);
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;
const Head = styled.div`
  display: flex; align-items: center; gap: 1rem; padding: 0.9rem 1.1rem;
  border-bottom: 1px solid #e2e8f0; flex-shrink: 0;
  h3 { margin: 0; font-size: 1rem; font-weight: 800; color: #0f172a; }
`;
const Ctx = styled.div`font-size: 0.75rem; color: #64748b; margin-top: 0.15rem;`;
const Steps = styled.div`display: flex; gap: 0.3rem; margin-left: auto;`;
const StepDot = styled.span`
  padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.72rem; font-weight: 700;
  background: ${(p) => (p.$on ? '#4338ca' : p.$done ? '#e0e7ff' : '#f1f5f9')};
  color: ${(p) => (p.$on ? '#fff' : p.$done ? '#3730a3' : '#94a3b8')};
`;
const IconBtn = styled.button`
  border: 0; background: transparent; cursor: pointer; color: #64748b; padding: 0.2rem;
  &:hover { color: #0f172a; }
`;
const Body = styled.div`
  flex: 1 1 0; min-height: 0; overflow: auto; padding: 0.9rem 1.1rem;
  display: flex; flex-direction: column; gap: 0.6rem;
`;
const Foot = styled.div`
  display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.1rem;
  border-top: 1px solid #e2e8f0; flex-shrink: 0; background: #f8fafc;
  .spin { animation: sp 1s linear infinite; }
  @keyframes sp { to { transform: rotate(360deg); } }
`;
const Spacer = styled.div`flex: 1;`;
const Row = styled.div`display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;`;
const Note = styled.div`font-size: 0.75rem; color: #475569;`;
const Legend = styled.span`
  display: inline-flex;
  gap: 0.7rem;
  margin-left: 0.6rem;
  i { font-style: normal; display: inline-flex; align-items: center; gap: 0.2rem;
      color: #64748b; font-size: 0.7rem; }
`;

const Count = styled.span`font-size: 0.75rem; color: #475569; font-weight: 700;`;
const Dim = styled.span`font-size: 0.72rem; color: #94a3b8;`;
const Search = styled.input`
  padding: 0.3rem 0.55rem; border: 1px solid #cbd5e1; border-radius: 0.4rem;
  font-size: 0.78rem; width: 16rem; font-family: inherit;
`;
const Small = styled.button`
  padding: 0.2rem 0.5rem; border: 1px solid #e2e8f0; background: #fff; border-radius: 0.35rem;
  font-size: 0.72rem; color: #475569; cursor: pointer; &:hover { border-color: #cbd5e1; }
`;
const List = styled.div`
  border: 1px solid #e2e8f0; border-radius: 0.5rem; overflow: auto; flex: 1 1 0; min-height: 0;
`;
const Item = styled.div`
  display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.6rem;
  border-bottom: 1px solid #f1f5f9; cursor: pointer; font-size: 0.8rem;
  user-select: none;
  /* 줄 전체가 누르는 자리다 — 네모는 보여 주기만 하고 클릭을 가로채지 않는다 */
  input { pointer-events: none; }
  background: ${(p) => (p.$on ? '#f5f3ff' : '#fff')};
  &:hover { background: ${(p) => (p.$on ? '#ede9fe' : '#f8fafc')}; }
`;
const Div = styled.span`
  font-size: 0.68rem; font-weight: 700; color: #475569; background: #f1f5f9;
  padding: 0.05rem 0.35rem; border-radius: 0.3rem; white-space: nowrap;
`;
/*
  격자 과제 칸의 이름.

  Title2(=inline span) 를 그대로 쓰면 **열을 삐져나간다.** 1단계 목록에서는 부모가
  flex 라 flex:1 이 먹었지만, 격자에서는 부모가 <td> 라 아무 제약이 없고
  inline 요소는 overflow:hidden 도 안 듣는다. 블록으로 만들어야 잘린다.
*/
const LeadName = styled.div`
  display: block; max-width: 100%; color: #1f2937;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`;

const Title2 = styled.span`
  flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1f2937;
`;
const GridWrap = styled.div`
  flex: 1 1 0; min-height: 0; overflow: auto; border: 1px solid #e2e8f0; border-radius: 0.5rem;

  /*
    표는 **창 폭을 꽉 채운다** (2026-08-08 요청).

    width:100% + auto 레이아웃이라, 지표가 적으면 남는 폭을 열들이 나눠 갖고
    많으면 열의 min-width 가 이겨서 가로 스크롤이 생긴다 — 둘 다 원하는 모습이다.
    ⚠️ table-layout: fixed 로 하면 안 된다. 지표 16개일 때 열이 6rem 아래로도
       쪼그라들어 등급 알약과 지표명이 겹친다.
    ⚠️ 이 주석 안에 **백틱을 쓰지 말 것** — 템플릿 리터럴이 거기서 끊긴다.
  */
  table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.75rem; }
  th, td { border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; padding: 0.25rem; }
  th { position: sticky; top: 0; z-index: 2; background: #f8fafc; vertical-align: top;
       min-width: 6rem; }
  /* 과제 열은 가로로 스크롤해도 남아 있어야 한다 — 어느 줄인지 잃으면 칸을 못 읽는다.
     남는 폭은 지표 열들이 가져가야 하므로 여기는 **안 늘어나게** 못박는다. */
  .lead { position: sticky; left: 0; z-index: 1; background: #fff;
          width: 13rem; min-width: 13rem; max-width: 13rem; display: table-cell;
          overflow: hidden; }
  th.lead { z-index: 3; background: #f8fafc; }
  /* 넓어진 칸은 그만큼 누르기 쉬워야 한다 — 알약만 작게 남으면 넓힌 뜻이 없다 */
  tbody td:not(.lead) { height: 1.9rem; }
  tbody tr:hover td { background: #fafafa; }
  tbody tr:hover td.lead { background: #f5f5f5; }
`;
/* 좁아진 열에서도 읽히게 **두 줄까지** 접는다. 한 줄 말줄임은 지표 이름이
   앞부분만 남아 서로 구분이 안 된다(‘라인 유실률 (대표…’ / ‘라인 유실률 (전…’). */
const ColName = styled.div`
  font-weight: 700; color: #1f2937; font-size: 0.72rem; line-height: 1.25;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; word-break: keep-all; min-height: 1.8rem;
`;
const ColBtns = styled.div`display: flex; gap: 0.15rem; margin: 0.2rem 0;`;
const MiniBtn = styled.button`
  flex: 1; border: 1px solid #e2e8f0; background: #fff; border-radius: 0.25rem;
  font-size: 0.66rem; font-weight: 700; color: ${(p) => p.$c}; cursor: pointer; padding: 0.05rem;
  &:hover { border-color: ${(p) => p.$c}; }
`;
const TargetPick = styled.select`
  font-size: 0.68rem; font-family: inherit; padding: 0.05rem 0.2rem;
  border: 1px solid #fbbf24; border-radius: 0.3rem; background: #fffbeb; max-width: 9rem;
`;
const Cell = styled.td`
  text-align: center; cursor: ${(p) => (p.$na ? 'default' : 'pointer')};
  outline: ${(p) => (p.$open ? '2px solid #4338ca' : 'none')};
  outline-offset: -2px;
  background: ${(p) => (p.$na
    ? 'repeating-linear-gradient(45deg,#fafafa,#fafafa 4px,#f1f5f9 4px,#f1f5f9 8px)'
    : 'transparent')};
  min-width: 2.2rem;
`;
const Pill = styled.span`
  display: inline-block; min-width: 1.3rem; padding: 0.05rem 0.3rem; border-radius: 0.3rem;
  font-size: 0.7rem; font-weight: 800; color: ${(p) => p.$c}; background: ${(p) => p.$bg};
  /* 새로 세운 칸과 등급을 바꾼 칸은 **테두리로** 구분한다 — 색은 이미 등급이 쓴다 */
  box-shadow: ${(p) => (p.$new ? 'inset 0 0 0 1.5px #059669'
    : p.$moved ? 'inset 0 0 0 1.5px #d97706' : 'none')};
`;
/** 연결은 있는데 등급이 없는 칸. 빈칸(연결 없음)과 갈라 보이게만 한다. */
const NoGrade = styled.span`
  display: inline-block;
  color: #94a3b8;
  font-weight: 900;
  font-size: 0.9rem;
  line-height: 1;
`;

/** 기여방법이 붙어 있다는 표 — 칸이 좁아 글자는 못 넣는다. */
const MDot = styled.span`
  display: inline-block;
  width: 5px; height: 5px; border-radius: 50%;
  background: #0f766e;
  margin-left: 0.2rem;
  vertical-align: middle;
`;

const ColPickBtn = styled.button`
  padding: 0.2rem 0.6rem; border-radius: 0.4rem; cursor: pointer; font-family: inherit;
  border: 1px solid ${(p) => (p.$on ? '#4338ca' : '#cbd5e1')};
  background: ${(p) => (p.$on ? '#eef2ff' : '#fff')};
  color: ${(p) => (p.$on ? '#3730a3' : '#475569')};
  font-size: 0.74rem; font-weight: 700; white-space: nowrap;
  &:hover { border-color: #6366f1; }
`;

/* 칸 편집기 크기. 위치 계산이 **이 값을 그대로 쓴다** — 따로 적으면 어긋난다. */
const PICK_W = 360;
const PICK_H = 440;

const PickShade = styled.div`position: fixed; inset: 0; z-index: 11500;`;
const PickPanel = styled.div`
  position: fixed; z-index: 11501; width: ${PICK_W}px; max-height: ${PICK_H}px;
  display: flex; flex-direction: column;
  background: #fff; border: 1px solid #cbd5e1; border-radius: 0.55rem;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18); overflow: hidden;
`;
const PickHead = styled.div`
  padding: 0.45rem 0.6rem; border-bottom: 1px solid #f1f5f9; background: #f8fafc;
  b { display: block; font-size: 0.78rem; color: #0f172a;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  span { font-size: 0.7rem; color: #64748b; }
`;
const PickSect = styled.div`
  padding: 0.5rem 0.7rem; overflow: auto;
  h5 { margin: 0 0 0.25rem; font-size: 0.68rem; font-weight: 700; color: #64748b; }
  & + & { border-top: 1px solid #f1f5f9; }
`;
const RelRow = styled.div`display: flex; flex-wrap: wrap; gap: 0.2rem;`;
const RelBtn = styled.button`
  padding: 0.15rem 0.45rem; border-radius: 0.35rem; cursor: pointer;
  font-size: 0.7rem; font-weight: 700; font-family: inherit;
  border: 1px solid ${(p) => (p.$on ? (p.$c || '#475569') : '#e2e8f0')};
  background: ${(p) => (p.$on ? (p.$c || '#475569') : '#fff')};
  color: ${(p) => (p.$on ? '#fff' : '#64748b')};
  &:hover { border-color: ${(p) => p.$c || '#94a3b8'}; }
`;
const Opts = styled.div.attrs({ role: 'listbox', 'aria-multiselectable': true })`
  display: flex; flex-direction: column; gap: 0.1rem;
`;
/*
  방법 한 줄 = **줄 전체가 누르는 자리**다 (2026-08-08 요청).

  ⚠️ 전에는 `<label>` 안에 `<input type=checkbox>` 를 넣었는데, 그러면 글자를 눌렀을 때
     라벨이 체크박스로 클릭을 넘기고 그게 다시 라벨로 올라와 **onClick 이 두 번** 돈다.
     두 번 토글되니 아무 일도 안 일어나고, 네모를 직접 눌러야만 되는 것처럼 보였다.
     그래서 네이티브 체크박스를 버리고 줄 자체를 option 으로 만든다.
*/
const Opt = styled.div.attrs({ role: 'option', tabIndex: 0 })`
  display: flex; align-items: center; gap: 0.4rem; cursor: pointer;
  padding: 0.22rem 0.35rem; border-radius: 0.3rem; font-size: 0.73rem;
  user-select: none;
  background: ${(p) => (p.$on ? '#ecfdf5' : 'transparent')};
  color: ${(p) => (p.$on ? '#065f46' : '#334155')};
  font-weight: ${(p) => (p.$on ? 700 : 400)};
  &:hover { background: ${(p) => (p.$on ? '#d1fae5' : '#f1f5f9')}; }
  &:focus-visible { outline: 2px solid #6366f1; outline-offset: -2px; }
  > span { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;

/** 고른 줄에만 뜨는 체크. 자리는 늘 차지해 글자가 좌우로 안 흔들린다. */
const OptMark = styled.span`
  width: 13px; height: 13px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
  color: #059669;
  visibility: ${(p) => (p.$on ? 'visible' : 'hidden')};
`;
/** 해제 예정 칸. 빨간 X 하나면 훑을 때 바로 걸린다. */
const Gone = styled.span`
  color: #dc2626; font-weight: 900; font-size: 0.8rem; line-height: 1;
`;
const DangerBtn = styled.button`
  display: inline-flex; align-items: center; gap: 0.25rem; width: 100%;
  justify-content: center; padding: 0.28rem; cursor: pointer;
  border: 1px solid #fecaca; background: #fef2f2; color: #b91c1c;
  border-radius: 0.35rem; font-size: 0.72rem; font-weight: 700; font-family: inherit;
  &:hover { background: #fee2e2; border-color: #fca5a5; }
`;
const UndoBtn = styled.button`
  width: 100%; padding: 0.28rem; cursor: pointer;
  border: 1px solid #cbd5e1; background: #fff; color: #475569;
  border-radius: 0.35rem; font-size: 0.72rem; font-weight: 700; font-family: inherit;
  &:hover { border-color: #94a3b8; }
`;
const Warn = styled.div`
  display: flex; align-items: center; gap: 0.3rem; font-size: 0.72rem; color: #b91c1c;
  b { color: #991b1b; }
`;
const Empty2 = styled.div`font-size: 0.72rem; color: #94a3b8; line-height: 1.5;`;
const PickFoot = styled.div`
  margin-top: auto; display: flex; justify-content: flex-end; gap: 0.3rem;
  padding: 0.4rem 0.6rem; border-top: 1px solid #f1f5f9; background: #f8fafc;
`;

const Sums = styled.div`display: flex; gap: 0.4rem; flex-wrap: wrap;`;
const Sum = styled.div`
  padding: 0.3rem 0.7rem; border-radius: 0.45rem; font-size: 0.78rem;
  color: ${(p) => p.$c}; background: ${(p) => p.$bg};
  border: 1px solid ${(p) => p.$c}22;
  opacity: ${(p) => (p.$zero ? 0.4 : 1)};
  b { font-size: 0.95rem; }
`;
const PrevWrap = styled.div`
  flex: 1 1 0; min-height: 0; overflow: auto; border: 1px solid #e2e8f0; border-radius: 0.5rem;
  table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
  th { position: sticky; top: 0; background: #f8fafc; text-align: left; padding: 0.3rem 0.5rem;
       border-bottom: 1px solid #e2e8f0; color: #475569; }
  td { padding: 0.25rem 0.5rem; border-bottom: 1px solid #f8fafc; color: #334155; }
`;
const Tag = styled.span`
  padding: 0.05rem 0.35rem; border-radius: 0.3rem; font-size: 0.68rem; font-weight: 700;
  color: ${(p) => p.$c}; background: ${(p) => p.$bg};
`;
const Bad = styled.div`
  display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.6rem;
  background: #fef2f2; color: #b91c1c; border-radius: 0.4rem; font-size: 0.76rem;
`;
const Good = styled.div`
  display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.6rem;
  background: #ecfdf5; color: #047857; border-radius: 0.4rem; font-size: 0.76rem;
`;
const Btn = styled.button`
  display: inline-flex; align-items: center; gap: 0.2rem; padding: 0.35rem 0.7rem;
  border: 1px solid #cbd5e1; background: #fff; border-radius: 0.45rem;
  font-size: 0.78rem; color: #475569; cursor: pointer; &:hover { border-color: #94a3b8; }
`;
const Primary = styled.button`
  display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.35rem 0.9rem;
  border: 0; background: ${(p) => (p.$danger ? '#b91c1c' : '#4338ca')};
  color: #fff; border-radius: 0.45rem;
  font-size: 0.78rem; font-weight: 700; cursor: pointer;
  &:hover:not(:disabled) { background: ${(p) => (p.$danger ? '#991b1b' : '#3730a3')}; }
  &:disabled { background: #cbd5e1; cursor: default; }
`;

export default BulkKpiLinkModal;
