import React, { useState } from 'react';
import styled from 'styled-components';
import { X, Newspaper } from 'lucide-react';

import {
  Overlay, Panel, Head, CloseBtn, Body, Foot, Field, TwoCol, Hint,
  PrimaryBtn, GhostBtn, Spacer,
} from './modalStyles';

const StatusRow = styled.div`
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
`;

const StatusBtn = styled.button`
  padding: 0.3125rem 0.75rem;
  border: 1px solid ${(p) => (p.$on ? '#4f46e5' : '#cbd5e1')};
  background: ${(p) => (p.$on ? '#4f46e5' : '#fff')};
  color: ${(p) => (p.$on ? '#fff' : '#475569')};
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
`;

const STATUS_WHY = {
  신규: '아직 아무도 안 읽었습니다',
  확인됨: '한 번 읽고 쓸모를 판단했습니다',
  보관: '다 본 것입니다. 지우지는 않습니다',
};

/**
 * 소식 고치기.
 *
 * ⚠️ 예전에는 상세 창이 **본문만** 보냈다. 오타 난 제목ㆍ틀린 발표일ㆍ잘못 고른
 *    분류가 영원히 남았다 — 서버는 받고 있었는데 **보내는 쪽이 없었다.**
 *
 * ⚠️ `status` 는 거르기만 되고 바꾸는 길이 없어 **죽은 칸**이었다(전부 영원히
 *    「신규」). 읽었다는 표시를 못 하면 「무엇을 처리해야 하나」가 안 보인다.
 */
const NewsEditModal = ({ news, statuses, categories, onClose, onSave, saving }) => {
  const [form, setForm] = useState(() => ({
    title: news?.title || '',
    source: news?.source || '',
    url: news?.url || '',
    publishedAt: news?.published_at || '',
    category: news?.category || '',
    summary: news?.summary || '',
    status: news?.status || '신규',
  }));

  if (!news) return null;
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Head>
          <Newspaper size={17} color="#4f46e5" />
          <h2>소식 고치기</h2>
          <CloseBtn onClick={onClose}><X size={18} /></CloseBtn>
        </Head>

        <Body>
          <Field>
            <span>제목 *</span>
            <input value={form.title} onChange={set('title')} />
          </Field>

          <TwoCol>
            <Field>
              <span>출처</span>
              <input value={form.source} onChange={set('source')} />
            </Field>
            <Field>
              <span>발표일</span>
              <input type="date" value={form.publishedAt} onChange={set('publishedAt')} />
            </Field>
          </TwoCol>

          <TwoCol>
            <Field>
              <span>분류</span>
              <select value={form.category} onChange={set('category')}>
                <option value="">고르지 않음</option>
                {(categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field>
              <span>원문 주소</span>
              <input value={form.url} onChange={set('url')} placeholder="https://" />
            </Field>
          </TwoCol>

          <Field>
            <span>요약</span>
            <textarea value={form.summary} onChange={set('summary')} />
          </Field>

          <Field>
            <span>처리 상태</span>
            <StatusRow>
              {(statuses || ['신규', '확인됨', '보관']).map((st) => (
                <StatusBtn key={st} type="button" $on={form.status === st}
                           title={STATUS_WHY[st]}
                           onClick={() => setForm((p) => ({ ...p, status: st }))}>
                  {st}
                </StatusBtn>
              ))}
            </StatusRow>
          </Field>
          <Hint>
            <b>읽었으면 「확인됨」으로 옮겨 주세요.</b> 그래야 목록에서 「신규」만 걸러
            <b> 무엇이 아직 안 읽혔는지</b>가 보입니다.
          </Hint>
        </Body>

        <Foot>
          <Spacer />
          <GhostBtn onClick={onClose}>취소</GhostBtn>
          <PrimaryBtn onClick={() => onSave(form)}
                      disabled={!form.title.trim() || saving}>
            {saving ? '저장하는 중…' : '저장'}
          </PrimaryBtn>
        </Foot>
      </Panel>
    </Overlay>
  );
};

export default NewsEditModal;
