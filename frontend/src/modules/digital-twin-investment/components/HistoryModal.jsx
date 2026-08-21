import React, { useState } from 'react';
import styled from 'styled-components';
import { RotateCcw, X, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Overlay, Modal, ModalHeader, ModalTitle, CloseButton, ModalBody,
  ModalFooter, FooterRight, HelpText, CancelButton,
} from './modalStyles';
import { AMOUNT_UNIT, COLUMNS, formatAmount } from '../constants';

const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  margin-bottom: 0.6rem;
  flex-wrap: wrap;
`;

const FilterChip = styled.button`
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  border: 1px solid ${props => (props.$active ? '#4f46e5' : '#e2e8f0')};
  background: ${props => (props.$active ? '#4f46e5' : 'white')};
  color: ${props => (props.$active ? 'white' : '#475569')};
  font-size: 0.75rem;
  font-weight: ${props => (props.$active ? 700 : 500)};
  cursor: pointer;
  &:hover { border-color: #4f46e5; }
`;

const RestoreButton = styled.button`
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 4px;
  padding: 0.2rem 0.55rem;
  border: 1px solid #c7d2fe;
  border-radius: 0.35rem;
  background: #eef2ff;
  color: #4338ca;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  &:hover { background: #e0e7ff; }
  &:disabled { background: #f1f5f9; border-color: #e2e8f0; color: #94a3b8; cursor: default; }
`;

const RestoredNote = styled.div`
  margin-top: 4px;
  font-size: 0.72rem;
  color: #10b981;
  font-weight: 700;
`;

const List = styled.ol`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Row = styled.li`
  display: flex;
  gap: 0.6rem;
  padding: 0.6rem 0.7rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
`;

const Icon = styled.span`
  display: flex;
  align-items: flex-start;
  padding-top: 2px;
  color: ${props => props.$color};
`;

const Body = styled.div`
  flex: 1;
  min-width: 0;
`;

const TopLine = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  flex-wrap: wrap;
  font-size: 0.82rem;
  color: #1e293b;
`;

const Name = styled.span`
  font-weight: 700;
`;

const Tag = styled.span`
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  color: ${props => props.$color};
  background: ${props => `${props.$color}1a`};
  border: ${props => `1px solid ${props.$color}55`};
`;

const Meta = styled.div`
  margin-top: 2px;
  font-size: 0.72rem;
  color: #94a3b8;
`;

const Change = styled.div`
  margin-top: 3px;
  font-size: 0.8rem;
  color: #334155;
  font-variant-numeric: tabular-nums;
`;

const Before = styled.span`
  color: #94a3b8;
  text-decoration: line-through;
`;

const After = styled.span`
  color: #4f46e5;
  font-weight: 700;
`;

const Snapshot = styled.div`
  margin-top: 3px;
  font-size: 0.75rem;
  color: #64748b;
  line-height: 1.6;
`;

const Empty = styled.div`
  padding: 3rem 1rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.85rem;
`;

const ACTIONS = {
  create: { label: '등록', color: '#10b981', Icon: Plus },
  update: { label: '수정', color: '#4f46e5', Icon: Pencil },
  delete: { label: '삭제', color: '#ef4444', Icon: Trash2 },
};

// 열 이름표의 정본은 constants 의 COLUMNS 다. 서버는 화면 키(camelCase)만 보내고
// 한글 이름은 여기서 붙인다 — 이름표를 서버에도 두면 사본이 둘로 갈린다.
const COL_BY_KEY = COLUMNS.reduce((acc, c) => { acc[c.key] = c; return acc; }, {});

const labelOf = (key) => COL_BY_KEY[key]?.label || key;

/** 금액은 단위를 붙이고, 빈 값은 '(없음)' 으로 — 빈칸이면 무엇이 바뀐 건지 안 보인다. */
const valueText = (key, value) => {
  if (value === null || value === undefined || value === '') return '(없음)';
  if (COL_BY_KEY[key]?.type === 'amount') return `${formatAmount(value)} ${AMOUNT_UNIT}`;
  return String(value);
};

/**
 * 등록·삭제 줄에 보여 줄 요약. 스냅샷에서 값이 있는 것만 골라 적는다.
 * 이름표의 단위 괄호는 뗀다 — 값에도 단위를 붙이므로 「계획 (억원) 10 억원」이 된다.
 */
const snapshotText = (snapshot) => {
  if (!snapshot) return null;
  const parts = COLUMNS
    .filter(c => c.key !== 'name')
    .filter(c => {
      const v = snapshot[c.key];
      return v !== null && v !== undefined && v !== '';
    })
    .map(c => `${c.label.replace(/\s*\(.*\)$/, '')} ${valueText(c.key, snapshot[c.key])}`);
  return parts.length ? parts.join(' · ') : null;
};

const FILTERS = [['all', '전체'], ['create', '등록'], ['update', '수정'], ['delete', '삭제']];

const HistoryModal = ({
  isOpen, onClose, title, rows = [], loading, error, showName = false,
  onRestore, restoringId,
}) => {
  // 「삭제」만 눌러 보면 곧 지워진 건 목록이 된다 — 지워진 건을 찾는 가장 빠른 길.
  const [filter, setFilter] = useState('all');
  if (!isOpen) return null;

  const shown = filter === 'all' ? rows : rows.filter(r => r.action === filter);
  const countOf = (key) => (key === 'all' ? rows.length : rows.filter(r => r.action === key).length);

  return (
    <Overlay onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <Modal $width="720px">
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          <CloseButton onClick={onClose}><X size={18} /></CloseButton>
        </ModalHeader>

        <ModalBody>
          {!loading && !error && rows.length > 0 && (
            <FilterBar>
              {FILTERS.map(([key, label]) => (
                <FilterChip key={key} $active={filter === key} onClick={() => setFilter(key)}>
                  {label} {countOf(key)}
                </FilterChip>
              ))}
            </FilterBar>
          )}
          {loading && <Empty>불러오는 중...</Empty>}
          {!loading && error && <Empty>{error}</Empty>}
          {!loading && !error && rows.length === 0 && (
            <Empty>남아 있는 변경 이력이 없습니다.</Empty>
          )}
          {!loading && !error && rows.length > 0 && shown.length === 0 && (
            <Empty>이 갈래의 이력이 없습니다.</Empty>
          )}
          {!loading && !error && shown.length > 0 && (
            <List>
              {shown.map(row => {
                const meta = ACTIONS[row.action] || ACTIONS.update;
                const ActionIcon = meta.Icon;
                return (
                  <Row key={row.id}>
                    <Icon $color={meta.color}><ActionIcon size={15} /></Icon>
                    <Body>
                      <TopLine>
                        <Tag $color={meta.color}>{meta.label}</Tag>
                        {showName && <Name>{row.investmentName || '(이름 없음)'}</Name>}
                        {row.action === 'update' && <span>{labelOf(row.field)}</span>}
                      </TopLine>

                      {row.action === 'update' ? (
                        <Change>
                          <Before>{valueText(row.field, row.before)}</Before>
                          {' → '}
                          <After>{valueText(row.field, row.after)}</After>
                        </Change>
                      ) : (
                        <Snapshot>
                          {row.action === 'delete' && <b>지우기 직전 값 · </b>}
                          {snapshotText(row.snapshot) || '(값 없음)'}
                        </Snapshot>
                      )}

                      <Meta>
                        {row.changedAt ? new Date(row.changedAt).toLocaleString('ko-KR') : '-'}
                        {' · '}
                        {row.actor || '(알 수 없음)'}
                      </Meta>

                      {/* 되살리기는 삭제 줄에만. 물리 삭제라 원래 행은 없고,
                          스냅샷으로 **새 건을 등록**한다. 같은 삭제를 두 번 되살리지
                          못하도록 서버가 막고, 여기서는 그 사실을 적어 준다. */}
                      {row.action === 'delete' && (
                        row.restoredInvestmentId ? (
                          <RestoredNote>되살림 (새 id {row.restoredInvestmentId})</RestoredNote>
                        ) : (
                          <RestoreButton
                            onClick={() => onRestore && onRestore(row)}
                            disabled={!onRestore || restoringId === row.id}
                          >
                            <RotateCcw size={12} />
                            {restoringId === row.id ? '되살리는 중...' : '되살리기'}
                          </RestoreButton>
                        )
                      )}
                    </Body>
                  </Row>
                );
              })}
            </List>
          )}
        </ModalBody>

        <ModalFooter>
          <HelpText>
            {filter === 'all' ? `${rows.length}건` : `${shown.length} / ${rows.length}건`} · 최근 것부터
          </HelpText>
          <FooterRight>
            <CancelButton onClick={onClose}>닫기</CancelButton>
          </FooterRight>
        </ModalFooter>
      </Modal>
    </Overlay>
  );
};

export default HistoryModal;
