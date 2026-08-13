// 날짜 유틸리티 디버깅 헬퍼 함수들

/**
 * groupByYears 함수 디버깅
 */
export const debugGroupByYears = (startDate, endDate) => {
  console.log('=== DEBUG: groupByYears ===');
  console.log('Start Date:', startDate);
  console.log('End Date:', endDate);
  
  const result = groupByYears(startDate, endDate);
  
  result.forEach(year => {
    console.log(`Year: ${year.label}`);
    console.log(`  Start: ${year.start.toISOString()}`);
    console.log(`  End: ${year.end.toISOString()}`);
    console.log(`  Months:`);
    
    year.months.forEach((month, index) => {
      console.log(`    ${index + 1}. ${month.label} (${month.start.toISOString().split('T')[0]} ~ ${month.end.toISOString().split('T')[0]})`);
    });
  });
  
  return result;
};

/**
 * groupByMonths 함수 디버깅
 */
export const debugGroupByMonths = (startDate, endDate) => {
  console.log('=== DEBUG: groupByMonths ===');
  console.log('Start Date:', startDate);
  console.log('End Date:', endDate);
  
  const result = groupByMonths(startDate, endDate);
  
  result.forEach((month, index) => {
    console.log(`${index + 1}. ${month.label}`);
    console.log(`   Start: ${month.start.toISOString()}`);
    console.log(`   End: ${month.end.toISOString()}`);
    console.log(`   Month Index: ${month.start.getUTCMonth()}`);
  });
  
  return result;
};