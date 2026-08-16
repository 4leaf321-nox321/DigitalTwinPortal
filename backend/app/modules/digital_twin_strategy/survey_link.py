"""
설문을 진단으로 들여오는 자리. (LINK_PLAN 1·4단계)

    1단계  (사업부 × 조직 축) 별 **제안 레벨**과 그 근거
    4단계  설문이 말하는 **눈에 띄는 사실**을 findings 에 더한다

⚠️ **응답을 여기서 세지 않는다.** 세는 곳은 설문 모듈 하나다
   (`survey.evidence`). 둘이 각자 세면 집계 화면의 숫자와 진단의 숫자가 갈리고,
   그 순간 사무국은 둘 다 안 믿는다.

⚠️ **설문은 근거지 결론이 아니다.** 여기서 나온 제안 레벨은 아무것도 바꾸지
   않는다. 사람이 근거를 보고 「반영」을 눌러야 진단값이 바뀐다(routes 의
   apply_survey_evidence). 조직 레벨은 '개인 차원'·'부서 표준' 같은 **서술로
   정의된 단계**라, 1~5 응답의 평균을 반올림한 것과 뜻이 같지 않다.

⚠️ 설문 모듈을 **없어도 되는 것**으로 다룬다. import 가 실패하면 빈 근거를
   돌려주고 진단은 그대로 돈다 — 설문은 진단의 한 재료일 뿐이다.
"""
from .definitions import CATEGORY_ORGANIZATION, ORGANIZATION_DIMENSIONS

# 'organization:readiness' 의 앞자리. 설문 쪽 links.py 와 같은 약속이다.
_PREFIX = f'{CATEGORY_ORGANIZATION}:'

ORGANIZATION_LABEL = {d['key']: d['label'] for d in ORGANIZATION_DIMENSIONS}

# 미상 사업부를 담는 칸 이름. 숫자 키와 안 섞이게 문자열로 둔다.
UNKNOWN_DIVISION = 'unknown'


def _dimension_of(link_key):
    """연결키에서 조직 축 이름만. 조직 축이 아니면 None."""
    if not link_key or not link_key.startswith(_PREFIX):
        return None
    key = link_key[len(_PREFIX):]
    return key if key in ORGANIZATION_LABEL else None


def suggested_level(average):
    """평균을 레벨로. 반올림이다. **평균을 같이 보여줘야 한다** —
    3.4 와 3.6 이 똑같이 '3' 과 '4' 로 갈리는 것을 숨기면 숫자가 정밀해 보인다."""
    if average is None:
        return None
    return max(1, min(5, int(average + 0.5)))


def collect(plan, divisions, min_sample):
    """이 전략에 매달린 마감 설문들이 말하는 것.

    돌려주는 값:
        {'surveys': [...], 'cells': [...], 'out_of_scope': [...]}

    cells 는 **설문마다 한 줄**이다. 여러 설문의 같은 축을 한 평균으로 뭉치지
    않는다 — 「과제 애로사항 조사」의 준비도와 「조직 역량 진단」의 준비도는 묻는
    맥락이 다르고, 합쳐 놓으면 그게 무엇의 평균인지 아무도 말할 수 없다.
    """
    try:
        from app.modules.survey.evidence import (
            candidate_surveys, dimension_cells, respondents_by_division,
            survey_brief,
        )
    except Exception:
        return {'surveys': [], 'cells': [], 'out_of_scope': []}

    target_ids = {d.id for d in divisions}
    # ⚠️ 이름은 **전체 사업부**에서 찾는다. 진단 대상만 들고 있으면 대상 밖
    #    사업부가 전부 '소속 미확인'으로 뭉쳐서, GTR 이 답한 것과 소속을 모르는
    #    것이 같은 줄로 보인다. 그 둘은 다른 이야기다.
    names = {d.id: d.name for d in divisions}
    try:
        from app.modules.digital_twin_dashboard.models import Division
        for row in Division.query.all():
            names.setdefault(row.id, row.name)
    except Exception:
        pass

    surveys, cells = [], []
    out_of_scope = {}

    for survey in candidate_surveys('strategy_plan', plan.id):
        surveys.append(survey_brief(survey))

        # ⚠️ 대상 밖 인원은 **사람 수로** 센다. 축별 칸을 더하면 한 사람이 다섯
        #    축에 답한 것이 다섯 명으로 보인다.
        for division_id, people in respondents_by_division(survey).items():
            if division_id in target_ids:
                continue
            bucket = out_of_scope.setdefault(
                division_id or UNKNOWN_DIVISION,
                {'division_id': division_id,
                 'division_name': names.get(division_id) or '소속 미확인',
                 'respondent_count': 0})
            bucket['respondent_count'] += people

        for cell in dimension_cells(survey):
            dimension = _dimension_of(cell['link_key'])
            if not dimension:
                continue

            # 진단은 KPI 를 직접 관리하는 사업부만 한다. 나머지는 위에서
            # 사람 수로 이미 세어 뒀다 — 버리지 않는다.
            division_id = cell['division_id']
            if division_id not in target_ids:
                continue

            enough = cell['respondent_count'] >= min_sample
            cells.append({
                'survey_id': survey.id,
                'survey_title': survey.title,
                'division_id': division_id,
                'division_name': names.get(division_id),
                'dimension': dimension,
                'dimension_label': ORGANIZATION_LABEL[dimension],
                'respondent_count': cell['respondent_count'],
                'average': cell['average'],
                # ⚠️ 표본이 모자라면 **제안 자체를 안 한다.** 세 명의 의견이
                #    사업부의 진단이 되어서도 안 되고, 칸의 표본이 한둘로
                #    내려가면 익명이라던 응답이 사실상 지목이 된다.
                'suggested_level': suggested_level(cell['average']) if enough else None,
                'insufficient': not enough,
                'by_role': cell['by_role'],
                'questions': cell['questions'],
            })

    return {
        'surveys': surveys,
        'cells': cells,
        'out_of_scope': sorted(out_of_scope.values(),
                               key=lambda x: -x['respondent_count']),
    }


def attach_current(evidence, assessments):
    """제안값 옆에 **지금 진단값**을 붙인다. 나란히 놔야 사람이 판단한다.

    assessments 는 라우트가 이미 만들어 둔 목록을 그대로 쓴다(중복 조회 방지).
    """
    current = {
        (a['division_id'], a['dimension']): a
        for a in assessments
        if a.get('category') == CATEGORY_ORGANIZATION
    }
    for cell in evidence['cells']:
        found = current.get((cell['division_id'], cell['dimension'])) or {}
        cell['current_level'] = found.get('current_level')
        cell['basis'] = found.get('basis')
    return evidence


# ── 설문이 짚는 것 ─────────────────────────────────────────────────────────
#
# 기존 규칙과 같은 모양으로 돌려준다(findings.py 의 add). 그래야 화면도 저장
# 구조도 안 바꾸고 섞이고, 「핵심 난제로 →」 도 그대로 된다.
#
# ⚠️ **결론이 아니라 눈에 띄는 사실이다.** 왜 그런지는 사람이 답한다.
# ⚠️ **서술형은 여기서 안 짚는다.** "이런 말이 많았다"는 판단이라 규칙이 아니라
#    AI 의 일이다. 못 하는 것을 하는 척하지 않는다.

def _role_totals(cells):
    """축별로 역할 평균을 사업부 너머로 합친다. (역할 → (평균, 인원))

    사업부 한 칸 안에서 역할을 또 쪼개면 표본이 한둘까지 내려간다. 역할 격차는
    전사로 봐야 표본이 선다.
    """
    totals = {}
    for cell in cells:
        for role, stat in (cell['by_role'] or {}).items():
            if stat.get('average') is None:
                continue
            agg = totals.setdefault(cell['dimension'], {}).setdefault(
                role, {'sum': 0.0, 'n': 0})
            agg['sum'] += stat['average'] * stat['count']
            agg['n'] += stat['count']
    return {
        dim: {role: (round(v['sum'] / v['n'], 2), v['n'])
              for role, v in roles.items() if v['n']}
        for dim, roles in totals.items()
    }


def derive_survey_findings(evidence, thresholds, min_sample):
    """설문이 말하는 눈에 띄는 사실."""
    findings = []
    cells = [c for c in evidence['cells'] if not c['insufficient']]
    if not cells:
        return findings

    gap_role = thresholds.get('survey_role_gap', 0.8)
    gap_division = thresholds.get('survey_division_gap', 1.0)
    low_level = thresholds.get('survey_low_level', 2.5)

    # ⚠️ **축 이름을 key 에 넣는다.** 안 넣으면 사업부 격차 세 건이 전부
    #    'survey_division_gap' 하나가 되어, 하나를 난제로 올리는 순간 나머지가
    #    이슈 후보에서 통째로 사라진다. 객관식 쪽에서 실제로 그랬다.
    def add(key, severity, title, detail, division_id=None, evidence_data=None):
        findings.append({
            'key': key, 'severity': severity, 'title': title, 'detail': detail,
            'division_id': division_id, 'division_name': None,
            'evidence': evidence_data or {},
        })

    by_dimension = {}
    for cell in cells:
        by_dimension.setdefault(cell['dimension'], []).append(cell)

    # ── 전사 공통 저점 ────────────────────────────────────────────────
    # 전부 낮으면 **사업부 문제가 아니라 전사 구조 문제**다. 다섯 사업부를
    # 각각 짚으면 똑같은 줄이 다섯 개 뜨고, 그 목록은 읽히지 않는다.
    for dimension, group in by_dimension.items():
        averages = [c['average'] for c in group if c['average'] is not None]
        if len(averages) < 2 or max(averages) > low_level:
            continue
        add(f'survey_universal_low:{dimension}', 'high',
            f'{ORGANIZATION_LABEL[dimension]}{_topic(ORGANIZATION_LABEL[dimension])} '
            f'모든 사업부에서 낮게 나왔습니다 (최고 {max(averages)}점)',
            '한 사업부의 문제가 아니라 전사 구조의 문제입니다. 사업부별로 따로 '
            '개선을 요구해도 같은 자리로 돌아옵니다.',
            None, {'dimension': dimension, 'averages': averages})

    # ── 사업부 간 격차 ────────────────────────────────────────────────
    # 잘하는 곳이 있다는 것은 **못 하는 것이 아니라 안 옮겨진 것**이다.
    for dimension, group in by_dimension.items():
        scored = [c for c in group if c['average'] is not None]
        if len(scored) < 2:
            continue
        top = max(scored, key=lambda c: c['average'])
        bottom = min(scored, key=lambda c: c['average'])
        spread = round(top['average'] - bottom['average'], 2)
        if spread < gap_division:
            continue
        add(f'survey_division_gap:{dimension}', 'medium',
            f"{ORGANIZATION_LABEL[dimension]} 편차가 사업부 간 {spread}점입니다 "
            f"({top['division_name']} {top['average']} ↔ "
            f"{bottom['division_name']} {bottom['average']})",
            f"{top['division_name']}에서는 이미 되고 있습니다. 방법이 없는 것이 "
            '아니라 옮겨지지 않은 것이라면, 새로 만들 것이 아니라 옮길 것을 '
            '찾아야 합니다.',
            None, {'dimension': dimension, 'spread': spread,
                   'top': top['division_name'], 'bottom': bottom['division_name']})

    # ── 역할 간 인식 격차 ─────────────────────────────────────────────
    # 같은 것을 보고 다르게 말한다는 것은 **정보가 위아래로 안 흐른다**는 뜻이다.
    for dimension, roles in _role_totals(cells).items():
        usable = {r: v for r, v in roles.items()
                  if r != '미지정' and v[1] >= min_sample}
        if len(usable) < 2:
            continue
        high_role = max(usable, key=lambda r: usable[r][0])
        low_role = min(usable, key=lambda r: usable[r][0])
        spread = round(usable[high_role][0] - usable[low_role][0], 2)
        if spread < gap_role:
            continue
        add(f'survey_role_gap:{dimension}', 'high',
            f'{ORGANIZATION_LABEL[dimension]}{_object(ORGANIZATION_LABEL[dimension])} '
            f'{high_role}{_with(high_role)} {low_role}{_subject(low_role)} '
            f'다르게 봅니다 ({spread}점 차이)',
            f'{high_role} {usable[high_role][0]}점, {low_role} {usable[low_role][0]}점. '
            '같은 것을 보고 다르게 말한다면 정보가 한쪽에만 있거나, 한쪽이 '
            '보지 못하는 자리에 있습니다. 어느 쪽이 맞는지보다 왜 갈리는지가 '
            '먼저입니다.',
            None, {'dimension': dimension, 'spread': spread,
                   'roles': {r: v[0] for r, v in usable.items()}})

    return findings


def _axis_note(link_key):
    """이 문항이 가리키는 축을 문장 끝에 달 말. 없으면 빈 문자열.

    ⚠️ 점수 없는 객관식은 레벨을 못 만들지만, 연결키를 달아 둘 수는 있다.
       그런데 그것이 어디에도 안 쓰이면 **연결한 사람은 연결했다고 믿는데
       실제로는 아무 데도 안 붙는다.** 최소한 어느 축의 이야기인지는 말해 준다.
    """
    dimension = _dimension_of(link_key)
    return f" ({ORGANIZATION_LABEL[dimension]} 관련)" if dimension else ''


def derive_choice_findings(plan, thresholds, min_sample, divisions=None):
    """객관식이 말하는 것. 레벨은 못 만들지만 **사람들이 직접 지목한 것**이다.

    두 가지를 본다.

        몰림   한 보기로 쏠렸다            — 다음에 무엇을 할지 알려준다
        갈림   누가 답했느냐에 따라 다르다  — 같은 것을 보고 다른 것을 지목했다

    '준비도 2.8' 보다 '62% 가 데이터 정합성을 꼽았다' 가 구체적이고,
    'PL 은 인력 부족, 참여인력은 데이터 정합성' 은 그보다 더 또렷하다.
    """
    try:
        from app.modules.survey.evidence import (
            choice_highlights, choice_splits, closed_surveys,
        )
    except Exception:
        return []

    share = thresholds.get('survey_choice_share', 50.0)
    lead = thresholds.get('survey_choice_lead', 15.0)
    # ⚠️ 사업부 갈림은 **진단 대상 사업부끼리만** 견준다. 안 그러면 척도 규칙은
    #    대상만 보고 객관식 규칙은 전사를 봐서, 같은 화면의 두 발견이 서로 다른
    #    모집단을 말한다. 대상 밖 응답은 「따로 센다」고 해놓고 여기로 새는 셈이다.
    target_ids = {d.id for d in (divisions or [])}
    findings = []

    # ⚠️ **레벨을 못 만드는 설문도 짚을 것이 있다.** 객관식만 있는 설문에서
    #    8명이 100% 로 한 보기를 꼽아도, 좁은 후보로 거르면 아무것도 안 나타났다.
    for survey in closed_surveys('strategy_plan', plan.id):
        # ── 몰림 ──────────────────────────────────────────────────────
        for item in choice_highlights(survey):
            if item['answer_count'] < min_sample or item['top_share'] < share:
                continue
            # ⚠️ 1위만 보고 짚지 않는다. 35% 대 33% 를 "압도적 1위" 로 읽게
            #    두면, 그 오해가 그대로 보고서에 실린다.
            if item['top_share'] - item['second_share'] < lead:
                continue
            findings.append({
                # ⚠️ key 에 **문항 번호를 넣는다.** 예전에는 객관식 발견이 전부
                #    'survey_choice_top' 하나를 썼는데, 이슈 후보 중복 제거가
                #    key 로 돌아서 하나를 난제로 올리면 나머지 객관식 발견이
                #    통째로 사라졌다.
                'key': f"survey_choice_top:{item['question_id']}",
                # 심각도는 medium 이다. 쏠림은 **사실이지 결함이 아니다** —
                # 무엇이 문제인지는 사람이 읽고 판단한다.
                'severity': 'medium',
                # 보기 이름이 데이터에서 오므로 조사를 붙여 준다. '정합성를'
                # 같은 것이 화면에 보이면 그 줄 전체가 대충 만든 것으로 읽힌다.
                'title': (f"「{item['text']}」에 응답의 {item['top_share']}% 가 "
                          f"'{item['top_value']}'{_object(item['top_value'])} "
                          '꼽았습니다'),
                'detail': (f"{item['answer_count']}명 중 {item['top_count']}명입니다"
                           f"(2위 {item['second_share']}%). 사람들이 직접 지목한 "
                           '것이라, 놔두면 그대로 남습니다.'
                           + _axis_note(item['link_key'])),
                'division_id': None, 'division_name': None,
                'evidence': {'survey_id': survey.id,
                             'question_id': item['question_id'],
                             'share': item['top_share'],
                             'second_share': item['second_share']},
            })

        # ── 갈림 ──────────────────────────────────────────────────────
        for item in choice_splits(survey):
            divisions_in_scope = {k: v for k, v in item['by_division'].items()
                                  if not target_ids or k in target_ids}
            for axis, groups, label in (
                ('role', item['by_role'], '역할'),
                ('div', divisions_in_scope, '사업부'),
            ):
                usable = {k: v for k, v in groups.items()
                          if v['total'] >= min_sample}
                picks = {v['value'] for v in usable.values()}
                # 갈리지 않으면(모두 같은 것을 꼽으면) 발견이 아니다.
                if len(usable) < 2 or len(picks) < 2:
                    continue
                names = _group_names(axis, usable)
                said = ', '.join(
                    f"{names[k]}{_topic(names[k])} '{v['value']}'({v['share']}%)"
                    for k, v in sorted(usable.items(), key=lambda kv: str(kv[0]))
                )
                findings.append({
                    'key': f"survey_choice_{axis}:{item['question_id']}",
                    # 갈림은 몰림보다 세다. 같은 것을 보고 다른 것을 지목했다는
                    # 뜻이라, 무엇이 문제인지에 대한 합의가 없다는 말이다.
                    'severity': 'high',
                    # 문항이 물음표로 끝나는 일이 많아 「…」 뒤에 조사를 붙이면
                    # '을(를)' 같은 괄호가 제목에 남는다. 줄표로 끊는다.
                    'title': f"「{item['text']}」 — {label}마다 고른 것이 다릅니다",
                    'detail': (f'{said}. 같은 것을 보고 다른 것을 지목했다면 '
                               '무엇이 문제인지에 대한 합의가 아직 없는 것입니다. '
                               '어느 쪽이 맞는지보다 왜 갈리는지가 먼저입니다.'
                               + _axis_note(item['link_key'])),
                    'division_id': None, 'division_name': None,
                    'evidence': {'survey_id': survey.id,
                                 'question_id': item['question_id'],
                                 'axis': axis,
                                 'picks': {str(k): v['value']
                                           for k, v in usable.items()}},
                })
    return findings


def _group_names(axis, groups):
    """갈림 규칙이 쓸 이름표. 역할은 그 자체가 이름, 사업부는 번호라 이름을 찾는다."""
    if axis == 'role':
        return {k: str(k) for k in groups}
    names = {}
    try:
        from app.modules.digital_twin_dashboard.models import Division
        for row in Division.query.filter(Division.id.in_(list(groups) or [0])).all():
            names[row.id] = row.name
    except Exception:
        pass
    return {k: names.get(k, f'#{k}') for k in groups}


def _topic(word):
    """받침에 따라 은/는. 축 이름이 정의에서 오므로 문장에 그대로 못 끼운다."""
    if not word:
        return '는'
    code = ord(word[-1])
    if 0xAC00 <= code <= 0xD7A3:
        return '은' if (code - 0xAC00) % 28 else '는'
    return '은(는)'


def _subject(word):
    """받침에 따라 이/가. 역할 이름이 설정에서 오므로 필요하다."""
    if not word:
        return '가'
    code = ord(word[-1])
    if 0xAC00 <= code <= 0xD7A3:
        return '이' if (code - 0xAC00) % 28 else '가'
    # 영문으로 끝나면 마지막 소리로 가른다. 'PL이(가)' 같은 괄호가 제목에
    # 들어가면 그 줄 전체가 대충 만든 것으로 읽힌다.
    return '가' if word[-1].lower() in 'aeiou' else '이'


def _with(word):
    """받침에 따라 과/와."""
    if not word:
        return '와'
    code = ord(word[-1])
    if 0xAC00 <= code <= 0xD7A3:
        return '과' if (code - 0xAC00) % 28 else '와'
    # 영문으로 끝나면 마지막 소리로 가른다. 'PL과(와)' 같은 괄호가 제목에
    # 들어가면 그 줄 전체가 대충 만든 것으로 읽힌다.
    return '와' if word[-1].lower() in 'aeiou' else '과'


def _object(word):
    """받침에 따라 을/를."""
    if not word:
        return '를'
    code = ord(word[-1])
    if 0xAC00 <= code <= 0xD7A3:
        return '을' if (code - 0xAC00) % 28 else '를'
    # 영문으로 끝나면 마지막 소리로 가른다. 'PL을(를)' 같은 괄호가 제목에
    # 들어가면 그 줄 전체가 대충 만든 것으로 읽힌다.
    return '를' if word[-1].lower() in 'aeiou' else '을'
