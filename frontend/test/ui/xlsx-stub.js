// xlsx-js-style 대신 — 묶을 때만 쓰는 껍데기.
//
// 진짜 라이브러리는 CJS 라 esbuild 로 묶으면 `Dynamic require ... is not supported` 로
// 불러오는 자리에서 터진다. 판을 짜는 셈은 utils 쪽 시험이 따로 보고(exportSheets ·
// methodStatus), 여기서는 **화면이 뜨는지**와 **저장을 부르는지**만 본다.
// 그래서 제품 코드를 시험 때문에 비틀지 않고 여기서 갈아 끼운다.

/** 저장된 것 — 시험이 「단추가 진짜 파일을 만들었나」를 본다. */
export const written = [];

export const utils = {
  aoa_to_sheet: (rows) => ({ rows, '!ref': 'A1' }),
  encode_cell: ({ r, c }) => `${String.fromCharCode(65 + c)}${r + 1}`,
  encode_range: ({ s, e }) => `${String.fromCharCode(65 + s.c)}${s.r + 1}:${String.fromCharCode(65 + e.c)}${e.r + 1}`,
  book_new: () => ({ SheetNames: [], Sheets: {} }),
  book_append_sheet: (wb, ws, name) => { wb.SheetNames.push(name); wb.Sheets[name] = ws; },
};
export const writeFile = (wb, name) => { written.push({ wb, name }); };
export default { utils, writeFile, written };
