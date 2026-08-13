"""
성과 소분류 보강 — 활성 대분류 5종에 쓸 만한 소분류를 갖춘다. (2026-08-03)

무엇이 문제였나
    활성 소분류가 5개뿐이고 그중 4개가 비용 계열이었다(테스트·시료비용·간접비/
    직접비/투자비 절감). **품질향상과 기술성과에는 소분류가 하나도 없어서**,
    그 대분류로 만든 성과는 '모든 성과 현황'에서 전부 `미분류`로 떨어졌다.

무엇을 하나
    1. 비활성 세대(id 3~25)에 이미 잘 설계된 어휘가 남아 있다. 그 행을
       **활성 대분류로 다시 붙이고 되살린다** — 같은 이름으로 새로 만들면
       테이블에 중복이 쌓이고, 설정 동기화가 이름으로 매칭하므로 헷갈린다.
    2. 그것만으로 안 채워지는 자리(특히 품질향상)에 **새 항목을 추가한다.**

무엇을 건드리지 않나
    지금 활성인 5개(테스트·시료비용·간접비 절감·직접비 절감·투자비 절감)는
    **그대로 둔다.** 기존 성과 437건이 그 값을 쓰고 있어서, 내리면 그것들이
    미분류가 된다.

설정 화면에서 저장해도 살아남는다 — `_sync_setting_rows` 가 이름으로(활성 우선)
매칭하므로 화면이 GET 으로 읽어간 목록에 이 항목들이 포함된다.

실행:  venv/Scripts/python.exe scripts/dt3_add_perf_subcategories.py [--apply]
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app                                            # noqa: E402
from app.extensions import db                                         # noqa: E402
from app.modules.digital_twin_dashboard.models import (               # noqa: E402
    PerformanceCategory, PerformanceSubcategory,
)

APPLY = '--apply' in sys.argv

# 활성 대분류 이름 → 붙일 소분류. (이름, 단위, 설명)
# 단위는 화면이 성과 입력 시 기본값으로 제안하는 값이라 대표적인 것만 넣는다.
PLAN = {
    '리드타임단축': [
        ('검증/분석 시간', 'hrs', '해석·검증에 걸리는 시간'),
        ('제품 설계 시간', 'hrs', '설계 검토·수정에 걸리는 시간'),
        ('시험 시간', 'hrs', '실물 시험에 걸리는 시간'),
        ('측정/검사 시간', 'hrs', '측정·검사에 걸리는 시간'),
        ('공정 설계 시간', 'hrs', '공정 조건 수립에 걸리는 시간'),
        ('생산 시간', 'hrs', '생산 사이클 타임'),
        ('설비 셋업 시간', 'hrs', '설비 셋업·전환에 걸리는 시간'),
        ('인증 시간', 'day', '인증·인허가에 걸리는 기간'),
    ],
    '비용절감': [
        ('개발비 (시료, 목업 등 자재비)', '억', '시료·목업 등 개발 자재비'),
        ('개발비 (금형 제작비)', '억', '금형 제작·수정 비용'),
        ('제조비 (인건비)', '억', '제조 인건비'),
        ('제조비 (설비 운영비)', '억', '설비 운영·유지 비용'),
        ('품질/서비스비', '억', '불량·서비스 대응 비용'),
    ],
    '품질향상': [
        # ★ 여기가 비어 있었다. 예측 정확도 계열이 지금 성과의 대부분이다.
        ('예측 정확도', '%', '해석 예측값과 실측값의 오차율 또는 적중률'),
        ('불량률 감소', '%', '공정·필드 불량률'),
        ('신뢰성/내구성', '%', '수명·내구 예측 및 실측 신뢰성'),
        ('규격 만족도', '%', '온도·소음 등 규격 대비 만족 수준'),
        ('측정 정밀도', '%', '측정·검사 결과의 재현성과 정밀도'),
    ],
    '기술성과': [
        ('시뮬레이션 정확도', '%', '시뮬레이션 결과의 정확도'),
        ('시뮬레이션 적용 대상', '건', '시뮬레이션을 적용한 대상 수'),
        ('표준·기준 제정', '건', '표준 절차서·판정 기준 제정 건수'),
        ('플랫폼 구축/확대', '건', '플랫폼 도입·적용 확대 범위'),
        ('시스템 등록 건수', '건', '시스템에 등록한 건수'),
        ('구현 건수', '건', '기능·모델 구현 건수'),
        ('데이터 연결률', '%', '설비·시스템 데이터 연결 비율'),
        ('물성 DB 구축', '종', '표준 측정으로 확보한 물성 항목 수'),
        ('설비 정지율', '%', '설비 비가동 비율'),
        ('인당 생산 대수', '대', '인당 생산성'),
        ('제조 유실율', '%', '제조 과정 유실 비율'),
    ],
    '기타': [
        ('신규 투자비 절감', '억', '신규 투자 회피·절감액'),
    ],
}


def norm(s):
    return (s or '').strip().lower()


def main():
    app = create_app()
    with app.app_context():
        cats = {c.name: c for c in PerformanceCategory.query.filter(
            PerformanceCategory.is_active.is_(True)).all()}
        missing = [n for n in PLAN if n not in cats]
        if missing:
            print(f'활성 대분류를 못 찾음: {missing} — 중단')
            return 1

        rows = PerformanceSubcategory.query.all()
        # 이름 → 행들. 활성 우선, 그다음 최신 id (설정 동기화와 같은 기준)
        by_name = {}
        for r in sorted(rows, key=lambda r: (not bool(r.is_active), -r.id)):
            by_name.setdefault(norm(r.name), []).append(r)

        keep_active = [r for r in rows if r.is_active]
        print('지금 활성 소분류 (그대로 둔다):')
        for r in keep_active:
            print(f'  id={r.id} {r.name!r}')
        print()

        revive, create, already = [], [], []
        used = set()
        for cat_name, items in PLAN.items():
            cat = cats[cat_name]
            for order, (name, unit, desc) in enumerate(items):
                cand = next((r for r in by_name.get(norm(name), [])
                             if r.id not in used), None)
                if cand is None:
                    create.append((cat, name, unit, desc, order))
                elif cand.is_active and cand.category_id == cat.id:
                    already.append((cat_name, cand))
                    used.add(cand.id)
                else:
                    revive.append((cat, cand, name, unit, desc, order))
                    used.add(cand.id)

        print(f'되살려 활성 대분류에 재연결: {len(revive)}건')
        for cat, r, name, _u, _d, _o in revive:
            print(f'  id={r.id:>3} {name!r}  (cat {r.category_id} → {cat.id} {cat.name},'
                  f' active {r.is_active} → True)')
        print(f'신규 추가: {len(create)}건')
        for cat, name, unit, _d, _o in create:
            print(f'  {name!r}  → {cat.name} (단위 {unit})')
        if already:
            print(f'이미 맞게 활성: {len(already)}건')

        if not APPLY:
            print()
            print('--apply 를 붙이면 반영한다')
            return 0

        # 순서는 대분류 안에서 PLAN 순서를 따르되, 기존 활성 항목 뒤에 붙인다.
        base = {c.id: max([r.order or 0 for r in keep_active
                           if r.category_id == c.id] or [-1]) + 1
                for c in cats.values()}

        for cat, r, name, unit, desc, order in revive:
            r.name = name
            r.category_id = cat.id
            r.unit = unit
            r.description = desc
            r.order = base[cat.id] + order
            r.is_active = True
        for cat, name, unit, desc, order in create:
            db.session.add(PerformanceSubcategory(
                name=name, category_id=cat.id, unit=unit, description=desc,
                order=base[cat.id] + order, is_active=True,
                is_achievement_type=False,
            ))
        db.session.commit()

        print()
        print('반영 후 활성 소분류:')
        for c in sorted(cats.values(), key=lambda c: c.order or 0):
            subs = (PerformanceSubcategory.query
                    .filter_by(category_id=c.id, is_active=True)
                    .order_by(PerformanceSubcategory.order).all())
            print(f'  [{c.name}] {len(subs)}개')
            for s in subs:
                print(f'      - {s.name}' + (f'  ({s.unit})' if s.unit else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
