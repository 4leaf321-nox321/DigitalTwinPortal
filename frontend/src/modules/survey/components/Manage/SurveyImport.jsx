import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { Table2, Wand2, AlertTriangle, CheckCircle2, Loader2, ListPlus } from 'lucide-react';
import surveyApi from '../../services/surveyApi';
import AxisPicker from './AxisPicker';
import { linkKeyLabel, STRATEGY_DIMENSION_LINK } from '../../constants/questionTemplates';
import { ACCENT, ACCENT_DARK, ACCENT_LINE, ACCENT_TINT } from '../../theme';

// 표를 붙여넣어 설문을 통째로 만드는 자리.
//
// **운영 서버에서는 코드를 못 고친다.** 그런데 설문은 매번 문항이 다르고,
// 역할(과제 멤버·PL·사업부 사무국·사무국장)과 프로세스(개발·제조·품질·연계)에
// 따라 묻는 것이 갈린다. 문항을 화면에서 하나씩 만드는 것은 이미 되지만
// (SurveyEditor) 수십 문항을 그렇게 만들 수는 없다. 그래서 운영에서 AI 로 만든
// 엑셀 표를 붙여넣으면 설문이 한 번에 만들어져야 한다.
//
// ⚠️ **파싱은 서버가 한다.** 미리보기(`/manage/import/preview`)와 생성
//    (`/manage/import`)이 백엔드의 같은 파서(importer.parse_table)를 부른다.
//    프론트에서 따로 파싱하면 "미리보기는 통과했는데 생성은 실패"가 반드시
//    생기고, 그때 사용자는 자기 표의 어디가 틀렸는지 알 방법이 없다.
//
// ⚠️ 이 화면은 **읽기 → 확인 → 만들기 세 걸음**이다. 붙여넣자마자 만들지
//    않는다. 응답이 한 건이라도 들어오면 문항은 잠겨서 못 고치기 때문에
//    (SurveyEditor 의 locked) 틀린 표를 그대로 넣으면 되돌릴 방법이 지우는
//    것뿐이다.
//
// 이 화면은 **두 갈래**다.
//   새 설문 만들기 — 표 한 벌로 설문을 새로 만든다.
//   기존 설문에 덧붙이기 — 이미 있는 설문의 문항 뒤에 표의 문항을 이어 붙인다.
//
// 덧붙이기가 왜 필요한가: 실제 운영은 AI 로 **역할별 표를 여러 벌** 만든 뒤
// 첫 표로 설문을 만들고 나머지를 같은 설문에 얹는 식으로 흐른다. 덧붙이기가
// 없으면 표를 다시 붙여넣을 때마다 설문이 하나씩 더 생기고, 응답자는 같은
// 설문이 여러 개 보이는 목록을 받는다.
//
// ⚠️ 두 갈래는 **같은 엔드포인트**(`/manage/import`)를 쓴다. body 에 survey_id 가
//    있으면 덧붙이기다. 표를 읽고·확인하고·오류를 보여주는 부분은 두 모드가
//    글자 하나까지 같아야 한다 — 갈리는 것은 '어디에 담기느냐' 하나뿐이다.
//
// ⚠️ 덧붙이기에서 title·description·target 은 **서버가 무시한다.** 그래서 화면
//    에서도 아예 감춘다. 무시되는 값을 받아 두면 사용자는 반영된 줄 안다.
//
// ⚠️ **응답이 한 건이라도 있는 설문에는 못 덧붙인다**(서버가 409). 고르게
//    해놓고 409 를 받으면 사용자는 자기가 뭘 잘못했는지 모르므로, 목록에서
//    미리 못 고르게 막고 **왜 못 고르는지 그 자리에** 적는다.

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #475569;
`;

const Input = styled.input`
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.9375rem;
  font-family: inherit;
  font-weight: 400;
  color: #1e293b;
  &:focus { outline: none; border-color: ${ACCENT}; }
`;

const Textarea = styled(Input).attrs({ as: 'textarea' })`
  font-size: 0.8125rem;
  min-height: 3rem;
  resize: vertical;
`;

const Select = styled.select`
  padding: 0.45rem 0.6rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-family: inherit;
  background: white;
  color: #1e293b;
`;

const Row = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: flex-end;
`;

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
`;

const SectionTitle = styled.h4`
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: #1e293b;
`;

const Hint = styled.span`
  font-size: 0.8125rem;
  color: #94a3b8;
`;

const GhostButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.7rem;
  border: 1px dashed ${ACCENT_LINE};
  border-radius: 0.375rem;
  background: transparent;
  color: ${ACCENT_DARK};
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { background: ${ACCENT_TINT}; }
`;

// 형식 안내. **접지 않는다** — 형식을 모르면 붙여넣을 수가 없고, 접어 두면
// 아무도 펴지 않는다.
const Guide = styled.div`
  padding: 0.75rem 0.875rem;
  background: ${ACCENT_TINT};
  border: 1px solid ${ACCENT_LINE};
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const GuideTitle = styled.div`
  font-size: 0.8125rem;
  font-weight: 700;
  color: ${ACCENT_DARK};
`;

const GuideCols = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 0.35rem;
`;

const GuideCol = styled.div`
  padding: 0.35rem 0.5rem;
  background: white;
  border: 1px solid ${ACCENT_LINE};
  border-radius: 0.3rem;
  line-height: 1.4;
`;

const GuideName = styled.div`
  font-size: 0.75rem;
  font-weight: 700;
  color: #1e293b;
`;

const GuideDesc = styled.div`
  font-size: 0.6875rem;
  color: #64748b;
`;

const GuideNote = styled.div`
  font-size: 0.75rem;
  color: #475569;
  line-height: 1.65;
`;

// 붙여넣기 칸. 표를 그대로 받으므로 고정폭 글꼴이라야 열이 눈에 보인다.
const Paste = styled.textarea`
  width: 100%;
  min-height: 12rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  font-family: 'D2Coding', 'Consolas', 'Menlo', monospace;
  font-size: 0.75rem;
  line-height: 1.6;
  color: #1e293b;
  white-space: pre;
  overflow-x: auto;
  resize: vertical;
  &:focus { outline: none; border-color: ${ACCENT}; }
`;

const Note = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  padding: 0.65rem 0.875rem;
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  line-height: 1.6;
  background: ${p => (p.$tone === 'bad' ? '#fef2f2' : p.$tone === 'warn' ? '#fffbeb' : '#f0fdf4')};
  border: 1px solid ${p => (p.$tone === 'bad' ? '#fecaca' : p.$tone === 'warn' ? '#fde68a' : '#bbf7d0')};
  color: ${p => (p.$tone === 'bad' ? '#b91c1c' : p.$tone === 'warn' ? '#92400e' : '#15803d')};
`;

const Chips = styled.div`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
  font-size: 0.75rem;
  color: #64748b;
`;

const Chip = styled.span`
  padding: 0.1rem 0.45rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  background: #f1f5f9;
  color: #475569;
`;

const TableWrap = styled.div`
  overflow-x: auto;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  background: white;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
  white-space: nowrap;
`;

const Th = styled.th`
  padding: 0.45rem 0.6rem;
  text-align: left;
  font-weight: 700;
  color: #64748b;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
`;

const Td = styled.td`
  padding: 0.45rem 0.6rem;
  border-bottom: 1px solid #f1f5f9;
  color: #1e293b;
  vertical-align: top;
  ${p => p.$wrap && `white-space: normal; min-width: 16rem;`}
`;

const Tr = styled.tr`
  background: ${p => (p.$bad ? '#fef2f2' : 'transparent')};
`;

// 오류는 그 행 **바로 밑**에 적는다. 위쪽에 모아만 두면 수십 행짜리 표에서
// 어느 줄 이야기인지 찾느라 시간이 다 간다.
const ErrCell = styled.td`
  padding: 0 0.6rem 0.5rem 0.6rem;
  background: #fef2f2;
  border-bottom: 1px solid #fecaca;
  color: #b91c1c;
  font-size: 0.75rem;
  line-height: 1.65;
  white-space: normal;
`;

const Muted = styled.span`
  color: #94a3b8;
`;

const Bad = styled.span`
  color: #b91c1c;
  font-weight: 700;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.5rem;
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

// 모드 전환. 탭이 아니라 **한 줄짜리 토글**로 둔다 — 두 모드는 같은 표를 다르게
// 담을 뿐이라, 화면을 갈라 두면 아래 붙여넣기 칸이 모드마다 따로 있는 줄 안다.
const Modes = styled.div`
  display: flex;
  align-self: flex-start;
  border: 1px solid #cbd5e1;
  border-radius: 0.375rem;
  overflow: hidden;
`;

const ModeButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.9rem;
  border: none;
  background: ${p => (p.$on ? ACCENT : 'white')};
  color: ${p => (p.$on ? 'white' : '#64748b')};
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  & + & { border-left: 1px solid #cbd5e1; }
  &:hover { background: ${p => (p.$on ? ACCENT : ACCENT_TINT)}; }
`;

// 덧붙일 설문 고르기. 목록이 길어질 수 있어 안쪽에서만 스크롤한다 — 밖으로
// 밀려나면 아래 붙여넣기 칸이 화면에서 사라진다.
const PickList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-height: 17rem;
  overflow-y: auto;
  padding: 0.35rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const PickRow = styled.button`
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.65rem;
  border: 1px solid ${p => (p.$on ? ACCENT : 'transparent')};
  border-radius: 0.375rem;
  background: ${p => (p.$on ? ACCENT_TINT : 'transparent')};
  font-family: inherit;
  cursor: pointer;
  &:hover:not(:disabled) { background: ${ACCENT_TINT}; }
  &:disabled { cursor: not-allowed; background: #f8fafc; }
`;

// 줄 속 요소는 span 이다 — 버튼 안에는 블록 요소를 넣지 않는다(button 의 내용
// 모델은 phrasing content 다). display 로만 블록처럼 세운다.
const PickTitle = styled.span`
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: ${p => (p.$off ? '#94a3b8' : '#1e293b')};
`;

const PickMeta = styled.span`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  flex-wrap: wrap;
  margin-top: 0.3rem;
  font-size: 0.75rem;
  color: #64748b;
`;

// 못 고르는 이유는 **그 줄 안**에 적는다. 위쪽에 한 번만 적어 두면 회색으로
// 변한 줄이 왜 회색인지 아무도 연결하지 못한다.
const PickBlocked = styled.span`
  display: block;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #b91c1c;
`;

// 고른 설문이 지금 어떤 상태이고 덧붙이면 무엇이 되는지. 누르기 **전에** 안다.
const Summary = styled.div`
  padding: 0.65rem 0.875rem;
  background: ${ACCENT_TINT};
  border: 1px solid ${ACCENT_LINE};
  border-radius: 0.5rem;
  font-size: 0.8125rem;
  line-height: 1.75;
  color: #334155;
`;

const TARGETS = [
  { value: 'all', label: '전사' },
  { value: 'role', label: '역할' },
  { value: 'department', label: '부서' },
  { value: 'user', label: '지정 인원' },
];

// 열 순서는 고정이다. **번호를 붙여 둔다** — 화면이 좁아 줄바꿈되면 순서가
// 눈으로 안 읽히는데, 순서를 한 칸 밀려 쓰는 것이 이 표에서 가장 흔한 실수다.
const COLUMN_GUIDE = [
  { name: '섹션', desc: '문항 묶음 이름. 비우면 윗줄을 잇습니다' },
  { name: '역할', desc: '쉼표로 여럿. 비우면 전원' },
  { name: '프로세스', desc: '쉼표로 여럿. 비우면 전원' },
  { name: '문항', desc: '물어볼 말 (반드시 있어야 합니다)' },
  { name: '유형', desc: '척도·객관식·복수선택·순위·서술' },
  { name: '보기', desc: '| 로 구분. 척도·서술은 비웁니다' },
  { name: '필수', desc: '예/아니오·Y/N·1/0. 비우면 필수' },
  { name: '도움말', desc: '선택' },
  { name: '연결키', desc: '선택. 예: organization:readiness' },
];

const QTYPE_LABEL = {
  scale: '척도', choice: '객관식', multi: '복수선택', rank: '순위', text: '서술',
};

// 덧붙일 설문 목록에 상태를 같이 보여준다. 마감된 설문에 덧붙이는 것 자체는
// 막지 않지만(응답이 0건이면 문항은 자유롭게 바꿀 수 있다), 어떤 설문인지는
// 알고 골라야 한다. 문구는 SurveyManager 의 STATUS 와 같은 말을 쓴다.
const STATUS_LABEL = { draft: '작성 중', open: '응답 받는 중', closed: '마감' };

// 예시 표.
//
// **형식을 읽는 것보다 예시를 고쳐 쓰는 편이 빠르다.** 그래서 설명만 두지 않고
// 실제로 돌아가는 표를 한 벌 넣어 둔다. 이 예시 한 벌에 규칙이 전부 들어 있다 —
// 머리글 행, 빈 역할(=전원), 섹션 이어받기(4·6행), 쉼표로 여럿 적은 프로세스,
// `|` 로 나눈 보기, 유형 다섯 가지, 필수/선택, 연결키.
const EXAMPLE_ROWS = [
  ['섹션', '역할', '프로세스', '문항', '유형', '보기', '필수', '도움말', '연결키'],
  ['공통', '', '', '올해 우리 조직의 AX 목표를 알고 있습니까?', '척도', '', '예', '1=전혀 모른다, 5=명확히 안다', 'organization:readiness'],
  ['공통', '', '', 'AX 도구를 실제 업무에서 얼마나 쓰십니까?', '객관식', '매일|주 1~2회|가끔|쓰지 않음', '예', '', ''],
  ['과제 수행', '과제 멤버', '개발,제조', '담당 과제에 필요한 데이터가 제때 모입니까?', '척도', '', '예', '데이터가 없어 과제가 멈춘 적이 있는지 떠올려 보세요', 'organization:redesign'],
  ['', '과제 멤버', '', '과제를 막는 것을 모두 고르세요', '복수선택', '데이터 부족|도구 미숙|시간 부족|타 부서 협조', '아니오', '', ''],
  ['과제 관리', 'PL', '', '과제원의 역할과 책임이 분명합니까?', '척도', '', '예', '', 'organization:role'],
  ['', 'PL', '품질,연계', '연계가 필요한 부서와 협의가 원활합니까?', '척도', '', '아니오', '', ''],
  ['운영', '사업부 사무국', '', '사무국이 먼저 풀어야 할 것을 순서대로 놓으세요', '순위', '예산|인력|교육|표준화', '예', '', ''],
  ['운영', '사무국장', '', '내년 AX 투자 계획은 어떻습니까?', '객관식', '확대|유지|축소|미정', '예', '', 'organization:return'],
  ['마무리', '', '', '더 하고 싶은 말을 자유롭게 적어 주세요', '서술', '', '아니오', '', ''],
];
// 탭으로 잇는다. 엑셀에서 복사해 붙여넣은 것과 **글자 단위로 같은 모양**이라야
// 예시를 고쳐 쓴 표가 실제 붙여넣기와 다르게 동작하지 않는다.
const EXAMPLE_TEXT = EXAMPLE_ROWS.map(r => r.join('\t')).join('\n');

/** 축(역할·프로세스) 별 문항 수. 오타로 갈린 이름을 사람이 눈으로 잡게 한다. */
function countAxis(rows, key) {
  const map = new Map();
  rows.forEach(r => (r[key] || []).forEach(v => map.set(v, (map.get(v) || 0) + 1)));
  return [...map.entries()];
}

const SurveyImport = ({
  onCreate, onCreated, onCancel,
  // 설문 목록. SurveyManager 가 **이미 들고 있는 것**을 그대로 받는다 — 같은
  // 목록을 두 번 부르면 카드에 적힌 응답 수와 여기 적힌 응답 수가 어긋난다.
  surveys,
  // 어느 모드로 들어왔는가. 목록의 카드에서 「문항 덧붙이기」로 바로 들어오면
  // 모드와 대상이 미리 정해져 있다.
  initialMode = 'create',
  initialSurveyId = null,
}) => {
  const [mode, setMode] = useState(initialMode === 'append' ? 'append' : 'create');
  const [targetId, setTargetId] = useState(initialSurveyId);
  const [form, setForm] = useState({
    title: '', description: '', target_type: 'all', target_refs: '',
  });

  // 응답자에게 물을 역할·프로세스 목록.
  //
  // ⚠️ **표에서 유도만 하면 안 된다.** 표의 '역할' 열에는 그 역할 전용 문항이
  //    있는 역할만 나타난다. 전원 대상 문항만 답하는 역할(사무국장처럼)은
  //    목록에 안 들어가고, 그러면 그 사람은 역할을 고를 수 없어 **제출 자체가
  //    막힌다.** 그래서 표에서 찾은 값을 기본으로 채우되 손으로 고칠 수 있게 둔다.
  //
  // 빈 문자열이면 서버가 표에서 유도한 값을 쓴다(기존 동작).
  // 고를 수 있는 값은 **서버가 준다.** 화면이 목록을 들고 있으면 서버가 받는
  // 값과 갈려서, 화면엔 있는데 저장하면 400 이 나는 상태가 된다.
  const [axisOptions, setAxisOptions] = useState({ roles: [], processes: [] });
  useEffect(() => {
    let alive = true;
    surveyApi.getOptions()
      .then(res => { if (alive && res?.data) setAxisOptions(res.data); })
      .catch(() => {});   // 목록을 못 받아도 표 붙여넣기는 돌아야 한다
    return () => { alive = false; };
  }, []);

  const [axes, setAxes] = useState({ roles: '', processes: '' });
  // 표를 다시 붙여넣어 새 역할이 나오면 아직 손대지 않은 칸만 따라 채운다.
  const [axesTouched, setAxesTouched] = useState({ roles: false, processes: false });
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  // 목록을 prop 으로 못 받았을 때만 쓰는 자리(아래 useEffect 참고).
  const [fetchedSurveys, setFetchedSurveys] = useState(null);
  const [listError, setListError] = useState(null);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  // 덧붙일 후보 목록.
  //
  // prop 으로 받으면 그것을 쓴다 — SurveyManager 가 이미 부른 목록이라 다시
  // 부를 이유가 없다. **안 넘겨준 경우에만** 직접 부른다(다른 화면에서 이
  // 컴포넌트를 쓰게 될 때의 대비이지 평소 경로가 아니다). 그래서 '빈 배열'과
  // '안 넘어옴'을 가른다 — 설문이 0개인 것과 목록을 모르는 것은 다르다.
  const givenSurveys = Array.isArray(surveys) ? surveys : null;
  useEffect(() => {
    if (givenSurveys || mode !== 'append' || fetchedSurveys) return;
    let alive = true;
    surveyApi.listSurveys()
      .then(res => { if (alive) setFetchedSurveys(res.data || []); })
      .catch(e => { if (alive) setListError(e.message); });
    return () => { alive = false; };
  }, [givenSurveys, mode, fetchedSurveys]);

  const options = givenSurveys || fetchedSurveys || [];
  const selected = useMemo(
    () => options.find(s => String(s.id) === String(targetId)) || null,
    [options, targetId],
  );

  /** 못 고르는 이유. 없으면 null. 목록 줄과 만들기 버튼이 **같은 문장**을 쓴다. */
  const pickBlockReason = (s) => (
    s.response_count > 0
      ? `응답 ${s.response_count}건 — 문항을 바꿀 수 없습니다`
      : null
  );

  // 목록의 카드에서 바로 덧붙이기로 들어오면 고른 설문이 스크롤 밖에 있을 수
  // 있다. 목록만 봐서는 무엇이 골라졌는지 안 보이므로 그 줄로 데려간다.
  // ('nearest' 라 이미 보이는 줄에서는 화면이 움직이지 않는다.)
  const revealRow = useCallback((el) => {
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, []);

  // 모드를 바꿀 때 표·미리보기는 **그대로 둔다.** 표를 붙여넣고 나서 "아, 새로
  // 만들 게 아니라 덧붙이는 거였지" 하는 순간이 실제 흐름이라, 여기서 표가
  // 지워지면 다시 붙여넣어야 한다. 지우는 것은 지난 모드에서 받은 서버 오류뿐.
  const switchMode = (next) => {
    setMode(next);
    setError(null);
  };

  // 늦게 온 옛 응답이 새 결과를 덮지 않게 한다. 타이핑 중에 미리보기가
  // 여러 번 날아가는데, 순서가 뒤집히면 화면이 이미 고친 오류를 계속 보여준다.
  const seq = useRef(0);

  const runPreview = useCallback(async (value) => {
    if (!(value || '').trim()) {
      seq.current += 1;
      setPreview(null);
      setPreviewError(null);
      setPreviewing(false);
      return;
    }
    const mine = (seq.current += 1);
    setPreviewing(true);
    try {
      const res = await surveyApi.previewImport(value);
      if (mine !== seq.current) return;
      setPreview(res.data || null);
      setPreviewError(null);
    } catch (e) {
      if (mine !== seq.current) return;
      // 미리보기를 못 받으면 표가 맞는지 알 수 없다. 결과를 지워서
      // **만들기가 막히게** 둔다 — 확인 못 한 표로 설문을 만들면 안 된다.
      setPreview(null);
      setPreviewError(e.message);
    } finally {
      if (mine === seq.current) setPreviewing(false);
    }
  }, []);

  // 붙여넣으면 바로 읽어 준다. 사람이 버튼을 한 번 더 눌러야 한다면 확인 없이
  // 만들기부터 누르는 사람이 반드시 생긴다. 400ms 는 타이핑 중 연타를 막는 값.
  useEffect(() => {
    const timer = setTimeout(() => runPreview(text), 400);
    return () => clearTimeout(timer);
  }, [text, runPreview]);

  const rows = useMemo(() => preview?.rows || [], [preview]);
  const errorCount = preview?.error_count || 0;
  const badLines = useMemo(
    () => rows.filter(r => r.errors?.length).map(r => r.line),
    [rows],
  );
    // 미리보기가 새로 오면, 사람이 아직 안 고친 칸만 표의 값으로 채운다.
  useEffect(() => {
    if (!preview) return;
    setAxes(a => ({
      roles: axesTouched.roles ? a.roles : (preview.roles || []).join(', '),
      processes: axesTouched.processes ? a.processes : (preview.processes || []).join(', '),
    }));
  }, [preview, axesTouched.roles, axesTouched.processes]);

const roleCounts = useMemo(() => countAxis(rows, 'roles'), [rows]);
  const processCounts = useMemo(() => countAxis(rows, 'processes'), [rows]);
  const everyoneCount = useMemo(
    () => rows.filter(r => !(r.roles || []).length && !(r.processes || []).length).length,
    [rows],
  );

  // 첫 줄은 서버가 머리글로 보고 건너뛴다. **무엇을 건너뛰었는지 보여준다** —
  // 머리글 없이 붙여넣으면 첫 문항이 조용히 사라지는데, 보여주면 바로 알아챈다.
  const header = preview?.header || null;
  const headerLooksOdd = !!header && !header.some(c => /문항|질문/.test(c || ''));

  // 연결키가 붙은 행이 있으면 link_type 도 같이 실어야 한다. 표에는 종류 열이
  // 없어서, 지금 아는 종류(organization:*)일 때만 붙인다 — 이 둘의 짝이 안
  // 맞으면 백엔드가 에러 없이 201 을 주고 연결만 NULL 로 남는다.
  const linkKeys = useMemo(() => rows.map(r => r.link_key).filter(Boolean), [rows]);
  const linkType = linkKeys.length && linkKeys.every(k => String(k).startsWith('organization:'))
    ? STRATEGY_DIMENSION_LINK
    : null;

  /** 쉼표로 적은 축을 목록으로. 서버에 실어 보내는 값과 화면에 그리는 값이 같아야 한다. */
  const splitAxis = (v) => v.split(',').map(x => x.trim()).filter(Boolean);

  // 덧붙인 뒤 응답자가 고르게 될 축.
  //
  // ⚠️ 서버가 잡는 순서를 **그대로** 흉내 낸다: 기존 값 → 표에 나온 값 →
  //    손으로 적은 값(routes.py 의 _extend_axes). 덧붙이기에서는 손으로 적은
  //    값이 표의 값을 **대신하지 않고 더해진다** — 화면이 '대신한다'로 그리면,
  //    역할 하나를 지우려고 칸에서 지운 사람이 안 지워진 것을 나중에야 안다.
  const unionAxes = (...lists) => {
    const out = [];
    lists.forEach(list => (list || []).forEach(v => {
      if (!out.includes(v)) out.push(v);
    }));
    return out;
  };
  const unionRoles = useMemo(
    () => unionAxes(selected?.roles, preview?.roles, splitAxis(axes.roles)),
    [selected, preview, axes.roles],
  );
  const unionProcesses = useMemo(
    () => unionAxes(selected?.processes, preview?.processes, splitAxis(axes.processes)),
    [selected, preview, axes.processes],
  );

  // 왜 막혔는지를 문장으로 만든다. 비활성 버튼만 두면 사용자는 이유를 모른다.
  //
  // 표를 읽는 부분(뒤쪽 세 줄)은 두 모드가 같고, 앞쪽만 갈린다 — 새로 만들 때는
  // 제목이, 덧붙일 때는 고른 설문이 있어야 한다.
  const targetBlocked = selected ? pickBlockReason(selected) : null;
  const modeBlockReason = mode === 'append'
    ? (!selected
      ? '덧붙일 설문을 골라야 합니다'
      // 고른 뒤에 누가 답해 목록이 새로 읽힌 경우다. 버튼을 눌러 409 를 받기
      // 전에 여기서 막는다.
      : targetBlocked ? `${targetBlocked} — 다른 설문을 고르세요` : null)
    : (!form.title.trim() ? '제목을 적어야 만들 수 있습니다' : null);

  const blockReason =
    modeBlockReason
      || (previewing ? '표를 읽는 중입니다'
        : previewError ? '표를 읽지 못해 확인이 끝나지 않았습니다'
          : rows.length === 0 ? '표를 붙여넣어야 합니다'
            : errorCount > 0 ? `오류가 있는 ${errorCount}개 행을 먼저 고쳐 주세요`
              : null);

  const fillExample = () => {
    // 붙여넣은 것이 있으면 되묻는다. 예시로 덮으면 원문은 되돌릴 수 없다.
    if (text.trim() && !window.confirm('붙여넣은 표를 예시로 바꿀까요? 지금 내용은 사라집니다.')) return;
    setText(EXAMPLE_TEXT);
  };

  const submit = async () => {
    if (blockReason) return;
    const refs = form.target_refs
      .split(',').map(s => s.trim()).filter(Boolean)
      .map(s => (/^\d+$/.test(s) ? Number(s) : s));

    // 덧붙이기에는 **survey_id 와 표만** 싣는다. 제목·설명·대상은 서버가 무시
    // 하므로 보내지 않는다 — 보내 두면 언젠가 서버가 그것을 쓰게 되는 날
    // 빈 제목이 기존 설문을 덮는다.
    const payload = mode === 'append'
      ? { survey_id: selected.id, text }
      : {
        title: form.title.trim(),
        description: form.description || null,
        target_type: form.target_type,
        target_refs: form.target_type === 'all' ? [] : refs,
        text,
      };

    // 축은 두 모드 공통이다. 비면 안 싣는다 — 서버가 표에서 유도하게 둔다.
    // (덧붙이기에서는 유도한 값이 기존 값과 **합집합**이 되므로, 안 실어도
    //  기존 역할이 지워지지 않는다.)
    if (axes.roles.trim()) payload.roles = splitAxis(axes.roles);
    if (axes.processes.trim()) payload.processes = splitAxis(axes.processes);
    if (linkType) payload.link_type = linkType;

    setCreating(true);
    setError(null);
    try {
      const res = await onCreate(payload);
      onCreated?.(res?.data || null);
    } catch (e) {
      setError(e.message);
      // 서버가 막았다면 미리보기 이후 표가 바뀐 것이다. 방금 보낸 그 표로
      // 미리보기를 다시 그려 어느 줄이 문제인지 그 자리에서 보여준다.
      runPreview(text);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Wrap>
      {/* 두 갈래를 맨 위에서 고른다. 아래 붙여넣기·미리보기·오류 표시·예시
          채우기는 두 모드가 **그대로** 쓴다 — 표를 읽는 규칙은 하나다. */}
      <Modes>
        <ModeButton type="button" $on={mode === 'create'}
                    onClick={() => switchMode('create')}
                    title="표 한 벌로 설문을 새로 만듭니다">
          <Table2 size={14} /> 새 설문 만들기
        </ModeButton>
        <ModeButton type="button" $on={mode === 'append'}
                    onClick={() => switchMode('append')}
                    title="이미 있는 설문의 문항 뒤에 표의 문항을 이어 붙입니다">
          <ListPlus size={14} /> 기존 설문에 덧붙이기
        </ModeButton>
      </Modes>

      {mode === 'create' ? (
        <>
          {/* 제목·대상은 표와 별개다. 표에는 문항만 들어 있다. */}
          <Field>
            제목
            <Input value={form.title} onChange={set('title')}
                   placeholder="예: 2026년 AX 과제 역할별 진단 설문" />
          </Field>

          <Field>
            설명 (선택)
            <Textarea value={form.description} onChange={set('description')}
                      placeholder="무엇을 위한 설문인지 응답자에게 알립니다" />
          </Field>

          <Row>
            <Field>
              대상
              <Select value={form.target_type} onChange={set('target_type')}>
                {TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            {form.target_type !== 'all' && (
              <Field style={{ flex: 1, minWidth: '16rem' }}>
                {form.target_type === 'role' ? '역할 (쉼표로 구분: user, manager)'
                  : form.target_type === 'department' ? '부서명 (쉼표로 구분)'
                    : '사용자 id (쉼표로 구분)'}
                <Input value={form.target_refs} onChange={set('target_refs')} />
              </Field>
            )}
          </Row>
        </>
      ) : (
        // 덧붙이기에는 제목·설명·대상 칸이 **없다.** 서버가 무시하는 값이라,
        // 입력받아 두면 사용자는 그것이 반영된 줄 안다.
        <>
          <SectionHead>
            <SectionTitle>덧붙일 설문</SectionTitle>
            <Hint>고른 설문의 문항 뒤에 표의 문항이 이어 붙습니다</Hint>
          </SectionHead>

          {listError && (
            <Note $tone="bad">
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
              <span>설문 목록을 불러오지 못했습니다 — {listError}</span>
            </Note>
          )}

          {options.length === 0 ? (
            <Note $tone="warn">
              <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
              <span>
                덧붙일 설문이 없습니다. 먼저 <strong>「새 설문 만들기」</strong>로 한 벌
                만든 뒤, 나머지 표를 여기서 얹으세요.
              </span>
            </Note>
          ) : (
            <PickList>
              {options.map(s => {
                const blocked = pickBlockReason(s);
                const on = String(s.id) === String(targetId);
                return (
                  <PickRow
                    key={s.id} type="button" $on={on} disabled={!!blocked}
                    ref={on ? revealRow : null}
                    onClick={() => { setTargetId(s.id); setError(null); }}
                    title={blocked || '이 설문에 표의 문항을 덧붙입니다'}>
                    <PickTitle $off={!!blocked}>{s.title}</PickTitle>
                    <PickMeta>
                      <Chip>{STATUS_LABEL[s.status] || s.status}</Chip>
                      <Chip>문항 {s.question_count}개</Chip>
                      {/* 역할이 비어 있으면 '아무도'가 아니라 '역할을 묻지
                          않는 설문'이다. 빈칸으로 두면 반대로 읽힌다. */}
                      {(s.roles || []).length
                        ? s.roles.map(r => <Chip key={r}>{r}</Chip>)
                        : <Muted>역할을 묻지 않는 설문</Muted>}
                    </PickMeta>
                    {blocked && <PickBlocked>{blocked}</PickBlocked>}
                  </PickRow>
                );
              })}
            </PickList>
          )}

          {/* 덧붙이면 무엇이 어떻게 되는지 **누르기 전에** 보여준다. */}
          {selected && (
            <Summary>
              <strong>{selected.title}</strong>에 덧붙입니다.
              {' '}지금 문항 <strong>{selected.question_count}개</strong>
              {rows.length > 0 && errorCount === 0 && (
                <> → 덧붙이면 <strong>{selected.question_count + rows.length}개</strong></>
              )}.
              <br />
              지금 응답자가 고르는 역할:{' '}
              {(selected.roles || []).length
                ? <strong>{selected.roles.join(', ')}</strong>
                : <Muted>없음 — 이 설문은 역할을 묻지 않습니다</Muted>}
              <br />
              제목·설명·대상은 <strong>바뀌지 않습니다</strong>. 역할·프로세스는
              {' '}<strong>합집합</strong>이라 넓어지기만 하고 지금 것이 지워지지 않습니다.
            </Summary>
          )}
        </>
      )}

      <SectionHead>
        <SectionTitle>표 붙여넣기</SectionTitle>
        <Hint>엑셀에서 표를 복사해 그대로 붙여넣으세요</Hint>
        <GhostButton onClick={fillExample} title="예시 표를 넣습니다. 고쳐 쓰는 편이 형식을 읽는 것보다 빠릅니다">
          <Wand2 size={14} /> 예시 채우기
        </GhostButton>
      </SectionHead>

      <Guide>
        <GuideTitle>열 순서는 고정입니다. 첫 줄은 머리글로 보고 건너뜁니다.</GuideTitle>
        <GuideCols>
          {COLUMN_GUIDE.map((c, i) => (
            <GuideCol key={c.name}>
              <GuideName>{i + 1}. {c.name}</GuideName>
              <GuideDesc>{c.desc}</GuideDesc>
            </GuideCol>
          ))}
        </GuideCols>
        <GuideNote>
          역할·프로세스를 <strong>비우면 그 문항은 전원에게</strong> 보입니다.
          보기만 <code>|</code> 로 나누는 것은 보기 안에 쉼표가 들어가는 일이 잦기
          때문입니다(&ldquo;설계, 해석 도구&rdquo;). 탭 구분(엑셀 복사)과 쉼표
          구분(CSV)을 둘 다 받고, 탭이 하나라도 있으면 탭으로 봅니다.
        </GuideNote>
      </Guide>

      <Paste
        value={text}
        onChange={e => setText(e.target.value)}
        spellCheck={false}
        placeholder={'섹션\t역할\t프로세스\t문항\t유형\t보기\t필수\t도움말\t연결키\n공통\t\t\t올해 조직의 AX 목표를 알고 있습니까?\t척도\t\t예\t\t'}
      />

      {/* ── 확인 ─────────────────────────────────────────────────────── */}

      {previewing && <Hint><Loader2 size={13} /> 표를 읽는 중…</Hint>}

      {previewError && (
        <Note $tone="bad">
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <span>표를 읽지 못했습니다 — {previewError}</span>
        </Note>
      )}

      {error && (
        <Note $tone="bad">
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
          <span>{error}</span>
        </Note>
      )}

      {!previewing && !previewError && rows.length > 0 && (
        errorCount > 0 ? (
          <Note $tone="bad">
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span>
              <strong>{errorCount}개 행에 문제가 있어 아직 만들 수 없습니다.</strong>
              {' '}문제가 있는 줄: {badLines.join(', ')}행 — 아래 표에서 붉은 줄을
              고친 뒤 다시 붙여넣으세요. 오류가 하나라도 남아 있으면 설문을
              <strong> 아무것도 만들지 않습니다</strong>(반쯤 만들어진 설문이 가장 나쁩니다).
            </span>
          </Note>
        ) : (
          <Note>
            <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span>
              문항 <strong>{rows.length}개</strong>를 읽었습니다.
              {everyoneCount > 0 && ` 그중 ${everyoneCount}개는 역할·프로세스를 비워 두어 전원에게 보입니다.`}
              {mode === 'append' && selected
                ? ` 아래 표를 눈으로 확인한 뒤 덧붙이세요 — '${selected.title}'의 기존 문항 뒤에 이어 붙고, 응답이 한 건이라도 들어오면 그때부터는 문항을 고칠 수 없습니다.`
                : ' 아래 표를 눈으로 확인한 뒤 만드세요 — 응답이 한 건이라도 들어오면 문항은 고칠 수 없습니다.'}
            </span>
          </Note>
        )
      )}

      {header && (
        headerLooksOdd ? (
          <Note $tone="warn">
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
            <span>
              첫 줄을 머리글로 보고 건너뛰었습니다: <strong>{header.join(' | ')}</strong>.
              머리글이 아니라 문항이었다면 그 문항이 통째로 빠진 것이니, 위에
              머리글 줄(<code>섹션 · 역할 · 프로세스 …</code>)을 한 줄 넣어 주세요.
            </span>
          </Note>
        ) : (
          <Hint>머리글로 보고 건너뛴 첫 줄: {header.join(' | ')}</Hint>
        )
      )}

      {/* 표에 나온 역할·프로세스. '개발'과 '개발팀'처럼 갈린 이름은 서로 다른
          대상이 되어 한쪽 문항이 아무에게도 안 보인다 — 사람이 눈으로 잡는 자리다. */}
      {rows.length > 0 && (
        <>
          <Chips>
            <strong style={{ color: '#475569' }}>표에 나온 역할 {roleCounts.length}종</strong>
            {roleCounts.length === 0
              ? <Muted>없음 — 모든 문항이 전원에게 보입니다</Muted>
              : roleCounts.map(([name, n]) => <Chip key={name}>{name} · {n}문항</Chip>)}
          </Chips>
          <Chips>
            <strong style={{ color: '#475569' }}>표에 나온 프로세스 {processCounts.length}종</strong>
            {processCounts.length === 0
              ? <Muted>없음 — 프로세스는 응답자에게 묻지 않습니다</Muted>
              : processCounts.map(([name, n]) => <Chip key={name}>{name} · {n}문항</Chip>)}
          </Chips>
          <Hint>
            비슷한 이름이 둘로 갈려 있으면 오타입니다. 이름이 다르면 다른 대상으로
            취급되어, 갈린 쪽 문항은 아무에게도 안 보일 수 있습니다.
          </Hint>

          {/* ⚠️ 여기가 중요하다. 위 칩은 '표에 나온' 것이고, 아래는 '응답자에게
              물을' 것이다. 둘은 다르다 — 전원 대상 문항만 답하는 역할(사무국장
              같은)은 표의 역할 열에 안 나타난다. 그 역할을 여기 안 적으면 그
              사람은 역할을 고를 수 없어 **제출 자체가 막힌다.** */}
          <AxisPicker
            label="응답자가 고를 역할"
            options={axisOptions.roles}
            value={splitAxis(axes.roles)}
            onChange={list => {
              setAxes(a => ({ ...a, roles: list.join(', ') }));
              setAxesTouched(t => ({ ...t, roles: true }));
            }}
            emptyMeans="표에 나온 역할을 그대로 씁니다" />
          <AxisPicker
            label="응답자가 고를 프로세스"
            options={axisOptions.processes}
            value={splitAxis(axes.processes)}
            onChange={list => {
              setAxes(a => ({ ...a, processes: list.join(', ') }));
              setAxesTouched(t => ({ ...t, processes: true }));
            }}
            emptyMeans="표에 나온 프로세스를 그대로 씁니다" />
          <Hint>
            표에 <strong>전용 문항이 없는 역할</strong>도 여기 적어야 합니다.
            공통 문항만 답하는 사람도 자기 역할을 골라야 제출할 수 있습니다.
          </Hint>

          {/* 덧붙이기에서 이 칸은 **더하는 자리**이지 바꾸는 자리가 아니다.
              합집합이라는 것을 적어 두지 않으면, 기존 역할이 지워질까 봐
              여기에 전부 다시 적거나 아예 손을 못 대는 일이 생긴다. */}
          {mode === 'append' && selected && (
            <Summary>
              덧붙인 뒤 응답자가 고를 <strong>역할</strong>:{' '}
              {unionRoles.length ? <strong>{unionRoles.join(', ')}</strong> : <Muted>없음</Muted>}
              <br />
              덧붙인 뒤 응답자가 고를 <strong>프로세스</strong>:{' '}
              {unionProcesses.length ? <strong>{unionProcesses.join(', ')}</strong> : <Muted>없음</Muted>}
              <br />
              위 칸에 적은 값은 <strong>기존 설문의 역할·프로세스, 그리고 표에 나온
              역할·프로세스와 합쳐집니다</strong>. 덧붙이기는 <strong>넓히기만</strong>
              하므로, 여기서 이름을 지워도 이미 있는 역할은 사라지지 않습니다
              (좁히려면 설문 수정에서 하세요).
            </Summary>
          )}
        </>
      )}

      {rows.length > 0 && (
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>줄</Th><Th>섹션</Th><Th>역할</Th><Th>프로세스</Th>
                <Th>문항</Th><Th>유형</Th><Th>보기</Th><Th>필수</Th><Th>연결</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const bad = (r.errors || []).length > 0;
                const choices = r.options?.choices || [];
                return (
                  <React.Fragment key={r.line}>
                    <Tr $bad={bad}>
                      <Td>{r.line}</Td>
                      <Td>{r.section || <Muted>—</Muted>}</Td>
                      {/* 빈 배열은 '전원'이다. 빈칸으로 두면 '아무도 안 봄'으로 읽힌다. */}
                      <Td>{r.roles?.length ? r.roles.join(', ') : <Muted>전원</Muted>}</Td>
                      <Td>{r.processes?.length ? r.processes.join(', ') : <Muted>전원</Muted>}</Td>
                      <Td $wrap>{r.text || <Bad>비어 있음</Bad>}</Td>
                      <Td>{r.qtype ? QTYPE_LABEL[r.qtype] || r.qtype : <Bad>알 수 없음</Bad>}</Td>
                      <Td title={choices.join(' | ')}>
                        {choices.length ? `${choices.length}개` : <Muted>—</Muted>}
                      </Td>
                      <Td>{r.required ? '필수' : <Muted>선택</Muted>}</Td>
                      <Td title={r.link_key || ''}>
                        {r.link_key ? linkKeyLabel(r.link_key) : <Muted>—</Muted>}
                      </Td>
                    </Tr>
                    {bad && (
                      <tr>
                        <ErrCell colSpan={9}>
                          {r.errors.map((m, i) => <div key={i}>· {m}</div>)}
                        </ErrCell>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      )}

      <Actions>
        {blockReason && <Hint>{blockReason}</Hint>}
        <Button onClick={onCancel} disabled={creating}>취소</Button>
        {/* 버튼 문구가 모드를 말한다. 「설문 만들기」인 채로 덧붙이면, 누른
            사람은 설문이 하나 더 생긴 줄 안다. */}
        <Button $primary onClick={submit}
                disabled={!!blockReason || creating}
                title={blockReason || (mode === 'append'
                  ? '고른 설문의 문항 뒤에 표의 문항을 이어 붙입니다'
                  : '표에 적힌 문항으로 설문을 만듭니다')}>
          {mode === 'append'
            ? <ListPlus size={14} style={{ verticalAlign: '-2px', marginRight: '0.3rem' }} />
            : <Table2 size={14} style={{ verticalAlign: '-2px', marginRight: '0.3rem' }} />}
          {mode === 'append'
            ? (creating ? '덧붙이는 중…' : `이 설문에 ${rows.length}개 덧붙이기`)
            : (creating ? '만드는 중…' : `설문 만들기${rows.length ? ` (문항 ${rows.length}개)` : ''}`)}
        </Button>
      </Actions>
    </Wrap>
  );
};

export default SurveyImport;
