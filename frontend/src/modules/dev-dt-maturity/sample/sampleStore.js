// 「샘플 뷰」 — API 대신 읽는 목업 한 판(2026-08-28).
//
// 기획 단계라 운영 서버에서 「자료가 이렇게 채워진다」를 임원에게 보여야 하는데 운영 DB 에 가짜 자료를
// 넣을 수는 없다. 그래서 개발 DB 를 뽑은 JSON(sample-data.json, backend/scripts/export_maturity_sample.py)을
// 화면이 그대로 읽는다. 관리자·사무국만 켤 수 있고(URL ?sample=1), 저장은 전부 막힌다.
import data from './sample-data.json';
import { resolveSample } from './sampleResolve';

let on = false;
export const setSampleMode = (v) => { on = !!v; };
export const isSampleMode = () => on;
export const sampleAnswer = (path, method) => resolveSample(path, method, data);
