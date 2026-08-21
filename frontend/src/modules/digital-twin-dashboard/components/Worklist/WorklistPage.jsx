/**
 * 「내 업무」 — **이 화면에서 일을 끝내는** 콘솔 (2026-08-11).
 *
 * 목표가 알림함이 아니다. **과제를 하나하나 열지 않고 여기서 다 처리하는 것**이다.
 * 그래서 모든 줄이 그 자리에서 저장된다 — 체크박스, 숫자 입력, 승인/거부.
 *
 * 무엇을 여기서 끝낼 수 있나
 *     액션아이템   체크 → 완료. 서버가 진행률을 다시 파생시킨다
 *     이슈         체크 → 해결. 조치 내용도 여기서 적는다
 *     확인 대기     승인 / 거부
 *     성과 실적     숫자 입력 → 저장
 *
 * ⚠️ **한 줄로 길게 쌓지 않는다.** 액션아이템만 수백 건이라 세로로 이으면 아래쪽
 *    카드를 찾을 수가 없다. 그래서 **가로 전체를 쓰는 격자**에 놓고, **카드마다
 *    높이 한계와 자기 스크롤**을 준다. 페이지 자체는 거의 안 길어진다.
 *
 * ⚠️ **배열 필드는 통째 교체다.** `액션아이템목록`·`이슈목록` 은 한 건만 바꿔도
 *    그 과제의 **전체 배열**을 다시 보내야 한다. 그래서 화면이 들고 있는 과제 목록
 *    (`projects`)에서 원본 배열을 꺼내 한 원소만 바꿔 통째로 보낸다.
 *    서버가 준 worklist 항목만 가지고 배열을 만들면 **나머지 항목이 사라진다.**
 *
 * ⚠️ **완료일 규칙을 여기서 새로 만들지 않는다.** `shared/utils/localDate` 의
 *    `projectCompletedYmd` 를 쓴다 — 액션아이템 탭에서 체크할 때와 같은 날짜가
 *    나와야 한다(규칙이 두 벌이 되면 어느 쪽이 맞는지 알 수 없다).
 *
 * ⚠️ 저장이 **400 으로 거절될 수 있다.** 미착수·계획 과제의 액션아이템을 완료로
 *    바꾸면 서버가 진행상태 불변식으로 막는다. 그때는 무엇을 해야 하는지 그대로
 *    보여준다 — 조용히 실패하면 사용자는 체크했다고 믿는다.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  AlertTriangle, Check, CheckSquare, ChevronDown, ChevronRight, Clock, Inbox,
  RefreshCw, Square, TrendingUp, X,
} from 'lucide-react';
import {
  approveProposal, fetchWorklist, markReportResubmitted, rejectProposal,
  snoozeWorklistItem,
} from '../../services/worklistApi';
import { patchProjectV2, patchPerformanceV2, projectRowVersion, rememberProjectRowVersion }
  from '../../services/settingsApi';
import { projectCompletedYmd } from '../../../../shared/utils/localDate';

const LENS_LABEL = { mine: '내가 하는 일', division: '우리 사업부', office: '사무국' };
const LENS_KEY = 'dtwin_worklistLens';

/** 이 카드들은 줄마다 그 자리에서 처리된다. 나머지는 과제를 열어야 한다. */
const INLINE = new Set(['actions', 'openIssues', 'proposals', 'perfActuals']);

/**
 * 카드마다 **그 항목이 있는 탭**으로 편집창을 연다.
 * 기본 탭으로 열면 방금 누른 줄을 화면에서 다시 찾아야 한다.
 * (탭 키는 `EditProjectModal` 의 tabs 배열과 **같아야** 한다)
 */
const CARD_TAB = {
  actions: 'actions', openIssues: 'issues', stalled: 'actions',
  readiness: 'etc', proposals: 'history',
};

/**
 * 「비어 있는 값」·「보고서에 빈 곳」의 **블록별** 탭.
 * 카드 단위(CARD_TAB)보다 정확하다 — 같은 카드 안에서도 KPI 연결이 빈 것과
 * 그림이 없는 것은 고치러 갈 자리가 다르다.
 */
const BLOCK_TAB = {
  noPerf: 'performance', noKpi: 'kpi', contribution: 'performance',
  overdue: 'actions', unlinkedPl: 'basic', noRelationType: 'kpi',
  noDetail: 'etc', noImage: 'etc', noMilestone: 'actions', noActual: 'performance',
};

const CARD_ICON = {
  actions: Clock, openIssues: AlertTriangle, proposals: Inbox,
  perfActuals: TrendingUp,
};

/** 넓은 카드로 둘 것 — 줄이 길거나 손댈 것이 많은 카드는 2칸을 쓴다. */
const WIDE = new Set(['actions', 'openIssues']);

const Wrap = styled.div`
  /* **가로를 다 쓴다.** max-width 로 가운데 모으면 넓은 화면이 그대로 낭비된다. */
  padding: 0 1rem 2rem; width: 100%; align-self: flex-start;
`;

/**
 * 목록이 길어서 스크롤을 내리면 렌즈 버튼이 화면 밖으로 나간다. 그래서 위에 붙인다 —
 * 스크롤 상자는 부모(`Content`)라 sticky 가 그 기준으로 걸린다.
 * 배경을 반드시 칠할 것(투명하면 아래 줄들이 비쳐 지나간다).
 */
const Top = styled.div`
  position: sticky; top: 0; z-index: 5; background: #ECEFF1;
  display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap;
  padding: 0.7rem 0 0.6rem; border-bottom: 1px solid #cbd5e1;
  h1 { margin: 0; font-size: 1.2rem; font-weight: 800; color: #0f172a; }
  .sum { font-size: 0.84rem; color: #64748b; }
`;
const LensBtn = styled.button`
  border: 1px solid ${p => (p.$on ? '#1d4ed8' : '#cbd5e1')};
  background: ${p => (p.$on ? '#1d4ed8' : '#fff')};
  color: ${p => (p.$on ? '#fff' : '#475569')};
  font-weight: ${p => (p.$on ? 700 : 500)};
  border-radius: 999px; padding: 0.3rem 0.8rem; font-size: 0.83rem; cursor: pointer;
`;

/**
 * 카드 격자. `auto-fill` + `minmax` 라 화면 폭에 따라 **2~4열이 저절로** 잡힌다
 * (열 수를 숫자로 박으면 좁은 화면에서 카드가 찌그러진다).
 * `align-items: start` — 카드마다 내용 양이 달라서, 늘려 맞추면 빈 카드가 커진다.
 */
const Grid = styled.div`
  display: grid; gap: 0.85rem; align-items: start; margin-top: 0.9rem;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
`;
/**
 * 카드 하나. **높이 한계 + 자기 스크롤**이 이 화면의 핵심이다 —
 * 한계를 안 주면 액션아이템 100건이 페이지를 통째로 늘려 다른 카드를 못 찾는다.
 * 머리(제목·건수)는 스크롤 밖에 둬서 어느 카드를 보고 있는지 항상 보이게 한다.
 */
const Card = styled.section`
  grid-column: ${p => (p.$wide ? 'span 2' : 'span 1')};
  @media (max-width: 1000px) { grid-column: span 1; }
  display: flex; flex-direction: column; overflow: hidden;
  max-height: min(560px, 48vh);
  border: 1px solid #e2e8f0; border-radius: 0.6rem; background: #fff;
`;
const CardHead = styled.div`
  flex: none; padding: 0.6rem 0.75rem 0.5rem; border-bottom: 1px solid #eef2f7;
  h2 {
    margin: 0; font-size: 0.95rem; font-weight: 800; color: #0f172a;
    display: flex; align-items: center; gap: 0.4rem;
  }
  .n { margin-left: auto; font-size: 0.85rem; font-weight: 800; color: #1d4ed8; }
  .why { font-size: 0.76rem; color: #64748b; margin-top: 0.15rem; }
`;
const CardBody = styled.div`
  flex: 1 1 auto; overflow-y: auto; padding: 0.5rem 0.7rem 0.6rem;
`;

const Note = styled.div`
  margin: 0.7rem 0 0; padding: 0.6rem 0.75rem; border-radius: 0.5rem;
  background: #fffbeb; border: 1px solid #fde68a; color: #92400e; font-size: 0.83rem;
`;
const Err = styled.div`
  margin: 0.2rem 0 0.4rem; padding: 0.4rem 0.55rem; border-radius: 0.35rem;
  background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; font-size: 0.78rem;
`;
/**
 * 줄 하나. 좁은 칸에 버튼이 여럿이라 **가로 한 줄로 못 늘어놓는다** —
 * 제목 / 부가정보 / 버튼을 세 단으로 쌓고 버튼만 줄바꿈시킨다.
 */
const Line = styled.div`
  border: 1px solid #e2e8f0; border-radius: 0.4rem; background: #fff;
  border-left: 3px solid ${p => (p.$late ? '#ef4444' : '#e2e8f0')};
  padding: 0.45rem 0.55rem; margin-bottom: 0.35rem;
  .head { display: flex; align-items: flex-start; gap: 0.45rem; }
  .t {
    flex: 1; min-width: 0; font-size: 0.86rem; color: #0f172a; font-weight: 600;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .m {
    font-size: 0.74rem; color: #64748b; margin-top: 0.15rem;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .acts { display: flex; gap: 0.3rem; margin-top: 0.35rem; flex-wrap: wrap; }
`;
const Box = styled.button`
  background: none; border: none; cursor: pointer; padding: 0; display: flex;
  color: #94a3b8; flex: none;
  &:hover { color: #16a34a; }
  &:disabled { cursor: wait; opacity: 0.5; }
`;
const Tag = styled.span`
  font-size: 0.66rem; font-weight: 800; padding: 0.05rem 0.32rem; flex: none;
  border-radius: 0.3rem; background: #eef2ff; color: #3730a3; white-space: nowrap;
`;
const Late = styled.span`
  font-size: 0.7rem; font-weight: 800; color: #b91c1c; white-space: nowrap; flex: none;
`;
const Mini = styled.button`
  border: 1px solid ${p => (p.$tone === 'ok' ? '#16a34a' : '#cbd5e1')};
  background: ${p => (p.$tone === 'ok' ? '#16a34a' : '#fff')};
  color: ${p => (p.$tone === 'ok' ? '#fff' : '#475569')};
  border-radius: 0.3rem; padding: 0.18rem 0.5rem; font-size: 0.74rem;
  cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center;
  gap: 0.15rem;
  &:disabled { opacity: 0.5; cursor: wait; }
`;
const TextIn = styled.input`
  border: 1px solid #cbd5e1; border-radius: 0.3rem;
  padding: 0.18rem 0.4rem; font-size: 0.78rem; min-width: 0;
`;
/** 입력하는 동안 계산돼 보이는 값. 목표를 넘기면 초록으로 바뀐다. */
const Calc = styled.span`
  font-size: 0.74rem; font-weight: 700; white-space: nowrap;
  padding: 0.18rem 0.4rem; border-radius: 0.3rem;
  color: ${p => (p.$good ? '#166534' : '#1e40af')};
  background: ${p => (p.$good ? '#dcfce7' : '#eff6ff')};
`;
/**
 * 세부항목(사업부에 따라 「액티비티」라고 부른다) 목록.
 * 상위 줄 안에 들여쓰기로 붙여, 어느 액션아이템의 것인지 눈으로 이어지게 한다.
 */
const Subs = styled.div`
  margin: 0.35rem 0 0 1.35rem; padding-left: 0.55rem;
  border-left: 2px solid #e2e8f0;
`;
const Sub = styled.div`
  /* 세부항목(체크 대상)과 과제 목록(열기 대상)을 **같은 모양**으로 쓴다 —
     둘 다 "상위 줄에 딸린 것" 이라 눈으로 같은 층위로 읽혀야 한다. */
  display: flex; align-items: center; gap: 0.4rem; padding: 0.15rem 0;
  font-size: 0.79rem;
  color: ${p => (p.$done ? '#94a3b8' : '#334155')};
  text-decoration: ${p => (p.$done ? 'line-through' : 'none')};
  .c { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
       white-space: nowrap; }
  .d { font-size: 0.7rem; color: #94a3b8; flex: none; }
`;
const Muted = styled.div`font-size: 0.75rem; color: #94a3b8; margin-top: 0.3rem;`;
const Empty = styled.div`padding: 3rem 1rem; text-align: center; color: #94a3b8;`;

const WorklistPage = ({
  year, projects, onProjectsChanged, onOpenProject, onGoToReport,
  showSuccess, showError,
}) => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [busy, setBusy] = useState({});      // itemKey -> 저장 중
  const [errors, setErrors] = useState({});  // itemKey -> 메시지
  const [drafts, setDrafts] = useState({});  // itemKey -> 입력 중인 값
  const [open, setOpen] = useState({});      // itemKey -> 세부항목 펼침

  const byUuid = useMemo(() => {
    const m = new Map();
    (projects || []).forEach(p => m.set(p.uuid || p.id, p));
    return m;
  }, [projects]);

  const load = useCallback(async (lens) => {
    setIsLoading(true);
    try {
      const d = await fetchWorklist({ lens: lens || undefined, year });
      setData(d);
      if (d?.lens) localStorage.setItem(LENS_KEY, d.lens);
    } catch (e) {
      showError?.(e.message || '내 업무를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [year, showError]);

  useEffect(() => {
    load(localStorage.getItem(LENS_KEY) || undefined);
  }, [year]);   // eslint-disable-line react-hooks/exhaustive-deps

  const mark = (key, on) => setBusy(b => ({ ...b, [key]: on }));
  const fail = (key, msg) => setErrors(e => ({ ...e, [key]: msg }));
  const clear = (key) => setErrors(e => { const n = { ...e }; delete n[key]; return n; });

  /**
   * 과제의 배열 필드 하나를 통째로 다시 보낸다.
   *
   * `mutate(원본배열) → 새배열` 을 받아서, 화면이 들고 있는 **원본 전체**를 바꾼 뒤
   * 통째로 PATCH 한다. 서버가 준 worklist 항목만으로 배열을 만들면 나머지가 사라진다.
   */
  const patchArrayField = async (key, projectUuid, field, mutate) => {
    const proj = byUuid.get(projectUuid);
    if (!proj) {
      fail(key, '이 과제가 지금 화면에 없습니다. 연도를 바꾸면 처리할 수 있습니다.');
      return false;
    }
    mark(key, true); clear(key);
    try {
      const next = mutate(Array.isArray(proj[field]) ? proj[field] : []);
      const res = await patchProjectV2(projectUuid, { [field]: next },
        { expectedVersion: projectRowVersion(projectUuid) });
      rememberProjectRowVersion(projectUuid, res?.rowVersion);

      // 화면이 들고 있는 과제도 같이 고친다 — 안 그러면 다른 화면이 옛값을 쓴다.
      //
      // ⚠️ **`next`(내가 보낸 것)가 아니라 `res.derived`(서버가 정한 것)를 먼저 쓴다.**
      //    세부항목만 체크해 보내면 상위 `완료여부`·`완료일`과 `진행률` 은 서버가
      //    파생시킨다. 내가 보낸 배열에는 그 값이 없으므로, 그대로 반영하면
      //    **세부항목을 다 체크해도 액션아이템이 안 켜진 것처럼 보인다**(실제 버그였다).
      //    여기서 같은 파생을 다시 구현하지 않는 이유는 규칙이 두 벌이 되기 때문이다.
      onProjectsChanged?.(projectUuid, res?.derived || { [field]: next });
      return true;
    } catch (e) {
      // 서버가 왜 막았는지 그대로 보여준다(routes_v2._status_conflict 메시지에
      // 무엇을 해야 하는지가 들어 있다).
      fail(key, e.message || '저장하지 못했습니다.');
      return false;
    } finally {
      mark(key, false);
    }
  };

  const toggleAction = async (it) => {
    const ok = await patchArrayField(it.key, it.projectUuid, '액션아이템목록', (arr) => {
      const done = projectCompletedYmd(byUuid.get(it.projectUuid)?.과제년도);
      return arr.map(a => {
        const same = it.actionUuid ? a.uuid === it.actionUuid : a.제목 === it.itemTitle;
        if (!same) return a;
        // 세부항목까지 같이 켠다. 상위만 켜면 **서버가 세부항목에서 다시 파생시켜**
        // 도로 미완료가 되고, 진행상태와 어긋나 다음 저장이 400 이 된다.
        return {
          ...a, 완료여부: true, 완료일: a.완료일 || done,
          세부항목목록: (a.세부항목목록 || []).map(s => ({
            ...s, 완료여부: true, 완료일: s.완료일 || done,
          })),
        };
      });
    });
    if (ok) { showSuccess?.('완료 처리했습니다.'); load(data?.lens); }
  };

  /**
   * **세부항목(액티비티) 하나만** 체크/해제한다.
   *
   * 상위 액션아이템의 완료여부·완료일은 **서버가 세부항목에서 파생시킨다**
   * (`routes_v2.normalize_action_items`). 그래서 여기서는 하위만 건드리고
   * 상위는 손대지 않는다 — 미리 계산하면 규칙이 두 벌이 되고, 둘이 갈리는 날
   * 화면과 저장값이 달라진다. 진행률도 같은 이유로 서버가 다시 낸다.
   *
   * ⚠️ 세부항목에는 uuid 가 없어서 **순번으로** 찾는다. 그 사이 목록이 바뀌었을 수
   *    있으므로 `내용` 이 다르면 손대지 않는다(엉뚱한 항목을 체크하는 것보다
   *    아무것도 안 하는 편이 낫다).
   */
  const toggleSub = async (it, sub) => {
    const ok = await patchArrayField(it.key, it.projectUuid, '액션아이템목록', (arr) => {
      const done = projectCompletedYmd(byUuid.get(it.projectUuid)?.과제년도);
      return arr.map(a => {
        const same = it.actionUuid ? a.uuid === it.actionUuid : a.제목 === it.itemTitle;
        if (!same) return a;
        const subs = (a.세부항목목록 || []).map((x, i) => {
          if (i !== sub.index) return x;
          if (sub.content && x.내용 && x.내용 !== sub.content) return x;   // 바뀐 목록
          const next = !x.완료여부;
          return { ...x, 완료여부: next, 완료일: next ? (x.완료일 || done) : '' };
        });
        return { ...a, 세부항목목록: subs };
      });
    });
    if (ok) load(data?.lens);
  };

  const resolveIssue = async (it) => {
    const note = drafts[it.key];
    const ok = await patchArrayField(it.key, it.projectUuid, '이슈목록', (arr) =>
      arr.map((x, i) => (i === it.issueIndex
        ? { ...x, 해결여부: true, 해결일: x.해결일 || projectCompletedYmd(),
            조치내용: note != null ? note : x.조치내용 }
        : x)));
    if (ok) { showSuccess?.('해결로 표시했습니다.'); load(data?.lens); }
  };

  const saveActual = async (it) => {
    const v = drafts[it.key];
    if (v == null || String(v).trim() === '') { fail(it.key, '값을 입력하세요.'); return; }
    mark(it.key, true); clear(it.key);
    try {
      // 실적수준은 **문자열 컬럼**이다(숫자로 바꾸지 않는다 — 원형 보존).
      await patchPerformanceV2(it.performanceUuid, { 실적수준: String(v).trim() });
      showSuccess?.('실적을 저장했습니다.');
      load(data?.lens);
    } catch (e) {
      fail(it.key, e.message || '저장하지 못했습니다.');
    } finally { mark(it.key, false); }
  };

  const decide = async (it, approve) => {
    mark(it.key, true); clear(it.key);
    try {
      if (approve) await approveProposal(it.proposalId);
      else await rejectProposal(it.proposalId, '내 업무 화면에서 거부');
      showSuccess?.(approve ? '반영했습니다.' : '거부했습니다.');
      load(data?.lens);
    } catch (e) {
      fail(it.key, e.message || '처리하지 못했습니다.');
    } finally { mark(it.key, false); }
  };

  /**
   * 「보완했습니다」. 도장이 `rejected` → `resubmitted` 가 된다.
   *
   * ⚠️ 여기서 **끝나는 것이 아니라 사무국으로 넘어간다.** 그래서 안내 문구가
   *    「완료」가 아니라 「사무국에 알렸습니다」다 — 끝난 줄 알면 재확인을
   *    안 기다리고 넘어가 버린다.
   */
  const resubmitReport = async (it) => {
    const uuid = String(it.ref || '').replace(/^project:/, '') || it.projectUuid;
    if (!uuid) { fail(it.key, '과제를 찾지 못했습니다.'); return; }
    mark(it.key, true); clear(it.key);
    try {
      await markReportResubmitted(uuid);
      showSuccess?.('사무국에 알렸습니다. 재확인 목록으로 넘어갔습니다.');
      load(data?.lens);
    } catch (e) {
      fail(it.key, e.message || '알리지 못했습니다.');
    } finally { mark(it.key, false); }
  };

  const doSnooze = async (it, cardKey) => {
    mark(it.key, true);
    try { await snoozeWorklistItem(it.key, cardKey); load(data?.lens); }
    catch (e) { fail(it.key, e.message); }
    finally { mark(it.key, false); }
  };

  const openProject = (it, cardKey, blockKey) => {
    const uuid = it.projectUuid || String(it.ref || '').split(':').pop();
    if (!uuid) return;
    // 블록을 알면 그쪽이 더 정확하다 (같은 카드라도 고칠 자리가 다르다).
    onOpenProject?.(uuid, BLOCK_TAB[blockKey] || CARD_TAB[cardKey] || null);
  };

  if (!data && isLoading) return <Wrap><Empty>불러오는 중…</Empty></Wrap>;
  if (!data) return <Wrap><Empty>내 업무를 불러오지 못했습니다.</Empty></Wrap>;
  if (!(data.lenses || []).length) {
    return <Wrap><Empty>{(data.notes || [])[0] || '표시할 업무가 없습니다.'}</Empty></Wrap>;
  }

  const cards = (data.cards || []).filter(c => c.count > 0);
  const inlineTotal = (data.cards || [])
    .filter(c => INLINE.has(c.key)).reduce((s, c) => s + c.count, 0);

  const num = (v) => {
    const n = parseFloat(v);
    return Number.isNaN(n) ? null : n;
  };
  const fmt = (n) => (n == null ? '-'
    : String(Math.round(n * 100) / 100));

  /**
   * 성과 한 건의 「변화량」 표기.
   *
   * ⚠️ **규칙을 여기서 만들지 않았다.** `utils/unitConversion.js` 의 `cardDeltaAt` 이
   *    정본이고 그대로 따른다:
   *        목표 변화량 = |목표 − 현재|      실적 변화량 = |실적 − 현재|
   *        달성률      = 실적 변화량 / 목표 변화량
   *    **절대값인 이유**: 성과의 절반쯤이 「비용 절감」·「시간 단축」처럼 줄이는
   *    목표라(위 실측: 현재 3억원 → 목표 1억원) 부호를 두면 늘리는 목표와 못 견준다.
   *    여기서 다르게 계산하면 KPI 화면과 숫자가 갈린다.
   *
   * ⚠️ **단위 환산은 하지 않는다.** 성과 한 건을 그 성과 자신의 단위로 보여주는
   *    자리라 환산할 이유가 없다(환산은 카드로 묶어 합칠 때 필요한 것이다).
   */
  const perfDelta = (it, typed) => {
    const cur = it.currentNum;
    const actual = num(typed);
    if (cur == null || actual == null) return null;
    const aDelta = Math.abs(actual - cur);
    const rate = it.targetDelta ? (aDelta / it.targetDelta) * 100 : null;
    return { aDelta, rate };
  };

  const meta = (it) => [
    it.code, it.title && it.itemTitle ? it.title : null,
    it.due && `목표일 ${it.due}`,
    it.registeredAt && `등록 ${it.registeredAt}`,
    // 성과는 **현재·목표·목표변화량을 다 보여준다.** 목표만 보면 이 성과가
    // 얼마나 움직여야 하는 것인지(=실적을 얼마로 넣어야 하는지) 알 수 없다.
    it.performanceUuid && `현재 ${it.currentLevel || '-'}`,
    it.performanceUuid && `목표 ${it.targetLevel || '-'}${it.unit ? ' ' + it.unit : ''}`,
    it.targetDelta != null && `목표 변화량 ${fmt(it.targetDelta)}${it.unit ? ' ' + it.unit : ''}`,
    it.isAchievement && '달성형',
    it.sharedBy > 1 && `과제 ${it.sharedBy}개가 공유`,
    it.fields && `바뀔 값: ${it.fields.join(', ')}`,
    it.blockKey && `${it.count}건`,
  ].filter(Boolean).join(' · ');

  return (
    <Wrap>
      <Top>
        <h1>내 업무</h1>
        <span className="sum">
          여기서 바로 처리할 수 있는 일 <b>{inlineTotal}</b>건
          {data.year ? ` · ${data.year}년` : ''}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.35rem' }}>
          {(data.lenses || []).map(k => (
            <LensBtn key={k} $on={k === data.lens}
              onClick={() => { localStorage.setItem(LENS_KEY, k); load(k); }}>
              {LENS_LABEL[k] || k}
            </LensBtn>
          ))}
          <LensBtn onClick={() => load(data.lens)} title="다시 불러오기">
            <RefreshCw size={13} />
          </LensBtn>
        </div>
      </Top>

      {(data.notes || []).map((n, i) => <Note key={i}>{n}</Note>)}

      {cards.length === 0 && (
        <Empty>
          지금 처리할 것이 없습니다.<br />
          <span style={{ fontSize: '0.8rem' }}>미뤄둔 항목은 30일 뒤에 다시 나타납니다.</span>
        </Empty>
      )}

      <Grid>
        {cards.map(c => {
          const Icon = CARD_ICON[c.key] || ChevronRight;
          return (
            <Card key={c.key} $wide={WIDE.has(c.key)}>
              <CardHead>
                <h2><Icon size={15} />{c.title}<span className="n">{c.count}</span></h2>
                <div className="why">{c.why}</div>
              </CardHead>
              <CardBody>
                {c.items.map(it => {
                  const isBusy = !!busy[it.key];
                  const err = errors[it.key];
                  return (
                    <div key={it.key}>
                      <Line $late={it.overdueDays > 0}>
                        <div className="head">
                          {(c.key === 'actions' || c.key === 'openIssues') && (
                            <Box disabled={isBusy}
                              onClick={() => (c.key === 'actions'
                                ? toggleAction(it) : resolveIssue(it))}
                              title={c.key === 'actions'
                                ? '완료로 표시합니다 (바로 저장)'
                                : '해결로 표시합니다 (바로 저장)'}>
                              {isBusy ? <RefreshCw size={16} /> : <Square size={16} />}
                            </Box>
                          )}
                          <div className="t" title={it.itemTitle || it.content || it.title}>
                            {it.itemTitle || it.content || it.title}
                          </div>
                          {it.overdueDays > 0 && <Late>{it.overdueDays}일</Late>}
                          {it.relationLabel && <Tag>{it.relationLabel}</Tag>}
                        </div>

                        <div className="m" title={meta(it)}>{meta(it)}</div>

                        {/* 「비어 있는 값」·「보고서에 빈 곳」은 **집계 줄**이다.
                            펼치면 해당 과제 목록이 나오고, 각각 고칠 자리(탭)로
                            바로 열린다 — 건수만 보여주면 어느 과제인지 알 수 없다. */}
                        {it.blockKey && (it.items || []).length > 0 && (
                          <>
                            <Mini style={{ marginTop: '0.3rem' }}
                              onClick={() => setOpen(o => ({ ...o, [it.key]: !o[it.key] }))}>
                              {open[it.key] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              과제 보기
                            </Mini>
                            {open[it.key] && (
                              <Subs>
                                {(it.items || []).map(pr => (
                                  <Sub key={`${pr.ref}-${pr.detail || ''}`}>
                                    <span className="c"
                                      title={[pr.code, pr.title, pr.detail].filter(Boolean).join(' · ')}>
                                      <b>{pr.code || '(코드 없음)'}</b> {pr.title}
                                      {/* 왜 떴는지가 항목에만 있는 경우가 있다
                                          (과제PL 이름 · KPI 이름). 그게 없으면
                                          "이 과제 왜 여기 있지" 를 알 수 없다. */}
                                      {pr.detail && (
                                        <span style={{ color: '#94a3b8' }}> · {pr.detail}</span>
                                      )}
                                    </span>
                                    <Mini onClick={() => openProject(pr, c.key, it.blockKey)}>
                                      열기
                                    </Mini>
                                  </Sub>
                                ))}
                                {/* 원본이 20건에서 자른다 — 자른 사실을 밝힌다 */}
                                {it.count > (it.items || []).length && (
                                  <Muted>외 {it.count - it.items.length}건이 더 있습니다.</Muted>
                                )}
                              </Subs>
                            )}
                          </>
                        )}

                        {/* 세부항목(액티비티) — 하위만 체크해도 서버가 상위와
                            진행률을 파생시킨다. 그래서 여기서 바로 처리된다. */}
                        {c.key === 'actions' && it.subTotal > 0 && (
                          <>
                            <Mini style={{ marginTop: '0.3rem' }}
                              onClick={() => setOpen(o => ({ ...o, [it.key]: !o[it.key] }))}>
                              {open[it.key] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              세부 {it.subDone}/{it.subTotal}
                            </Mini>
                            {open[it.key] && (
                              <Subs>
                                {(it.subs || []).map(sub => (
                                  <Sub key={sub.index} $done={sub.done}>
                                    <Box disabled={isBusy}
                                      onClick={() => toggleSub(it, sub)}
                                      title={sub.done ? '완료를 해제합니다' : '완료로 표시합니다'}>
                                      {sub.done ? <CheckSquare size={14} /> : <Square size={14} />}
                                    </Box>
                                    <span className="c" title={sub.content}>{sub.content}</span>
                                    {sub.doneAt && <span className="d">{sub.doneAt}</span>}
                                  </Sub>
                                ))}
                              </Subs>
                            )}
                          </>
                        )}

                        <div className="acts">
                          {c.key === 'openIssues' && (
                            <TextIn style={{ flex: 1 }} placeholder="조치 내용(선택)"
                              defaultValue={it.action}
                              onChange={(e) => setDrafts(d => ({ ...d, [it.key]: e.target.value }))} />
                          )}
                          {c.key === 'perfActuals' && (() => {
                            // 입력하는 동안 **실적 변화량과 달성률이 곧바로 보인다** —
                            // 숫자만 넣고 나면 그게 목표에 얼마나 닿는지 모른 채 끝난다.
                            const d = perfDelta(it, drafts[it.key]);
                            return (
                              <>
                                <TextIn style={{ width: '6rem' }} placeholder="실적"
                                  value={drafts[it.key] ?? ''}
                                  onChange={(e) => setDrafts(x => ({ ...x, [it.key]: e.target.value }))}
                                  onKeyDown={(e) => e.key === 'Enter' && saveActual(it)} />
                                {d && (
                                  <Calc $good={d.rate != null && d.rate >= 100}>
                                    실적 변화량 {fmt(d.aDelta)}{it.unit ? ` ${it.unit}` : ''}
                                    {d.rate != null && ` · 달성률 ${fmt(d.rate)}%`}
                                  </Calc>
                                )}
                                <Mini $tone="ok" disabled={isBusy}
                                  onClick={() => saveActual(it)}>저장</Mini>
                              </>
                            );
                          })()}
                          {c.key === 'proposals' && (
                            <>
                              <Mini $tone="ok" disabled={isBusy}
                                onClick={() => decide(it, true)}><Check size={12} />반영</Mini>
                              <Mini disabled={isBusy}
                                onClick={() => decide(it, false)}><X size={12} />거부</Mini>
                            </>
                          )}
                          {(it.projectUuid || it.ref) && !it.blockKey && (
                            <Mini onClick={() => openProject(it, c.key)}>열기</Mini>
                          )}
                          {c.key === 'reportReject' && (
                            <>
                              <Mini onClick={() => onGoToReport?.()}>보고서로</Mini>
                              {/* 받은 사람이 **끝낼 수 있는 길**. 이게 없으면
                                  보고서를 고쳐도 카드가 안 없어졌다. */}
                              <Mini $tone="ok" disabled={isBusy}
                                onClick={() => resubmitReport(it)}
                                title="보완을 마쳤다고 사무국에 알립니다. 사무국의 재확인 목록으로 넘어갑니다.">
                                <Check size={12} />보완했습니다
                              </Mini>
                            </>
                          )}
                          {c.key === 'reportRecheck' && (
                            <Mini onClick={() => onGoToReport?.()}>보고서로</Mini>
                          )}
                          {c.snoozable && (
                            <Mini disabled={isBusy} onClick={() => doSnooze(it, c.key)}
                              title={`${data.snoozeDays || 30}일 뒤에 다시 알려줍니다`}>
                              나중에
                            </Mini>
                          )}
                        </div>
                      </Line>
                      {err && <Err>{err}</Err>}
                    </div>
                  );
                })}

                {/* 잘린 것·가린 것을 밝힌다 — 안 밝히면 보이는 게 전부인 줄 안다 */}
                {c.more > 0 && <Muted>외 {c.more}건이 더 있습니다.</Muted>}
                {c.snoozed > 0 && <Muted>{c.snoozed}건은 미뤄두어 숨겨져 있습니다.</Muted>}
                {c.note && <Muted>{c.note}</Muted>}
              </CardBody>
            </Card>
          );
        })}
      </Grid>
    </Wrap>
  );
};

export default WorklistPage;
