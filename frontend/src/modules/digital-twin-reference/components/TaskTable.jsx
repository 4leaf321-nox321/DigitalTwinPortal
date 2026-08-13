import React from 'react';
import styled from 'styled-components';
import { Edit3, Trash2, Database, ChevronUp, ChevronDown } from 'lucide-react';

const TableWrapper = styled.div`
  flex: 1;
  overflow: auto;
  padding: 20px;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
`;

const Thead = styled.thead`
  background: #f1f5f9;
`;

const Th = styled.th`
  padding: 10px 14px;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  white-space: nowrap;
  border-bottom: 2px solid #e2e8f0;
`;

const Td = styled.td`
  padding: 10px 14px;
  font-size: 0.85rem;
  color: #334155;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
`;

const Tr = styled.tr`
  transition: background 0.15s ease;

  &:hover {
    background: #f8fafc;
  }
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
  background: ${props => {
    switch (props.$status) {
      case '완료': return '#dcfce7';
      case '진행': return '#dbeafe';
      case '계획': return '#fef3c7';
      default: return '#f1f5f9';
    }
  }};
  color: ${props => {
    switch (props.$status) {
      case '완료': return '#16a34a';
      case '진행': return '#2563eb';
      case '계획': return '#d97706';
      default: return '#64748b';
    }
  }};
`;

const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px;
  border: none;
  background: none;
  color: #94a3b8;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;

  &:hover {
    background: ${props => props.$danger ? '#fee2e2' : '#f1f5f9'};
    color: ${props => props.$danger ? '#ef4444' : '#475569'};
  }

  &:disabled {
    opacity: 0.25;
    cursor: default;
    &:hover {
      background: none;
      color: #94a3b8;
    }
  }
`;

const ActionCell = styled.div`
  display: flex;
  gap: 4px;
`;

const MoveCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #94a3b8;
  gap: 12px;
`;

const EmptyIcon = styled.div`
  color: #cbd5e1;
`;

const EmptyText = styled.div`
  font-size: 1rem;
  font-weight: 500;
`;

const EmptySubText = styled.div`
  font-size: 0.85rem;
`;

const LinkedBadgeList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`;

const LinkedBadge = styled.span`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.73rem;
  font-weight: 500;
  background: #ecfeff;
  color: #0e7490;
  border: 1px solid #a5f3fc;
  white-space: nowrap;
`;

const TaskTable = ({ tasks, divisions, onEdit, onDelete, onMoveTask }) => {
  const getDivisionName = (divisionId) => {
    if (!divisionId) return '-';
    const div = divisions.find(d => d.id === divisionId);
    return div ? div.name : divisionId;
  };

  if (!tasks || tasks.length === 0) {
    return (
      <TableWrapper>
        <EmptyState>
          <EmptyIcon>
            <Database size={48} strokeWidth={1.5} />
          </EmptyIcon>
          <EmptyText>등록된 과제가 없습니다</EmptyText>
          <EmptySubText>"새 과제 추가" 버튼을 클릭하여 과제를 등록하세요</EmptySubText>
        </EmptyState>
      </TableWrapper>
    );
  }

  return (
    <TableWrapper>
      <StyledTable>
        <Thead>
          <tr>
            <Th style={{ width: '3%' }}>No.</Th>
            <Th style={{ width: '3%' }}>순서</Th>
            <Th style={{ width: '20%' }}>과제명</Th>
            <Th style={{ width: '7%' }}>사업부</Th>
            <Th style={{ width: '18%' }}>항목</Th>
            <Th style={{ width: '7%' }}>구분</Th>
            <Th style={{ width: '8%' }}>적용 제품군</Th>
            <Th style={{ width: '5%' }}>연도</Th>
            <Th style={{ width: '5%' }}>상태</Th>
            <Th style={{ width: '18%' }}>연결 DT 과제</Th>
            <Th style={{ width: '5%' }}>액션</Th>
          </tr>
        </Thead>
        <tbody>
          {tasks.map((task, index) => (
            <Tr key={task.id}>
              <Td>{index + 1}</Td>
              <Td>
                <MoveCell>
                  <ActionButton
                    onClick={() => onMoveTask(task.id, 'up')}
                    disabled={index === 0}
                    title="위로 이동"
                  >
                    <ChevronUp size={15} />
                  </ActionButton>
                  <ActionButton
                    onClick={() => onMoveTask(task.id, 'down')}
                    disabled={index === tasks.length - 1}
                    title="아래로 이동"
                  >
                    <ChevronDown size={15} />
                  </ActionButton>
                </MoveCell>
              </Td>
              <Td style={{ fontWeight: 500 }}>{task.name}</Td>
              <Td>{getDivisionName(task.divisionId)}</Td>
              <Td>
                {task.testItem ? (
                  <>
                    {task.testItem}
                    {task.testItemDetail && (
                      <LinkedBadgeList style={{ marginTop: 4 }}>
                        <LinkedBadge>{task.testItemDetail}</LinkedBadge>
                      </LinkedBadgeList>
                    )}
                  </>
                ) : '-'}
              </Td>
              <Td>{task.category || '-'}</Td>
              <Td>
                {Array.isArray(task.productFamily) && task.productFamily.length > 0 ? (
                  <LinkedBadgeList>
                    {task.productFamily.map(name => (
                      <LinkedBadge key={name}>{name}</LinkedBadge>
                    ))}
                  </LinkedBadgeList>
                ) : '-'}
              </Td>
              <Td>{task.year || '-'}</Td>
              <Td>
                {task.status ? (
                  <StatusBadge $status={task.status}>{task.status}</StatusBadge>
                ) : '-'}
              </Td>
              <Td>
                {Array.isArray(task.connectedDtTask) && task.connectedDtTask.length > 0 ? (
                  <LinkedBadgeList>
                    {task.connectedDtTask.map(p => (
                      <LinkedBadge key={p.projectId}>{p.projectName}</LinkedBadge>
                    ))}
                  </LinkedBadgeList>
                ) : '-'}
              </Td>
              <Td>
                <ActionCell>
                  <ActionButton onClick={() => onEdit(task)} title="수정">
                    <Edit3 size={15} />
                  </ActionButton>
                  <ActionButton $danger onClick={() => onDelete(task)} title="삭제">
                    <Trash2 size={15} />
                  </ActionButton>
                </ActionCell>
              </Td>
            </Tr>
          ))}
        </tbody>
      </StyledTable>
    </TableWrapper>
  );
};

export default TaskTable;
