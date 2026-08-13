import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Megaphone, X, Plus, Edit2, Trash2, ChevronLeft, ChevronRight, Clock, User } from 'lucide-react';
import { meetingApi } from '../services/meetingApi';

// ============== Scope Helpers ==============

const SCOPE_LABELS = {
  all: '전체',
  ceo: '대표이사 협의체',
  cfo: 'CFO 주간회의',
  issue: 'DX 디지털 트윈 이슈 점검 회의',
};
const SCOPE_COLORS = {
  all: { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' },
  ceo: { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  cfo: { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  issue: { bg: '#fdf2f8', color: '#9d174d', border: '#fbcfe8' },
};

// ============== Banner Styles ==============

const BannerWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 1.25rem;
  background: #fffbeb;
  border-bottom: 1px solid #fde68a;
  min-height: 36px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #fef3c7;
  }
`;

const BannerIcon = styled.div`
  display: flex;
  align-items: center;
  color: #d97706;
  flex-shrink: 0;
`;

const BannerScopeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.675rem;
  font-weight: 600;
  flex-shrink: 0;
  background: ${p => SCOPE_COLORS[p.$scope]?.bg || '#f1f5f9'};
  color: ${p => SCOPE_COLORS[p.$scope]?.color || '#475569'};
  border: 1px solid ${p => SCOPE_COLORS[p.$scope]?.border || '#e2e8f0'};
`;

const BannerTitle = styled.span`
  font-size: 0.825rem;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
`;

const BannerMeta = styled.span`
  font-size: 0.7rem;
  color: #94a3b8;
  white-space: nowrap;
  flex-shrink: 0;
`;

const BannerNav = styled.div`
  display: flex;
  align-items: center;
  gap: 0.125rem;
  flex-shrink: 0;
`;

const BannerNavBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 0.25rem;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
  &:hover { background: #f1f5f9; color: #475569; }
  &:disabled { opacity: 0.3; cursor: default; &:hover { background: transparent; color: #94a3b8; } }
`;

const BannerCount = styled.span`
  font-size: 0.65rem;
  color: #94a3b8;
  min-width: 2rem;
  text-align: center;
`;

// ============== Modal Styles ==============

const Overlay = styled.div`
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalBox = styled.div`
  background: white;
  border-radius: 0.75rem;
  width: 80vw;
  height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.25);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e2e8f0;
`;

const ModalTitle = styled.h2`
  font-size: 1.05rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ModalCloseBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 0.375rem;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  &:hover { background: #f1f5f9; color: #1e293b; }
`;

const ModalBody = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 0;
`;

const ModalFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid #e2e8f0;
  font-size: 0.75rem;
  color: #94a3b8;
`;

// ============== Tab Filter ==============

const TabFilter = styled.div`
  display: flex;
  gap: 0;
  padding: 0.75rem 1.25rem 0;
`;

const TabBtn = styled.button`
  padding: 0.375rem 0.875rem;
  border: 1px solid #e2e8f0;
  border-bottom: ${p => p.$active ? '2px solid #8b5cf6' : '1px solid #e2e8f0'};
  background: ${p => p.$active ? 'white' : '#f8fafc'};
  color: ${p => p.$active ? '#7c3aed' : '#64748b'};
  font-size: 0.8rem;
  font-weight: ${p => p.$active ? 600 : 400};
  cursor: pointer;
  margin-right: -1px;
  transition: all 0.15s;

  &:first-child { border-radius: 0.375rem 0 0 0; }
  &:last-child { border-radius: 0 0.375rem 0 0; margin-right: 0; }
  &:hover { background: white; }
`;

// ============== Notice List ==============

const NoticeList = styled.div`
  padding: 0.5rem 0;
`;

const NoticeItem = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.1s;
  background: ${p => p.$selected ? '#f5f3ff' : 'transparent'};

  &:hover { background: ${p => p.$selected ? '#f5f3ff' : '#f8fafc'}; }
`;

const NoticeItemBody = styled.div`
  flex: 1;
  min-width: 0;
`;

const NoticeItemTitle = styled.div`
  font-size: 0.85rem;
  font-weight: 600;
  color: #1e293b;
  margin-bottom: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const NoticeItemMeta = styled.div`
  font-size: 0.7rem;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const NoticeActions = styled.div`
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.1s;
  ${NoticeItem}:hover & { opacity: 1; }
`;

const IconBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 0.25rem;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  &:hover { background: ${p => p.$danger ? '#fef2f2' : '#f1f5f9'}; color: ${p => p.$danger ? '#ef4444' : '#475569'}; }
`;

// ============== Detail View ==============

const DetailView = styled.div`
  padding: 1.25rem;
`;

const DetailHeader = styled.div`
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid #e2e8f0;
`;

const DetailTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const DetailMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 0.75rem;
  color: #94a3b8;
`;

const DetailContent = styled.div`
  font-size: 0.9rem;
  color: #334155;
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
`;

const BackBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: 0.25rem;
  background: transparent;
  color: #64748b;
  font-size: 0.8rem;
  cursor: pointer;
  margin-bottom: 0.75rem;
  &:hover { background: #f1f5f9; color: #1e293b; }
`;

// ============== Form ==============

const Form = styled.div`
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const FormRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const FormLabel = styled.label`
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
`;

const FormInput = styled.input`
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  outline: none;
  &:focus { border-color: #8b5cf6; box-shadow: 0 0 0 2px rgba(139,92,246,0.15); }
`;

const FormTextarea = styled.textarea`
  padding: 0.5rem 0.75rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  outline: none;
  min-height: 160px;
  resize: vertical;
  font-family: inherit;
  line-height: 1.6;
  &:focus { border-color: #8b5cf6; box-shadow: 0 0 0 2px rgba(139,92,246,0.15); }
`;

const FormScopeGroup = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ScopeRadio = styled.label`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid ${p => p.$active ? '#8b5cf6' : '#e2e8f0'};
  border-radius: 0.375rem;
  background: ${p => p.$active ? '#f5f3ff' : 'white'};
  color: ${p => p.$active ? '#7c3aed' : '#64748b'};
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: #8b5cf6; }

  input { display: none; }
`;

const FormBtnGroup = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 0.5rem;
`;

const FormBtn = styled.button`
  padding: 0.5rem 1.25rem;
  border-radius: 0.375rem;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;

  ${p => p.$primary ? `
    background: #8b5cf6;
    color: white;
    border: none;
    &:hover { background: #7c3aed; }
    &:disabled { opacity: 0.5; cursor: default; }
  ` : `
    background: white;
    color: #64748b;
    border: 1px solid #e2e8f0;
    &:hover { background: #f8fafc; }
  `}
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 3rem 1rem;
  color: #94a3b8;
  font-size: 0.875rem;
`;

// ============== Banner Component ==============

export const ReportPlanNoticeBanner = ({ planTab, canEdit, onOpenModal }) => {
  const [notices, setNotices] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  const loadNotices = useCallback(() => {
    meetingApi.getNotices(planTab).then(data => {
      setNotices(data);
      setCurrentIdx(0);
    }).catch(() => {});
  }, [planTab]);

  useEffect(() => { loadNotices(); }, [loadNotices]);

  if (notices.length === 0) {
    if (!canEdit) return null;
    return (
      <BannerWrapper onClick={onOpenModal} style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
        <BannerIcon><Megaphone size={15} color="#94a3b8" /></BannerIcon>
        <BannerTitle style={{ color: '#94a3b8', fontWeight: 400 }}>공지를 등록하세요</BannerTitle>
      </BannerWrapper>
    );
  }

  const notice = notices[currentIdx];
  if (!notice) return null;

  const dateStr = notice.createdAt
    ? new Date(notice.createdAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' })
    : '';

  return (
    <BannerWrapper onClick={onOpenModal}>
      <BannerIcon><Megaphone size={15} /></BannerIcon>
      <BannerScopeBadge $scope={notice.scope}>{SCOPE_LABELS[notice.scope]}</BannerScopeBadge>
      <BannerTitle>{notice.title}</BannerTitle>
      <BannerMeta>{notice.authorName} · {dateStr}</BannerMeta>
    </BannerWrapper>
  );
};

// ============== Modal Component ==============

const ReportPlanNoticeModal = ({ onClose, canEdit }) => {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterScope, setFilterScope] = useState('all-filter'); // 'all-filter' shows everything
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [mode, setMode] = useState('list'); // 'list' | 'detail' | 'form'
  const [formData, setFormData] = useState({ title: '', content: '', scope: 'all' });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadNotices = useCallback(() => {
    setLoading(true);
    meetingApi.getNotices().then(data => {
      setNotices(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadNotices(); }, [loadNotices]);

  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const filteredNotices = filterScope === 'all-filter'
    ? notices
    : notices.filter(n => n.scope === filterScope || n.scope === 'all');

  const totalPages = Math.max(1, Math.ceil(filteredNotices.length / PAGE_SIZE));
  const pagedNotices = filteredNotices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleCreate = () => {
    setEditingId(null);
    setFormData({ title: '', content: '', scope: 'all' });
    setMode('form');
  };

  const handleEdit = (notice) => {
    setEditingId(notice.id);
    setFormData({ title: notice.title, content: notice.content, scope: notice.scope });
    setMode('form');
  };

  const handleDelete = async (noticeId) => {
    if (!window.confirm('이 공지를 삭제하시겠습니까?')) return;
    try {
      await meetingApi.deleteNotice(noticeId);
      loadNotices();
      if (selectedNotice?.id === noticeId) {
        setSelectedNotice(null);
        setMode('list');
      }
    } catch (err) {
      alert(err.message || '삭제 실패');
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.content.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await meetingApi.updateNotice(editingId, formData);
      } else {
        await meetingApi.createNotice(formData);
      }
      loadNotices();
      setMode('list');
    } catch (err) {
      alert(err.message || '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleViewDetail = (notice) => {
    setSelectedNotice(notice);
    setMode('detail');
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Overlay onClick={onClose}>
      <ModalBox onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>
            <Megaphone size={18} color="#d97706" />
            보고계획 공지
          </ModalTitle>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {canEdit && mode === 'list' && (
              <FormBtn $primary onClick={handleCreate} style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }}>
                <Plus size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                공지 작성
              </FormBtn>
            )}
            <ModalCloseBtn onClick={onClose}><X size={18} /></ModalCloseBtn>
          </div>
        </ModalHeader>

        {mode === 'list' && (
          <>
            <TabFilter>
              {[
                { key: 'all-filter', label: '전체 보기' },
                { key: 'ceo', label: '대표이사 협의체' },
                { key: 'cfo', label: 'CFO 주간회의' },
                { key: 'issue', label: 'DX 이슈 점검 회의' },
              ].map(t => (
                <TabBtn key={t.key} $active={filterScope === t.key} onClick={() => { setFilterScope(t.key); setCurrentPage(1); }}>
                  {t.label}
                </TabBtn>
              ))}
            </TabFilter>
            <ModalBody>
              {loading ? (
                <EmptyState>로딩 중...</EmptyState>
              ) : filteredNotices.length === 0 ? (
                <EmptyState>등록된 공지가 없습니다.</EmptyState>
              ) : (
                <NoticeList>
                  {pagedNotices.map(n => (
                    <NoticeItem key={n.id} onClick={() => handleViewDetail(n)}>
                      <NoticeItemBody>
                        <NoticeItemTitle>
                          <BannerScopeBadge $scope={n.scope}>{SCOPE_LABELS[n.scope]}</BannerScopeBadge>
                          {n.title}
                        </NoticeItemTitle>
                        <NoticeItemMeta>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <User size={11} /> {n.authorName}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={11} /> {formatDate(n.createdAt)}
                          </span>
                        </NoticeItemMeta>
                      </NoticeItemBody>
                      {canEdit && (
                        <NoticeActions>
                          <IconBtn onClick={e => { e.stopPropagation(); handleEdit(n); }} title="수정">
                            <Edit2 size={14} />
                          </IconBtn>
                          <IconBtn $danger onClick={e => { e.stopPropagation(); handleDelete(n.id); }} title="삭제">
                            <Trash2 size={14} />
                          </IconBtn>
                        </NoticeActions>
                      )}
                    </NoticeItem>
                  ))}
                </NoticeList>
              )}
            </ModalBody>
            <ModalFooter>
              <span>총 {filteredNotices.length}건의 공지</span>
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <BannerNavBtn
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    <ChevronLeft size={14} />
                  </BannerNavBtn>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', minWidth: '3rem', textAlign: 'center' }}>
                    {currentPage} / {totalPages}
                  </span>
                  <BannerNavBtn
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    <ChevronRight size={14} />
                  </BannerNavBtn>
                </div>
              )}
            </ModalFooter>
          </>
        )}

        {mode === 'detail' && selectedNotice && (
          <ModalBody>
            <DetailView>
              <BackBtn onClick={() => setMode('list')}>
                <ChevronLeft size={16} /> 목록으로
              </BackBtn>
              <DetailHeader>
                <DetailTitle>
                  <BannerScopeBadge $scope={selectedNotice.scope}>{SCOPE_LABELS[selectedNotice.scope]}</BannerScopeBadge>
                  {selectedNotice.title}
                </DetailTitle>
                <DetailMeta>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <User size={12} /> {selectedNotice.authorName}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={12} /> {formatDate(selectedNotice.createdAt)}
                  </span>
                </DetailMeta>
              </DetailHeader>
              <DetailContent>{selectedNotice.content}</DetailContent>
            </DetailView>
          </ModalBody>
        )}

        {mode === 'form' && (
          <ModalBody>
            <Form>
              <BackBtn onClick={() => setMode('list')}>
                <ChevronLeft size={16} /> 목록으로
              </BackBtn>

              <FormRow>
                <FormLabel>구분</FormLabel>
                <FormScopeGroup>
                  {[
                    { value: 'all', label: '전체' },
                    { value: 'ceo', label: '대표이사 협의체' },
                    { value: 'cfo', label: 'CFO 주간회의' },
                    { value: 'issue', label: 'DX 이슈 점검 회의' },
                  ].map(s => (
                    <ScopeRadio key={s.value} $active={formData.scope === s.value}>
                      <input
                        type="radio"
                        name="scope"
                        value={s.value}
                        checked={formData.scope === s.value}
                        onChange={() => setFormData(prev => ({ ...prev, scope: s.value }))}
                      />
                      {s.label}
                    </ScopeRadio>
                  ))}
                </FormScopeGroup>
              </FormRow>

              <FormRow>
                <FormLabel>제목</FormLabel>
                <FormInput
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="공지 제목을 입력하세요"
                />
              </FormRow>

              <FormRow>
                <FormLabel>내용</FormLabel>
                <FormTextarea
                  value={formData.content}
                  onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="공지 내용을 입력하세요"
                />
              </FormRow>

              <FormBtnGroup>
                <FormBtn onClick={() => setMode('list')}>취소</FormBtn>
                <FormBtn
                  $primary
                  onClick={handleSubmit}
                  disabled={saving || !formData.title.trim() || !formData.content.trim()}
                >
                  {saving ? '저장 중...' : editingId ? '수정' : '등록'}
                </FormBtn>
              </FormBtnGroup>
            </Form>
          </ModalBody>
        )}
      </ModalBox>
    </Overlay>
  );
};

export default ReportPlanNoticeModal;
