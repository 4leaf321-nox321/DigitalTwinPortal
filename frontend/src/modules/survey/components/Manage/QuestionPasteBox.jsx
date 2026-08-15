import React, { useState } from 'react';
import styled from 'styled-components';
import { Table2, AlertTriangle, Loader2 } from 'lucide-react';
import surveyApi from '../../services/surveyApi';
import { STRATEGY_DIMENSION_LINK } from '../../constants/questionTemplates';
import { ACCENT, ACCENT_DARK, ACCENT_LINE, ACCENT_TINT } from '../../theme';

// 편집기 안에서 **표로 문항을 여러 개 넣는 자리.**
//
// 「문항 추가」는 한 번에 하나다. 수십 문항을 그렇게 넣을 수는 없는데, 표
// 붙여넣기는 별도 화면(SurveyImport)에 있어서 **새 설문을 만드는 중에는 쓸 수가
// 없었다.** 만들다 말고 나가서 표로 새 설문을 만들거나, 저장한 뒤 덧붙이기로
// 돌아와야 했다.
//
// ⚠️ **파싱은 서버가 한다**(/manage/import/preview). 화면에서 따로 쪼개면
//    표 붙여넣기 화면과 규칙이 갈리고, 같은 표가 들어온 경로에 따라 다른
//    문항이 된다. 미리보기 API 는 아무것도 저장하지 않으므로 아직 만들지 않은
//    설문에서도 부를 수 있다 — 그게 이 자리에서 쓸 수 있는 이유다.
//
// 여기서 넣은 문항은 **아직 저장되지 않는다.** 목록에 붙을 뿐이고, 저장은
// 평소처럼 아래 저장 버튼이 한다. 그래서 넣고 나서 손으로 고칠 수 있다.

const Box = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  background: ${ACCENT_TINT};
  border: 1px dashed ${ACCENT_LINE};
  border-radius: 0.5rem;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8125rem;
  font-weight: 700;
  color: ${ACCENT_DARK};
`;

const Cols = styled.code`
  font-size: 0.6875rem;
  color: #475569;
  background: white;
  border: 1px solid ${ACCENT_LINE};
  border-radius: 0.3rem;
  padding: 0.3rem 0.45rem;
  line-height: 1.6;
`;

const Paste = styled.textarea`
  width: 100%;
  min-height: 7rem;
  padding: 0.6rem 0.7rem;
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

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: flex-end;
  flex-wrap: wrap;
`;

const Msg = styled.div`
  flex: 1;
  min-width: 12rem;
  font-size: 0.75rem;
  line-height: 1.6;
  color: ${p => (p.$bad ? '#b91c1c' : '#64748b')};
`;

const Errors = styled.ul`
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.75rem;
  line-height: 1.65;
  color: #b91c1c;
`;

const Button = styled.button`
  padding: 0.4rem 0.85rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid ${p => (p.$primary ? 'transparent' : '#cbd5e1')};
  background: ${p => (p.$primary ? ACCENT : 'white')};
  color: ${p => (p.$primary ? 'white' : '#64748b')};
  &:hover { opacity: 0.9; }
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

/** 미리보기 행 → 편집기가 쓰는 문항 모양.
 *
 *  ⚠️ 연결키가 있으면 link_type 을 같이 달아야 한다. 안 달면 백엔드가
 *     **에러 없이 저장하고 link 만 NULL 로** 둔다 — 겉보기엔 멀쩡한데 진단
 *     연결이 영영 안 되는, 제일 잡기 어려운 종류의 고장이다. */
const rowToQuestion = (row) => ({
  text: row.text || '',
  help_text: row.help_text || '',
  qtype: row.qtype || 'scale',
  required: row.required !== false,
  options: row.options || {},
  section: row.section || '',
  audience_roles: row.roles || [],
  audience_processes: row.processes || [],
  link_type: row.link_key ? STRATEGY_DIMENSION_LINK : null,
  link_key: row.link_key || null,
});

const QuestionPasteBox = ({ onAdd, onClose }) => {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const read = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await surveyApi.previewImport(text);
      setPreview(res?.data || null);
    } catch (e) {
      setError(e.message);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const rows = preview?.rows || [];
  const errorRows = rows.filter(r => (r.errors || []).length > 0);
  const ok = rows.length > 0 && errorRows.length === 0;

  const add = () => {
    onAdd(rows.map(rowToQuestion));
    setText('');
    setPreview(null);
    onClose?.();
  };

  return (
    <Box>
      <Head><Table2 size={15} /> 표로 문항 추가</Head>
      <Cols>섹션 · 역할 · 프로세스 · 문항 · 유형 · 보기 · 필수 · 도움말 · 연결키</Cols>
      <Msg>
        엑셀에서 복사해 붙여넣으세요. 첫 줄은 머리글로 보고 건너뜁니다.
        역할·프로세스를 비우면 <strong>전원</strong>이 봅니다.
        {' '}여기서 넣은 문항은 <strong>아직 저장되지 않습니다</strong> — 목록에
        붙기만 하고, 손으로 고친 뒤 아래 저장을 누르세요.
      </Msg>
      <Paste
        value={text}
        onChange={e => { setText(e.target.value); setPreview(null); }}
        placeholder={'섹션\t역할\t프로세스\t문항\t유형\t보기\t필수\t도움말\t연결키'} />

      {errorRows.length > 0 && (
        <Errors>
          {errorRows.slice(0, 8).flatMap(r => (r.errors || []).map((m, i) => (
            <li key={`${r.line}-${i}`}>{m}</li>
          )))}
          {errorRows.length > 8 && <li>… 그 외 {errorRows.length - 8}개 행</li>}
        </Errors>
      )}

      <Row>
        <Msg $bad={!!error || errorRows.length > 0}>
          {error ? error
            : errorRows.length > 0
              ? `${errorRows.length}개 행에 문제가 있어 아직 넣을 수 없습니다.`
              : preview
                ? `문항 ${rows.length}개를 읽었습니다.`
                : ''}
        </Msg>
        <Button onClick={onClose}>닫기</Button>
        <Button onClick={read} disabled={busy || !text.trim()}>
          {busy ? <Loader2 size={13} /> : null} 읽기
        </Button>
        <Button $primary onClick={add} disabled={!ok}>
          {ok ? `문항 ${rows.length}개 넣기` : '문항 넣기'}
        </Button>
      </Row>

      {!preview && text.trim() && (
        <Msg>
          <AlertTriangle size={12} /> 「읽기」를 눌러 확인한 뒤 넣을 수 있습니다.
        </Msg>
      )}
    </Box>
  );
};

export default QuestionPasteBox;
