import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import styled from 'styled-components';
import { Table2, Wand2, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import surveyApi from '../../services/surveyApi';
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

const SurveyImport = ({ onCreate, onCreated, onCancel }) => {
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
  const [axes, setAxes] = useState({ roles: '', processes: '' });
  // 표를 다시 붙여넣어 새 역할이 나오면 아직 손대지 않은 칸만 따라 채운다.
  const [axesTouched, setAxesTouched] = useState({ roles: false, processes: false });
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

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

  // 왜 막혔는지를 문장으로 만든다. 비활성 버튼만 두면 사용자는 이유를 모른다.
  const blockReason =
    !form.title.trim() ? '제목을 적어야 만들 수 있습니다'
      : previewing ? '표를 읽는 중입니다'
        : previewError ? '표를 읽지 못해 확인이 끝나지 않았습니다'
          : rows.length === 0 ? '표를 붙여넣어야 합니다'
            : errorCount > 0 ? `오류가 있는 ${errorCount}개 행을 먼저 고쳐 주세요`
              : null;

  const fillExample = () => {
    // 붙여넣은 것이 있으면 되묻는다. 예시로 덮으면 원문은 되돌릴 수 없다.
    if (text.trim() && !window.confirm('붙여넣은 표를 예시로 바꿀까요? 지금 내용은 사라집니다.')) return;
    setText(EXAMPLE_TEXT);
  };

  const create = async () => {
    if (blockReason) return;
    const refs = form.target_refs
      .split(',').map(s => s.trim()).filter(Boolean)
      .map(s => (/^\d+$/.test(s) ? Number(s) : s));
    const payload = {
      title: form.title.trim(),
      description: form.description || null,
      target_type: form.target_type,
      target_refs: form.target_type === 'all' ? [] : refs,
      text,
    };
    // 비면 안 싣는다 — 서버가 표에서 유도하게 둔다.
    const splitAxis = (v) => v.split(',').map(x => x.trim()).filter(Boolean);
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
              {' '}아래 표를 눈으로 확인한 뒤 만드세요 — 응답이 한 건이라도 들어오면 문항은 고칠 수 없습니다.
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
          <Field>
            응답자가 고를 역할 (쉼표로 구분)
            <Input
              value={axes.roles}
              onChange={e => {
                setAxes(a => ({ ...a, roles: e.target.value }));
                setAxesTouched(t => ({ ...t, roles: true }));
              }}
              placeholder="비우면 표에 나온 역할을 그대로 씁니다" />
          </Field>
          <Field>
            응답자가 고를 프로세스 (쉼표로 구분)
            <Input
              value={axes.processes}
              onChange={e => {
                setAxes(a => ({ ...a, processes: e.target.value }));
                setAxesTouched(t => ({ ...t, processes: true }));
              }}
              placeholder="비우면 표에 나온 프로세스를 그대로 씁니다" />
          </Field>
          <Hint>
            표에 <strong>전용 문항이 없는 역할</strong>도 여기 적어야 합니다.
            공통 문항만 답하는 사람도 자기 역할을 골라야 제출할 수 있습니다.
          </Hint>
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
        <Button $primary onClick={create}
                disabled={!!blockReason || creating}
                title={blockReason || '표에 적힌 문항으로 설문을 만듭니다'}>
          <Table2 size={14} style={{ verticalAlign: '-2px', marginRight: '0.3rem' }} />
          {creating ? '만드는 중…' : `설문 만들기${rows.length ? ` (문항 ${rows.length}개)` : ''}`}
        </Button>
      </Actions>
    </Wrap>
  );
};

export default SurveyImport;
