"""
마이그레이션 이력이 꼬였는지 점검한다. **읽기 전용** — 아무것도 고치지 않는다.

여러 세션·여러 사람이 동시에 마이그레이션을 만들면 조용히 갈라진다.
`flask db heads` 는 지금 끝이 몇 개인지만 말해 주므로, 그 사이에 있었던
갈라짐·합침·유실은 보이지 않는다. 여기서는 그 흔적을 본다.

보는 것
  1  head 가 몇 개인가 (2개 이상 = 지금 갈라져 있음)
  2  분기점 — 같은 부모를 가진 리비전이 둘 이상 (과거에 갈라졌던 자리)
  3  merge 리비전 — 갈라졌다가 합친 흔적
  4  끊긴 참조 — down_revision 이 가리키는 파일이 없음 (파일 유실·이름 변경)
  5  DB 가 기록한 리비전이 파일에 있는가 (없으면 적용된 파일이 사라진 것)
  6  DB 의 alembic_version 행이 2개 이상인가 (갈라진 채로 적용됨)
  7  파일 생성 시각 순서 ↔ 체인 순서 (뒤바뀌면 나중 것이 앞에 끼어든 것)

실행:  venv/Scripts/python.exe scripts/dt3_check_migrations.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from alembic.config import Config                                    # noqa: E402
from alembic.script import ScriptDirectory                           # noqa: E402
from sqlalchemy import text                                          # noqa: E402

from app import create_app                                           # noqa: E402
from app.extensions import db                                        # noqa: E402


def main():
    app = create_app()
    with app.app_context():
        cfg = Config(os.path.join(os.path.dirname(os.path.dirname(
            os.path.abspath(__file__))), 'migrations', 'alembic.ini'))
        cfg.set_main_option('script_location', os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'migrations'))
        script = ScriptDirectory.from_config(cfg)

        revs = {r.revision: r for r in script.walk_revisions('base', 'heads')}
        print(f'마이그레이션 파일: {len(revs)}개\n')

        # 1 head
        heads = script.get_heads()
        print(f'[1] head {len(heads)}개: {", ".join(heads)}')
        if len(heads) > 1:
            print('    ⚠️ 지금 갈라져 있다. flask db upgrade 가 멈춘다.')

        # 2 분기점 — 같은 부모를 둘 이상이 가리킨다
        children = {}
        for r in revs.values():
            for down in (r.down_revision if isinstance(r.down_revision, tuple)
                         else ([r.down_revision] if r.down_revision else [])):
                children.setdefault(down, []).append(r.revision)
        forks = {k: v for k, v in children.items() if len(v) > 1}
        print(f'[2] 분기점 {len(forks)}곳')
        for parent, kids in forks.items():
            print(f'    {parent} 에서 갈라짐 → {", ".join(kids)}')

        # 3 merge
        merges = [r.revision for r in revs.values() if isinstance(r.down_revision, tuple)]
        print(f'[3] merge 리비전 {len(merges)}개' + (f': {", ".join(merges)}' if merges else ''))

        # 4 끊긴 참조
        broken = []
        for r in revs.values():
            downs = (r.down_revision if isinstance(r.down_revision, tuple)
                     else ([r.down_revision] if r.down_revision else []))
            for d in downs:
                if d not in revs:
                    broken.append((r.revision, d))
        print(f'[4] 끊긴 참조 {len(broken)}건')
        for rev, missing in broken:
            print(f'    ⚠️ {rev} 의 down_revision={missing} 파일이 없다')

        # 5·6 DB 쪽
        rows = db.session.execute(text('SELECT version_num FROM alembic_version')).fetchall()
        applied = [r[0] for r in rows]
        print(f'[5] DB 기록: {", ".join(applied) if applied else "(비어 있음)"}')
        for a in applied:
            if a not in revs:
                print(f'    ⚠️ {a} 에 해당하는 파일이 없다 — 적용된 마이그레이션이 사라졌다')
        print(f'[6] alembic_version 행 {len(applied)}개'
              + ('  ⚠️ 갈라진 채 적용됨' if len(applied) > 1 else ''))

        # 7 파일 시각 ↔ 체인 순서
        chain = list(script.walk_revisions('base', 'heads'))[::-1]   # 옛것 → 새것
        out_of_order = []
        prev_rev, prev_t = None, None
        for r in chain:
            try:
                t = os.path.getmtime(r.path)
            except OSError:
                continue
            if prev_t is not None and t < prev_t:
                out_of_order.append((prev_rev, r.revision))
            prev_rev, prev_t = r.revision, t
        print(f'[7] 체인 순서보다 파일이 오래된 곳 {len(out_of_order)}곳')
        for a, b in out_of_order:
            print(f'    {a} 뒤에 {b} 가 오는데 파일 시각은 반대다')

        print()
        bad = (len(heads) > 1) or broken or len(applied) > 1 or \
              any(a not in revs for a in applied)
        if bad:
            print('=> 손볼 곳이 있다 (위 ⚠️ 참고)')
            sys.exit(1)
        if forks or merges:
            print('=> 지금은 정상. 과거에 갈라졌다 합친 흔적은 있다 ([2]·[3] 참고)')
        else:
            print('=> 정상. 한 줄로 이어져 있고 갈라진 적이 없다')


if __name__ == '__main__':
    main()
