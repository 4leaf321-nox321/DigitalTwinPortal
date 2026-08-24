import React, { useState } from 'react';
import styled from 'styled-components';
import { X, Newspaper, AlertTriangle, Plus } from 'lucide-react';

import {
  Overlay, Panel, Head, CloseBtn, Body, Foot, Field, TwoCol, Hint, Warn,
  PrimaryBtn, GhostBtn, Spacer,
} from './modalStyles';

const TechRow = styled.div`
  display: flex;
  gap: 0.375rem;
  align-items: center;
`;

const TechList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

const Chip = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.3125rem 0.5rem;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 0.4375rem;
  font-size: 0.75rem;
  color: #3730a3;

  b { font-weight: 700; }
  span { color: #6366f1; flex: 1; }
  button { border: none; background: none; color: #818cf8; cursor: pointer; padding: 0; }
`;

const SmallBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  padding: 0.4375rem 0.625rem;
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 0.4375rem;
  font-size: 0.75rem;
  color: #475569;
  white-space: nowrap;
  cursor: pointer;

  &:hover { background: #f8fafc; }
`;

/**
 * 소식 등록.
 *
 * ⚠️ **이 창의 핵심은 아래쪽 「이 소식이 말하는 기술」이다.** 레이더를 따로 채우는
 *    일로 만들면 아무도 안 채운다 — 앞선 세 번의 시도(tech_radar · tech_archive ·
 *    digital_twin_solution)가 그렇게 죽었다. 소식을 넣는 김에 채워져야 한다.
 *    여기 적은 이름은 서버가 **이미 있으면 잇고 없으면 만든다**(별칭까지 본다).
 */
const NewsModal = ({ isOpen, onClose, onSave, categories, saving }) => {
  const [form, setForm] = useState({
    title: '', source: '', url: '', publishedAt: '', category: '', summary: '',
    body: '',
  });
  const [techs, setTechs] = useState([]);
  const [techName, setTechName] = useState('');
  const [techNote, setTechNote] = useState('');

  if (!isOpen) return null;

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const addTech = () => {
    const name = techName.trim();
    if (!name) return;
    if (techs.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setTechName('');
      return;
    }
    setTechs((p) => [...p, { name, note: techNote.trim() || undefined }]);
    setTechName('');
    setTechNote('');
  };

  const submit = () => {
    if (!form.title.trim()) return;
    onSave({ ...form, technologies: techs });
  };

  return (
    <Overlay onClick={onClose}>
      <Panel onClick={(e) => e.stopPropagation()}>
        <Head>
          <Newspaper size={17} color="#4f46e5" />
          <h2>소식 등록</h2>
          <CloseBtn onClick={onClose}><X size={18} /></CloseBtn>
        </Head>

        <Body>
          <Field>
            <span>제목 *</span>
            <input value={form.title} onChange={set('title')}
                   placeholder="예: NVIDIA, Omniverse 에 실시간 물리 해석 추가" />
          </Field>

          <TwoCol>
            <Field>
              <span>출처</span>
              <input value={form.source} onChange={set('source')}
                     placeholder="예: NVIDIA 블로그, Gartner" />
            </Field>
            <Field>
              <span>발표일</span>
              <input type="date" value={form.publishedAt} onChange={set('publishedAt')} />
            </Field>
          </TwoCol>

          {/* ⚠️ 발표일을 오늘로 채우지 않는 이유를 여기서 알린다. */}
          <Hint>
            발표일은 <b>기사가 나온 날</b>입니다. 비워 두면 「날짜 미상」으로 남습니다 —
            등록일로 대신 채우지 않습니다. 오래된 글이 목록 맨 위에 서면 안 되기 때문입니다.
          </Hint>

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
            <textarea value={form.summary} onChange={set('summary')}
                      placeholder="목록에서 이것만 읽고 넘어갑니다. 서너 줄로." />
          </Field>

          <Field>
            <span>원문 보관</span>
            <textarea value={form.body} onChange={set('body')} rows={5}
                      placeholder="원문을 여기 붙여넣으면 시스템에 남습니다" />
          </Field>
          {/* ⚠️ 링크만으로는 부족하다 — 링크는 썩는다. */}
          <Hint>
            <b>링크는 썩습니다.</b> 회사가 글을 내리거나 주소를 바꾸면 6개월 뒤에는
            제목만 남습니다. 붙여넣어 두면 원문이 사라져도 읽을 수 있습니다.
            {form.body.trim() && <> 지금 <b>{form.body.trim().length.toLocaleString()}자</b>.</>}
          </Hint>

          <Field>
            <span>이 소식이 말하는 기술</span>
            <TechRow>
              <input value={techName} onChange={(e) => setTechName(e.target.value)}
                     onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTech(); } }}
                     placeholder="기술 이름 (예: NVIDIA Omniverse)" />
              <input value={techNote} onChange={(e) => setTechNote(e.target.value)}
                     onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTech(); } }}
                     placeholder="무엇을 말하는지 한 줄" />
              <SmallBtn type="button" onClick={addTech}><Plus size={13} /> 추가</SmallBtn>
            </TechRow>
          </Field>

          {techs.length > 0 && (
            <TechList>
              {techs.map((t, i) => (
                <Chip key={t.name}>
                  <b>{t.name}</b>
                  <span>{t.note || '설명 없음'}</span>
                  <button type="button" onClick={() => setTechs((p) => p.filter((_, j) => j !== i))}>
                    <X size={13} />
                  </button>
                </Chip>
              ))}
            </TechList>
          )}

          <Warn>
            <AlertTriangle size={13} />
            <span>
              여기 적은 기술은 <b>레이더에 자동으로 올라갑니다</b>(처음 보는 것은 「관찰」로).
              이미 있는 기술이면 별칭까지 맞춰 보고 <b>같은 줄에 이어 붙입니다</b> —
              같은 기술이 여러 줄이 되면 레이더가 잡동사니가 되기 때문입니다.
            </span>
          </Warn>
        </Body>

        <Foot>
          <Spacer />
          <GhostBtn onClick={onClose}>취소</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={!form.title.trim() || saving}>
            {saving ? '저장하는 중…' : '등록'}
          </PrimaryBtn>
        </Foot>
      </Panel>
    </Overlay>
  );
};

export default NewsModal;
