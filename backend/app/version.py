"""포털 버전 — **어느 릴리스가 돌고 있나.**

왜 필요한가
    화면 어디에도 버전이 없어서 「지금 도는 게 어느 릴리스냐」에 답할 방법이
    없었다(2026-08-22 신고). 더 중요한 것은 **백엔드와 프론트가 어긋난 것을
    못 잡는다**는 점이다 — 반출 체크리스트가 「백엔드ㆍ프론트를 함께 올린다.
    구 프론트 + 신 백엔드는 저장이 400 이 된다」고 적어 두었는데, 어긋났는지를
    화면에서 볼 길이 없으면 그 400 의 원인을 한참 찾게 된다.

정본은 어디인가
    **`frontend/package.json` 의 `version` 하나다.** 릴리스 자동화(auto-tag)가
    그 값으로 태그를 만들므로, 다른 곳에 또 적으면 반드시 갈린다.

    ⚠️ 그런데 배포 묶음에는 `package.json` 이 안 들어간다(빌드 결과만 들어간다).
       그래서 묶을 때 그 값을 `VERSION` 파일로 **떠서 함께 넣는다**
       (`.github/workflows/release-windows.yml`). 여기서는 그 파일을 읽는다.

    ⚠️ 개발에서는 `VERSION` 이 없다. 그때는 `frontend/package.json` 을 직접
       읽는다 — 개발자가 파일을 따로 만들어 두지 않아도 화면에 값이 뜬다.

⚠️ **읽기는 한 번만 하고 기억한다.** 매 요청마다 파일을 여는 값이 아니다.
   배포로 파일이 바뀌면 어차피 프로세스가 새로 뜬다.
"""
from __future__ import annotations

import json
import os

_UNKNOWN = 'unknown'
_cached = None


def _read_version_file(root: str):
    path = os.path.join(root, 'VERSION')
    try:
        with open(path, encoding='utf-8') as f:
            value = f.read().strip()
        return value or None
    except OSError:
        return None


def _read_package_json(repo_root: str):
    path = os.path.join(repo_root, 'frontend', 'package.json')
    try:
        with open(path, encoding='utf-8') as f:
            return (json.load(f).get('version') or '').strip() or None
    except (OSError, ValueError):
        return None


def app_version() -> str:
    """돌고 있는 서버의 버전. 알 수 없으면 `'unknown'`.

    ⚠️ 못 읽었을 때 **빈 문자열이나 '0.0.0' 을 내지 않는다.** 둘 다 「버전이
       이것이다」로 읽히는데, 실제로는 「모른다」다. 화면이 그 둘을 구분해서
       보여줄 수 있어야 한다.
    """
    global _cached
    if _cached is not None:
        return _cached

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    repo_root = os.path.dirname(backend_dir)

    _cached = (_read_version_file(backend_dir)      # 배포 묶음 안
               or _read_version_file(repo_root)     # 저장소 뿌리에 둔 경우
               or _read_package_json(repo_root)     # 개발 — 정본을 직접 읽는다
               or _UNKNOWN)
    return _cached
