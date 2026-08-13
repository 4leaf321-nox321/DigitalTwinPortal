import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getProjectDateRange, groupByWeeks, groupByMonths, groupByYears, groupWeeksByMonth, getGridDateRange } from '../../utils/dateUtils';
import { calculateTaskPosition, getTaskStatus, isTaskDelayed, isParentTask } from '../../utils/taskUtils';
import { progressColors, priorityColors } from '../../data/sampleTasks';
import TaskBar from './TaskBar';
import GanttToolbar from './components/GanttToolbar';
import TimelineHeader from './components/TimelineHeader';
import GanttLegend from './components/GanttLegend';
import { useColumnResizer } from '../../hooks/useColumnResizer';
import { useTodayPosition } from '../../hooks/useTodayPosition';
import './GanttChart.css';

const GanttChart = ({ 
  tasks = [], 
  displayTasks = [], 
  selectedTask, 
  onTaskSelect, 
  onTaskUpdate,
  onTaskToggle, 
  onTaskDelete, // 태스크 삭제 핸들러 추가
  viewMode = 'weeks' 
}) => {
  const [scale, setScale] = useState(1);
  const [scrollX, setScrollX] = useState(0);
  const [viewModeState, setViewModeState] = useState(viewMode);
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  
  // displayTasks가 없으면 원본 tasks 사용
  const tasksToDisplay = displayTasks.length > 0 ? displayTasks : tasks;
  
  // 프로젝트 전체 기간 계산 (모든 태스크 기준)
  const projectRange = getProjectDateRange(tasks);
  
  // 그리드용 확장 범위 계산 (주 단위로 확장)
  const gridRange = getGridDateRange(projectRange);
  
  // 디버깅: 범위 계산 확인
  useEffect(() => {
    console.log('\n=== 범위 디버깅 (통일) ===');
    console.log('projectRange:', projectRange.start.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }), '~', projectRange.end.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }));
    console.log('gridRange:', gridRange.start.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }), '~', gridRange.end.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }));
    console.log('=========================');
  }, [projectRange, gridRange]);
  
  // 컬럼 리사이저 훅 사용
  const {
    taskNameColWidth,
    assigneeColWidth,
    progressColWidth,
    isResizing,
    resizingColumn,
    handleColumnResize,
    totalTaskPanelWidth
  } = useColumnResizer();
  
  // 뷰 모드에 따른 시간 축 생성 (모든 계산을 gridRange 기준으로 통일)
  const getTimelineData = () => {
    const baseDayWidth = 40 * scale;
    
    switch (viewModeState) {
      case 'days':
        return {
          units: groupByWeeks(gridRange),
          type: 'days',
          unitWidth: baseDayWidth * 7,
          subUnitWidth: baseDayWidth
        };
      case 'weeks':
        return {
          units: groupByWeeks(gridRange),
          type: 'weeks',
          unitWidth: baseDayWidth * 7,
          subUnitWidth: baseDayWidth
        };
      case 'months':
        return {
          units: groupWeeksByMonth(gridRange, projectRange),
          type: 'months',
          unitWidth: baseDayWidth * 7,
          subUnitWidth: baseDayWidth * 7
        };
      case 'years':
        return {
          units: groupByYears(gridRange, projectRange),
          type: 'years',
          unitWidth: baseDayWidth * 30,
          subUnitWidth: baseDayWidth * 30
        };
      default:
        return {
          units: groupByWeeks(gridRange),
          type: 'weeks',
          unitWidth: baseDayWidth * 7,
          subUnitWidth: baseDayWidth
        };
    }
  };
  
  const timelineData = getTimelineData();
  const { units: timeUnits, type: timeType, unitWidth, subUnitWidth } = timelineData;
  
  // 디버깅: 타임라인 데이터 확인
  useEffect(() => {
    console.log('\n=== 간트 차트 타임라인 디버깅 (통일) ===');
    console.log('뷰 모드:', viewModeState);
    console.log('그리드 범위:', gridRange.start.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }), '~', gridRange.end.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }));
    console.log('타임 유닛 개수:', timeUnits.length);
    console.log('첫 번째 유닛:', timeUnits[0]);
    console.log('마지막 유닛:', timeUnits[timeUnits.length - 1]);
    console.log('=======================================\n');
  }, [viewModeState, gridRange, timeUnits]);
  
  // 오늘 날짜 위치 계산 훅 사용
  const todayPosition = useTodayPosition(gridRange, timeUnits, timeType, subUnitWidth, scale);
  
  // 키보드 이벤트 처리 (Delete 키로 태스크 삭제)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 선택된 태스크가 있고, Delete 또는 Backspace 키를 누른 경우
      if (selectedTask && (e.key === 'Delete' || e.key === 'Backspace')) {
        // input, textarea, select 등에서는 삭제 방지
        const activeElement = document.activeElement;
        const isInputElement = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT' ||
          activeElement.isContentEditable
        );
        
        // 입력 요소에 포커스가 있으면 삭제하지 않음
        if (!isInputElement) {
          e.preventDefault();
          if (onTaskDelete) {
            onTaskDelete(selectedTask.id);
          }
        }
      }
    };

    // 전역 이벤트 리스너 등록
    document.addEventListener('keydown', handleKeyDown);
    
    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedTask, onTaskDelete]);

  // 스크롤 핸들링
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      setScrollX(container.scrollLeft);
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);
  
  // 확대/축소 및 뷰 모드 전환
  const handleZoom = (direction) => {
    setScale(prev => {
      let newScale;
      if (direction === 'in') {
        newScale = Math.min(prev * 1.2, 3);
      } else {
        newScale = Math.max(prev / 1.2, 0.1);
      }
      
      // 스케일에 따른 뷰 모드 자동 전환
      if (newScale >= 1.5) {
        setViewModeState('days');
      } else if (newScale >= 0.8) {
        setViewModeState('weeks');
      } else if (newScale >= 0.3) {
        setViewModeState('months');
      } else {
        setViewModeState('years');
      }
      
      return newScale;
    });
  };
  
  // 뷰 모드 직접 변경
  const handleViewModeChange = (newViewMode) => {
    setViewModeState(newViewMode);
    
    // 뷰 모드에 따른 기본 스케일 설정
    switch (newViewMode) {
      case 'days':
        setScale(2);
        break;
      case 'weeks':
        setScale(1);
        break;
      case 'months':
        setScale(0.5);
        break;
      case 'years':
        setScale(0.2);
        break;
      default:
        setScale(1);
    }
  };
  
  // 오늘로 이동
  const scrollToToday = () => {
    if (todayPosition >= 0 && containerRef.current) {
      containerRef.current.scrollLeft = Math.max(0, todayPosition - containerRef.current.clientWidth / 2);
    }
  };

  // 태스크 토글 핸들러
  const handleTaskToggle = (taskId, e) => {
    e.stopPropagation();
    if (onTaskToggle) {
      onTaskToggle(taskId);
    }
  };

  // 전체 차트 최소 너비 계산
  const getTotalChartWidth = () => {
    let totalWidth = 0;
    
    timeUnits.forEach(unit => {
      if (timeType === 'months' && unit.weeks) {
        totalWidth += unit.weeks.length * subUnitWidth;
      } else if (timeType === 'years' && unit.months) {
        totalWidth += unit.months.length * subUnitWidth;
      } else if (timeType === 'weeks' || timeType === 'days') {
        totalWidth += unitWidth;
      } else {
        totalWidth += unitWidth;
      }
    });
    
    return totalTaskPanelWidth + totalWidth;
  };
  
  const totalChartMinWidth = getTotalChartWidth();

  if (tasks.length === 0) {
    return (
      <div className="gantt-chart-container">
        <div className="gantt-empty">
          <div className="empty-icon">📊</div>
          <h3>태스크가 없습니다</h3>
          <p>새 태스크를 추가하거나 샘플 데이터를 불러오세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gantt-chart-container">
      {/* 툴바 */}
      <GanttToolbar
        viewModeState={viewModeState}
        scale={scale}
        projectRange={projectRange}
        todayPosition={todayPosition}
        onViewModeChange={handleViewModeChange}
        onZoom={handleZoom}
        onScrollToToday={scrollToToday}
      />

      {/* 간트 차트 */}
      <div 
        ref={containerRef} 
        className="gantt-scroll-container"
        tabIndex={0}
        style={{ outline: 'none' }}
        onFocus={() => {
          // 간트 차트에 포커스가 오면 키보드 이벤트를 받을 준비
        }}
      >
        <div 
          ref={chartRef}
          className="gantt-chart"
          style={{ minWidth: totalChartMinWidth }}
        >
          {/* 시간 헤더 */}
          <TimelineHeader
            timeType={timeType}
            timeUnits={timeUnits}
            unitWidth={unitWidth}
            subUnitWidth={subUnitWidth}
            totalTaskPanelWidth={totalTaskPanelWidth}
            taskNameColWidth={taskNameColWidth}
            assigneeColWidth={assigneeColWidth}
            progressColWidth={progressColWidth}
            isResizing={isResizing}
            resizingColumn={resizingColumn}
            onColumnResize={handleColumnResize}
          />

          {/* 태스크 행들 */}
          <div className="gantt-body">
            {tasksToDisplay.map((task, index) => {
              // 단위 너비에 따른 정확한 일별 너비 계산
              let taskDayWidth;
              
              if (viewModeState === 'years') {
                // 연 단위: subUnitWidth가 월 너비이므로 평균 30일로 나눔
                taskDayWidth = subUnitWidth / 30;
              } else if (viewModeState === 'months') {
                // 월 단위: subUnitWidth가 주 너비이므로 7일로 나눔
                taskDayWidth = subUnitWidth / 7;
              } else {
                // 주/일 단위: 기본 일 너비
                taskDayWidth = 40 * scale;
              }
              
              const position = calculateTaskPosition(task, gridRange.start, taskDayWidth, viewModeState, scale);
              
              // 디버깅: 태스크 위치 계산 확인 (첫 번째 태스크만)
              if (index === 0) {
                console.log(`\n=== 태스크 위치 디버깅 (${viewModeState}) ===`);
                console.log(`태스크: ${task.name}`);
                console.log(`태스크 날짜: ${task.startDate} ~ ${task.endDate}`);
                console.log(`그리드 시작: ${gridRange.start.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
                console.log(`일 너비: ${taskDayWidth}px`);
                console.log(`계산된 위치: left=${position.left}px, width=${position.width}px`);
                console.log('==========================================\n');
              }
              
              const isSelected = selectedTask && selectedTask.id === task.id;
              const status = getTaskStatus(task.progress);
              const isDelayed = isTaskDelayed(task);
              const taskIsParent = isParentTask(task.id, tasks);
              
              return (
                <div 
                  key={task.id} 
                  className={`gantt-row ${isSelected ? 'selected' : ''} ${index % 2 === 0 ? 'even' : 'odd'} level-${task.level}`}
                >
                  {/* 태스크 정보 */}
                  <div 
                    className="task-info"
                    style={{ 
                      width: totalTaskPanelWidth, 
                      minWidth: totalTaskPanelWidth,
                      backgroundColor: isResizing ? 'rgba(227, 242, 253, 0.3)' : 'inherit'
                    }}
                  >
                    <div 
                      className="task-name-col"
                      style={{ 
                        width: taskNameColWidth, 
                        minWidth: taskNameColWidth,
                        backgroundColor: isResizing && resizingColumn === 'name' ? '#e3f2fd' : 'inherit'
                      }}
                    >
                      <div 
                      className={`task-name ${isDelayed ? 'delayed' : ''}`}
                      onClick={() => onTaskSelect(task)}
                      style={{ 
                        fontWeight: taskIsParent ? 'bold' : 'normal'
                      }}
                      >
                        {/* 계층 표시 인덴트 */}
                        <div 
                          className="task-hierarchy"
                          style={{ paddingLeft: `${task.level * 20}px` }}
                        >
                          {/* 토글 버튼 공간 */}
                          <div className="task-toggle-space">
                            {taskIsParent ? (
                              <button
                                className="task-toggle-btn"
                                onClick={(e) => handleTaskToggle(task.id, e)}
                                title={task.collapsed ? '펼치기' : '접기'}
                              >
                                {task.collapsed ? 
                                  <ChevronRight size={14} /> : 
                                  <ChevronDown size={14} />
                                }
                              </button>
                            ) : (
                              <span className="task-toggle-placeholder"></span>
                            )}
                          </div>
                          
                          {/* 우선순위 표시 */}
                          <div 
                            className="task-priority-indicator"
                            style={{ backgroundColor: priorityColors[task.priority] }}
                            title={`우선순위: ${task.priority}`}
                          ></div>
                          
                          {/* 태스크 이름 */}
                          <span className="task-name-text">
                            {task.name}
                          </span>
                          
                          {/* 지연 표시 */}
                          {isDelayed && <span className="delayed-indicator">⚠️</span>}
                        </div>
                      </div>
                    </div>
                    <div 
                      className="task-assignee-col"
                      style={{ 
                        width: assigneeColWidth, 
                        minWidth: assigneeColWidth,
                        backgroundColor: isResizing && resizingColumn === 'assignee' ? '#e3f2fd' : 'inherit'
                      }}
                    >
                      {task.assignee || '-'}
                    </div>
                    <div 
                      className="task-progress-col"
                      style={{ 
                        width: progressColWidth, 
                        minWidth: progressColWidth,
                        backgroundColor: isResizing && resizingColumn === 'progress' ? '#e3f2fd' : 'inherit'
                      }}
                    >
                      <div className="progress-container">
                        <div 
                          className="progress-bar"
                          style={{ 
                            width: `${task.progress}%`,
                            backgroundColor: progressColors[status]
                          }}
                        ></div>
                        <span className="progress-text">{task.progress}%</span>
                      </div>
                    </div>
                  </div>

                  {/* 타임라인 */}
                  <div className="task-timeline">
                    <TaskBar
                      task={task}
                      position={position}
                      isSelected={isSelected}
                      isDelayed={isDelayed}
                      isParent={taskIsParent}
                      onClick={() => onTaskSelect(task)}
                      onUpdate={onTaskUpdate}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 오늘 표시선 */}
          {todayPosition >= 0 && (
            <div 
              className="today-line"
              data-date={`${new Date().getMonth() + 1}/${new Date().getDate()}`}
              style={{ left: todayPosition + totalTaskPanelWidth }}
            />
          )}
        </div>
      </div>

      {/* 범례 */}
      <GanttLegend />
    </div>
  );
};

export default GanttChart;
