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
    """운영. 실제 포탈 DB 를 읽는다.

    Phase 2 에서 대시보드·KPI 커넥터를 붙인다. 지금은 자리만 잡아둔다 —
    실제 스키마와 맞는지는 운영에 배포해야 알 수 있고, 그때 채운다.
    """

    mode = 'local'

    def get_projects(self, year):
        raise NotImplementedError(
            'Phase 2 에서 구현한다. 실제 스키마 확인이 필요해 운영 배포와 함께 붙인다.'
        )

    def get_kpis(self, year):
        raise NotImplementedError(
            'Phase 2 에서 구현한다. 실제 스키마 확인이 필요해 운영 배포와 함께 붙인다.'
        )


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
            if rng.random() < 0.25:
                kpi_links = []
            else:
                kpi_links = [
                    {'relation_type': rng.choice(
                        ['primary', 'support', 'indirect', None, None]
                    )}
                    for _ in range(rng.randint(1, 3))
                ]

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
