import { useMemo } from 'react';
import { getWeekStart, getDaysBetween } from '../utils/dateUtils';

/**
 * 정확한 오늘 날짜 위치 계산 훅 (새로운 일 단위 기반 시스템)
 */
export const useTodayPosition = (displayRange, timeUnits, timeType, subUnitWidth, scale) => {
  return useMemo(() => {
    // 현재 로컬 시간의 날짜 부분만 사용 (시간대 변환 없이)
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // displayRange도 로컬 시간 기준으로 정규화
    const rangeStart = new Date(displayRange.start);
    const normalizedStart = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), rangeStart.getDate());
    const rangeEnd = new Date(displayRange.end);
    const normalizedEnd = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), rangeEnd.getDate());
    
    if (normalizedStart > today || today > normalizedEnd) {
      return -1;
    }
    
    console.log('=== 오늘 위치 계산 (' + timeType + ') ===');
    console.log('실제 오늘:', now.toLocaleDateString('ko-KR'));
    console.log('계산용 오늘:', today.toLocaleDateString('ko-KR'));
    console.log('범위 시작:', normalizedStart.toLocaleDateString('ko-KR'));
    console.log('범위 끝:', normalizedEnd.toLocaleDateString('ko-KR'));
    console.log('subUnitWidth:', subUnitWidth);
    
    switch (timeType) {
      case 'days':
      case 'weeks':
        // 일/주 단위에서는 정확한 일별 계산
        // 새로운 시스템에서는 표시 범위가 주 시작(월요일)부터 시작됨
        const displayStart = getWeekStart(normalizedStart);
        const daysSinceStart = getDaysBetween(displayStart, today);
        const position = daysSinceStart * (40 * scale);
        console.log('표시 시작 (주의 월요일):', displayStart.toLocaleDateString('ko-KR'));
        console.log('일수 차이:', daysSinceStart, '일');
        console.log('위치:', position, 'px');
        console.log('===============================================');
        return position;
      
      case 'months':
        // 월단위 뷰에서는 주 단위 기준으로 계산
        return calculateMonthlyTodayPositionByWeek(today, normalizedStart, subUnitWidth);
      
      case 'years':
        return calculateYearlyTodayPosition(today, normalizedStart, normalizedEnd, timeUnits, subUnitWidth);
      
      default:
        return 0;
    }
  }, [displayRange, timeUnits, timeType, subUnitWidth, scale]);
};

/**
 * 월 단위 뷰에서 오늘 날짜 위치 계산 (새로운 시스템)
 */
const calculateMonthlyTodayPositionByWeek = (today, rangeStart, weekWidth) => {
  console.log('=== 월단위 오늘 위치 계산 (주 기준) ===');
  console.log('오늘:', today.toLocaleDateString('ko-KR'));
  console.log('범위 시작:', rangeStart.toLocaleDateString('ko-KR'));
  console.log('주 너비:', weekWidth);
  
  // 새로운 시스템에서는 표시 범위가 주 시작부터 시작됨
  const displayStart = getWeekStart(rangeStart);
  const todayWeek = getWeekStart(today);
  
  console.log('표시 시작 (주의 월요일):', displayStart.toLocaleDateString('ko-KR'));
  console.log('오늘이 포함된 주:', todayWeek.toLocaleDateString('ko-KR'));
  
  // 주별 오프셋 계산
  const msPerWeek = 1000 * 60 * 60 * 24 * 7;
  const weekOffset = Math.round((todayWeek.getTime() - displayStart.getTime()) / msPerWeek);
  
  console.log('주 차이:', weekOffset);
  
  if (weekOffset < 0) return 0; // 범위 이전
  
  // 주 내에서의 일별 위치 계산
  const dayOfWeek = (today.getDay() + 6) % 7; // 월요일을 0으로
  const dayRatio = dayOfWeek / 7;
  
  console.log('주 내 일자 (0=월요일):', dayOfWeek);
  console.log('일 비율:', dayRatio);
  
  const result = weekOffset * weekWidth + dayRatio * weekWidth;
  
  console.log('최종 위치:', result);
  console.log('계산:', weekOffset, '* ', weekWidth, '+', dayRatio, '*', weekWidth, '=', result);
  console.log('===============================================');
  
  return result;
};

/**
 * 연 단위 뷰에서 오늘 날짜 위치 계산 (새로운 시스템)
 */
const calculateYearlyTodayPosition = (today, rangeStart, rangeEnd, timeUnits, monthWidth) => {
  console.log('=== 연단위 오늘 위치 계산 ===');
  console.log('실제 오늘:', today.toLocaleDateString('ko-KR'));
  console.log('범위 시작:', rangeStart.toLocaleDateString('ko-KR'));
  console.log('월 너비:', monthWidth);
  
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth(); // 0-11
  const todayDate = today.getDate(); // 1-31
  
  const startYear = rangeStart.getFullYear();
  const startMonth = rangeStart.getMonth(); // 0-11
  
  console.log('오늘:', todayYear, '년', todayMonth + 1, '월', todayDate, '일');
  console.log('시작:', startYear, '년', startMonth + 1, '월');
  
  // 새로운 시스템에서는 표시 범위가 주 시작부터 시작되므로, 실제 표시되는 첫 번째 월을 찾아야 함
  const displayStart = getWeekStart(rangeStart);
  const displayStartYear = displayStart.getFullYear();
  const displayStartMonth = displayStart.getMonth();
  
  // 월별 오프셋 계산 (표시 시작 기준)
  const monthOffset = (todayYear - displayStartYear) * 12 + (todayMonth - displayStartMonth);
  console.log('표시 시작:', displayStart.toLocaleDateString('ko-KR'));
  console.log('월 오프셋:', monthOffset);
  
  if (monthOffset < 0) return 0; // 범위 이전
  
  // 현재 월에서 일별 위치 계산
  const daysInMonth = new Date(todayYear, todayMonth + 1, 0).getDate();
  const dayRatio = (todayDate - 1) / daysInMonth;
  
  console.log('현재 월의 총 일수:', daysInMonth);
  console.log('오늘 일자:', todayDate);
  console.log('일 비율:', dayRatio, '=', (todayDate - 1), '/', daysInMonth);
  
  const result = monthOffset * monthWidth + dayRatio * monthWidth;
  console.log('최종 위치:', result);
  console.log('계산:', monthOffset, '* ', monthWidth, '+', dayRatio, '*', monthWidth);
  console.log('===============================================');
  
  return result;
};
