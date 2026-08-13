"""
AI 에이전트 **과업 평가 러너** — 골든셋으로 점수를 낸다. (2026-08-08)

무엇을 위한 것인가
    "복잡한 업무를 못 한다" 를 고치려면 **나아졌는지 재야** 한다. 안 그러면
    프롬프트와 도구를 감으로 만지게 되고, 고친 것이 실제로 도움이 됐는지 알 수 없다.
    (참고 구현: ReportArchive `backend/eval` — "감 튜닝 종식")

★ 정답 숫자를 골든셋 파일에 박지 않는다
    배포마다 데이터가 다르다. 대신 `truth` 에 **정답 구하는 법**을 적고, 러너가
    그 도구를 실제로 불러 정답을 만든다. 그래서 개발서버든 운영이든 그대로 돈다.

두 가지 모드
    --scripted   **LLM 없이.** 각본(`script`)대로 도구를 재생해 루프·도구·집계가
                 맞는지 본다. 모델이 그 순서를 고를지는 못 재지만, 그 아래는 전부
                 진짜다. 개발서버의 회귀 시험이 이것이다.
    (기본)       실제 LLM. **운영에서만** 의미가 있다. 모델이 도구를 제대로 고르는지,
                 답에 정답 값이 들어가는지를 잰다.

지표
    성공률        답변에 정답 값이 들어갔나
    도구 정확도   expect_tools 를 다 불렀나 / avoid_tools 를 안 불렀나
    평균 홉·호출  몇 번 왕복했나 (적을수록 좋다)
    잘림          목록이 truncated 인데 집계로 안 갈아탔나 ← 조용히 틀리는 경로

`truth.path` 문법
    total                전체
    groups[0].count      첫 묶음의 수
    groups[MX].count     key 가 'MX' 인 묶음의 수
    statuses[0]          배열의 첫 값

사용법
    python scripts\\dt3_eval_agent.py --scripted            # 개발서버 (LLM 없이)
    python scripts\\dt3_eval_agent.py                       # 운영 (실제 모델)
    python scripts\\dt3_eval_agent.py --json before.json    # 튜닝 전 저장
    python scripts\\dt3_eval_agent.py --tasks eval\\my.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app                                          # noqa: E402
from app.modules.auth.models import User, UserRole                  # noqa: E402
from app.modules.digital_twin_dashboard.ai import agent as A        # noqa: E402
from app.modules.digital_twin_dashboard.ai import agent_tools as T   # noqa: E402
from app.modules.digital_twin_dashboard.ai import llm as L          # noqa: E402
from flask_jwt_extended import create_access_token                  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ─────────────────────────────────────────────────────────────────────────────
# 정답 꺼내기
# ─────────────────────────────────────────────────────────────────────────────
def resolve(data, path: str):
    """`groups[MX].count` 같은 경로로 값을 꺼낸다. 못 꺼내면 None."""
    cur = data
    for part in path.split('.'):
        m = re.match(r'^(\w+)\[([^\]]+)\]$', part)
        if m:
            key, idx = m.group(1), m.group(2)
            cur = (cur or {}).get(key)
            if not isinstance(cur, list):
                return None
            if idx.lstrip('-').isdigit():
                i = int(idx)
                cur = cur[i] if -len(cur) <= i < len(cur) else None
            else:
                # key 로 찾기 — 묶음은 {key, count} 모양이다
                cur = next((x for x in cur
                            if isinstance(x, dict) and str(x.get('key')) == idx), None)
        else:
            if not isinstance(cur, dict):
                return None
            cur = cur.get(part)
        if cur is None:
            return None
    return cur


def truth_of(auth, spec):
    """골든셋의 `truth` → 실제 값. **도구를 진짜로 불러서** 만든다."""
    if not spec:
        return None, '정답 규격 없음'
    out = T.run_tool(auth, spec['tool'], spec.get('args') or {})
    if out.get('status') == 'error':
        return None, f"정답 도구 실패: {out.get('message')}"
    v = resolve(out, spec.get('path') or 'total')
    return v, (None if v is not None else f"경로 {spec.get('path')!r} 를 못 찾음")


def mentions(answer: str, value) -> bool:
    """답변이 그 값을 말하고 있나. 숫자는 자릿수 구분(1,234)도 인정한다."""
    a = answer or ''
    if isinstance(value, bool) or value is None:
        return False
    if isinstance(value, (int, float)):
        n = int(value)
        return bool(re.search(rf'(?<!\d){n:,}(?!\d)|(?<!\d){n}(?!\d)', a))
    return str(value) in a


# ─────────────────────────────────────────────────────────────────────────────
# 각본 모드 — LLM 없이
# ─────────────────────────────────────────────────────────────────────────────
def _last_tool_result(messages):
    """되먹여진 마지막 `role: tool` 메시지의 내용(dict). 없으면 {}."""
    for m in reversed(messages or []):
        if m.get('role') == 'tool':
            try:
                return json.loads(m.get('content') or '{}')
            except (TypeError, ValueError):
                return {}
    return {}


def _fill(args, prev):
    """
    각본 인자의 `$prev.…` 를 **앞 도구 결과**에서 채운다.

    ★ 이게 있어야 다단계를 잴 수 있다. "찾아서 → 그 uuid 로 상세" 처럼 앞 결과를
      다음 인자로 옮기는 것이 곧 '복잡한 업무' 의 본질인데, 각본이 값을 미리 못
      적으니(uuid 는 배포마다 다르다) 실행 중에 꺼내 써야 한다.
        {"uuid": "$prev.items[0].uuid"}
    """
    out = {}
    for k, v in (args or {}).items():
        if isinstance(v, str) and v.startswith('$prev.'):
            out[k] = resolve(prev, v[len('$prev.'):])
        else:
            out[k] = v
    return out


def scripted_chat(script, final_text):
    """각본대로 tool_calls 를 뱉고 마지막에 답한다. `agent.chat` 자리에 끼운다.

    한 홉에 하나씩 낸다 — 실제 모델도 보통 그렇게 하고, 그래야 `$prev` 로
    앞 결과를 받아 쓸 수 있다."""
    state = {'i': 0}

    def fake(messages, **kw):
        i = state['i']
        state['i'] += 1
        if i >= len(script):
            return L.ChatResult(content=final_text, model='scripted')
        step = script[i]
        return L.ChatResult(content='', model='scripted', tool_calls=[{
            'id': f't{i}',
            'name': step['tool'],
            'arguments': _fill(step.get('args'), _last_tool_result(messages)),
        }])
    return fake


# ─────────────────────────────────────────────────────────────────────────────
def run_task(auth, task, scripted: bool):
    got, err = truth_of(auth, task.get('truth'))
    row = {'id': task['id'], 'query': task['query'], 'truth': got, 'truthError': err}

    if scripted:
        # 각본 모드에서는 **정답을 그대로 답에 넣어 준다.** 여기서 재는 것은
        # "모델이 제대로 말하는가" 가 아니라 "도구·루프·집계가 맞는가" 다.
        final = f'결과는 {got} 입니다.' if got is not None else '결과를 찾지 못했습니다.'
        orig = A.chat
        A.chat = scripted_chat(task.get('script') or [], final)
        try:
            out = A.run_agent(auth, task['query'])
        finally:
            A.chat = orig
    else:
        out = A.run_agent(auth, task['query'])

    used = [t['tool'] for t in (out.get('trace') or [])]
    need = set(task.get('expect_tools') or [])
    avoid = set(task.get('avoid_tools') or [])
    row.update({
        'answer': (out.get('answer') or '')[:400],
        'tools': used,
        'hops': out.get('hops'),
        'toolCalls': out.get('toolCalls'),
        'truncatedTools': bool(out.get('truncated')),
        'missingTools': sorted(need - set(used)),
        'usedAvoided': sorted(avoid & set(used)),
    })
    want_value = task.get('answer_must_contain_truth', True)
    row['answerHasTruth'] = mentions(out.get('answer') or '', got) if want_value else None
    row['pass'] = (
        not row['missingTools']
        and not row['usedAvoided']
        and (row['answerHasTruth'] is not False)
        and got is not None
    )
    return row


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tasks', default=os.path.join(ROOT, 'eval', 'agent_tasks.json'))
    ap.add_argument('--scripted', action='store_true',
                    help='LLM 없이 각본 재생 (개발서버)')
    ap.add_argument('--user', type=int, help='이 사용자 권한으로 (기본: admin 아무나)')
    ap.add_argument('--json', help='결과를 이 파일로 저장 (전/후 비교용)')
    ap.add_argument('--only', help='이 id 만 (쉼표로 여러 개)')
    args = ap.parse_args()

    path = args.tasks
    if not os.path.exists(path):
        ex = path.replace('agent_tasks.json', 'agent_tasks.example.json')
        if os.path.exists(ex):
            print(f'{path} 이(가) 없습니다. 예시를 복사해 쓰세요:\n'
                  f'  copy "{ex}" "{path}"\n'
                  f'이번에는 예시로 돌립니다.\n')
            path = ex
        else:
            print(f'골든셋을 찾을 수 없습니다: {path}')
            return 1

    tasks = json.load(open(path, encoding='utf-8'))['tasks']
    if args.only:
        keep = {x.strip() for x in args.only.split(',')}
        tasks = [t for t in tasks if t['id'] in keep]

    app = create_app()
    with app.app_context():
        u = (User.query.get(args.user) if args.user
             else User.query.filter_by(role=UserRole.ADMIN).first())
        if u is None:
            print('평가에 쓸 사용자를 찾지 못했습니다.')
            return 1
        auth = f'Bearer {create_access_token(identity=str(u.id))}'

        mode = '각본(LLM 없이)' if args.scripted else f'실제 모델'
        print(f'\n골든셋 {len(tasks)}과업 · {mode} · 사용자 {u.email}\n' + '=' * 72)

        rows = []
        for t in tasks:
            try:
                r = run_task(auth, t, args.scripted)
            except Exception as exc:                              # noqa: BLE001
                r = {'id': t['id'], 'query': t['query'], 'pass': False,
                     'error': f'{type(exc).__name__}: {exc}'}
            rows.append(r)
            mark = '[OK]  ' if r.get('pass') else '[FAIL]'
            print(f"{mark} {r['id']:26s} 홉{r.get('hops', '-')} "
                  f"도구{r.get('toolCalls', '-')} 정답={r.get('truth')}")
            if not r.get('pass'):
                for k, msg in (('error', ''), ('truthError', ''),
                               ('missingTools', '안 부른 도구'),
                               ('usedAvoided', '부르면 안 되는 도구')):
                    if r.get(k):
                        print(f"          {msg or ''} {r[k]}")
                if r.get('answerHasTruth') is False:
                    print(f"          답에 정답값({r.get('truth')})이 없음: "
                          f"{(r.get('answer') or '')[:80]}")

        ok = sum(1 for r in rows if r.get('pass'))
        hops = [r['hops'] for r in rows if r.get('hops')]
        calls = [r['toolCalls'] for r in rows if r.get('toolCalls')]
        cut = sum(1 for r in rows if r.get('truncatedTools'))
        print('=' * 72)
        print(f'성공 {ok}/{len(rows)} ({ok / max(len(rows), 1) * 100:.0f}%) · '
              f'평균 홉 {sum(hops) / max(len(hops), 1):.1f} · '
              f'평균 도구 {sum(calls) / max(len(calls), 1):.1f} · '
              f'도구예산 초과 {cut}건')
        if args.scripted:
            print('\n※ 각본 모드는 **도구·루프·집계**를 잰다. '
                  '모델이 그 순서를 고르는지는 운영에서 --scripted 없이 재야 한다.')

        if args.json:
            with open(args.json, 'w', encoding='utf-8') as f:
                json.dump({'mode': mode, 'rows': rows,
                           'summary': {'pass': ok, 'total': len(rows)}},
                          f, ensure_ascii=False, indent=2)
            print(f'저장: {args.json}')
    return 0 if ok == len(rows) else 1


if __name__ == '__main__':
    sys.exit(main())
