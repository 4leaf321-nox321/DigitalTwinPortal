"""폼 채우기 도우미 — 화이트리스트 · 값 검증 · 관문.

`dt3_test_agent.py` 와 같은 방식이다: **`chat` 하나만 각본형 fake 로 갈아끼우고**
그 아래(화이트리스트·선택지 대조·값 강제·중복 판정)는 전부 진짜 코드를 태운다.
LLM 도, 백엔드 기동도 필요 없다 — 이 기능은 REST 를 되부르지 않기 때문이다
(에이전트와 다른 점이다. 저쪽은 자기 API 를 부르므로 서버가 떠 있어야 한다).

여기서 지켜보는 것은 결국 **하나다** —
    모델이 뭘 뱉든, 화면에 닿는 값은 저장 가능한 값이어야 한다.
모델이 지어낸 사업부, 13월, 남의 해 날짜, 액션아이템 완료 표시가 폼에 들어가면
사용자는 그걸 못 알아보고 저장한다.

실행: python scripts\\dt3_test_form_assist.py
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask_jwt_extended import create_access_token                 # noqa: E402

from app import create_app                                         # noqa: E402
from app.modules.auth.models import User, UserRole                 # noqa: E402
from app.modules.digital_twin_dashboard import detail_rules as DR  # noqa: E402
from app.modules.digital_twin_dashboard import permissions as P    # noqa: E402
from app.modules.digital_twin_dashboard.ai import form_assist as F  # noqa: E402
from app.modules.digital_twin_dashboard.ai import llm as L         # noqa: E402
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project  # noqa: E402

fails = []


def check(desc, ok, extra=''):
    print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}" + (f'   {extra}' if not ok and extra else ''))
    if not ok:
        fails.append(desc)


def _answer(payload, *, fence=True, prefix='', finish_reason='stop'):
    """모델이 이렇게 답했다고 치고 `chat` 을 대신한다."""
    text = json.dumps(payload, ensure_ascii=False) if not isinstance(payload, str) else payload
    if fence and not isinstance(payload, str):
        text = '```json\n' + text + '\n```'
    body = prefix + text

    def fake_chat(messages, **kw):
        fake_chat.messages = messages
        fake_chat.kwargs = kw
        return L.ChatResult(content=body, model='fake', finish_reason=finish_reason)

    return fake_chat


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    app = create_app()
    orig_chat = F.chat

    with app.app_context():
        # ── 1. 채울 수 있는 칸 ────────────────────────────────────────────
        #
        # 화이트리스트를 손으로 늘릴 때 **여기가 관문이다.** 파생·금지 필드가 하나라도
        # 새어 들어가면 사용자는 저장 버튼을 눌러서야(400) 안다.
        print('── 채울 수 있는 칸 ──')
        specs = F.fillable_specs()
        check('칸이 하나 이상 있다', bool(specs), str(list(specs)))
        for banned in ('진행률', '진행상태', '과제참여인력목록', '과제PL_knoxId',
                       '작성자', '담당부서목록', '성과목록', '과제년도'):
            check(f'★ "{banned}" 는 채우지 않는다', banned not in specs)
        check('그 이유가 코드에 적혀 있다',
              all(k in F._EXCLUDED for k in ('진행률', '진행상태', '과제PL_knoxId')),
              '_EXCLUDED 에 사유를 적을 것')

        # 선택지는 **설정 테이블에서** 온다 — 못 읽으면 그 칸은 아예 빠져야 한다
        # (목록 없이 채우게 두면 모델이 사업부 이름을 지어낸다).
        for key in ('사업부', '프로세스'):
            if key in specs:
                check(f'"{key}" 에 선택지가 실렸다', bool(specs[key].get('options')),
                      str(specs[key])[:100])
        check('모든 choice 칸에 선택지가 있다',
              all(s.get('options') for s in specs.values() if s['type'] == 'choice'))

        # ── 2. JSON 건져내기 ──────────────────────────────────────────────
        print('\n── 응답에서 JSON 건져내기 ──')
        check('그냥 JSON', F._extract_json('{"a": 1}') == {'a': 1})
        check('코드펜스로 감싼 것',
              F._extract_json('```json\n{"a": 1}\n```') == {'a': 1})
        check('앞뒤에 말이 붙은 것',
              F._extract_json('네, 이렇게요:\n{"a": 1}\n확인해 주세요') == {'a': 1})
        check('깨진 것은 예외가 아니라 None', F._extract_json('{그냥 말') is None)
        check('빈 응답도 None', F._extract_json('') is None)

        # ── 3. 폼 채우기 — 값 강제 ────────────────────────────────────────
        print('\n── 폼 채우기 ──')
        div = (specs.get('사업부', {}).get('options') or [None])[0]

        F.chat = _answer({'fields': {
            '과제명': '  힌지 수명 예측 오차 저감  ',
            '사업부': '있을리없는사업부',
            '시작': 3, '종료': 13,
            '중점과제여부': 'true',
            '진행률': 80,                      # 화이트리스트 밖
            '없는칸': 'x',
        }, 'note': '두 칸은 근거가 없어 비웠습니다.'})
        try:
            out = F.fill_project_form(current={'과제명': '이전 이름'}, source='아무 글')
        finally:
            F.chat = orig_chat

        patch, skipped = out['patch'], {s['key']: s['why'] for s in out['skipped']}
        check('문자열은 앞뒤 공백이 정리된다',
              patch.get('과제명', {}).get('value') == '힌지 수명 예측 오차 저감', str(patch)[:160])
        check('★ 선택지에 없는 값은 버린다', '사업부' not in patch, str(patch)[:160])
        check('그 사유가 쓸 수 있는 값을 알려준다',
              '선택지' in (skipped.get('사업부') or ''), str(skipped)[:160])
        check('월 번호 1~12 안은 통과', patch.get('시작', {}).get('value') == 3)
        check('★ 13월은 버린다', '종료' not in patch, str(patch)[:160])
        check('"true" 문자열도 참으로 받는다',
              patch.get('중점과제여부', {}).get('value') is True)
        check('★ 화이트리스트 밖(진행률)은 버린다', '진행률' not in patch)
        check('그 사유가 400 을 말한다', '400' in (skipped.get('진행률') or ''),
              str(skipped.get('진행률')))
        check('모르는 칸도 조용히 넘기지 않는다', '없는칸' in skipped, str(skipped))
        check('모델의 note 가 사용자에게 전달된다',
              any('비웠습니다' in n for n in out['notes']), str(out['notes']))
        check('어느 탭의 칸인지 함께 준다',
              patch.get('과제명', {}).get('tab') == '기본정보', str(patch)[:120])

        # 지금 값과 같으면 **변경으로 세지 않는다** — 미리보기에 안 바뀌는 줄이 섞이면
        # 사람이 무엇을 확인해야 하는지 흐려진다.
        # 🐞 다만 **조용히 빼면 안 된다**(2026-08-08 실측). 모델이 사업부를 제대로
        #    골랐는데 지금 값과 같아 아무것도 안 뜨자, "선택지 있는 칸은 안 되는구나" 로
        #    읽혔다. 안 바꾼 것과 못 채운 것은 다르다 — 그렇게 말해 줘야 한다.
        F.chat = _answer({'fields': {'과제명': '같은 이름'}})
        try:
            same = F.fill_project_form(current={'과제명': '같은 이름'}, source='x')
        finally:
            F.chat = orig_chat
        check('★ 지금 값과 같으면 제안하지 않는다', same['patch'] == {}, str(same['patch']))
        check('★ 그때 "그대로 두었다" 고 알린다',
              any('그대로 두었습니다' in n for n in same['notes']), str(same['notes']))

        # 선택지는 **공백·대소문자만** 봐 준다. 그 이상 비슷한 말은 지어낸 값이다.
        if div:
            F.chat = _answer({'fields': {'사업부': f' {div.lower()} '}})
            try:
                loose = F.fill_project_form(current={}, source='x')
            finally:
                F.chat = orig_chat
            check(f'공백·대소문자만 다른 선택지는 받아 준다 ({div})',
                  loose['patch'].get('사업부', {}).get('value') == div, str(loose)[:160])

        # `{"fields": …}` 를 빼먹는 모델이 있다 — 받아 준다
        F.chat = _answer({'과제명': '봉투 없는 응답'})
        try:
            flat = F.fill_project_form(current={}, source='x')
        finally:
            F.chat = orig_chat
        check('fields 봉투가 없어도 읽는다',
              flat['patch'].get('과제명', {}).get('value') == '봉투 없는 응답', str(flat)[:160])

        # JSON 이 아니면 **죽지 않고** 안내한다
        F.chat = _answer('죄송합니다, 잘 모르겠어요.')
        try:
            broken = F.fill_project_form(current={}, source='x')
        finally:
            F.chat = orig_chat
        check('JSON 이 아니면 빈 제안 + 안내', broken['patch'] == {} and broken['notes'],
              str(broken)[:160])

        # 길이 제한에 걸려 잘린 것은 **다른 안내**여야 한다 — 고칠 곳이 원문이 아니라
        # `LLM_MAX_TOKENS` 다. 같은 문구면 사용자가 엉뚱한 곳을 고치며 헤맨다.
        F.chat = _answer('{"fields": {"과제명": "여기서 끊', fence=False,
                         finish_reason='length')
        try:
            cut = F.fill_project_form(current={}, source='x')
        finally:
            F.chat = orig_chat
        check('★ 길이 제한으로 잘리면 그렇게 말한다',
              any('길이 제한' in n for n in cut['notes']), str(cut['notes']))
        check('그 안내가 고칠 설정 이름을 알려준다',
              any('LLM_MAX_TOKENS' in n for n in cut['notes']), str(cut['notes']))

        # 원문 상한 — 잘랐으면 **알린다**. 상한은 `.env` 로 조절한다.
        F.chat = _answer({'fields': {}})
        try:
            long_out = F.fill_project_form(current={}, source='가' * (F._source_limit() + 10))
        finally:
            F.chat = orig_chat
        check('★ 원문을 자르면 조용히 넘기지 않는다',
              any('자만 읽었' in n for n in long_out['notes']), str(long_out['notes']))

        # 출력 길이는 **설정 하나로** 조절돼야 한다 — 호출부가 숫자를 박으면
        # `.env` 를 올려도 그 경로만 안 따라와서 "올렸는데 여전히 잘린다" 가 된다.
        F.chat = _answer({'fields': {}})
        try:
            F.fill_project_form(current={}, source='x')
            fill_kw = F.chat.kwargs
            F.extract_action_items(source='x', year=2026)
            act_kw = F.chat.kwargs
        finally:
            F.chat = orig_chat
        check('★ 폼 채우기가 max_tokens 를 박지 않는다', 'max_tokens' not in fill_kw, str(fill_kw))
        check('★ 액션아이템도 박지 않는다', 'max_tokens' not in act_kw, str(act_kw))
        check('설정에 LLM_MAX_TOKENS 가 있다',
              isinstance(app.config.get('LLM_MAX_TOKENS'), int),
              str(app.config.get('LLM_MAX_TOKENS')))
        check('설정에 LLM_FORM_SOURCE_CHARS 가 있다',
              isinstance(app.config.get('LLM_FORM_SOURCE_CHARS'), int),
              str(app.config.get('LLM_FORM_SOURCE_CHARS')))

        # ── 3-2. 상세 과제 정보 ───────────────────────────────────────────
        #
        # 여기가 이 칸의 전부다 — **화면과 서버가 같은 한계를 보는가.**
        # 규칙이 갈리면 "화면은 넣었다는데 저장이 400" 이 되고, 사용자는 원인을
        # 알 방법이 없다. 그래서 `detail_rules` 한 곳만 본다.
        print('\n── 상세 과제 정보 ──')
        check('7섹션이 다 채울 수 있는 칸에 있다',
              all(k in specs for k in DR.DETAIL_KEYS),
              str([k for k in DR.DETAIL_KEYS if k not in specs]))
        check('★ 섹션 순서가 화면(DetailInfoModal)과 같다',
              DR.DETAIL_KEYS[4] == '상세정보_성과' and DR.DETAIL_KEYS[5] == '상세정보_산출물',
              str(DR.DETAIL_KEYS))
        check('컬럼 대응이 빠짐없다',
              set(DR.KEY_TO_COL.values()) == set(DR.DETAIL_SECTION_COLS),
              str(set(DR.DETAIL_SECTION_COLS) - set(DR.KEY_TO_COL.values())))
        check('앞 3섹션은 항목 2개까지로 잡혀 있다',
              specs['상세정보_과제개요']['max_items'] == DR.DETAIL_PARENT_MAX)

        long_line = '가' * 40                      # 39자 초과
        F.chat = _answer({'fields': {
            '상세정보_과제개요': {'items': [
                {'text': ' 해석 정확도 개선 ', 'children': [{'text': '하위 줄'}]},
                {'text': long_line},
                {'text': '시험 조건 표준화'},
                {'text': '세 번째 줄'},           # 2개 제한 초과
            ]},
            '상세정보_상세내용': [                 # items 배열만 보내는 모델도 있다
                {'text': '부모 줄', 'children': [{'text': '자식 줄'}, {'text': long_line}]},
            ],
        }})
        try:
            det = F.fill_project_form(current={}, source='x')
        finally:
            F.chat = orig_chat

        head = det['patch'].get('상세정보_과제개요', {}).get('value')
        body = det['patch'].get('상세정보_상세내용', {}).get('value')
        notes = ' / '.join(det['notes'])
        check('섹션이 제안에 올라온다', isinstance(head, dict), str(det['patch'])[:200])
        check('★ enabled 를 반드시 켠다 (없으면 화면이 섹션을 건너뛴다)',
              head and head.get('enabled') is True, str(head)[:160])
        check('앞뒤 공백을 정리한다',
              head and head['items'][0]['text'] == '해석 정확도 개선', str(head)[:160])
        check('★ 39자 넘는 줄만 빼고 섹션은 살린다',
              head and all(long_line not in it['text'] for it in head['items']) and head['items'],
              str(head)[:200])
        check('그 사실을 알린다', '39자' in notes or '넘는 줄' in notes, notes[:200])
        check('★ 앞 3섹션의 하위 줄은 버린다',
              head and head['items'][0]['children'] == [], str(head)[:160])
        check('그것도 알린다', '하위 줄' in notes, notes[:200])
        check('★ 항목 수 제한을 넘으면 뒤를 자른다',
              head and len(head['items']) <= DR.DETAIL_PARENT_MAX, str(head)[:160])
        check('items 배열만 보내도 받아 준다', isinstance(body, dict), str(body)[:160])
        check('하위 줄이 되는 섹션은 살린다',
              body and body['items'][0]['children'] == [{'text': '자식 줄'}], str(body)[:200])
        check('kind 로 종류를 알려준다',
              det['patch']['상세정보_과제개요'].get('kind') == 'detail',
              str(det['patch']['상세정보_과제개요'])[:120])
        check('탭 이름이 상세 과제 정보다',
              det['patch']['상세정보_과제개요'].get('tab') == '상세 과제 정보')

        # 서버가 실제로 받아 주는 모양인가 — **저장 경로의 검증을 그대로 태운다.**
        # 이게 통과해야 "화면엔 들어갔는데 저장이 400" 이 안 난다.
        for key, val in (('상세정보_과제개요', head), ('상세정보_상세내용', body)):
            errs = DR.detail_section_errors(DR.KEY_TO_COL[key], val)
            check(f'★★ {key} 결과가 저장 검증을 통과한다', not errs, str(errs)[:200])

        # 줄이 하나도 안 남으면 **제안하지 않는다**(빈 섹션을 켜면 화면에 빈 칸이 생긴다)
        F.chat = _answer({'fields': {'상세정보_과제목표': {'items': [{'text': long_line}]}}})
        try:
            empty_sec = F.fill_project_form(current={}, source='x')
        finally:
            F.chat = orig_chat
        check('★ 남는 줄이 없으면 섹션을 만들지 않는다',
              '상세정보_과제목표' not in empty_sec['patch'], str(empty_sec['patch'])[:160])
        check('왜 못 넣었는지 말한다',
              any(s['key'] == '상세정보_과제목표' for s in empty_sec['skipped']),
              str(empty_sec['skipped'])[:200])

        # 지금 값과 같은 섹션은 제안하지 않는다 (구조체 비교)
        same_sec = {'enabled': True, 'items': [{'text': '같은 줄', 'children': []}]}
        F.chat = _answer({'fields': {'상세정보_과제개요': same_sec}})
        try:
            dup = F.fill_project_form(current={'상세정보_과제개요': same_sec}, source='x')
        finally:
            F.chat = orig_chat
        check('★ 내용이 같은 섹션은 제안하지 않는다',
              '상세정보_과제개요' not in dup['patch'], str(dup['patch'])[:160])

        # ── 4. 액션아이템 뽑기 ────────────────────────────────────────────
        print('\n── 붙여넣기 → 액션아이템 ──')
        F.chat = _answer({'items': [
            {'제목': '시험 조건 확정', '목표일': '2026-03-31',
             '액티비티': ['조건표 초안', {'내용': '검토 회의'}, '   ']},
            {'제목': '데이터 수집', '목표일': '2025-12-31'},      # 다른 해
            {'제목': '  ', '액티비티': []},                        # 제목 없음
            {'제목': '시험조건확정', '완료여부': True},            # 같은 붙여넣기 안에서 중복
        ]})
        try:
            act = F.extract_action_items(source='회의록', year=2026,
                                         project_name='ProjA',
                                         existing_titles=['데이터 수집'])
        finally:
            F.chat = orig_chat

        items = act['items']
        check('제목이 없는 항목은 버린다', len(items) == 3, str(items)[:200])
        check('액티비티는 문자열·객체 둘 다 받는다',
              items and [d['내용'] for d in items[0]['세부항목목록']] == ['조건표 초안', '검토 회의'],
              str(items[0] if items else ''))
        check('빈 액티비티는 버린다',
              items and len(items[0]['세부항목목록']) == 2)
        check('★★ 완료 여부는 결과에 담기지 않는다',
              all('완료여부' not in it and '완료일' not in it for it in items),
              str(items)[:200])
        check('★ 과제년도 밖 목표일은 비운다',
              items[1]['목표일'] == '' if len(items) > 1 else False, str(items)[:200])
        check('그 사실을 사용자에게 알린다',
              any('2026년이 아니' in n for n in act['notes']), str(act['notes']))
        check('그때도 항목 자체는 살린다', len(items) > 1 and items[1]['제목'] == '데이터 수집')
        check('새 항목은 duplicate 가 아니다', items[0].get('duplicate') is False, str(items[0]))
        check('★ 이미 있는 액션아이템과 같으면 duplicate 로 표시한다',
              items[1].get('duplicate') is True, str(items[1]))
        # 같은 회의록을 두 번 붙여넣는 일보다, **한 회의록 안에 같은 일이 두 번 적히는**
        # 일이 더 흔하다. 띄어쓰기만 다른 것도 같은 일로 본다.
        check('★ 같은 붙여넣기 안의 중복도 잡는다 (띄어쓰기 무시)',
              items[2].get('duplicate') is True, str(items[2]))
        check('id 는 서버가 만들지 않는다 (화면이 붙인다)',
              all('id' not in it for it in items))

        # 상한 — 잘랐으면 알린다
        F.chat = _answer({'items': [{'제목': f'일 {i}'} for i in range(F.MAX_ACTION_ITEMS + 5)]})
        try:
            many = F.extract_action_items(source='x', year=2026)
        finally:
            F.chat = orig_chat
        check(f'★ 한 번에 {F.MAX_ACTION_ITEMS}건까지만 만든다',
              len(many['items']) == F.MAX_ACTION_ITEMS, str(len(many['items'])))
        check('잘랐다는 사실을 알린다',
              any('뺐습니다' in n for n in many['notes']), str(many['notes']))

        F.chat = _answer({'items': []})
        try:
            empty = F.extract_action_items(source='뽑을 게 없는 글', year=2026)
        finally:
            F.chat = orig_chat
        check('뽑을 것이 없으면 빈 목록 (오류가 아니다)', empty['items'] == [])

        # ── 4-2. 참여인력 후보 ────────────────────────────────────────────
        #
        # 🚨 여기가 이 기능에서 **가장 위험한 자리**다. 참여인력에 들어간 사람은 그 과제를
        #    고칠 수 있게 되는데(is_project_member), 원문에는 동명이인을 가릴 정보가 없다.
        #    그래서 **모델이 계정을 고르지 못하게** 못 박는다 — 이름만 뽑고, 계정은
        #    서버가 찾고, 누구인지는 사람이 고른다.
        print('\n── 붙여넣기 → 참여인력 후보 ──')

        def fake_resolver(name):
            table = {
                '홍길동': [{'이름': '홍길동', 'knoxId': 'hong.gd', '부서': '개발그룹'},
                           {'이름': '홍길동', 'knoxId': 'gd.hong', '부서': '품질그룹'}],
                '김철수': [{'이름': '김철수', 'knoxId': 'cs.kim', '부서': '해석파트'}],
            }
            return table.get(name, [])

        F.chat = _answer({'people': [
            {'이름': '홍길동', '근거': '참석: 홍길동 책임', 'knoxId': '모델이지어낸값'},
            {'이름': '김철수', '근거': '해석은 김철수 선임'},
            {'이름': '없는사람', '근거': '메일 참조'},
            {'이름': '  ', '근거': 'x'},
            {'이름': '김철수', '근거': '중복'},
        ]})
        try:
            ppl = F.extract_people(source='회의록', existing_names=['박영희'],
                                   resolver=fake_resolver)
        finally:
            F.chat = orig_chat

        rows = ppl['people']
        check('빈 이름과 중복은 버린다', len(rows) == 3, str(rows)[:200])
        check('★★ 모델이 보낸 knoxId 는 쓰지 않는다',
              all('knoxId' not in r for r in rows), str(rows)[:200])
        check('★ 서버가 찾은 후보를 붙인다',
              rows[0]['candidates'] == fake_resolver('홍길동'), str(rows[0])[:200])
        check('★ 동명이인을 표시한다', rows[0]['동명이인'] is True, str(rows[0])[:160])
        check('후보가 하나면 동명이인이 아니다', rows[1]['동명이인'] is False, str(rows[1])[:160])
        check('★ 계정을 못 찾아도 이름은 남긴다 (미가입일 수 있다)',
              rows[2]['candidates'] == [], str(rows[2])[:160])
        check('근거 문장을 함께 준다', rows[0]['근거'] == '참석: 홍길동 책임', str(rows[0])[:160])

        F.chat = _answer({'people': [{'이름': '박영희', '근거': 'x'}]})
        try:
            dup_p = F.extract_people(source='x', existing_names=['박영희'],
                                     resolver=fake_resolver)
        finally:
            F.chat = orig_chat
        check('이미 등록된 사람은 다시 만들지 않는다', dup_p['people'] == [], str(dup_p)[:160])

        pp = F._people_prompt(source='원문', existing=['박영희'])
        check('★ knoxId 를 만들지 말라고 못 박는다',
              'knoxId·사번·이메일을 만들지 마라' in pp[0]['content'], pp[0]['content'][:200])
        check('근거를 요구한다', '근거' in pp[0]['content'])

        # ── 4-3. DX KPI 추천 ──────────────────────────────────────────────
        #
        # ⚠️ 이 자리는 서버가 AI 쓰기를 **403 으로 막아 둔 곳**이다. 폼 도우미만 예외인
        #    근거는 셋이다 — 연결을 만들지 않고 / 자동 체크가 없고 / 사람이 저장한다.
        #    아래 검사는 그중 **첫째**를 못 박는다: 목록 밖 id·이미 걸린 것은 못 나온다.
        print('\n── DX KPI 추천 ──')
        AVAIL = [
            {'kpiDefinitionId': 1, 'label': '해석 정확도', 'category': '품질',
             'unit': '%', 'kind': 'metric', 'divisions': []},
            {'kpiDefinitionId': 2, 'label': '플랫폼 구축', 'category': '기반',
             'unit': '', 'kind': 'platform', 'divisions': ['mx']},
            {'kpiDefinitionId': 3, 'label': '이미 걸린 지표', 'category': '기타',
             'unit': '건', 'kind': 'metric', 'divisions': []},
        ]
        F.chat = _answer({'kpis': [
            {'id': 1, '근거': '해석 오차를 줄이는 과제라서'},
            {'id': 3, '근거': '이미 걸려 있음'},
            {'id': 999, '근거': '목록에 없는 id'},
            {'id': 2},                                    # 근거 없음
            {'id': 1, '근거': '중복'},
        ]})
        try:
            kpi = F.suggest_kpi_links(project={'과제명': 'ProjA'}, available=AVAIL,
                                      linked_ids=[3])
        finally:
            F.chat = orig_chat

        ids = [it['kpiDefinitionId'] for it in kpi['items']]
        check('★ 목록에 없는 id 는 버린다', 999 not in ids, str(ids))
        check('★ 이미 걸린 지표는 제안하지 않는다', 3 not in ids, str(ids))
        check('중복은 한 번만', ids.count(1) == 1, str(ids))
        check('근거를 함께 준다',
              kpi['items'][0].get('근거') == '해석 오차를 줄이는 과제라서',
              str(kpi['items'][0])[:160])
        check('지표 이름·단위를 붙여 준다',
              kpi['items'][0].get('label') == '해석 정확도', str(kpi['items'][0])[:160])
        check('★ 근거 없는 추천을 알린다',
              any('근거를 적지 않은' in n for n in kpi['notes']), str(kpi['notes'])[:200])
        check('★★ 대상 사업부·기여방법은 담지 않는다 (화면 규칙이 정한다)',
              all('targetDivision' not in it and 'note' not in it for it in kpi['items']),
              str(kpi['items'])[:200])

        kp = F._kpi_prompt(project={'과제명': 'ProjA'}, available=AVAIL,
                           linked_ids=[3], instruction='')
        check('★ "빈칸을 가짜로 채우지 마라" 규칙이 있다',
              '가짜로 채우면' in kp[0]['content'], kp[0]['content'][:200])
        check('이미 걸린 지표를 프롬프트가 표시한다',
              '이미 연결됨' in kp[0]['content'])
        check('대상·기여방법을 정하지 말라고 못 박는다',
              '정하지 마라' in kp[0]['content'])
        check('근거가 아무것도 없으면 그렇게 말해 준다',
              '모두 비어 있다' in kp[1]['content'], kp[1]['content'][:200])

        # ★ 상세 과제 정보가 **근거의 중심**이다 — 실제로 과제 설명보다 여기에 내용이
        #   적혀 있는 과제가 더 많다(2026-08-08). 프롬프트에서 **앞에** 실려야 한다.
        kp2 = F._kpi_prompt(
            project={'과제명': 'ProjA',
                     '상세정보': '[과제목표]\n- 해석 오차 15% 저감',
                     '과제상세설명': '<p>설명 <b>본문</b></p><p>둘째 줄</p>'},
            available=AVAIL, linked_ids=[], instruction='')
        body = kp2[1]['content']
        check('★ 상세 과제 정보가 프롬프트에 실린다', '해석 오차 15% 저감' in body, body[:300])
        check('★ 상세 과제 정보를 과제 설명보다 **앞에** 싣는다',
              body.index('[상세 과제 정보]') < body.index('[과제 설명]'), body[:300])
        check('★ 그것을 먼저 읽으라고 지시한다',
              '[상세 과제 정보] 를 먼저 읽어라' in kp2[0]['content'], kp2[0]['content'][:400])
        check('★★ 과제 설명의 HTML 태그는 벗겨서 싣는다',
              '<p>' not in body and '<b>' not in body and '설명 본문' in body, body[:300])

        # 화면이 끈 섹션(enabled=false)은 **근거가 아니다** — 화면에 안 보이는 내용으로
        # 판단하면 사람이 그 근거를 찾을 수가 없다.
        rendered = DR.render_detail_text({
            '상세정보_과제개요': {'enabled': True, 'items': [
                {'text': '보이는 줄', 'children': [{'text': '하위 줄'}]}]},
            '상세정보_추진배경': {'enabled': False, 'items': [{'text': '꺼진 줄'}]},
            '상세정보_과제목표': {'enabled': True, 'items': []},
        })
        check('섹션 이름을 붙여 줄글로 만든다', '[과제개요]' in rendered, rendered[:160])
        check('하위 줄을 들여쓴다', '  - 하위 줄' in rendered, rendered[:160])
        check('★ 화면이 끈 섹션은 빼고 만든다', '꺼진 줄' not in rendered, rendered[:200])
        check('빈 섹션은 이름도 안 만든다', '[과제목표]' not in rendered, rendered[:200])

        F.chat = _answer({'kpis': []})
        try:
            none_kpi = F.suggest_kpi_links(project={}, available=[], linked_ids=[])
        finally:
            F.chat = orig_chat
        check('지표가 없으면 부르지도 않고 안내한다',
              none_kpi['items'] == [] and none_kpi['notes'], str(none_kpi)[:160])

        # ── 5. 프롬프트에 규칙이 실렸나 ───────────────────────────────────
        #
        # 규칙이 빠져도 응답은 그럴듯하게 온다 — **조용히** 나빠지는 종류라 못 박는다.
        print('\n── 프롬프트 ──')
        fill_msgs = F._fill_prompt(specs, {'과제명': '현재값'}, '원문', '지시')
        sysmsg = fill_msgs[0]['content']
        check('폼 채우기 프롬프트에 표식이 있다', sysmsg.startswith(F.MARK_FILL))
        check('선택지 목록이 프롬프트에 실린다',
              (div in sysmsg) if div else True, sysmsg[:200])
        check('"지어내지 마라" 규칙이 있다', '확실치 않으면' in sysmsg)
        check('사람·진행률을 넣지 말라고 못 박는다',
              '진행률' in sysmsg and '진행상태' in sysmsg)
        check('현재 값이 프롬프트에 실린다', '현재값' in fill_msgs[1]['content'])

        act_msgs = F._action_prompt(source='원문', project_name='ProjA', year=2026,
                                    start_month=1, end_month=12,
                                    existing=['이미 있는 일'])
        act_sys = act_msgs[0]['content']
        check('액션아이템 프롬프트에 표식이 있다', act_sys.startswith(F.MARK_ACTIONS))
        check('★ 완료 여부를 쓰지 말라고 못 박는다', '완료 여부는 쓰지 마라' in act_sys)
        check('과제년도를 프롬프트에 못 박는다', '2026년 안이어야 한다' in act_sys)
        check('기존 액션아이템이 프롬프트에 실린다', '이미 있는 일' in act_msgs[1]['content'])

        # ★ 서술형 과제 설명도 다뤄야 한다 — 회의록만 되는 줄 알면 이 기능을 못 쓴다.
        #   (2026-08-08: 라벨을 "과제 내용을 입력하세요" 로 바꾸면서 같이 넓혔다)
        check('★ 서술형 글을 단계로 나누라고 지시한다',
              '서술형' in act_sys and '문장을 일의 단계로 나눈다' in act_sys, act_sys[:400])
        check('나누는 실마리(행동 동사)를 준다', '…확보, …개발, …구축' in act_sys)
        check('★★ 그래도 없는 일을 더하지 말라는 경계가 있다',
              '원문에 없는 일을 더하지는 마라' in act_sys, act_sys[:600])
        check('한 건의 크기와 건수를 안내한다',
              '한두 달 안에 끝날 크기' in act_sys and '3~8건' in act_sys)
        check('과제 기간을 프롬프트에 싣는다', '1월 ~ 12월' in act_sys)
        check('★ 기한을 짐작해 만들지 말라고 못 박는다', '짐작해서 만들지 마라' in act_sys)
        check('목록 순서가 화면 순서임을 알린다', '순서가 곧 화면의 순서' in act_sys)
        check('입력 라벨이 "과제 내용" 이다', '[과제 내용]' in act_msgs[1]['content'])

        # ── 6. 개발 스텁이 표식을 알고 있나 ───────────────────────────────
        #
        # 개발서버에는 LLM 이 없다. 스텁이 이 표식을 못 알아보면 되울림이 와서
        # **개발에서 이 기능을 한 번도 못 돌려본다.** 그 사실을 여기서 잡는다.
        print('\n── 개발 스텁 ──')
        stub_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'llm_stub.py')
        stub = ''
        if os.path.exists(stub_path):
            with open(stub_path, encoding='utf-8') as f:
                stub = f.read()
        check('llm_stub.py 가 있다', bool(stub), stub_path)
        check('★ 스텁이 폼 채우기 표식을 안다', F.MARK_FILL in stub)
        check('★ 스텁이 액션아이템 표식을 안다', F.MARK_ACTIONS in stub)
        check('★ 스텁이 참여인력 표식을 안다', F.MARK_PEOPLE in stub)
        check('★ 스텁이 KPI 추천 표식을 안다', F.MARK_KPI in stub)

        # 🐞 표식만 맞추면 되는 게 아니다 — **본문 머리말**도 맞아야 한다.
        #    프롬프트의 `[과제 내용]` 을 스텁이 모르면 머리말(`[과제] …`·`[기간] …`)까지
        #    본문으로 읽어서 **그것이 액션아이템 제목으로 올라온다**(2026-08-08 실측).
        for head in ('[과제 내용]', '[원문]'):
            check(f'★ 스텁이 본문 머리말 "{head}" 를 안다', head in stub)
        act_user = F._action_prompt(source='x', project_name='P', year=2026,
                                    start_month=None, end_month=None,
                                    existing=[])[1]['content']
        check('★★ 액션아이템 프롬프트의 머리말을 스텁이 실제로 갖고 있다',
              any(h in act_user and h in stub for h in ('[과제 내용]', '[원문]')),
              act_user[:120])

        # ── 7. 라우트 관문 ────────────────────────────────────────────────
        print('\n── 라우트 관문 ──')
        admin = User.query.filter_by(role=UserRole.ADMIN).first()
        proj = Dt2Project.query.filter_by(is_deleted=False).first()
        if proj is None:
            proj = Dt2Project.query.first()

        with app.test_client() as c:
            for path in ('/api/dt-v2/ai/form/project-fill', '/api/dt-v2/ai/form/action-items',
                         '/api/dt-v2/ai/form/people', '/api/dt-v2/ai/form/kpi-links'):
                r = c.post(path, json={'uuid': 'x', 'text': 'y'})
                check(f'토큰 없으면 401 ({path.rsplit("/", 1)[-1]})',
                      r.status_code in (401, 422), f'실제 {r.status_code}')

            if admin is None or proj is None:
                check('admin 계정과 과제가 있어 관문을 시험할 수 있다', False,
                      f'admin={admin is not None} project={proj is not None}')
            else:
                hdr = {'Authorization': f'Bearer {create_access_token(identity=str(admin.id))}'}

                r = c.post('/api/dt-v2/ai/form/project-fill',
                           json={'uuid': 'no-such-uuid', 'text': 'x'}, headers=hdr)
                check('없는 과제는 404', r.status_code == 404, f'실제 {r.status_code}')

                r = c.post('/api/dt-v2/ai/form/action-items',
                           json={'uuid': proj.uuid, 'text': '  '}, headers=hdr)
                check('원문이 비면 400', r.status_code == 400, f'실제 {r.status_code}')

                # LLM 미설정 → 503. **권한·404 검사보다 뒤**여야 오진이 없다.
                saved = app.config.get('LLM_BASE_URL')
                app.config['LLM_BASE_URL'] = ''
                try:
                    r = c.post('/api/dt-v2/ai/form/project-fill',
                               json={'uuid': proj.uuid, 'text': 'x'}, headers=hdr)
                    check('LLM 미설정이면 503', r.status_code == 503, f'실제 {r.status_code}')
                    r = c.post('/api/dt-v2/ai/form/project-fill',
                               json={'uuid': 'no-such-uuid', 'text': 'x'}, headers=hdr)
                    check('★ 그때도 없는 과제는 404 가 먼저다 (503 로 덮지 않는다)',
                          r.status_code == 404, f'실제 {r.status_code}')
                finally:
                    app.config['LLM_BASE_URL'] = saved

                # ★ 컷오버 쓰기 차단에 걸리지 않는다 — 이 경로는 아무것도 쓰지 않는다.
                #   걸리면 쓰기가 꺼진 환경에서 편집창의 도우미가 통째로 죽는다.
                saved_w = app.config.get('DT2_WRITE_ENABLED')
                app.config['DT2_WRITE_ENABLED'] = False
                try:
                    r = c.post('/api/dt-v2/ai/form/action-items',
                               json={'uuid': proj.uuid, 'text': '  '}, headers=hdr)
                    check('★ 쓰기가 꺼져 있어도 폼 도우미는 막히지 않는다',
                          r.status_code == 400,      # 400 = 라우트까지 닿았다는 뜻
                          f'실제 {r.status_code} — 503 이면 _READ_ONLY_ENDPOINTS 확인')
                finally:
                    app.config['DT2_WRITE_ENABLED'] = saved_w

                # 편집 권한이 없는 사용자는 403. 값을 받아도 어차피 저장이 막히므로
                # 미리 막아 헛수고를 던다.
                plain = User.query.filter(User.role != UserRole.ADMIN,
                                          User.is_active.is_(True)).first()
                if plain is None:
                    check('비관리자 계정이 있어 권한 관문을 시험할 수 있다', False, 'users 에 없음')
                else:
                    blocked = next(
                        (p for p in Dt2Project.query.limit(50).all()
                         if not P.can_edit_project(plain, p)), None)
                    if blocked is None:
                        check(f'{plain.username or plain.id} 가 못 고치는 과제가 있다',
                              False, '전부 편집 가능 — 권한 관문을 못 봤다')
                    else:
                        tok = create_access_token(identity=str(plain.id))
                        r = c.post('/api/dt-v2/ai/form/project-fill',
                                   json={'uuid': blocked.uuid, 'text': 'x'},
                                   headers={'Authorization': f'Bearer {tok}'})
                        check('★ 못 고치는 과제는 403', r.status_code == 403,
                              f'실제 {r.status_code}')

        # ── 8. AI 가 채운 칸이 변경 이력에 남는가 ─────────────────────────
        #
        # 이 저장은 **사람이 누른 것**이라 이력이 `source='ui'` 로 남는다. 그대로 두면
        # 보고서에 실릴 문구까지 AI 가 써 준 뒤에도 "누가 썼나" 에 답할 수 없다.
        # 그래서 채운 칸만 `ai_fill` 로 가른다 — **한 저장 안에서 섞인다**는 것이 요점이다.
        print('\n── 변경 이력의 AI 표식 ──')
        if admin is not None and proj is not None:
            from app.extensions import db
            from app.modules.digital_twin_dashboard.models_v2 import Dt2ProjectChange

            hdr = {'Authorization': f'Bearer {create_access_token(identity=str(admin.id))}'}
            stamp = f'__dt3 표식 시험 {proj.row_version}'
            # **두 칸을 함께 보낸다** — 하나는 AI 가 채운 것, 하나는 사람이 친 것.
            # 섞인 저장을 만들어야 "칸마다 갈리는가" 를 실제로 볼 수 있다.
            with app.test_client() as c:
                r = c.patch(f'/api/dt-v2/projects/{proj.uuid}', headers=hdr, json={
                    'patch': {'과제상세설명': stamp, '과제명': f'{proj.title or "x"} {stamp}'},
                    'ai_assisted': ['과제상세설명', '없는칸'],
                    'reason': 'dt3 표식 시험',
                })
                check('저장이 성공한다', r.status_code == 200, f'실제 {r.status_code}')
                check('모르는 이름이 있어도 저장을 막지 않는다', r.status_code == 200)

            rows = (Dt2ProjectChange.query
                    .filter_by(project_uuid=proj.uuid, row_version=proj.row_version)
                    .all())
            by_field = {row.field: row.source for row in rows}
            check('두 칸이 함께 바뀌었다', len(by_field) == 2, str(by_field))
            check('★ AI 가 채운 칸은 ai_fill 로 남는다',
                  by_field.get('description') == 'ai_fill', str(by_field))
            check('★★ 같은 저장 안에서 사람이 친 칸은 ui 로 남는다',
                  by_field.get('title') == 'ui', str(by_field))

            # 되돌린다 — 시험이 개발 DB 를 더럽히면 다음 사람이 그 값을 진짜로 오해한다.
            # (`row_version` 은 되돌리지 않는다. 증가만 하는 카운터라 번호가 하나 비어도
            #  판정에 쓰이는 성질은 그대로다.)
            try:
                p2 = Dt2Project.query.filter_by(uuid=proj.uuid).first()
                for row in rows:
                    setattr(p2, row.field, row.before_value)
                    db.session.delete(row)
                db.session.commit()
                back = Dt2Project.query.filter_by(uuid=proj.uuid).first()
                check('시험 흔적을 되돌렸다', stamp not in (back.title or ''),
                      str(back.title)[:80])
            except Exception as exc:                              # noqa: BLE001
                db.session.rollback()
                check('시험 흔적을 되돌렸다', False, str(exc)[:120])
        else:
            check('admin·과제가 있어 표식을 시험할 수 있다', False)

        print(f"\n  [정보] 채울 수 있는 칸 {len(specs)}개: {' · '.join(specs)}")

    F.chat = orig_chat
    print()
    if fails:
        print(f'[FAIL] {len(fails)}건: {fails}')
        return 1
    print('[OK] 전부 통과')
    return 0


if __name__ == '__main__':
    sys.exit(main())
