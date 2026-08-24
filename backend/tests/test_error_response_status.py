"""`error_response` 의 상태 코드가 뜻대로 나가는가.

무엇이 있었나
    `error_response(message, errors=None, status_code=400)` 인데 **두 번째 자리에
    상태 코드를 넣은 곳이 67곳** 있었다(2026-08-24 정리).

        error_response('공지사항을 찾을 수 없습니다.', 404)
        -> 400  {"errors": 404, "message": "...", "success": false}

    숫자가 `errors` 로 들어가고 상태는 기본값 400 이 된다.

⚠️ **가장 아픈 것은 예외 22건이 400 으로 나가던 것이다.** 모니터링은 4xx 를
   「사용자가 잘못 보냈다」로 읽는다 — DB 가 죽든 코드가 터지든 400 이라
   5xx 로 안 잡히고, 서버가 아파도 지표가 조용하다.

⚠️ 화면은 안 바뀐다. 걸린 경로들(문서 생성ㆍ공지사항ㆍ게시판 권한ㆍ접속이력)은
   상태 코드로 분기하지 않는다. 바뀌는 것은 **로그ㆍ모니터링이 진실을 보는 것**이다.
"""
import glob
import io
import os
import re

from flask import Flask

from app.shared.responses import error_response

BACKEND = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _split_args(src, i):
    """`(` 다음 위치 i 부터 깊이 0 인 콤마로 인자를 가른다."""
    depth, args, cur, q = 0, [], '', None
    while i < len(src):
        ch = src[i]
        if q:
            if ch == q and src[i - 1] != '\\':
                q = None
            cur += ch
        elif ch in '"\'':
            q = ch
            cur += ch
        elif ch in '([{':
            depth += 1
            cur += ch
        elif ch in ')]}':
            if depth == 0:
                args.append(cur.strip())
                return args
            depth -= 1
            cur += ch
        elif ch == ',' and depth == 0:
            args.append(cur.strip())
            cur = ''
        else:
            cur += ch
        i += 1
    return args


def test_두_번째_인자로_상태_코드를_넘긴_곳이_없다():
    """
    ⚠️ 이 시험이 이 정리의 **자물쇠**다. 없으면 다음 사람이 같은 실수를 하고,
       그때도 화면은 멀쩡해서 아무도 못 알아챈다.

    ⚠️ 인자가 셋인 것(`msg, errors, 422`)은 **제대로 쓴 것**이라 잡지 않는다.
    """
    offenders = []
    for path in glob.glob(os.path.join(BACKEND, 'app', '**', '*.py'), recursive=True):
        src = io.open(path, encoding='utf-8', errors='ignore').read()
        for m in re.finditer(r'\berror_response\(', src):
            args = _split_args(src, m.end())
            if any('status_code' in a for a in args):
                continue
            if len(args) != 2:
                continue
            if not re.fullmatch(r'\d{3}', args[1]):
                continue
            line = src[:m.start()].count('\n') + 1
            rel = os.path.relpath(path, BACKEND).replace(os.sep, '/')
            offenders.append(f'{rel}:{line}  {args[0][:50]}, {args[1]}')

    assert offenders == [], (
        '두 번째 인자는 `errors` 다 — 상태 코드는 `status_code=` 로 넘길 것.\n'
        '그냥 두면 403ㆍ404ㆍ500 이 전부 400 으로 나가고, 숫자가 errors 칸에 실린다.\n'
        + '\n'.join(offenders))


def _app():
    return Flask(__name__)


def test_status_code_로_넘기면_그_코드가_나간다():
    with _app().test_request_context():
        for code in (400, 403, 404, 422, 500):
            body, status = error_response('테스트', status_code=code)
            assert status == code
            assert body.get_json()['success'] is False


def test_두_번째_자리에_숫자를_넣으면_errors_로_들어간다():
    """
    고친 이유를 못으로 박아 둔다. 이 동작이 잘못된 것이 아니라 — **함수는 옳고
    부르는 쪽이 틀렸다.** 서명을 바꿔 두 번째를 상태로 만들면 `errors` 를 제대로
    쓰던 곳(검증 오류 목록)이 조용히 깨진다.
    """
    with _app().test_request_context():
        body, status = error_response('테스트', 404)
        assert status == 400, '두 번째는 errors 다 — 상태가 바뀌면 안 된다'
        assert body.get_json()['errors'] == 404


def test_errors_는_검증_오류_목록에_쓴다():
    with _app().test_request_context():
        body, status = error_response('입력을 확인하세요', ['이름 없음'], 422)
        assert status == 422
        assert body.get_json()['errors'] == ['이름 없음']


def test_없는_공지는_404_로_나간다(client):
    """
    ⚠️ 형태만 바꾸고 값이 틀린 경우를 잡으려면 **실제로 한 번 태워 봐야** 한다.
       고치기 전에는 이 경로가 400 을 냈다.
    """
    r = client.get('/api/auth/notices/999999')
    assert r.status_code == 404, f'{r.status_code} · {r.get_json()}'
    assert 'errors' not in (r.get_json() or {}), 'errors 칸에 숫자가 실리면 안 된다'
