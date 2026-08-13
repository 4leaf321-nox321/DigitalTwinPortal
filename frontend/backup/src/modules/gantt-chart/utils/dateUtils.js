// 날짜 관련 유틸리티 함수들 (일 단위 기반 통합 시스템)

/**
 * 날짜를 YYYY-MM-DD 형식으로 변환
 */
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * 로컬 시간 기준으로 날짜 정규화 (시간 부분 제거)
 */
const normalizeDate = (date) => {
  let normalized;
  
  if (typeof date === 'string') {
    // 문자열인 경우 Date 객체로 변환
    normalized = new Date(date);
  } else {
    // 이미 Date 객체인 경우 복사
    normalized = new Date(date);
  }
  
  // 유효한 날짜인지 확인
  if (isNaN(normalized.getTime())) {
    console.warn('잘못된 날짜 값:', date);
    return new Date(); // 오늘 날짜로 대체
  }
  
  // 로컬 시간 기준으로 시간 부분 제거
  normalized.setHours(0, 0, 0, 0);
  return normalized;
};

/**
 * 주어진 날짜의 주 시작일 (월요일) 계산
 */
export const getWeekStart = (date) => {
  const result = normalizeDate(date);
  const day = result.getDay();
  const diff = result.getDate() - day + (day === 0 ? -6 : 1);
  result.setDate(diff);
  return result;
};

/**
 * 주어진 날짜의 주 종료일 (일요일) 계산
 */
export const getWeekEnd = (date) => {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return weekEnd;
};

/**
 * 주어진 날짜의 주차 계산 (ISO 8601 표준)
 */
export const getWeekOfYear = (date) => {
  const d = normalizeDate(date);
  
  // 목요일을 주 중간으로 설정
  const target = new Date(d.getTime());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  
  // 목요일이 속하는 연도를 주의 연도로 사용
  const weekYear = target.getFullYear();
  
  // 해당 연도 1월 1일
  const jan1 = new Date(weekYear, 0, 1);
  
  // 첫 번째 목요일 찾기
  const jan1DayNr = (jan1.getDay() + 6) % 7;
  const firstThursday = new Date(jan1.getTime());
  firstThursday.setDate(1 + 3 - jan1DayNr);
  
  // 주차 계산
  const weekNumber = Math.floor((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  
  return {
    weekNumber: weekNumber,
    year: weekYear // 목요일의 연도 사용
  };
};

/**
 * 날짜 범위 생성 (시작일부터 종료일까지 모든 일자)
 * 이것이 모든 뷰의 기본이 됩니다
 */
export const getDateRange = (startDate, endDate) => {
  const dates = [];
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  
  for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
    dates.push(new Date(dt));
  }
  
  return dates;
};

/**
 * 일 단위 기반 주별 그룹화
 * 그리드 범위로 일자를 생성한 다음, 주별로 그룹화
 */
export const groupByWeeks = (gridRange) => {
  // 모든 일자 생성 (그리드 범위 기준)
  const allDates = getDateRange(gridRange.start, gridRange.end);
  
  const weeks = [];
  
  // 7일씩 묶어서 주 생성
  for (let i = 0; i < allDates.length; i += 7) {
    const weekDates = allDates.slice(i, i + 7);
    const weekStart = weekDates[0];
    const weekEnd = weekDates[weekDates.length - 1];
    const weekData = getWeekOfYear(weekStart);
    
    weeks.push({
      start: new Date(weekStart),
      end: new Date(weekEnd),
      label: `${weekData.year}년 ${weekData.weekNumber}주`,
      weekNumber: weekData.weekNumber,
      year: weekData.year,
      dates: weekDates.map(d => new Date(d)) // 해당 주의 모든 날짜
    });
  }
  
  return weeks;
};

/**
 * 일 단위 기반 월별 그룹화 (주 표시용)
 * 실제 프로젝트 범위의 월만 표시하지만, 그리드 계산은 확장 범위 사용
 * 프로젝트 종료일이 포함된 다음 해 첫 주가 있는 경우 해당 월도 포함
 */
export const groupWeeksByMonth = (gridRange, projectRange = null) => {
  // 모든 일자 생성 (그리드 범위 기준)
  const allDates = getDateRange(gridRange.start, gridRange.end);
  
  const months = [];
  
  // 실제 프로젝트 범위의 월만 처리 (헤더 표시용)
  const rangeForMonths = projectRange || gridRange;
  let startYear = rangeForMonths.start.getFullYear();
  let startMonth = rangeForMonths.start.getMonth();
  let endYear = rangeForMonths.end.getFullYear();
  let endMonth = rangeForMonths.end.getMonth();
  
  // 프로젝트 종료일이 포함된 주가 다음 해/월에 속하는 경우 해당 월도 추가
  const projectEndWeekEnd = getWeekEnd(rangeForMonths.end);
  if (projectEndWeekEnd > rangeForMonths.end) {
    const nextYear = projectEndWeekEnd.getFullYear();
    const nextMonth = projectEndWeekEnd.getMonth();
    
    // 다음 해로 넘어가는 경우 해당 월 추가
    if (nextYear > endYear || (nextYear === endYear && nextMonth > endMonth)) {
      endYear = nextYear;
      endMonth = nextMonth;
      console.log(`프로젝트 종료일 주 확장으로 추가된 월: ${nextYear}.${String(nextMonth + 1).padStart(2, '0')}`);
    }
  }
  
  let currentYear = startYear;
  let currentMonth = startMonth;
  
  while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
    // 해당 월의 실제 시작일과 종료일 계산
    let monthStart, monthEnd;
    
    if (currentYear === startYear && currentMonth === startMonth && currentYear === endYear && currentMonth === endMonth) {
      // 같은 월 내의 범위
      monthStart = new Date(rangeForMonths.start);
      monthEnd = new Date(rangeForMonths.end);
    } else if (currentYear === startYear && currentMonth === startMonth) {
      // 시작 월
      monthStart = new Date(rangeForMonths.start);
      monthEnd = new Date(currentYear, currentMonth + 1, 0);
    } else if (currentYear === endYear && currentMonth === endMonth) {
      // 종료 월 (프로젝트 원래 종료일 또는 확장된 월)
      monthStart = new Date(currentYear, currentMonth, 1);
      if (currentYear === rangeForMonths.end.getFullYear() && currentMonth === rangeForMonths.end.getMonth()) {
        // 프로젝트 원래 종료 월
        monthEnd = new Date(rangeForMonths.end);
      } else {
        // 프로젝트 종료일 포함 주로 인해 확장된 월
        monthEnd = new Date(currentYear, currentMonth + 1, 0);
      }
    } else {
      // 중간 월들
      monthStart = new Date(currentYear, currentMonth, 1);
      monthEnd = new Date(currentYear, currentMonth + 1, 0);
    }
    
    // 이 월에 해당하는 그리드 날짜들을 찾아서 주별로 그룹화
    const monthWeekStart = getWeekStart(monthStart);
    let monthWeekEnd = getWeekEnd(monthEnd);
    
    const monthDates = allDates.filter(date => {
      return date >= monthWeekStart && date <= monthWeekEnd;
    });
    
    if (monthDates.length > 0) {
      const weeks = [];
      
      // 7일씩 묶어서 주 생성
      for (let i = 0; i < monthDates.length; i += 7) {
        const weekDates = monthDates.slice(i, i + 7);
        const weekStart = weekDates[0];
        const weekEnd = weekDates[weekDates.length - 1];
        const weekData = getWeekOfYear(weekStart);
        
        // 디버깅: 주 번호 계산 확인
        if (currentMonth === endMonth && currentYear === endYear) {
          console.log(`${currentYear}.${String(currentMonth + 1).padStart(2, '0')} 월 주 생성: ${weekStart.toLocaleDateString('ko-KR')} ~ ${weekEnd.toLocaleDateString('ko-KR')} = ${weekData.year}년 ${weekData.weekNumber}주`);
          console.log(`  주에 포함된 날짜들:`, weekDates.map(d => d.toLocaleDateString('ko-KR')).join(', '));
          console.log(`  프로젝트 종료일: ${rangeForMonths.end.toLocaleDateString('ko-KR')}`);
        }
        
        // 이 주가 현재 월에 속하는지 확인
        // 2026년 1주(12월 29일 시작)는 2026년 1월에 속해야 함
        let belongsToCurrentMonth = false;
        
        if (weekData.year === 2026 && weekData.weekNumber === 1) {
          // 2026년 1주는 2026년 1월(currentMonth === 0)에만 속함
          belongsToCurrentMonth = (currentYear === 2026 && currentMonth === 0);
        } else {
          // 일반적인 경우: 주 시작일이 현재 월에 속하는지 확인
          belongsToCurrentMonth = weekStart.getFullYear() === currentYear && weekStart.getMonth() === currentMonth;
        }
        
        // 현재 월에 속하지 않는 주는 제외
        if (!belongsToCurrentMonth) {
          console.log(`다른 월 소속 주 제외: ${weekStart.toLocaleDateString('ko-KR')} ~ ${weekEnd.toLocaleDateString('ko-KR')} = ${weekData.year}년 ${weekData.weekNumber}주`);
          continue;
        }
        
        weeks.push({
          start: new Date(weekStart),
          end: new Date(weekEnd),
          label: `${weekData.year}년 ${weekData.weekNumber}주`,
          weekNumber: weekData.weekNumber,
          year: weekData.year,
          dates: weekDates.map(d => new Date(d))
        });
      }
      
      if (weeks.length > 0) {
        months.push({
          start: new Date(monthDates[0]), // 그리드 범위의 시작 (월요일일 수도 있음)
          end: new Date(monthDates[monthDates.length - 1]), // 주 끝까지
          actualStart: new Date(monthStart), // 실제 월 시작일 (1일)
          actualEnd: new Date(monthEnd),     // 실제 월 종료일 (말일)
          label: `${currentYear}.${String(currentMonth + 1).padStart(2, '0')}`,
          weeks: weeks
        });
      }
    }
    
    // 다음 월로 이동
    if (currentMonth === 11) {
      currentYear++;
      currentMonth = 0;
    } else {
      currentMonth++;
    }
  }
  
  return months;
};

/**
 * 날짜 배열로부터 월 객체 생성 (주 정보 포함)
 */
function createMonthFromDates(dates) {
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  
  // 해당 월의 실제 시작일과 종료일 찾기
  const monthStart = new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
  const monthEnd = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0);
  
  // 주별 그룹화
  const weeks = [];
  
  for (let i = 0; i < dates.length; i += 7) {
    const weekDates = dates.slice(i, i + 7);
    const weekStart = weekDates[0];
    const weekEnd = weekDates[weekDates.length - 1];
    const weekData = getWeekOfYear(weekStart);
    
    weeks.push({
      start: new Date(weekStart),
      end: new Date(weekEnd),
      label: `${weekData.year}년 ${weekData.weekNumber}주`,
      weekNumber: weekData.weekNumber,
      year: weekData.year,
      dates: weekDates.map(d => new Date(d))
    });
  }
  
  return {
    start: new Date(firstDate), // 표시 범위의 시작 (월요일일 수도 있음)
    end: new Date(lastDate),     // 표시 범위의 종료 (일요일일 수도 있음)
    actualStart: new Date(monthStart), // 실제 월 시작일 (1일)
    actualEnd: new Date(monthEnd),     // 실제 월 종료일 (말일)
    label: `${firstDate.getFullYear()}.${String(firstDate.getMonth() + 1).padStart(2, '0')}`,
    weeks: weeks
  };
}

/**
 * 일 단위 기반 연도별 그룹화 (월 표시용)
 * 그리드 범위 내에서 연도별로 그룹화하고 각 연도의 월들을 계산
 */
export const groupByYears = (gridRange, projectRange = null) => {
  const years = [];
  
  // 실제 프로젝트 범위의 연도만 처리 (헤더 표시용)
  const rangeForYears = projectRange || gridRange;
  const startYear = rangeForYears.start.getFullYear();
  const endYear = rangeForYears.end.getFullYear();
  
  for (let year = startYear; year <= endYear; year++) {
    // 해당 연도의 그리드 내 범위 계산
    let yearStart, yearEnd;
    
    if (year === startYear && year === endYear) {
      // 같은 연도 내의 범위
      yearStart = new Date(rangeForYears.start);
      yearEnd = new Date(rangeForYears.end);
    } else if (year === startYear) {
      // 시작 연도
      yearStart = new Date(rangeForYears.start);
      yearEnd = new Date(year, 11, 31); // 12월 31일
    } else if (year === endYear) {
      // 종료 연도  
      yearStart = new Date(year, 0, 1); // 1월 1일
      yearEnd = new Date(rangeForYears.end);
    } else {
      // 중간 연도들
      yearStart = new Date(year, 0, 1); // 1월 1일
      yearEnd = new Date(year, 11, 31); // 12월 31일
    }
    
    // 해당 연도의 월들 계산 (월 단위로 사용)
    const months = [];
    const yearStartMonth = yearStart.getMonth();
    const yearEndMonth = yearEnd.getMonth();
    
    for (let month = yearStartMonth; month <= yearEndMonth; month++) {
      let monthStart, monthEnd;
      
      if (month === yearStartMonth && month === yearEndMonth) {
        monthStart = new Date(yearStart);
        monthEnd = new Date(yearEnd);
      } else if (month === yearStartMonth) {
        monthStart = new Date(yearStart);
        monthEnd = new Date(year, month + 1, 0);
      } else if (month === yearEndMonth) {
        monthStart = new Date(year, month, 1);
        monthEnd = new Date(yearEnd);
      } else {
        monthStart = new Date(year, month, 1);
        monthEnd = new Date(year, month + 1, 0);
      }
      
      months.push({
        start: new Date(monthStart),
        end: new Date(monthEnd),
        label: `${month + 1}월`,
        month: month,
        year: year
      });
    }
    
    years.push({
      start: new Date(yearStart), // 그리드 범위의 시작
      end: new Date(yearEnd),     // 그리드 범위의 종료
      actualStart: new Date(year, 0, 1), // 실제 연도 시작일 (1월 1일)
      actualEnd: new Date(year, 11, 31),     // 실제 연도 종료일 (12월 31일)
      label: `${year}년`,
      months: months
    });
  }
  
  return years;
};

/**
 * 날짜 배열로부터 연도 객체 생성 (월 정보 포함)
 */
function createYearFromDates(dates) {
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  
  // 해당 연도의 실제 시작일과 종료일
  const yearStart = new Date(firstDate.getFullYear(), 0, 1);
  const yearEnd = new Date(firstDate.getFullYear(), 11, 31);
  
  // 월별 그룹화
  const months = [];
  let currentMonth = null;
  let monthDates = [];
  
  dates.forEach(date => {
    const monthKey = date.getMonth();
    
    if (currentMonth !== monthKey) {
      // 이전 월 처리
      if (currentMonth !== null && monthDates.length > 0) {
        months.push(createMonthFromDatesForYear(monthDates));
      }
      
      // 새 월 시작
      currentMonth = monthKey;
      monthDates = [];
    }
    
    monthDates.push(new Date(date));
  });
  
  // 마지막 월 처리
  if (monthDates.length > 0) {
    months.push(createMonthFromDatesForYear(monthDates));
  }
  
  return {
    start: new Date(firstDate), // 표시 범위의 시작
    end: new Date(lastDate),     // 표시 범위의 종료
    actualStart: new Date(yearStart), // 실제 연도 시작일 (1월 1일)
    actualEnd: new Date(yearEnd),     // 실제 연도 종료일 (12월 31일)
    label: `${firstDate.getFullYear()}년`,
    months: months
  };
}

/**
 * 연도 뷰용 월 객체 생성 (간단 버전)
 */
function createMonthFromDatesForYear(dates) {
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  
  return {
    start: new Date(firstDate),
    end: new Date(lastDate),
    label: `${firstDate.getMonth() + 1}월`,
    month: firstDate.getMonth(),
    year: firstDate.getFullYear(),
    dates: dates.map(d => new Date(d))
  };
}

/**
 * 월 단위로 그룹화 (기본 월 정보용)
 */
export const groupByMonths = (startDate, endDate) => {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  
  const months = [];
  let currentDate = new Date(start);
  
  while (currentDate <= end) {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    // 실제 표시 범위 내의 시작/종료일 계산
    const displayStart = currentDate.getTime() === start.getTime() ? start : monthStart;
    const displayEnd = monthEnd <= end ? monthEnd : end;
    
    months.push({
      start: new Date(displayStart),
      end: new Date(displayEnd),
      label: `${currentDate.getFullYear()}.${String(currentDate.getMonth() + 1).padStart(2, '0')}`,
      actualStart: new Date(monthStart),
      actualEnd: new Date(monthEnd)
    });
    
    // 다음 월로 이동
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  }
  
  return months;
};

/**
 * 두 날짜 사이의 정확한 일수 계산
 */
export const getDaysBetween = (startDate, endDate) => {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * 날짜가 주어진 범위 내에 있는지 확인
 */
export const isDateInRange = (date, startDate, endDate) => {
  const d = normalizeDate(date);
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  return d >= start && d <= end;
};

/**
 * 전체 프로젝트 기간 계산 (실제 범위만, 확장하지 않음)
 */
export const getProjectDateRange = (tasks) => {
  if (!tasks || tasks.length === 0) {
    const today = new Date();
    return { 
      start: normalizeDate(today), 
      end: normalizeDate(today) 
    };
  }
  
  console.log('태스크 데이터 개수:', tasks.length);
  
  const dates = tasks.reduce((acc, task) => {
    if (task.startDate) {
      const startDate = normalizeDate(task.startDate);
      console.log(`태스크 "${task.name}" 시작일: ${task.startDate} -> ${startDate.toLocaleDateString('ko-KR')}`);
      acc.push(startDate);
    }
    if (task.endDate) {
      const endDate = normalizeDate(task.endDate);
      console.log(`태스크 "${task.name}" 종료일: ${task.endDate} -> ${endDate.toLocaleDateString('ko-KR')}`);
      acc.push(endDate);
    }
    return acc;
  }, []);
  
  if (dates.length === 0) {
    const today = new Date();
    return { 
      start: normalizeDate(today), 
      end: normalizeDate(today) 
    };
  }
  
  let start = new Date(Math.min(...dates));
  let end = new Date(Math.max(...dates));
  
  console.log('=== 프로젝트 날짜 범위 계산 (실제 범위) ===');
  console.log('실제 시작일:', start.toLocaleDateString('ko-KR'));
  console.log('실제 종료일:', end.toLocaleDateString('ko-KR'));
  console.log('============================================');
  
  return { start, end };
};

/**
 * 그리드 계산용 확장 범위 (주 단위로 확장)
 */
export const getGridDateRange = (displayRange) => {
  const expandedStart = getWeekStart(displayRange.start);
  const expandedEnd = getWeekEnd(displayRange.end);
  
  console.log('=== 그리드 범위 계산 ===');
  console.log('사용자 범위:', displayRange.start.toLocaleDateString('ko-KR'), '~', displayRange.end.toLocaleDateString('ko-KR'));
  console.log('그리드 범위 (주 확장):', expandedStart.toLocaleDateString('ko-KR'), '~', expandedEnd.toLocaleDateString('ko-KR'));
  console.log('========================');
  
  return { start: expandedStart, end: expandedEnd };
};

/**
 * 날짜를 한국어 형식으로 포맷
 */
export const formatDateKorean = (date) => {
  if (!date) return '';
  const d = normalizeDate(date);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * 오늘 날짜 체크
 */
export const isToday = (date) => {
  const today = normalizeDate(new Date());
  const d = normalizeDate(date);
  return d.getTime() === today.getTime();
};

/**
 * 날짜 문자열을 Date 객체로 안전하게 변환
 */
export const parseDate = (dateString) => {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return normalizeDate(date);
  } catch (error) {
    console.warn('Invalid date string:', dateString);
    return null;
  }
};

/**
 * 월의 첫 번째 날 구하기
 */
export const getMonthStart = (date) => {
  const d = normalizeDate(date);
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

/**
 * 월의 마지막 날 구하기
 */
export const getMonthEnd = (date) => {
  const d = normalizeDate(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
};

/**
 * 연도의 첫 번째 날 구하기
 */
export const getYearStart = (date) => {
  const d = normalizeDate(date);
  return new Date(d.getFullYear(), 0, 1);
};

/**
 * 연도의 마지막 날 구하기
 */
export const getYearEnd = (date) => {
  const d = normalizeDate(date);
  return new Date(d.getFullYear(), 11, 31);
};

// 디버깅 함수들
/**
 * 날짜 범위 디버깅
 */
export const debugDateRange = (startDate, endDate, viewType = 'all') => {
  console.log('\n=== 날짜 범위 디버깅 ===');
  console.log('시작일:', startDate.toLocaleDateString('ko-KR'));
  console.log('종료일:', endDate.toLocaleDateString('ko-KR'));
  console.log('총 일수:', getDaysBetween(startDate, endDate) + 1, '일');
  
  if (viewType === 'all' || viewType === 'weeks') {
    console.log('\n--- 주 단위 그룹화 ---');
    const weeks = groupByWeeks(startDate, endDate);
    console.log('총', weeks.length, '주');
    weeks.forEach((week, i) => {
      console.log(`${i + 1}. ${week.label}: ${week.start.toLocaleDateString('ko-KR')} ~ ${week.end.toLocaleDateString('ko-KR')} (${week.dates.length}일)`);
    });
  }
  
  if (viewType === 'all' || viewType === 'months') {
    console.log('\n--- 월 단위 그룹화 (주 표시) ---');
    const months = groupWeeksByMonth(startDate, endDate);
    console.log('총', months.length, '월');
    months.forEach((month, i) => {
      console.log(`${i + 1}. ${month.label}: ${month.start.toLocaleDateString('ko-KR')} ~ ${month.end.toLocaleDateString('ko-KR')}`);
      console.log(`     실제 월: ${month.actualStart.toLocaleDateString('ko-KR')} ~ ${month.actualEnd.toLocaleDateString('ko-KR')}`);
      console.log(`     주 수: ${month.weeks.length}주`);
      month.weeks.forEach((week, j) => {
        console.log(`       ${j + 1}. ${week.label}: ${week.dates.length}일`);
      });
    });
  }
  
  if (viewType === 'all' || viewType === 'years') {
    console.log('\n--- 연도 단위 그룹화 (월 표시) ---');
    const years = groupByYears(startDate, endDate);
    console.log('총', years.length, '년');
    years.forEach((year, i) => {
      console.log(`${i + 1}. ${year.label}: ${year.start.toLocaleDateString('ko-KR')} ~ ${year.end.toLocaleDateString('ko-KR')}`);
      console.log(`     실제 연도: ${year.actualStart.toLocaleDateString('ko-KR')} ~ ${year.actualEnd.toLocaleDateString('ko-KR')}`);
      console.log(`     월 수: ${year.months.length}월`);
      year.months.forEach((month, j) => {
        console.log(`       ${j + 1}. ${month.label}: ${month.dates.length}일`);
      });
    });
  }
  
  console.log('========================\n');
};
