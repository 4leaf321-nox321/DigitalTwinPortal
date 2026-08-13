"""
DX KPI 연결 반입 검증 — 운영서버에서 `flask db upgrade` 직후 실행한다.

**읽기 전용이다.** 아무것도 고치지 않는다. 보고 판단할 재료만 찍는다.

왜 스크립트인가
    운영서버에는 AI 도 인터넷도 없고, 즉석에서 SQL 을 짜서도 안 된다.
    확인해야 할 것이 여섯 가지인데 그걸 사람이 psql 로 두드리면 반드시 틀린다.
    (한글 컬럼·값 때문에 Windows 콘솔에서 인코딩 오류도 난다)

★ 이 스크립트의 진짜 목적은 5번이다
    `divisions.is_kpi_owner` 는 마이그레이션이 **운영 데이터를 보고** 채운다 —
    `kpi_records`/`kpi_targets` 에 한 번이라도 등장한 사업부만 KPI 보유로 본다.
    개발 DB 에서는 MX·VD·DA·NW·의료기기 다섯이 맞았지만, **운영은 다를 수 있다.**
    아직 실적을 한 건도 안 올린 보유 사업부가 있으면 기능조직으로 잘못 잡히고,
    그러면 **매트릭스에서 그 사업부 열이 통째로 사라진다.**
    이 스크립트가 그걸 사람 눈앞에 올려놓는다.

사용법
    cd backend
    python scripts\\dt4_kpi_verify.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

from app import create_app
from app.extensions import db
from sqlalchemy import text, inspect

# 이 기능이 돌려면 **반드시 적용돼 있어야 하는** 마이그레이션.
#
# 예전에는 head 가 이 값과 **정확히 같은지** 봤다. 그러면 그 뒤에 마이그레이션이
# 하나만 더 생겨도 [FAIL] 이 나는데, 정작 스키마는 멀쩡하다 — 헛경보다.
# (2026-08-01 d4a91c07f8e2 를 추가하자마자 걸렸다)
# 지금은 **조상 사슬에 들어 있는가**를 본다. 뒤에 뭐가 더 붙든 상관없다.
REQUIRED_REVISIONS = (
    'c8f3a15e6b27',      # dt2_project_kpi + target_division 까지
    'd4a91c07f8e2',      # kpi_definitions.kind + '플랫폼 구축' 항목
)


def applied_revisions(head):
    """
    head 에서 down_revision 을 따라 올라가며 적용된 리비전 집합을 만든다.

    alembic 을 띄우지 않고 파일만 읽는다 — 이 스크립트는 반입 현장에서 도는
    점검용이라 의존을 늘리지 않는다.
    """
    import re
    vdir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        'migrations', 'versions')
    down = {}
    for fn in os.listdir(vdir):
        if not fn.endswith('.py'):
            continue
        src = open(os.path.join(vdir, fn), encoding='utf-8').read()
        rev = re.search(r"^revision\s*=\s*['\"]([^'\"]+)", src, re.M)
        dr = re.search(r"^down_revision\s*=\s*(?:['\"]([^'\"]+)|None)", src, re.M)
        if rev:
            down[rev.group(1)] = dr.group(1) if (dr and dr.group(1)) else None

    seen, cur = set(), head
    while cur and cur not in seen:
        seen.add(cur)
        cur = down.get(cur)
    return seen

results = []


def check(desc, ok, extra=''):
    """`extra` 는 **실패했을 때만** 보여준다 — 통과 줄에 군더더기가 붙으면
    화면에서 [FAIL] 을 찾기 어려워진다. 늘 봐야 할 값은 info() 로 따로 찍는다."""
    results.append((desc, bool(ok)))
    mark = '[OK]  ' if ok else '[FAIL]'
    print(f'  {mark} {desc}' + (f'   → {extra}' if not ok and extra else ''))


def info(line):
    print(f'  [정보] {line}')


def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    import logging

    # 개발 설정(`SQLALCHEMY_ECHO=True`)에서는 쿼리 로그가 화면을 덮어 결과를 못 읽는다.
    # 운영(`FLASK_ENV=production`)에서는 원래 안 나오지만, 개발 PC 에서 미리 돌려볼 때도
    # 같은 화면이어야 런북의 기대값과 대조할 수 있다.
    #
    # ⚠️ **엔진을 만들기 전에** 꺼야 한다. 만든 뒤에 로거 레벨을 낮추거나 핸들러를 떼도
    #    소용없다 — echo 는 `isEnabledFor` 를 항상 True 로 돌려주는 전용 로거를 쓰고,
    #    엔진 옵션은 init_app 시점에 이미 굳는다.
    from app.config import DevelopmentConfig
    DevelopmentConfig.SQLALCHEMY_ECHO = False

    app = create_app()
    with app.app_context():

        print('=' * 72)
        print(' DX KPI 연결 — 반입 검증')
        print('=' * 72)

        # 1. 마이그레이션 --------------------------------------------------
        print('\n1. 마이그레이션')
        head = db.session.execute(text('select version_num from alembic_version')).scalar()
        applied = applied_revisions(head)
        missing = [r for r in REQUIRED_REVISIONS if r not in applied]
        check('필요한 마이그레이션이 모두 적용됐다',
              not missing,
              f'현재 head={head} · 빠진 것 {", ".join(missing)}'
              ' — 5장(flask db upgrade)을 다시 한다')
        info(f'head = {head}')

        # 2. 스키마 --------------------------------------------------------
        print('\n2. 표와 칸')
        insp = inspect(db.engine)
        tables = set(insp.get_table_names())
        check('dt2_project_kpi 표가 있다', 'dt2_project_kpi' in tables)

        if 'dt2_project_kpi' in tables:
            cols = {c['name'] for c in insp.get_columns('dt2_project_kpi')}
            check('target_division 칸이 있다', 'target_division' in cols)
        div_cols = {c['name'] for c in insp.get_columns('divisions')}
        check('divisions.is_kpi_owner 칸이 있다', 'is_kpi_owner' in div_cols)

        # 3. KPI 정의 ------------------------------------------------------
        print('\n3. DX KPI 지표')
        n_def = db.session.execute(text('select count(*) from kpi_definitions')).scalar()
        check('KPI 지표가 1개 이상 있다', (n_def or 0) > 0, f'{n_def}개')
        if not n_def:
            info('지표가 0개면 과제 편집창의 KPI 목록이 빈 채로 보인다.')
            info('DX KPI 관리 화면을 한 번 열면 기본 15개가 들어간다.')

        # 4. 기존 연결 백필 -------------------------------------------------
        print('\n4. 기존 연결 (있다면)')
        n_link = db.session.execute(text('select count(*) from dt2_project_kpi')).scalar() or 0
        info(f'연결 {n_link}건')
        if n_link:
            n_empty = db.session.execute(text(
                "select count(*) from dt2_project_kpi where coalesce(target_division,'') = ''"
            )).scalar() or 0
            check('대상 사업부가 빈 연결이 없다', n_empty == 0, f'{n_empty}건 비어 있음')
            if n_empty:
                info('과제에 사업부가 없어 백필이 값을 못 찾은 경우다.')
                info('매트릭스에서 그 연결만 빠진다. 해당 과제의 사업부를 지정한 뒤')
                info('편집창에서 KPI 를 다시 연결하면 된다. (반입을 멈출 사유는 아니다)')

        # 5. ★ 사업부 구분 --------------------------------------------------
        print('\n5. ★ 사업부 / 기능조직 구분 — 여기가 이 검증의 핵심')
        rows = db.session.execute(text(
            'select name, is_kpi_owner from divisions where is_active order by "order", id'
        )).all()
        owners = [r[0] for r in rows if r[1]]
        funcs = [r[0] for r in rows if not r[1]]
        for name, own in rows:
            print(f'        {name:<12} {"KPI 보유" if own else "기능조직"}')

        check('KPI 보유 사업부가 1개 이상이다', len(owners) > 0)
        if not owners:
            info('전부 기능조직으로 잡혔다 — 매트릭스에 열이 하나도 안 생긴다.')
            info('kpi_records / kpi_targets 가 비어 있다는 뜻이다.')

        # 실적이 있는데 기능조직으로 잡힌 사업부 = 백필 오류
        measured = {r[0] for r in db.session.execute(text(
            'select division from kpi_records where division is not null '
            'union select division from kpi_targets where division is not null'
        )).all()}
        wrong = [n for n in funcs if n in measured]
        check('실적이 있는데 기능조직으로 잡힌 사업부가 없다',
              not wrong, f'{wrong}')

        info(f'KPI 실적·목표가 한 번이라도 올라온 사업부: {sorted(measured) or "(없음)"}')
        info('위 목록과 「KPI 보유」 표시가 일치해야 한다.')

        # 6. 대상이 보유 사업부를 가리키는가 ---------------------------------
        print('\n6. 연결의 대상')
        if n_link:
            bad = db.session.execute(text("""
                select l.target_division, count(*)
                  from dt2_project_kpi l
                  left join divisions d
                    on d.name = l.target_division and d.is_active
                 where coalesce(l.target_division,'') <> ''
                   and (d.id is null or d.is_kpi_owner = false)
                 group by 1
            """)).all()
            check('모든 연결이 KPI 보유 사업부를 가리킨다',
                  not bad, f'{[(b[0], b[1]) for b in bad]}')
            if bad:
                info('5번에서 사업부 구분이 틀렸을 때 같이 나타난다. 5번을 먼저 고친다.')
        else:
            info('연결이 없어 확인할 것이 없다. (신규 도입이면 정상)')

        # 마무리 ------------------------------------------------------------
        n_proj = db.session.execute(text(
            'select count(*) from dt2_projects where is_deleted = false '
            'and is_permanently_deleted = false')).scalar()
        print('\n7. 화면과 맞춰볼 숫자 (종이에 적어 둘 것)')
        info(f'활성 과제 {n_proj}건 · DX KPI 지표 {n_def}개 · 연결 {n_link}건')
        info(f'매트릭스 열이 될 사업부 {len(owners)}개: {", ".join(owners)}')
        info(f'기능조직 {len(funcs)}개: {", ".join(funcs) or "(없음)"}')

        failed = [d for d, ok in results if not ok]
        print('\n' + '=' * 72)
        if failed:
            print(f' 결과: [FAIL] {len(failed)}건 — 런북의 「막혔을 때」를 본다')
            for d in failed:
                print(f'   - {d}')
            print('=' * 72)
            sys.exit(1)
        print(f' 결과: [OK] {len(results)}/{len(results)} — 화면 확인으로 넘어가도 됩니다.')
        print('=' * 72)


if __name__ == '__main__':
    main()
