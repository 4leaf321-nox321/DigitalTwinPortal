// 샘플 뷰의 경로 → 목업 답 셈. JSON 을 안 물어 node 시험이 그대로 읽는다(2026-08-28).

/** 정확히 같은 키가 없으면 같은 경로·같은 division·같은 sector 의 비슷한 키(days 같은 꼬리 인자만 다른 것)를
 *  쓰고, 그래도 없으면 빈 답.
 *
 *  ⚠️ division 과 sector 는 **넘어가면 안 되는 선**이다 — 다른 사업부·다른 부문의 자료를 대신 답하면
 *     화면이 조용히 뒤섞인다(2026-08-29: 스레드 구간이 시뮬레이션 목록에 섞여 나왔다). */
export const resolveSample = (path, method, store) => {
  if (method && method !== 'GET') {
    const err = new Error('샘플 뷰에서는 저장되지 않습니다 — 보기 전용입니다.');
    err.status = 403;
    throw err;
  }
  if (path in store) return { success: true, data: store[path] };
  const [base, query = ''] = path.split('?');
  const want = Object.fromEntries(query.split('&').filter(Boolean).map(kv => kv.split('=')));
  const scored = Object.keys(store).filter(k => k.split('?')[0] === base).map(k => {
    const have = Object.fromEntries((k.split('?')[1] || '').split('&').filter(Boolean).map(kv => kv.split('=')));
    const same = Object.keys(want).filter(q => have[q] === want[q]).length;
    const diff = Object.keys(want).filter(q => have[q] !== undefined && have[q] !== want[q]).length;
    const sameDivision = !('division_id' in want) || have.division_id === want.division_id;
    // ⚠️ 부문을 물었으면 **부문이 적힌 키**로만 간다. 부문 없는 옛 키(시뮬레이션 자료)로 넘어가면
    //    스레드·모니터링 화면에 시뮬레이션이 나온다(2026-08-30에 추출에서 드러났다).
    const sameSector = !('sector' in want) || have.sector === want.sector;
    return { k, same, diff, sameDivision, sameSector };
  }).filter(x => x.sameDivision && x.sameSector && x.diff <= 1);
  scored.sort((a, b) => b.same - a.same || a.diff - b.diff);
  if (scored.length) return { success: true, data: store[scored[0].k] };
  if (/^\/pairs\/\d+$/.test(base)) return { success: true, data: null };
  const empty = /\/(subjects|agents|reviews|divisions|departments|changes)$|\/years$/.test(base) ? [] : {};
  return { success: true, data: empty };
};
