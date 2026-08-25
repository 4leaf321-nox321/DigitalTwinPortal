import React from 'react';
import styled from 'styled-components';
import { Newspaper, AlertTriangle, ArrowUpRight, Unlink, HelpCircle } from 'lucide-react';

const Bar = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

/**
 * ⚠️ 숫자를 **누를 수 있게** 만든다. 「안 읽은 6건」을 보여만 주고 찾아가게 하면
 *    아무도 안 간다 — 누르면 그 필터가 걸려야 「할 일」이 된다.
 */
const Card = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4375rem;
  padding: 0.4375rem 0.6875rem;
  border: 1px solid ${(p) => (p.$on ? p.$color : '#e2e8f0')};
  background: ${(p) => (p.$on ? p.$bg : '#fff')};
  border-radius: 0.5rem;
  cursor: pointer;
  text-align: left;
  font: inherit;

  &:hover { border-color: ${(p) => p.$color}; }
  &:disabled { opacity: 0.5; cursor: default; }

  svg { color: ${(p) => p.$color}; flex-shrink: 0; }
  b {
    font-size: 0.9375rem;
    color: #0f172a;
    font-variant-numeric: tabular-nums;
  }
  span { font-size: 0.75rem; color: #64748b; }
`;

const Quiet = styled.div`
  padding: 0.4375rem 0.6875rem;
  border: 1px dashed #e2e8f0;
  border-radius: 0.5rem;
  font-size: 0.75rem;
  color: #94a3b8;
`;

/**
 * 「오늘 뭘 봐야 하나」.
 *
 * ⚠️ 열면 기술 100여 개와 소식 수십 건이 깔린다. **무엇을 봐야 하는지가 없으면
 *    사람은 훑다가 닫는다.** 전부 이미 계산되는 값이라 세기만 하면 된다.
 *
 * ⚠️ 0 인 칸은 **아예 안 보인다.** 「낡은 것 0」을 늘 띄우면 눈이 그 자리를 지나치게
 *    되고, 진짜로 1이 됐을 때도 안 보인다.
 */
const OverviewBar = ({ data, active, onPick }) => {
  if (!data) return null;

  const items = [
    { key: 'unread', n: data.unreadNews, icon: Newspaper,
      label: '안 읽은 소식', color: '#4f46e5', bg: '#eef2ff',
      why: '아직 아무도 안 읽은 소식입니다. 읽고 「확인됨」으로 옮겨 주세요' },
    { key: 'stale', n: data.staleTech, icon: AlertTriangle,
      label: '낡은 기술', color: '#b45309', bg: '#fffbeb',
      why: '근거가 오래 없어 아직 유효한 판단인지 확인할 때가 됐습니다' },
    { key: 'moved', n: data.movedIn30d, icon: ArrowUpRight,
      label: '최근 30일 단계 이동', color: '#0f766e', bg: '#f0fdfa',
      why: '최근 한 달 안에 단계가 바뀐 기술입니다' },
    { key: 'unlinked', n: data.unlinkedNews, icon: Unlink,
      label: '우리 것과 안 이어진 소식', color: '#7c3aed', bg: '#f5f3ff',
      why: '아직 과제·지표와 안 이어졌습니다. AI 정리로 후보를 받아 보세요' },
  ].filter((it) => (it.n || 0) > 0);

  if (!items.length) {
    return (
      <Bar>
        <Quiet>
          지금 손볼 것이 없습니다 — 안 읽은 소식도, 낡은 기술도 없습니다.
          (소식 {data.totalNews}건 · 기술 {data.totalTech}개)
        </Quiet>
      </Bar>
    );
  }

  return (
    <Bar>
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <Card key={it.key} type="button" title={it.why}
                $on={active === it.key} $color={it.color} $bg={it.bg}
                onClick={() => onPick(active === it.key ? '' : it.key)}>
            <Icon size={15} />
            <b>{it.n}</b>
            <span>{it.label}</span>
          </Card>
        );
      })}
      <Quiet title="전체 규모">
        <HelpCircle size={11} style={{ verticalAlign: '-0.1em' }} />{' '}
        소식 {data.totalNews} · 기술 {data.totalTech}
      </Quiet>
    </Bar>
  );
};

export default OverviewBar;
