import React from 'react';
import styled from 'styled-components';
import { ShieldAlert } from 'lucide-react';

// 익명성 고지.
//
// ⚠️ **접을 수 없게 만든 것이 이 컴포넌트의 요점이다.** 이 설문은 진짜 익명이
// 아니다 — 응답에 user_id 가 붙고 관리자는 `/identities` 로 신원을 볼 수 있다.
// 익명이라고 안내하고 실제로는 추적 가능하면, 그 사실이 알려지는 순간 설문
// 자체의 신뢰가 무너지고 이후 어떤 설문도 솔직한 답을 못 받는다.
//
// 그래서 토글도, dismiss 도, localStorage 로 '다시 보지 않기'도 두지 않는다.
// 그런 장치가 붙는 순간 "한 번 보고 잊는 문구"가 되고, 고지가 면피용이 된다.
// (고지한 이상 실제로 열람 기록이 남는다 — 백엔드 survey_access_logs)

const Box = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.875rem 1rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 0.5rem;
  color: #92400e;
  font-size: 0.8125rem;
  line-height: 1.6;
`;

const Icon = styled(ShieldAlert)`
  flex-shrink: 0;
  margin-top: 0.1rem;
`;

const AnonymityNotice = () => (
  <Box>
    <Icon size={16} />
    <span>
      <strong>관리자는 응답자를 확인할 수 있습니다.</strong> 이 설문은 완전한
      익명이 아닙니다 — 일반 집계 화면에는 소속과 답만 나오지만, 사무국·관리자는
      누가 답했는지 확인할 수 있고 <strong>그 확인은 열람 기록으로 남습니다.</strong>
      {' '}그 점을 알고 답해 주세요. 신원이 드러나면 곤란한 내용은 설문 대신 다른
      경로를 이용하시는 편이 좋습니다.
    </span>
  </Box>
);

export default AnonymityNotice;
