import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import { ArrowLeft, Search, Check } from 'lucide-react';
import surveyApi from '../../services/surveyApi';
import { ACCENT, ACCENT_DARK, ACCENT_LINE, ACCENT_TINT } from '../../theme';

// 사무국장을 지정하는 자리.
//
// 다른 역할은 데이터에서 유도된다 — PL 은 과제의 pl_knox_id, 참여인력은
// members_json, 사업부 사무국은 dt_office·manager 권한. 그런데 **사무국장은
// 권한으로 구분되지 않는다.** 그래서 사람을 직접 지정한다.
//
// ⚠️ 아무도 지정하지 않으면 사무국장 역할은 **아무에게도 유도되지 않는다.**
//    그 상태로 사무국장 전용 문항을 만들면, 그 사람이 역할을 직접 골라야만
//    문항을 받는다(role_source='picked'). 지정해 두는 편이 낫다.

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Back = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  align-self: flex-start;
  padding: 0;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { color: ${ACCENT}; }
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
`;

const Note = styled.div`
  padding: 0.7rem 0.875rem;
  background: ${ACCENT_TINT};
  border: 1px solid ${ACCENT_LINE};
  border-radius: 0.5rem;
  color: #475569;
  font-size: 0.8125rem;
  line-height: 1.65;
`;

const SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.65rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  background: white;
  color: #94a3b8;
`;

const SearchInput = styled.input`
  flex: 1;
  border: none;
  outline: none;
  font-size: 0.875rem;
  font-family: inherit;
  color: #1e293b;
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
  max-height: 22rem;
  overflow-y: auto;
`;

const Person = styled.button`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.875rem;
  border: none;
  border-bottom: 1px solid #f1f5f9;
  background: ${p => (p.$on ? ACCENT_TINT : 'white')};
  text-align: left;
  font-family: inherit;
  cursor: pointer;
  &:last-child { border-bottom: none; }
  &:hover { background: ${p => (p.$on ? ACCENT_TINT : '#f8fafc')}; }
`;

const Box = styled.span`
  flex-shrink: 0;
  width: 1.05rem;
  height: 1.05rem;
  border-radius: 0.25rem;
  border: 1px solid ${p => (p.$on ? ACCENT : '#cbd5e1')};
  background: ${p => (p.$on ? ACCENT : 'white')};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Who = styled.div`
  flex: 1;
  min-width: 0;
`;

const Name = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: #1e293b;
`;

const Sub = styled.div`
  font-size: 0.75rem;
  color: #94a3b8;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: flex-end;
`;

const Button = styled.button`
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid ${p => (p.$primary ? 'transparent' : '#cbd5e1')};
  background: ${p => (p.$primary ? ACCENT : 'white')};
  color: ${p => (p.$primary ? 'white' : '#64748b')};
  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const Msg = styled.div`
  font-size: 0.8125rem;
  color: ${p => (p.$bad ? '#b91c1c' : ACCENT_DARK)};
`;

const OfficeHeadSettings = ({ onBack }) => {
  const [users, setUsers] = useState([]);
  const [picked, setPicked] = useState([]);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    surveyApi.getOptions()
      .then(res => {
        if (!alive || !res?.data) return;
        setUsers(res.data.users || []);
        setPicked(res.data.office_head_user_ids || []);
      })
      .catch(e => setError(e.message));
    return () => { alive = false; };
  }, []);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter(u =>
      (u.name || '').toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term));
  }, [users, q]);

  const toggle = (id) => setPicked(p =>
    p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setMsg(null);
    try {
      const res = await surveyApi.setOfficeHeads(picked);
      // 서버가 **실재하는 활성 사용자만** 남겨서 돌려준다. 그 결과를 그대로
      // 받아야 화면과 저장된 것이 갈리지 않는다.
      setPicked(res?.data?.office_head_user_ids || []);
      setMsg('저장했습니다.');
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Wrap>
      <Back onClick={onBack}><ArrowLeft size={15} /> 설문 목록</Back>
      <Title>사무국장 지정</Title>

      <Note>
        PL·과제 참여인력·사업부 사무국은 <strong>데이터에서 자동으로 판정</strong>됩니다
        (과제의 knoxId, 계정 권한). 그런데 <strong>사무국장은 권한으로 구분되지
        않아</strong> 여기서 직접 지정합니다.
        <br />
        아무도 지정하지 않으면 사무국장 역할은 누구에게도 유도되지 않고, 본인이
        직접 골라야만 사무국장 문항을 받습니다.
      </Note>

      <SearchRow>
        <Search size={15} />
        <SearchInput value={q} onChange={e => setQ(e.target.value)}
                     placeholder="이름 또는 메일로 찾기" />
      </SearchRow>

      <List>
        {shown.length === 0 ? (
          <Person as="div" $on={false}><Sub>해당하는 사람이 없습니다.</Sub></Person>
        ) : shown.map(u => {
          const on = picked.includes(u.id);
          return (
            <Person key={u.id} type="button" $on={on} onClick={() => toggle(u.id)}>
              <Box $on={on}>{on && <Check size={12} strokeWidth={3} />}</Box>
              <Who>
                <Name>{u.name}</Name>
                <Sub>{u.email} · {u.role}</Sub>
              </Who>
            </Person>
          );
        })}
      </List>

      <Actions>
        {error && <Msg $bad>{error}</Msg>}
        {msg && !error && <Msg>{msg}</Msg>}
        <span style={{ fontSize: '0.8125rem', color: '#94a3b8' }}>
          {picked.length}명 지정됨
        </span>
        <Button $primary onClick={save} disabled={saving}>
          {saving ? '저장 중…' : '저장'}
        </Button>
      </Actions>
    </Wrap>
  );
};

export default OfficeHeadSettings;
