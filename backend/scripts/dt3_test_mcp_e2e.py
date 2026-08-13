"""
MCP 서버 전 기능 end-to-end 검증. (2026-08-03)

백엔드를 직접 부르지 않는다. `localhost:3003/mcp` 의 JSON-RPC 로 **실제 MCP 도구**를
부른다 — 운영에서 AI 가 겪는 것과 같은 경로다.

  A  도구 18개가 모두 등록돼 있다
  B  안내(describe)가 서버 동작과 일치한다 — 접두어 규칙·소분류 짝
  C  과제: 형식 위반은 400 (월 범위·역전·날짜·월간진척 키) ★
  D  과제: 이슈 정규화 · 상세정보 enabled 자동 채움 ★
  E  과제: 핵심 필드는 202 → confirm 으로 반영
  F  성과: 접두어 없으면 [공통] + normalized · 모르는 접두어는 400 ★
  G  성과: 여부 플래그 자동 켜짐 ★
  H  성과: 핵심 필드 PATCH 는 403 · 저위험은 즉시
  I  연결: 202 → affectedProjects · actualLevel 경고 → confirm ★
  J  뒷정리까지 확인

실행:  venv/Scripts/python.exe scripts/dt3_test_mcp_e2e.py
"""
import json
import os
import re
import sys

import requests

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                    # noqa: E402

from app import create_app                                            # noqa: E402
from app.extensions import db                                         # noqa: E402
from app.modules.auth.models import User                              # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import (            # noqa: E402
    Dt2ChangeProposal, Dt2Performance, Dt2PerformanceHistory, Dt2Project,
    Dt2ProjectChange, Dt2ProjectHistory, Dt2ProjectPerformance,
)

MCP_URL = os.environ.get('MCP_URL', 'http://127.0.0.1:3003/mcp')
FAIL, PROJ, PERF = [], [], []


def check(name, got, want):
    ok = got == want
    print(f"  {'OK  ' if ok else 'FAIL'}  {name}: got={got!r} want={want!r}")
    if not ok:
        FAIL.append(name)


def check_true(name, got):
    ok = bool(got)
    print(f"  {'OK  ' if ok else 'FAIL'}  {name}: {got!r}")
    if not ok:
        FAIL.append(name)


class Mcp:
    def __init__(self, token):
        self.c = requests.Session()
        self.h = {'Authorization': f'Bearer {token}',
                  'Content-Type': 'application/json',
                  'Accept': 'application/json, text/event-stream'}
        self.n = 0
        r = self._post({'jsonrpc': '2.0', 'id': 0, 'method': 'initialize',
                        'params': {'protocolVersion': '2024-11-05', 'capabilities': {},
                                   'clientInfo': {'name': 'e2e', 'version': '1'}}}, raw=True)
        self.h['mcp-session-id'] = r.headers['mcp-session-id']
        self._post({'jsonrpc': '2.0', 'method': 'notifications/initialized'}, raw=True)

    def _post(self, body, raw=False):
        r = self.c.post(MCP_URL, headers=self.h, json=body, timeout=120)
        if raw:
            return r
        # ⚠️ SSE 응답에는 charset 이 없어서 requests 가 ISO-8859-1 로 추측한다.
        #    그대로 두면 한글이 전부 깨져(`ë³´ê³ í˜„í™©`) 값 비교가 무의미해진다.
        r.encoding = 'utf-8'
        m = re.search(r'^data: (.+)$', r.text, re.M)
        if not m:
            raise RuntimeError(f'MCP 응답 파싱 실패: {r.status_code} {r.text[:200]}')
        return json.loads(m.group(1))

    def tools(self):
        out = self._post({'jsonrpc': '2.0', 'id': 99, 'method': 'tools/list'})
        return {t['name']: t.get('description', '') for t in out['result']['tools']}

    def call(self, tool, args):
        self.n += 1
        out = self._post({'jsonrpc': '2.0', 'id': self.n, 'method': 'tools/call',
                          'params': {'name': tool, 'arguments': args}})
        if 'error' in out:
            raise RuntimeError(f'{tool}: {out["error"]}')
        res = out['result']
        if 'structuredContent' in res:
            sc = res['structuredContent']
            return sc.get('result', sc)
        txt = ''.join(p.get('text', '') for p in res.get('content', []))
        return json.loads(txt) if txt.strip().startswith(('{', '[')) else txt


def main():
    app = create_app()
    with app.app_context():
        admin = User.query.filter_by(email='yjtwin.park@samsung.com').first()
        token = create_access_token(identity=str(admin.id))
    m = Mcp(token)

    def mkproj(fields, expect_ok=True):
        r = m.call('create_project', {
            'fields': {'과제명': '[E2E] 검증 과제', '과제년도': 2026, **fields},
            'reason': 'MCP E2E 검증'})
        if isinstance(r, dict) and r.get('uuid'):
            PROJ.append(r['uuid'])
        return r

    def mkperf(fields):
        r = m.call('create_performance', {
            'fields': {'대분류': '품질향상', '소분류': '예측 정확도',
                       '성과년도': 2026, '단위': '%', **fields},
            'reason': 'MCP E2E 검증'})
        if isinstance(r, dict) and r.get('uuid'):
            PERF.append(r['uuid'])
        return r

    print('A  도구 등록')
    tools = m.tools()
    # 도구를 늘리면 이 숫자도 같이 올린다. 숫자를 박아 두는 이유는 **모르는 사이에
    # 도구가 사라지는 것**을 잡기 위해서다(등록 실패는 조용하다 — import 오류가
    # 나도 서버는 뜨고 그 도구만 없다).
    #   18 → 20 (2026-08-05 성과 개방)
    #   20 → 27 (2026-08-12 관계도 분석·KPI 읽기·선행과제 읽기·추이 추가)
    #   27 → 28 (2026-08-12 set_project_kpi_links — KPI 연결 제안이 열렸다)
    #
    # ⚠️ 이 시험은 **떠 있는 서버**(localhost:3003)를 본다. 도구를 늘린 뒤
    #    MCP 서버를 재시작하지 않으면 옛 개수가 잡힌다 — 코드가 아니라 프로세스 문제다.
    check('도구 수', len(tools), 28)
    for t in ('create_performance', 'link_performances', 'patch_performance',
              'describe_performance_fields', 'list_project_performances'):
        check_true(f'{t} 있음', t in tools)
    check_true('link_performances 가 actualLevel 을 말린다',
               'actualLevel` 은 여기 넣지 않는다' in tools['link_performances'])
    check_true('create_performance 가 접두어 강제를 알린다',
               '서버가 강제한다' in tools['create_performance'])

    print('B  안내와 서버 동작 일치')
    d = m.call('describe_performance_fields', {})
    title = next(f for f in d['fields'] if f['key'] == '성과항목')
    check_true('성과항목에 shape 가 있다', title.get('shape'))
    check_true('접두어 강제를 알린다', '강제' in title['shape']['note'])
    sub = next(f for f in d['fields'] if f['key'] == '소분류')
    check_true('소분류 짝을 알려준다', sub.get('optionsByCategory'))
    check_true('품질향상에 예측 정확도가 있다',
               '예측 정확도' in sub['optionsByCategory'].get('품질향상', []))

    print('C  과제 형식 위반은 400 ★')
    check('시작 0 / 종료 99', mkproj({'시작': 0, '종료': 99}).get('httpStatus'), 400)
    check('시작 11 > 종료 3', mkproj({'시작': 11, '종료': 3}).get('httpStatus'), 400)
    check('날짜 2026/03/31', mkproj({'액션아이템목록': [
        {'id': 'a', '제목': 'x', '목표일': '2026/03/31', '완료여부': False,
         '완료일': '', '세부항목목록': []}]}).get('httpStatus'), 400)
    check('월간진척 키 13', mkproj({'월간진척현황': {'13': 'x'}}).get('httpStatus'), 400)

    print('D  이슈 정규화 · enabled 자동 채움 ★')
    r = mkproj({
        '이슈목록': [{'id': 1, '제목': 'x', '코멘트': 'y', '등록일': '2026-06-01',
                      '해결여부': False, '해결일': '2026-07-01'}],
        '상세정보_과제개요': {'items': [{'text': '한 줄', 'children': []}]},
        '상세정보_과제목표': {'enabled': False,
                              'items': [{'text': '숨김', 'children': []}]}})
    check('생성됨', bool(r.get('uuid')), True)
    check('미해결 이슈의 해결일이 비워짐', r['issues'][0]['해결일'], '')
    check('enabled 자동 true', r['detailOverview'].get('enabled'), True)
    check('명시적 false 는 존중', r['detailGoal'].get('enabled'), False)
    check_true('normalized 로 알린다', r.get('normalized'))
    base_proj = r['uuid']

    print('E  과제 핵심 필드는 202 → confirm')
    r = m.call('patch_project', {'uuid': base_proj, 'patch': {'과제명': '[E2E] 이름변경'},
                                 'reason': 'E2E'})
    check('202', r.get('httpStatus'), 202)
    pid = r['data']['proposalId']
    check_true('preview 있음', r['data'].get('preview'))
    ok = m.call('confirm_change', {'proposal_id': pid, 'note': 'E2E'})
    check('반영', 'title' in (ok.get('applied') or []), True)

    print('F  성과 접두어 ★')
    r = mkperf({'성과항목': 'E2E 접두어없음'})
    check('접두어 없음 → [공통]', r.get('title'), '[공통] E2E 접두어없음')
    check_true('normalized 로 알린다', r.get('normalized'))
    check('모르는 접두어 → 400',
          mkperf({'성과항목': '[무선] E2E 오타'}).get('httpStatus'), 400)
    r = mkperf({'성과항목': '[MX] E2E 정상'})
    check('올바른 접두어 통과', r.get('title'), '[MX] E2E 정상')
    check('손대지 않음', 'normalized' in r, False)

    print('G  성과 여부 플래그 자동 ★')
    r = mkperf({'성과항목': '[공통] E2E 월별', '월별실적': [{'월': 1, '값': 10}]})
    check('월별실적여부 자동 true', r.get('isMonthly'), True)
    check_true('normalized 로 알린다', r.get('normalized'))
    r = mkperf({'성과항목': '[공통] E2E 월별false',
                '월별실적': [{'월': 1, '값': 10}], '월별실적여부': False})
    check('명시적 false 는 존중', r.get('isMonthly'), False)

    print('H  성과 PATCH — 핵심 202 · 파생 · 저위험 즉시')
    target = PERF[-1]
    # 2026-08-05: 핵심은 403 → **202**(확인 후 반영). 과제와 같은 절차를 탄다.
    # 다만 `affectedProjects` 가 함께 와야 한다 — 그게 원래 403 이던 이유를 없앤 장치다.
    r = m.call('patch_performance', {
        'uuid': target, 'patch': {'목표수준': 999}, 'reason': 'E2E'})
    check('목표수준(핵심) → 202', r.get('httpStatus'), 202)
    _d = r.get('data') or {}
    check_true('affectedProjects 가 함께 온다', 'affectedProjects' in _d)
    check_true('proposalId 가 온다', bool(_d.get('proposalId')))
    m.call('cancel_change', {'proposal_id': _d['proposalId'], 'note': 'E2E 정리'})
    # 단위는 403 이 아니다 — **소분류가 정하는 파생값**이라 조용히 덮고 알린다.
    # (2026-08-05: 화면은 이미 입력을 잠그는데 서버만 자유 컬럼이라 어긋나 있었다)
    before_unit = m.call('get_performance', {'uuid': target}).get('unit')
    r = m.call('patch_performance', {
        'uuid': target, 'patch': {'단위': '건'}, 'reason': 'E2E'})
    check('단위는 403 이 아니다', r.get('httpStatus'), None)
    check('단위가 안 바뀐다 (소분류가 정한다)',
          m.call('get_performance', {'uuid': target}).get('unit'), before_unit)
    r = m.call('patch_performance', {
        'uuid': target, 'patch': {'실적수준': '77'}, 'reason': 'E2E'})
    check('실적수준(저위험) 즉시', 'actual_level' in (r.get('applied') or []), True)

    print('I  연결 — 202 · 경고 · confirm ★')
    links = m.call('list_project_performances', {'uuid': base_proj})
    check('연결 없음에서 시작', links.get('items'), [])
    r = m.call('link_performances', {
        'project_uuid': base_proj,
        'items': [{'performanceUuid': target, 'contribution': '100',
                   'actualLevel': '99'}],
        'reason': 'E2E'})
    check('202', r.get('httpStatus'), 202)
    dd = r['data']
    check('아직 반영 안 됨',
          m.call('list_project_performances', {'uuid': base_proj})['items'], [])
    check('affectedProjects 비어 있음', dd.get('affectedProjects'), [])
    w = dd.get('actualLevelWarnings') or []
    check('actualLevel 경고 1건', len(w), 1)
    check('경고가 본체 값을 알려준다', w[0].get('performanceActualLevel'), '77')
    ok = m.call('confirm_change', {'proposal_id': dd['proposalId'], 'note': 'E2E'})
    check('반영', 'performance_links' in (ok.get('applied') or []), True)
    after = m.call('list_project_performances', {'uuid': base_proj})
    check('연결 1건', len(after['items']), 1)
    check('기여도 보존', after['items'][0]['contribution'], '100')

    print('K  분류·길이·중복 강제 ★')
    check('없는 대분류 → 400',
          mkperf({'성과항목': '[공통] E2E 없는분류',
                  '대분류': '없는분류'}).get('httpStatus'), 400)
    r = m.call('create_performance', {
        'fields': {'성과항목': '[공통] E2E 짝어긋남', '대분류': '품질향상',
                   '소분류': '시험 시간', '성과년도': 2026, '단위': '%'},
        'reason': 'E2E'})
    check('대분류-소분류 짝 어긋남 → 400', r.get('httpStatus'), 400)
    check_true('어느 값이 되는지 알려준다', '예측 정확도' in (r.get('message') or ''))
    r = m.call('create_performance', {
        'fields': {'성과항목': '[공통] E2E 분류없음', '성과년도': 2026, '단위': '%'},
        'reason': 'E2E'})
    check('대분류 누락 → 400', r.get('httpStatus'), 400)
    # 성과코드 중복
    a = mkperf({'성과항목': '[공통] E2E 코드A', 'id': 'E2E-DUP'})
    check('첫 코드는 통과', bool(a.get('uuid')), True)
    b = m.call('create_performance', {
        'fields': {'성과항목': '[공통] E2E 코드B', 'id': 'E2E-DUP',
                   '대분류': '품질향상', '소분류': '예측 정확도',
                   '성과년도': 2026, '단위': '%'}, 'reason': 'E2E'})
    check('중복 코드 → 409', b.get('httpStatus'), 409)
    # 상세정보 길이·개수
    check('상세정보 60자 → 400', mkproj({
        '상세정보_과제개요': {'enabled': True,
                              'items': [{'text': '가' * 60, 'children': []}]}
    }).get('httpStatus'), 400)
    r = mkproj({'상세정보_과제개요': {'enabled': True, 'items': [
        {'text': 'a', 'children': []}, {'text': 'b', 'children': []},
        {'text': 'c', 'children': []}]}})
    check('과제개요 3항목 → 400', r.get('httpStatus'), 400)
    check_true('2개 제한을 알려준다', '2개까지' in (r.get('message') or ''))
    check('과제개요에 children → 400', mkproj({
        '상세정보_과제개요': {'enabled': True, 'items': [
            {'text': 'a', 'children': [{'text': 'b'}]}]}}).get('httpStatus'), 400)
    check('상세내용 39자 이하 + children 은 통과', bool(mkproj({
        '상세정보_상세내용': {'enabled': True, 'items': [
            {'text': '정상 한 줄', 'children': [{'text': '하위 줄'}]}]}
    }).get('uuid')), True)
    # 이슈 날짜 역전
    check('해결일 < 등록일 → 400', mkproj({'이슈목록': [
        {'id': 1, '제목': 'x', '코멘트': 'y', '등록일': '2026-08-01',
         '해결여부': True, '해결일': '2026-01-01'}]}).get('httpStatus'), 400)
    # 지연 완료는 정상이라 막지 않는다
    check('완료일 > 목표일 은 통과(지연 완료)', bool(mkproj({'액션아이템목록': [
        {'id': 'x', '제목': 'A', '목표일': '2026-03-31', '완료여부': True,
         '완료일': '2026-12-31', '세부항목목록': []}]}).get('uuid')), True)

    print(f'  (MCP 호출 {m.n}회)')

    print('J  뒷정리')
    with app.app_context():
        for u in PROJ:
            Dt2ProjectPerformance.query.filter_by(project_uuid=u).delete()
            Dt2ChangeProposal.query.filter_by(project_uuid=u).delete()
            Dt2ProjectChange.query.filter_by(project_uuid=u).delete()
            Dt2ProjectHistory.query.filter_by(project_uuid=u).delete()
        Dt2Project.query.filter(Dt2Project.uuid.in_(PROJ)).delete(
            synchronize_session=False)
        Dt2PerformanceHistory.query.filter(
            Dt2PerformanceHistory.performance_uuid.in_(PERF)).delete(
                synchronize_session=False)
        Dt2Performance.query.filter(Dt2Performance.uuid.in_(PERF)).delete(
            synchronize_session=False)
        db.session.commit()
        check('과제 정리', Dt2Project.query.filter(
            Dt2Project.title.like('[E2E]%')).count(), 0)
        check('성과 정리', Dt2Performance.query.filter(
            Dt2Performance.title.like('%E2E%')).count(), 0)
        # 기존 데이터가 그대로인지.
        #
        # ⚠️ 건수를 **적어 두지 않는다** — 시딩 명세에서 읽는다. 숫자를 박아 두면
        #    성과를 늘릴 때마다 이 검사가 빨간불이 되고(2026-08-05: 비용절감 12건을
        #    더하면서 100 → 112), "시험이 틀렸나 데이터가 틀렸나" 를 매번 따져야 한다.
        from dt3_perf_2026_data import PERFS                          # noqa: E402
        want_projects = len({s['code'] for s in PERFS})
        live = Dt2Project.query.filter(
            Dt2Project.year == 2026, Dt2Project.is_deleted.is_(False)).count()
        check(f'2026 과제 {want_projects}건 유지', live, want_projects)
        check(f'성과 {len(PERFS)}건 유지', Dt2Performance.query.filter(
            Dt2Performance.is_deleted.isnot(True)).count(), len(PERFS))

    print()
    if FAIL:
        print(f'실패 {len(FAIL)}건: {", ".join(FAIL)}')
        return 1
    print('전부 통과')
    return 0


if __name__ == '__main__':
    sys.exit(main())
