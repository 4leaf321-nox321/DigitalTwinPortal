"""
운영 반입 직후 · 서버 켜기 **전** 점검 (읽기 전용).

왜 필요한가
    이 프로젝트는 **폴더를 통째로 압축해 운영으로 옮겨** 배포한다. 그래서 개발에서만
    맞아야 할 것들이 같이 따라갈 수 있다. 특히 위험한 둘:

      backend/.env    개발 것이 덮어쓰면 **운영이 개발 DB를 보거나**,
                      `DT2_WRITE_ENABLED=true` 가 따라가 **컷오버 전에 V2 쓰기가 열린다.**
                      그러면 V1 이 정본인데 dt2 만 앞서가 데이터가 갈라진다.
                      `FLASK_ENV=development` 가 따라가면 시험용 쓰기 우회 헤더까지 열린다.

      frontend/dist   운영에서는 빌드하지 않는다(권한 오류로 부분 실패하면 index.html 이
                      없는 CSS 를 가리키고 SPA 폴백이 200 을 돌려줘 **에러 없이 화면만
                      깨진다**). dist 가 온전한지 확인해야 한다.

    배포 순서는 **폴더를 풀고 → backend 에서 `flask db upgrade` → 기동** 이다.
    그래서 이 점검은 **upgrade 를 돌린 뒤, 켜기 직전**에 하는 것이 가장 유용하다.
    upgrade 전에 돌리면 마이그레이션 항목이 걸리는데, 그건 정상이고 올린 뒤 다시 돌리면 된다.

반출 안전
    **숫자·이름·판정만** 출력한다. 비밀값은 길이만, DSN 은 가려서 찍는다.
    결과를 그대로 복사해 와도 된다.

사용법
    python scripts\\dt3_preflight.py                # 컷오버 **전** 기준 (기본)
    python scripts\\dt3_preflight.py --cutover      # 컷오버 시점 기준
                                                    #   (쓰기 스위치가 켜져 있어야 정상)
"""

from __future__ import annotations

import argparse
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
ROOT = os.path.dirname(BACKEND)

sys.path.insert(0, HERE)

try:
    import psycopg
except ImportError:
    print('[FAIL] psycopg 를 찾을 수 없습니다. venv 를 활성화했는지 확인하세요.')
    sys.exit(1)

try:
    from dt_scan import mask_dsn, normalize_dsn
except ImportError:
    print('[FAIL] dt_scan.py 를 같은 폴더에서 찾을 수 없습니다.')
    sys.exit(1)

# 개발 기본값 — config.py 에 박혀 있는 것들. 운영에 이게 있으면 안 된다.
DEV_MARKERS = {
    'SECRET_KEY': 'dev-secret-key-change-in-production',
    'JWT_SECRET_KEY': 'jwt-secret-key-change-in-production',
}
DEV_DSN_HINT = 'postgres:32167@localhost'      # config.py 의 개발 기본 DSN

# models_v2.py 의 __tablename__ 과 같아야 한다. 개수로 세지 않고 **이름으로** 본다 —
# 개수는 테이블이 늘 때마다 틀린 값이 되고, 무엇이 빠졌는지도 못 알려준다.
EXPECTED_DT2_TABLES = {
    'dt2_projects', 'dt2_performances', 'dt2_project_performance',
    'dt2_project_dependencies', 'dt2_project_attachments', 'dt2_project_editors',
    'dt2_performance_history', 'dt2_project_history', 'dt2_project_changes',
    'dt2_change_proposals',
}

results = []


def check(desc, ok, extra=''):
    results.append((desc, bool(ok)))
    print(f"  {'[OK]  ' if ok else '[FAIL]'} {desc}" + (f'   {extra}' if not ok and extra else ''))


def note(desc, value):
    print(f'  [정보] {desc}: {value}')


def read_env(path):
    """.env 를 읽는다. dotenv 없이도 돌아야 한다(운영에 패키지가 없을 수 있다)."""
    values = {}
    if not os.path.exists(path):
        return values
    with open(path, 'r', encoding='utf-8-sig', errors='replace') as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            key, _, val = line.partition('=')
            values[key.strip()] = val.strip()
    return values


def truthy(v):
    return (v or '').strip().lower() in ('1', 'true', 'yes', 'on')


def code_migration_head():
    """
    코드가 가진 마이그레이션의 끝(head)을 찾는다.

    다른 리비전의 down_revision 으로 지목되지 않은 리비전이 head 다.
    파일 수정시각으로 판단하면 안 된다 — 압축·복사하면 시각이 다 바뀐다.

    ⚠️ **병합 리비전은 down_revision 이 튜플**이다
       (`17ca79b15ca6_merge_multiple_heads.py`: `('add_achievement_type', 'fbc50a1929a2')`).
       문자열만 읽으면 그 두 부모가 '아무도 안 가리키는 것' 으로 남아 head 가 3개로
       잡힌다 — 실제로는 하나뿐인데 "브랜치가 갈렸다" 는 오진이 나온다.

    반환: (head 또는 None, 리비전 수, head 후보 목록)
    """
    vdir = os.path.join(BACKEND, 'migrations', 'versions')
    if not os.path.isdir(vdir):
        return None, 0, []
    revs, downs = set(), set()
    for name in os.listdir(vdir):
        if not name.endswith('.py'):
            continue
        with open(os.path.join(vdir, name), 'r', encoding='utf-8', errors='replace') as fh:
            text = fh.read()
        m = re.search(r"^revision\s*=\s*['\"]([^'\"]+)['\"]", text, re.M)
        if m:
            revs.add(m.group(1))
        d = re.search(r"^down_revision\s*=\s*['\"]([^'\"]+)['\"]", text, re.M)
        if d:
            downs.add(d.group(1))
        t = re.search(r"^down_revision\s*=\s*\(([^)]*)\)", text, re.M)
        if t:
            for parent in re.findall(r"['\"]([^'\"]+)['\"]", t.group(1)):
                downs.add(parent)
    heads = sorted(revs - downs)
    return (heads[0] if len(heads) == 1 else None), len(revs), heads


def count_files(path):
    if not os.path.isdir(path):
        return None
    return sum(len(files) for _, _, files in os.walk(path))


def main():
    ap = argparse.ArgumentParser(description='운영 반입 점검 (읽기 전용)')
    ap.add_argument('--cutover', action='store_true',
                    help='컷오버 시점 기준으로 본다 (쓰기 스위치가 켜져 있어야 정상)')
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    print('=' * 72)
    print(' 운영 반입 점검 — 서버를 켜기 **전에** 돌린다 (읽기 전용)')
    print('=' * 72)
    print(f' 기준 : {"컷오버 시점" if args.cutover else "컷오버 전 (기본)"}')
    print(f' 위치 : {ROOT}')

    env_path = os.path.join(BACKEND, '.env')
    env = read_env(env_path)

    # ── 1. 환경 설정 ────────────────────────────────────────────────────
    print('\n── 1. 환경 설정 (backend/.env) ──')
    check('.env 가 있다', bool(env), f'{env_path} 없음')
    if not env:
        print('\n 결과: [FAIL] .env 가 없어 더 볼 수 없습니다.')
        return 1

    flask_env = env.get('FLASK_ENV', '')
    check("FLASK_ENV=production", flask_env == 'production',
          f'실제 {flask_env!r} — development 면 디버그·SQL에코가 켜지고 '
          f'시험용 쓰기 우회 헤더까지 열린다')

    write_on = truthy(env.get('DT2_WRITE_ENABLED'))
    if args.cutover:
        check('★ DT2_WRITE_ENABLED 가 켜져 있다 (컷오버)', write_on,
              '컷오버하려면 true 여야 한다')
    else:
        check('★ DT2_WRITE_ENABLED 가 꺼져 있다',
              not write_on,
              '켜져 있으면 컷오버 전인데 V2 쓰기가 열리고 v2_sync 가 멈춘다 — '
              '데이터가 갈라진다')

    for key, dev_value in DEV_MARKERS.items():
        v = env.get(key, '')
        check(f'{key} 가 개발 기본값이 아니다', v and v != dev_value,
              '개발 기본값 그대로다')
        note(f'{key} 길이', len(v))

    dsn_raw = env.get('DATABASE_URL', '')
    check('DATABASE_URL 이 있다', bool(dsn_raw))
    check('시험용 DB 를 가리키지 않는다', '_test' not in dsn_raw,
          'TEST_DATABASE_URL 을 잘못 넣었을 수 있다')
    check('개발 기본 DSN 이 아니다', DEV_DSN_HINT not in dsn_raw,
          '개발 .env 가 그대로 따라온 것으로 보인다')
    if dsn_raw:
        note('DATABASE_URL', mask_dsn(normalize_dsn(dsn_raw)))

    # ── 1-2. 화면 기본값 ────────────────────────────────────────────────
    #
    # 스위치가 셋인데 위치가 다르다. 여기서 보는 건 **화면 소스**의 기본값이다.
    #   서버   backend/.env 의 DT2_WRITE_ENABLED       (위에서 확인)
    #   화면   settingsApi.js 의 DEFAULT_V2_READ/WRITE (여기)
    #   개인   브라우저 localStorage (URL 파라미터로 켜는 것) — 점검 대상 아님
    print('\n── 1-2. 화면 기본값 (frontend/src/.../settingsApi.js) ──')
    api_js = os.path.join(ROOT, 'frontend', 'src', 'modules', 'digital-twin-dashboard',
                          'services', 'settingsApi.js')
    if not os.path.exists(api_js):
        check('settingsApi.js 를 찾을 수 있다', False, api_js)
    else:
        with open(api_js, 'r', encoding='utf-8', errors='replace') as fh:
            src = fh.read()
        for const in ('DEFAULT_V2_READ', 'DEFAULT_V2_WRITE'):
            m = re.search(rf'const\s+{const}\s*=\s*(true|false)', src)
            if not m:
                check(f'{const} 를 읽을 수 있다', False, '선언 형태가 바뀌었다')
                continue
            value = (m.group(1) == 'true')
            if args.cutover:
                check(f'★ {const} 가 true 다 (컷오버)', value,
                      '컷오버 배포에는 true 여야 한다')
            else:
                check(f'★ {const} 가 false 다', not value,
                      '리허설 후 되돌리는 것을 잊은 것으로 보인다')
        note('한계', '이건 **소스** 기준이다 — 값을 바꿨다면 dist 를 다시 빌드해야 실제로 바뀐다')

    # ── 2. 빌드 자산 ────────────────────────────────────────────────────
    print('\n── 2. 화면 빌드 (frontend/dist) — 운영에서 빌드하지 않는다 ──')
    dist = os.path.join(ROOT, 'frontend', 'dist')
    index = os.path.join(dist, 'index.html')
    check('dist/index.html 이 있다', os.path.exists(index), f'{dist} 확인')
    if os.path.exists(index):
        with open(index, 'r', encoding='utf-8', errors='replace') as fh:
            html = fh.read()
        refs = re.findall(r'(?:src|href)="(/assets/[^"]+)"', html)
        missing = [r for r in refs
                   if not os.path.exists(os.path.join(dist, r.lstrip('/')))]
        check(f'index.html 이 가리키는 자산 {len(refs)}개가 모두 있다', not missing,
              f'없는 파일: {missing[:3]}')
        note('dist 파일 수', count_files(dist))

    # ── 3. 데이터베이스 ─────────────────────────────────────────────────
    print('\n── 3. 데이터베이스 ──')
    head, n_migrations, head_list = code_migration_head()
    note('코드의 마이그레이션 수', n_migrations)
    check('코드의 마이그레이션 head 가 하나다', bool(head),
          f'후보 {head_list} — 브랜치가 갈렸다면 merge 리비전이 필요하다')
    if head:
        note('코드 head', head)

    conn = None
    try:
        conn = psycopg.connect(normalize_dsn(dsn_raw))
    except Exception as exc:
        check('DB 에 접속된다', False, f'{type(exc).__name__}: {exc}')

    if conn is not None:
        check('DB 에 접속된다', True)
        try:
            cur = conn.cursor()
            cur.execute("SELECT version_num FROM alembic_version")
            db_head = (cur.fetchone() or [None])[0]
            note('DB head', db_head)
            # 배포 순서는 **backend 에서 `flask db upgrade` 를 돌린 뒤 기동**이다.
            # 이 점검을 upgrade 전에 돌리면 여기서 걸리는 게 정상 — 올리고 다시 돌리면 된다.
            check('★ DB 마이그레이션이 코드와 같다', bool(head) and db_head == head,
                  f'코드 {head} / DB {db_head} → backend 에서 `flask db upgrade` 후 다시 점검')

            cur.execute("""
                SELECT table_name FROM information_schema.tables
                 WHERE table_schema='public' AND table_name LIKE 'dt2_%%'
            """)
            db_tables = {r[0] for r in cur.fetchall()}
            missing = sorted(EXPECTED_DT2_TABLES - db_tables)
            check(f'dt2_* 테이블 {len(EXPECTED_DT2_TABLES)}개가 모두 있다', not missing,
                  f'없는 것: {missing}')
            extra = sorted(db_tables - EXPECTED_DT2_TABLES)
            if extra:
                note('코드에 없는 dt2 테이블', extra)

            for label, sql in [
                ('과제(영구삭제 제외)',
                 "SELECT count(*) FROM dt2_projects WHERE is_permanently_deleted=false"),
                ('성과(삭제 제외)',
                 "SELECT count(*) FROM dt2_performances WHERE is_deleted=false"),
                ('연결', "SELECT count(*) FROM dt2_project_performance"),
            ]:
                try:
                    cur.execute(sql)
                    note(label, cur.fetchone()[0])
                except Exception:
                    conn.rollback()
                    note(label, '조회 실패')

            cur.execute("SELECT count(*), max(version) FROM dashboard_data")
            n_head, v_head = cur.fetchone()
            note('dashboard_data 행/version', f'{n_head} / {v_head}')
        finally:
            conn.close()

    # ── 4. 개발 잔재 ────────────────────────────────────────────────────
    print('\n── 4. 개발 잔재 · 별도 이관 대상 ──')
    out_n = count_files(os.path.join(BACKEND, 'scripts', 'out'))
    if out_n:
        note('scripts/out 로그 파일', f'{out_n}개 — 개발에서 딸려온 것. 지워도 된다')
    up_n = count_files(os.path.join(BACKEND, 'uploads'))
    note('uploads 파일', f'{up_n}개' if up_n is not None else '폴더 없음 — 별도 이관 필요')
    nm = os.path.join(ROOT, 'frontend', 'node_modules')
    if os.path.isdir(nm):
        note('frontend/node_modules', '있음 — 운영은 빌드하지 않으므로 없어도 된다')

    ok = sum(1 for _, c in results if c)
    bad = len(results) - ok
    print('\n' + '=' * 72)
    if bad:
        print(f' 결과: [FAIL] {bad}건 — **서버를 켜기 전에 고치세요.**')
        for desc, c in results:
            if not c:
                print(f'        · {desc}')
    else:
        print(f' 결과: [OK] {ok}/{len(results)} — 켜도 됩니다.')
    print('=' * 72)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
