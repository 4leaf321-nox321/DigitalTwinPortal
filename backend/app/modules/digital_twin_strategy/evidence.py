"""
근거 원천 계층.

전략 모듈은 데이터가 어디서 오는지 모른다. 설정이 정한다.

    STRATEGY_EVIDENCE_SOURCE=local     운영. 진짜 DB
    STRATEGY_EVIDENCE_SOURCE=fixture   개발. 합성 데이터 (기본값)

운영 데이터는 개발로 반출하지 않는다는 전제 때문이다. 개발 DB 에는 의미 있는
데이터가 없으므로, 같은 모양의 가짜 데이터를 만들어 화면과 집계 로직을 검증한다.

합성 데이터로 확인할 수 있는 것과 없는 것이 갈린다:
  · 화면·집계·방법론 로직        → 확인 가능
  · 커넥터가 진짜 스키마와 맞는가 → **운영에서만** 확인 가능
  · AI 가 말이 되는 소리를 하는가 → **운영에서만** 확인 가능
"""
import random
from flask import current_app

from app.extensions import db


class EvidenceSource:
    """근거 원천 인터페이스. 전략 모듈은 이 타입만 안다."""

    mode = 'unknown'

    def get_projects(self, year):
        """과제 목록.

        구조 진단에 쓰는 항목을 함께 담는다:
          performance_count   성과를 몇 개나 정의했나 (0 이면 무엇을 이룰지 안 적은 것)
          kpi_links           [{'relation_type': 'primary'|'support'|'indirect'|None}, ...]
          dependency_count    선행·후속 연결 수 (0 이면 따로 도는 과제)
          end_quarter         종료 분기 (일정 쏠림 판단)
        """
        raise NotImplementedError

    def get_kpis(self, year):
        raise NotImplementedError


class LocalDbSource(EvidenceSource):
    """실제 포탈 DB 를 읽는다.

    dt2_* 가 과제의 정본이다(V2 컷오버 완료). 연결 정보는 각각 다른 표에 있어
    과제마다 따로 물으면 N+1 이 되므로, 연도 단위로 한 번에 모아 붙인다.

    ⚠️ 여기서 읽는 것은 전부 **읽기 전용**이다. 진단은 관찰이지 개입이 아니다.
    """

    mode = 'local'

    def get_projects(self, year):
        from app.modules.digital_twin_dashboard.models_v2 import (
            Dt2Project, Dt2ProjectKpi, Dt2ProjectPerformance, Dt2ProjectDependency,
        )
        from app.modules.dx_kpi_management.models import KpiDefinition

        projects = Dt2Project.query.filter_by(year=year).all()
        if not projects:
            return []

        uuids = [p.uuid for p in projects]

        # 성과 건수 — 무엇을 이루려는지 적었는가
        perf_counts = {}
        for row in Dt2ProjectPerformance.query.filter(
            Dt2ProjectPerformance.project_uuid.in_(uuids)
        ).all():
            perf_counts[row.project_uuid] = perf_counts.get(row.project_uuid, 0) + 1

        # KPI 연결 — 지표명으로 붙인다. 화면과 진단이 같은 이름을 봐야 한다.
        kpi_labels = {k.id: k.label for k in KpiDefinition.query.all()}
        kpi_links = {}
        for row in Dt2ProjectKpi.query.filter(
            Dt2ProjectKpi.project_uuid.in_(uuids)
        ).all():
            kpi_links.setdefault(row.project_uuid, []).append({
                'kpi': kpi_labels.get(row.kpi_definition_id, f'#{row.kpi_definition_id}'),
                'relation_type': row.relation_type,
                'target_division': row.target_division,
            })

        # 선행·후속 양쪽을 센다. 어느 방향이든 이어져 있으면 고립이 아니다.
        dep_counts = {}
        for row in Dt2ProjectDependency.query.filter(
            db.or_(
                Dt2ProjectDependency.project_uuid.in_(uuids),
                Dt2ProjectDependency.depends_on_uuid.in_(uuids),
            )
        ).all():
            for uuid in (row.project_uuid, row.depends_on_uuid):
                dep_counts[uuid] = dep_counts.get(uuid, 0) + 1

        result = []
        for p in projects:
            # 부서는 depts_json 이 정본이고, 비었으면 dept_name 을 쓴다.
            depts = [d for d in (p.depts_json or []) if d]
            if not depts and p.dept_name:
                depts = [p.dept_name]

            result.append({
                '과제명': p.title,
                '사업부': p.division,
                '담당부서목록': depts,
                '진행상태': p.status,
                '과제년도': p.year,
                '과제구분': p.category,
                '과제PL': p.pl_name,
                'PoC과제여부': bool(p.is_poc),
                '중점과제여부': bool(p.is_key),
                # end_month 는 1~12. 분기로 접어 일정 쏠림을 본다.
                'end_quarter': ((p.end_month - 1) // 3 + 1) if p.end_month else None,
                'performance_count': perf_counts.get(p.uuid, 0),
                'kpi_links': kpi_links.get(p.uuid, []),
                'dependency_count': dep_counts.get(p.uuid, 0),
                '_uuid': p.uuid,
            })
        return result

    def get_kpis(self, year):
        """사업부별 목표와 실적.

        목표는 kpi_targets, 실적은 kpi_records 에 있고 서로 다른 표다.
        (사업부, 지표) 로 맞춰 붙인다. 실적이 여러 시점이면 가장 최근 것을 쓴다 —
        base_date 가 문자열이라 사전순으로 비교하는데, YYYY-MM-DD 형식이라
        사전순이 곧 시간순이다.
        """
        from app.modules.dx_kpi_management.models import KpiRecord, KpiTarget

        targets = {}
        for t in KpiTarget.query.filter_by(year=year).all():
            if t.target_value is None:
                continue
            targets[(t.division, t.kpi)] = t.target_value

        if not targets:
            return []

        latest = {}
        for r in KpiRecord.query.all():
            key = (r.division, r.kpi)
            if key not in targets:
                continue
            prev = latest.get(key)
            if prev is None or (r.base_date or '') > (prev.base_date or ''):
                latest[key] = r

        rows = []
        for (division, kpi), target_value in targets.items():
            record = latest.get((division, kpi))
            if record is None:
                continue
            rows.append({
                '사업부': division,
                '지표': kpi,
                '과제년도': year,
                '목표': target_value,
                '실적': record.value,
            })
        return rows


# ── 합성 데이터 ────────────────────────────────────────────────────────────
# 운영 데이터를 흉내 낸 것이 아니다. 실제 과제명도 부서명도 모르므로 지어낸다.
# 규모와 형태만 같다.

# 사업부명은 조직 구조라 지어내면 화면이 실제와 동떨어진다. 개발 DB 에 이미
# 마스터가 있으므로 그걸 쓰고, 없을 때만 대체 목록으로 넘어간다.
_FALLBACK_DIVISIONS = ['MX', 'VD', 'DA', 'NW', '의료기기']
_DEPT_SUFFIX = ['1팀', '2팀', '3팀']


def _division_names():
    try:
        from app.modules.digital_twin_dashboard.models import Division
        names = [
            d.name for d in Division.query
            .filter_by(is_active=True)
            .order_by(Division.order, Division.id).all()
        ]
        if names:
            return names
    except Exception:
        pass
    return list(_FALLBACK_DIVISIONS)
_STATUS = ['기획', '진행중', '완료', '보류']
_CLASSIFICATION = ['신규', '계속', '고도화']
_PROCESS = ['성형', '용접', '도장', '조립', '검사', '물류']
_SUBJECT = ['공정', '설비', '품질', '물류', '에너지', '작업자']
# 실제 지표명은 운영에만 있다. 형태만 그럴듯하게 지어낸다.
_KPI_NAMES = [
    '가상 검증률', 'One Time Pass율', '시험 완료 리드타임',
    '설계 변경 건수', '시뮬레이션 활용률',
]

# (주, 보조, 간접, 미지정) 가중치. 지표마다 성격이 다르게 나오도록 한다.
# '시뮬레이션 활용률'은 주기여가 아예 안 나오게 해서, 아무도 직접 밀지 않는
# 지표를 규칙이 잡아내는지 확인할 수 있게 한다.
_KPI_GRADE_WEIGHTS = {
    '가상 검증률':        (5, 3, 2, 2),
    'One Time Pass율':  (4, 3, 2, 3),
    '시험 완료 리드타임':   (3, 3, 3, 4),
    '설계 변경 건수':      (2, 3, 4, 4),
    '시뮬레이션 활용률':    (0, 2, 5, 4),
}
_METHOD = ['디지털 트윈 구축', '시뮬레이션 모델링', '데이터 연계', '가상검증', '최적화']


class FixtureSource(EvidenceSource):
    """
    개발용 합성 데이터.

    seed 를 고정해 **매번 같은 데이터**가 나오게 한다. 입력이 흔들리면 AI 결과가
    프롬프트 때문에 바뀐 건지 데이터 때문인지 구분할 수 없다.
    """

    mode = 'fixture'

    # 확정된 규격: 2025·2026년 각 150~170건
    PROJECT_COUNT_RANGE = (150, 170)

    def _rng(self, year, salt=0):
        return random.Random(year * 1000 + salt)

    def get_projects(self, year):
        rng = self._rng(year)
        count = rng.randint(*self.PROJECT_COUNT_RANGE)
        divisions = _division_names()

        # 구조적 결함이 있는 데이터를 일부러 섞는다. 전부 깔끔하면 진단 규칙이
        # 아무것도 못 잡아 화면이 비어 보이고, 규칙이 도는지 확인할 수 없다.
        projects = []
        for i in range(count):
            division = rng.choice(divisions)

            # 성과를 정의하지 않은 과제가 섞이게 한다.
            performance_count = 0 if rng.random() < 0.35 else rng.randint(1, 3)

            # KPI 연결과 등급. 등급 미지정도 섞는다.
            # 어느 지표에 걸렸는지도 담는다 — 지표별로 "이걸 직접 미는 과제가
            # 있는가"를 보려면 지표 이름이 있어야 한다.
            if rng.random() < 0.25:
                kpi_links = []
            else:
                kpi_links = []
                for _ in range(rng.randint(1, 3)):
                    kpi = rng.choice(_KPI_NAMES)
                    # 지표마다 성격을 다르게 준다. 전부 고르게 만들면 "주기여로
                    # 미는 과제가 없는 지표" 같은 경우가 안 생겨 규칙이 도는지
                    # 확인할 수 없다.
                    weights = _KPI_GRADE_WEIGHTS.get(kpi, (2, 2, 2, 3))
                    kpi_links.append({
                        'kpi': kpi,
                        'relation_type': rng.choices(
                            ['primary', 'support', 'indirect', None],
                            weights=weights,
                        )[0],
                    })

            # 부서를 고르게 뽑지 않는다. 실제로는 한 부서가 대부분을 맡는 경우가
            # 흔하고, 고르게 만들면 편중도 규칙이 도는지 확인할 수 없다.
            dept = rng.choices(_DEPT_SUFFIX, weights=[6, 2, 1])[0]

            projects.append({
                '과제명': f'{rng.choice(_PROCESS)} {rng.choice(_SUBJECT)} {rng.choice(_METHOD)}',
                '사업부': division,
                '담당부서목록': [f'{division}{dept}'],
                '진행상태': rng.choice(_STATUS),
                '과제년도': year,
                '과제구분': rng.choice(_CLASSIFICATION),
                # PL 을 좁은 풀에서 뽑아 집중도가 생기게 한다.
                '과제PL': f'담당자{rng.randint(1, 18):02d}',
                'PoC과제여부': rng.random() < 0.2,
                '중점과제여부': rng.random() < 0.15,
                # 종료를 4분기에 몰리게 한다 — 실제로 흔한 패턴이다.
                'end_quarter': rng.choices([1, 2, 3, 4], weights=[1, 1, 2, 6])[0],
                'performance_count': performance_count,
                'kpi_links': kpi_links,
                'dependency_count': 0 if rng.random() < 0.4 else rng.randint(1, 3),
                '_fixture_id': f'FX-{year}-{i + 1:03d}',
            })
        return projects

    def get_kpis(self, year):
        rng = self._rng(year, salt=7)
        return [
            {
                '사업부': division,
                '과제년도': year,
                '목표': 100,
                '실적': rng.randint(60, 105),
                '_fixture_id': f'FXK-{year}-{idx + 1:02d}',
            }
            for idx, division in enumerate(_division_names())
        ]


def get_evidence_source():
    """설정이 정한 원천을 돌려준다. 기본값은 fixture — 개발에서 실수로 운영 DB 를
    긁는 것보다, 개발에서 가짜 데이터가 나오는 편이 안전하다."""
    mode = (current_app.config.get('STRATEGY_EVIDENCE_SOURCE') or 'fixture').lower()
    if mode == 'local':
        return LocalDbSource()
    return FixtureSource()
