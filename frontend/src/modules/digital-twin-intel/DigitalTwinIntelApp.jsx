/**
 * 디지털 트윈 기술정보 — 바깥 소식과 기술 레이더를 한자리에서.
 *
 * 왜 두 탭이 한 모듈인가
 *     **소식이 기술의 근거다.** 「NVIDIA 가 Omniverse 에 X 를 발표」는 기술
 *     'Omniverse' 의 상태를 움직이는 증거다. 갈라 놓으면 그 연결이 모듈 사이
 *     배관이 되고, 배관이 되는 순간 아무도 안 잇는다.
 *
 * ⚠️⚠️ **이 자리는 세 번 시도됐다가 세 번 다 죽었다.** `tech_radar` ·
 *    `tech_archive` · `digital_twin_solution` 이 전부 "환영합니다!" 템플릿인 채로
 *    남아 있다(2026-08-25 확인). 기능이 모자라서가 아니라 **기술 목록이 아무의
 *    일도 아니어서**다. 그래서 이 화면은 레이더를 따로 채우게 하지 않는다 —
 *    소식을 등록할 때 그 자리에서 기술이 만들어지고 이어진다.
 *
 * ⚠️ 낡음 판정·단계 목록·분류 목록은 **서버가 준다.** 화면이 자기 표를 들면 반드시
 *    서버와 갈리고, 그러면 화면은 초록인데 서버는 빨간 상태가 된다.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { Search, AlertCircle, Loader2, Radar as RadarIcon, List, AlertTriangle,
  Network }
  from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import Header from './components/Layout/Header';
import NewsList from './components/NewsList';
import RadarBoard, { STAGES } from './components/RadarBoard';
import NewsModal from './components/NewsModal';
import TechModal from './components/TechModal';
import TechFormModal from './components/TechFormModal';
import DivisionSheet from './components/DivisionSheet';
import { keepTech, narrowMarks, onRadar, UNCATEGORIZED }
  from './utils/techFilter';
import CapabilityManagerModal from './components/CapabilityManagerModal';
import ToolManagerModal from './components/ToolManagerModal';
import RadarChart from './components/RadarChart';
import TechTree from './components/TechTree';
import NewsDetailModal from './components/NewsDetailModal';
import NewsEditModal from './components/NewsEditModal';
import OverviewBar from './components/OverviewBar';
import CompareModal from './components/CompareModal';
import api from './services/api';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f8fafc;
`;

/*
  ⚠️ 레이더 보기일 때는 **바깥이 안 흐른다**(`$fixed`). 그림에 스크롤이 생기면
     아래가 잘려 「우리가 어디까지 왔나」를 한눈에 보는 값이 사라진다.
     넘치는 것은 우측 기술 목록 **안에서만** 흐른다.
  ⚠️ `min-height: 0` 이 있어야 flex 자식이 내용만큼 부풀지 않는다 — 빠지면
     `overflow: hidden` 을 걸어도 안쪽이 부모를 밀어내 결국 잘린다.
*/
const Scroller = styled.main`
  flex: 1;
  min-height: 0;
  overflow: ${(p) => (p.$fixed ? 'hidden' : 'auto')};
  display: ${(p) => (p.$fixed ? 'flex' : 'block')};
`;

/*
  레이더는 **가로를 다 쓴다.** 가운데 1600px 상자에 가두면 그림이 좁아지고 오른쪽
  목록이 화면 한가운데 떠 있게 된다 — 목록은 오른쪽 끝에 붙어야 눈이 안 헤맨다.
  소식ㆍ목록 보기는 좁게 둔다. 글줄이 화면 끝까지 늘어나면 못 읽는다.

  ⚠️⚠️ **그 둘을 한 컴포넌트로 둔다**(2026-08-26 점검). 예전에는 둘을
     따로 만들어 `fixed ? WideContent : Content` 로 갈아 끼웠는데, `fixed` 가
     `!loading` 을 보고 있어서 **다시 읽을 때마다 종류가 바뀌었다.** 종류가 바뀌면
     React 는 그 밑을 통째로 새로 만든다 — 레이더의 확대ㆍ이동이 매번 풀렸다.
*/
const Content = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;

  ${(p) => (p.$fixed ? `
    min-height: 0;
    flex: 1;
    padding: 0.75rem 1rem 1rem;
    gap: 0.625rem;
  ` : `
    max-width: 1600px;
    margin: 0 auto;
    padding: 1.25rem 2rem 2rem;
    gap: 0.875rem;

    @media (max-width: 900px) { padding: 1rem; }
  `)}
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
`;

const SearchBox = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #fff;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  padding: 0.375rem 0.625rem;
  min-width: 16rem;

  input {
    border: none;
    outline: none;
    font-size: 0.8125rem;
    flex: 1;
    color: #0f172a;
  }
`;

/* 레이더 그림 / 칸 목록 전환. 둘 다 쓸모가 달라 하나를 고를 이유가 없다 —
   그림은 **두 축을 한눈에**, 목록은 **훑고 고르기**에 낫다. */
const StaleBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4375rem 0.625rem;
  border: 1px solid ${(p) => (p.$on ? '#f59e0b' : '#cbd5e1')};
  background: ${(p) => (p.$on ? '#fffbeb' : '#fff')};
  color: ${(p) => (p.$on ? '#92400e' : '#475569')};
  border-radius: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
`;

const ViewToggle = styled.div`
  display: flex;
  gap: 0.125rem;
  background: #eef2ff;
  padding: 0.125rem;
  border-radius: 0.5rem;
  margin-left: auto;
`;

const ViewBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3125rem 0.625rem;
  border: none;
  border-radius: 0.4375rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  background: ${(p) => (p.$on ? '#fff' : 'transparent')};
  color: ${(p) => (p.$on ? '#4338ca' : '#6366f1')};
`;

const Select = styled.select`
  padding: 0.4375rem 0.625rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  background: #fff;
  color: #334155;
`;

const State = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4375rem;
  padding: 2.5rem 1rem;
  justify-content: center;
  color: ${(p) => (p.$error ? '#b91c1c' : '#94a3b8')};
  font-size: 0.875rem;

  svg { animation: ${(p) => (p.$error ? 'none' : 'spin 1s linear infinite')}; }
  @keyframes spin { to { transform: rotate(360deg); } }
`;

/* 툴바를 뺀 나머지 높이를 레이더에 통째로 넘긴다. */
const RadarSlot = styled.div`
  flex: 1;
  min-height: 0;
`;

const MergeBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.75rem;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  color: #92400e;
  line-height: 1.6;

  button {
    margin-left: auto;
    flex-shrink: 0;
    border: 1px solid #fbbf24;
    background: #fff;
    color: #92400e;
    border-radius: 0.375rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
    cursor: pointer;
  }
`;

/*
  사업부 눈으로 보는 중이라는 띠. ⚠️ **경고가 아니라 안내**라 색을 다르게 뒀다 —
  합치기 띠(노랑)와 같은 색이면 「무언가 잘못됐나」로 읽힌다.
*/
const LensBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.75rem;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  color: #3730a3;
  line-height: 1.6;

  b { font-weight: 700; }
  em { font-style: normal; font-weight: 700; }

  button {
    margin-left: auto;
    flex-shrink: 0;
    border: 1px solid #a5b4fc;
    background: #fff;
    color: #3730a3;
    border-radius: 0.375rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
    cursor: pointer;
    white-space: nowrap;
  }
`;

const Toast = styled.div`
  position: fixed;
  left: 50%;
  bottom: 2rem;
  transform: translateX(-50%);
  background: #0f172a;
  color: #fff;
  padding: 0.625rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  z-index: 1200;
  max-width: 32rem;
  line-height: 1.6;
`;

const DigitalTwinIntelApp = ({ onGoHome }) => {
  const { user } = useAuth();
  // 단계 변경·삭제·설정은 관리자·사무국만. **서버가 최종 판정**이고 여기서는
  // 누를 수 없는 것을 안 보이게만 한다 — 화면만 막으면 막은 것이 아니다.
  // ⚠️ 역할 문자열은 `dt_office` 다 — 모델 상수 이름(DT_OFFICE_MEMBER)과 다르다.
  /*
    ⚠️⚠️ **서버와 **글자까지** 같아야 한다**(2026-08-26 점검). 서버는
       `CURATOR_ROLES = (ADMIN, DT_OFFICE_MEMBER)` 만 본다. 여기에 옛 `is_admin` 칸을
       더해 두었더니, 그 칸만 켜진 옛 계정에게 **단추는 보이는데 누르면 403** 이
       났다. 못 하는 일을 보여주는 것이 안 보여주는 것보다 나쁘다.
  */
  const canCurate = ['admin', 'dt_office'].includes(user?.role);
  /*
    ⚠️ **읽을 수 있으면 쓸 수 있다**(서버의 `can_write` 가 곧 `can_read` 다).
       기술을 넣고 매다는 것은 **판단이 아니라 정리**라서 좁히지 않았다 — 여기서
       막으면 도구가 영영 미아로 남고, 미아는 어느 사업부 표에도 안 나온다.
       좁혀 둔 것은 단계 변경ㆍ삭제(`canCurate`)뿐이다.
  */
  const canWrite = true;

  const [tab, setTab] = useState('news');
  const [news, setNews] = useState([]);
  const [tech, setTech] = useState([]);
  // 사업부 눈에 안 걸린 한 벌. **관리 창 전용**이다(위 `load` 참고).
  const [techAll, setTechAll] = useState([]);
  const [settings, setSettings] = useState({ newsCategories: [], techCategories: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);

  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState('');
  // ⚠️ 낡음 판정은 **서버가 준다**(단계마다 기준 일수가 다르다). 여기서는 그 표시를
  //    걸러 보기만 한다 — 판정 규칙을 화면에 복제하면 반드시 서버와 갈린다.
  const [staleOnly, setStaleOnly] = useState(false);
  /*
    사업부. ⚠️⚠️ **탭마다 뜻이 다르다.**

      소식 탭 — 그 사업부 이야기만 **걸러 본다**(소식에 붙은 사업부 표).
      기술 탭 — 그 사업부 **눈으로 다시 그린다.** 거르는 것이 아니다.

    ⚠️ 기술에서 「관련된 것만」으로 거르지 않는 이유 — 묻고 싶은 것은 「우리 사업부는
       어디까지 왔나」이지 「우리와 관련된 것만」이 아니다. 관련 없는 것은 기본 설정 값
       그대로 서면 되고, 그게 더 정확하다.
  */
  const [division, setDivision] = useState('');

  const [toolsOpen, setToolsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [capsOpen, setCapsOpen] = useState(false);
  /*
    레이더가 「최근 며칠」의 이동을 볼지.

    ⚠️⚠️ **이 값은 서버가 쥐고 세므로 여기서 들고 다시 물어야 한다** — 사업부 눈과
       같은 모양이다. 화면이 따로 재면 화살표ㆍ테ㆍ범례가 서로 다른 기간을 말하게
       되고, 그 순간 셋 다 못 믿게 된다.
    ⚠️ 0 이면 「아직 서버 기본값을 모른다」는 뜻이다 — 설정을 받고 나서 채운다.
       처음부터 90 을 박으면 서버가 기본을 바꿔도 화면만 옛 값으로 물어보게 된다.
    ⚠️ 고른 값은 기억한다(브라우저별ㆍ사람별 취향이라 서버에 둘 것이 아니다).
  */
  const MOVED_KEY = 'dtIntel.radarMovedDays';
  const [movedDays, setMovedDays] = useState(() => {
    try {
      const v = Number(window.localStorage.getItem(MOVED_KEY));
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch {
      return 0;
    }
  });
  const [techView, setTechView] = useState('radar');   // radar | tree | board
  // 목록에서 층을 걸러 본다. '' 면 둘 다. ⚠️ 레이더에는 안 건다 — 레이더가 그리는
  // 것은 이미 「역량 + 안 매달린 도구」로 정해져 있다.
  const [kind, setKind] = useState('');
  const [openNews, setOpenNews] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(null);
  // `null` 이면 닫힘. `{}` 면 새로 만들기, 기술 객체면 그것을 고치기.
  const [techForm, setTechForm] = useState(null);
  const [newsEdit, setNewsEdit] = useState(null);
  // 합칠 대상을 고르는 중인 기술. null 이면 안 고르는 중.
  const [merging, setMerging] = useState(null);
  const [overview, setOverview] = useState(null);
  // 「무엇을 봐야 하나」에서 고른 것. 목록 거르기와 맞물린다.
  const [focus, setFocus] = useState('');
  // 견줄 기술 두 개. 하나만 고른 상태로 기다린다.
  const [compareA, setCompareA] = useState(null);
  const [compareB, setCompareB] = useState(null);

  /*
    ⚠️ **앞 시계를 끄고 새로 잰다**(2026-08-26 점검). 안 끄면 먼저 걸어 둔 시계가
       나중 안내를 지운다 — 두 번째 안내가 1초 만에 사라지는 일이 났다.
  */
  const toastTimer = useRef(null);
  const say = useCallback((msg) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let fresh = null;
    try {
      /*
        ⚠️⚠️ **사업부 눈으로 푸는 일은 서버가 한다.** 화면이 기본 설정 값과 사업부 값 중
           무엇을 그릴지 고르게 하면 레이더ㆍ목록ㆍ상세가 서로 다른 것을 그리게
           되고, 낡음 기준(단계마다 다르다)과 이동 화살표까지 갈린다. 낡음 판정을
           서버에 둔 것과 **같은 이유**다 — 고르는 일은 한 곳에서 한 번만.
      */
      const q = {};
      if (division) q.division = division;
      if (movedDays) q.movedDays = movedDays;
      /*
        ⚠️⚠️ **관리 창은 눈에 안 걸린 목록을 봐야 한다**(2026-08-26 신고). 사업부
           눈일 때 서버는 `divisionMarks` 를 **안 싣는다**(그 눈에서는 남의 점이
           널리면 안 되니까). 그런데 「역량 관리」는 그 값으로 「누가 적었나」를
           말하므로, MX 눈으로 열면 63개 전부가 「아무도 안 적었습니다」가 됐다 —
           레이더에는 점이 버젓이 찍혀 있는데. 그래서 눈이 걸렸을 때만 한 벌 더
           불러 관리 창에 준다.
      */
      const [n, t, s, o, all] = await Promise.all([
        api.listNews(), api.listTech(q), api.getSettings(),
        // ⚠️ 요약도 **레이더와 같은 기간ㆍ같은 눈**을 봐야 한다(위 참고).
        api.overview(movedDays, division),
        division ? api.listTech({}) : Promise.resolve(null),
      ]);
      setNews(n || []);
      setTech(t || []);
      setTechAll(all || t || []);
      // ⚠️ 새로 읽은 줄을 돌려준다 — 열려 있는 창이 자기 것을 다시 집을 수 있게.
      fresh = t || [];
      setSettings(s || {});
      setOverview(o || null);
    } catch (e) {
      setError(e.message || '불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
    return fresh;
  }, [division, movedDays]);

  useEffect(() => { load(); }, [load]);

  // 거르기는 화면에서 한다 — 목록이 수백 건 규모라 왕복할 이유가 없다.
  const shownNews = useMemo(() => {
    const key = q.trim().toLowerCase();
    return news.filter((n) => {
      // ⚠️ 숫자를 보여만 주고 찾아가게 하면 아무도 안 간다. 누르면 **그 줄만** 남는다.
      if (division && !(n.divisions || []).includes(division)) return false;
      if (focus === 'unread' && n.status !== '신규') return false;
      if (focus === 'unlinked' && (n.linkCount || 0) > 0) return false;
      if (category && n.category !== category) return false;
      if (status && n.status !== status) return false;
      if (!key) return true;
      return [n.title, n.summary, n.source]
        .some((v) => (v || '').toLowerCase().includes(key));
    });
  }, [news, q, category, status, focus, division]);

  /*
    ⚠️⚠️ **거르는 규칙은 `utils/techFilter` 가 정본이다.** 여기 박아 두었더니 검사가
       규칙을 **복사해** 들고 있었고, 그러면 화면이 틀려도 검사는 자기 복사본을 보고
       통과한다 — 실제로 「도입」을 눌러도 아무것도 안 남는 흠을 검사가 못 잡았다.
  */
  const shownTech = useMemo(
    () => tech.filter((t) => keepTech(t, {
      q, category, stage, kind, staleOnly, focus, radar: techView === 'radar',
    })),
    [tech, q, category, stage, staleOnly, focus, kind, techView]);

  // 머리글 탭에 붙는 수. **요약 막대와 같은 규칙**(역량 + 안 매단 도구)이다.
  const radarCount = useMemo(() => tech.filter(onRadar).length, [tech]);

  // 관리 창이 보는 것. ⚠️ 눈이 안 걸렸으면 `tech` 가 곧 전부다.
  const managerTech = division ? techAll : tech;

  // 고른 단계의 사업부만 남긴 것. 그리는 쪽은 이걸 본다.
  const lensedTech = useMemo(
    () => narrowMarks(shownTech, stage), [shownTech, stage]);

  // 기본 설정과 다르게 정한 것이 몇 개인가. **이 숫자가 사업부별 보기의 답이다.**
  /*
    ⚠️⚠️ **거르기 앞의 수를 센다**(2026-08-26 점검). `shownTech` 를 세면 무엇을 걸러
       놓았느냐에 따라 「아직 하나도 안 적었습니다」가 떴다 — 적어 둔 것이 버젓이
       있는데도. 이 띠는 **그 사업부가 얼마나 적었나**를 말하는 자리다.
  */
  const overrideCount = useMemo(
    () => tech.filter((t) => t.isDivisionOverride).length, [tech]);

  /*
    아직 어느 역량에도 안 매달린 도구. ⚠️ **이 수가 곧 할 일이다** — 그 도구들은
    레이더에는 혼자 서지만 **어느 사업부 표에도 안 나온다.** 화면 어디에도 그
    사실이 안 보이면 아무도 안 매달고, 사업부 단계의 도구는 영영 빈칸으로 남는다.
  */
  const orphanCount = useMemo(
    () => tech.filter((t) => t.kind !== 'capability'
                             && !(t.capabilityUuids || []).length).length,
    [tech]);

  // 도구를 매달 곳. 이름 차례는 서버가 준 그대로다.
  const capabilities = useMemo(
    () => tech.filter((t) => t.kind === 'capability'), [tech]);

  const saveNews = async (body) => {
    setSaving(true);
    try {
      await api.createNews(body);
      setAddOpen(false);
      // ⚠️ 소식 하나가 레이더까지 바꾼다(기술이 새로 생기거나 근거가 붙는다).
      //    소식 목록만 다시 읽으면 레이더가 낡은 채로 남는다.
      await load();
      say('등록했습니다. 적어 둔 기술은 레이더에 함께 올라갔습니다.');
    } catch (e) {
      say(e.message);
    } finally {
      setSaving(false);
    }
  };

  /*
    기술 저장. **창 하나가 등록과 편집을 겸한다** — 칸이 같아서 둘로 나눌 이유가 없다.

    ⚠️ 예전에는 `window.prompt` 로 이름만 받았다. 그러면 레이더에 이름만 적힌 줄이
       쌓이는데, 그건 목록이지 참고 자료가 아니다.
  */
  const saveTech = async (body) => {
    const editing = techForm && techForm.uuid;
    setSaving(true);
    try {
      /*
        ⚠️ **상위는 전용 길(`PUT .../parent`)로 따로 보낸다.** 고리ㆍ층 검사가
           거기 붙어 있어서, 일반 수정에 얹으면 그 검사를 우회하는 길이 하나 더
           생긴다. 만들기(POST)는 상위를 함께 받으므로 그때는 안 보낸다.
      */
      const { capabilityUuids, ...rest } = body;
      if (editing) {
        await api.updateTech(techForm.uuid, rest);
        const before = (techForm.capabilityUuids || []).slice().sort().join();
        const after = (capabilityUuids || []).slice().sort().join();
        if (before !== after) {
          await api.setTechCapabilities(techForm.uuid, capabilityUuids);
        }
      }
      let made = null;
      if (!editing) {
        /*
          ⚠️⚠️ **이미 있는 이름이면 서버가 있던 줄을 돌려준다** — 새로 안 만든다.
             예전에는 그때도 「레이더에 올렸습니다」라고 해서, 적어 넣은 것이
             전부 버려졌는데 올라간 줄 알게 했다(2026-08-26 점검).
        */
        made = await api.createTech(body);
      }
      setTechForm(null);
      setSelected(null);
      await load();
      if (editing) say('고쳤습니다.');
      else if (made && made.created === false) {
        say(`「${body.name}」 은 이미 레이더에 있습니다 — 적은 것은 안 담겼습니다.`);
      } else say(`「${body.name}」 을 레이더에 올렸습니다.`);
    } catch (e) {
      say(e.message);
    } finally {
      setSaving(false);
    }
  };

  const saveNewsEdit = async (body) => {
    setSaving(true);
    try {
      await api.updateNews(newsEdit.uuid, body);
      setNewsEdit(null);
      setOpenNews(null);
      await load();
      say('고쳤습니다.');
    } catch (e) {
      say(e.message);
    } finally {
      setSaving(false);
    }
  };

  /*
    합치기. **되돌릴 수 없다** — 고른 쪽이 지워지고 근거·연결이 옮겨간다.
    ⚠️ 그래서 두 번 묻는다: 어느 것에 합칠지 고르게 하고, 그다음 확인한다.
  */
  const doMerge = async (into) => {
    const from = merging;
    if (!from || from.uuid === into.uuid) { setMerging(null); return; }
    if (!window.confirm(
      `「${from.name}」 를 「${into.name}」 에 합칩니다.\n\n`
      + `「${from.name}」 는 지워지고 근거·연결이 옮겨갑니다. `
      + '되돌릴 수 없습니다.')) return;
    try {
      await api.mergeTech(from.uuid, into.uuid);
      setMerging(null);
      setSelected(null);
      await load();
      say(`「${from.name}」 를 「${into.name}」 에 합쳤습니다. 지운 이름은 별칭으로 남습니다.`);
    } catch (e) {
      say(e.message);
    }
  };

  /*
    「무엇을 봐야 하나」에서 고르면 **탭까지 옮겨 준다.** 소식 셈은 소식 탭에서,
    기술 셈은 레이더에서만 뜻이 있다 — 안 옮기면 눌러도 아무 일이 안 일어난 것처럼
    보인다.
  */
  /*
    ⚠️ 요약 막대는 이제 **지금 탭에서 볼 수 있는 것만** 띄우므로, 탭을 옮길 일은
       사실 없다. 그래도 남겨 둔다 — 나중에 딴 데서 이 길을 부르게 되면 그때
       엉뚱한 탭에 필터만 걸리는 일이 생긴다.
  */
  const pickFocus = (key) => {
    setFocus(key);
    if (!key) return;
    setTab(['unread', 'unlinked'].includes(key) ? 'news' : 'tech');
    setStaleOnly(false);
  };

  const openTechByRef = (ref) => {
    const full = tech.find((t) => t.uuid === ref.uuid);
    setTab('tech');
    setSelected(full || ref);
  };

  /*
    견주기. 하나를 고르면 두 번째를 고르게 한다.
    ⚠️ 같은 것을 두 번 고르면 아무 뜻이 없으므로 그냥 취소한다.
  */
  const pickCompare = (t) => {
    if (!compareA) { setSelected(null); setCompareA(t); return; }
    if (compareA.uuid === t.uuid) { setCompareA(null); return; }
    setCompareB(t);
  };

  const removeNews = async (n) => {
    if (!window.confirm(`「${n.title}」 을 지웁니다. 되돌릴 수 없습니다.`)) return;
    try {
      await api.deleteNews(n.uuid);
      await load();
      say('소식을 지웠습니다.');
    } catch (e) {
      say(e.message);
    }
  };

  const removeTech = async (t) => {
    if (!window.confirm(`「${t.name}」 을 레이더에서 지웁니다. 근거도 함께 사라집니다.`)) return;
    try {
      await api.deleteTech(t.uuid);
      setSelected(null);
      await load();
      say('기술을 지웠습니다.');
    } catch (e) {
      say(e.message);
    }
  };

  // 레이더 보기일 때만 가로를 다 쓰고, 바깥 스크롤을 끈다. `as` 로 갈아끼우지 않고
  // 컴포넌트를 직접 고른다 — 그 편이 무엇이 그려지는지 한눈에 보인다.
  // ⚠️ `loading` 을 안 본다 — 보면 다시 읽을 때마다 레이더가 새로 태어난다(위 참고).
  const fixed = tab === 'tech' && techView === 'radar' && !error;

  /*
    고를 수 있는 사업부.

    ⚠️⚠️ **기술 탭에서는 포털의 사업부 전부**를 준다. 「자료에 적힌 것만」은
       **거르기**의 규칙이지 **눈으로 보기**의 규칙이 아니다 — MX 로 표시된 기술이
       하나도 없어도 MX 는 자기 눈으로 볼 수 있어야 하고, 오히려 그때가 가장
       먼저 봐야 하는 화면이다.

    ⚠️ 소식 탭에서는 옛 규칙 그대로 — 거기서는 진짜로 거르는 것이라, 골라도 빈
       화면이 되는 칸을 만들면 안 된다.
    ⚠️ 설정 차례를 따르되 설정에 없는 이름도 뒤에 붙인다(중복은 뺀다 — 사업부 표에
       같은 이름이 여러 줄일 수 있다).
  */
  const divisionOptions = useMemo(() => {
    const all = [...new Set(settings.divisions || [])];
    if (tab === 'tech') return all;
    const used = new Set();
    [...news, ...tech].forEach((r) => (r.divisions || []).forEach((d) => used.add(d)));
    const ordered = all.filter((d) => used.has(d));
    used.forEach((d) => { if (!ordered.includes(d)) ordered.push(d); });
    return ordered;
  }, [news, tech, settings.divisions, tab]);

  /*
    ⚠️ **「분류 없음」도 고를 수 있어야 한다**(2026-08-26 점검). 레이더는 분야 없는
       줄을 그 이름의 부채꼴에 그리고, 그 이름을 누르면 거르기가 그 값으로 걸린다 —
       그런데 고르개에 그 칸이 없으면 **무엇이 걸렸는지 안 보이고 되돌릴 수도 없다.**
  */
  const categoryOptions = useMemo(() => {
    if (tab === 'news') return settings.newsCategories || [];
    const all = [...(settings.techCategories || [])];
    if (tech.some((t) => !t.category) && !all.includes(UNCATEGORIZED)) {
      all.push(UNCATEGORIZED);
    }
    return all;
  }, [tab, settings.newsCategories, settings.techCategories, tech]);

  return (
    <Container>
      <Header
        tab={tab}
        /*
          ⚠️⚠️ **사업부도 함께 푼다**(2026-08-26 점검). 탭마다 고를 수 있는 사업부가
             다르다 — 소식 쪽은 **자료에 실제로 적힌 것**만 목록에 세운다. 기술 탭에서
             고른 사업부를 들고 소식 탭으로 넘어가면, 그 사업부가 목록에 없어
             **고르개에서 그 값을 되돌릴 수가 없고** 소식은 0건이 된다. 분류ㆍ단계와
             같은 잣대로 함께 푼다.
        */
        onTab={(t) => { setTab(t); setCategory(''); setStage(''); setDivision(''); }}
        newsCount={news.length}
        /* ⚠️ 요약 막대와 **같은 수**여야 한다 — 한 화면에 두 숫자가 뜨면 둘 다
           못 믿게 된다. 레이더에 서는 줄만 센다. */
        techCount={radarCount}
        onAdd={() => (tab === 'news' ? setAddOpen(true) : setTechForm({}))}
        onTools={() => setToolsOpen(true)}
        onSheet={() => setSheetOpen(true)}
        onCaps={() => setCapsOpen(true)}
        orphanCount={orphanCount}
        canCurate={canCurate}
        onGoHome={onGoHome}
      />

      <Scroller $fixed={fixed}>
        <Content $fixed={fixed}>
          <OverviewBar data={overview} active={focus} onPick={pickFocus} tab={tab} />

          {compareA && !compareB && (
            <MergeBar>
              <span>
                <b>「{compareA.name}」 와 견줄 기술</b>을 하나 더 고르세요.
              </span>
              <button type="button" onClick={() => setCompareA(null)}>그만두기</button>
            </MergeBar>
          )}

          <Toolbar>
            <SearchBox>
              <Search size={15} color="#94a3b8" />
              <input value={q} onChange={(e) => setQ(e.target.value)}
                     placeholder={tab === 'news' ? '제목·출처로 찾기' : '기술·공급사로 찾기'} />
            </SearchBox>

            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">{tab === 'tech' ? '분야 전체' : '분류 전체'}</option>
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>

            {/*
              ⚠️⚠️ **탭마다 고를 수 있는 사업부가 다르다.**

                 소식 — **자료에 실제로 적힌 것**만. 설정의 전체 사업부를 쓰면
                        골라도 빈 화면이 되는 칸이 생긴다.
                 기술 — **포털의 사업부 전부.** 여기서는 「그 사업부와 관련 있다고
                        적힌 것」을 거르는 게 아니라 **그 사업부 눈으로 다시
                        그리는** 것이라, 아직 아무것도 안 걸린 사업부도 골라야 한다
                        — 오히려 그 사업부가 가장 먼저 봐야 하는 화면이다.
            */}
            {divisionOptions.length > 0 && (
              <Select value={division} onChange={(e) => setDivision(e.target.value)}
                      title={tab === 'tech'
                        ? '그 사업부 눈으로 다시 그립니다 (거르지 않습니다)'
                        : '그 사업부와 관련 있다고 적힌 것만 봅니다'}>
                {/* ⚠️ 「기본 설정 기준」이 아니다 — 그런 것이 없어졌다. 사업부를 안
              고르면 **모든 사업부의 점**이 함께 보인다. */}
          <option value="">{tab === 'tech' ? '사업부 전체' : '사업부 전체'}</option>
                {divisionOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            )}

            {tab === 'news' && (
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">상태 전체</option>
                {(settings.newsStatuses || []).map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            )}

            {tab === 'tech' && (
              <Select value={stage} onChange={(e) => setStage(e.target.value)}>
                <option value="">단계 전체</option>
                {STAGES.map((s) => <option key={s.key} value={s.key}>{s.key}</option>)}
              </Select>
            )}

            {/* ⚠️ 낡음 표시가 있어도 **모아 보는 자리가 없으면** 하나씩 찾아다녀야 한다. */}
            {/*
              ⚠️⚠️ **같은 거르기를 상태 둘이 들고 있었다**(2026-08-26 점검). 요약
                 막대의 「낡음」을 누르면 `focus`, 이 단추는 `staleOnly` — 둘 다
                 낡은 것만 남긴다. 그래서 막대로 걸어 놓고 이 단추를 껐다 켜면
                 **아무 일도 안 일어나는 것처럼** 보였다. 하나로 여닫는다.
              ⚠️ JSX 주석은 `&&` 안에 못 넣는다 — 표현식이 둘이 되어 안 읽힌다.
            */}
            {tab === 'tech' && (
              <StaleBtn type="button" $on={staleOnly || focus === 'stale'}
                        onClick={() => {
                          if (focus === 'stale') setFocus('');
                          setStaleOnly((v) => (focus === 'stale' ? false : !v));
                        }}
                        title="근거가 오래 없어 다시 볼 때가 된 것만 봅니다">
                <AlertTriangle size={13} /> 낡은 것만
                {(staleOnly || focus === 'stale') ? ` (${shownTech.length})` : ''}
              </StaleBtn>
            )}

            {/* ⚠️ 레이더에는 안 붙인다 — 레이더가 그리는 것은 이미 정해져 있다. */}
            {tab === 'tech' && techView === 'board' && (
              <Select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">층 전체</option>
                <option value="capability">역량만</option>
                <option value="tool">도구만</option>
              </Select>
            )}

            {tab === 'tech' && (
              <ViewToggle>
                <ViewBtn $on={techView === 'radar'} onClick={() => setTechView('radar')}>
                  <RadarIcon size={13} /> 레이더
                </ViewBtn>
                {/*
                  ⚠️ **목록에는 포함관계가 안 보인다.** 단계별 네 칸이라 역량과 도구가
                     나란히 섞여 서고, 관계는 작은 글씨 하나뿐이다 — 600줄에서 그건
                     안 읽힌다(2026-08-25 신고). 계통은 그 관계를 그대로 편다.
                */}
                <ViewBtn $on={techView === 'tree'} onClick={() => setTechView('tree')}>
                  <Network size={13} /> 계통
                </ViewBtn>
                <ViewBtn $on={techView === 'board'} onClick={() => setTechView('board')}>
                  <List size={13} /> 목록
                </ViewBtn>
              </ViewToggle>
            )}
          </Toolbar>

          {/*
            ⚠️ **고르기의 뜻이 바뀌었다는 것을 말해 준다.** 안 말하면 「걸러진 줄
               알았는데 전부 그대로 있네」로 읽히고, 그러면 이 기능을 안 쓴다.
            ⚠️ **몇 개를 적었는지**가 이 화면의 답이다 — 그 숫자가 곧 「우리 사업부가
               어디까지 정리했나」다.
          */}
          {tab === 'tech' && division && !loading && !error && (
            <LensBar>
              <span>
                <b>{division}</b> 눈으로 봅니다 — 단계ㆍ낡음ㆍ이동이 모두 이 사업부가
                적은 것입니다
                {overrideCount > 0
                  ? ` (${overrideCount}개 적었습니다).`
                  : '. 아직 하나도 안 적어 레이더가 비어 있습니다 — 「사업부 적기」에서 적으세요.'}
              </span>
              <button type="button" onClick={() => setDivision('')}>전체로</button>
            </LensBar>
          )}

          {merging && (
            <MergeBar>
              <span>
                <b>「{merging.name}」 를 어디에 합칠까요?</b> 아래에서 <b>남길 기술</b>을
                고르세요. 「{merging.name}」 는 지워지고 근거·연결이 그쪽으로 옮겨갑니다.
              </span>
              <button type="button" onClick={() => setMerging(null)}>그만두기</button>
            </MergeBar>
          )}

          {loading && <State><Loader2 size={16} /> 불러오는 중…</State>}
          {!loading && error && <State $error><AlertCircle size={16} /> {error}</State>}

          {!loading && !error && tab === 'news' && (
            <NewsList rows={shownNews} onTechClick={openTechByRef}
                      onDelete={removeNews} onOpen={setOpenNews} canCurate={canCurate} />
          )}

          {fixed && (
            <RadarSlot>
              <RadarChart rows={lensedTech} categories={settings.techCategories}
                          movedOnly={focus === 'moved'}
                          onMovedOnlyChange={(on) => pickFocus(on ? 'moved' : '')}
                          onMovedWindowChange={(d) => {
                            // ⚠️ 기억해 둔다. 못 써도 그냥 넘어간다(시크릿 창 등).
                            try { window.localStorage.setItem(MOVED_KEY, String(d)); }
                            catch { /* 못 써도 그만 */ }
                            setMovedDays(d);
                          }}
                          onSelect={merging ? doMerge
                            : compareA && !compareB ? pickCompare : setSelected}
                          activeSector={category}
                          onSectorClick={setCategory}
                          movedWindowDays={movedDays || settings.movedWindowDays} />
            </RadarSlot>
          )}

          {!loading && !error && tab === 'tech' && techView === 'tree' && (
            <TechTree rows={lensedTech} all={tech}
                      categories={settings.techCategories}
                      onSelect={merging ? doMerge
                        : compareA && !compareB ? pickCompare : setSelected} />
          )}

          {!loading && !error && tab === 'tech' && techView === 'board' && (
            <RadarBoard rows={lensedTech}
                        onSelect={merging ? doMerge
                          : compareA && !compareB ? pickCompare : setSelected} />
          )}
        </Content>
      </Scroller>

      {/* ⚠️ 닫으면 트리에서 뺀다 — 안 그러면 방금 등록한 내용이 그대로 남아,
          다시 열었을 때 채워져 있는 것을 새로 적는 줄 알고 또 등록하게 된다. */}
      {addOpen && (
        <NewsModal isOpen onClose={() => setAddOpen(false)} onSave={saveNews}
                   categories={settings.newsCategories} saving={saving} />
      )}

      <TechModal tech={selected} onClose={() => setSelected(null)}
                 division={division} divisions={settings.divisions || []}
                 /*
                   ⚠️⚠️ **열려 있는 창의 자료도 갈아 끼운다**(2026-08-26 점검). 새로
                      읽어도 `selected` 는 옛 객체 그대로라, 사업부 단계를 담고 나서도
                      창 위쪽이 「아직 아무것도 안 적었습니다」로 남았다.
                 */
                 onDivisionChanged={async () => {
                   const rows = await load();
                   setSelected((p) => (p
                     ? (rows || []).find((t) => t.uuid === p.uuid) || p : p));
                   say('사업부 단계를 바꿨습니다.');
                 }}
                 onChanged={async () => { setSelected(null); await load(); say('단계를 바꿨습니다.'); }}
                 onDelete={removeTech}
                 onEdit={(t) => { setSelected(null); setTechForm(t); }}
                 onMerge={(t) => { setSelected(null); setMerging(t); }}
                 onOpenTech={(r) => openTechByRef(r)}
                 onCompare={pickCompare}
                 canCurate={canCurate} showError={say} />

      <CompareModal a={compareA} b={compareB}
                    onClose={() => { setCompareA(null); setCompareB(null); }}
                    onOpen={(t) => {
                      setCompareA(null); setCompareB(null); openTechByRef(t);
                    }} />

      {/*
        ⚠️ **여는 사업부는 지금 보고 있는 눈을 따른다.** 눈은 MX 로 놓고 표는 VD
           가 열리면, 적어 놓고 화면이 안 바뀌는 것처럼 보인다.
        ⚠️ `key` 로 다시 잡는다 — 닫았다 다른 사업부로 열면 앞엣것이 남는다.
      */}
      <DivisionSheet key={`${sheetOpen}:${division}`}
                     isOpen={sheetOpen} divisions={settings.divisions || []}
                     initial={division} canCurate={canCurate}
                     onClose={() => setSheetOpen(false)}
                     onSaved={async (n) => {
                       await load();
                       if (n) say(`${n}줄 담았습니다.`);
                     }}
                     showError={say} />

      {/*
        ⚠️⚠️ **닫으면 트리에서 뺀다**(2026-08-26 신고). `isOpen` 만 넘기면 창은
           안 보여도 **살아 있어서**, 저장 안 한 편집ㆍ치다 만 이름ㆍ고른 분야가
           그대로 남는다. 다시 열면 저장된 값처럼 보이고, 그 사이 남이 고쳤어도
           옛 초안으로 덮어쓴다. 도구 관리도 같았다(q·name·vendor·pick).
      */}
      {capsOpen && (
      <CapabilityManagerModal isOpen tech={managerTech}
                              categories={settings.techCategories}
                              cptGroups={settings.cptGroups}
                              canWrite={canWrite} canCurate={canCurate}
                              onClose={() => setCapsOpen(false)}
                              onChanged={async (msg) => { await load(); if (msg) say(msg); }}
                              showError={say} />
      )}

      {toolsOpen && (
      <ToolManagerModal isOpen tech={managerTech}
                        categories={settings.techCategories}
                        canWrite={canWrite} canCurate={canCurate}
                        onClose={() => setToolsOpen(false)}
                        onChanged={async (msg) => { await load(); if (msg) say(msg); }}
                        showError={say} />
      )}

      {/* `key` 로 초기값을 다시 잡는다 — 없으면 다른 기술을 열어도 앞엣것이 남는다. */}
      {techForm && (
        <TechFormModal
          key={techForm.uuid || 'new'}
          isOpen
          initial={techForm.uuid ? techForm : null}
          onClose={() => setTechForm(null)}
          onSave={saveTech}
          categories={settings.techCategories}
          cptGroups={settings.cptGroups}
          capabilities={capabilities}
          canCurate={canCurate}
          saving={saving}
        />
      )}

      <NewsDetailModal news={openNews} onClose={() => setOpenNews(null)}
                       onSaved={load}
                       onEdit={(n) => setNewsEdit(n)}
                       onTechClick={(t) => { setOpenNews(null); openTechByRef(t); }}
                       showError={say} />

      {newsEdit && (
        <NewsEditModal key={newsEdit.uuid} news={newsEdit}
                       statuses={settings.newsStatuses}
                       categories={settings.newsCategories}
                       onClose={() => setNewsEdit(null)}
                       onSave={saveNewsEdit} saving={saving} />
      )}

      {toast && <Toast>{toast}</Toast>}
    </Container>
  );
};

export default DigitalTwinIntelApp;
