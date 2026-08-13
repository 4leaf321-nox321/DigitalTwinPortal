"""
문서 자동 검증 모듈 - Word/TXT 문서 비교/검증
두 문서(A, B)를 블록(paragraph·table·line) 단위로 비교하여
일치/추가/삭제/변경 정보를 반환한다.
"""
import io
import os
import difflib
import hashlib

from flask import request
from flask_jwt_extended import jwt_required, get_jwt_identity
from docx import Document as DocxDocument
from docx.oxml.ns import qn

from app.modules.auto_document_verify import bp
from app.modules.auth.models import User
from app.shared.responses import success_response, error_response


# ──────────────────────────────────────────────
#  문서 파싱: Block 추출
# ──────────────────────────────────────────────

def _has_page_break(element):
    """paragraph 요소 내에 페이지 브레이크가 있는지 확인."""
    # w:br[@w:type="page"] — 명시적 페이지 브레이크
    for br in element.iter(qn('w:br')):
        if br.get(qn('w:type')) == 'page':
            return True
    # w:lastRenderedPageBreak — Word가 렌더링 시 삽입한 페이지 브레이크
    for _ in element.iter(qn('w:lastRenderedPageBreak')):
        return True
    return False


def _has_section_break(element):
    """paragraph 요소 내에 섹션 브레이크(=페이지 전환)가 있는지 확인."""
    for sect in element.iter(qn('w:sectPr')):
        return True
    return False


def _extract_blocks(doc):
    """
    Word 문서에서 paragraph와 table을 문서 순서대로 추출하여
    블록 리스트를 반환한다.

    각 블록에 page(페이지 번호)와 line(문서 내 줄 번호)을 포함한다.
      page: 페이지 브레이크/섹션 브레이크 기반 추정 페이지 번호
      line: 문서 내 누적 줄 번호 (paragraph=1줄, table=행 수만큼)
    """
    blocks = []
    current_page = 1
    current_line = 1

    for element in doc.element.body:
        tag = element.tag

        if tag == qn('w:p'):
            # 페이지 브레이크 감지 — 해당 paragraph 전에 페이지가 넘어감
            if _has_page_break(element) or _has_section_break(element):
                current_page += 1

            # 텍스트 추출
            runs_text = ''.join(
                node.text or ''
                for node in element.iter(qn('w:t'))
            )
            text = runs_text.strip()

            # 빈 paragraph도 줄 번호는 증가
            if text:
                blocks.append({
                    'type': 'paragraph',
                    'text': text,
                    'page': current_page,
                    'line': current_line,
                })
            current_line += 1

        elif tag == qn('w:tbl'):
            # Table — docx Table 객체로 변환
            tbl = None
            for table in doc.tables:
                if table._tbl is element:
                    tbl = table
                    break
            if tbl is None:
                continue

            rows_data = []
            for row in tbl.rows:
                cells = [cell.text.strip() for cell in row.cells]
                rows_data.append(cells)

            # 정규화 텍스트 (비교용)
            flat = '|'.join(
                '|'.join(r) for r in rows_data
            )
            blocks.append({
                'type': 'table',
                'rows': rows_data,
                'text': flat,
                'page': current_page,
                'line': current_line,
            })
            # 표는 행 수만큼 줄 차지
            current_line += len(rows_data)

        elif tag == qn('w:sectPr'):
            # body 레벨의 섹션 브레이크
            current_page += 1

    return blocks


# ──────────────────────────────────────────────
#  TXT 파싱: Block 추출
# ──────────────────────────────────────────────

_TXT_ENCODINGS = ['utf-8', 'cp949', 'euc-kr', 'utf-16', 'latin-1']

def _decode_txt(raw_bytes):
    """여러 인코딩을 시도하여 텍스트로 디코딩."""
    for enc in _TXT_ENCODINGS:
        try:
            return raw_bytes.decode(enc)
        except (UnicodeDecodeError, UnicodeError):
            continue
    # latin-1은 모든 바이트를 수용하므로 여기 도달하지 않지만 안전장치
    return raw_bytes.decode('latin-1', errors='replace')


def _extract_blocks_txt(raw_bytes):
    """
    TXT/붙여넣기 텍스트에서 블록을 추출한다.

    탭 문자가 포함된 연속 줄은 표(table)로 인식한다.
    (Word에서 표를 복사하면 셀이 탭으로 구분되어 붙여넣어짐)

    빈 줄은 건너뛰고, 각 블록에 line(줄 번호)을 포함한다.
    """
    text = _decode_txt(raw_bytes)
    lines = text.splitlines()

    blocks = []
    table_buf = []       # 표 행 버퍼
    table_start = None   # 표 시작 줄 번호

    def _flush_table():
        """버퍼에 쌓인 표 행들을 table 블록으로 변환."""
        if not table_buf:
            return
        rows_data = [row for row in table_buf]
        flat = '|'.join('|'.join(r) for r in rows_data)
        blocks.append({
            'type': 'table',
            'rows': rows_data,
            'text': flat,
            'page': None,
            'line': table_start,
        })

    for i, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped:
            # 빈 줄 → 진행 중인 표 버퍼 플러시
            _flush_table()
            table_buf = []
            table_start = None
            continue

        has_tab = '\t' in stripped

        if has_tab:
            # 탭이 포함된 줄 → 표 행으로 간주
            cells = [c.strip() for c in stripped.split('\t')]
            if not table_buf:
                table_start = i
            table_buf.append(cells)
        else:
            # 일반 텍스트 줄
            # 먼저 진행 중인 표 버퍼 플러시
            _flush_table()
            table_buf = []
            table_start = None

            blocks.append({
                'type': 'paragraph',
                'text': stripped,
                'page': None,
                'line': i,
            })

    # 파일 끝에 남은 표 버퍼 플러시
    _flush_table()

    return blocks


# ──────────────────────────────────────────────
#  블록 해시 (LCS 비교용)
# ──────────────────────────────────────────────

def _block_hash(block):
    """블록의 텍스트 내용을 해시로 변환."""
    raw = f"{block['type']}:{block['text']}"
    return hashlib.md5(raw.encode('utf-8')).hexdigest()


# ──────────────────────────────────────────────
#  LCS 기반 Block-level diff
# ──────────────────────────────────────────────

def _diff_blocks(blocks_a, blocks_b):
    """
    blocks_a, blocks_b를 LCS로 매칭하여 diff 리스트를 반환.

    1단계: 해시 기반 LCS → equal / added / deleted
    2단계: 매칭 안 된 블록끼리 유사도 비교 → modified 재분류
    3단계: modified paragraph 내부는 word-level diff
    """
    hashes_a = [_block_hash(b) for b in blocks_a]
    hashes_b = [_block_hash(b) for b in blocks_b]

    sm = difflib.SequenceMatcher(None, hashes_a, hashes_b)
    opcodes = sm.get_opcodes()

    diffs = []
    for tag, i1, i2, j1, j2 in opcodes:
        if tag == 'equal':
            for k in range(i2 - i1):
                ba = blocks_a[i1 + k]
                bb = blocks_b[j1 + k]
                diffs.append({
                    'type': 'equal',
                    'blockType': ba['type'],
                    'indexA': i1 + k,
                    'indexB': j1 + k,
                    'pageA': ba.get('page'),
                    'lineA': ba.get('line'),
                    'pageB': bb.get('page'),
                    'lineB': bb.get('line'),
                    'textA': ba['text'],
                    **(
                        {'rowsA': ba['rows']}
                        if ba['type'] == 'table' else {}
                    ),
                })

        elif tag == 'insert':
            for j in range(j1, j2):
                bb = blocks_b[j]
                diffs.append({
                    'type': 'added',
                    'blockType': bb['type'],
                    'indexA': None,
                    'indexB': j,
                    'pageA': None,
                    'lineA': None,
                    'pageB': bb.get('page'),
                    'lineB': bb.get('line'),
                    'textB': bb['text'],
                    **(
                        {'rowsB': bb['rows']}
                        if bb['type'] == 'table' else {}
                    ),
                })

        elif tag == 'delete':
            for i in range(i1, i2):
                ba = blocks_a[i]
                diffs.append({
                    'type': 'deleted',
                    'blockType': ba['type'],
                    'indexA': i,
                    'indexB': None,
                    'pageA': ba.get('page'),
                    'lineA': ba.get('line'),
                    'pageB': None,
                    'lineB': None,
                    'textA': ba['text'],
                    **(
                        {'rowsA': ba['rows']}
                        if ba['type'] == 'table' else {}
                    ),
                })

        elif tag == 'replace':
            # replace 영역: A 쪽과 B 쪽을 1:1 매칭 시도 (fuzzy)
            sub_a = blocks_a[i1:i2]
            sub_b = blocks_b[j1:j2]
            _diff_replace_region(diffs, sub_a, sub_b, i1, j1)

    return diffs


def _diff_replace_region(diffs, sub_a, sub_b, offset_a, offset_b):
    """
    replace 영역 내에서 유사도 기반 매칭을 수행한다.
    같은 type끼리 유사도가 0.4 이상이면 modified, 아니면 deleted/added.
    """
    used_b = set()

    for ia, ba in enumerate(sub_a):
        best_ratio = 0.0
        best_jb = -1
        for jb, bb in enumerate(sub_b):
            if jb in used_b:
                continue
            if ba['type'] != bb['type']:
                continue
            ratio = difflib.SequenceMatcher(
                None, ba['text'], bb['text']
            ).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_jb = jb

        if best_ratio >= 0.4 and best_jb >= 0:
            used_b.add(best_jb)
            bb = sub_b[best_jb]
            diff_entry = {
                'type': 'modified',
                'blockType': ba['type'],
                'indexA': offset_a + ia,
                'indexB': offset_b + best_jb,
                'pageA': ba.get('page'),
                'lineA': ba.get('line'),
                'pageB': bb.get('page'),
                'lineB': bb.get('line'),
                'textA': ba['text'],
                'textB': bb['text'],
            }
            if ba['type'] == 'paragraph':
                diff_entry['wordDiffs'] = _word_diff(ba['text'], bb['text'])
            elif ba['type'] == 'table':
                diff_entry['rowsA'] = ba['rows']
                diff_entry['rowsB'] = bb['rows']
                diff_entry['tableDiffs'] = _table_diff(ba['rows'], bb['rows'])
            diffs.append(diff_entry)
        else:
            diffs.append({
                'type': 'deleted',
                'blockType': ba['type'],
                'indexA': offset_a + ia,
                'indexB': None,
                'pageA': ba.get('page'),
                'lineA': ba.get('line'),
                'pageB': None,
                'lineB': None,
                'textA': ba['text'],
                **(
                    {'rowsA': ba['rows']}
                    if ba['type'] == 'table' else {}
                ),
            })

    for jb, bb in enumerate(sub_b):
        if jb in used_b:
            continue
        diffs.append({
            'type': 'added',
            'blockType': bb['type'],
            'indexA': None,
            'indexB': offset_b + jb,
            'pageA': None,
            'lineA': None,
            'pageB': bb.get('page'),
            'lineB': bb.get('line'),
            'textB': bb['text'],
            **(
                {'rowsB': bb['rows']}
                if bb['type'] == 'table' else {}
            ),
        })


# ──────────────────────────────────────────────
#  Word-level diff (paragraph 내부)
# ──────────────────────────────────────────────

def _word_diff(text_a, text_b):
    """두 문자열을 단어 단위로 비교하여 diff 리스트를 반환."""
    words_a = text_a.split()
    words_b = text_b.split()
    sm = difflib.SequenceMatcher(None, words_a, words_b)
    result = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            result.append({'type': 'equal', 'text': ' '.join(words_a[i1:i2])})
        elif tag == 'insert':
            result.append({'type': 'added', 'text': ' '.join(words_b[j1:j2])})
        elif tag == 'delete':
            result.append({'type': 'deleted', 'text': ' '.join(words_a[i1:i2])})
        elif tag == 'replace':
            result.append({'type': 'deleted', 'text': ' '.join(words_a[i1:i2])})
            result.append({'type': 'added', 'text': ' '.join(words_b[j1:j2])})
    return result


# ──────────────────────────────────────────────
#  Table diff (행 단위 LCS + 셀 비교)
# ──────────────────────────────────────────────

def _table_diff(rows_a, rows_b):
    """두 테이블을 행 단위로 비교."""
    # 행을 문자열로 직렬화하여 LCS
    str_a = ['|'.join(r) for r in rows_a]
    str_b = ['|'.join(r) for r in rows_b]

    sm = difflib.SequenceMatcher(None, str_a, str_b)
    row_diffs = []

    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'equal':
            for k in range(i2 - i1):
                row_diffs.append({
                    'type': 'equal',
                    'indexA': i1 + k,
                    'indexB': j1 + k,
                    'cells': rows_a[i1 + k],
                })
        elif tag == 'insert':
            for j in range(j1, j2):
                row_diffs.append({
                    'type': 'added',
                    'indexA': None,
                    'indexB': j,
                    'cells': rows_b[j],
                })
        elif tag == 'delete':
            for i in range(i1, i2):
                row_diffs.append({
                    'type': 'deleted',
                    'indexA': i,
                    'indexB': None,
                    'cells': rows_a[i],
                })
        elif tag == 'replace':
            # 행 단위 1:1 매칭
            max_len = max(i2 - i1, j2 - j1)
            for k in range(max_len):
                ai = i1 + k if i1 + k < i2 else None
                bj = j1 + k if j1 + k < j2 else None
                if ai is not None and bj is not None:
                    cell_diffs = _cell_diff(rows_a[ai], rows_b[bj])
                    row_diffs.append({
                        'type': 'modified',
                        'indexA': ai,
                        'indexB': bj,
                        'cellsA': rows_a[ai],
                        'cellsB': rows_b[bj],
                        'cellDiffs': cell_diffs,
                    })
                elif ai is not None:
                    row_diffs.append({
                        'type': 'deleted',
                        'indexA': ai,
                        'indexB': None,
                        'cells': rows_a[ai],
                    })
                else:
                    row_diffs.append({
                        'type': 'added',
                        'indexA': None,
                        'indexB': bj,
                        'cells': rows_b[bj],
                    })

    return row_diffs


def _cell_diff(cells_a, cells_b):
    """같은 행의 셀을 하나씩 비교."""
    result = []
    max_cols = max(len(cells_a), len(cells_b))
    for c in range(max_cols):
        va = cells_a[c] if c < len(cells_a) else ''
        vb = cells_b[c] if c < len(cells_b) else ''
        if va == vb:
            result.append({'col': c, 'type': 'equal', 'value': va})
        else:
            result.append({
                'col': c,
                'type': 'modified',
                'oldValue': va,
                'newValue': vb,
                'wordDiffs': _word_diff(va, vb),
            })
    return result


# ──────────────────────────────────────────────
#  권한 체크
# ──────────────────────────────────────────────

def _check_admin(user):
    """관리자 권한 확인"""
    return user and (user.role == 'admin' or user.is_admin)


# ──────────────────────────────────────────────
#  파일 포맷 진단
# ──────────────────────────────────────────────

# 매직 바이트 상수
_ZIP_MAGIC = b'PK\x03\x04'          # .docx (ZIP 기반 OOXML)
_OLE_MAGIC = b'\xd0\xcf\x11\xe0'    # .doc (OLE2 Compound Document)

def _get_file_ext(filename):
    """파일 확장자를 소문자로 반환."""
    return os.path.splitext(filename)[1].lower() if filename else ''


def _diagnose_file(raw_bytes, filename):
    """
    파일의 확장자와 매직 바이트를 검사하여 문제가 있으면 사용자 친화적
    에러 메시지를 반환한다. 정상이면 None을 반환한다.
    """
    if not raw_bytes or len(raw_bytes) < 4:
        return f'"{filename}" 파일이 비어있거나 손상되었습니다.'

    ext = _get_file_ext(filename)

    # TXT 파일은 매직 바이트 검사 불필요
    if ext == '.txt':
        return None

    # DOCX 파일: 매직 바이트 검사
    magic = raw_bytes[:4]

    if magic == _ZIP_MAGIC:
        return None

    if magic == _OLE_MAGIC:
        return (
            f'"{filename}" 파일은 구형 .doc 포맷이거나 '
            f'DRM으로 암호화된 상태입니다.\n'
            f'• .doc 파일인 경우: Word에서 "다른 이름으로 저장" → '
            f'파일 형식을 "Word 문서 (*.docx)"로 선택하여 저장해주세요.\n'
            f'• DRM 파일인 경우: DRM을 해제한 후 다시 시도해주세요.'
        )

    return (
        f'"{filename}" 파일을 인식할 수 없습니다.\n'
        f'.docx 또는 .txt 형식만 지원합니다.'
    )


# ──────────────────────────────────────────────
#  파일 → 블록 변환 (포맷별 분기)
# ──────────────────────────────────────────────

def _parse_file_to_blocks(raw_bytes, filename):
    """확장자에 따라 적절한 파서로 블록을 추출."""
    ext = _get_file_ext(filename)
    if ext == '.txt':
        return _extract_blocks_txt(raw_bytes)
    else:
        doc = DocxDocument(io.BytesIO(raw_bytes))
        return _extract_blocks(doc)


# ══════════════════════════════════════════════
#  API Routes
# ══════════════════════════════════════════════

@bp.route('/compare', methods=['POST'])
@jwt_required()
def compare_documents():
    """
    두 Word 문서를 비교하여 diff 결과를 반환한다.

    Request: multipart/form-data
      - fileA: 원본 Word 문서
      - fileB: 비교 Word 문서
    """
    user = User.query.get(get_jwt_identity())
    if not _check_admin(user):
        return error_response('관리자 권한이 필요합니다.', status_code=403)

    if 'fileA' not in request.files or 'fileB' not in request.files:
        return error_response('두 개의 Word 문서(fileA, fileB)를 업로드해주세요.')

    file_a = request.files['fileA']
    file_b = request.files['fileB']

    if not file_a.filename or not file_b.filename:
        return error_response('파일 이름이 없습니다.')

    _SUPPORTED_EXTS = ('.docx', '.txt')
    for f in [file_a, file_b]:
        if not f.filename.lower().endswith(_SUPPORTED_EXTS):
            return error_response(
                f'지원하지 않는 파일 형식입니다: {f.filename}. '
                f'.docx 또는 .txt 파일만 지원합니다.'
            )

    # 파일 바이너리 읽기
    raw_a = file_a.read()
    raw_b = file_b.read()

    # 파일 포맷 진단
    for raw, fname in [(raw_a, file_a.filename), (raw_b, file_b.filename)]:
        diag = _diagnose_file(raw, fname)
        if diag:
            return error_response(diag)

    # 확장자별 블록 추출
    try:
        blocks_a = _parse_file_to_blocks(raw_a, file_a.filename)
        blocks_b = _parse_file_to_blocks(raw_b, file_b.filename)
    except Exception as e:
        return error_response(f'문서를 읽을 수 없습니다: {str(e)}')

    diffs = _diff_blocks(blocks_a, blocks_b)

    # 통계 요약
    counts = {'equal': 0, 'added': 0, 'deleted': 0, 'modified': 0}
    for d in diffs:
        counts[d['type']] = counts.get(d['type'], 0) + 1

    total = max(len(blocks_a), len(blocks_b), 1)
    match_rate = round(counts['equal'] / total * 100, 1)

    return success_response({
        'fileNameA': file_a.filename,
        'fileNameB': file_b.filename,
        'summary': {
            'totalBlocksA': len(blocks_a),
            'totalBlocksB': len(blocks_b),
            **counts,
            'matchRate': match_rate,
        },
        'diffs': diffs,
    })


@bp.route('/compare-text', methods=['POST'])
@jwt_required()
def compare_texts():
    """
    두 텍스트를 줄 단위로 비교하여 diff 결과를 반환한다.
    DRM 파일을 Word에서 열고 복사-붙여넣기하여 비교할 때 사용.

    Request: application/json
      - textA: 원본 텍스트
      - textB: 비교 텍스트
      - nameA: (선택) 원본 이름
      - nameB: (선택) 비교본 이름
    """
    user = User.query.get(get_jwt_identity())
    if not _check_admin(user):
        return error_response('관리자 권한이 필요합니다.', status_code=403)

    body = request.get_json(silent=True) or {}
    text_a = body.get('textA', '')
    text_b = body.get('textB', '')

    if not text_a.strip() or not text_b.strip():
        return error_response('비교할 텍스트 두 개를 입력해주세요.')

    name_a = body.get('nameA', '원본 텍스트')
    name_b = body.get('nameB', '비교 텍스트')

    blocks_a = _extract_blocks_txt(text_a.encode('utf-8'))
    blocks_b = _extract_blocks_txt(text_b.encode('utf-8'))

    diffs = _diff_blocks(blocks_a, blocks_b)

    counts = {'equal': 0, 'added': 0, 'deleted': 0, 'modified': 0}
    for d in diffs:
        counts[d['type']] = counts.get(d['type'], 0) + 1

    total = max(len(blocks_a), len(blocks_b), 1)
    match_rate = round(counts['equal'] / total * 100, 1)

    return success_response({
        'fileNameA': name_a,
        'fileNameB': name_b,
        'summary': {
            'totalBlocksA': len(blocks_a),
            'totalBlocksB': len(blocks_b),
            **counts,
            'matchRate': match_rate,
        },
        'diffs': diffs,
    })
