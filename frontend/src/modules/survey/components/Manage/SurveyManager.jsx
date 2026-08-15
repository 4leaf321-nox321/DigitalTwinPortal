import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Plus, BarChart3, Send, Undo2, Trash2, Pencil, ArrowLeft, X, Table2, ListPlus, UserCog, Eye } from 'lucide-react';
import SurveyEditor from './SurveyEditor';
import SurveyResults from './SurveyResults';
import SurveyImport from './SurveyImport';
import OfficeHeadSettings from './OfficeHeadSettings';
import SurveyPreview from './SurveyPreview';
import surveyApi from '../../services/surveyApi';
import { ACCENT, ACCENT_DARK, ACCENT_TINT, ACCENT_LINE } from '../../theme';

// 설문 관리 — 만들기 · 배포 · 집계.
//
// 응답은 여기서 하지 않는다. 같은 모듈의 다른 얼굴(components/Respond)이고,
// 헤더에서 전환한다.
//
// **연도라는 개념이 없다.** 예전에는 전략의 연도로 목록을 좁혔는데, 설문은
// 전략 전용이 아니다. 지금은 context_type/context_id 로 좁힌다 — 전략에서
// 넘어오면 그 전략(plan.id)의 설문만, 그냥 들어오면 전부 보인다.
// ⚠️ context_id 는 **연도가 아니라 plan.id** 다. 2026 을 넣으면 26번 계획을
//    가리키게 되어 아무것도 안 잡힌다.

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
`;

const Back = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { color: ${ACCENT}; }
`;

const Title = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
`;

const Hint = styled.span`
  font-size: 0.8125rem;
  color: #94a3b8;
`;

const ContextChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.5rem;
  border: 1px solid ${ACCENT_LINE};
  border-radius: 0.3rem;
  background: ${ACCENT_TINT};
  color: ${ACCENT_DARK};
  font-size: 0.75rem;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  &:hover { border-color: ${ACCENT}; }
`;

// 만들기 버튼 둘을 한 덩어리로 묶어 오른쪽에 붙인다. 「표로 만들기」와
// 「새 설문」은 같은 일(설문 만들기)의 두 갈래라 떨어져 있으면 안 보인다.
const HeadActions = styled.div`
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

// 표 붙여넣기는 점선 버튼이다. 한 벌 만들 때의 정석은 「새 설문」이고,
// 표는 문항이 수십 개일 때 쓰는 길이라 강조를 한 단계 낮춘다.
const GhostButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.45rem 0.85rem;
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

const AddButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.45rem 0.85rem;
  border: none;
  border-radius: 0.375rem;
  background: ${ACCENT};
  color: white;
  font-size: 0.8125rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  &:hover { background: ${ACCENT_DARK}; }
`;

const Card = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 0.875rem 1.125rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const Body = styled.div`
  flex: 1;
  min-width: 0;
`;

const CardTitle = styled.div`
  font-size: 0.9375rem;
  font-weight: 600;
  color: #1e293b;
`;

const Meta = styled.div`
  display: flex;
  gap: 0.375rem;
  margin-top: 0.35rem;
  flex-wrap: wrap;
`;

const Tag = styled.span`
  padding: 0.1rem 0.45rem;
  border-radius: 0.25rem;
  font-size: 0.6875rem;
  font-weight: 700;
  background: ${p => p.$bg || '#f1f5f9'};
  color: ${p => p.$fg || '#64748b'};
`;

const Buttons = styled.div`
  display: flex;
  gap: 0.25rem;
  flex-shrink: 0;
`;

const IconButton = styled.button`
  padding: 0.35rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.375rem;
  background: white;
  color: #64748b;
  cursor: pointer;
  display: flex;
  &:hover:not(:disabled) { border-color: ${ACCENT}; color: ${ACCENT}; }
  /* 못 누르는 버튼은 **감추지 않고** 흐리게 둔다. 감추면 어떤 카드에만 있는
     이유를 아무도 모르고, 흐리게 두면 title 로 이유를 읽을 수 있다. */
  &:disabled { opacity: 0.35; cursor: not-allowed; }
`;

const Panel = styled.div`
  padding: 1.125rem;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
`;

const Empty = styled.div`
  padding: 2rem 1.25rem;
  text-align: center;
  color: #94a3b8;
  background: white;
  border: 1px dashed #cbd5e1;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  line-height: 1.7;
`;

const ErrorBox = styled.div`
  padding: 0.75rem 1rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  color: #b91c1c;
  font-size: 0.8125rem;
`;

// 덧붙이기는 카드의 「문항 N개」가 조용히 늘어나는 것 말고는 눈에 띄는 변화가
// 없다. 눌렀는데 아무 말도 없으면 됐는지 안 됐는지 알 수 없어 한 번 더 누른다.
const NoticeBox = styled.div`
  padding: 0.75rem 1rem;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 0.5rem;
  color: #15803d;
  font-size: 0.8125rem;
  line-height: 1.6;
`;

const STATUS = {
  draft: { label: '작성 중', bg: '#f1f5f9', fg: '#64748b' },
  open: { label: '응답 받는 중', bg: '#dcfce7', fg: '#15803d' },
  closed: { label: '마감', bg: '#f1f5f9', fg: '#94a3b8' },
};

const SurveyManager = ({ context, contextLabel, divisions = [], onClearContext }) => {
  const [surveys, setSurveys] = useState([]);
  const [view, setView] = useState({ mode: 'list' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await surveyApi.listSurveys(context);
      setSurveys(res.data || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [context]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn) => {
    setError(null);
    try {
      await fn();
      await load();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    }
  };

  const save = async (payload) => {
    const ok = await run(() => (
      view.survey
        ? surveyApi.updateSurvey(view.survey.id, payload)
        // 새로 만들 때만 context 를 싣는다. 수정할 때 같이 보내면 다른 화면에서
        // 만든 설문이 지금 보고 있는 맥락으로 조용히 옮겨 붙는다.
        : surveyApi.createSurvey({ ...payload, ...(context || {}) })
    ));
    if (ok) setView({ mode: 'list' });
  };

  // 표에서 통째로 만들기 / 이미 있는 설문에 덧붙이기. 오류가 하나라도 있으면
  // 서버가 400 을 주고 아무것도 만들지 않는다 — 그 오류를 화면 안(SurveyImport)
  // 에서 줄 단위로 보여줘야 하므로 여기서 run() 으로 삼키지 않고 promise 를
  // 그대로 넘긴다.
  const importFromTable = (payload) => {
    const { survey_id: surveyId, ...rest } = payload;
    // ⚠️ 덧붙일 때는 context 를 **싣지 않는다.** save() 와 같은 규칙이다 —
    //    다른 화면에서 만든 설문이 지금 보고 있는 맥락으로 조용히 옮겨 붙으면
    //    원래 있던 목록에서 사라진다.
    if (surveyId) return surveyApi.appendImport(surveyId, rest);
    // 새로 만들 때만 context 를 싣는다.
    return surveyApi.importSurvey({ ...rest, ...(context || {}) });
  };

  const afterImport = async (data) => {
    // 만든(덧붙인) 설문이 목록에 보여야 한다. 목록으로 먼저 돌아가고 다시
    // 읽는다 — 덧붙이기는 문항 수가 바뀌므로 다시 읽지 않으면 카드의 「문항 N개」
    // 가 옛 숫자로 남아 덧붙이기가 안 된 것처럼 보인다.
    //
    // 알림은 **view 에 실어 둔다.** 따로 상태로 두면 다른 화면에 갔다 돌아왔을
    // 때까지 남아, 방금 한 일처럼 읽힌다. view 를 바꾸면 저절로 사라진다.
    // 개수는 서버가 저장된 결과에서 센 값(appended_count)을 그대로 쓴다.
    const notice = data?.appended_count != null
      ? `'${data.title}'에 문항 ${data.appended_count}개를 덧붙였습니다 — 이제 문항 ${data.question_count}개입니다.`
      : null;
    setView({ mode: 'list', notice });
    await load();
  };

  const openEditor = async (survey) => {
    if (!survey) return setView({ mode: 'edit', survey: null });
    // 목록에는 문항이 없다. 편집하려면 문항까지 받아야 한다.
    try {
      const res = await surveyApi.getSurvey(survey.id);
      // ⚠️ response_count 를 목록 행에서 옮겨 붙인다. 단건 조회는 target_count 만
      //    싣고 response_count 를 안 준다 — 이 줄이 없으면 응답이 있는 설문의
      //    문항 잠금(SurveyEditor 의 locked)이 풀려서, 화면에서는 고칠 수 있는데
      //    저장할 때 409 를 받는 상태가 된다.
      setView({ mode: 'edit', survey: { ...res.data, response_count: survey.response_count } });
    } catch (e) {
      setError(e.message);
    }
  };

  const openPreview = async (survey) => {
    // 목록에는 문항이 없다. 미리보기는 문항이 있어야 하므로 단건으로 받는다.
    setError(null);
    try {
      const res = await surveyApi.getSurvey(survey.id);
      setView({ mode: 'preview', survey: res.data });
    } catch (e) {
      setError(e.message);
    }
  };

  const openResults = async (survey) => {
    setView({ mode: 'results', survey, results: null });
    try {
      const res = await surveyApi.getSurveyResults(survey.id);
      setView({ mode: 'results', survey, results: res.data });
    } catch (e) {
      setError(e.message);
    }
  };

  const reveal = async () => {
    try {
      const res = await surveyApi.getSurveyIdentities(view.survey.id);
      return res.data;
    } catch (e) {
      setError(e.message);
      return null;
    }
  };

  if (view.mode === 'results') {
    return (
      <Wrap>
        {error && <ErrorBox>{error}</ErrorBox>}
        <SurveyResults
          results={view.results}
          divisions={divisions}
          onBack={() => setView({ mode: 'list' })}
          onReveal={reveal}
          onExport={() => surveyApi.exportResponses(view.survey.id).catch(e => setError(e.message))}
        />
      </Wrap>
    );
  }

  if (view.mode === 'preview') {
    return (
      <Wrap>
        {error && <ErrorBox>{error}</ErrorBox>}
        <SurveyPreview survey={view.survey} onBack={() => setView({ mode: 'list' })} />
      </Wrap>
    );
  }

  if (view.mode === 'office-heads') {
    return (
      <Wrap>
        <OfficeHeadSettings onBack={() => setView({ mode: 'list' })} />
      </Wrap>
    );
  }

  if (view.mode === 'import') {
    return (
      <Wrap>
        <Back onClick={() => setView({ mode: 'list' })}>
          <ArrowLeft size={15} /> 설문 목록
        </Back>
        {/* 제목에 모드를 적지 않는다. 모드는 화면 안에서 언제든 바뀌는데,
            바깥 제목은 처음 들어온 모드로 남아 서로 다른 말을 하게 된다. */}
        <Title>표 붙여넣기</Title>
        {error && <ErrorBox>{error}</ErrorBox>}
        <Panel>
          <SurveyImport
            onCreate={importFromTable}
            onCreated={afterImport}
            onCancel={() => setView({ mode: 'list' })}
            // 목록을 그대로 넘긴다. 덧붙일 설문을 고르려고 같은 목록을 다시
            // 부르면, 카드에 적힌 응답 수와 고르는 화면의 응답 수가 어긋난다.
            surveys={surveys}
            initialMode={view.importMode || 'create'}
            initialSurveyId={view.importSurveyId ?? null}
          />
        </Panel>
      </Wrap>
    );
  }

  if (view.mode === 'edit') {
    return (
      <Wrap>
        <Back onClick={() => setView({ mode: 'list' })}>
          <ArrowLeft size={15} /> 설문 목록
        </Back>
        <Title>{view.survey ? '설문 수정' : '새 설문'}</Title>
        {error && <ErrorBox>{error}</ErrorBox>}
        <Panel>
          <SurveyEditor
            survey={view.survey}
            onSave={save}
            onCancel={() => setView({ mode: 'list' })}
          />
        </Panel>
      </Wrap>
    );
  }

  return (
    <Wrap>
      <Head>
        <Title>설문 관리</Title>
        {context && (
          // 좁혀 보고 있다는 사실과 푸는 방법을 같이 둔다. 필터가 걸린 줄
          // 모르면 "만든 설문이 목록에 없다"로 읽힌다.
          <ContextChip onClick={onClearContext} title="맥락 필터를 풀고 전체를 봅니다">
            {contextLabel || '특정 맥락'}의 설문만 <X size={12} />
          </ContextChip>
        )}
        <Hint>
          시스템이 모르는 것을 사람에게 묻습니다. 응답은 전 직원이 「내 설문」에서 합니다.
        </Hint>
        <HeadActions>
          <GhostButton
            onClick={() => setView({ mode: 'import', importMode: 'create' })}
            title="엑셀에서 복사한 표를 붙여넣어 문항을 한 번에 만듭니다. 그 화면에서 기존 설문에 덧붙일 수도 있습니다">
            <Table2 size={15} /> 표로 만들기
          </GhostButton>
          {/* 사무국장만 권한으로 구분되지 않아 따로 지정한다. 나머지 역할은
              데이터에서 유도된다. */}
          <GhostButton
            onClick={() => setView({ mode: 'office-heads' })}
            title="사무국장으로 볼 사람을 지정합니다. 나머지 역할은 과제·권한 데이터에서 자동으로 판정됩니다">
            <UserCog size={15} /> 사무국장 지정
          </GhostButton>
          <AddButton onClick={() => openEditor(null)}>
            <Plus size={15} /> 새 설문
          </AddButton>
        </HeadActions>
      </Head>

      {error && <ErrorBox>{error}</ErrorBox>}
      {view.notice && <NoticeBox>{view.notice}</NoticeBox>}

      {loading ? (
        <Empty>불러오는 중…</Empty>
      ) : surveys.length === 0 ? (
        <Empty>
          아직 설문이 없습니다.<br />
          진단의 <strong>조직 역량 5축</strong>은 시스템이 알 방법이 없어 설문이
          정석입니다 — 새 설문에서 <strong>「조직 역량 5축으로 채우기」</strong>를
          누르면 문항이 한 번에 만들어집니다.<br />
          역할·프로세스별로 묻는 문항이 수십 개라면 <strong>「표로 만들기」</strong>에
          엑셀 표를 붙여넣으세요.
        </Empty>
      ) : (
        surveys.map(s => {
          const st = STATUS[s.status] || STATUS.draft;
          return (
            <Card key={s.id}>
              <Body>
                <CardTitle>{s.title}</CardTitle>
                <Meta>
                  <Tag $bg={st.bg} $fg={st.fg}>{st.label}</Tag>
                  <Tag>문항 {s.question_count}개</Tag>
                  <Tag>응답 {s.response_count} / 대상 {s.target_count}</Tag>
                </Meta>
              </Body>
              <Buttons>
                {/* 배포하면 응답이 드는 순간 문항이 잠긴다. 그 전에
                    응답자가 뭘 받는지 볼 수 있어야 한다. */}
                <IconButton onClick={() => openPreview(s)}
                            title="응답자가 무엇을 보는지 미리 봅니다">
                  <Eye size={15} />
                </IconButton>
                <IconButton onClick={() => openResults(s)} title="집계 보기">
                  <BarChart3 size={15} />
                </IconButton>
                {/* 표를 여러 벌 만들어 한 설문에 얹는 것이 실제 흐름이라,
                    카드에서 바로 덧붙이기로 들어갈 수 있어야 한다. 응답이
                    있으면 문항을 못 바꾸므로(서버 409) 여기서 미리 막고
                    이유를 title 에 적는다. */}
                <IconButton
                  onClick={() => setView({
                    mode: 'import', importMode: 'append', importSurveyId: s.id,
                  })}
                  disabled={s.response_count > 0}
                  title={s.response_count > 0
                    ? `응답 ${s.response_count}건 — 문항을 바꿀 수 없습니다`
                    : '표를 붙여넣어 이 설문에 문항을 덧붙입니다'}>
                  <ListPlus size={15} />
                </IconButton>
                <IconButton onClick={() => openEditor(s)} title="수정">
                  <Pencil size={15} />
                </IconButton>
                {s.status === 'open' ? (
                  <IconButton
                    onClick={() => run(() => surveyApi.setSurveyStatus(s.id, 'closed'))}
                    title="마감 — 더 이상 응답을 받지 않습니다">
                    <Undo2 size={15} />
                  </IconButton>
                ) : (
                  <IconButton
                    onClick={() => run(() => surveyApi.setSurveyStatus(s.id, 'open'))}
                    title="배포 — 대상자에게 보이기 시작합니다">
                    <Send size={15} />
                  </IconButton>
                )}
                <IconButton
                  onClick={() => {
                    // 백엔드가 응답까지 cascade 로 지운다. 아이콘 오클릭 한 번에
                    // 모은 응답이 전부 사라지므로 반드시 되묻는다.
                    const extra = s.response_count > 0
                      ? `

이미 받은 응답 ${s.response_count}건도 함께 사라지며 되돌릴 수 없습니다.`
                      : '';
                    if (!window.confirm(`'${s.title}' 설문을 삭제할까요?${extra}`)) return;
                    run(() => surveyApi.deleteSurvey(s.id));
                  }}
                  title="삭제">
                  <Trash2 size={15} />
                </IconButton>
              </Buttons>
            </Card>
          );
        })
      )}
    </Wrap>
  );
};

export default SurveyManager;
