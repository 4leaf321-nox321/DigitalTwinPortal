"""표 한 덩어리를 설문 문항으로 옮긴다.

── 왜 이 파일이 따로 있나 ─────────────────────────────────────────────────
**운영 서버에서는 코드를 못 고친다.** 그런데 설문은 매번 문항이 다르다. 그래서
운영에서 엑셀 표를 붙여넣으면 설문이 통째로 만들어져야 한다. 문항을 화면에서
하나씩 만드는 것은 이미 되지만, 수십 문항을 그렇게 만들 수는 없다.

파싱을 라우트에서 떼어 놓은 이유는 두 가지다.

  · 미리보기(`/import/preview`)와 생성(`/import`)이 **같은 함수**를 부른다.
    파서가 둘로 갈리면 "미리보기는 통과했는데 생성은 실패"가 반드시 생기고,
    그때 사용자는 자기 표의 어디가 틀렸는지 알 수 없다.
  · 규칙이 많고 오류 메시지가 중요하다. 순수 함수라야 DB 없이 시험할 수 있다.

⚠️ 이 모듈은 **아무것도 저장하지 않는다.** db 를 import 하지 않는 것이 그
   약속의 표시다. 저장은 라우트가 한다.

── 표 형식 (열 순서 고정, 첫 행은 머리글) ─────────────────────────────────

    섹션 | 역할 | 프로세스 | 문항 | 유형 | 보기 | 필수 | 도움말 | 연결키

  섹션        비우면 직전 행의 섹션을 잇는다(엑셀 병합처럼 쓰라고)
  역할/프로세스  쉼표로 여럿. **비우면 전원**
  유형        척도 | 객관식 | 복수선택 | 순위 | 서술 (영문도 받는다)
  보기        `|` 로 구분. 객관식·복수선택·순위에 필요. 척도·서술은 비운다
  필수        예/아니오, Y/N, true/false, 1/0. 비우면 필수
  도움말·연결키  선택
"""
import csv
import io

# ── 열 ────────────────────────────────────────────────────────────────────
#
# 열 이름이 아니라 **순서**로 읽는다. 머리글 문구는 사람마다 다르게 쓰는데,
# 그걸 맞추려 들면 "부서"와 "소속"이 다른 열이 되는 식으로 조용히 어긋난다.
COLUMNS = ('섹션', '역할', '프로세스', '문항', '유형', '보기', '필수', '도움말', '연결키')
COLUMN_COUNT = len(COLUMNS)

(COL_SECTION, COL_ROLES, COL_PROCESSES, COL_TEXT, COL_QTYPE,
 COL_CHOICES, COL_REQUIRED, COL_HELP, COL_LINK) = range(COLUMN_COUNT)

# ── 유형 ──────────────────────────────────────────────────────────────────
#
# ⚠️ **아는 말만 받는다.** '척도형' 같은 비슷한 말을 눈치껏 받아주면, 정말로
#    열을 잘못 쓴 표까지 통과해 버린다. 못 알아들으면 조용한 기본값 대신
#    오류를 내는 편이 낫다 — 조용한 기본값은 나중에 왜 이렇게 됐는지 못 찾는다.
QTYPE_ALIASES = {
    '척도': 'scale', 'scale': 'scale',
    '객관식': 'choice', '단일선택': 'choice', 'choice': 'choice', 'single': 'choice',
    '복수선택': 'multi', '다중선택': 'multi', 'multi': 'multi', 'multiple': 'multi',
    '순위': 'rank', 'rank': 'rank',
    '서술': 'text', '주관식': 'text', 'text': 'text',
}
# 보기가 있어야만 답할 수 있는 유형. 보기 없이 저장되면 응답 화면에서
# 막다른 길이 된다 — 고를 것이 없는 객관식 앞에서 사람은 제출을 못 한다.
CHOICE_QTYPES = {'choice', 'multi', 'rank'}
# 반대로 여기에 보기가 붙어 있으면 사람이 열을 밀려 쓴 것이다.
NO_CHOICE_QTYPES = {'scale', 'text'}

TRUE_WORDS = {'예', '네', 'y', 'yes', 'true', 't', '1', 'o', '필수', '필수임'}
FALSE_WORDS = {'아니오', '아니요', 'n', 'no', 'false', 'f', '0', 'x', '선택', '선택사항'}

# 척도 문항의 기본 눈금. 응답 화면(QuestionField.jsx)이 min/max 를 읽는다.
SCALE_DEFAULT = {'min': 1, 'max': 5}

# DB 컬럼 길이. **여기서 막지 않으면 commit 때 터진다.** 그러면 사용자는
# 몇 행이 문제인지 모르는 500 을 보게 된다.
MAX_SECTION = 100
MAX_TEXT = 500
MAX_LINK_KEY = 80
MAX_AXIS_VALUE = 50     # respondent_role / respondent_process 가 String(50)


def _cells(row, tab_mode):
    """행을 9칸으로 맞춘다. 돌려주는 값은 (칸 9개, 넘친 것).

    ⚠️ **뒤쪽 빈칸을 먼저 버리면 열이 밀려도 오류가 안 난다.**

    CSV 에서 도움말에 따옴표 없는 쉼표가 있고 연결키가 비어 있으면 칸이 10개가
    되는데, 마지막이 빈 칸이라 그걸 버리면 9개로 딱 맞아떨어진다. 그러면
    도움말의 뒷토막이 연결키 자리에 조용히 들어앉는다 — 오류 0건으로 통과한다.
    이건 잘못된 데이터가 **아무 신호 없이** 저장되는 경우라 제일 나쁘다.

    그래서 둘을 가른다:

      탭 구분(엑셀 복사)  뒤에 빈 탭이 붙어 오는 것이 흔하다. 빈 칸만 버린다.
      쉼표 구분(CSV)      칸이 9개를 넘으면 **무조건 오류**. 잘 만든 CSV 가
                          9개를 넘을 이유가 없고, 따옴표로 감싸면 해결된다.
                          여기서 관대하면 위의 조용한 밀림을 못 잡는다.
    """
    cells = [(c or '').strip() for c in row]
    if tab_mode:
        while len(cells) > COLUMN_COUNT and cells[-1] == '':
            cells.pop()
    overflow = cells[COLUMN_COUNT:]
    cells = cells[:COLUMN_COUNT]
    while len(cells) < COLUMN_COUNT:
        cells.append('')
    return cells, overflow


def _split_axis(value):
    """역할·프로세스 칸을 쉼표로 나눈다. 빈 칸은 빈 목록 = 전원."""
    if not value:
        return []
    seen, out = set(), []
    for part in value.split(','):
        part = part.strip()
        if part and part not in seen:
            seen.add(part)
            out.append(part)
    return out


def _split_choices(value):
    """보기 칸을 `|` 로 나눈다.

    쉼표가 아니라 `|` 인 이유는 **보기 안에 쉼표가 들어가는 일이 실제로 많기
    때문이다**("설계, 해석 도구" 같은 것). 쉼표로 나누면 그런 보기가 둘로 쪼개진다.
    """
    if not value:
        return []
    return [p.strip() for p in value.split('|') if p.strip()]


def parse_required(value):
    """필수 칸. 비우면 필수, 못 알아들으면 None(= 호출부가 오류로 본다)."""
    token = (value or '').strip().lower()
    if not token:
        return True
    if token in TRUE_WORDS:
        return True
    if token in FALSE_WORDS:
        return False
    return None


def parse_qtype(value):
    """유형 칸. 못 알아들으면 None."""
    token = (value or '').strip().lower().replace(' ', '')
    return QTYPE_ALIASES.get(token)


class TableFormatError(ValueError):
    """표 자체를 못 읽는 경우.

    행 단위 오류(그 줄만 고치면 되는 것)와 다르다. 이건 표 구조가 깨져서
    **어느 행이 어느 행인지도 알 수 없는** 상태다. 그래서 행 목록이 아니라
    통째로 실패로 알린다.
    """


def _read_rows(text):
    """붙여넣은 덩어리를 (행번호, 칸목록) 으로 쪼갠다.

    탭이 한 개라도 있으면 탭 구분으로 본다(엑셀 복사). 없으면 쉼표(CSV).
    csv 모듈을 쓰므로 따옴표로 감싼 칸 안의 구분자는 구분자가 아니다 — 직접
    split 하면 그 규칙을 다시 구현해야 하고, 반드시 틀린다.
    """
    delimiter = '\t' if '\t' in text else ','
    reader = csv.reader(io.StringIO(text), delimiter=delimiter)
    out = []
    # ⚠️ reader.line_num 을 쓰면 안 된다.
    #
    # 그건 **읽은 물리 줄 수**라, 칸 안에 줄바꿈이 든 레코드를 만나면 그 뒤의
    # 모든 행 번호가 밀린다. 엑셀에서 여러 줄짜리 셀을 복사하면 실제로 그런
    # 표가 나온다. 사람이 보는 줄 번호와 어긋나면 "4행을 고치세요"가 엉뚱한
    # 줄을 가리키고, 그건 오류 메시지가 없느니만 못하다.
    #
    # 그래서 **레코드를 센다.** 빈 줄도 세어 둬야 사람이 엑셀에서 보는 행과
    # 맞는다 — 빈 줄을 안 세면 그 아래가 통째로 한 칸씩 당겨진다.
    record = 0
    try:
        for row in reader:
            record += 1
            if not any((c or '').strip() for c in row):
                continue                   # 빈 줄은 없는 셈 친다(번호는 셌다)
            out.append((record, row))
    except csv.Error as e:
        # csv 가 죽는 경우(널 바이트 등). 그대로 두면 라우트까지 올라가
        # **메시지 없는 500** 이 된다.
        raise TableFormatError(
            f'표를 읽다 멈췄습니다({record + 1}행 부근): {e}'
        ) from e

    return out


def _check_quotes(text):
    """따옴표 짝이 맞는지. 안 맞으면 TableFormatError.

    ⚠️ 안 닫힌 따옴표를 csv 는 **오류로 보지 않는다.** 남은 줄을 통째로 한 칸에
       삼키고 조용히 끝낸다. 그래서 30행짜리 표가 1행이 되는데, 그때 나오는
       오류는 "문항을 하나도 읽지 못했습니다" 같은 엉뚱한 말이라 원인을 못 짚는다.

    삼켜진 양으로 짐작하려 했더니 칸 안에 줄바꿈이 든 정상 표(엑셀의 여러 줄
    셀)와 구분이 안 됐다. 대신 **개수를 센다** — CSV 는 칸 안의 따옴표를 두 개로
    겹쳐 쓰므로 제대로 된 표의 따옴표 수는 **언제나 짝수**다. 홀수면 하나가
    안 닫힌 것이다.
    """
    count = text.count('"')
    if count % 2 == 1:
        raise TableFormatError(
            f'따옴표(")가 {count}개로 짝이 안 맞습니다. 하나가 안 닫히면 '
            '그 뒤가 통째로 한 칸으로 읽혀 표가 거의 사라집니다. '
            '칸 안에 따옴표를 쓰시려면 두 번("") 적으세요.'
        )


def parse_table(text):
    """표를 문항 목록으로. **저장하지 않는다.**

    돌려주는 모양:
        {rows: [...], roles: [...], processes: [...],
         header: [...] | None, error_count, ok_count}

    각 행은 오류가 있어도 목록에 남는다. 오류난 행을 빼고 돌려주면 미리보기
    화면에서 "왜 이 줄이 사라졌지"가 되고, 사용자가 고칠 곳을 못 찾는다.
    """
    _check_quotes(text or '')
    raw_rows = _read_rows(text or '')
    # 구분자 판단은 _read_rows 와 **같은 규칙**이어야 한다. 어긋나면 탭 표를
    # 쉼표로 보고 뒤쪽 빈칸을 안 버려서, 멀쩡한 엑셀 붙여넣기가 전부 거부된다.
    tab_mode = '	' in (text or '')

    header = None
    if raw_rows:
        # 첫 행은 머리글이라 건너뛴다. 다만 **무엇을 건너뛰었는지 돌려준다** —
        # 머리글 없이 붙여넣으면 첫 문항이 조용히 사라지는데, 화면에 보여
        # 주면 사용자가 바로 알아챈다.
        header = [(c or '').strip() for c in raw_rows[0][1]]
        raw_rows = raw_rows[1:]

    rows = []
    roles_seen, processes_seen = [], []
    last_section = ''

    for line, raw in raw_rows:
        cells, overflow = _cells(raw, tab_mode)
        errors = []

        # ── 섹션: 비면 직전 행을 잇는다 ───────────────────────────────────
        section = cells[COL_SECTION]
        if section:
            last_section = section
        else:
            section = last_section
        if len(section) > MAX_SECTION:
            errors.append(f'{line}행: 섹션이 너무 깁니다({MAX_SECTION}자까지).')
            section = section[:MAX_SECTION]

        if overflow:
            extra = next((x for x in overflow if x), '')
            errors.append(
                f'{line}행: 칸이 {COLUMN_COUNT + len(overflow)}개입니다({COLUMN_COUNT}개여야 합니다). '
                + (f'쉼표가 든 칸은 따옴표로 감싸 주세요: {extra}' if extra
                   else '줄 끝에 쉼표가 더 붙어 있는지 보세요.')
            )

        roles = _split_axis(cells[COL_ROLES])
        processes = _split_axis(cells[COL_PROCESSES])
        for label, values in (('역할', roles), ('프로세스', processes)):
            for v in values:
                if len(v) > MAX_AXIS_VALUE:
                    errors.append(
                        f'{line}행: {label} 이름이 너무 깁니다({MAX_AXIS_VALUE}자까지): {v}'
                    )

        # ── 문항 ─────────────────────────────────────────────────────────
        text_value = cells[COL_TEXT]
        if not text_value:
            errors.append(f'{line}행: 문항이 비어 있습니다.')
        elif len(text_value) > MAX_TEXT:
            errors.append(f'{line}행: 문항이 너무 깁니다({MAX_TEXT}자까지).')

        # ── 유형 ─────────────────────────────────────────────────────────
        qtype = parse_qtype(cells[COL_QTYPE])
        if qtype is None:
            raw_qtype = cells[COL_QTYPE]
            if raw_qtype:
                errors.append(f'{line}행: 유형을 알 수 없습니다: {raw_qtype}')
            else:
                errors.append(
                    '{}행: 유형이 비어 있습니다. {} 중 하나를 적어 주세요.'.format(
                        line, ' | '.join(['척도', '객관식', '복수선택', '순위', '서술'])
                    )
                )

        # ── 보기 ─────────────────────────────────────────────────────────
        choices = _split_choices(cells[COL_CHOICES])
        if qtype in CHOICE_QTYPES and not choices:
            errors.append(
                f'{line}행: {cells[COL_QTYPE]} 문항에는 보기가 필요합니다. '
                '보기 칸을 `|` 로 구분해 적어 주세요.'
            )
        if qtype in NO_CHOICE_QTYPES and choices:
            # 경고가 아니라 오류로 본다. 척도·서술에 보기가 붙어 있다는 것은
            # 사람이 열을 밀려 쓴 것이고, 그대로 저장하면 응답 화면이
            # 엉뚱하게 그려진다.
            errors.append(
                f'{line}행: {cells[COL_QTYPE]} 문항에는 보기를 적지 않습니다. '
                '열을 밀려 쓰지 않았는지 확인해 주세요.'
            )

        options = {}
        if qtype == 'scale':
            options = dict(SCALE_DEFAULT)
        elif qtype in CHOICE_QTYPES:
            options = {'choices': choices}

        # ── 필수 ─────────────────────────────────────────────────────────
        required = parse_required(cells[COL_REQUIRED])
        if required is None:
            errors.append(
                f'{line}행: 필수 여부를 알 수 없습니다: {cells[COL_REQUIRED]} '
                '(예/아니오, Y/N, true/false, 1/0)'
            )
            required = True

        link_key = cells[COL_LINK] or None
        if link_key and len(link_key) > MAX_LINK_KEY:
            errors.append(f'{line}행: 연결키가 너무 깁니다({MAX_LINK_KEY}자까지).')

        for v in roles:
            if v not in roles_seen:
                roles_seen.append(v)
        for v in processes:
            if v not in processes_seen:
                processes_seen.append(v)

        rows.append({
            'line': line,
            'section': section or None,
            'roles': roles,
            'processes': processes,
            'text': text_value,
            'qtype': qtype,
            'options': options,
            'required': required,
            'help_text': cells[COL_HELP] or None,
            'link_key': link_key,
            'errors': errors,
        })

    error_count = sum(1 for r in rows if r['errors'])
    return {
        'rows': rows,
        'roles': roles_seen,
        'processes': processes_seen,
        'header': header,
        'error_count': error_count,
        'ok_count': len(rows) - error_count,
    }


def all_errors(result):
    """행 순서대로 평평하게 편 오류 목록. 400 응답에 그대로 싣는다."""
    return [message for row in result['rows'] for message in row['errors']]


def rows_to_questions(result, link_type=None):
    """파싱 결과를 라우트의 문항 적용 함수(`_replace_questions` ·
    `_append_questions`)가 먹는 모양으로.

    **오류가 없는 표에만 쓴다.** 오류가 하나라도 있으면 라우트가 그 전에
    돌아선다 — 반쯤 만들어진 설문이 남는 것이 가장 나쁘다.

    link_type 은 표에 열이 없다. 표 전체에 같은 값을 매기고 싶을 때 부르는
    쪽이 넘긴다(예: 'strategy_dimension'). 연결키가 없는 행에는 붙이지 않는다 —
    가리키는 것이 없는 종류 이름은 나중에 읽는 쪽을 헷갈리게 한다.
    """
    items = []
    for i, row in enumerate(result['rows']):
        items.append({
            'order': i,
            'section': row['section'],
            'audience_roles': row['roles'],
            'audience_processes': row['processes'],
            'text': row['text'],
            'qtype': row['qtype'],
            'options': row['options'],
            'required': row['required'],
            'help_text': row['help_text'],
            'link_type': link_type if row['link_key'] else None,
            'link_key': row['link_key'],
        })
    return items
