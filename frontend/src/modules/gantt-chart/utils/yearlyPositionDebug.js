// 연단위 날짜 계산 검증 유틸리티
//
// ⚠️ 이 파일의 `toISOString()` 은 **일부러 UTC 다.** 위치 계산 자체가 getUTC*/setUTC*
//    기준이라, 로그만 로컬로 바꾸면 계산값과 출력이 어긋나 검증에 못 쓴다.
//    2026-08-02 UTC→로컬 일괄 정리에서 여기와 debugUtils.js 만 제외했다
//    (둘 다 console.log 전용이라 사용자에게 보이는 값이 아니다).
//    화면·데이터에 쓰는 날짜는 shared/utils/localDate.js 를 쓸 것.

/**
 * 연단위 뷰에서 특정 날짜의 예상 위치 계산 (검증용)
 */
export const calculateExpectedYearlyPosition = (targetDate, displayRange, monthWidth) => {
  const target = new Date(targetDate);
  target.setUTCHours(0, 0, 0, 0);
  
  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth();
  const targetDate_ = target.getUTCDate();
  
  const startYear = displayRange.start.getUTCFullYear();
  const startMonth = displayRange.start.getUTCMonth();
  
  console.log('=== 예상 위치 계산 ===');
  console.log('대상 날짜:', targetYear, '년', targetMonth + 1, '월', targetDate_, '일');
  console.log('시작 날짜:', startYear, '년', startMonth + 1, '월');
  
  // 월별 오프셋
  const monthOffset = (targetYear - startYear) * 12 + (targetMonth - startMonth);
  console.log('월 오프셋:', monthOffset);
  
  // 해당 월의 일수 (UTC 기준)
  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  console.log('해당 월의 총 일수:', daysInMonth);
  
  // 일 비율 (1일 = 0, 마지막일 = 1에 가까움)
  const dayRatio = (targetDate_ - 1) / daysInMonth;
  console.log('일 비율:', dayRatio, '(', targetDate_ - 1, '/', daysInMonth, ')');
  
  const expectedPosition = monthOffset * monthWidth + dayRatio * monthWidth;
  console.log('예상 위치:', expectedPosition, 'px');
  console.log('===================');
  
  return expectedPosition;
};

/**
 * 월별 헤더 위치와 실제 계산 위치 비교 (검증용)
 */
export const verifyMonthlyPositions = (displayRange, timeUnits, monthWidth) => {
  console.log('=== 월별 헤더 위치 검증 ===');
  
  let cumulativePosition = 0;
  
  timeUnits.forEach((yearUnit, yearIndex) => {
    console.log(`연도: ${yearUnit.label}`);
    
    yearUnit.months.forEach((month, monthIndex) => {
      const monthStart = month.start;
      const monthEnd = month.end;
      
      console.log(`  ${month.label}:`);
      console.log(`    시작: ${monthStart.toISOString().split('T')[0]}`);
      console.log(`    종료: ${monthEnd.toISOString().split('T')[0]}`);
      console.log(`    헤더 위치: ${cumulativePosition}px`);
      
      // 해당 월의 실제 너비 계산
      const actualWidth = calculateActualMonthWidth(monthStart, monthEnd, monthWidth);
      console.log(`    실제 너비: ${actualWidth}px`);
      
      cumulativePosition += actualWidth;
      console.log(`    다음 월 시작 위치: ${cumulativePosition}px`);
      console.log('');
    });
  });
};

/**
 * 월의 실제 너비 계산 (부분 월 고려)
 */
const calculateActualMonthWidth = (monthStart, monthEnd, monthWidth) => {
  const startDate = monthStart.getUTCDate();
  const endDate = monthEnd.getUTCDate();
  const year = monthStart.getUTCFullYear();
  const month = monthStart.getUTCMonth();
  
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const actualDays = endDate - startDate + 1;
  
  if (actualDays === daysInMonth) {
    // 전체 월
    return monthWidth;
  } else {
    // 부분 월
    return (actualDays / daysInMonth) * monthWidth;
  }
};