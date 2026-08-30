// xlsx-js-style 대신 — 묶을 때만 쓰는 껍데기.
//
// 진짜 라이브러리는 CJS 라 esbuild 로 묶으면 `Dynamic require ... is not supported` 로
// 불러오는 자리에서 터진다. 추출은 이 시험의 관심사가 아니고(엑셀 표 만들기는
// utils/exportSheets.test.mjs 가 따로 본다), 여기서는 **화면이 뜨는지**만 본다.
// 그래서 제품 코드를 시험 때문에 비틀지 않고 여기서 갈아 끼운다.
const noop = () => {};
export const utils = {
  aoa_to_sheet: (rows) => ({ rows, '!ref': 'A1' }),
  encode_cell: ({ r, c }) => `${String.fromCharCode(65 + c)}${r + 1}`,
  book_new: () => ({ SheetNames: [], Sheets: {} }),
  book_append_sheet: (wb, ws, name) => { wb.SheetNames.push(name); wb.Sheets[name] = ws; },
};
export const writeFile = noop;
export default { utils, writeFile };
