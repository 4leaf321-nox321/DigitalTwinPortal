import React from 'react';
import { isToday } from '../../../utils/dateUtils';

const TimelineHeader = ({ 
  timeType, 
  timeUnits, 
  unitWidth, 
  subUnitWidth,
  totalTaskPanelWidth,
  taskNameColWidth,
  assigneeColWidth,
  progressColWidth,
  isResizing,
  resizingColumn,
  onColumnResize
}) => {
  // 월 단위 뷰에서 주 표시 디버깅
  React.useEffect(() => {
    if (timeType === 'months') {
      console.log('\n=== TimelineHeader 월 뷰 디버깅 ===');
      timeUnits.forEach((month, index) => {
        console.log(`월 ${index + 1}: ${month.label}, 주 개수: ${month.weeks ? month.weeks.length : 0}`);
        if (month.weeks) {
          month.weeks.forEach((week, weekIndex) => {
            console.log(`  주 ${weekIndex + 1}: ${week.label}`);
          });
        }
      });
      console.log('===================================');
    }
  }, [timeType, timeUnits]);

  return (
    <div className="gantt-header-row">
      <div 
        className="task-list-header"
        style={{ width: totalTaskPanelWidth, minWidth: totalTaskPanelWidth }}
      >
        <div 
          className="task-name-col"
          style={{ 
            width: taskNameColWidth, 
            minWidth: taskNameColWidth,
            backgroundColor: isResizing && resizingColumn === 'name' ? '#e3f2fd' : 'inherit'
          }}
        >
          태스크
          {/* 리사이즈 핸들 */}
          <div 
            className="column-resize-handle"
            onMouseDown={(e) => onColumnResize(e, 'name', taskNameColWidth)}
            title="드래그하여 너비 조절"
          />
        </div>
        <div 
          className="task-assignee-col"
          style={{ 
            width: assigneeColWidth, 
            minWidth: assigneeColWidth,
            backgroundColor: isResizing && resizingColumn === 'assignee' ? '#e3f2fd' : 'inherit'
          }}
        >
          담당자
          <div 
            className="column-resize-handle"
            onMouseDown={(e) => onColumnResize(e, 'assignee', assigneeColWidth)}
            title="드래그하여 너비 조절"
          />
        </div>
        <div 
          className="task-progress-col"
          style={{ 
            width: progressColWidth, 
            minWidth: progressColWidth,
            backgroundColor: isResizing && resizingColumn === 'progress' ? '#e3f2fd' : 'inherit'
          }}
        >
          진행률
        </div>
      </div>
      
      <div className="timeline-header">
        {/* 일/주 단위 뷰 */}
        {(timeType === 'days' || timeType === 'weeks') && timeUnits.map((week, index) => (
          <div 
            key={index} 
            className="week-header"
            style={{ width: unitWidth }}
          >
            <div className="week-label">{week.label}</div>
            <div className="days-row">
              {week.dates && week.dates.map((date, dayIndex) => {
                const isToday_ = isToday(date);
                
                return (
                  <div 
                    key={dayIndex}
                    className={`day-header ${isToday_ ? 'today' : ''}`}
                    style={{ width: subUnitWidth }}
                  >
                    {date.getDate()}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        
        {/* 월 단위 뷰 (주 표시) */}
        {timeType === 'months' && timeUnits.map((month, index) => {
          const monthWeekCount = month.weeks ? month.weeks.length : 0;
          const monthWidth = monthWeekCount * subUnitWidth;
          
          console.log(`월 ${index + 1} (${month.label}) 렌더링: 주 ${monthWeekCount}개, 너비 ${monthWidth}px`);
          
          return (
            <div 
              key={index} 
              className="month-header"
              style={{ width: monthWidth }}
            >
              <div className="month-label">{month.label}</div>
              <div className="weeks-row">
                {month.weeks && month.weeks.map((week, weekIndex) => (
                  <div 
                    key={weekIndex}
                    className="week-header-small"
                    style={{ width: subUnitWidth }}
                    title={`${week.year}년 ${week.weekNumber}주 (${week.start.getMonth() + 1}/${week.start.getDate()} ~ ${week.end.getMonth() + 1}/${week.end.getDate()})`}
                  >
                    {week.weekNumber}주
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        
        {/* 연 단위 뷰 (월 표시) */}
        {timeType === 'years' && timeUnits.map((year, index) => (
          <div 
            key={index} 
            className="year-header"
            style={{ width: (year.months && year.months.length || 0) * subUnitWidth }}
          >
            <div className="year-label">{year.label}</div>
            <div className="months-row">
              {year.months && year.months.map((month, monthIndex) => (
                <div 
                  key={monthIndex}
                  className="month-header-small"
                  style={{ width: subUnitWidth }}
                  title={`${month.year}년 ${month.month + 1}월`}
                >
                  {month.month + 1}월
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimelineHeader;
