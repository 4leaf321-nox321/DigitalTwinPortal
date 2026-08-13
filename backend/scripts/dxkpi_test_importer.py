"""주간보고 붙여넣기 파서 (`dx_kpi_management/importer.py`).

⚠️ **진짜 문서가 없다.** 원본은 DRM 이 걸린 워드라 개발 환경으로 가져올 수 없다.
   그래서 표본을 지어내 검사한다 — 이 시험이 지키는 것은 "진짜 문서를 맞힌다" 가
   아니라 **"모양이 달라도 무너지지 않고, 못 읽으면 이유를 말한다"** 이다.

무엇을 못 박나
    ① **두 모양을 다 읽는다.** 넓은 형태(열이 사업부)와 긴 형태(줄마다 한 값).
       주간보고 표는 둘 다 흔하고, 어느 쪽인지 미리 알 수 없다.
    ② **값 합성 규칙이 화면과 같다.** 분수는 (분자/분모)×100(단위 %) · 소수 한 자리.
       다르면 손으로 넣은 값과 붙여넣은 값이 서로 다른 숫자가 된다.
    ③ **기준일을 찾지 않는다.** 문서에 없다. 날짜를 지어내면 안 된다.
    ④ **못 읽으면 말한다.** 조용히 건너뛰면 반쪽만 들어온 것을 아무도 모른다.
    ⑤ **본문을 다시 쓰지 않는다.** 주간 동향은 원문이 보고 근거다.

실행: python scripts\\dxkpi_test_importer.py
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.modules.dx_kpi_management import importer as IM      # noqa: E402

fails = []

DIVISIONS = [
    {'id': 'mx', 'name': 'MX'}, {'id': 'vd', 'name': 'VD'},
    {'id': 'da', 'name': 'DA'}, {'id': 'nw', 'name': 'NW'},
    {'id': 'medical', 'name': '의료기기'},
]

DEFS = [
    {'id': 1, 'label': '가상 검증률', 'category': '개발', 'unit': '%',
     'valueType': 'single', 'divisions': []},
    {'id': 2, 'label': 'One Time Pass율', 'category': '개발', 'unit': '%',
     'valueType': 'single', 'divisions': []},
    {'id': 3, 'label': '시험 완료 Lead Time', 'category': '개발', 'unit': '일',
     'valueType': 'single', 'divisions': []},
    {'id': 4, 'label': '데이터 연결률', 'category': '제조', 'unit': '%',
     'valueType': 'fraction', 'divisions': []},
]


def check(desc, ok, extra=''):
    print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}" + (f'   {extra}' if not ok and extra else ''))
    if not ok:
        fails.append(desc)


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    # ── ① 넓은 형태 — 열이 사업부 ─────────────────────────────────────
    print('── 넓은 형태 (열이 사업부) ──')
    wide = '\n'.join([
        '2026년 8월 2주차 DX KPI',                 # 표 앞의 제목 줄
        'KPI\tMX\tVD\tDA\tNW\t의료기기',
        '가상 검증률\t62\t41\t\t28\t-',
        'One Time Pass율\t88.5\t90\t77\t\t',
        '데이터 연결률\t12/30\t\t\t\t',
    ])
    r = IM.parse_kpi_table(wide, DIVISIONS, DEFS)
    check('넓은 형태로 알아본다', r['layout'] == 'wide', str(r['layout']))
    got = {(x['division'], x['kpi']): x['value'] for x in r['rows']}
    check('사업부별로 값을 나눠 읽는다',
          got.get(('MX', '가상 검증률')) == '62'
          and got.get(('VD', '가상 검증률')) == '41'
          and got.get(('NW', '가상 검증률')) == '28', str(got))
    check('★ 빈 칸과 「-」 는 값으로 세지 않는다',
          ('DA', '가상 검증률') not in got and ('의료기기', '가상 검증률') not in got,
          str(sorted(got)))
    check('소수도 읽는다', got.get(('MX', 'One Time Pass율')) == '88.5')
    # 가상검증률 3 + OneTimePass 3 + 데이터연결률 1 = 7.
    # 표 앞의 제목 줄("2026년 8월 2주차 DX KPI")이 행으로 새면 이 수가 늘어난다.
    check('표 앞의 제목 줄에 안 걸린다', len(r['rows']) == 7, str(len(r['rows'])))
    check('제목 줄이 KPI 로 새지 않는다',
          all('주차' not in x['kpi'] for x in r['rows']),
          str([x['kpi'] for x in r['rows']]))
    check('경고가 없다', not r['warnings'], str(r['warnings']))

    # ② 분수 — 화면과 **같은 규칙**이어야 한다
    frac = [x for x in r['rows'] if x['kpi'] == '데이터 연결률'][0]
    check('★ 분수를 화면과 같은 규칙으로 합친다 ((12/30)×100 = 40.0)',
          frac['value'] == '40.0', frac['value'])
    check('★ 분자·분모를 살려 둔다',
          (frac['numerator'], frac['denominator']) == ('12', '30'), str(frac))
    check('원문도 함께 남긴다', frac['raw'] == '12/30', frac['raw'])
    check('단위를 정의에서 가져온다', frac['unit'] == '%')
    check('구분(개발/제조)도 정의에서 가져온다', frac['category'] == '제조')

    # ③ 기준일을 지어내지 않는다
    check('★ 기준일을 만들어 내지 않는다 (문서에 없다)',
          all('baseDate' not in x and 'date' not in x for x in r['rows']),
          str(list(r['rows'][0])))

    # ── ④ 긴 형태 ─────────────────────────────────────────────────────
    print('\n── 긴 형태 (줄마다 한 값) ──')
    long_ = '\n'.join([
        '사업부\tKPI\t실적',
        'MX\t가상 검증률\t62',
        'VD\tOne Time Pass율\t90',
        'mx\t시험 완료 Lead Time\t7',          # 코드 표기도 받는다
    ])
    r2 = IM.parse_kpi_table(long_, DIVISIONS, DEFS)
    check('긴 형태로 알아본다', r2['layout'] == 'long', str(r2['layout']))
    check('세 줄을 다 읽는다', len(r2['rows']) == 3, str(len(r2['rows'])))
    check('사업부 코드(mx)도 이름(MX)으로 바꾼다',
          {x['division'] for x in r2['rows']} == {'MX', 'VD'},
          str({x['division'] for x in r2['rows']}))

    # ── ⑤ 이름을 못 맞추면 **묻는다** (조용히 버리지 않는다) ──────────
    print('\n── 못 맞춘 이름 ──')
    odd = '\n'.join([
        'KPI\tMX\tVD',
        '가상검증률\t62\t41',            # 띄어쓰기가 다르다 → 정규화로 맞아야 한다
        '설계 자동화율\t30\t20',          # 정의에 없다 → 물어봐야 한다
    ])
    r3 = IM.parse_kpi_table(odd, DIVISIONS, DEFS)
    check('★ 띄어쓰기가 달라도 맞춘다',
          any(x['kpi'] == '가상 검증률' for x in r3['rows']),
          str([x['kpi'] for x in r3['rows']]))
    check('★ 모르는 이름은 버리지 않고 물어볼 목록에 넣는다',
          [u['name'] for u in r3['unknown']] == ['설계 자동화율'],
          str(r3['unknown']))
    check('몇 번 나왔는지도 센다', r3['unknown'][0]['count'] == 1)

    # 별칭을 주면 그 다음부터는 맞는다 (2단계에서 사람이 고른 답)
    r4 = IM.parse_kpi_table(odd, DIVISIONS, DEFS,
                            aliases={IM._norm('설계 자동화율'): '가상 검증률'})
    check('★ 별칭을 주면 그 이름도 읽는다',
          len(r4['rows']) == 4 and not r4['unknown'], str(len(r4['rows'])))

    # ── ⑥ 못 읽을 때 이유를 말한다 ────────────────────────────────────
    print('\n── 못 읽을 때 ──')
    r5 = IM.parse_kpi_table('그냥 줄글입니다\n표가 아닙니다', DIVISIONS, DEFS)
    check('표가 아니면 이유를 말한다',
          r5['layout'] is None and any('표를' in w for w in r5['warnings']),
          str(r5['warnings']))
    r6 = IM.parse_kpi_table('가\t나\t다\n1\t2\t3', DIVISIONS, DEFS)
    check('★ 머리글을 못 찾으면 무엇을 읽었는지 보여준다',
          r6['layout'] is None and any('머리글' in w for w in r6['warnings']),
          str(r6['warnings']))
    check('빈 입력도 견딘다', IM.parse_kpi_table('', DIVISIONS, DEFS)['rows'] == [])

    # ── ⑦ 값 읽기 하나하나 ────────────────────────────────────────────
    print('\n── 값 읽기 ──')
    check('쉼표를 뗀다', IM.parse_value('1,234')[0] == '1234')
    check('% 기호를 뗀다', IM.parse_value('62%')[0] == '62')
    check('0 은 값이다 (빈 것이 아니다)', IM.parse_value('0')[0] == '0')
    check('「-」 는 빈 것이다', IM.parse_value('-')[0] is None)
    check('★ 0 으로 나누지 않는다', IM.parse_value('5/0')[0] is None)
    check('글자는 값이 아니다', IM.parse_value('미정')[0] is None)
    check('단위가 %가 아니면 그냥 나눈다', IM.parse_value('12/30', '일')[0] == '0.4')

    # ── ⑧ 주간 동향 ───────────────────────────────────────────────────
    print('\n── 주간 동향 ──')
    weekly = '\n'.join([
        'MX',
        '개발',
        '- 설계 자동화 도구 배포 완료',
        '  (3개 사업장 적용)',
        '- 해석 표준 템플릿 3종 추가',
        '제조',
        '. 라인 데이터 연결 12/30 완료',
        'VD',
        '- 물성 DB 확보 진척',
    ])
    w = IM.parse_weekly(weekly, DIVISIONS)
    keys = [(s['division'], s['category']) for s in w['sections']]
    check('★ 사업부·구분별로 나눈다',
          keys == [('MX', '개발'), ('MX', '제조'), ('VD', '개발')], str(keys))
    mx_dev = w['sections'][0]['content']
    check('★ 원문을 그대로 담는다 (요약하지 않는다)',
          '설계 자동화 도구 배포 완료' in mx_dev
          and '해석 표준 템플릿 3종 추가' in mx_dev, mx_dev)
    check('★ 들여쓴 이어지는 줄도 빠뜨리지 않는다',
          '(3개 사업장 적용)' in mx_dev, mx_dev)
    check('「.」 글머리표도 항목으로 본다',
          '라인 데이터 연결' in w['sections'][1]['content'])
    check('구분이 없으면 기본값이라고 알린다',
          any('개발' in x for x in IM.parse_weekly('MX\n- 한 줄', DIVISIONS)['warnings']),
          str(IM.parse_weekly('MX\n- 한 줄', DIVISIONS)['warnings']))
    check('★ 사업부보다 앞에 있는 글은 건너뛰고 알린다',
          any('어느 사업부' in x
              for x in IM.parse_weekly('머리말\nMX\n- 한 줄', DIVISIONS)['warnings']))
    check('사업부를 하나도 못 찾으면 말한다',
          any('사업부 구획' in x
              for x in IM.parse_weekly('- 그냥 목록', DIVISIONS)['warnings']))


    # ── ⑦ 운영에서 겪은 모양 — 사업부 세로 합침 + 주차 열 ────────────
    #
    # 표 모양:  사업부 | KPI | 주차별 값 …
    # 사업부를 세로로 합쳐 놓아서, 이어지는 줄에는 사업부가 **안 실려 온다.**
    # 워드는 두 가지로 내보낸다 — 빈 칸으로 두거나, 칸을 통째로 빼거나.
    # 둘 다 받아야 한다. 못 받으면 "사업부를 못 알아봤습니다" 가 줄 수만큼 쏟아진다.
    print('── 운영 모양 — 사업부 셀 병합 ──')

    # ⓐ 빈 칸으로 내보낸 경우 (칸 수는 그대로)
    blank_cell = '\n'.join([
        '사업부\tKPI\t1주\t2주\t3주',
        'MX\t가상 검증률\t60\t61\t62',
        '\tOne Time Pass율\t85\t86\t88.5',
        'VD\t가상 검증률\t40\t40\t41',
        '\tOne Time Pass율\t88\t89\t90',
    ])
    r = IM.parse_kpi_table(blank_cell, DIVISIONS, DEFS)
    got = {(x['division'], x['kpi']): x['value'] for x in r['rows']}
    check('★ 합친 사업부 칸(빈 칸)을 위 줄에서 물려받는다',
          got.get(('MX', 'One Time Pass율')) == '88.5', str(got))
    check('★ 사업부가 바뀌면 그때부터 새 사업부로 물려받는다',
          got.get(('VD', 'One Time Pass율')) == '90', str(got))
    check('네 줄이 다 들어온다', len(r['rows']) == 4, str(len(r['rows'])))
    check('가장 오른쪽(최근) 주차를 읽는다',
          got.get(('MX', '가상 검증률')) == '62', str(got))
    check('★ 물려받았다고 한 번만 알린다',
          sum(1 for w in r['warnings'] if '바로 위 사업부' in w) == 1,
          str(r['warnings']))
    check('모르는 KPI 는 없다', r['unknown'] == [], str(r['unknown']))

    # ⓑ 칸을 통째로 뺀 경우 (그 줄만 한 칸 짧고 왼쪽으로 밀린다)
    dropped = '\n'.join([
        '사업부\tKPI\t1주\t2주\t3주',
        'MX\t가상 검증률\t60\t61\t62',
        'One Time Pass율\t85\t86\t88.5',
        'DA\t가상 검증률\t20\t24\t28',
    ])
    r = IM.parse_kpi_table(dropped, DIVISIONS, DEFS)
    got = {(x['division'], x['kpi']): x['value'] for x in r['rows']}
    check('★ 칸이 통째로 빠져 밀린 줄도 읽는다',
          got.get(('MX', 'One Time Pass율')) == '88.5', str(got))
    check('밀린 줄의 값도 맞다 (한 칸 밀려 읽지 않는다)',
          got.get(('DA', '가상 검증률')) == '28', str(got))
    check('★ 밀린 줄을 "사업부를 못 알아봤다" 고 하지 않는다',
          not any('못 알아본' in w for w in r['warnings']), str(r['warnings']))

    # ⓒ 진짜로 못 알아보는 사업부는 **여전히** 말해야 한다 (한 줄로 모아서)
    bogus = '\n'.join([
        '사업부\tKPI\t실적',
        '없는사업부\t가상 검증률\t50',
        '또다른곳\t가상 검증률\t51',
        'MX\t가상 검증률\t60',
    ])
    r = IM.parse_kpi_table(bogus, DIVISIONS, DEFS)
    check('못 알아본 사업부는 그대로 알린다',
          any('못 알아본' in w for w in r['warnings']), str(r['warnings']))
    check('★ 줄마다 하나씩이 아니라 한 줄로 모아 알린다',
          sum(1 for w in r['warnings'] if '못 알아본' in w) == 1, str(r['warnings']))
    check('알아본 줄은 그대로 들어온다', len(r['rows']) == 1, str(r['rows']))

    # ── ⑧ 이름 뒤 단위 꼬리표 — 모르는 KPI 14개의 진짜 원인 ──────────
    print('── 이름 맞추기 ──')
    tails = '\n'.join([
        '사업부\tKPI\t실적',
        'MX\t가상 검증률(%)\t62',
        'MX\tOne Time Pass율 [%]\t88',
        'MX\t시험 완료 Lead Time(일)\t12',
        'MX\t데이터 연결률 (건)\t12/30',
    ])
    r = IM.parse_kpi_table(tails, DIVISIONS, DEFS)
    got = {x['kpi'] for x in r['rows']}
    check('★ 이름 뒤 단위 꼬리표를 떼고 맞춘다', len(r['unknown']) == 0, str(r['unknown']))
    check('넷 다 제 KPI 로 간다',
          got == {'가상 검증률', 'One Time Pass율', '시험 완료 Lead Time', '데이터 연결률'},
          str(got))

    # 사업부 꼬리표가 앞에 붙은 이름
    lead = '\n'.join([
        '사업부\tKPI\t실적',
        'MX\t[MX] 가상 검증률\t62',
    ])
    r = IM.parse_kpi_table(lead, DIVISIONS, DEFS)
    check('앞에 붙은 사업부 꼬리표도 뗀다',
          [x['kpi'] for x in r['rows']] == ['가상 검증률'], str(r['unknown']))

    # 비슷해서 맞춘 것은 **말해 준다** — 사람이 미리보기에서 봐야 한다
    near = '\n'.join([
        '사업부\tKPI\t실적',
        'MX\t가상 검증률 달성\t62',
    ])
    r = IM.parse_kpi_table(near, DIVISIONS, DEFS)
    check('★ 비슷해서 맞춘 것은 알린다',
          any('비슷한 것으로 맞춘' in w for w in r['warnings']), str(r['warnings']))

    # ★ 아무거나 맞추면 안 된다 — 여럿에 걸리거나 너무 짧으면 모르는 것으로 둔다
    vague = '\n'.join([
        '사업부\tKPI\t실적',
        'MX\t율\t62',
        'MX\t전혀 다른 지표 이름\t50',
    ])
    r = IM.parse_kpi_table(vague, DIVISIONS, DEFS)
    names = {u['name'] for u in r['unknown']}
    check('★ 짧은 이름을 아무 KPI 에나 붙이지 않는다', '율' in names, str(names))
    check('★ 정말 모르는 이름은 모르는 채로 둔다', '전혀 다른 지표 이름' in names, str(names))

    # 별칭도 꼬리표를 떼고 찾는다 (지난번에 사람이 골라 둔 답을 다시 묻지 않는다)
    r = IM.parse_kpi_table(
        '\n'.join(['사업부\tKPI\t실적', 'MX\t우리팀 검증지표(%)\t62']),
        DIVISIONS, DEFS, aliases={'우리팀검증지표': '가상 검증률'})
    check('★ 별칭도 단위 꼬리표를 떼고 찾는다',
          [x['kpi'] for x in r['rows']] == ['가상 검증률'], str(r['unknown']))

    print()
    if fails:
        print(f'[FAIL] {len(fails)}건 실패')
        for f in fails:
            print(f'   - {f}')
        return 1
    print('[OK] 전부 통과')
    return 0


if __name__ == '__main__':
    sys.exit(main())
