import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { X, Newspaper, ExternalLink, Archive, AlertTriangle, Save, Pencil }
  from 'lucide-react';

import api from '../services/api';
import AssistPanel from './AssistPanel';
import {
  Overlay, Panel, Head, CloseBtn, Body, Foot, Field, Hint, Warn,
  PrimaryBtn, GhostBtn, Spacer,
} from './modalStyles';

const Links = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;

  li {
    display: flex;
    align-items: baseline;
    gap: 0.375rem;
    flex-wrap: wrap;
    padding: 0.3125rem 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.4375rem;
    font-size: 0.75rem;
  }
  em {
    font-style: normal;
    font-size: 0.625rem;
    font-weight: 700;
    color: #64748b;
    background: #f1f5f9;
    border-radius: 0.25rem;
    padding: 0.0625rem 0.3125rem;
  }
  b { color: #0f172a; }
  small { color: #64748b; width: 100%; line-height: 1.5; }
`;

/* ⚠️ 못 무르는 기능은 안 쓰는 기능이다. 잘못 건 연결을 여기서 끊는다. */
const UnlinkBtn = styled.button`
  margin-left: auto;
  border: none;
  background: none;
  color: #cbd5e1;
  cursor: pointer;
  padding: 0 0 0 0.25rem;
  display: flex;

  &:hover { color: #dc2626; }
`;

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

  button {
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
  }
  button:last-child { color: #a5b4fc; margin-left: 0.125rem; }
  button:last-child:hover { color: #dc2626; }
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

/**
 * 이미 걸린 포털 연결.
 *
 * ⚠️ 대상이 지워졌으면 서버가 `missing` 으로 알려 준다. 조용히 빈칸으로 두면
 *    「이름 없는 연결」이 남고, 그러면 그 줄을 지울지 고칠지 아무도 못 정한다.
 */
const LinkList = ({ rows, onRemove }) => {
  if (!rows || !rows.length) return null;
  const label = { project: '과제', kpi: 'KPI', sw: '보유 SW' };
  return (
    <Field>
      <span>이어 둔 우리 것 ({rows.length})</span>
      <Links>
        {rows.map((l) => (
          <li key={l.id}>
            <em>{label[l.targetKind] || l.targetKind}</em>
            <b>{l.label || (l.missing ? '(지워진 대상)' : l.targetRef)}</b>
            {l.relevance && <small>{l.relevance}</small>}
            {onRemove && (
              <UnlinkBtn onClick={() => onRemove(l)} title="이 연결을 끊습니다">
                <X size={11} />
              </UnlinkBtn>
            )}
          </li>
        ))}
      </Links>
    </Field>
  );
};

const NewsDetailModal = ({ news, onClose, onSaved, onTechClick, onEdit, showError }) => {
  const [full, setFull] = useState(null);
  const [links, setLinks] = useState([]);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  /*
    ⚠️⚠️ **못 불러온 것과 원문이 없는 것을 갈라야 한다**(2026-08-26 점검). 예전에는
       못 불러오면 `body: ''` 로 채워 두었는데, 그러면 화면이 「원문이 보관돼 있지
       않습니다」라고 **거짓말**하고, 그 말을 믿고 [원문 담기] 에 붙여넣어 저장하면
       **서버에 있던 원문을 통째로 덮어쓴다.**
  */
  const [failed, setFailed] = useState(null);

  useEffect(() => {
    if (!news) return;
    setFull(null);
    setFailed(null);
    setEditing(false);
    api.getNews(news.uuid)
      .then((d) => { setFull(d); setDraft(d.body || ''); })
      .catch((e) => { setFailed(e.message || '불러오지 못했습니다.'); });
    api.listLinks('news', news.uuid).then(setLinks).catch(() => setLinks([]));
  }, [news]);   // eslint-disable-line react-hooks/exhaustive-deps

  const reloadLinks = () =>
    api.listLinks('news', news.uuid).then(setLinks).catch(() => {});

  const dropLink = async (l) => {
    try {
      await api.removeLink(l.id);
      reloadLinks();
    } catch (e) { showError(e.message); }
  };

  const dropTech = async (techUuid) => {
    try {
      await api.removeEvidence(news.uuid, techUuid);
      /*
        ⚠️ `full` 이 아직 null 일 수 있다(불러오는 중). 그대로 펴면 `{}` 가 되어
           제목이 사라지고 uuid 가 undefined 인 창이 남는다.
        ⚠️ **목록에도 알린다.** 안 알리면 근거를 끊었는데 뒤 카드에는 그 기술
           딱지가 그대로 남아, 끊긴 것인지 아닌지 알 수 없다.
      */
      setFull((p) => {
        const base = p || news;
        return { ...base,
          technologies: (base.technologies || [])
            .filter((t) => t.uuid !== techUuid) };
      });
      onSaved();
    } catch (e) { showError(e.message); }
  };

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
                  <Chip key={t.uuid}>
                    <button type="button" onClick={() => onTechClick(t)}>
                      {/* ⚠️ 역량에는 단계가 없다 — 그대로 찍으면 **빈 자리**가 뜬다. */}
                      {t.name}{t.stage ? <> <em>{t.stage}</em></> : ''}
                    </button>
                    {/* 잘못 걸린 기술을 뺀다. 기술 자체는 안 지워진다. */}
                    <button type="button" onClick={() => dropTech(t.uuid)}
                            title="이 기술을 근거에서 뺍니다">
                      <X size={10} />
                    </button>
                  </Chip>
                ))}
              </Chips>
            </Field>
          )}

          <LinkList rows={links} onRemove={dropLink} />

          <AssistPanel kind="news" uuid={n.uuid}
                       onLinked={() => { reloadLinks(); onSaved(); }}
                       showError={showError} />

          {full === null && <Hint>원문을 불러오는 중…</Hint>}

          {full !== null && !editing && hasBody && (
            <Field>
              <span>보관된 원문</span>
              <Article>{n.body}</Article>
            </Field>
          )}

          {/* ⚠️ **못 불러온 것을 「없다」고 하지 않는다.** 담으라고 시키면 있던
              원문을 덮어쓰게 된다. */}
          {failed && (
            <Warn>
              <AlertTriangle size={13} />
              <span>
                <b>원문을 못 불러왔습니다 — {failed}</b> 보관된 원문이 있는지 없는지
                여기서는 알 수 없습니다. 창을 닫았다 다시 열어 보세요.
                <b> 지금 붙여넣어 담으면 있던 원문을 덮어씁니다.</b>
              </span>
            </Warn>
          )}

          {!failed && full !== null && !editing && !hasBody && (
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
              {onEdit && (
                <GhostBtn onClick={() => onEdit(n)}>
                  <Pencil size={13} /> 고치기
                </GhostBtn>
              )}
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
