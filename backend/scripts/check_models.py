"""모든 모델을 불러와 SQLAlchemy 매퍼가 설정되는지 확인한다.

**DB 가 필요 없다.** 순수하게 ORM 메타데이터만 본다. 그래서 CI 에서 돌릴 수 있다.

── 왜 있나 ──────────────────────────────────────────────────────────────────
2026-08-15, 전략 모듈에 `Survey`·`SurveyQuestion` 을 추가했는데 그 이름이
collaboration_board 에 이미 있었다. 같은 declarative base 라서 관계 문자열
'SurveyQuestion' 이 모호해지고, **매퍼 설정이 실패해 모든 DB 질의가 죽었다.**

그런데 그게 릴리스까지 나갔다. 이유가 셋이다.

  · 마이그레이션 생성·적용은 매퍼를 완전히 설정하지 않아 통과했다
  · 표 존재 확인(inspect)도 매퍼를 안 건드린다
  · CI 는 backend\tests 가 없어 pytest 를 통째로 건너뛰고 있었다

즉 **모델을 고쳤는데 질의를 한 번도 안 해보면 아무도 모른다.** 이 스크립트가
그 구멍을 막는다. 잡아내는 것:

  · 클래스 이름 충돌 (모듈이 달라도 base 가 같으면 충돌한다)
  · 관계 문자열이 가리키는 대상이 없는 경우
  · FK 가 없는 표를 가리키는 경우
  · 표 이름 중복

⚠️ 새 모델을 추가할 때는 이름을 모듈 접두어로 짓는 편이 안전하다
   (`StrategySurvey`, `Dt2Project` 처럼). 짧은 일반명은 언젠가 부딪힌다.
"""
import importlib
import os
import pkgutil
import sys

# 콘솔 코드페이지와 무관하게 한글을 찍는다.
#
# GitHub 러너의 stdout 은 cp1252 라 한글에서 UnicodeEncodeError 로 죽는다.
# 그러면 **검사가 통과했는지 실패했는지가 아니라 출력이 CI 를 빨갛게 만든다.**
# errors='replace' 까지 두는 이유는, 렌더가 안 되더라도 검사 결과는 나와야
# 하기 때문이다.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding='utf-8', errors='replace')
    except (AttributeError, ValueError):
        pass

# backend/ 를 import 경로에 넣는다. scripts/ 안에서 실행되므로 한 단계 위다.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


def load_all_models():
    """app 아래의 모든 models 모듈을 불러온다.

    create_app() 을 부르지 않는다 — 그러면 DATABASE_URL 이 필요해지고, 이
    검사는 DB 없이 돌아야 한다.
    """
    import app as app_pkg

    loaded, failed = [], []
    for mod in pkgutil.walk_packages(app_pkg.__path__, prefix='app.'):
        name = mod.name.rsplit('.', 1)[-1]
        if not (name == 'models' or name.startswith('models_')):
            continue
        try:
            importlib.import_module(mod.name)
            loaded.append(mod.name)
        except Exception as e:                      # noqa: BLE001
            failed.append((mod.name, e))
    return loaded, failed


def main():
    loaded, failed = load_all_models()
    print(f'[check_models] 모델 모듈 {len(loaded)}개 로드')

    if failed:
        print('[check_models] 불러오지 못한 모듈:')
        for name, err in failed:
            print(f'  - {name}: {err}')
        return 1

    from sqlalchemy.orm import configure_mappers
    from app.extensions import db

    try:
        configure_mappers()
    except Exception as e:                          # noqa: BLE001
        print(f'[check_models] 매퍼 설정 실패: {e}')
        print('  이 상태로 배포하면 DB 질의가 전부 죽는다.')
        return 1

    mappers = list(db.Model.registry.mappers)
    print(f'[check_models] 매퍼 {len(mappers)}개 설정 완료')

    # 표 이름이 겹치면 나중 것이 앞의 것을 덮어써서 조용히 사라진다.
    seen = {}
    dupes = []
    for m in mappers:
        table = m.class_.__tablename__
        if table in seen and seen[table] is not m.class_:
            dupes.append((table, seen[table].__name__, m.class_.__name__))
        seen[table] = m.class_
    if dupes:
        print('[check_models] 표 이름이 겹친다:')
        for table, a, b in dupes:
            print(f'  - {table}: {a} vs {b}')
        return 1

    print('[check_models] OK')
    return 0


if __name__ == '__main__':
    sys.exit(main())
