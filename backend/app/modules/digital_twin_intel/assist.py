"""사내 LLM 이 기술정보를 정리한다 — 요약ㆍ분류ㆍ**우리 과제·KPI 와의 연결 제안**.

왜 이게 필요한가
    MCP 로 소식이 쌓여도 「그래서 우리한테 뭔데」에 답하는 것이 없으면, 이 모듈은
    여전히 **바깥 소식 게시판**이다. 「이 기술이 우리 MX 해석 과제와 관련 있다」가
    보여야 사람이 다시 온다. `dt_intel_links` 표는 처음부터 있었지만 **아무도 안
    채운다** — 손으로 이으라고 하면 아무도 안 잇는다. 그래서 제안까지 기계가 한다.

⚠️⚠️ **제안이지 연결이 아니다.** 여기서 만든 것은 후보일 뿐이고, 사람이 고른 것만
   `dt_intel_links` 에 들어간다. 자동으로 걸면 근거 없는 연결이 쌓이고, 그러면
   연결 자체를 아무도 안 믿게 된다 — 안 믿는 연결은 없는 것과 같다.

⚠️ **모델이 이름을 지어낼 수 있다.** 그래서 제안을 그대로 쓰지 않고 **실재하는
   과제ㆍ지표에만 맞춰 본다**(`_resolve`). 못 맞춘 것은 버린다 — 없는 과제를 가리키는
   후보를 보여 주면 사용자가 그것부터 의심하게 되고, 맞는 제안까지 같이 못 믿는다.

⚠️ 보이는 범위를 넘지 않는다. 후보 과제는 **그 사람이 볼 수 있는 것**만 넣는다
   (`Scope`) — 안 그러면 남의 사업부 과제 이름이 제안에 실려 새어 나간다.
"""
import json
import re

from flask import current_app

from app.modules.digital_twin_dashboard.ai import llm
from app.modules.digital_twin_intel.models import (
    CPT_KEYS, DEFAULT_SECTORS, IntelNews, IntelTech,
)

_FENCE_RE = re.compile(r'```(?:json)?\s*(.+?)```', re.S)

# 원문을 통째로 넣으면 컨텍스트가 넘친다. 앞부분만으로도 무엇에 대한 글인지는 잡힌다.
MAX_SOURCE_CHARS = 6000
# 후보를 너무 많이 주면 모델이 아무거나 고른다. 사람이 훑을 수 있는 만큼만.
MAX_CANDIDATES = 60
MAX_SUGGEST = 5


def _json_from(text, want='object'):
    """모델 답변에서 JSON 하나를 건진다. 못 건지면 None.

    ⚠️ **예외를 던지지 않는다.** 여기서 죽이면 사용자는 「실패했습니다」만 보고
       모델이 무슨 말을 했는지 아무 데도 안 남는다. 호출부가 원문을 로그에 남긴다.
       (`ai/form_assist.py` 와 같은 규칙 — 갈리면 한쪽만 고쳐진다)
    """
    raw = (text or '').strip()
    if not raw:
        return None
    open_ch, close_ch = ('{', '}') if want == 'object' else ('[', ']')
    want_type = dict if want == 'object' else list

    candidates = [raw]
    m = _FENCE_RE.search(raw)
    if m:
        candidates.append(m.group(1))
    i, j = raw.find(open_ch), raw.rfind(close_ch)
    if i != -1 and j > i:
        candidates.append(raw[i:j + 1])

    for c in candidates:
        try:
            v = json.loads(c)
        except (ValueError, TypeError):
            continue
        if isinstance(v, want_type):
            return v
    return None


def _norm(s):
    return ''.join((s or '').lower().split()).replace('-', '').replace('_', '')


# ─────────────────────────────────────────────────────────────────────────────
# 후보 모으기 — **볼 수 있는 것만**
# ─────────────────────────────────────────────────────────────────────────────

def _project_candidates(actor):
    """이 사람이 볼 수 있는 과제. 이름과 사업부만 준다.

    ⚠️ 본문ㆍ성과까지 넣으면 컨텍스트가 터지고, 무엇보다 **모델이 볼 이유가 없다.**
       여기서 하는 일은 「이 기술이 어느 과제와 관련 있나」를 고르는 것뿐이다.
    """
    from app.modules.digital_twin_dashboard.models_v2 import Dt2Project
    from app.modules.digital_twin_dashboard.permissions import can_view_project

    rows = (Dt2Project.query
            .filter(Dt2Project.is_deleted.is_(False),
                    Dt2Project.is_permanently_deleted.is_(False))
            .order_by(Dt2Project.year.desc(), Dt2Project.id.desc())
            .limit(400).all())
    out = []
    for p in rows:
        if not can_view_project(actor, p):
            continue
        out.append({'uuid': p.uuid, 'title': p.title,
                    'division': p.division, 'year': p.year})
        if len(out) >= MAX_CANDIDATES:
            break
    return out


def _kpi_candidates():
    """DX KPI 정의. 과제와 달리 **모두에게 같은 목록**이라 권한을 안 본다."""
    from app.modules.dx_kpi_management.models import KpiDefinition

    rows = (KpiDefinition.query
            .order_by(KpiDefinition.sort_order.asc(), KpiDefinition.id.asc())
            .limit(MAX_CANDIDATES).all())
    return [{'id': d.id, 'label': d.label, 'category': d.category} for d in rows]


# ─────────────────────────────────────────────────────────────────────────────
# 제안
# ─────────────────────────────────────────────────────────────────────────────

# ⚠️ **개발서버의 LLM 스텁이 이 문자열로 갈래를 고른다.** `scripts/llm_stub.py` 의
#    `_MARK_INTEL` 과 **같은 문자열**이어야 한다 — 갈리면 개발에서 이 기능을 한 줄도
#    못 돌려 본다(스텁이 되울림만 하고, JSON 파싱이 늘 실패한다).
MARK_INTEL = '### dt-intel: suggest'

_SYSTEM = (
    MARK_INTEL + '\n'
    '너는 제조 회사의 디지털 트윈 사무국을 돕는다. 바깥에서 들어온 기술 소식을 읽고, '
    '**우리 조직에 무슨 뜻인지**를 짧고 사실대로 정리한다.\n'
    '규칙:\n'
    '- 반드시 JSON 하나만 낸다. 설명 문장을 앞뒤에 붙이지 않는다.\n'
    '- 주어진 후보 목록에 **없는 과제나 지표를 지어내지 않는다.** 맞는 것이 없으면 '
    '빈 배열로 둔다. 억지로 채우면 사람이 목록 전체를 안 믿게 된다.\n'
    '- 근거가 원문에 없으면 추측하지 않는다. 모르면 비운다.\n'
    '- 한국어로 쓴다. 과장하지 않는다.'
)


def _prompt(subject, projects, kpis, sectors):
    kind = subject['kind']
    body = (subject.get('body') or '')[:MAX_SOURCE_CHARS]
    head = [f'## {"소식" if kind == "news" else "기술"}']
    head.append(f'제목: {subject.get("title")}')
    for k, label in (('source', '출처'), ('published_at', '발표일'),
                     ('vendor', '공급사'), ('url', '주소')):
        if subject.get(k):
            head.append(f'{label}: {subject[k]}')
    if subject.get('summary'):
        head.append(f'기존 요약: {subject["summary"]}')
    if body:
        head.append(f'\n원문(앞부분):\n{body}')

    lines = [
        '\n'.join(head),
        '',
        '## 고를 수 있는 우리 과제 (uuid 로 답할 것)',
        '\n'.join(f'- {p["uuid"]} | {p["title"]} | {p.get("division") or "-"}'
                  for p in projects) or '- (없음)',
        '',
        '## 고를 수 있는 DX KPI (id 로 답할 것)',
        '\n'.join(f'- {k["id"]} | {k["label"]}' for k in kpis) or '- (없음)',
        '',
        '## 레이더 부채꼴 (하나만 고른다)',
        ' / '.join(sectors),
        '',
        '## DTC 능력 분류 (여러 개 가능, 아래 값 그대로)',
        ' / '.join(CPT_KEYS),
        '',
        '## 이 형식으로만 답한다',
        json.dumps({
            'summary': '이게 무엇이고 왜 중요한지 두세 문장',
            'soWhat': '우리 조직에 무슨 뜻인지 한 문장',
            'category': '부채꼴 하나',
            'tags': ['걸치는 갈래나 열쇠말'],
            'cpt': ['Data Services'],
            'projects': [{'uuid': '...', 'why': '왜 관련 있는지 한 줄'}],
            'kpis': [{'id': 1, 'why': '어떻게 이 지표를 움직이나 한 줄'}],
        }, ensure_ascii=False, indent=2),
    ]
    return '\n'.join(lines)


def _resolve(raw, projects, kpis, sectors):
    """모델 답을 **실재하는 것에만** 맞춘다.

    ⚠️ 여기가 이 파일에서 제일 중요한 자리다. 모델은 그럴듯한 uuid 를 지어낼 수 있고,
       그것을 그대로 보여 주면 사용자가 **맞는 제안까지 같이 의심한다.**
    """
    by_uuid = {p['uuid']: p for p in projects}
    by_id = {str(k['id']): k for k in kpis}

    out = {
        'summary': (raw.get('summary') or '').strip() or None,
        'soWhat': (raw.get('soWhat') or '').strip() or None,
        'category': None,
        'tags': [],
        'cpt': [],
        'projects': [],
        'kpis': [],
        'dropped': [],          # 못 맞춘 것 — 화면에 조용히 안 보이면 디버깅이 안 된다
    }

    cat = (raw.get('category') or '').strip()
    if cat in sectors:
        out['category'] = cat
    elif cat:
        out['dropped'].append(f'분류 「{cat}」 는 없는 값이라 뺐습니다.')

    for t in (raw.get('tags') or [])[:8]:
        t = str(t).strip()
        if t and t not in out['tags']:
            out['tags'].append(t)

    for c in (raw.get('cpt') or []):
        c = str(c).strip()
        if c in CPT_KEYS and c not in out['cpt']:
            out['cpt'].append(c)

    for item in (raw.get('projects') or [])[:MAX_SUGGEST]:
        if not isinstance(item, dict):
            continue
        uuid = str(item.get('uuid') or '').strip()
        p = by_uuid.get(uuid)
        if p is None:
            out['dropped'].append(f'과제 「{uuid[:12]}…」 는 후보에 없어 뺐습니다.')
            continue
        out['projects'].append({
            'uuid': p['uuid'], 'title': p['title'], 'division': p.get('division'),
            'why': (item.get('why') or '').strip() or None,
        })

    for item in (raw.get('kpis') or [])[:MAX_SUGGEST]:
        if not isinstance(item, dict):
            continue
        kid = str(item.get('id') or '').strip()
        k = by_id.get(kid)
        if k is None:
            out['dropped'].append(f'지표 「{kid}」 는 후보에 없어 뺐습니다.')
            continue
        out['kpis'].append({
            'id': k['id'], 'label': k['label'],
            'why': (item.get('why') or '').strip() or None,
        })

    return out


def suggest(actor, kind, uuid, sectors=None):
    """소식이나 기술 하나를 읽고 **정리와 연결 후보**를 낸다.

    돌려주는 것은 **제안일 뿐** — 저장하지 않는다. 사람이 고른 것만 연결된다.
    """
    # ⚠️ **입력 검사가 LLM 확인보다 먼저다.** 순서가 반대면 잘못된 `kind` 를 보냈는데
    #    「LLM 서버가 없다」고 답한다 — 부르는 쪽이 엉뚱한 곳을 고치게 된다.
    #    (2026-08-25 CI 에서 드러났다. 개발 PC 는 `.env` 에 주소가 있어 안 보였다)
    if kind not in ('news', 'tech'):
        return None, "kind 는 'news' 또는 'tech' 여야 합니다."

    if not llm.is_configured():
        raise llm.LLMNotConfigured(
            'AI 정리는 LLM 서버가 설정돼야 씁니다(LLM_BASE_URL). '
            '개발서버라면 scripts/llm_stub.py 를 띄우세요.')

    if kind == 'news':
        row = IntelNews.query.filter_by(uuid=uuid).first()
        if row is None:
            return None, '소식을 찾을 수 없습니다.'
        subject = {'kind': 'news', 'title': row.title, 'summary': row.summary,
                   'body': row.body, 'source': row.source, 'url': row.url,
                   'published_at': row.published_at.isoformat() if row.published_at else None}
    elif kind == 'tech':
        row = IntelTech.query.filter_by(uuid=uuid).first()
        if row is None:
            return None, '기술을 찾을 수 없습니다.'
        subject = {'kind': 'tech', 'title': row.name, 'summary': row.summary,
                   'body': row.description, 'vendor': row.vendor, 'url': row.url}
    else:                                  # 위에서 이미 걸렀다. 여기 오면 안 된다.
        return None, "kind 는 'news' 또는 'tech' 여야 합니다."

    sectors = list(sectors or DEFAULT_SECTORS)
    projects = _project_candidates(actor)
    kpis = _kpi_candidates()

    result = llm.chat(
        [{'role': 'system', 'content': _SYSTEM},
         {'role': 'user', 'content': _prompt(subject, projects, kpis, sectors)}],
        temperature=0.2)

    raw = _json_from(result.content, want='object')
    if raw is None:
        # ⚠️ 모델 원문을 로그에 남긴다. 안 남기면 "가끔 실패한다" 를 못 쫓는다.
        current_app.logger.warning('[intel.assist] JSON 을 못 건졌다: %s',
                                   (result.content or '')[:500])
        return None, ('AI 답을 읽지 못했습니다. 다시 시도해 보세요 '
                      '(모델 원문은 서버 로그에 남았습니다).')

    out = _resolve(raw, projects, kpis, sectors)
    out['model'] = result.model
    out['candidateCounts'] = {'projects': len(projects), 'kpis': len(kpis)}
    return out, None
