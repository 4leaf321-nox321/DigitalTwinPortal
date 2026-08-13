/**
 * 연도별 과제 일괄 삭제 (관리자 전용).
 *
 * 무엇을 대신하나
 *     옛 '전체 삭제'는 IndexedDB/localStorage 만 비우고, 그 뒤에 '서버에 저장'
 *     (수동 업로드·덮어쓰기)으로 확정하는 2단 동작이었다. 그 업로드 메뉴가 V2 컷오버
 *     때 내려가면서 **서버에 닿지 않는 버튼**만 남았다 — 눌러도 새로고침하면 자동
 *     다운로드가 되살려 놓는다. 이 화면이 그 자리를 서버 경로로 대신한다.
 *
 * 왜 연도별인가
 *     실제로 필요한 건 "지난 연도 정리"이지 "전부"가 아니다. 전부를 원하면 연도를
 *     다 고르면 된다 — **'전체' 버튼을 따로 두지 않는다.** 한 번의 실수가 전 과제
 *     삭제가 되는 길을 만들지 않기 위해서다.
 *
 * 건수를 서버에서 다시 받아오는 이유
 *     화면이 들고 있는 projects 에는 **내가 볼 수 있는 것만** 있다. 그걸로 세어
 *     "12건"이라 보여주고 실제로 40건이 지워지면 그게 사고다. 그래서 연도 목록과
 *     건수는 서버가 준 것만 쓰고, 그 값을 expectedCount 로 되돌려 보내 대조시킨다.
 *
 * 복구
 *     소프트 삭제라 휴지통에 남는다. 다만 1건씩만 되살릴 수 있으면 "복구 가능"이
 *     200번 클릭이라는 뜻이 되므로, **같은 화면에서 연도 단위로 되살린다.**
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Trash2, RotateCcw, AlertTriangle, ChevronLeft } from 'lucide-react';
import { fetchProjectYearSummaryV2 } from '../../services/settingsApi';
import { saveBulkYearDelete, saveBulkYearRestore } from '../../services/dashboardWriteApi';

const BulkYearDeleteModal = ({ isOpen, onClose, onDeleted, onRestored,
                               showSuccess, showError }) => {
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [stage, setStage] = useState('pick');      // 'pick' | 'confirm'
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(null);          // 'delete' | 연도(복구 중)

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRows(await fetchProjectYearSummaryV2());
    } catch (err) {
      setError(err.message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(new Set());
    setStage('pick');
    setReason('');
    load();
  }, [isOpen, load]);

  // 연도가 없는 과제(year=null)는 고를 수 없다. 서버도 연도 목록으로 찾으므로
  // 애초에 대상이 되지 않는다 — 고를 수 있게 해두면 "골랐는데 안 지워졌다"가 된다.
  const selectable = useMemo(
    () => rows.filter(r => r.year !== null && r.year !== undefined && r.activeCount > 0),
    [rows]);

  const selectedYears = useMemo(
    () => selectable.filter(r => selected.has(r.year)).map(r => r.year),
    [selectable, selected]);

  const selectedCount = useMemo(
    () => selectable.filter(r => selected.has(r.year))
                    .reduce((sum, r) => sum + r.activeCount, 0),
    [selectable, selected]);

  const toggle = (year) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });
  };

  const runDelete = async () => {
    setBusy('delete');
    try {
      const result = await saveBulkYearDelete({
        years: selectedYears,
        expectedCount: selectedCount,
        reason: reason.trim() || undefined,
      });
      showSuccess && showSuccess(
        `${result.count}건을 삭제했습니다. 이 화면에서 연도별로 되살릴 수 있습니다.`);
      onDeleted && onDeleted(result);
      setSelected(new Set());
      setStage('pick');
      setReason('');
      await load();
    } catch (err) {
      // 409 = 모달을 열어둔 사이 대상이 바뀌었다. 지우지 않고 목록만 새로 그린다.
      if (err.stale) {
        showError && showError(err.message);
        setStage('pick');
        setSelected(new Set());
        await load();
      } else {
        showError && showError(err.message);
      }
    } finally {
      setBusy(null);
    }
  };

  const runRestore = async (year) => {
    setBusy(year);
    try {
      const result = await saveBulkYearRestore({ years: [year] });
      showSuccess && showSuccess(`${year}년 과제 ${result.count}건을 복구했습니다.`);
      onRestored && onRestored(result);
      await load();
    } catch (err) {
      showError && showError(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <Overlay onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
        <Container
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
        >
          <Head>
            <div>
              <h3>연도별 과제 삭제</h3>
              <Sub>
                고른 연도의 과제를 서버에서 삭제합니다. 휴지통으로 가는 삭제라
                같은 화면에서 연도 단위로 되살릴 수 있습니다. 성과는 지우지 않습니다.
              </Sub>
            </div>
            <CloseButton type="button" onClick={onClose} disabled={!!busy}>
              <X size={18} />
            </CloseButton>
          </Head>

          {stage === 'pick' ? (
            <>
              <Body>
                {isLoading && (
                  <Center><Loader2 size={18} className="spin" /> 불러오는 중…</Center>
                )}

                {!isLoading && error && (
                  <ErrorBox>
                    <AlertTriangle size={16} />
                    <span>{error}</span>
                  </ErrorBox>
                )}

                {!isLoading && !error && rows.length === 0 && (
                  <Center>서버에 과제가 없습니다.</Center>
                )}

                {!isLoading && !error && rows.length > 0 && (
                  <Table>
                    <thead>
                      <tr>
                        <th style={{ width: '3rem' }} />
                        <th>연도</th>
                        <th style={{ textAlign: 'right' }}>사용 중</th>
                        <th style={{ textAlign: 'right' }}>휴지통</th>
                        <th style={{ width: '7rem' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => {
                        const noYear = r.year === null || r.year === undefined;
                        const canPick = !noYear && r.activeCount > 0;
                        const key = noYear ? 'none' : r.year;
                        return (
                          <tr key={key} className={selected.has(r.year) ? 'picked' : ''}>
                            <td>
                              <input
                                type="checkbox"
                                checked={!noYear && selected.has(r.year)}
                                disabled={!canPick || !!busy}
                                onChange={() => toggle(r.year)}
                              />
                            </td>
                            <td>
                              {noYear
                                ? <Muted>연도 없음 (선택 불가)</Muted>
                                : <YearCell>{r.year}년</YearCell>}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {r.activeCount > 0
                                ? `${r.activeCount}건`
                                : <Muted>0건</Muted>}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {r.trashedCount > 0
                                ? `${r.trashedCount}건`
                                : <Muted>0건</Muted>}
                            </td>
                            <td>
                              {!noYear && r.trashedCount > 0 && (
                                <SmallButton
                                  type="button"
                                  disabled={!!busy}
                                  onClick={() => runRestore(r.year)}
                                >
                                  <RotateCcw size={12} />
                                  {busy === r.year ? '복구 중…' : '되살리기'}
                                </SmallButton>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                )}
              </Body>

              <Foot>
                <FootInfo>
                  {selectedYears.length === 0
                    ? <Muted>삭제할 연도를 고르세요.</Muted>
                    : <strong>{selectedYears.map(y => `${y}년`).join(', ')} · {selectedCount}건</strong>}
                </FootInfo>
                <DangerButton
                  type="button"
                  disabled={selectedYears.length === 0 || !!busy}
                  onClick={() => setStage('confirm')}
                >
                  <Trash2 size={14} /> 삭제 확인으로
                </DangerButton>
              </Foot>
            </>
          ) : (
            <>
              <Body>
                <ConfirmBox>
                  <AlertTriangle size={18} />
                  <div>
                    <p>
                      <strong>{selectedYears.map(y => `${y}년`).join(', ')}</strong> 과제{' '}
                      <strong>{selectedCount}건</strong>을 삭제합니다.
                    </p>
                    <ul>
                      <li>모든 사용자에게서 사라집니다 — 내 화면만이 아닙니다.</li>
                      <li>휴지통에 남으므로 이 화면에서 연도 단위로 되살릴 수 있습니다.</li>
                      <li>성과와 성과-과제 연결은 그대로 둡니다.</li>
                    </ul>
                  </div>
                </ConfirmBox>

                <Field>
                  <label htmlFor="bulk-delete-reason">사유 (선택 — 변경 이력에 남습니다)</label>
                  <input
                    id="bulk-delete-reason"
                    type="text"
                    value={reason}
                    disabled={!!busy}
                    placeholder="예: 2024년도 과제 마감 정리"
                    onChange={(e) => setReason(e.target.value)}
                  />
                </Field>
              </Body>

              <Foot>
                <SmallButton type="button" disabled={!!busy} onClick={() => setStage('pick')}>
                  <ChevronLeft size={12} /> 뒤로
                </SmallButton>
                <DangerButton type="button" disabled={!!busy} onClick={runDelete}>
                  <Trash2 size={14} />
                  {busy === 'delete' ? '삭제 중…' : `${selectedCount}건 삭제`}
                </DangerButton>
              </Foot>
            </>
          )}
        </Container>
      </Overlay>
    </AnimatePresence>
  );
};

export default BulkYearDeleteModal;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background: rgba(0, 0, 0, 0.45);
`;

const Container = styled(motion.div)`
  display: flex;
  flex-direction: column;
  width: min(680px, 100%);
  max-height: 100%;
  border-radius: 0.75rem;
  background: white;
  overflow: hidden;
`;

const Head = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.5rem 1rem;
  border-bottom: 1px solid #e5e7eb;

  h3 { margin: 0 0 0.375rem; font-size: 1.0625rem; color: #111827; }
`;

const Sub = styled.p`
  margin: 0;
  max-width: 62ch;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: #6b7280;
`;

const CloseButton = styled.button`
  flex: 0 0 auto;
  border: none;
  background: none;
  color: #6b7280;
  cursor: pointer;

  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const Body = styled.div`
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 1rem 1.5rem;
`;

const Center = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem 0;
  font-size: 0.8125rem;
  color: #6b7280;

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

const ErrorBox = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  background: #fef2f2;
  font-size: 0.8125rem;
  line-height: 1.6;
  color: #b91c1c;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8125rem;

  th {
    padding: 0.375rem 0.5rem;
    border-bottom: 1px solid #e5e7eb;
    color: #6b7280;
    font-weight: 500;
    text-align: left;
  }

  td {
    padding: 0.5rem;
    border-bottom: 1px solid #f3f4f6;
    color: #374151;
  }

  tr.picked td { background: #fef2f2; }

  input[type='checkbox'] { cursor: pointer; }
  input[type='checkbox']:disabled { cursor: not-allowed; }
`;

const YearCell = styled.span`
  color: #111827;
  font-weight: 600;
`;

const Muted = styled.span`
  color: #9ca3af;
`;

const SmallButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  background: white;
  color: #374151;
  font-size: 0.75rem;
  cursor: pointer;

  &:hover:not(:disabled) { background: #f9fafb; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const DangerButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.875rem;
  border: none;
  border-radius: 0.5rem;
  background: #dc2626;
  color: white;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) { background: #b91c1c; }
  &:disabled { background: #e5e7eb; color: #9ca3af; cursor: not-allowed; }
`;

const Foot = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.875rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #fafafa;
`;

const FootInfo = styled.div`
  font-size: 0.8125rem;
  color: #374151;
`;

const ConfirmBox = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.875rem;
  border: 1px solid #fde68a;
  border-radius: 0.5rem;
  background: #fffbeb;
  color: #92400e;

  p { margin: 0 0 0.5rem; font-size: 0.875rem; line-height: 1.6; }
  ul { margin: 0; padding-left: 1.125rem; }
  li { font-size: 0.8125rem; line-height: 1.7; }
`;

const Field = styled.div`
  margin-top: 1rem;

  label {
    display: block;
    margin-bottom: 0.375rem;
    font-size: 0.75rem;
    color: #6b7280;
  }

  input {
    width: 100%;
    padding: 0.5rem 0.625rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
  }

  input:disabled { background: #f9fafb; }
`;
