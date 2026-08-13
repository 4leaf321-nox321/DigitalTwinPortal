import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, X, Download, TrendingUp } from 'lucide-react';
import EffectTreemap from './EffectTreemap';
import { todayLocalYmd } from '../../../../shared/utils/localDate';

const Wrapper = styled.div`
  padding: 24px;
  height: 100%;
  overflow-y: auto;
`;

const TopBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const TabToggle = styled.div`
  display: flex;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 3px;
  border: 1px solid #e2e8f0;
`;

const TabBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  background: ${p => p.$active ? '#6366f1' : 'transparent'};
  color: ${p => p.$active ? 'white' : '#64748b'};
  &:hover { background: ${p => p.$active ? '#4f46e5' : '#e2e8f0'}; }
`;

const PlaceholderArea = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: calc(100% - 60px);
  color: #94a3b8;
  gap: 12px;
  span { font-size: 0.9rem; }
`;

const Grid = styled.div`
  display: grid;
  gap: 20px;
  grid-template-columns: 1fr;

  @media (min-width: 760px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (min-width: 1280px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  @media (min-width: 1920px) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
`;

const Card = styled.div`
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
`;

const CardHeader = styled.div`
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e2e8f0;
  background: ${p => p.$color ? `${p.$color}0d` : '#f8fafc'};
`;

const DivisionName = styled.div`
  font-size: 0.92rem;
  font-weight: 700;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const DivisionDot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${p => p.$color || '#64748b'};
  flex-shrink: 0;
`;

const TotalBadge = styled.span`
  font-size: 0.78rem;
  font-weight: 600;
  color: #64748b;
  background: #f1f5f9;
  padding: 3px 10px;
  border-radius: 10px;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const Thead = styled.thead`
  background: #f8fafc;
`;

const Th = styled.th`
  padding: 10px 20px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  text-align: ${p => p.$align || 'left'};
  border-bottom: 1px solid #e2e8f0;
`;

const Tr = styled.tr`
  &:not(:last-child) td { border-bottom: 1px solid #f1f5f9; }
  &:hover { background: #fafbfc; }
`;

const ClickableTr = styled(Tr)`
  cursor: pointer;
  transition: background 0.1s;
  &:hover { background: #f0f4ff; }
`;

const Td = styled.td`
  padding: 10px 20px;
  font-size: 0.85rem;
  color: #1e293b;
  text-align: ${p => p.$align || 'left'};
`;

const statusColor = (s) => {
  switch (s) {
    case '완료': return '#10b981';
    case '진행': return '#3b82f6';
    case '지연': return '#ef4444';
    default: return '#94a3b8';
  }
};

const StatusDot = styled.span`
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 8px;
  background: ${p => statusColor(p.$s)};
`;

const CountText = styled.span`
  font-weight: 700;
  font-size: 0.92rem;
  color: ${p => statusColor(p.$s)};
`;

const RatioBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const RatioTrack = styled.div`
  flex: 1;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
`;

const RatioFill = styled.div`
  height: 100%;
  border-radius: 3px;
  background: ${p => statusColor(p.$s)};
`;

const RatioText = styled.span`
  font-size: 0.82rem;
  font-weight: 600;
  color: #475569;
  min-width: 42px;
  text-align: right;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: #94a3b8;
  gap: 12px;
  span { font-size: 0.9rem; }
`;

// ===== Modal Styled =====

const ModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20000;
`;

const ModalBox = styled(motion.div)`
  background: #ffffff;
  border-radius: 14px;
  width: 80vw;
  height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
`;

const ModalHeader = styled.div`
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e2e8f0;
  flex-shrink: 0;
`;

const ModalTitleWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const ModalDivBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 0.78rem;
  font-weight: 600;
  color: #ffffff;
  background: ${p => p.$color || '#64748b'};
`;

const ModalStatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 0.78rem;
  font-weight: 700;
  background: ${p => p.$s === '완료' ? '#dcfce7' : p.$s === '진행' ? '#dbeafe' : p.$s === '지연' ? '#fef2f2' : '#f1f5f9'};
  color: ${p => p.$s === '완료' ? '#16a34a' : p.$s === '진행' ? '#2563eb' : p.$s === '지연' ? '#ef4444' : '#64748b'};
`;

const ModalTitle = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
`;

const ModalHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const ExportBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border: 1px solid #a5b4fc;
  background: #eef2ff;
  color: #4f46e5;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #e0e7ff; border-color: #818cf8; }
`;

const ModalCloseBtn = styled.button`
  width: 32px;
  height: 32px;
  border: none;
  background: #f1f5f9;
  color: #64748b;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #e2e8f0; color: #1e293b; }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0;
`;

const ModalTable = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

const ModalTh = styled.th`
  padding: 10px 16px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #64748b;
  text-align: left;
  background: #f8fafc;
  border-bottom: 2px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 1;
  white-space: nowrap;
`;

const ModalTr = styled.tr`
  &:not(:last-child) td { border-bottom: 1px solid #f1f5f9; }
  &:hover { background: #fafbfc; }
`;

const ClickableModalTr = styled(ModalTr)`
  cursor: pointer;
  transition: background 0.1s;
  &:hover { background: #f0f4ff; }
`;

const ModalTd = styled.td`
  padding: 10px 16px;
  font-size: 0.82rem;
  color: #1e293b;
  vertical-align: middle;
`;

const TaskName = styled.div`
  font-weight: 600;
  color: #1e293b;
`;

const TaskId = styled.span`
  font-size: 0.72rem;
  font-weight: 600;
  color: #6366f1;
  margin-right: 6px;
`;

const DateText = styled.span`
  font-size: 0.8rem;
  color: ${p => p.$muted ? '#94a3b8' : '#1e293b'};
`;

const ProgressBarWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const ProgressTrack = styled.div`
  width: 50px;
  height: 5px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  border-radius: 3px;
  background: ${p => p.$v >= 100 ? '#10b981' : p.$v > 0 ? '#3b82f6' : '#e2e8f0'};
`;

const ProgressLabel = styled.span`
  font-size: 0.75rem;
  font-weight: 600;
  color: ${p => p.$v >= 100 ? '#10b981' : p.$v > 0 ? '#3b82f6' : '#94a3b8'};
`;

const ModalEmptyHint = styled.div`
  padding: 40px;
  text-align: center;
  color: #94a3b8;
  font-size: 0.88rem;
`;

// ===== Logic =====

const groupActivities = (task) => {
  const catMap = {};
  (task.대분류액티비티 || []).forEach(cat => {
    catMap[cat.categoryId] = { ...cat, subcategories: [] };
  });
  (task.분석액티비티 || []).forEach(sub => {
    if (catMap[sub.categoryId]) {
      catMap[sub.categoryId].subcategories.push(sub);
    } else {
      catMap[sub.categoryId] = { categoryId: sub.categoryId, categoryName: sub.categoryId, subcategories: [] };
      catMap[sub.categoryId].subcategories.push(sub);
    }
  });
  return Object.values(catMap);
};

const calcCatProgress = (cat) => {
  const subs = cat.subcategories || [];
  if (subs.length === 0) return 0;
  const total = subs.reduce((sum, s) => {
    if (s.상태 === '완료') return sum + 100;
    if (s.상태 === '진행') return sum + (s.진행률 ?? 0);
    return sum;
  }, 0);
  return Math.round(total / subs.length);
};

const calcTaskInfo = (task) => {
  const groups = groupActivities(task);
  if (groups.length === 0) return { status: '계획', progress: 0, startDate: '', endDate: '', completeDate: '' };

  let totalProgress = 0, catCount = 0;
  let minStart = null, maxTarget = null, maxComplete = null;
  let allComplete = true;

  groups.forEach(cat => {
    const p = calcCatProgress(cat);
    totalProgress += p;
    catCount++;
    if (cat.시작일 && (!minStart || cat.시작일 < minStart)) minStart = cat.시작일;
    if (cat.목표일 && (!maxTarget || cat.목표일 > maxTarget)) maxTarget = cat.목표일;
    if (cat.완료일) {
      if (!maxComplete || cat.완료일 > maxComplete) maxComplete = cat.완료일;
    } else {
      allComplete = false;
    }
  });

  const avg = catCount > 0 ? Math.round(totalProgress / catCount) : 0;
  let status = '계획';
  if (avg >= 100) {
    status = '완료';
  } else {
    const today = todayLocalYmd();
    const isOverdue = groups.some(cat => {
      const p = calcCatProgress(cat);
      return p < 100 && !cat.완료일 && cat.목표일 && today > cat.목표일;
    });
    if (isOverdue) status = '지연';
    else if (avg > 0) status = '진행';
  }

  return {
    status,
    progress: avg,
    startDate: minStart || '',
    endDate: maxTarget || '',
    completeDate: allComplete ? (maxComplete || '') : '',
  };
};

const STATUS_ORDER = ['완료', '진행', '지연', '계획'];

// ===== Component =====

const TaskDashboard = ({ tasks, divisionColors, onView }) => {
  const handleTaskRowClick = (task) => {
    setDetailModal(null);
    if (onView) onView(task);
  };

  const [detailModal, setDetailModal] = useState(null); // { divName, status, tasks }
  const [dashboardTab, setDashboardTab] = useState('status'); // 'status' | 'effect'

  // 사업부별 과제 + 상태 맵
  const { dashboardData, divTaskStatusMap } = useMemo(() => {
    const divMap = {};
    const taskInfoCache = new Map();

    // 과제별 정보 캐싱
    tasks.forEach(task => {
      taskInfoCache.set(task.id, { task, info: calcTaskInfo(task) });
    });

    tasks.forEach(task => {
      const divisions = task.사업부 || [];
      const targets = divisions.length > 0 ? divisions : ['미지정'];
      targets.forEach(div => {
        if (!divMap[div]) divMap[div] = [];
        divMap[div].push(task);
      });
    });

    // 상태별 과제 목록 맵 (divName -> status -> task[])
    const statusMap = {};

    const result = Object.entries(divMap).map(([divName, divTasks]) => {
      const total = divTasks.length;
      const statusCounts = { '완료': 0, '진행': 0, '지연': 0, '계획': 0 };
      statusMap[divName] = { '완료': [], '진행': [], '지연': [], '계획': [] };

      divTasks.forEach(task => {
        const cached = taskInfoCache.get(task.id);
        const status = cached.info.status;
        statusCounts[status]++;
        statusMap[divName][status].push({ task, info: cached.info });
      });

      const rows = STATUS_ORDER.map(s => ({
        status: s,
        count: statusCounts[s],
        ratio: total > 0 ? Math.round((statusCounts[s] / total) * 100) : 0,
      }));

      return { divName, total, rows };
    });

    result.sort((a, b) => b.total - a.total);
    return { dashboardData: result, divTaskStatusMap: statusMap };
  }, [tasks]);

  const handleStatusClick = (divName, status, count) => {
    if (count === 0) return;
    const taskList = divTaskStatusMap[divName]?.[status] || [];
    setDetailModal({ divName, status, tasks: taskList });
  };

  const handleExportCsv = () => {
    if (!detailModal || detailModal.tasks.length === 0) return;
    const BOM = '\uFEFF';
    const header = ['No.', '식별ID', '과제명', '상태', '진행률(%)', '시작일', '종료 계획일', '완료일'];
    const rows = detailModal.tasks.map(({ task, info }, idx) => [
      idx + 1,
      task.식별ID || '',
      task.과제명 || '',
      info.status,
      info.progress,
      info.startDate || '',
      info.endDate || '',
      info.completeDate || '',
    ]);
    const escape = (v) => {
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = BOM + [header, ...rows].map(r => r.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${detailModal.divName}_${detailModal.status}_과제목록.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (tasks.length === 0) {
    return (
      <Wrapper>
        <EmptyState>
          <BarChart3 size={48} strokeWidth={1.2} />
          <span>대시보드에 표시할 과제가 없습니다.</span>
        </EmptyState>
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <TopBar>
        <Title>
          {dashboardTab === 'status' ? <BarChart3 size={20} /> : <TrendingUp size={20} />}
          {dashboardTab === 'status' ? '사업부별 과제 현황' : '과제 적용 효과'}
        </Title>
        <TabToggle>
          <TabBtn $active={dashboardTab === 'status'} onClick={() => setDashboardTab('status')}>
            <BarChart3 size={14} /> 사업부별 과제 현황
          </TabBtn>
          <TabBtn $active={dashboardTab === 'effect'} onClick={() => setDashboardTab('effect')}>
            <TrendingUp size={14} /> 과제 적용 효과
          </TabBtn>
        </TabToggle>
      </TopBar>

      {dashboardTab === 'effect' ? (
        <EffectTreemap tasks={tasks} divisionColors={divisionColors} />
      ) : (
      <Grid>
        {dashboardData.map(({ divName, total, rows }) => (
          <Card key={divName}>
            <CardHeader $color={divisionColors[divName]}>
              <DivisionName>
                <DivisionDot $color={divisionColors[divName]} />
                {divName}
              </DivisionName>
              <TotalBadge>총 {total}건</TotalBadge>
            </CardHeader>
            <Table>
              <Thead>
                <Tr>
                  <Th>과제 상태</Th>
                  <Th $align="center">과제 수</Th>
                  <Th $align="right">비율 (%)</Th>
                </Tr>
              </Thead>
              <tbody>
                {rows.map(r => (
                  <ClickableTr key={r.status} onClick={() => handleStatusClick(divName, r.status, r.count)}>
                    <Td>
                      <StatusDot $s={r.status} />
                      {r.status}
                    </Td>
                    <Td $align="center">
                      <CountText $s={r.status}>{r.count}</CountText>
                    </Td>
                    <Td $align="right">
                      <RatioBar>
                        <RatioTrack>
                          <RatioFill $s={r.status} style={{ width: `${r.ratio}%` }} />
                        </RatioTrack>
                        <RatioText>{r.ratio}%</RatioText>
                      </RatioBar>
                    </Td>
                  </ClickableTr>
                ))}
              </tbody>
            </Table>
          </Card>
        ))}
      </Grid>
      )}

      {/* 상세 모달 */}
      <AnimatePresence>
        {detailModal && (
          <ModalOverlay
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setDetailModal(null)}
          >
            <ModalBox
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
            >
              <ModalHeader>
                <ModalTitleWrap>
                  <ModalDivBadge $color={divisionColors[detailModal.divName]}>
                    {detailModal.divName}
                  </ModalDivBadge>
                  <ModalStatusBadge $s={detailModal.status}>
                    <StatusDot $s={detailModal.status} style={{ marginRight: 4 }} />
                    {detailModal.status}
                  </ModalStatusBadge>
                  <ModalTitle>{detailModal.tasks.length}건</ModalTitle>
                </ModalTitleWrap>
                <ModalHeaderActions>
                  <ExportBtn onClick={handleExportCsv}>
                    <Download size={13} /> CSV 저장
                  </ExportBtn>
                  <ModalCloseBtn onClick={() => setDetailModal(null)}>
                    <X size={16} />
                  </ModalCloseBtn>
                </ModalHeaderActions>
              </ModalHeader>
              <ModalBody>
                {detailModal.tasks.length === 0 ? (
                  <ModalEmptyHint>해당하는 과제가 없습니다.</ModalEmptyHint>
                ) : (
                  <ModalTable>
                    <thead>
                      <tr>
                        <ModalTh style={{ width: '50px' }}>No.</ModalTh>
                        <ModalTh>과제명</ModalTh>
                        <ModalTh style={{ width: '90px' }}>진행률</ModalTh>
                        <ModalTh style={{ width: '100px' }}>시작일</ModalTh>
                        <ModalTh style={{ width: '100px' }}>종료 계획일</ModalTh>
                        <ModalTh style={{ width: '100px' }}>완료일</ModalTh>
                      </tr>
                    </thead>
                    <tbody>
                      {detailModal.tasks.map(({ task, info }, idx) => (
                        <ClickableModalTr key={task.id} onClick={() => handleTaskRowClick(task)} title="과제 편집">
                          <ModalTd style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{idx + 1}</ModalTd>
                          <ModalTd>
                            <TaskName>
                              {task.식별ID && <TaskId>{task.식별ID}</TaskId>}
                              {task.과제명}
                            </TaskName>
                          </ModalTd>
                          <ModalTd>
                            <ProgressBarWrap>
                              <ProgressLabel $v={info.progress}>{info.progress}%</ProgressLabel>
                              <ProgressTrack>
                                <ProgressFill $v={info.progress} style={{ width: `${info.progress}%` }} />
                              </ProgressTrack>
                            </ProgressBarWrap>
                          </ModalTd>
                          <ModalTd>
                            <DateText $muted={!info.startDate}>{info.startDate || '-'}</DateText>
                          </ModalTd>
                          <ModalTd>
                            <DateText $muted={!info.endDate}>{info.endDate || '-'}</DateText>
                          </ModalTd>
                          <ModalTd>
                            <DateText $muted={!info.completeDate}>{info.completeDate || '-'}</DateText>
                          </ModalTd>
                        </ClickableModalTr>
                      ))}
                    </tbody>
                  </ModalTable>
                )}
              </ModalBody>
            </ModalBox>
          </ModalOverlay>
        )}
      </AnimatePresence>
    </Wrapper>
  );
};

export default TaskDashboard;
