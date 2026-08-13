/**
 * 메일 수신처 뽑기 — 고른 과제의 **사람 knoxId 를 모아 준다.**
 *
 * 무엇을 하나
 *     과제를 여러 개 고르고, 어느 역할을 넣을지(과제PL·참여인력·작성자) 고르면
 *     그 사람들의 knoxId 를 중복 없이 모아 붙여넣기 좋게 내놓는다.
 *
 * ⚠️ **knoxId 가 없는 사람은 목록에 못 넣는다.** 이름만으로는 메일을 보낼 수 없다.
 *    대신 **몇 명이 왜 빠졌는지 반드시 보여 준다** — 조용히 빼면 "다 보냈다" 고
 *    믿게 되고, 정작 받아야 할 사람이 빠진 채로 끝난다.
 *    (그 사람들의 knoxId 는 「과제PL·작성자 계정 연결」·「참여인력 계정 점검」에서 채운다)
 *
 * ⚠️ **휴지통 과제는 빼고 센다.** 지운 과제의 사람에게 메일을 보낼 일은 없다.
 *    🐞 처음에 이걸 빠뜨려 화면 목록을 그대로 썼더니 삭제 과제가 섞여 나왔다.
 *
 * ⚠️ **서버를 부르지 않는다.** 필요한 값이 이미 화면의 과제 목록에 다 들어 있다
 *    (`과제PL_knoxId` · `작성자_knoxId` · `과제참여인력목록[].knoxId`).
 *    같은 것을 서버에서 다시 만들면 화면과 다른 답이 나오는 날이 온다.
 */
import React, { useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  AlertTriangle, Check, ClipboardCopy, Mail, Search, X,
} from 'lucide-react';

const ROLES = [
  { key: 'pl', label: '과제PL' },
  { key: 'member', label: '참여인력' },
  { key: 'author', label: '작성자' },
];

const SEPARATORS = [
  { key: 'semi', label: '세미콜론 ;', join: '; ', hint: 'Outlook 수신자 칸' },
  { key: 'comma', label: '쉼표 ,', join: ', ', hint: '대부분의 메일' },
  { key: 'line', label: '줄바꿈', join: '\n', hint: '표에 붙여넣기' },
];

/** 사람 하나를 뽑아 낸다. knoxId 가 없으면 `knoxId: ''` 로 두고 **버리지 않는다.** */
const person = (name, knoxId, role, project) => ({
  name: (name || '').trim(),
  knoxId: (knoxId || '').trim(),
  role,
  project: project.과제명 || '(제목 없음)',
});

const MailRecipientModal = ({
  open, onClose, projects = [], divisionColors = {}, currentYear,
}) => {
  const [picked, setPicked] = useState(() => new Set());
  const [roles, setRoles] = useState(() => new Set(['pl', 'member']));
  const [sep, setSep] = useState('semi');
  const [q, setQ] = useState('');
  const [division, setDivision] = useState('');
  const [year, setYear] = useState(currentYear ? String(currentYear) : '');
  const [copied, setCopied] = useState(false);

  /**
   * 휴지통에 들어간 과제는 **아예 없는 것으로 본다.**
   * 고르는 목록에서도, 사람을 끌어내는 셈에서도 같은 목록을 쓴다 —
   * 한쪽만 거르면 "고른 적 없는 사람" 이 수신처에 남는다.
   */
  const live = useMemo(() => projects.filter(p => !p._deleted), [projects]);
  const trashed = projects.length - live.length;

  const divisions = useMemo(
    () => [...new Set(live.map(p => p.사업부).filter(Boolean))], [live]);

  const years = useMemo(
    () => [...new Set(live.map(p => p.과제년도).filter(Boolean))].sort((a, b) => b - a),
    [live]);

  const shown = useMemo(() => {
    const key = q.trim().toLowerCase();
    return live.filter(p => {
      if (year && String(p.과제년도) !== year) return false;
      if (division && p.사업부 !== division) return false;
      if (!key) return true;
      return (p.과제명 || '').toLowerCase().includes(key)
        || (p.과제PL || '').toLowerCase().includes(key);
    });
  }, [live, q, division, year]);

  /** 고른 과제에서 고른 역할의 사람을 전부 끌어낸다. 중복 제거 전 원본이다. */
  const people = useMemo(() => {
    const out = [];
    live.forEach(p => {
      if (!picked.has(p.uuid)) return;
      if (roles.has('pl') && (p.과제PL || p.과제PL_knoxId)) {
        out.push(person(p.과제PL, p.과제PL_knoxId, '과제PL', p));
      }
      if (roles.has('author') && (p.작성자 || p.작성자_knoxId)) {
        out.push(person(p.작성자, p.작성자_knoxId, '작성자', p));
      }
      if (roles.has('member')) {
        (p.과제참여인력목록 || []).forEach(m => {
          if (m?.이름 || m?.knoxId) out.push(person(m.이름, m.knoxId, '참여인력', p));
        });
      }
    });
    return out;
  }, [live, picked, roles]);

  /**
   * knoxId 기준으로 묶는다. 한 사람이 여러 과제·역할에 걸쳐 있으면 **한 번만** 나온다.
   * 어디에서 왔는지는 함께 들고 있어 화면이 보여 준다.
   */
  const recipients = useMemo(() => {
    const map = new Map();
    people.forEach(x => {
      if (!x.knoxId) return;
      const key = x.knoxId.toLowerCase();
      const cur = map.get(key) || { ...x, roles: new Set(), projects: new Set() };
      cur.roles.add(x.role);
      cur.projects.add(x.project);
      if (!cur.name && x.name) cur.name = x.name;
      map.set(key, cur);
    });
    return [...map.values()].sort((a, b) => a.knoxId.localeCompare(b.knoxId));
  }, [people]);

  /** knoxId 가 없어 못 넣는 사람 — 이름 기준으로 묶는다. */
  const missing = useMemo(() => {
    const map = new Map();
    people.forEach(x => {
      if (x.knoxId || !x.name) return;
      const cur = map.get(x.name) || { name: x.name, roles: new Set(), projects: new Set() };
      cur.roles.add(x.role);
      cur.projects.add(x.project);
      map.set(x.name, cur);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [people]);

  const text = useMemo(() => {
    const join = SEPARATORS.find(s => s.key === sep)?.join || '; ';
    return recipients.map(r => r.knoxId).join(join);
  }, [recipients, sep]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 사내망 브라우저 설정에 따라 clipboard API 가 막힐 수 있다 — 그때는
      // 아래 상자에서 직접 긁어 복사하면 된다. 실패를 조용히 넘기지 않고 알린다.
      setCopied(false);
      window.alert('복사가 막혀 있습니다. 아래 상자에서 직접 선택해 복사해 주세요.');
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const toggle = (uuid) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(uuid)) next.delete(uuid);
    else next.add(uuid);
    return next;
  });

  const allShownPicked = shown.length > 0 && shown.every(p => picked.has(p.uuid));

  /*
    고른 건수는 **지금 조건 밖에 있는 것까지** 센다.

    ⚠️ 연도·사업부 거르개는 **고르는 목록에만** 건다. 사람을 끌어내는 셈에는 안 건다 —
       2025년 과제를 골라 두고 연도를 2026으로 바꾸면 고른 것이 조용히 빠져,
       "골랐는데 수신처에 없다" 가 된다. 대신 몇 건이 조건 밖인지 적어 준다.
       (휴지통만은 양쪽에 다 건다 — 그건 없는 과제다)
  */
  const pickedLive = useMemo(
    () => live.filter(p => picked.has(p.uuid)), [live, picked]);
  const offScreen = pickedLive.length - shown.filter(p => picked.has(p.uuid)).length;

  if (!open) return null;

  return (
    <Backdrop onMouseDown={onClose}>
      <Box onMouseDown={e => e.stopPropagation()}>
        <Head>
          <Title><Mail size={17} />메일 수신처 뽑기</Title>
          <IconBtn onClick={onClose}><X size={17} /></IconBtn>
        </Head>

        <Roles>
          <Label>넣을 사람</Label>
          {ROLES.map(r => {
            const on = roles.has(r.key);
            return (
              <Toggle key={r.key} type="button" $on={on}
                      onClick={() => setRoles(prev => {
                        const next = new Set(prev);
                        if (next.has(r.key)) next.delete(r.key);
                        else next.add(r.key);
                        return next;
                      })}>
                {on && <Check size={12} />}{r.label}
              </Toggle>
            );
          })}
        </Roles>

        <Cols>
          {/* ── 왼쪽: 과제 고르기 ── */}
          <Pane>
            <PaneHead>
              <b>과제 {pickedLive.length > 0 ? `${pickedLive.length}건 선택` : '고르기'}</b>
              {offScreen > 0 && <OffMark title="연도·사업부·검색 조건 밖에서 고른 것입니다">
                +{offScreen} 조건 밖
              </OffMark>}
              <Spacer />
              <MiniBtn type="button" onClick={() => setPicked(prev => {
                const next = new Set(prev);
                if (allShownPicked) shown.forEach(p => next.delete(p.uuid));
                else shown.forEach(p => next.add(p.uuid));
                return next;
              })}>
                {allShownPicked ? '보이는 것 해제' : '보이는 것 전부'}
              </MiniBtn>
              {pickedLive.length > 0 && (
                <MiniBtn type="button" onClick={() => setPicked(new Set())}>비우기</MiniBtn>
              )}
            </PaneHead>

            <Filters>
              <SearchBox>
                <Search size={13} />
                <input value={q} onChange={e => setQ(e.target.value)}
                       placeholder="과제명 · 과제PL 검색" />
              </SearchBox>
              <Select value={year} onChange={e => setYear(e.target.value)}>
                <option value="">전체 연도</option>
                {years.map(y => <option key={y} value={String(y)}>{y}년</option>)}
              </Select>
              <Select value={division} onChange={e => setDivision(e.target.value)}>
                <option value="">전체 사업부</option>
                {divisions.map(d => <option key={d} value={d}>{d}</option>)}
              </Select>
            </Filters>

            <ScrollList>
              {shown.length === 0 && <Muted>조건에 맞는 과제가 없습니다.</Muted>}
              {shown.map(p => (
                <ProjRow key={p.uuid} $on={picked.has(p.uuid)}
                         onClick={() => toggle(p.uuid)}>
                  <input type="checkbox" readOnly checked={picked.has(p.uuid)} />
                  <Dot style={{ background: divisionColors[p.사업부] || '#cbd5e1' }} />
                  <ProjName title={p.과제명}>{p.과제명 || '(제목 없음)'}</ProjName>
                  <ProjSub>{p.과제PL || '—'}</ProjSub>
                </ProjRow>
              ))}
            </ScrollList>
          </Pane>

          {/* ── 오른쪽: 뽑힌 사람 ── */}
          <Pane>
            <PaneHead>
              <b>수신처 {recipients.length}명</b>
              {missing.length > 0 && (
                <Warn title="knoxId 가 없어 넣지 못했습니다">
                  <AlertTriangle size={12} />빠짐 {missing.length}명
                </Warn>
              )}
              <Spacer />
              <Select value={sep} onChange={e => setSep(e.target.value)} style={{ width: 118 }}>
                {SEPARATORS.map(s => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </Select>
              <MiniBtn type="button" onClick={copy} disabled={!text}>
                <ClipboardCopy size={12} />{copied ? '복사됨' : '복사'}
              </MiniBtn>
            </PaneHead>

            <Output readOnly value={text}
                    placeholder="왼쪽에서 과제를 고르면 여기에 knoxId 가 모입니다."
                    onFocus={e => e.target.select()} />

            <ScrollList style={{ maxHeight: 150 }}>
              {recipients.map(r => (
                <PersonRow key={r.knoxId}>
                  <b>{r.knoxId}</b>
                  <span>{r.name || '(이름 없음)'}</span>
                  <Tags>{[...r.roles].join(' · ')}</Tags>
                  <Cnt title={[...r.projects].join('\n')}>과제 {r.projects.size}</Cnt>
                </PersonRow>
              ))}
            </ScrollList>

            {/* 빠진 사람을 **반드시** 보여 준다 — 조용히 빼면 다 보냈다고 믿게 된다 */}
            {missing.length > 0 && (
              <MissBox>
                <MissHead>
                  <AlertTriangle size={12} />
                  knoxId 가 없어 넣지 못한 {missing.length}명
                </MissHead>
                <MissList>
                  {missing.map(m => (
                    <MissRow key={m.name}>
                      <b>{m.name}</b>
                      <Tags>{[...m.roles].join(' · ')}</Tags>
                      <Cnt title={[...m.projects].join('\n')}>과제 {m.projects.size}</Cnt>
                    </MissRow>
                  ))}
                </MissList>
                <MissNote>
                  설정 ▸ 「과제PL · 작성자 계정 연결」·「참여인력 계정 점검」에서 채울 수 있습니다.
                </MissNote>
              </MissBox>
            )}
          </Pane>
        </Cols>

        <Foot>
          <Muted>
            knoxId 만 모읍니다. 메일 주소는 사내 규칙에 맞게 붙여 쓰세요.
            {trashed > 0 && ` · 휴지통 과제 ${trashed}건은 목록에서 뺐습니다.`}
          </Muted>
          <Spacer />
          <Ghost type="button" onClick={onClose}>닫기</Ghost>
        </Foot>
      </Box>
    </Backdrop>
  );
};

/* ── 스타일 ── */

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 3200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
`;

const Box = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(1020px, 96vw);
  max-height: 90vh;
  padding: 18px 20px 16px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.3);
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
`;

const Title = styled.h3`
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #1e293b;
`;

const IconBtn = styled.button`
  margin-left: auto;
  display: inline-flex;
  padding: 4px;
  color: #64748b;
  background: none;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  &:hover { background: #f1f5f9; }
`;

const Roles = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
`;

const Label = styled.span`
  font-size: 12.5px;
  font-weight: 700;
  color: #475569;
  margin-right: 2px;
`;

const Toggle = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 11px;
  font-size: 12.5px;
  font-weight: ${p => (p.$on ? 700 : 500)};
  color: ${p => (p.$on ? '#4338ca' : '#64748b')};
  background: ${p => (p.$on ? '#eef2ff' : '#fff')};
  border: 1px solid ${p => (p.$on ? '#c7d2fe' : '#e2e8f0')};
  border-radius: 9999px;
  cursor: pointer;
`;

const Cols = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  flex: 1;
  min-height: 0;

  @media (max-width: 860px) { grid-template-columns: 1fr; }
`;

const Pane = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
`;

const PaneHead = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: 13px;
  color: #334155;
`;

const Spacer = styled.div`flex: 1;`;

const MiniBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 9px;
  font-size: 11.5px;
  font-weight: 600;
  color: #475569;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
  &:hover:not(:disabled) { background: #f1f5f9; }
  &:disabled { opacity: 0.5; cursor: default; }
`;

const Filters = styled.div`
  display: flex;
  gap: 6px;
  flex-shrink: 0;
`;

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 5px;
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  color: #94a3b8;

  input {
    flex: 1;
    min-width: 0;
    border: none;
    outline: none;
    font-size: 12.5px;
    color: #1e293b;
  }
`;

const Select = styled.select`
  padding: 4px 7px;
  font-size: 12.5px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: #fff;
`;

const ScrollList = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #fff;
`;

const ProjRow = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  font-size: 12.5px;
  border-radius: 6px;
  cursor: pointer;
  background: ${p => (p.$on ? '#eef2ff' : 'transparent')};

  &:hover { background: ${p => (p.$on ? '#e0e7ff' : '#f8fafc')}; }
`;

const Dot = styled.span`
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
`;

const ProjName = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: #1e293b;
`;

const ProjSub = styled.span`
  flex-shrink: 0;
  font-size: 11px;
  color: #94a3b8;
`;

const Output = styled.textarea`
  flex-shrink: 0;
  min-height: 84px;
  padding: 8px 10px;
  font-family: 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #1e293b;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  resize: vertical;
`;

const PersonRow = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 6px;
  font-size: 12px;
  color: #475569;

  b { color: #1e293b; font-weight: 700; }
`;

const Tags = styled.span`
  font-size: 10.5px;
  color: #94a3b8;
`;

const Cnt = styled.span`
  margin-left: auto;
  flex-shrink: 0;
  font-size: 10.5px;
  color: #cbd5e1;
  cursor: help;
`;

const OffMark = styled.span`
  padding: 1px 6px;
  font-size: 10.5px;
  font-weight: 700;
  color: #7c3aed;
  background: #f5f3ff;
  border-radius: 9999px;
  cursor: help;
`;

const Warn = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11.5px;
  font-weight: 700;
  color: #b45309;
  cursor: help;
`;

const MissBox = styled.div`
  flex-shrink: 0;
  padding: 6px 9px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
`;

const MissHead = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 700;
  color: #92400e;
`;

const MissList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 92px;
  overflow-y: auto;
  margin-top: 3px;
`;

const MissRow = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11.5px;
  color: #78350f;

  b { font-weight: 700; }
`;

const MissNote = styled.div`
  margin-top: 4px;
  font-size: 11px;
  color: #b45309;
`;

const Muted = styled.div`
  font-size: 11.5px;
  color: #94a3b8;
`;

const Foot = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`;

const Ghost = styled.button`
  padding: 7px 15px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  cursor: pointer;
`;

export default MailRecipientModal;
