import React from 'react';
import styled from 'styled-components';
import { ExternalLink, Trash2, Bot, FileUp, Sparkles, Hand, Archive } from 'lucide-react';

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
`;

const Card = styled.article`
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  padding: 0.875rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4375rem;
`;

const Top = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

/* 제목을 눌러 상세(보관된 원문)를 연다. */
const Title = styled.h3`
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  color: #0f172a;
  flex: 1;
  min-width: 12rem;
  cursor: pointer;

  &:hover { color: #4f46e5; text-decoration: underline; }
`;

/* ⚠️ 원문이 담겼는지를 목록에서 바로 보인다. 링크만 있는 줄은 **언젠가 못 읽게
   된다** — 어느 줄이 그런지 알아야 채울 수 있다. */
const Kept = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.125rem;
  color: #0f766e;
  font-size: 0.6875rem;
  font-weight: 600;
`;

const NotKept = styled(Kept)`
  color: #cbd5e1;
  font-weight: 500;
`;

const Meta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-size: 0.75rem;
  color: #64748b;
`;

const Summary = styled.p`
  margin: 0;
  font-size: 0.8125rem;
  line-height: 1.65;
  color: #334155;
`;

const Chips = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3125rem;
  flex-wrap: wrap;
`;

const TechChip = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1875rem 0.5rem;
  border: 1px solid #c7d2fe;
  background: #eef2ff;
  color: #4338ca;
  border-radius: 999px;
  font-size: 0.6875rem;
  font-weight: 600;
  cursor: pointer;

  &:hover { background: #e0e7ff; }

  em { font-style: normal; opacity: 0.65; font-weight: 500; }
`;

const Tag = styled.span`
  padding: 0.125rem 0.4375rem;
  background: #f1f5f9;
  color: #475569;
  border-radius: 0.3125rem;
  font-size: 0.6875rem;
`;

const Link = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  color: #4f46e5;
  font-size: 0.75rem;
  text-decoration: none;

  &:hover { text-decoration: underline; }
`;

const Del = styled.button`
  margin-left: auto;
  border: none;
  background: none;
  color: #cbd5e1;
  cursor: pointer;
  padding: 0.125rem;

  &:hover { color: #dc2626; }
`;

const Empty = styled.div`
  padding: 3rem 1rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.875rem;
  line-height: 1.8;
`;

/**
 * 어디로 들어왔는지를 아이콘으로 보인다.
 *
 * ⚠️ **품질이 다르다.** 사람이 읽고 적은 것과 LLM 이 뽑은 것을 구분 못 하면
 *    나중에 「이거 누가 확인한 거야?」에 답할 수 없다.
 */
const ORIGIN = {
  ui: { icon: Hand, label: '사람이 등록' },
  mcp: { icon: Bot, label: 'MCP 로 들어옴' },
  file: { icon: FileUp, label: '파일로 들어옴' },
  llm: { icon: Sparkles, label: 'AI 가 정리' },
};

const OriginMark = ({ origin }) => {
  const it = ORIGIN[origin] || ORIGIN.ui;
  const Icon = it.icon;
  return <span title={it.label} style={{ display: 'inline-flex', color: '#94a3b8' }}><Icon size={13} /></span>;
};

const NewsList = ({ rows, onTechClick, onDelete, onOpen, canCurate }) => {
  if (!rows.length) {
    return (
      <Empty>
        아직 모인 소식이 없습니다.<br />
        [소식 등록] 으로 넣거나, 바깥에서 조사한 것을 MCP 로 밀어 넣을 수 있습니다.
      </Empty>
    );
  }

  return (
    <Wrap>
      {rows.map((n) => (
        <Card key={n.uuid}>
          <Top>
            <Title onClick={() => onOpen(n)}>{n.title}</Title>
            {/* 발표일이 없으면 '날짜 미상' — 등록일로 채우지 않는다.
                모르는 것과 오늘 나온 것은 다르다. */}
            <Meta>
              <OriginMark origin={n.origin} />
              <span>{n.published_at || '날짜 미상'}</span>
              {n.source && <span>· {n.source}</span>}
              {n.category && <Tag>{n.category}</Tag>}
              {n.hasBody
                ? <Kept title={`원문 ${(n.bodyLength || 0).toLocaleString()}자가 보관돼 있습니다`}>
                    <Archive size={12} /> 원문 보관
                  </Kept>
                : <NotKept title="원문이 안 담겨 있습니다. 링크가 죽으면 제목만 남습니다">
                    <Archive size={12} /> 링크만
                  </NotKept>}
            </Meta>
            {canCurate && (
              <Del onClick={() => onDelete(n)} title="이 소식을 지웁니다">
                <Trash2 size={14} />
              </Del>
            )}
          </Top>

          {n.summary && <Summary>{n.summary}</Summary>}

          <Chips>
            {(n.technologies || []).map((t) => (
              <TechChip key={t.uuid} onClick={() => onTechClick(t)}
                        title="이 기술의 레이더 항목으로 갑니다">
                {t.name} <em>{t.stage}</em>
              </TechChip>
            ))}
            {(n.tags || []).map((t) => <Tag key={t}>#{t}</Tag>)}
            {n.url && (
              <Link href={n.url} target="_blank" rel="noreferrer">
                원문 <ExternalLink size={12} />
              </Link>
            )}
          </Chips>
        </Card>
      ))}
    </Wrap>
  );
};

export default NewsList;
