import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import styled from 'styled-components';
import { ShieldOff } from 'lucide-react';

export const MODULE_NAMES = {
  '/digital-twin-dashboard': '디지털 트윈 과제 대시보드',
  '/dx-work-process': '지식 그래프 모듈',
  '/organization-chart': '조직도',
  '/office-management': '사무국 운영',
  '/dev-manufacturing-process': '데이터/프로세스 가시화',
  '/meeting-management': '협의체/회의체/보고',
  '/collaboration-board': '협업 게시판',
  '/company-material-council': '전사 물성 협의체',
  '/digital-twin-tech-level': '디지털 트윈 메가 과제 기획',
  '/digital-twin-resource': '리소스 관리',
  '/spdm-status': '플랫폼 현황',
  '/digital-twin-task-management': '제조 디지털 트윈 과제 관리',
  '/digital-twin-reference': '개발 디지털 트윈 로드맵 정보',
  '/dev-dt-maturity': '개발 디지털 트윈 성숙도',
  '/digital-twin-investment': '디지털 트윈 투자 현황',
  '/digital-twin-intel': '디지털 트윈 기술정보',
  '/auto-document': '문서 자동 작성',
  '/auto-document-verify': '문서 자동 검증',
  '/account-management': '계정 관리',
  '/digital-twin-solution': '디지털 트윈 솔루션',
  '/engineeringhub': 'Engineering Hub',
};

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const LoadingContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0066CC 0%, #003399 100%);
`;

const LoadingSpinner = styled.div`
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

const LoadingText = styled.div`
  color: white;
  font-size: 1rem;
  margin-top: 1rem;
  text-align: center;
`;

const LoadingWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const AccessDeniedContainer = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
`;

const AccessDeniedCard = styled.div`
  background: white;
  padding: 3rem;
  border-radius: 1rem;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
  text-align: center;
  max-width: 400px;
`;

const AccessDeniedIcon = styled.div`
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
  color: white;
`;

const AccessDeniedTitle = styled.h1`
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 0.75rem 0;
`;

const AccessDeniedMessage = styled.p`
  font-size: 1rem;
  color: #64748b;
  margin: 0 0 1.5rem 0;
  line-height: 1.5;
`;

const BackButton = styled.button`
  padding: 0.75rem 2rem;
  background: linear-gradient(135deg, #0066cc 0%, #0052a3 100%);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: linear-gradient(135deg, #0052a3 0%, #004080 100%);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3);
  }
`;

// 역할별 모듈 권한 캐시 (앱 전체에서 공유)
let _rolePermissionsCache = null;
let _rolePermissionsFetchPromise = null;

const fetchRolePermissions = (token) => {
  if (_rolePermissionsCache) return Promise.resolve(_rolePermissionsCache);
  if (_rolePermissionsFetchPromise) return _rolePermissionsFetchPromise;
  _rolePermissionsFetchPromise = fetch(`${API_BASE_URL}/auth/role-permissions`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(r => r.json())
    .then(res => {
      _rolePermissionsCache = res.success ? res.data : {};
      _rolePermissionsFetchPromise = null;
      return _rolePermissionsCache;
    })
    .catch(() => {
      _rolePermissionsFetchPromise = null;
      return {};
    });
  return _rolePermissionsFetchPromise;
};

// 외부에서 캐시 무효화용
export const invalidateRolePermissionsCache = () => {
  _rolePermissionsCache = null;
  _rolePermissionsFetchPromise = null;
};

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, user, token } = useAuth();
  const location = useLocation();
  const lastLoggedPath = useRef(null);
  const [rolePerms, setRolePerms] = useState(_rolePermissionsCache);
  const [permsLoaded, setPermsLoaded] = useState(!!_rolePermissionsCache);

  // 역할별 모듈 권한 로드
  useEffect(() => {
    if (!token || loading) return;
    fetchRolePermissions(token).then(data => {
      setRolePerms(data);
      setPermsLoaded(true);
    });
  }, [token, loading]);

  // 모듈 접근 로깅
  useEffect(() => {
    if (!user || !token || loading) return;
    const path = location.pathname;
    if (path === lastLoggedPath.current) return;
    lastLoggedPath.current = path;

    const moduleName = MODULE_NAMES[path];
    if (!moduleName) return;

    fetch(`${API_BASE_URL}/auth/access-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: 'MODULE_ACCESS',
        module: path,
        module_name: moduleName,
      }),
    }).catch(() => {});
  }, [location.pathname, user, token, loading]);

  // 로딩 중일 때
  if (loading) {
    return (
      <LoadingContainer>
        <LoadingWrapper>
          <LoadingSpinner />
          <LoadingText>로딩 중...</LoadingText>
        </LoadingWrapper>
      </LoadingContainer>
    );
  }

  // 인증되지 않은 경우 로그인 페이지로 리다이렉트
  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 권한 체크
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = user?.role || 'user';
    const isAdmin = user?.is_admin;

    if (!isAdmin && !allowedRoles.includes(userRole)) {
      return (
        <AccessDeniedContainer>
          <AccessDeniedCard>
            <AccessDeniedIcon>
              <ShieldOff size={40} />
            </AccessDeniedIcon>
            <AccessDeniedTitle>접근 권한이 없습니다</AccessDeniedTitle>
            <AccessDeniedMessage>
              이 페이지에 접근하기 위한 권한이 없습니다.<br />
              관리자에게 문의하세요.
            </AccessDeniedMessage>
            <BackButton onClick={() => window.history.back()}>
              이전 페이지로 돌아가기
            </BackButton>
          </AccessDeniedCard>
        </AccessDeniedContainer>
      );
    }
  }

  // 역할별 모듈 접근 권한 체크 (admin은 항상 통과)
  const isAdmin = user?.is_admin || user?.role === 'admin';
  if (!isAdmin && permsLoaded && rolePerms) {
    const path = location.pathname;
    const userRole = user?.role || 'user';
    const rolePerm = rolePerms[userRole];
    if (rolePerm && path in rolePerm && rolePerm[path] === false) {
      const moduleName = MODULE_NAMES[path] || path;
      return (
        <AccessDeniedContainer>
          <AccessDeniedCard>
            <AccessDeniedIcon>
              <ShieldOff size={40} />
            </AccessDeniedIcon>
            <AccessDeniedTitle>모듈 접근이 제한되었습니다</AccessDeniedTitle>
            <AccessDeniedMessage>
              "{moduleName}" 모듈에 대한 접근 권한이 없습니다.<br />
              관리자에게 문의하세요.
            </AccessDeniedMessage>
            <BackButton onClick={() => window.history.back()}>
              이전 페이지로 돌아가기
            </BackButton>
          </AccessDeniedCard>
        </AccessDeniedContainer>
      );
    }
  }

  // 인증된 경우 자식 컴포넌트 렌더링
  return children;
};

export default ProtectedRoute;
