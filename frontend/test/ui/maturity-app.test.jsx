// 성숙도 앱을 통째로 띄워 본다 — 부문·탭·모드·창을 한 바퀴(2026-08-30).
//
// **왜 있나.** 다른 클릭 시험은 부품만 띄운다. 그래서 앱을 짜 맞추는 자리에서 나는 사고를
// 못 잡았다 — 2026-08-29 `sector` 와 2026-08-30 `wordDraft` 두 번 다 「초기화 전에 접근」
// (TDZ) 이었고, 첫 번째는 시험을 전부 통과한 뒤 브라우저에서야 터졌다. 훑는 시험 하나면
// 그 부류가 다 걸린다.
//
// 답은 **샘플 자료**(sample-data.json)로 준다 — 화면이 실제로 쓰는 모든 경로가 이미 거기
// 키로 들어 있어, 빈 화면이 아니라 자료가 찬 화면을 그려 본다.
//
// ⚠️ 한 걸음마다 따로 잡는다. 한 곳이 터져도 나머지를 계속 훑어야 어디까지 성한지 안다.
import './setup-dom.mjs';   // ⚠️ 반드시 첫 import
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, click, settle, byText, html, fakeFetch, suite, unmount } from './dom-helpers.mjs';
import DevDtMaturityApp from '../../src/modules/dev-dt-maturity/DevDtMaturityApp';
import SAMPLE from '../../src/modules/dev-dt-maturity/sample/sample-data.json';

/** 샘플에서 답을 찾는다 — 똑같은 주소가 없으면 물음표 앞이 같은 것으로. */
const PROPOSALS = [{ id: 1, pair_id: 5, division_id: 17, kind: 'assess', axis: 'scope',
  axis_label: '적용 범위', sector: 'simulation', subject_name: '낙하 시험', agent_name: '낙하 해석',
  payload: { rung: 'basic' }, note: 'AI 가 적은 근거', now: null, actor_name: '홍',
  created_at: '2026-08-30T10:00:00', status: 'pending' }];

const answer = (url) => {
  const path = decodeURIComponent(String(url)).replace(/^.*\/api\/dev-dt-maturity/, '');
  // 확인 대기 — 샘플에는 없다. 헤더 단추가 뜨게 만들어 **제 창이 열리는지** 본다.
  if (path.startsWith('/proposals/count')) return { pending: PROPOSALS.length };
  if (path.startsWith('/proposals')) return PROPOSALS;
  if (path in SAMPLE) return SAMPLE[path];
  const base = path.split('?')[0];
  const near = Object.keys(SAMPLE).find(k => k.split('?')[0] === base);
  return near ? SAMPLE[near] : [];
};

const SECTORS = ['시뮬레이션', '모니터링', '디지털 스레드'];   // 척도가 선 부문
const MODES = ['요약', '상세', '변화', '모판'];

// jsdom 은 크기가 0 이라 recharts 가, 라우터는 v7 안내를 쏟는다 — 이 시험의 관심사가 아니다.
const NOISE = ['width(', 'React Router Future Flag'];
const quiet = (fn) => {
  const [w, e] = [console.warn, console.error];
  const skip = (orig) => (...a) => { if (!NOISE.some(n => String(a[0] || '').includes(n))) orig(...a); };
  console.warn = skip(w); console.error = skip(e);
  return fn().finally(() => { console.warn = w; console.error = e; });
};

export default async function run() {
  const { say, done } = suite();
  fakeFetch(({ url }) => answer(url));
  return quiet(async () => {

  /** 한 걸음 — 터져도 여기서 잡고 다음으로 간다. */
  const step = async (name, fn) => {
    try {
      await fn();
      const body = html();
      if (!body || body.length < 50) throw new Error('화면이 비었습니다');
      say(true, name);
    } catch (e) {
      say(false, `${name} — ${String(e.message || e).split('\n')[0]}`);
    }
  };

  const open = async () => {
    await render(<MemoryRouter initialEntries={['/dev-dt-maturity']}><DevDtMaturityApp /></MemoryRouter>);
    await settle(60);
  };

  try {
    await step('① 앱이 뜬다', async () => {
      await open();
      if (!byText('button', '시뮬레이션')) throw new Error('부문 토글이 없습니다');
    });

    // ② 부문마다 새로 띄워 훑는다 — 한 부문이 터져도 나머지를 본다
    for (const name of SECTORS) {
      await step(`② ${name} — 부문을 켠다`, async () => {
        const tab = byText('button', name);
        if (!tab) throw new Error('부문 단추가 없습니다');
        await click(tab);
        await settle(60);
      });

      for (const mode of MODES) {
        await step(`③ ${name} · ${mode}`, async () => {
          const btn = byText('button', mode);
          if (!btn) return;                       // 그 부문에 없는 모드는 건너뛴다
          await click(btn);
          await settle(60);
        });
      }

      await step(`④ ${name} · 목록`, async () => {
        const btn = byText('button', '목록');
        if (!btn) throw new Error('목록 탭이 없습니다');
        await click(btn);
        await settle(60);
      });

      await step(`⑤ ${name} · 성숙도로 되돌아온다`, async () => {
        await click(byText('button', '성숙도'));
        await settle(60);
      });
    }

    // ⑥ 부문마다 다른 기록 탭
    await step('⑥ 시뮬레이션 · 해석 활용 기록', async () => {
      await click(byText('button', '시뮬레이션')); await settle(40);
      const btn = byText('button', '해석 활용 기록');
      if (!btn) throw new Error('탭이 없습니다');
      await click(btn); await settle(60);
    });
    await step('⑥ 디지털 스레드 · 연계 개발 기록', async () => {
      await click(byText('button', '디지털 스레드')); await settle(40);
      const btn = byText('button', '연계 개발 기록');
      if (!btn) throw new Error('탭이 없습니다');
      await click(btn); await settle(60);
    });
    await step('⑥ 디지털 스레드 · 시스템 연결도', async () => {
      await click(byText('button', '성숙도')); await settle(40);
      const btn = byText('button', '시스템 연결도');
      if (!btn) throw new Error('모드가 없습니다');
      await click(btn); await settle(60);
    });

    // ⑦ 헤더에서 여는 창들 — 열고 닫는다
    const openClose = async (label, sector) => {
      await step(`⑦ ${sector} · ${label} 창`, async () => {
        await click(byText('button', sector)); await settle(40);
        const btn = byText('button', label);
        if (!btn) throw new Error('단추가 없습니다');
        await click(btn); await settle(60);
        if (!document.querySelector('[role="dialog"]')) throw new Error('창이 안 열렸습니다');
        const close = byText('button', '닫기') || document.querySelector('[title="닫기"]');
        if (close) { await click(close); await settle(40); }
      });
    };
    // ⚠️ 예전에는 ModalHost 가 모르는 갈래를 다 받아 **엉뚱한 창**이 열렸다 —
    //    「확인 대기」를 눌렀더니 「시뮬레이션 관리」가 떴다(2026-08-30).
    await step('⑦ 확인 대기 → 제 창이 열린다', async () => {
      await click(byText('button', '시뮬레이션')); await settle(40);
      const btn = byText('button', '확인 대기');
      if (!btn) throw new Error('헤더에 「확인 대기」가 없습니다');
      await click(btn); await settle(60);
      // ⚠️ **몇 개**인지도 본다 — 버그는 창을 둘 열었다(확인 대기 뒤에 시뮬레이션 관리).
      //    첫 번째만 보면 통과해 버린다.
      const dlgs = [...document.querySelectorAll('[role="dialog"]')]
        .map(d => d.getAttribute('aria-label'));
      if (dlgs.length !== 1) throw new Error(`창이 ${dlgs.length}개 열렸습니다: ${dlgs}`);
      if (dlgs[0] !== '확인 대기') throw new Error(`「${dlgs[0]}」 창이 열렸습니다`);
      if (!html().includes('AI 가 적은 근거')) throw new Error('근거가 안 보입니다');
      const close = byText('button', '닫기') || document.querySelector('[title="닫기"]');
      if (close) { await click(close); await settle(40); }
    });
    await openClose('설정', '시뮬레이션');
    await openClose('시험 항목 관리', '시뮬레이션');
    await openClose('시뮬레이션 관리', '시뮬레이션');
    await openClose('공정 관리', '모니터링');
    await openClose('수집 수단 관리', '모니터링');
    await openClose('시스템 관리', '디지털 스레드');
    await openClose('조직 관리', '디지털 스레드');
    await openClose('스레드 정의', '디지털 스레드');

    await step('⑧ 데이터 › 일괄 입력 창', async () => {
      await click(byText('button', '시뮬레이션')); await settle(40);
      await click(byText('button', '데이터')); await settle(40);
      await click(byText('button', '일괄 입력')); await settle(60);
      if (!document.querySelector('[role="dialog"]')) throw new Error('창이 안 열렸습니다');
      const close = byText('button', '닫기');
      if (close) { await click(close); await settle(40); }
    });

    await unmount();
  } catch (e) {
    say(false, `실패: ${String(e.stack || e).split('\n').slice(0, 4).join(' | ')}`);
  }
  return done();
  });
}
