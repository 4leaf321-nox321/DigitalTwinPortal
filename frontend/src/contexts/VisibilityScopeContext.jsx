import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';

const VisibilityScopeContext = createContext(null);

const SCOPE_STORAGE_KEY = 'visibilityScope';
// 보기 모드:
//   'public'  : 전사 공개 과제만 (BU-only 제외)
//   'bu_only' : 사업부 내 공개 과제만 (지정된 사업부)
//   'bu_all'  : 전사 공개 + 사업부 내 공개 (지정된 사업부)
const VALID_MODES = ['public', 'bu_only', 'bu_all'];

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const readInitialScope = () => {
  try {
    const stored = localStorage.getItem(SCOPE_STORAGE_KEY);
    if (!stored) return { mode: 'public', division: null };
    // 레거시 문자열 마이그레이션
    if (stored === 'public') return { mode: 'public', division: null };
    if (stored === 'bu') return { mode: 'bu_all', division: null };
    const parsed = JSON.parse(stored);
    if (parsed && VALID_MODES.includes(parsed.mode)) {
      return {
        mode: parsed.mode,
        division: parsed.division || null,
      };
    }
  } catch (_) { /* ignore */ }
  return { mode: 'public', division: null };
};

export const useVisibilityScope = () => {
  const ctx = useContext(VisibilityScopeContext);
  if (!ctx) throw new Error('useVisibilityScope must be used within VisibilityScopeProvider');
  return ctx;
};

export const VisibilityScopeProvider = ({ children }) => {
  const { user } = useAuth();
  const [{ mode, division }, setScopeState] = useState(readInitialScope);
  const [divisions, setDivisions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const persist = useCallback((next) => {
    try { localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify(next)); } catch (_) { /* ignore */ }
  }, []);

  const setMode = useCallback((nextMode) => {
    if (!VALID_MODES.includes(nextMode)) return;
    setScopeState(prev => {
      const next = { ...prev, mode: nextMode };
      persist(next);
      return next;
    });
  }, [persist]);

  const setDivision = useCallback((nextDivision) => {
    setScopeState(prev => {
      const next = { ...prev, division: nextDivision || null };
      persist(next);
      return next;
    });
  }, [persist]);

  const setScope = useCallback((next) => {
    if (!next || !VALID_MODES.includes(next.mode)) return;
    const value = { mode: next.mode, division: next.division || null };
    setScopeState(value);
    persist(value);
  }, [persist]);

  // 사업부/부서 매핑 로드 (로그인 사용자만)
  useEffect(() => {
    if (!user) {
      setDivisions([]);
      setDepartments([]);
      setLoaded(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(`${API_BASE_URL}/digital-twin-dashboard/settings`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        if (cancelled) return;
        if (json.success && json.data) {
          setDivisions(json.data.divisions || []);
          setDepartments(json.data.departments || []);
        }
      } catch (err) {
        console.error('[VisibilityScope] settings load failed:', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  const isAdmin = !!(user?.is_admin || user?.role === 'admin');

  // 현재 사용자의 사업부 이름 (user.department -> Department -> Division.name)
  const userDivisionName = useMemo(() => {
    if (!user?.department) return null;
    const deptName = user.department.trim();
    if (!deptName) return null;
    const dept = departments.find(d => (d.name || '').trim() === deptName);
    if (!dept || !dept.divisionId) return null;
    const div = divisions.find(d => String(d.id) === String(dept.divisionId));
    return div ? div.name : null;
  }, [user, departments, divisions]);

  // 필터에 실제 적용되는 사업부:
  //   - Admin: 사용자가 명시 선택한 division (null = 전체 사업부)
  //   - 비Admin: 자동으로 본인 사업부 (저장된 division 무시)
  const effectiveDivision = useMemo(() => {
    if (isAdmin) return division; // null이면 "전체 사업부"
    return userDivisionName;
  }, [isAdmin, division, userDivisionName]);

  // 단일 과제의 가시 여부 판단
  const isProjectVisible = useCallback((project) => {
    if (!project) return false;
    const isBuOnly = !!(project.사업부내공개여부);

    if (mode === 'public') {
      return !isBuOnly;
    }

    if (mode === 'bu_only') {
      if (!isBuOnly) return false;
      if (isAdmin && !effectiveDivision) return true; // 관리자: 전체 사업부의 BU-only
      if (!effectiveDivision) return false;
      return project.사업부 === effectiveDivision;
    }

    // mode === 'bu_all'
    if (!isBuOnly) return true;
    if (isAdmin && !effectiveDivision) return true;
    if (!effectiveDivision) return false;
    return project.사업부 === effectiveDivision;
  }, [mode, isAdmin, effectiveDivision]);

  const filterProjects = useCallback((projects) => {
    if (!Array.isArray(projects)) return projects;
    return projects.filter(isProjectVisible);
  }, [isProjectVisible]);

  const value = useMemo(() => ({
    mode,
    division,            // 저장된 사업부 (admin만 의미 있음)
    effectiveDivision,   // 실제 필터에 쓰이는 사업부
    setMode,
    setDivision,
    setScope,
    isAdmin,
    userDivisionName,
    divisions,
    departments,
    loaded,
    isProjectVisible,
    filterProjects,
  }), [
    mode, division, effectiveDivision, setMode, setDivision, setScope,
    isAdmin, userDivisionName, divisions, departments, loaded,
    isProjectVisible, filterProjects,
  ]);

  return (
    <VisibilityScopeContext.Provider value={value}>
      {children}
    </VisibilityScopeContext.Provider>
  );
};

export default VisibilityScopeContext;
