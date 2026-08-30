// 「추출」 — 화면의 입력 자료를 엑셀 한 권으로(2026-08-30).
//
// 왜 화면에서 만드나
//     ① 서버에 엑셀 라이브러리가 없다(가져오기도 붙여넣은 표로 받는다).
//     ② **샘플 뷰가 저절로 따라온다** — 자료를 maturityApi 로 받으니 목업이 켜져 있으면
//        목업이 나온다. 추출만 따로 서버를 찌르면 샘플 뷰에서 빈 파일이 나온다.
//
// 이 파일은 **판을 짜는 셈**만 한다(그리기·저장은 exportXlsx). 그래서 node 시험이 그대로 읽는다.

/** 축 하나의 값 — 사람이 읽는 한 칸. */
export const axisText = (axis, a) => {
  if (!a) return '';
  if (a.unknown) return '모름';
  if (axis.kind === 'value') return a.value != null ? a.value : '';
  if (axis.kind === 'set') {
    const on = a.flags || [];
    if (!on.length) return axis.rungs[0]?.label || '';
    return axis.rungs.filter(r => on.includes(r.key)).map(r => r.label).join(' · ');
  }
  if (axis.kind === 'matrix') return a.summary || axis.rungs[a.rung_index]?.label || '';
  return axis.rungs.find(r => r.key === a.rung)?.label || a.rung || '';
};

const ev = (a) => {
  const e = a && a.evidence;
  if (!e || typeof e !== 'object') return '';
  return Object.entries(e)
    .filter(([k, v]) => k !== 'defects' && v !== null && v !== '' && v !== undefined)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(',') : v}`).join(' · ');
};

const ymd = (iso) => (iso ? String(iso).slice(0, 10) : '');

/** 대상의 부문별 속성 — 시뮬레이션은 제품군, 스레드는 스레드·구간, 모니터링은 라인·공정. */
const subjectCols = (sector) => {
  if (sector === 'digital_thread') return [['스레드', s => s.segment?.thread_name || ''], ['데이터 종류', s => (s.segment?.data_kind_labels || []).join(' · ')],
    ['출발 조직', s => s.segment?.from_org_name || ''], ['출발 시스템', s => s.segment?.from_system_name || ''],
    ['매개 시스템', s => s.segment?.via_system_name || ''], ['도착 조직', s => s.segment?.to_org_name || ''],
    ['도착 시스템', s => s.segment?.to_system_name || '']];
  // ⚠️ 「공정 단계」다 — 이 부문은 대상의 이름표가 「공정」이라 머리글이 겹치면
  //    일괄 입력이 이름 칸을 공정 단계로 읽는다(2026-08-30). 추출과 입력은 같은 머리글이어야 한다.
  if (sector === 'manufacturing_monitoring') return [['라인·사업장', s => s.line || ''], ['공정 단계', s => s.process_label || s.process || ''], ['세부', s => s.detail || '']];
  return [['세부', s => s.detail || ''], ['제품군', s => (s.product_families || []).join(' · ')]];
};

/** 수단의 속성 — 스레드 부문은 수단이 없다. */
const agentCols = (sector) => {
  if (sector === 'digital_thread') return [];
  if (sector === 'manufacturing_monitoring') return [['수단 종류', a => a?.kind || ''], ['담당 부서', a => a?.department_name || '']];
  return [['종류', a => a?.kind || ''], ['모델 종류', a => a?.model_kind || ''], ['사용 툴', a => (a?.tools || []).join(' · ')],
    ['불량 유형', a => (a?.defect_types || []).join(' · ')], ['담당 부서', a => a?.department_name || ''],
    ['디지털 트윈 연결 과제', a => (a?.projects || []).map(p => p.title || p.uuid).join(' · ')]];
};

/**
 * 평가 판 — 한 줄이 연계 하나. 축마다 값·근거·평가일·평가자 네 칸.
 * boards: [{ division_name, subjects: [{ ..., pairs: [{ agent, assessments }] }] }]
 */
export const assessmentSheet = (boards, axes, sector, agentLabel = '시뮬레이션', subjectLabel = '시험 항목') => {
  const sc = subjectCols(sector);
  const ac = agentCols(sector);
  const head = ['사업부', subjectLabel, ...sc.map(c => c[0])];
  if (ac.length || sector !== 'digital_thread') head.push(agentLabel);
  head.push(...ac.map(c => c[0]));
  axes.forEach(x => head.push(x.label, `${x.label} 근거`, `${x.label} 평가일`, `${x.label} 평가자`));
  head.push('미평가 축');
  const rows = [head];
  boards.forEach(b => (b.subjects || []).forEach(s => {
    const pairs = s.pairs && s.pairs.length ? s.pairs : [null];
    pairs.forEach(p => {
      const row = [b.division_name || '', s.name, ...sc.map(c => c[1](s))];
      if (ac.length || sector !== 'digital_thread') row.push(p?.agent?.name || '');
      ac.forEach(c => row.push(c[1](p?.agent)));
      axes.forEach(x => {
        const a = p?.assessments?.[x.key];
        row.push(axisText(x, a), a?.note || '', ymd(a?.assessed_at), a?.assessed_by_name || '');
      });
      row.push((p?.unassessed || []).map(k => axes.find(x => x.key === k)?.label || k).join(' · '));
      rows.push(row);
    });
  }));
  return rows;
};

/** 이력 — 언제 누가 어느 칸을 어떻게 옮겼나. */
export const changeSheet = (changes, axes) => {
  const rows = [['시점', '대상', '수단', '축', '전', '후', '근거', '기록자']];
  (changes || []).forEach(c => rows.push([
    ymd(c.created_at), c.subject_name || '', c.agent_name || '',
    axes.find(x => x.key === c.axis)?.label || c.axis,
    c.before ?? '', c.after ?? '', c.note || '', c.actor_name || '',
  ]));
  return rows;
};

/** 대상 목록 — 평가가 없어도 다 나온다(무엇을 아직 안 매겼나를 보려면 목록이 온전해야 한다). */
export const subjectSheet = (subjects, sector, subjectLabel = '시험 항목', divisionName = (s) => s.division_name || '') => {
  const sc = subjectCols(sector);
  const rows = [['사업부', subjectLabel, ...sc.map(c => c[0])]];
  (subjects || []).forEach(s => rows.push([divisionName(s), s.name, ...sc.map(c => c[1](s))]));
  return rows;
};

/** 수단 목록. */
export const agentSheet = (agents, sector, agentLabel = '시뮬레이션') => {
  const ac = agentCols(sector);
  const rows = [['사업부', agentLabel, ...ac.map(c => c[0])]];
  (agents || []).forEach(a => rows.push([a.division_name || '', a.name, ...ac.map(c => c[1](a))]));
  return rows;
};

/** 해석 활용 기록(시뮬레이션 부문) — 건으로 쌓은 것. */
export const reviewSheet = (reviews, review) => {
  const lab = (list, k) => (list || []).find(x => x.key === k)?.label || k || '';
  const rows = [['연-월', '종류', '대상', '항목', '시뮬레이션', '시점', '결정 반영', '판정 근거', '리드타임(일)', '메모', '기록자']];
  (reviews || []).forEach(r => rows.push([
    String(r.month || '').slice(0, 7), lab(review?.kinds, r.kind), r.target || '', r.item || '', r.agent_name || '',
    lab(review?.timings, r.timing), lab(review?.uses, r.use), lab(review?.bases, r.basis),
    r.lead_days ?? '', r.note || '', r.actor_name || '',
  ]));
  return rows;
};

/** 시스템 사전(디지털 스레드). */
export const systemSheet = (systems, thread) => {
  const kind = (k) => (thread?.system_kinds || []).find(x => x.key === k)?.label || k || '';
  const stage = (k) => (thread?.stages || []).find(x => x.key === k)?.label || k;
  const means = (k) => (thread?.link_means || []).find(x => x.key === k)?.label || k || '';
  const status = (k) => (thread?.system_status || []).find(x => x.key === k)?.label || k || '';
  const rows = [['시스템', '종류', '주관 조직', '생애 단계', '연계 수단', '상태', '메모']];
  (systems || []).forEach(s => rows.push([
    s.name, kind(s.kind), s.owner_org || '', (s.stages || []).map(stage).join(' · '), means(s.link_means), status(s.status), s.note || '',
  ]));
  return rows;
};

/** 연계 개발 기록(디지털 스레드). */
export const caseSheet = (cases, thread) => {
  const lab = (list, k) => (list || []).find(x => x.key === k)?.label || k || '';
  const rows = [['연-월', '무엇을', '상태', '스레드', '구간', '시스템', '연결 전', '연결 후', '올라간 칸', '메모', '기록자']];
  (cases || []).forEach(c => rows.push([
    String(c.month || '').slice(0, 7), lab(thread?.case_actions, c.action), lab(thread?.case_status, c.status),
    c.thread_name || '', c.segment_name || '', c.system_name || '',
    c.link_from_label || '', c.link_to_label || '', c.lift ?? '', c.note || '', c.actor_name || '',
  ]));
  return rows;
};

/** 파일 이름 — 부문·사업부·날짜. 샘플 뷰면 그렇다고 적는다(밖에 나가서 헷갈리지 않게). */
export const fileName = ({ sectorLabel, divisionName, sample, now = new Date() }) => {
  const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `디지털트윈성숙도_${sectorLabel}_${divisionName || '전체'}${sample ? '_샘플' : ''}_${d}.xlsx`;
};
