import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { X, Newspaper, ExternalLink, Archive, AlertTriangle, Save } from 'lucide-react';

import api from '../services/api';
import {
  Overlay, Panel, Head, CloseBtn, Body, Foot, Field, Hint, Warn,
  PrimaryBtn, GhostBtn, Spacer,
} from './modalStyles';

const Meta = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.75rem;
  color: #64748b;
  align-items: center;

  a { color: #4f46e5; text-decoration: none; display: inline-flex; align-items: center; gap: 0.1875rem; }
  a:hover { text-decoration: underline; }
`;

const Lead = styled.p`
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.75;
  color: #1e293b;
`;

/**
 * ⚠️ 보관된 원문. **읽기 좋게 흰 종이처럼** 둔다 — 여기가 이 창의 본체다.
 *    `white-space: pre-wrap` 이라 붙여넣은 줄바꿈이 그대로 산다.
 */
const Article = styled.div`
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 0.875rem 1rem;
  font-size: 0.8125rem;
  line-height: 1.85;
  color: #1e293b;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 28rem;
  overflow-y: auto;
`;

const Chips = styled.div`
  display: flex;
  gap: 0.3125rem;
  flex-wrap: wrap;
`;

const Chip = styled.span`
  padding: 0.1875rem 0.5rem;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 999px;
  font-size: 0.6875rem;
  color: #3730a3;

  em { font-style: normal; opacity: 0.7; }
`;

const Stored = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  color: #0f766e;
  font-weight: 600;
`;

/**
 * 소식 하나를 읽는 자리. **보관된 원문이 여기 있다.**
 *
 * ⚠️ 목록에는 본문이 안 실린다(기사 전문이 수백 건이면 응답이 메가바이트가 된다).
 *    열 때 따로 가져온다.
 *
 * ⚠️ **링크는 썩는다.** 회사가 글을 내리거나 주소를 바꾸면 제목만 남는다. 그래서
 *    원문을 시스템에 담아 두고, 안 담긴 소식은 여기서 담을 수 있게 한다.
 */
const NewsDetailModal = ({ news, onClose, onSaved, onTechClick, showError }) => {
  const [full, setFull] = useState(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!news) return;
    setFull(null);
    setEditing(false);
    api.getNews(news.uuid)
      .then((d) => { setFull(d); setDraft(d.body || ''); })
      .catch((e) => { showError(e.message); setFull({ ...news, body: '' }); });
  }, [news]);   // eslint-disable-line react-hooks/exhaustive-deps

  if (!news) return null;
  const n = full || news;

  const save = async () => {
    setBusy(true);
    try {
      await api.updateNews(n.uuid, { body: draft });
      setFull((p) => ({ ...p, body: draft }));
      setEditing(false);
      onSaved();
    } catch (e) {
      showError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const hasBody = Boolean((n.body || '').trim());

  return (
    <Overlay onClick={onClose}>
      <Panel $wide="46rem" onClick={(e) => e.stopPropagation()}>
        <Head>
          <Newspaper size={17} color="#4f46e5" />
          <h2>{n.title}</h2>
          <CloseBtn onClick={onClose}><X size={18} /></CloseBtn>
        </Head>

        <Body>
          <Meta>
            <span>{n.published_at || '날짜 미상'}</span>
            {n.source && <span>· {n.source}</span>}
            {n.category && <span>· {n.category}</span>}
            {n.url && (
              <a href={n.url} target="_blank" rel="noreferrer">
                원문 링크 <ExternalLink size={12} />
              </a>
            )}
            {hasBody && (
              <Stored>
                <Archive size={12} /> 원문 보관됨 ({(n.body || '').length.toLocaleString()}자)
              </Stored>
            )}
          </Meta>

          {n.summary && <Lead>{n.summary}</Lead>}

          {(n.technologies || []).length > 0 && (
            <Field>
              <span>이 소식이 말하는 기술</span>
              <Chips>
                {n.technologies.map((t) => (
                  <Chip key={t.uuid} as="button" type="button"
                        style={{ cursor: 'pointer' }}
                        onClick={() => onTechClick(t)}>
                    {t.name} <em>{t.stage}</em>
                  </Chip>
                ))}
              </Chips>
            </Field>
          )}

          {full === null && <Hint>원문을 불러오는 중…</Hint>}

          {full !== null && !editing && hasBody && (
            <Field>
              <span>보관된 원문</span>
              <Article>{n.body}</Article>
            </Field>
          )}

          {full !== null && !editing && !hasBody && (
            <Warn>
              <AlertTriangle size={13} />
              <span>
                <b>원문이 보관돼 있지 않습니다.</b> 링크는 썩습니다 — 회사가 글을
                내리거나 주소를 바꾸면 제목만 남습니다. 아래 [원문 담기] 로 붙여넣어
                두면 원문이 사라져도 읽을 수 있습니다.
              </span>
            </Warn>
          )}

          {editing && (
            <Field>
              <span>원문 붙여넣기</span>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
                        rows={14}
                        placeholder="기사 본문을 그대로 붙여넣으세요" />
              <Hint>{draft.trim().length.toLocaleString()}자</Hint>
            </Field>
          )}
        </Body>

        <Foot>
          <Spacer />
          {!editing && (
            <>
              <GhostBtn onClick={onClose}>닫기</GhostBtn>
              <PrimaryBtn onClick={() => setEditing(true)} disabled={full === null}>
                <Archive size={13} /> {hasBody ? '원문 고치기' : '원문 담기'}
              </PrimaryBtn>
            </>
          )}
          {editing && (
            <>
              <GhostBtn onClick={() => { setDraft(n.body || ''); setEditing(false); }}>
                취소
              </GhostBtn>
              <PrimaryBtn onClick={save} disabled={busy}>
                <Save size={13} /> {busy ? '담는 중…' : '담기'}
              </PrimaryBtn>
            </>
          )}
        </Foot>
      </Panel>
    </Overlay>
  );
};

export default NewsDetailModal;
