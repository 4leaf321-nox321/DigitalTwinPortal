"""
개발서버용 — 과제별 DX KPI 연결을 임의로 채운다 (2026-08-06)

왜 있나
    KPI 연결이 43건뿐이고 그중 과제는 2건이라, 매트릭스·필터·기여 등급을 만들어도
    **볼 데이터가 없다.** 화면을 검증하려면 그럴듯한 분포가 필요하다.

⚠️ **개발서버 전용이다. 운영에서 돌리지 말 것.**
    운영은 사람이 판단해서 채워야 하는 값이고, 여기서 만든 등급·기여 내용은
    아무 근거가 없는 임의값이다.

왜 SQL 이 아니라 API 로 넣나
    서버가 지키는 규칙이 여럿이다 —
      · 사업부 과제는 대상이 **자기 사업부 고정**
      · 기능조직(GTR·SR·CS)은 대상을 **반드시 지목**
      · 사업부 전용 지표는 그 사업부 대상으로만
      · (과제, 지표, 대상) 유니크
    직접 INSERT 하면 이 규칙을 우회해 **화면이 못 읽는 데이터**가 생긴다.
    API 로 넣으면 규칙 위반이 400 으로 바로 드러난다.

재현 가능하게
    난수 씨앗을 고정한다. 같은 DB 에 다시 돌리면 같은 결과가 나온다.

쓰는 법
    python scripts\\dt3_seed_kpi_links.py            # 조사만 (기본)
    python scripts\\dt3_seed_kpi_links.py --commit   # 실제로 넣는다
    python scripts\\dt3_seed_kpi_links.py --commit --all   # 이미 연결된 과제도 다시
"""
import argparse
import json
import random
import sys

from app import create_app, db
from app.modules.digital_twin_dashboard.models_v2 import Dt2Project, Dt2ProjectKpi
from app.modules.auth.models import User
from flask_jwt_extended import create_access_token

SEED = 20260806

# 등급 분포 — **미지정을 일부러 남긴다.** 전부 채우면 '미지정 N건' 표시와
# 필터의 미지정 처리를 시험할 수 없다.
RELATION_POOL = (['primary'] * 25 + ['support'] * 35 + ['indirect'] * 25 + [None] * 15)

# 기여 내용 — 절반쯤만 채운다. 비어 있는 줄이 화면에서 어떻게 보이는지도 봐야 한다.
NOTE_POOL = [
    '해석 자동화로 검증 횟수 축소',
    '시험 전 사전 검증으로 재시험 감소',
    '표준 절차 수립으로 편차 축소',
    '데이터 연계로 수작업 제거',
    '예측 정확도 개선으로 재작업 감소',
    '플랫폼 제공으로 타 과제 기반 마련',
    '', '', '', '',          # 빈 값 — 약 40%
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--commit', action='store_true', help='실제로 넣는다')
    ap.add_argument('--all', action='store_true',
                    help='이미 연결이 있는 과제도 다시 만든다 (기본: 연결 0건인 과제만)')
    args = ap.parse_args()

    rnd = random.Random(SEED)
    app = create_app()

    with app.app_context():
        actor = User.query.filter_by(role='admin').first()
        if actor is None:
            sys.exit('admin 계정을 찾을 수 없습니다.')
        client = app.test_client()
        H = {'Authorization': f'Bearer {create_access_token(identity=str(actor.id))}',
             'Content-Type': 'application/json'}

        projects = (Dt2Project.query
                    .filter(Dt2Project.is_deleted.is_(False),
                            Dt2Project.is_permanently_deleted.is_(False))
                    .order_by(Dt2Project.code.asc())
                    .all())

        # 후보 지표·대상은 **서버에게 묻는다.** 여기서 규칙을 다시 구현하면 갈린다.
        sample = client.get(f'/api/dt-v2/projects/{projects[0].uuid}/kpi-links', headers=H)
        divisions = sample.get_json()['data']['divisions']
        owners = [d for d in divisions if d['isKpiOwner']]
        owner_names = [d['name'] for d in owners]
        code_of = {d['name']: d['code'] for d in divisions}

        print(f'대상 과제 {len(projects)}건 · KPI 보유 사업부 {owner_names}')
        print(f'모드: {"실제 저장" if args.commit else "조사만(기본)"}'
              f' · {"전체 재생성" if args.all else "연결 0건인 과제만"}\n')

        made = skipped = failed = 0
        rel_count = {}

        for p in projects:
            has = Dt2ProjectKpi.query.filter_by(project_uuid=p.uuid).count()
            if has and not args.all:
                skipped += 1
                continue

            # 이 과제가 쓸 수 있는 지표·대상을 서버에서 받는다
            r = client.get(f'/api/dt-v2/projects/{p.uuid}/kpi-links', headers=H)
            if r.status_code != 200:
                failed += 1
                continue
            available = r.get_json()['data']['available']
            is_func = bool(r.get_json()['data'].get('isFunctionalOrg'))

            # 대상 — 사업부 과제는 자기 사업부, 기능조직은 1~2곳을 고른다
            if is_func:
                targets = rnd.sample(owner_names, rnd.choice([1, 1, 2, 2, 3]))
            else:
                targets = [p.division]

            items = []
            for t in targets:
                # 그 대상이 관리하는 지표만. 플랫폼(kind != metric)은 가끔만 넣는다.
                usable = [k for k in available
                          if not k.get('divisions') or code_of.get(t) in k['divisions']]
                metrics = [k for k in usable if (k.get('kind') or 'metric') == 'metric']
                platforms = [k for k in usable if (k.get('kind') or 'metric') != 'metric']
                pick = rnd.sample(metrics, min(len(metrics), rnd.choice([1, 2, 2, 3, 3, 4])))
                if platforms and rnd.random() < 0.2:
                    pick.append(rnd.choice(platforms))
                for k in pick:
                    rel = rnd.choice(RELATION_POOL)
                    rel_count[rel] = rel_count.get(rel, 0) + 1
                    items.append({
                        'kpiDefinitionId': k['kpiDefinitionId'],
                        'targetDivision': t,
                        'relationType': rel,
                        'note': rnd.choice(NOTE_POOL),
                    })

            if not items:
                continue

            if args.commit:
                rr = client.put(f'/api/dt-v2/projects/{p.uuid}/kpi-links',
                                headers=H, data=json.dumps({'items': items}))
                if rr.status_code != 200:
                    failed += 1
                    print(f'  ⚠ {p.code}: {rr.status_code} {rr.get_json().get("message")}')
                    continue
            made += 1

        print(f'\n{"넣은" if args.commit else "넣을"} 과제 {made}건'
              f' · 건너뜀(이미 있음) {skipped}건 · 실패 {failed}건')
        print('등급 분포:', {(k or '미지정'): v for k, v in sorted(
            rel_count.items(), key=lambda x: (x[0] is None, x[0] or ''))})

        if not args.commit:
            print('\n실제로 넣으려면 --commit 을 붙이세요.')
        else:
            total = Dt2ProjectKpi.query.count()
            linked = db.session.query(Dt2ProjectKpi.project_uuid).distinct().count()
            print(f'\n현재 연결 {total}건 · 연결된 과제 {linked}건')


if __name__ == '__main__':
    main()
