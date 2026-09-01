import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Gauge, FlaskConical, Cpu, Upload, Settings, Eye, Activity, PenTool, CheckSquare, Link2, Server, Users, BookOpen, Radio, Factory, FileSpreadsheet, ChevronDown, Download, ClipboardPaste, Bot } from 'lucide-react';
import CommonHeader from '../../../../shared/components/Header/CommonHeader';

// 로드맵 정보(「언제」)의 형제 — 이 모듈은 「얼마나」를 말한다.
// 단추는 로드맵 정보 헤더와 같은 모양 — 포탈 안에서 헤더 문법이 갈리면 안 된다.

const Buttons = styled.div`display: flex; gap: 0.5rem; align-items: center;`;
// 「데이터」 — 엑셀로 주고받는 둘(추출·일괄 입력)을 한 단추 아래 모은다(2026-08-30).
const DataMenu = styled.div`position: relative; display: inline-flex;`;
const DataList = styled.div`
  /* 설명 줄이 감기지 않을 만큼 넓게 — 줄바꿈되면 두 항목의 높이가 달라져 목록으로 안 읽힌다. */
  /* ⚠️ fixed — 가운데 줄이 가로 스크롤 상자라 absolute 로 두면 잘린다. 자리는 단추의 화면 좌표로. */
  position: fixed; z-index: 50; width: max-content; min-width: 26rem; max-width: 92vw;
  background: white; border: 1px solid #e2e8f0; border-radius: 0.5rem; box-shadow: 0 10px 30px rgba(15,23,42,0.16); padding: 0.25rem;
  button {
    display: flex; align-items: center; gap: 0.5rem; width: 100%; text-align: left; border: none; background: transparent;
    font-family: inherit; font-size: 0.8125rem; font-weight: 600; color: #1e293b; padding: 0.5rem 0.6rem; border-radius: 0.375rem; cursor: pointer;
    white-space: nowrap;
    &:hover { background: #eff6ff; color: #1d4ed8; }
    small { font-weight: 400; font-size: 0.6875rem; color: #94a3b8; margin-left: auto; padding-left: 1rem; white-space: nowrap; }
  }
`;

const HeaderButton = styled.button`
  display: flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 6px;
  font-size: 0.8rem; font-weight: 600; font-family: inherit; cursor: pointer; transition: all 0.2s ease;
  background: ${p => (p.$variant === 'primary' ? '#1d4ed8' : p.$variant === 'warn' ? '#fffbeb' : 'transparent')};
  em { font-style: normal; font-weight: 700; margin-left: 0.15rem; }
  color: ${p => (p.$variant === 'primary' ? 'white' : p.$variant === 'warn' ? '#92400e' : '#64748b')};
  border: ${p => (p.$variant === 'primary' ? 'none' : p.$variant === 'warn' ? '1px solid #fde68a' : '1px solid #e2e8f0')};
  &:hover { background: ${p => (p.$variant === 'primary' ? '#1e40af' : '#f1f5f9')}; color: ${p => (p.$variant === 'primary' ? 'white' : '#475569')}; }
`;
const Count = styled.span`font-size: 0.7rem; color: #94a3b8; font-weight: 500;`;

// 부문 토글 — 대시보드 헤더의 「대시보드 / 과제 진행 현황」과 같은 모양(2026-08-28).
// 시뮬레이션만 열려 있고 나머지 셋은 자리만(PLAN 3절: 자료 조사 뒤 · 3차).
const SectorToggle = styled.div`
  display: flex; gap: 2px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 4px; margin-left: 0.75rem; flex-shrink: 0;
`;
const SectorBtn = styled.button`
  display: flex; align-items: center; gap: 6px; padding: 7px 10px; border: none; border-radius: 6px; font-family: inherit; font-size: 0.8rem; font-weight: 600; white-space: nowrap;
  background: ${p => (p.$on ? '#1d4ed8' : 'transparent')}; color: ${p => (p.$on ? 'white' : '#666')}; cursor: ${p => (p.$on ? 'default' : 'pointer')};
  box-shadow: ${p => (p.$on ? '0 2px 4px rgba(29, 78, 216, 0.25)' : 'none')};
  &:hover:not(:disabled) { background: ${p => (p.$on ? '#1e40af' : '#e9ecef')}; }
  &:disabled { color: #b0b7c0; cursor: not-allowed; opacity: 0.8; }
`;
// 부문 토글. `open` 은 「척도가 없어도 눌리게 할 것인가」의 옛 장치 — 지금은 서버가
// active 로 답한다. 설정에서 감춘 부문(hidden)은 여기서 아예 빠진다(2026-08-29).
const SECTORS = [
  /* ⚠️ 「계획」은 부문이 아니다 — 부문 선택과 무관한 **한 페이지**다(2026-08-31).
     토글 맨 왼쪽에 두어 「무엇을 왜 재는가」를 먼저 읽고 부문으로 들어가게 한다.
     ⚠️ 판의 모드에 이미 「요약」이 있어 그 이름은 못 쓴다 — 같은 화면에 같은
        이름의 단추가 둘이면 어느 것을 누를지 갈린다.
     `always` 라 설정에서 부문을 감춰도 남는다. */
  { key: 'summary', label: '계획', icon: BookOpen, open: true, always: true },
  { key: 'simulation', label: '시뮬레이션', icon: Activity, open: true },
  { key: 'design_automation', label: '설계 자동화', icon: PenTool, open: false },
  { key: 'verification_automation', label: '검증 자동화', icon: CheckSquare, open: false },
  { key: 'manufacturing_monitoring', label: '모니터링', icon: Radio, open: false },
  { key: 'factory_optimization', label: '공장 최적화', hint: '공장 최적화(시뮬레이션)', icon: Factory, open: false },
  { key: 'digital_thread', label: '디지털 스레드', icon: Link2, open: false },
];

// 관리 단추의 이름은 **부문이 정한다**(sectorDef.subject_label · agent_label) —
// 「시험 항목」·「시뮬레이션」은 시뮬레이션 부문의 말이라 모니터링에서는 「공정」·「수집 수단」이다.
const subjectLabel = (sectors, key) => sectors.find(s => s.key === key)?.subject_label || '시험 항목';
const agentLabel = (sectors, key) => sectors.find(s => s.key === key)?.agent_label || '시뮬레이션';

const Header = ({ onGoHome, onOpen, counts = {}, pending = 0, canCurate = false, sample = false, onToggleSample, sector = 'simulation', sectors = [], onSector, exporting = false }) => {
  const [dataOpen, setDataOpen] = useState(false);
  const [dataAt, setDataAt] = useState({ top: 0, right: 0 });   // 내려 목록의 화면 좌표
  const openData = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setDataAt({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
    setDataOpen(v => !v);
  };
  // 바깥을 누르거나 Esc 면 닫는다 — 열려 있을 때만 듣는다.
  useEffect(() => {
    if (!dataOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDataOpen(false); };
    const onDown = (e) => { if (!e.target.closest?.('[data-data-menu]')) setDataOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown, true);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onDown, true); };
  }, [dataOpen]);

  return (
  <>
  <CommonHeader
    logo={<Gauge size={24} strokeWidth={2} />}
    title="디지털 트윈 성숙도"
    titleColor="#1d4ed8"
    onGoHome={onGoHome}
    showStats={false}
    className="dev-dt-maturity-header"
    centerContent={
      <Buttons>
        {sector === 'digital_thread' ? (
          <>
            <HeaderButton onClick={() => onOpen('system')} title="사내 시스템 사전 — 전사 하나, 스레드 주체가 채운다">
              <Server size={16} /> 시스템 관리
            </HeaderButton>
            <HeaderButton onClick={() => onOpen('org')} title="조직 사전 — 포탈 부서에서 가져오거나 직접">
              <Users size={16} /> 조직 관리
            </HeaderButton>
            {canCurate && (
              <HeaderButton onClick={() => onOpen('thread')} title="스레드 정의 — 표준 스레드와 구간(사무국)">
                <BookOpen size={16} /> 스레드 정의
              </HeaderButton>
            )}
          </>
        ) : (
          <>
            <HeaderButton onClick={() => onOpen('subject')} title={`${subjectLabel(sectors, sector)} 추가·수정·삭제`}>
              <FlaskConical size={16} /> {subjectLabel(sectors, sector)} 관리 {counts.subjects != null && <Count>{counts.subjects}</Count>}
            </HeaderButton>
            <HeaderButton onClick={() => onOpen('agent')} title={`${agentLabel(sectors, sector)} 추가·수정·삭제`}>
              <Cpu size={16} /> {agentLabel(sectors, sector)} 관리 {counts.agents != null && <Count>{counts.agents}</Count>}
            </HeaderButton>
            {/* 「가져오기」는 시뮬레이션의 엑셀 틀이다 — 다른 부문에는 그 틀이 없다 */}
            {sector === 'simulation' && (
              <HeaderButton $variant="primary" onClick={() => onOpen('import')} title="틀 내려받기 → 채워서 붙여넣기 → 미리보기 → 넣기">
                <Upload size={16} /> 가져오기
              </HeaderButton>
            )}
          </>
        )}
        <SectorToggle role="group" aria-label="부문">
          {SECTORS.filter(x => x.always || !sectors.find(s => s.key === x.key)?.hidden).map(x => {
            const open = x.always || x.open || (sectors.find(s => s.key === x.key)?.active ?? false);
            return (
              <SectorBtn key={x.key} type="button" $on={x.key === sector} disabled={!open} aria-pressed={x.key === sector}
                         onClick={() => open && onSector && onSector(x.key)}
                         title={open ? `${x.label} 부문` : `${x.hint || x.label} 부문 — 준비 중`}>
                <x.icon size={15} strokeWidth={2} /> {x.label}
              </SectorBtn>
            );
          })}
        </SectorToggle>
        {/* 데이터 — 엑셀로 주고받는 자리(2026-08-30). 탭과 무관하게 늘 있다.
            추출은 샘플 뷰에서 목업이 그대로 나온다 — 자료를 같은 길(maturityApi)로 받기 때문이다. */}
        <DataMenu>
          <HeaderButton onClick={openData} disabled={exporting}
                        title="엑셀로 내려받거나, 엑셀 표를 붙여넣어 한 번에 세웁니다" style={{ marginLeft: '0.5rem' }}>
            <FileSpreadsheet size={16} /> {exporting ? '만드는 중…' : '데이터'} <ChevronDown size={13} />
          </HeaderButton>
          {dataOpen && (
            <DataList data-data-menu style={{ top: dataAt.top, right: dataAt.right }}>
              <button type="button" onClick={() => { setDataOpen(false); onOpen('export'); }}>
                <Download size={14} /> 추출<small>대상·수단·평가·이력을 엑셀(.xlsx) 한 권으로</small>
              </button>
              <button type="button" onClick={() => { setDataOpen(false); onOpen('bulk'); }}>
                <ClipboardPaste size={14} /> 일괄 입력<small>추출과 같은 머리글의 표를 붙여넣어 한 번에</small>
              </button>
            </DataList>
          )}
        </DataMenu>
        {/* 확인 대기 — AI 가 낸 판단. 사무국이 아니어도 자기 사업부 것은 봐야 한다(2026-08-30) */}
        {pending > 0 && (
          <HeaderButton $variant="warn" onClick={() => onOpen('proposals')}
                        title="AI 가 매기자고 낸 판단 — 근거를 읽고 승인해야 판에 오릅니다">
            <Bot size={16} /> 확인 대기 <em>{pending}</em>
          </HeaderButton>
        )}
        {canCurate && (
          <HeaderButton onClick={() => onOpen('settings')} title="정확도 문턱과 경계 — 사무국·관리자">
            <Settings size={16} /> 설정
          </HeaderButton>
        )}
        {canCurate && onToggleSample && (
          <HeaderButton onClick={onToggleSample} title="개발용 목업 자료로 화면을 그려 본다 — 보고용. 저장되지 않는다"
                        style={sample ? { background: '#fef3c7', color: '#92400e', borderColor: '#f59e0b' } : undefined}>
            <Eye size={16} /> {sample ? '샘플 뷰 끄기' : '샘플 뷰'}
          </HeaderButton>
        )}
      </Buttons>
    }
  />
  {/* 화면이 좁으면 **가운데 줄이 옆으로 굴러간다** — 대시보드 헤더와 같은 처방(2026-09-01).
      공용 헤더는 flex-shrink 0 · width max-content 라 줄지 않고 그대로 넘쳐, 오른쪽
      단추(설정·샘플 뷰)부터 화면 밖으로 잘렸다. 이 모듈에서만 줄어들 수 있게 풀고
      가로 스크롤을 준다. 공용 CSS 를 고치면 다른 모듈까지 바뀌므로 건드리지 않는다.
      ⚠️ 안쪽 것들은 flex-shrink 0 이어야 한다 — 안 그러면 줄어들 뿐 넘치지 않아
         스크롤이 안 생기고 단추만 찌그러진다. */}
  <style>{`
    .dev-dt-maturity-header .header-right { flex-shrink: 1 !important; min-width: 0; }
    .dev-dt-maturity-header .header-right > *:not(.header-center-content) { flex-shrink: 0; }
    .dev-dt-maturity-header .header-center-content {
      flex-shrink: 1 !important; min-width: 0 !important; width: auto !important;
      overflow-x: auto !important; overflow-y: hidden;
      scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent;
    }
    .dev-dt-maturity-header .header-center-content > * { flex-shrink: 0; }
    .dev-dt-maturity-header .header-center-content::-webkit-scrollbar { height: 6px; }
    .dev-dt-maturity-header .header-center-content::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    .dev-dt-maturity-header .header-center-content::-webkit-scrollbar-track { background: transparent; }
  `}</style>
  </>
  );
};

export default Header;
