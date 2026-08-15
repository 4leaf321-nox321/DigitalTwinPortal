import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../contexts/AuthContext';
import Header from './components/Layout/Header';
import MySurveys from './components/Respond/MySurveys';
import SurveyManager from './components/Manage/SurveyManager';
import surveyApi from './services/surveyApi';
import { MAX_WIDTH } from './theme';

// 설문 모듈.
//
// **한 모듈이 두 얼굴을 갖는다.** 로그인한 사람은 누구나 들어와 자기가 받은
// 설문에 답하고(components/Respond), admin·dt_office 는 같은 화면 안에서
// 만들기·집계로 전환한다(components/Manage). 갈라 두는 것은 라우트가 아니라
// 이 컴포넌트의 mode 상태다 — 라우트를 둘로 나누면 홈 카드도 둘이 되고,
// 대부분의 사용자에게 쓸모없는 카드가 하나 더 생긴다.
//
// ⚠️ **가르는 진짜 주체는 백엔드다.** `/api/surveys/manage/*` 는
// manager_required, 응답용은 로그인만 본다. 아래 canManage 는 쓸모없는 버튼을
// 안 보이게 하는 정리일 뿐, 방어가 아니다. URL 을 직접 쳐서 들어와도 서버가
// 403 을 준다.
//
// 계획서: modules/digital-twin-strategy/SURVEY_PLAN.md (2절·6-3)

const MANAGER_ROLES = ['admin', 'dt_office'];

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
`;

const MainContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem 1.5rem 3rem;
`;

// 포탈 공통 폭. 전략 모듈과 같은 값을 쓴다 — 모듈마다 폭이 다르면 홈에서
// 넘어올 때마다 화면이 출렁인다. 응답 화면은 이 안에서 읽기 좋은 폭으로 한 번
// 더 좁힌다(theme.js 의 READING_WIDTH).
const Bounded = styled.div`
  max-width: ${MAX_WIDTH};
  margin: 0 auto;
`;

/** AuthContext 가 아직 안 채워진 첫 렌더용 폴백.
 *
 *  AuthContext 자신이 localStorage['user'] 를 파싱해 초기화하므로
 *  (contexts/AuthContext.jsx), 다른 출처를 뒤지는 것이 아니라 **같은 곳을 조금
 *  일찍** 읽는 것이다. 이게 없으면 첫 프레임에 canManage 가 false 로 잡혀
 *  관리자에게 전환 버튼이 한 번 깜빡였다 나타난다. */
function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    // 저장된 값이 깨졌으면 역할을 모르는 것으로 친다. 여기서 터뜨리면
    // 설문 응답이라는 본래 기능까지 같이 죽는다.
    return null;
  }
}

function SurveyApp({ onGoHome }) {
  // 역할을 읽는 방식은 다른 모듈과 같다(useAuth — digital-twin-dashboard 의
  // Header.jsx 등이 쓰는 그것). 서버가 준 최신 역할이 반영되고, 로그인 상태가
  // 바뀌면 같이 바뀐다.
  const { user: authUser } = useAuth();
  const user = authUser || readStoredUser();
  const canManage = MANAGER_ROLES.includes(user?.role) || Boolean(user?.is_admin);

  // 전략 모듈이 `/survey?context_type=strategy_plan&context_id=<planId>&label=…`
  // 로 넘겨준다. 설문 모듈은 그 값이 무엇을 뜻하는지 모른 채 그대로 서버에
  // 전달하기만 한다 — 그래야 전략을 모르는 채로 있을 수 있다.
  const [searchParams, setSearchParams] = useSearchParams();
  const context = useMemo(() => {
    const type = searchParams.get('context_type');
    if (!type) return null;
    const rawId = searchParams.get('context_id');
    const id = rawId === null || rawId === '' ? null : Number(rawId);
    return {
      context_type: type,
      context_id: Number.isNaN(id) ? null : id,
      ...(searchParams.get('context_tag')
        ? { context_tag: searchParams.get('context_tag') }
        : {}),
    };
  }, [searchParams]);
  const contextLabel = searchParams.get('label');

  const [mode, setMode] = useState('respond');
  const [divisions, setDivisions] = useState([]);
  const [pending, setPending] = useState(0);

  // context 를 달고 들어왔다는 것은 "이 전략의 설문을 보러 왔다"는 뜻이라
  // 관리 얼굴로 연다. **딱 한 번만** 한다 — 매번 하면 사용자가 「내 설문」으로
  // 돌아갈 때마다 도로 관리 화면으로 튕긴다.
  const contextApplied = useRef(false);
  useEffect(() => {
    if (contextApplied.current || !context || !canManage) return;
    contextApplied.current = true;
    setMode('manage');
  }, [context, canManage]);

  useEffect(() => {
    // 사업부 목록은 **집계 화면에서만** 쓴다 — 응답의 사업부는 서버가 계정에서
    // 정하므로 응답자는 목록이 필요 없다. 관리 권한이 없으면 부르지 않는다.
    // 실패해도 []를 돌려주므로 여기서 오류 처리를 하지 않는다.
    if (!canManage) return undefined;
    let alive = true;
    surveyApi.listDivisions().then(rows => alive && setDivisions(rows));
    return () => { alive = false; };
  }, [canManage]);

  useEffect(() => {
    // 헤더 배지의 첫 값. 응답 화면에 들어가면 목록이 정확한 값으로 덮어쓴다.
    let alive = true;
    surveyApi.pendingCount()
      .then(res => alive && setPending(res?.data?.pending ?? 0))
      .catch(() => {});   // 배지는 부가 정보라 실패해도 화면이 깨지면 안 된다
    return () => { alive = false; };
  }, []);

  const handlePendingChange = useCallback((n) => setPending(n), []);

  const clearContext = useCallback(() => {
    // URL 에서 지워야 새로고침해도 필터가 안 돌아온다.
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  return (
    <Container>
      <Header
        onGoHome={onGoHome}
        canManage={canManage}
        mode={mode}
        onChangeMode={setMode}
        pending={pending}
      />

      <MainContent>
        <Bounded>
          {mode === 'manage' && canManage ? (
            <SurveyManager
              context={context}
              contextLabel={contextLabel}
              divisions={divisions}
              onClearContext={clearContext}
            />
          ) : (
            <MySurveys onPendingChange={handlePendingChange} />
          )}
        </Bounded>
      </MainContent>
    </Container>
  );
}

export default SurveyApp;
