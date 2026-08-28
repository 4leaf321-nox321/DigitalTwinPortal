// 「샘플 뷰」 — API 대신 읽는 목업 한 판(2026-08-28).
//
// 기획 단계라 운영 서버에서 「자료가 이렇게 채워진다」를 임원에게 보여야 하는데 운영 DB 에 가짜 자료를
// 넣을 수는 없다. 그래서 개발 DB 를 뽑은 JSON(sample-data.json, backend/scripts/export_maturity_sample.py)을
// 화면이 그대로 읽는다. 관리자·사무국만 켤 수 있고(URL ?sample=1), 저장은 전부 막힌다.
// ⚠️ 목업 한 판은 **켤 때 내려받는다**(2026-08-29). 정적 import 면 샘플 뷰를 한 번도 안 여는
//    사람의 브라우저에도 1.7MB 가 같이 내려간다 — 관계도 라이브러리를 lazy 로 둔 것과 같은 이유.
import { resolveSample } from './sampleResolve';

let on = false;
let data = null;

/** 켜면 목업을 받아 온다 — **기다렸다가** 첫 부름을 해야 한다(await). 끄면 곧바로. */
export const setSampleMode = async (v) => {
  on = !!v;
  if (on && data == null) {
    try {
      data = (await import('./sample-data.json')).default;
    } catch {
      on = false;                 // 못 받았으면 샘플 뷰를 켜지 않는다 — 빈 화면보다 실제 자료가 낫다
    }
  }
  return on;
};
export const isSampleMode = () => on && data != null;
export const sampleAnswer = (path, method) => resolveSample(path, method, data);
