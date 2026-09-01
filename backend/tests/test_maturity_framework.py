# -*- coding: utf-8 -*-
"""성숙도 측정 체계 — 「개요」의 원본. (2026-08-31)

이 조사는 **현행 KPI 체계의 두 공백을 보강하기 위한 것**이다.
    공백 ① 역량이 지표 하나(가상검증률)로 대변된다.
    공백 ② 그 지표가 어느 성과형 KPI 에 닿는지가 정의되어 있지 않다.

**여기서 지키는 것**
  · 성과는 넷이다 — 개발비용 · 개발시간 · 품질비용 · 제조비용
  · 모든 KPI 와 성숙도 지표는 그중 하나 이상에 귀속된다 — 귀속되지 않으면 잴 근거가 없다
  · 집계 지표(가상검증률·데이터 연결율)는 **성숙도 지표의 평균**이다 — 별도 계층이 아니다
  · 체계는 **설계 근거**이지 성과 실적이 아니다 — 현재 수준이 섞이면 안 된다
"""
import pytest

from app.modules.auth.models import UserRole
from app.modules.dev_dt_maturity import definitions as D

BASE = '/api/dev-dt-maturity'
DEFINED = ('simulation', 'digital_thread', 'manufacturing_monitoring')


@pytest.fixture()
def viewer(make_user):
    return make_user('v@test.local', UserRole.VIEWER)


def test_경영_성과는_넷이고_모든_KPI_가_거기_귀속된다(app):
    with app.app_context():
        keys = {o['key'] for o in D.BUSINESS_OUTCOMES}
        # ⚠️ 재료비는 이 회사에서 **개발비용으로 편성**된다 — 별도 성과가 아니다.
        assert keys == {'dev_cost', 'dev_time', 'quality_cost', 'mfg_cost',
                        'product', 'new_biz', 'capex'}
        # 기존 넷은 전부 「덜 쓴다」였다. 새로 짚는 셋은 매출·사업 확대 쪽이다.
        cur = [o['label'] for o in D.BUSINESS_OUTCOMES if o['status'] == 'current']
        new = [o['label'] for o in D.BUSINESS_OUTCOMES if o['status'] == 'new']
        assert cur == ['개발비용', '개발시간', '품질비용', '제조비용']
        assert new == ['제품 경쟁력', '신사업·서비스 확장', '설비 투자 절감']
        for o in D.BUSINESS_OUTCOMES:
            assert o['label'] and o['lever']
        # ⚠️ 성장은 절감보다 **뒤 단계**다 — 숫서도에서 더 오른쪽에 선다.
        #    설비 투자 절감은 새 성과지만 쓰는 돈을 줄이는 것이라 절감 쪽이다.
        grow = [o['key'] for o in D.BUSINESS_OUTCOMES if o.get('stage') == 'growth']
        assert grow == ['product', 'new_biz']
        # 귀속되지 않는 KPI 는 잴 근거가 없다.
        # ⚠️ 다만 **거쳐 가는 KPI** 가 있다 — 평균 복구 시간은 유실율을 거쳐 원가로 간다.
        #    그런 것은 outcomes 대신 leads_to 를 갖는다. 둘 다 비면 어디에도 안 닿는다.
        for k in D.KPI_SET:
            assert set(k['outcomes']) <= keys, k['key']
            assert k['outcomes'] or k.get('leads_to'), k['key']
            assert k['domain'] in ('개발', '제조', '품질')


def test_KPI_의_계층이_갈라져_있다(app):
    """⚠️ 가상검증률은 정확도의 평균이다 — 집계 지표이지 별도 계층이 아니다."""
    with app.app_context():
        by = {k['label']: k for k in D.KPI_SET}
        assert set(by) == {'가상검증률', 'One Time Pass', '시험 리드타임',
                           '개발 시료 절감', '재료비 절감',
                           '데이터 연결율', '라인 유실율',
                           '평균 복구 시간', '평균 고장 간격',
                           '인당 생산대수', '공정 직행률', '공정 능력 지수',
                           'Annual Service Rate'}
        # 기술 달성 지표 — 그 자체가 성과가 아니다
        # 집계 지표 — 성숙도 지표의 평균이다. 어느 축에서 왔는지가 적혀 있어야 한다.
        assert by['가상검증률']['tier'] == 'derived'
        assert by['가상검증률']['from_axis'] == '정확도'
        assert by['데이터 연결율']['tier'] == 'derived'
        assert by['데이터 연결율']['from_axis'] == '기본 계측'
        # 업무 결과 지표 — 비용·시간으로 직접 환산된다
        for lab in ('One Time Pass', '시험 리드타임', '라인 유실율', '인당 생산대수',
                    '개발 시료 절감', '재료비 절감', '평균 복구 시간',
                    '평균 고장 간격', '공정 직행률', '공정 능력 지수',
                    'Annual Service Rate'):
            assert by[lab]['tier'] == 'result', lab
        assert set(D.KPI_TIERS) == {'derived', 'result'}
        # 현행 관리 KPI 일곱 — 순서도에서 황색. 나머지는 이번에 새로 제안한 것이다(2026-09-01).
        now = {k['label'] for k in D.KPI_SET if k['managed']}
        assert now == {'가상검증률', '데이터 연결율', 'One Time Pass', '시험 리드타임',
                       '라인 유실율', '인당 생산대수', 'Annual Service Rate'}
        # 소속 — 개발 토글에 제조 KPI 가 딸려 들어오지 않게 한다. ASR 만 양쪽.
        assert all(k['part'] in ('dev', 'mfg', 'any') for k in D.KPI_SET)
        assert [k['key'] for k in D.KPI_SET if k['part'] == 'any'] == ['asr']
        assert by['공정 직행률']['part'] == 'mfg' and by['인당 생산대수']['part'] == 'mfg'
        # 차례가 곧 세로 차례 — ASR → 공정 직행률 → 라인 유실율 → 인당 생산대수
        keys = [k['key'] for k in D.KPI_SET]
        assert keys.index('asr') < keys.index('fpy') < keys.index('line_loss') < keys.index('output_per_head')
        # 경유 KPI 는 제 목적지 바로 앞
        assert keys.index('cpk') == keys.index('fpy') - 1
        assert keys.index('line_loss') - keys.index('mtbf') <= 2 and keys.index('mttr') < keys.index('line_loss')
        # 성과형은 어떤 축에서 온 것이 아니다
        assert all(k['from_axis'] is None for k in D.KPI_SET if k['tier'] == 'result')


def test_집계_지표는_원본_축에_병기된다(app):
    """집계 지표는 **별도 칸이 아니라 원본 축의 다른 이름**이다(2026-09-01).

    ⚠️ 예전엔 지표의 kpi 목록에 집계 지표를 실었다. 그러면 화면에서 같은 것이 둘로
       보인다 — 「정확도」 칸과 「가상검증률」 칸. 이제 원본 축에 이름을 병기한다.
       짝이 끊기면 그 KPI 가 어디서 오는지 아무 데도 안 남으므로 여기서 막는다.
    """
    with app.app_context():
        derived = [k for k in D.KPI_SET if k['tier'] == 'derived']
        assert derived
        marked = {}
        for sec in DEFINED:
            for r in D.measurement_framework(sec)['indicators']:
                # 성과형만 남는다 — 집계 지표가 KPI 칸에 또 나오면 안 된다
                for k in r['kpi']:
                    assert k['tier'] == 'result', (sec, r['axis'], k['key'])
                if r['derived_label']:
                    marked.setdefault(r['derived_label'], []).append((sec, r['axis']))
        # 집계 지표마다 원본 축이 **정확히 하나**다
        for k in derived:
            assert len(marked.get(k['label'], [])) == 1, (k['key'], marked.get(k['label']))
        assert set(marked) == {k['label'] for k in derived}
        # 원본 축은 from_sector · from_axis_key 가 가리키는 그 축이다
        sim = {r['axis']: r for r in D.measurement_framework('simulation')['indicators']}
        assert sim['accuracy']['derived_label'] == '가상검증률'
        mon = {r['axis']: r for r in D.measurement_framework('manufacturing_monitoring')['indicators']}
        assert mon['basic_metrics']['derived_label'] == '데이터 연결율'


def test_선행_관계가_실재하는_축을_가리킨다(app):
    """지표끼리의 선행(deps) — 순서도의 가로 자리를 이것이 정한다(2026-09-01).

    ⚠️ 축 키를 고치면 선행이 허공을 가리킨다. 그러면 순서도에서 선만 조용히 사라진다.
       순환이 생기면 단 매김이 끝나지 않는다 — 둘 다 여기서 막는다.
    """
    with app.app_context():
        for sec in DEFINED:
            rows = D.measurement_framework(sec)['indicators']
            axes = {r['axis'] for r in rows}
            dep = {r['axis']: [d['key'] for d in r['deps']] for r in rows}
            for r in rows:
                assert r['axis'] not in dep[r['axis']], (sec, r['axis'])   # 자기 자신 금지
                for d in r['deps']:
                    assert d['key'] in axes, (sec, r['axis'], d['key'])
                    assert d['label']
            # 선행이 하나도 없는 축이 있어야 한다 — 없으면 순환이다
            assert any(not v for v in dep.values()), sec
            # 위상 정렬이 끝나는지 — 남으면 순환
            done, rest = set(), set(axes)
            while True:
                ready = {a for a in rest if set(dep[a]) <= done}
                if not ready:
                    break
                done |= ready
                rest -= ready
            assert not rest, (sec, rest)


def test_KPI_사슬이_성과까지_이어진다(app):
    """평균 복구 시간은 인당 생산대수와 같은 단이 아니다 — 앞뒤가 있다(2026-09-01 지적).

           평균 복구 시간 ─▶ 라인 유실율 ─▶ 인당 생산대수 ─▶ 제조비용

    ⚠️ 거쳐 가는 KPI 에 성과를 **또** 달면 같은 절감이 두 번 세어진다. 그래서
       outcomes 를 비운다. 대신 사슬을 끝까지 따라가면 반드시 성과에 닿아야 한다.
    """
    with app.app_context():
        by = {k['key']: k for k in D.KPI_SET}
        for k in D.KPI_SET:
            for nxt, how in (k.get('leads_to') or {}).items():
                assert nxt in by, (k['key'], nxt)
                assert nxt != k['key'], k['key']
                assert how and len(how) <= 30, (k['key'], nxt, how)
        # 사슬을 따라가면 성과에 닿는다 — 안 닿으면 그 KPI 는 잴 이유가 없다
        for k in D.KPI_SET:
            seen, todo = set(), [k['key']]
            hit = False
            while todo:
                cur = todo.pop()
                if cur in seen:
                    continue
                seen.add(cur)
                if by[cur]['outcomes']:
                    hit = True
                todo += list(by[cur].get('leads_to') or {})
            assert hit, k['key']
        assert by['mttr']['outcomes'] == []                     # 원가로 직결하지 않는다
        # ⚠️ 제조 손실은 **고장 빈도 × 복구 시간**이다. 한쪽만 있으면 「유실이 왜
        #    그대로인가」가 빈도 탓인지 복구 탓인지 못 가린다 — 둘이 짝이어야 한다.
        assert set(by['mttr']['leads_to']) == {'line_loss'}
        assert set(by['mtbf']['leads_to']) == {'line_loss'}
        assert by['mtbf']['outcomes'] == []
        assert set(by['line_loss']['leads_to']) == {'output_per_head'}
        assert set(by['cpk']['leads_to']) == {'fpy'}


def test_모든_연결에_어떻게_기여하나가_적혀_있다(app):
    """선마다 한 줄 — 칸을 누르면 그 선 위에 뜬다(2026-09-01).

    ⚠️ 설명이 안 붙는 선은 **근거 없이 그은 선**이다. 그림에서는 다른 선과 똑같아
       보이므로 눈으로는 못 가린다. 여기서 막는다.
    """
    with app.app_context():
        for sec in DEFINED:
            for r in D.measurement_framework(sec)['indicators']:
                for grp in ('deps', 'kpi', 'outcomes', 'new_outcomes'):
                    for x in r[grp]:
                        assert x['how'], (sec, r['axis'], grp, x['key'])
                        assert len(x['how']) <= 30, (sec, r['axis'], x['how'])
        # KPI → 성과도 마찬가지
        for k in D.KPI_SET:
            for o in k['outcomes']:
                assert k.get('how', {}).get(o), (k['key'], o)


def test_새로_짚는_성과는_지표_하나에서만_온다(app):
    """⚠️ 「자동화 → 제품 경쟁력」 같은 한 다리 건넌 연결을 뺐다(2026-09-01).

    자동화는 해석을 빨리 돌리는 것이지 성능을 올리는 것이 아니다. 성과마다 가장
    직접적인 지표 **하나**만 건다 — 여럿을 걸면 무엇이 그것을 움직이는지 도로 흐려진다.
    """
    with app.app_context():
        src = {}
        for sec in DEFINED:
            for r in D.measurement_framework(sec)['indicators']:
                for o in r['new_outcomes']:
                    src.setdefault(o['key'], []).append((sec, r['axis']))
        # 재료비도 새로 짚는 성과지만 「설계 원가절감률」이 있으므로 여기 없어야 한다 —
        # 대응 KPI 가 생긴 순간 그 성과는 점선이 아니라 실선으로 간다.
        assert 'material' not in src, src
        assert src == {
            'product': [('simulation', 'modeling')],
            'new_biz': [('manufacturing_monitoring', 'judgement')],
            'capex': [('manufacturing_monitoring', 'scope')],
        }, src


def test_한_KPI_가_부문의_지표를_다_받지_않는다(app):
    """⚠️ 모니터링 여섯 축이 전부 「라인 유실율」로 모여 있었다(2026-09-01 고침).

    이것은 이 조사가 애초에 지적한 병과 **같은 병**이다 — 지표 하나가 역량을 다
    대변하면 무엇이 그 수치를 움직였는지 못 가린다. 부문의 지표가 미는 KPI 가
    적어도 셋으로 갈라져 있어야 한다.
    """
    with app.app_context():
        for sec in DEFINED:
            rows = D.measurement_framework(sec)['indicators']
            per = {}
            for r in rows:
                for k in r['kpi']:
                    per.setdefault(k['key'], []).append(r['axis'])
            assert len(per) >= 3, (sec, per)
            # 어느 하나가 그 부문 지표의 4분의 3을 넘게 받으면 도로 쏠린 것이다
            worst = max(len(v) for v in per.values())
            assert worst <= len(rows) * 0.75, (sec, worst, len(rows), per)
        # 미는 지표가 하나도 없는 성과형 KPI 가 남으면 안 된다 — 그림에서 홀로 뜬다
        pushed = set()
        for sec in D.framework_all()['sectors'] + D.framework_all()['draft_sectors']:
            for r in sec['indicators']:
                pushed |= {k['key'] for k in r['kpi']}
        orphan = {k['key'] for k in D.KPI_SET if k['tier'] == 'result'} - pushed
        assert not orphan, orphan


def test_부문마다_한_성과에만_갇히지_않는다(app):
    """디지털 스레드가 개발 비용·시간으로만 갔다 — 품질·제조로도 길을 낸다(2026-09-01).

    ⚠️ 도메인 표기가 아니라 **닿는 성과**로 본다. 「공정 직행률」은 품질 도메인이지만
       재작업 공수를 통해 제조비용에도 닿는다 — 표기만 세면 그 사실을 놓친다.
    """
    with app.app_context():
        by = {k['key']: k for k in D.KPI_SET}
        reach = set()
        for r in D.measurement_framework('digital_thread')['indicators']:
            for k in r['kpi']:
                reach |= set(by[k['key']]['outcomes'])
        assert reach == {'dev_cost', 'dev_time', 'quality_cost', 'mfg_cost'}, reach


def test_아직_안_연_분야는_초안으로_따로_선다(app):
    """검증·설계·공장 최적화 — **축 단위**의 초안(2026-09-01).

    ⚠️ 부문마다 칸 하나씩만 두면 다른 부문의 지표와 층이 안 맞는다. 저쪽이 축 단위로
       서 있으니 이쪽도 축 단위여야 견줄 수 있다.
    ⚠️ 다만 **정의된 것과 섞이면 안 된다.** 축이 기준 정보에 아직 없으므로 수준
       사다리가 없고, 그 사실이 draft 로 드러나야 화면이 회색으로 그린다.
    """
    with app.app_context():
        fw = D.framework_all()
        drafts = {s['key']: s for s in fw['draft_sectors']}
        assert set(drafts) == {'verification_automation', 'design_automation',
                               'factory_optimization'}
        assert {s['label'] for s in fw['draft_sectors']} == {'검증', '설계', '공장 최적화'}
        assert not (set(drafts) & {s['key'] for s in fw['sectors']})   # 안 섞인다
        kpi_keys = {k['key'] for k in D.KPI_SET}
        out_keys = {o['key'] for o in D.BUSINESS_OUTCOMES}
        for key, sec in drafts.items():
            assert sec['draft'] and sec['purpose'] and len(sec['indicators']) >= 3
            # ⚠️ 이름을 넓혔다 — 「검증 자동화」는 수단 이름이라 「시뮬레이션」 옆에서
            #    층이 안 맞았다. 다만 SECTORS 의 부문명은 그대로다(다른 모듈의 분류).
            assert '자동화' not in sec['label'], sec['label']
            axes = {r['axis'] for r in sec['indicators']}
            for r in sec['indicators']:
                assert r['draft'] is True
                # 수준 사다리가 없다 — 있는 척하면 정의된 축과 구분이 안 된다
                assert r['levels'] == [] and r['level_index'] is None
                assert r['axis_label'] and r['change'] and r['metric'] and r['why']
                # ⚠️ 선행은 KPI 에 직결하지 않는다 — 동인을 통해서만(2026-09-01). 정확도만으로
                #    One Time Pass 가 오르지 않는다.
                assert bool(r['kpi']) == (r['role'] != 'prereq'), (r['axis'], r['role'])
                assert {k['key'] for k in r['kpi']} <= kpi_keys
                assert {o['key'] for o in r['outcomes']} <= out_keys
                assert bool(r['outcomes']) == (r['role'] == 'driver'), (key, r['axis'])
                for grp in ('deps', 'kpi', 'outcomes', 'new_outcomes'):
                    for x in r[grp]:
                        assert x['how'] and len(x['how']) <= 30, (key, r['axis'], x)
                for d in r['deps']:
                    assert d['key'] in axes, (key, r['axis'], d['key'])
            # 정의된 부문과 같은 잣대 — 선행이 없는 축이 있고, 한 KPI 로 다 몰리지 않는다
            assert any(not r['deps'] for r in sec['indicators']), key
            per = {}
            for r in sec['indicators']:
                for k in r['kpi']:
                    per.setdefault(k['key'], []).append(r['axis'])
            assert len(per) >= 2, (key, per)


def test_가치_사슬이_서고_모든_지표가_업무에_작용한다(app):
    """개발·제조의 업무 요소 — 디지털 트윈 **밖**(2026-09-01).

    ⚠️ 이 그림이 답해야 하는 것은 「디지털 트윈이 **어느 업무를** 바꿔서 성과에 닿나,
       그 성과를 디지털 트윈 말고 무엇이 또 움직이나」다. 그래서 셋을 지킨다.
         ① 모든 지표(정의·초안)는 업무 요소에 작용한다(acts_on) — 없으면 허공에서 KPI 로 간다
         ② 모든 업무 **단계**에는 작용하는 지표가 있다 — 없으면 디지털 트윈이 안 닿는 단계다
         ③ 모든 업무 요소는 스스로 KPI 를 민다 — 이것이 디지털 트윈 밖의 경로다
    """
    with app.app_context():
        fw = D.framework_all()
        vc = fw['value_chain']
        assert set(vc) == {'development', 'manufacturing'}
        elems = {e['key']: e for b in vc.values() for e in b['elements']}
        band_of = {e['key']: b for b, conf in vc.items() for e in conf['elements']}
        kpi_keys = {k['key'] for k in D.KPI_SET}
        for b in vc.values():
            kinds = {e['kind'] for e in b['elements']}
            assert kinds == {'step', 'lever'}, kinds
            steps = [e for e in b['elements'] if e['kind'] == 'step']
            assert len(steps) >= 4
            # 단계는 차례로 이어진다 — 끝 하나만 next 가 없다
            assert sum(1 for e in steps if not e['next']) == 1, b['label']
            for e in b['elements']:
                assert e['label'] and e['note']
                assert e['kpi'] and {k['key'] for k in e['kpi']} <= kpi_keys, e['key']     # ③
                for k in e['kpi']:
                    assert k['how'] and len(k['how']) <= 30, (e['key'], k)
                if e['next']:
                    assert e['next'] in elems and elems[e['next']]['kind'] == 'step', e['key']
        # 밖의 지렛대 셋은 초안 부문에서 여기로 옮겨 왔다 — 부문의 축이 아니라 업무 요소다
        assert {'test_infra', 'design_org', 'capex_people'} <= set(elems)
        hit = {}
        for sec in fw['sectors'] + fw['draft_sectors']:
            for r in sec['indicators']:
                assert r['acts_on'], (sec['key'], r['axis'])                            # ①
                for a in r['acts_on']:
                    assert a['key'] in elems, (sec['key'], r['axis'], a['key'])
                    assert a['band'] == band_of[a['key']]
                    assert a['label'] == elems[a['key']]['label']
                    assert a['how'] and len(a['how']) <= 30, (sec['key'], r['axis'], a)
                    hit.setdefault(a['key'], []).append(r['axis'])
        for e in elems.values():
            if e['kind'] == 'step':
                assert e['key'] in hit, e['key']                                          # ②
        # 디지털 트윈 띠 양쪽 다 닿는다 — 개발만·제조만이면 띠 하나가 빈다
        assert {band_of[k] for k in hit} == {'development', 'manufacturing'}
        # 부문마다 어느 쪽에 붙는지 — 화면 토글이 이것으로 가른다. 스레드만 연계다.
        parts = {s['key']: s['part'] for s in fw['sectors'] + fw['draft_sectors']}
        assert set(parts.values()) == {'dev', 'mfg', 'link'}
        assert [k for k, p in parts.items() if p == 'link'] == ['digital_thread']
        # 성과형 KPI 마다 디지털 트윈 **밖**의 경로가 하나는 있다
        pushed = {k['key'] for e in elems.values() for k in e['kpi']}
        missing = {k['key'] for k in D.KPI_SET if k['tier'] == 'result'} - pushed
        assert not missing, missing


def test_확산_지표는_부문_동인이_미는_현행_관리_KPI_전부에_건다(app):
    """연결 기준의 셋째 줄(2026-09-01 확정).

    확산이 없으면 전사 수치가 안 움직인다 — 그것이 확산의 정의다. 그러므로 확산 지표는
    그 부문의 동인들이 미는 KPI 중 **전사 집계되는 것(현행 관리 KPI)** 전부에 건다.
    적용 범위가 시험 리드타임에만 걸리고 One Time Pass 에는 안 걸리던 것을 여기서 잡는다.
    """
    with app.app_context():
        managed = {k['key'] for k in D.KPI_SET if k['managed']}
        fw = D.framework_all()
        for sec in fw['sectors'] + fw['draft_sectors']:
            mult = [r for r in sec['indicators'] if r['role'] == 'multiplier']
            if not mult:
                continue
            drv_kpi = {k['key'] for r in sec['indicators'] if r['role'] == 'driver' for k in r['kpi']}
            want = drv_kpi & managed
            for r in mult:
                got = {k['key'] for k in r['kpi']}
                assert got == want, (sec['key'], r['axis'], sorted(got), sorted(want))


def test_부문_간_선행과_업무_입력이_실재하는_것을_가리킨다(app):
    """시뮬레이션으로 **들어오는** 선(2026-09-01).

    ⚠️ 시뮬레이션은 나가는 선만 있었다. 정확도는 실측 대조 없이 못 오르고, 시험 대체의
       인증 게이트는 해석을 인증 근거로 인정하는 규정 없이는 성립하지 않는다.
       needs(부문 간 선행)·fed_by(업무 → 지표 입력)가 실재하는 것을 가리키고, 선행 그래프
       전체(같은 부문 deps + 부문 간 needs)에 순환이 없어야 한다.
    """
    with app.app_context():
        fw = D.framework_all()
        secs = fw['sectors'] + fw['draft_sectors']
        axes = {(s['key'], r['axis']): r for s in secs for r in s['indicators']}
        elems = {e['key'] for b in fw['value_chain'].values() for e in b['elements']}
        for s in secs:
            for r in s['indicators']:
                for n in r['needs']:
                    assert n['sector'] != s['key'], (s['key'], r['axis'])        # 같은 부문은 deps
                    assert (n['sector'], n['axis']) in axes, (s['key'], r['axis'], n)
                    assert n['label'] and n['sector_label'] and n['how'] and len(n['how']) <= 30
                for f in r['fed_by']:
                    assert f['key'] in elems and f['label'] and f['band'], (s['key'], r['axis'], f)
                    assert f['how'] and len(f['how']) <= 30
        # 확정한 다섯 — 시뮬레이션에 셋이 들어오고, 부문 간 선행 둘이 잇는다
        sim = {r['axis']: r for r in axes.values() if r is axes.get(('simulation', r['axis']))}
        assert [f['key'] for f in sim['accuracy']['fed_by']] == ['test']
        assert [f['key'] for f in sim['modeling']['fed_by']] == ['quality']
        assert [f['key'] for f in sim['substitution']['fed_by']] == ['cert_rule']
        assert [(n['sector'], n['axis']) for n in sim['modeling']['needs']] == [('design_automation', 'part_lib')]
        ver = axes[('verification_automation', 'rule_tool')]
        assert [(n['sector'], n['axis']) for n in ver['needs']] == [('simulation', 'modeling')]
        # 새 기반 요소 — 검증 규정. 디지털 트윈이 못 만드는 몫이라 개발 부문의 기반 요소다
        dev = {e['key']: e for e in fw['value_chain']['development']['elements']}
        assert dev['cert_rule']['kind'] == 'lever' and dev['cert_rule']['kpi']
        # 선행 그래프 전체에 순환이 없다 — 위상 정렬이 끝나야 한다
        pred = {k: set() for k in axes}
        for (sk, ak), r in axes.items():
            pred[(sk, ak)] |= {(sk, d['key']) for d in r['deps']}
            pred[(sk, ak)] |= {(n['sector'], n['axis']) for n in r['needs']}
        done, rest = set(), set(axes)
        while rest:
            ready = {k for k in rest if pred[k] <= done}
            assert ready, rest                        # 남았는데 준비된 것이 없으면 순환
            done |= ready
            rest -= ready


def test_스레드가_시험_소요_데이터로_시험_리드타임에_닿는다(app):
    """디지털 스레드 → 취약 시험 분석 → 시험 리드타임(2026-09-01 제안).

    시험별 소요 기간이 잡히면(데이터 확보) 취약 시험이 드러나고(활용), 순서·병행 조정과
    설비·인력 보강 판단, 그리고 시험 대체의 우선순위가 거기서 나온다.
    """
    with app.app_context():
        thr = {r['axis']: r for r in D.measurement_framework('digital_thread')['indicators']}
        assert 'test' in {a['key'] for a in thr['capture']['acts_on']}
        assert {'test', 'test_infra'} <= {a['key'] for a in thr['usage']['acts_on']}
        assert 'test_leadtime' in {k['key'] for k in thr['usage']['kpi']}
        sim = {r['axis']: r for r in D.measurement_framework('simulation')['indicators']}
        assert ('digital_thread', 'usage') in {(n['sector'], n['axis']) for n in sim['substitution']['needs']}


def test_선행_관계가_실제_요건을_적는다(app):
    """정확도와 자동화가 **둘 다** 서야 시험을 대체한다 — 하나만으로는 안 된다."""
    with app.app_context():
        sim = {r['axis']: [d['key'] for d in r['deps']]
               for r in D.measurement_framework('simulation')['indicators']}
        assert set(sim['substitution']) == {'accuracy', 'automation'}
        assert 'modeling' in sim['scope']            # 모델링이 올라야 범위가 는다
        assert sim['accuracy'] == []                 # 정확도가 출발점이다


def test_모든_지표가_변화·측정·KPI_를_채운다(app):
    """「무엇이 달라지나」를 비우면 지표에서 비용으로 직결되어 검증이 불가능해진다."""
    with app.app_context():
        kpi_keys = {k['key'] for k in D.KPI_SET}
        out_keys = {o['key'] for o in D.BUSINESS_OUTCOMES}
        for sec in DEFINED:
            f = D.measurement_framework(sec)
            assert f['purpose'] and f['indicators']
            for r in f['indicators']:
                assert r['axis_label'] and r['change'] and r['metric']
                # ⚠️ 선행은 KPI 에 직결하지 않는다 — 동인을 통해서만(2026-09-01). 정확도만으로
                #    One Time Pass 가 오르지 않는다.
                assert bool(r['kpi']) == (r['role'] != 'prereq'), (r['axis'], r['role'])
                assert {k['key'] for k in r['kpi']} <= kpi_keys   
                # ⚠️ 성과는 **동인에만** 붙는다 — 전부에 달면 무엇이 비용을 움직이는지 안 보인다
                assert {o['key'] for o in r['outcomes']} <= out_keys
                assert bool(r['outcomes']) == (r['role'] == 'driver'), (sec, r['axis'])
                assert r['why'] and r['gate_why'], (sec, r['axis'])


def test_유효_수준은_실재하는_단계를_가리킨다(app):
    """축의 단계 이름을 바꾸면 유효 수준이 허공을 가리킨다 — 그때 이 시험이 깨진다."""
    with app.app_context():
        for sec in DEFINED:
            for r in D.measurement_framework(sec)['indicators']:
                assert r['level_index'] is not None, (sec, r['axis'])
                assert r['levels'][r['level_index']]['label'] == r['level_label']
                # 첫 단계가 유효 수준이면 「수준을 넘는다」는 말이 성립하지 않는다
                assert r['level_index'] >= 1, (sec, r['axis'])


def test_부문마다_선행_요건이_정확히_하나다(app):
    """선행 요건이 없으면 「무엇을 먼저」가 없고, 둘이면 우선순위가 갈린다."""
    with app.app_context():
        for sec in DEFINED:
            roles = [r['role'] for r in D.measurement_framework(sec)['indicators']]
            assert roles.count('prereq') == 1, (sec, roles)
            assert roles.count('driver') >= 2, (sec, roles)


def test_중점_추진_분야_여섯이_모두_선다(app):
    """⚠️ 아직 열지 않은 분야도 목록에 남긴다 — 빠지면 「조사 범위」가 좁아 보인다."""
    with app.app_context():
        areas = D.focus_areas()
        assert [a['key'] for a in areas] == [
            'simulation', 'verification_automation', 'design_automation',
            'manufacturing_monitoring', 'factory_optimization', 'digital_thread']
        for a in areas:
            assert a['role'] and a['kpi']
        got = {a['key']: a for a in areas}
        assert got['simulation']['defined'] and got['simulation']['indicator_count'] == 5
        # 아직 체계를 적지 않은 분야는 그렇다고 말한다
        assert not got['factory_optimization']['defined']
        assert got['factory_optimization']['indicator_count'] == 0


def test_공백_둘을_명시한다(app):
    """조사의 근거다 — 빠지면 「성숙도를 왜 또 조사하는가」에 답이 없다."""
    with app.app_context():
        gaps = D.FRAMEWORK_GAPS
        assert len(gaps) == 2
        for g in gaps:
            assert g['no'] and g['title'] and g['problem'] and g['answer']
        assert '평균' in gaps[0]['example']            # ① 역량이 지표 하나로
        assert '1개' in gaps[1]['example']             # ② 1 대 다 대응


def test_시뮬레이션_체계의_핵심_판단(app):
    """⚠️ 사무국이 확정할 자리 — 값이 바뀌면 이 시험을 함께 고친다."""
    with app.app_context():
        by = {r['axis']: r for r in D.measurement_framework('simulation')['indicators']}
        # 정확도는 선행 요건 — 가상검증률이 정확도 없이도 상승할 수 있다는 것이 조사 근거다
        assert by['accuracy']['role'] == 'prereq'
        assert by['accuracy']['outcomes'] == []          # 선행은 비용을 안 단다
        assert '가상검증률' in by['accuracy']['why']
        # 시험 대체의 유효 수준은 사전 검증이 아니라 인증 게이트다
        assert by['substitution']['level_label'] == '신뢰성 인증 게이트'
        assert {o['key'] for o in by['substitution']['outcomes']} == {'dev_cost', 'dev_time'}
        # 적용 범위는 확산 요인 — 비용을 달면 효과가 두 번 세어진다
        assert by['scope']['role'] == 'multiplier'
        assert by['scope']['outcomes'] == []              # 확산도 비용을 안 단다


def test_체계에_현재_수준이_섞이지_않는다(app):
    """⚠️ 개요는 설계 근거다. 달성도가 섞이면 설명 자료가 성적표로 오독된다."""
    with app.app_context():
        f = D.measurement_framework('simulation')
        banned = {'avg', 'over_rate', 'assessed', 'unassessed', 'at_door', 'divisions'}
        assert not (set(f) & banned)
        for r in f['indicators']:
            assert not (set(r) & banned), r['axis']
        # 명사형 표기(2026-09-01) — 「성과 실적이 아님」
        assert any('성과 실적이 아님' in c for c in f['caveats'])
        # ⚠️ 임원 보고용 — 서술형 종결이 없어야 한다. 문장이 「다.」로 끝나면 깨진다.
        import re
        fw = D.framework_all()
        texts = [c for c in fw['caveats']] + [s['purpose'] for s in fw['sectors'] + fw['draft_sectors']]
        texts += [r[k] for s in fw['sectors'] + fw['draft_sectors'] for r in s['indicators']
                  for k in ('why', 'gate_why', 'change') if r.get(k)]
        texts += [o['lever'] for o in fw['outcomes']] + [k['note'] for k in fw['kpis']]
        texts += [g[k] for g in fw['gaps'] for k in ('title', 'problem', 'answer')]
        texts += [v['definition'] for v in fw['roles'].values()]
        bad = [t for t in texts if re.search(r'다\.?\s*$', t) or re.search(r'다\.\s', t)]   # 「필요」 같은 명사는 둔다
        assert not bad, bad
        # 집계 지표가 별도 지표가 아니라는 경고가 있어야 한다
        assert any('집계값' in c for c in f['caveats'])


def test_요약은_부문을_안_받는다(app):
    """⚠️ 여섯 분야를 한눈에 보여 주는 **한 페이지**다 — 부문에 매이면 목적이 깨진다."""
    with app.app_context():
        a = D.framework_all()
        assert [s['key'] for s in a['sectors']] == list(DEFINED)
        for s in a['sectors']:
            assert s['label'] and s['purpose'] and s['indicators']
        # 공통 재료는 **한 벌만** 싣는다 — 부문 수만큼 되풀이하면 응답이 붓는다
        for s in a['sectors']:
            assert 'outcomes' not in s and 'kpis' not in s and 'gaps' not in s
        assert a['outcomes'] and a['kpis'] and a['gaps'] and a['kpi_tiers'] and a['caveats']
        assert len(a['focus_areas']) == 6      # 아직 안 연 분야도 남는다


def test_요약_API(client, auth, db, viewer):
    got = client.get(f'{BASE}/overview', headers=auth(viewer))
    assert got.status_code == 200
    d = got.get_json()['data']
    assert d['sectors'] and d['outcomes'] and d['kpis'] and d['gaps'] and d['kpi_tiers']
    assert len(d['focus_areas']) == 6
    # 부문을 줘도 무시한다 — 한 페이지다
    same = client.get(f'{BASE}/overview?sector=digital_thread', headers=auth(viewer))
    assert same.get_json()['data'] == d


def test_개발시간은_세_갈래로_갈라진다(app):
    """⚠️ 인건비만 세면 **가장 작은 갈래만** 보는 셈이다.

    셋째 갈래(개발 여력)가 사업 확대로 이어지는 고리다 — 기간 단축은 원가가 아니라 재원이다.
    """
    with app.app_context():
        dt = next(o for o in D.BUSINESS_OUTCOMES if o['key'] == 'dev_time')
        labels = [b['label'] for b in dt['branches']]
        assert labels == ['인건비 절감', '조기 출시 매출', '개발 여력']
        for b in dt['branches']:
            assert b['note']
        # 셋째만 다른 성과로 이어진다 — 그 고리가 이 갈래의 요점이다
        assert [b['to'] for b in dt['branches']] == [None, None, 'new_biz']


def test_대응_KPI_가_없는_성과만_점선으로_간다(app):
    """대응 KPI 가 없다는 사실이 요점이다 — 화면이 점선·회색으로 그린다.

    ⚠️ 갈림길은 「새로 짚는 성과냐」가 아니라 **「재는 지표가 있느냐」**다(2026-09-01).
       재료비는 새로 짚는 성과지만 「설계 원가절감률」이 생겼다 — 그 순간 점선이
       아니라 지표 ▶ KPI ▶ 성과 로 이어지는 실선이 된다. 둘을 status 로 가르면
       KPI 를 붙이고도 그림이 계속 「측정 불가」라고 말하게 된다.
    """
    with app.app_context():
        measured = {o for k in D.KPI_SET for o in k['outcomes']}
        blank = {o['key'] for o in D.BUSINESS_OUTCOMES} - measured
        assert blank == {'product', 'new_biz', 'capex'}, blank
        # 재는 지표가 없는 성과는 지표가 **바로** 가리킨다 — 그것이 점선이다
        hit = {}
        for sec in DEFINED:
            for r in D.measurement_framework(sec)['indicators']:
                for o in r['new_outcomes']:
                    hit.setdefault(o['key'], []).append(r['axis'])
        assert set(hit) == blank, set(hit) ^ blank
        # 재는 지표가 있는 성과를 점선으로 그리면 안 된다 — 실선 경로가 이미 있다
        for sec in DEFINED:
            for r in D.measurement_framework(sec)['indicators']:
                assert not ({o['key'] for o in r['outcomes']} & blank), r['axis']
