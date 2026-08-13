/**
 * 환산계수 수식 평가기
 * 숫자 또는 수식 문자열(예: "1/168", "(1/160)*1000")을 받아 숫자로 반환
 * 허용: 숫자, +, -, *, /, (, ), 공백, 소수점
 */
export const evalFactor = (expr) => {
  if (typeof expr === 'number') return expr;
  if (!expr && expr !== 0) return NaN;

  const str = String(expr).trim();
  if (!str) return NaN;

  // 숫자만 있으면 바로 반환
  const num = Number(str);
  if (!isNaN(num)) return num;

  // 허용된 문자만 포함하는지 검증 (보안)
  if (!/^[\d\s+\-*/().]+$/.test(str)) return NaN;

  // 빈 괄호, 연속 연산자 등 기본 검증
  if (/\(\s*\)/.test(str)) return NaN;

  try {
    const result = new Function(`"use strict"; return (${str});`)();
    return typeof result === 'number' && isFinite(result) ? result : NaN;
  } catch {
    return NaN;
  }
};

/**
 * 수식을 평가하고 표시용 문자열 반환
 * 수식이면 "= 결과값", 숫자면 빈 문자열
 */
export const evalFactorPreview = (expr) => {
  if (typeof expr === 'number') return '';
  const str = String(expr).trim();
  const num = Number(str);
  if (!isNaN(num)) return '';

  const result = evalFactor(expr);
  if (isNaN(result)) return '= 오류';
  return `= ${parseFloat(result.toFixed(8))}`;
};
