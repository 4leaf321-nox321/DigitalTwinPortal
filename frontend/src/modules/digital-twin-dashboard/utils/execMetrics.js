/**
 * 전체 요약이 쓰는 **숫자 계산**. 화면 얘기가 없는 순수 함수다.
 *
 * 왜 따로 있나
 *     DashboardView 가 1만 2천 줄이라, 이 계산이 그 안에 있으면 **밖에서 불러올
 *     수가 없다.** 그래서 시험하려고 소스를 글자로 오려 붙였는데, 코드를 조금만
 *     움직여도 그 하네스가 무너졌다(2026-08 두 번). 이제 그냥 import 해서 본다.
 *
 * ⚠️ **여기 있는 것은 화면에 나오는 거의 모든 숫자다.** 진척률ㆍ달성률의 지금값,
 *    기준일값, 변화량, 그리고 그 변화량을 가르는 다섯 몫. 고칠 때는 반드시
 *    execMetrics.test.mjs 를 함께 돌릴 것 — 틀려도 화면은 멀쩡해 보이고
 *    숫자만 조용히 달라진다.
 *
 * 이력(aiHistory)은 화면이 뜬 뒤에 도착하므로 **만들 때 넘긴다.**
 *
 *     const { computeExecMetrics } = useMemo(
 *       () => makeExecMetrics({ aiHistory }), [aiHistory]);
 *
 *     ⚠️ 이렇게 묶어 두면 이력이 바뀔 때 함수 자체가 새로 만들어진다. 인자로
 *        일일이 넘기는 방식이었다면 넘기는 곳 하나만 빠뜨려도 조용히 틀리는데,
 *        여기서는 그 자리가 **한 곳뿐**이다.
 */
import { getActionItemCreatedAt } from './actionItemTime';
import { ymdOf } from './aiHistory';

// 취소 시각이 없는 옛 과제. **과거로 취급**해서 최근 변경 목록에 안 끼게 한다 —
// 언제 빠졌는지 모르는 것을 "방금 빠졌다" 고 말하는 것보다 낫다.
const REMOVED_LONG_AGO = '1970-01-01T00:00:00.000Z';

export const projectRemoval = (p) => {
  const cancel = p.진행상태 === '취소'
    ? { at: p._canceledAt || REMOVED_LONG_AGO, reason: '취소' }
    : null;
  const del = p._deleted
    ? { at: p._deletedAt || p.updatedAt || null, reason: '삭제' }
    : null;
  if (cancel && del) {
    // ⚠️ 견줄 때는 **진짜 삭제 시각만** 쓴다. `updatedAt` 은 편집할 때마다 갱신돼서
    //    "취소한 뒤 한 번 고쳤다" 를 "취소보다 나중에 삭제됐다" 로 오판한다.
    if (!p._deletedAt) return cancel;
    return new Date(cancel.at) <= new Date(p._deletedAt) ? cancel : del;
  }
  return cancel || del || { at: null, reason: '' };
};

/**
 * 과제가 **모집단에서 빠진 시점과 이유.** 안 빠졌으면 `{at: null}`.
 *
 * 🐞 예전에는 `_deleted` 를 먼저 봤다. 그래서 **취소한 뒤 나중에 지운 과제**가
 *    「삭제」 로, 그것도 **지운 날짜에** 빠진 것으로 잡혔다. 실제로는 취소한 그날
 *    이미 빠졌고, 삭제는 이미 없는 것을 치운 것뿐이다. 화면에는 몇 달 전에 취소한
 *    과제가 "이번 주에 삭제됨" 으로 떴다.
 *
 * **둘 중 먼저 일어난 것**이 빠진 시점이다. 한 과제가 두 번 빠질 수는 없다.
 * (`trend_view._project_span` 이 서버에서 쓰는 규칙과 같다 — 곡선과 목록이
 *  같은 날을 가리켜야 한다)
 */
/**
 * 그 시점에 이 액션아이템이 있었나. 생성 시각을 모르면 **있었던 것으로** 본다 —
 * 예전 데이터에는 생성 시각이 없어서, 없다고 보면 과거가 통째로 비어 버린다.
 *
 * ⚠️ **분자와 분모에 똑같이 대야 한다.** 한쪽에만 대면, 중간에 액션아이템을
 *    쪼개서 한꺼번에 넣었을 때 「그때 없던 항목의 완료」가 분자에만 들어간다.
 *    기준일 진척률이 100% 를 넘고, 변화량이 **일어나지 않은 폭락**으로 보인다.
 *    (2026-08-21 신고: 한 사업부가 액션아이템을 2배로 늘렸더니 지금 진척률은
 *     그대로인데 변화량만 -50%p 로 떨어졌다.)
 */
export const aiExistedAt = (item, at) => {
  const c = getActionItemCreatedAt(item);
  return !c || new Date(c) <= at;
};

/**
 * 이력을 물려 계산기 세 벌을 만든다.
 *
 * `aiHistory` 는 `buildAiHistoryIndex` 가 낸 조회기다. 못 받았으면
 * `emptyAiHistoryIndex()` 를 넘기면 되고, 그러면 전부 되짚기로 떨어진다.
 */
export const makeExecMetrics = ({ aiHistory }) => {
  /**
   * 액션아이템 개수 기준 진척률 — 상단 카드(「액션아이템 진척률」)와 **같은 셈법**이다.
   *
   * 과제별 진척률을 내서 평균내면 액션아이템이 3개인 과제와 14개인 과제가 같은 무게가
   * 되어, 전사 값과 사업부 값이 서로 안 맞는다. 보고 자리에서 합계와 부분이 어긋나면
   * 반드시 질문을 받는다. 그래서 액션아이템을 **한 통에 모아** 센다.
   *
   * 카드와 다른 점이 하나 있다: 시계열이라 완료 **시점**이 필요하다. 완료일이 비어
   * 있는 건은 어느 주에 넣을지 알 수 없어 이 그래프에서는 미완료로 남는다
   * (카드는 '지금' 하나만 보므로 완료여부만 본다).
   *
   * 액션아이템이 하나도 없으면 null 이다 — 0% 로 그리면 '진척 0' 처럼 보인다.
   */
  /**
   * 한 과제의 **그 시점** 액션아이템 분모ㆍ분자.
   *
   * 서버 이력이 있으면 그것을 쓴다 — 그때 저장된 값이라 그동안 무엇이 지워졌든,
   * 완료 체크를 되돌렸든 흔들리지 않는다.
   *
   * ⚠️ 이력이 없으면 **되짚기로 떨어진다.** 되짚기는 오늘 남아 있는 항목만 볼 수
   *    있어 지워진 것을 못 세지만, 그 과제를 셈에서 아예 빼는 것보다는 낫다.
   *    빼 버리면 기준일 값이 「그 과제를 뺀 나머지」가 되어 낙차에 한계가 없다.
   */
  const aiCountsAt = (project, at) => {
    const snap = aiHistory.at(project?.uuid, ymdOf(at));
    if (snap) return { total: snap.total, done: snap.done, fromHistory: true };

    let total = 0, done = 0;
    (project?.액션아이템목록 || []).forEach(item => {
      if (!aiExistedAt(item, at)) return;
      total += 1;
      if (item.완료여부 && item.완료일 && new Date(item.완료일) <= at) done += 1;
    });
    return { total, done, fromHistory: false };
  };

  const aiCountProgressAsOf = (projects, asOfDate) => {
    let total = 0;
    let done = 0;
    projects.forEach(p => {
      const c = aiCountsAt(p, asOfDate);
      total += c.total;
      done += c.done;
    });
    return total === 0 ? null : Math.round((done / total) * 1000) / 10;
  };

  // 재사용 가능한 메트릭 계산 (executiveMetrics + 사업부별 카드 공통)
  // allStateProjects: 취소 제외 모집단(삭제 포함) — 진척률/완료/AI 등 모든 집계는 이 기준
  // canceledProjects: 같은 범위(연도·사업부)의 취소 과제 — '총 과제' 카운트에서만 삭제와 동일하게 취급
  const computeExecMetrics = (allStateProjects, refDateStr, canceledProjects = []) => {
    const refDate = new Date(refDateStr);
    refDate.setHours(23, 59, 59, 999);

    const existedAtRef = (p) => {
      if (p.createdAt && new Date(p.createdAt) > refDate) return false;
      if (p._deleted && p._deletedAt && new Date(p._deletedAt) <= refDate) return false;
      return true;
    };

    const currentProjects = allStateProjects.filter(p => !p._deleted);
    const refProjects = allStateProjects.filter(existedAtRef);

    // 액션아이템 생성 시점 기준 "기준일에 존재했던 AI"인지 (생성일 미상이면 존재로 간주)
    const aiExistedAtRef = (item) => aiExistedAt(item, refDate);

    // 취소 과제 중 "기준일엔 존재(활성)했고 그 이후 취소된" 건 — 총 과제/총 AI 카운트에서 삭제처럼 반영
    // 빠진 시점은 `projectRemoval` 이 정한다 (취소·삭제 중 **먼저 일어난 것**)
    const canceledExistedAtRefProjects = canceledProjects.filter(p => {
      if (p.createdAt && new Date(p.createdAt) > refDate) return false;   // 기준일 이후 생성 → 당시 미존재
      const { at } = projectRemoval(p);
      if (at && new Date(at) <= refDate) return false;                    // 기준일 이전에 빠짐 → 당시 미존재
      return true;
    });
    const canceledExistedAtRef = canceledExistedAtRefProjects.length;

    // ── 전체 과제 ── (취소를 삭제처럼: 기준일엔 있었으나 이후 취소된 건도 기준일 카운트에 포함)
    const totalProjects = currentProjects.length;
    const refTotalProjects = refProjects.length + canceledExistedAtRef;

    // ── 완료 과제 ──
    const currentCompletedProjects = currentProjects.filter(p => p.진행상태 === '완료').length;
    const refCompletedProjects = refProjects.filter(p => {
      if (p.진행상태 !== '완료') return false;
      // 기준일에 있던 항목만 본다. 나중에 늘린 항목까지 세면, 그때 분명히
      // 끝나 있던 과제가 기준일에 미완료였던 것으로 뒤바뀐다.
      const items = (p.액션아이템목록 || []).filter(aiExistedAtRef);
      if (items.length === 0) {
        return p.종료 ? new Date(p.종료) <= refDate : false;
      }
      return items.every(
        item => item.완료여부 && item.완료일 && new Date(item.완료일) <= refDate
      );
    }).length;

    // ── 액션아이템 ──
    let totalAI = 0;
    let currentCompletedAI = 0;
    currentProjects.forEach(p => {
      (p.액션아이템목록 || []).forEach(item => {
        totalAI++;
        if (item.완료여부) currentCompletedAI++;
      });
    });
    // 기준일 액션아이템 수는 **그때 저장된 값**을 쓴다(aiCountsAt). 되짚으면 그동안
    // 지워진 항목을 못 세서, 지우고 다시 넣은 과제가 실제보다 적게 잡힌다.
    const refAiOf = (projs) => {
      let total = 0, done = 0, fromHistory = 0;
      projs.forEach(p => {
        const c = aiCountsAt(p, refDate);
        total += c.total; done += c.done;
        if (c.fromHistory) fromHistory += 1;
      });
      return { total, done, pct: total === 0 ? 0 : (done / total) * 100, fromHistory };
    };
    const refAiAll = refAiOf(refProjects);
    const refTotalAI = refAiAll.total;
    const refCompletedAI = refAiAll.done;
    // 기준일 이후 취소된 과제가 기준일에 갖고 있던 AI도 "당시 존재" 카운트에 포함 (삭제와 동일 취급)
    const refAiCanceled = refAiOf(canceledExistedAtRefProjects);

    // ── 액션아이템 달성률 (현시점: 진행률 현황의 actionItemAchievementRate와 동일 로직) ──
    // 분자: 완료된 액션아이템 / 분모: 시점까지 목표일이 도래한 액션아이템
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    let currentPlannedByToday = 0;
    let currentAchieved = 0;
    currentProjects.forEach(p => {
      (p.액션아이템목록 || []).forEach(item => {
        if (item.목표일 && new Date(item.목표일) <= today) currentPlannedByToday++;
        if (item.완료여부) currentAchieved++;
      });
    });
    const currentAchievementRate = currentPlannedByToday === 0
      ? 0
      : Math.min((currentAchieved / currentPlannedByToday) * 100, 999);

    let refPlannedByRef = 0;
    let refAchieved = 0;
    refProjects.forEach(p => {
      (p.액션아이템목록 || []).forEach(item => {
        if (!aiExistedAtRef(item)) return;          // 분자ㆍ분모 같은 잣대
        if (item.목표일 && new Date(item.목표일) <= refDate) refPlannedByRef++;
        if (item.완료여부 && item.완료일 && new Date(item.완료일) <= refDate) refAchieved++;
      });
    });
    const refAchievementRate = refPlannedByRef === 0
      ? 0
      : Math.min((refAchieved / refPlannedByRef) * 100, 999);

    // 공통셋 (양 시점 모두 존재한 과제) - uuid 우선, 없으면 id
    const keyOf = (p) => p.uuid || p.id;
    const refKeySet = new Set(refProjects.map(keyOf));
    const intersection = currentProjects.filter(p => refKeySet.has(keyOf(p)));
    const interKeySet = new Set(intersection.map(keyOf));

    const newProjects = currentProjects.filter(p => !refKeySet.has(keyOf(p)));
    const removedProjects = refProjects.filter(p => !interKeySet.has(keyOf(p)));

    // ── 액션아이템 진척률 (완료 AI / 총 AI, 비율 기반) ──
    // 진행률 현황의 actionItemBasedProgress와 동일 정의: 상위 액션아이템 완료여부 기준
    //   현재: 완료여부 / 전체 AI · 기준일: (완료일<=refDate) / 기준일에 존재했던 AI
    const aiRatioProgress = (projs, isTotal, isCompleted) => {
      let total = 0, completed = 0;
      projs.forEach(p => (p.액션아이템목록 || []).forEach(item => {
        if (isTotal(item)) total++;
        if (isCompleted(item)) completed++;
      }));
      return total === 0 ? 0 : (completed / total) * 100;
    };
    const curTotalFn = () => true;
    const curDoneFn = (it) => !!it.완료여부;
    const refTotalFn = (it) => aiExistedAtRef(it);
    // ⚠️ refTotalFn 과 **같은 잣대**여야 한다. 분자에만 빠지면 기준일 진척률이
    //    100% 를 넘고 변화량이 없던 폭락으로 나온다.
    const refDoneFn = (it) =>
      aiExistedAtRef(it) && it.완료여부 && it.완료일 && new Date(it.완료일) <= refDate;

    const currentAvgProgress = aiRatioProgress(currentProjects, curTotalFn, curDoneFn);
    // ⚠️ 되짚기가 아니라 **이력**이다. 되짚으면 지워진 항목이 분모ㆍ분자에서
    //    함께 빠져, 지우고 다시 넣은 과제의 기준일 값이 살아남은 것들만으로 잡힌다.
    const refAvgProgress = refAiAll.pct;

    // 공통셋(동일 과제)의 현재/기준일 진척률 — 델타 분해용
    const interCurProgress = aiRatioProgress(intersection, curTotalFn, curDoneFn);
    const interRefProgress = aiRatioProgress(intersection, refTotalFn, refDoneFn);

    // ── 분해 ──────────────────────────────────────────────────────────────
    //
    // 이 지표는 **액션아이템 개수** 로 센다. 그런데 분해가 과제 단위뿐이면, 기존
    // 과제에 항목을 **늘린 효과가 갈 곳이 없어** 「기존 과제 진척」 줄에 얹힌다.
    //
    // ⚠️ 항목 10개(5개 완료)를 20개로 쪼개 넣고 그중 2개만 완료면, 기존 항목은
    //    하나도 안 물러섰는데 화면은 「기존 과제 진척 -15.0%p」 라고 적는다.
    //    진척이 후퇴한 것처럼 읽히지만 실제로는 **할 일이 드러난 것**이다.
    //    (2026-08-21 신고)
    //
    // 그래서 항목 단위로 한 칸 더 쪼갠다. 네 몫의 합은 여전히 전체Δ 와 같다
    // (텔레스코핑 — 중간 항이 서로 지워진다).
    //
    //    전체 지금  ─신규 과제─  교집합 지금(전부)  ─항목 추가─  교집합 지금(공통)
    //      └─ 같은 항목 진척 ─  교집합 기준일  ─삭제 과제─  전체 기준일
    //
    // 「공통 항목」은 refTotalFn 이 고르는 것과 같은 집합이다 — 양 시점에 다 있던
    // 항목. 지금 값을 그 집합에만 물어보면 **모수를 고정한 채** 진척만 남는다.
    // ⚠️ 분자에도 **같은 잣대**를 대야 한다. curDoneFn 을 그대로 쓰면 나중에
    //    추가된 항목의 완료가 분자에만 들어가, 「기존 항목 진척」이 실제로는
    //    0%p 인데 +20%p 로 부푼다(합은 맞아서 눈에 안 띈다).
    const commonCurDoneFn = (it) => aiExistedAtRef(it) && !!it.완료여부;
    const commonCurProgress = aiRatioProgress(intersection, refTotalFn, commonCurDoneFn);

    let addedItemCount = 0;   // 기존 과제에 기준일 뒤 추가된 항목 수
    let commonItemCount = 0;  // 양 시점에 다 있던 항목 수
    intersection.forEach(p => (p.액션아이템목록 || []).forEach(it => {
      if (aiExistedAtRef(it)) commonItemCount++; else addedItemCount++;
    }));

    // 기준일 값은 이력에서 온다. 되짚은 값(interRefProgress)과의 **차이가 곧
    // 그동안 지워진 액션아이템의 몫**이다 — 되짚기는 지워진 것을 볼 수 없으므로.
    const refAiInter = refAiOf(intersection);
    const interRefHistProgress = refAiInter.pct;

    let deletedItemCount = 0;
    intersection.forEach(p => {
      const hist = aiCountsAt(p, refDate);
      if (!hist.fromHistory) return;               // 되짚기면 지워진 것을 알 길이 없다
      let survived = 0;
      (p.액션아이템목록 || []).forEach(it => { if (aiExistedAtRef(it)) survived += 1; });
      // 이력이 한 박자 늦으면 음수가 나올 수 있다. 없던 삭제를 지어내지 않는다.
      deletedItemCount += Math.max(0, hist.total - survived);
    });

    // ⚠️ 이 몫은 **삭제만 담고 있지 않다.** 되짚기가 볼 수 없는 것 전부다 —
    //    지워진 항목, 완료 체크를 되돌린 것, 완료일을 지우거나 고친 것. 그래서
    //    개수가 0 이어도 값이 0 이 아닐 수 있고, 화면은 그때도 이 줄을 보여야
    //    한다. 안 그러면 보이는 줄들의 합이 위 배지와 안 맞는다.

    const newEffect = currentAvgProgress - interCurProgress;        // 신규 과제
    const addedItemEffect = interCurProgress - commonCurProgress;   // 액션아이템이 는 몫
    const sameItemDelta = commonCurProgress - interRefProgress;     // 같은 항목이 나아간 몫
    const deletedItemEffect = interRefProgress - interRefHistProgress; // 지워진 액션아이템
    const removedEffect = interRefHistProgress - refAvgProgress;    // 기준일에만 있던 과제

    // 예전 이름. 항목 추가분과 진척분을 합친 값이라 **둘을 못 가른다** —
    // 새로 쓰는 곳은 sameItemDelta 를 봐야 한다.
    const sameCohortDelta = addedItemEffect + sameItemDelta + deletedItemEffect;

    // ── 달성률 분해 ────────────────────────────────────────────────────────
    //
    // 달성률은 분모가 **「목표일이 도래한 액션아이템」** 이라 진척률에 없는 성질이
    // 하나 더 있다 — **아무 일도 안 해도 기한이 닥치면 내려간다.** 그것을 「달성이
    // 나빠졌다」로 읽으면 안 되므로 따로 뗀다.
    //
    // 다섯 몫으로 가른다. 텔레스코핑이라 합은 전체 변화량과 같다.
    //
    //     지금 전체 ─신규 과제─ 교집합(전부) ─항목 추가─ 교집합(공통, 오늘 기준)
    //       └─완료─ (완료는 기준일 값, 분모는 오늘) ─기한 도래─ 교집합(공통, 기준일)
    //       └─삭제 과제─ 기준일 전체
    //
    // ⚠️ 분자와 분모의 **잣대가 다르다**(분자는 완료 전부, 분모는 목표일 도래분).
    //    그래서 달성률은 100% 를 넘을 수 있다 — 원래 그런 지표다. 여기서 고치지
    //    않는다. 고치면 진행률 현황의 같은 이름 카드와 숫자가 갈린다.
    const achOf = (projs, inSet, dueCutoff, doneAt) => {
      let due = 0, done = 0;
      projs.forEach(p => (p.액션아이템목록 || []).forEach(it => {
        if (!inSet(it)) return;
        if (it.목표일 && new Date(it.목표일) <= dueCutoff) due += 1;
        if (doneAt === null
          ? !!it.완료여부
          : (it.완료여부 && it.완료일 && new Date(it.완료일) <= doneAt)) done += 1;
      }));
      return due === 0 ? 0 : (done / due) * 100;
    };
    const allItems = () => true;
    const commonItems = (it) => aiExistedAtRef(it);

    const achNowInterAll = achOf(intersection, allItems, today, null);
    const achNowCommon = achOf(intersection, commonItems, today, null);
    // 완료는 기준일 그대로 두고 분모만 오늘로 — 「기한만 닥친」 상태
    const achMid = achOf(intersection, commonItems, today, refDate);
    const achRefCommon = achOf(intersection, commonItems, refDate, refDate);

    const achNewProjectEffect = currentAchievementRate - achNowInterAll;
    const achAddedItemEffect = achNowInterAll - achNowCommon;
    const achCompletedEffect = achNowCommon - achMid;      // 일이 끝나서 오른 몫
    const achDueEffect = achMid - achRefCommon;            // 기한이 닥쳐서 내린 몫
    const achRemovedEffect = achRefCommon - refAchievementRate;

    // 기준일 뒤에 목표일이 도래한 건수 — 「기한 도래 N건」 이라고 적으려고 센다
    let newlyDueCount = 0;
    intersection.forEach(p => (p.액션아이템목록 || []).forEach(it => {
      if (!commonItems(it) || !it.목표일) return;
      const d = new Date(it.목표일);
      if (d > refDate && d <= today) newlyDueCount += 1;
    }));

    return {
      totalProjects,
      refTotalProjects,
      deltaTotalProjects: totalProjects - refTotalProjects,
      currentCompletedProjects,
      refCompletedProjects,
      deltaCompletedProjects: currentCompletedProjects - refCompletedProjects,
      totalAI,
      refTotalAI: refTotalAI + refAiCanceled.total,
      currentCompletedAI,
      refCompletedAI,
      deltaCompletedAI: currentCompletedAI - refCompletedAI,
      currentAvgProgress,
      refAvgProgress,
      deltaAvgProgress: currentAvgProgress - refAvgProgress,
      // 평균 진행률 분해
      newEffect,
      addedItemEffect,
      sameItemDelta,
      deletedItemEffect,
      addedItemCount,
      commonItemCount,
      deletedItemCount,
      refFromHistory: refAiAll.fromHistory,
      sameCohortDelta,
      removedEffect,
      newProjectsCount: newProjects.length,
      removedProjectsCount: removedProjects.length,
      sameCohortCount: intersection.length,
      // 액션아이템 달성률
      currentAchievementRate,
      currentAchieved,
      currentPlannedByToday,
      refAchievementRate,
      refAchieved,
      refPlannedByRef,
      deltaAchievementRate: currentAchievementRate - refAchievementRate,
      achNewProjectEffect,
      achAddedItemEffect,
      achCompletedEffect,
      achDueEffect,
      achRemovedEffect,
      newlyDueCount
    };
  };

  return { aiCountsAt, aiCountProgressAsOf, computeExecMetrics };
};
