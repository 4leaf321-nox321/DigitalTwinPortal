import React from 'react';
import styled from 'styled-components';
import { Newspaper, AlertTriangle, Unlink, HelpCircle } from 'lucide-react';

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
 *
 * ⚠️⚠️ **지금 탭에서 볼 수 있는 것만 띄운다**(2026-08-25 신고: 「레이더 탭의 소식
 *    버튼이 애매하다」). 레이더를 보는 중에 「신규 소식」을 눌러 봐야 **소식 탭으로
 *    튀어 나간다** — 지금 화면과 상관없는 단추가 섞여 있으면 이 막대가 무엇을
 *    말하는 것인지부터 흐려진다.
 *
 * ⚠️⚠️ 셈은 **눌렀을 때 보이는 것**과 같아야 한다. 기술 셈은 서버가 「레이더에 서는
 *    줄」로만 센다(역량 + 안 매달린 도구) — 전체 322줄을 세던 때는 「기술 322」라고
 *    써 놓고 레이더에는 63개만 떴다.
 */
const OverviewBar = ({ data, active, onPick, tab = 'news' }) => {
  if (!data) return null;

  const isNews = tab === 'news';
  const items = [
    { key: 'unread', on: isNews, n: data.unreadNews, icon: Newspaper,
      label: '신규 소식', color: '#4f46e5', bg: '#eef2ff',
      why: '아직 아무도 안 읽은 소식입니다. 읽고 「확인됨」으로 옮겨 주세요' },
    { key: 'stale', on: !isNews, n: data.staleTech, icon: AlertTriangle,
      label: '낡은 기술', color: '#b45309', bg: '#fffbeb',
      why: '근거가 오래 없어 아직 유효한 판단인지 확인할 때가 됐습니다' },
    /*
      ⚠️⚠️ **「최근 N일 단계 이동」은 여기 없다.** 레이더 오른쪽 위의 시간 단추가
         이미 같은 것을 다루는데(켜고 끄기 · 기간 고르기), 거르기만 여기 따로
         있으면 **시간에 관한 것이 두 군데로 갈린다**(2026-08-25 신고).
         거르기는 그 시간 단추 밑으로 옮겼다 — 지운 것이 아니다.
    */
    { key: 'unlinked', on: isNews, n: data.unlinkedNews, icon: Unlink,
      label: '미연결 소식', color: '#7c3aed', bg: '#f5f3ff',
      why: '아직 과제·지표와 안 이어졌습니다. AI 정리로 후보를 받아 보세요' },
  ].filter((it) => it.on && (it.n || 0) > 0);

  if (!items.length) {
    return (
      <Bar>
        <Quiet>
          {isNews
            ? `지금 손볼 소식이 없습니다 — 안 읽은 것도, 안 이어진 것도 없습니다. (소식 ${data.totalNews}건)`
            : `지금 손볼 기술이 없습니다 — 근거가 낡은 것이 없습니다. (레이더 ${data.totalTech}개)`}
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
      {/*
        ⚠️ 「기술 322」는 거짓말이었다 — 레이더에는 63개만 선다. 레이더에 서는 수를
           적고, 접힌 도구는 **따로** 말한다.
      */}
      {/* ⚠️ **괄호 안은 앞 숫자의 내역이다.** 안 맞으면 둘 다 못 믿게 된다. */}
      <Quiet title={isNews ? '전체 소식'
        : '레이더에 서는 수 = 역량 + 아직 어느 역량에도 안 매단 도구'}>
        <HelpCircle size={11} style={{ verticalAlign: '-0.1em' }} />{' '}
        {isNews
          ? `소식 ${data.totalNews}건`
          : `레이더 ${data.totalTech}개 (역량 ${data.capabilityCount}`
            + ` · 미연결 도구 ${data.orphanToolCount ?? 0})`
            + ` · 도구 전체 ${data.toolCount}`}
      </Quiet>
    </Bar>
  );
};

export default OverviewBar;
