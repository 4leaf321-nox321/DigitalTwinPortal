import React from 'react';
import styled from 'styled-components';
import { UserCog, Workflow } from 'lucide-react';
import { ACCENT, ACCENT_DARK, ACCENT_TINT, ACCENT_LINE } from '../../theme';

// 응답자가 **자기 역할·프로세스를 고르는 자리.**
//
// 설문 하나 안에서 과제 멤버 / PL / 사무국이 서로 다른 것을 답한다. 그래서 이
// 선택은 「곁들이는 정보」가 아니라 **무엇을 묻는지를 정하는 값**이다. 사업부와
// 결이 다르다 — 사업부는 몰라도 답은 낼 수 있지만, 역할을 모르면 물을 문항이
// 정해지지 않는다. 그래서 이것만은 문항보다 위에 두고, 고르기 전에는 문항을
// 아예 안 보여준다(SurveyForm 의 axisReady).
//
// ⚠️ **고른 뒤에도 계속 보이고 계속 바꿀 수 있어야 한다.** 한 번 고르면 잠기게
//    만들면, 잘못 골랐을 때 되돌릴 길이 없어 사람들은 처음부터 대충 고른다.
//    바꾸면 문항이 즉시 다시 걸러지고, **이미 적은 답은 지우지 않는다.**
//
// ⚠️ 설문이 그 축을 안 물으면(목록이 비면) 그 select 를 아예 안 그린다. 빈
//    목록에 '해당 없음' 하나만 든 select 를 띄우면 답할 것도 없는 질문을 하나
//    더 하는 셈이고, 응답자는 그것도 골라야 하는 줄 안다.

const Card = styled.div`
  padding: 1rem 1.25rem;
  background: white;
  border: 1px solid ${p => (p.$pending ? ACCENT_LINE : '#e2e8f0')};
  border-radius: 0.5rem;
`;

const SectionLabel = styled.div`
  font-size: 0.8125rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 0.625rem;
`;

const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.875rem 1.25rem;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 14rem;
  flex: 1 1 14rem;
`;

const FieldLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #64748b;
`;

// 아직 안 고른 축은 점선 강조로 눈에 띄게 둔다. 빨강으로 칠하지는 않는다 —
// 아직 아무것도 잘못하지 않은 사람에게 오류 표시를 하는 꼴이라서다.
const Select = styled.select`
  width: 100%;
  padding: 0.5rem 0.7rem;
  border: 1px ${p => (p.$empty ? 'dashed' : 'solid')} ${p => (p.$empty ? ACCENT : '#cbd5e1')};
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-family: inherit;
  background: ${p => (p.$empty ? ACCENT_TINT : 'white')};
  color: #1e293b;
  font-weight: ${p => (p.$empty ? 400 : 600)};
  cursor: pointer;
  &:focus { outline: none; border-color: ${ACCENT}; }
`;

const Note = styled.div`
  margin-top: 0.625rem;
  font-size: 0.8125rem;
  color: #94a3b8;
  line-height: 1.65;
`;

const Strong = styled.strong`
  color: ${ACCENT_DARK};
`;

/**
 * 이 문항이 이 역할·프로세스의 응답자에게 해당하는가.
 *
 * ⚠️ **빈 배열은 전원이다.** 비어 있는 것을 '아무도'로 읽으면 임포트 한 번
 *    잘못해서 아무도 답할 수 없는 설문이 만들어지고, 눈치채는 데 며칠 걸린다.
 *    NULL 과 빈 배열을 다르게 다루지 않는다 — 백엔드도 `or []` 로 같게 본다.
 *
 * 백엔드 `question_applies()`(survey/routes.py)와 **같은 규칙**이다. 다만
 * 화면 필터는 편의이지 방어가 아니다 — 막는 곳은 서버 한 곳이고, 여기서
 * 안 걸러진 답이 섞여 가도 서버가 조용히 버린다.
 */
export function questionApplies(question, role, process) {
  const roles = question?.audience_roles || [];
  const processes = question?.audience_processes || [];
  if (roles.length > 0 && !roles.includes(role)) return false;
  if (processes.length > 0 && !processes.includes(process)) return false;
  return true;
}

const Derived = styled.div`
  font-size: 0.75rem;
  line-height: 1.5;
  color: ${p => (p.$off ? '#b45309' : '#15803d')};
`;

const RoleSelect = ({
  roles = [],
  processes = [],
  derivedRoles = [],
  role,
  process,
  onRoleChange,
  onProcessChange,
}) => {
  // 설문이 둘 다 안 물으면 이 단계를 통째로 건너뛴다.
  if (roles.length === 0 && processes.length === 0) return null;

  const pending = (roles.length > 0 && !role) || (processes.length > 0 && !process);

  return (
    <Card $pending={pending}>
      <SectionLabel>답하시는 분</SectionLabel>
      <Row>
        {roles.length > 0 && (
          <Field>
            <FieldLabel htmlFor="survey-role">
              <UserCog size={13} /> 역할
            </FieldLabel>
            <Select
              id="survey-role"
              $empty={!role}
              value={role}
              onChange={e => onRoleChange(e.target.value)}
            >
              <option value="">— 고르세요 —</option>
              {roles.map(r => (
                <option key={r} value={r}>
                  {r}{derivedRoles.includes(r) ? ' ✓' : ''}
                </option>
              ))}
            </Select>
            {/* 유도된 역할과 그렇지 않은 것을 갈라 보여준다.
                ✓ 는 과제·권한 데이터로 확인된 역할이다. 표시가 없는 것을 고르면
                '본인이 밝힌 역할'로 기록되고(role_source='picked'), 집계에서
                그 둘을 갈라 볼 수 있다. 확인된 것을 감추면 사람들은 아무거나
                고르고, 역할별 집계는 자칭의 모음이 된다. */}
            {derivedRoles.length > 0 ? (
              <Derived $off={role && !derivedRoles.includes(role)}>
                {role && derivedRoles.includes(role)
                  ? '✓ 과제·권한 데이터로 확인된 역할입니다'
                  : `✓ 표시가 확인된 역할입니다 (${derivedRoles.join(', ')})`}
              </Derived>
            ) : (
              <Derived $off>
                데이터로 확인되지 않아 <strong>본인이 밝힌 역할</strong>로 기록됩니다
              </Derived>
            )}
          </Field>
        )}
        {processes.length > 0 && (
          <Field>
            <FieldLabel htmlFor="survey-process">
              <Workflow size={13} /> 프로세스
            </FieldLabel>
            <Select
              id="survey-process"
              $empty={!process}
              value={process}
              onChange={e => onProcessChange(e.target.value)}
            >
              <option value="">— 고르세요 —</option>
              {processes.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
          </Field>
        )}
      </Row>
      <Note>
        고르신 값에 따라 <Strong>묻는 문항이 달라집니다.</Strong> 잘못 고르셨으면
        언제든 다시 고르실 수 있고, 문항은 그 자리에서 다시 걸러집니다.
        {' '}이미 적어 두신 답은 <Strong>지워지지 않습니다</Strong> — 되돌아오면
        그대로 남아 있습니다.
      </Note>
    </Card>
  );
};

export default RoleSelect;
