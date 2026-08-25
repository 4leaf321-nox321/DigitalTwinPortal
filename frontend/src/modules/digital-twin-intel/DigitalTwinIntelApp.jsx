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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { Search, AlertCircle, Loader2, Radar as RadarIcon, List, AlertTriangle }
  from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import Header from './components/Layout/Header';
import NewsList from './components/NewsList';
import RadarBoard, { STAGES } from './components/RadarBoard';
import NewsModal from './components/NewsModal';
import TechModal from './components/TechModal';
import TechFormModal from './components/TechFormModal';
import RadarChart from './components/RadarChart';
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

const Content = styled.div`
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: 1.25rem 2rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;

  @media (max-width: 900px) { padding: 1rem; }
`;

/*
  레이더는 **가로를 다 쓴다.** 가운데 1600px 상자에 가두면 그림이 좁아지고 오른쪽
  목록이 화면 한가운데 떠 있게 된다 — 목록은 오른쪽 끝에 붙어야 눈이 안 헤맨다.
  ⚠️ 소식ㆍ목록 보기는 그대로 `Content` 를 쓴다. 글줄이 화면 끝까지 늘어나면 못 읽는다.
*/
const WideContent = styled.div`
  width: 100%;
  min-height: 0;
  flex: 1;
  padding: 0.75rem 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
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
  //    `is_admin` 도 함께 본다(다른 화면들과 같은 잣대).
  const canCurate = ['admin', 'dt_office'].includes(user?.role) || !!user?.is_admin;

  const [tab, setTab] = useState('news');
  const [news, setNews] = useState([]);
  const [tech, setTech] = useState([]);
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

  const [techView, setTechView] = useState('radar');   // radar | board
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

  const say = useCallback((msg) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [n, t, s, o] = await Promise.all([
        api.listNews(), api.listTech(), api.getSettings(), api.overview(),
      ]);
      setNews(n || []);
      setTech(t || []);
      setSettings(s || {});
      setOverview(o || null);
    } catch (e) {
      setError(e.message || '불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 거르기는 화면에서 한다 — 목록이 수백 건 규모라 왕복할 이유가 없다.
  const shownNews = useMemo(() => {
    const key = q.trim().toLowerCase();
    return news.filter((n) => {
      // ⚠️ 숫자를 보여만 주고 찾아가게 하면 아무도 안 간다. 누르면 **그 줄만** 남는다.
      if (focus === 'unread' && n.status !== '신규') return false;
      if (focus === 'unlinked' && (n.linkCount || 0) > 0) return false;
      if (category && n.category !== category) return false;
      if (status && n.status !== status) return false;
      if (!key) return true;
      return [n.title, n.summary, n.source]
        .some((v) => (v || '').toLowerCase().includes(key));
    });
  }, [news, q, category, status, focus]);

  const shownTech = useMemo(() => {
    const key = q.trim().toLowerCase();
    return tech.filter((t) => {
      if (focus === 'stale' && !t.isStale) return false;
      if (focus === 'moved' && !t.movedFrom) return false;
      if (staleOnly && !t.isStale) return false;
      if (stage && t.stage !== stage) return false;
      if (category && t.category !== category) return false;
      if (!key) return true;
      // 태그ㆍCPT 도 찾을 수 있어야 한다 — 부채꼴은 하나뿐이라 얽힌 갈래는
      // 거기 들어 있다("표준화"로 찾으면 OPC UA 도 나와야 한다).
      return [t.name, t.vendor, t.summary, ...(t.tags || []), ...(t.cpt || [])]
        .some((v) => (v || '').toLowerCase().includes(key));
    });
  }, [tech, q, category, stage, staleOnly, focus]);

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
      if (editing) {
        await api.updateTech(techForm.uuid, body);
      } else {
        await api.createTech(body);
      }
      setTechForm(null);
      setSelected(null);
      await load();
      say(editing
        ? '고쳤습니다.'
        : `「${body.name}」 을 레이더에 올렸습니다.`);
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
  const fixed = tab === 'tech' && techView === 'radar' && !loading && !error;
  const Shell = fixed ? WideContent : Content;

  const categoryOptions = tab === 'news'
    ? (settings.newsCategories || [])
    : (settings.techCategories || []);

  return (
    <Container>
      <Header
        tab={tab}
        onTab={(t) => { setTab(t); setCategory(''); setStage(''); }}
        newsCount={news.length}
        techCount={tech.length}
        onAdd={() => (tab === 'news' ? setAddOpen(true) : setTechForm({}))}
        canCurate={canCurate}
        onGoHome={onGoHome}
      />

      <Scroller $fixed={fixed}>
        <Shell>
          <OverviewBar data={overview} active={focus} onPick={pickFocus} />

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
              <option value="">분류 전체</option>
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>

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
            {tab === 'tech' && (
              <StaleBtn type="button" $on={staleOnly}
                        onClick={() => setStaleOnly((v) => !v)}
                        title="근거가 오래 없어 다시 볼 때가 된 것만 봅니다">
                <AlertTriangle size={13} /> 낡은 것만
                {staleOnly ? ` (${shownTech.length})` : ''}
              </StaleBtn>
            )}

            {tab === 'tech' && (
              <ViewToggle>
                <ViewBtn $on={techView === 'radar'} onClick={() => setTechView('radar')}>
                  <RadarIcon size={13} /> 레이더
                </ViewBtn>
                <ViewBtn $on={techView === 'board'} onClick={() => setTechView('board')}>
                  <List size={13} /> 목록
                </ViewBtn>
              </ViewToggle>
            )}
          </Toolbar>

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
              <RadarChart rows={shownTech} categories={settings.techCategories}
                          onSelect={merging ? doMerge
                            : compareA && !compareB ? pickCompare : setSelected}
                          activeSector={category}
                          onSectorClick={setCategory} />
            </RadarSlot>
          )}

          {!loading && !error && tab === 'tech' && techView === 'board' && (
            <RadarBoard rows={shownTech}
                        onSelect={merging ? doMerge
                          : compareA && !compareB ? pickCompare : setSelected} />
          )}
        </Shell>
      </Scroller>

      <NewsModal isOpen={addOpen} onClose={() => setAddOpen(false)} onSave={saveNews}
                 categories={settings.newsCategories} saving={saving} />

      <TechModal tech={selected} onClose={() => setSelected(null)}
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
