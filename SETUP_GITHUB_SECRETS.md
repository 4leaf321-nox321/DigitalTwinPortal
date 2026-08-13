## GitHub Actions용 시크릿 설정 안내

이 문서는 이 저장소에서 사용하는 GitHub Actions 워크플로(릴리스 업로드 등)에 필요한 시크릿과 설정 방법을 정리합니다.

권장 시크릿
- `PUBLISH_PAT`: 릴리스를 만들고 아티팩트를 업로드할 때 사용하는 Personal Access Token. `repo` 권한(또는 최소한 `repo:status`, `repo_deployment`, `public_repo`, `repo:invite`)이 필요합니다.
- `MCP_PAT`: MCP(모듈/패키지) 업로드, 내부 API 호출 등 별도 권한이 필요한 경우 사용하는 토큰입니다. 필요한 권한은 사용하는 MCP 엔드포인트에 따라 다릅니다.

설정 방법
1. GitHub에서 개인 액세스 토큰(PAT)을 생성합니다: `Settings > Developer settings > Personal access tokens`.
2. 토큰 생성 시 필요한 범위를 체크합니다(예: `repo`).
3. 저장소의 `Settings > Secrets and variables > Actions`로 이동합니다.
4. `New repository secret`을 클릭하고 이름(`PUBLISH_PAT` 등)과 값(PAT)을 입력 후 저장합니다.

워크플로에서 사용하기
예: `.github/workflows/release-windows.yml`에서 아래와 같이 사용합니다.

```yaml
env:
  PUBLISH_TOKEN: ${{ secrets.PUBLISH_PAT }}
```

주의사항
- 시크릿은 저장된 후에도 평문으로 볼 수 없습니다. 잘못된 값을 수정하려면 새 시크릿을 추가하세요.
- 시크릿을 로컬에 저장하거나 커밋하지 마세요.

다음 단계
- 제가 이 시크릿을 직접 등록하려면 해당 저장소를 관리할 수 있는 PAT(또는 `gh` CLI 인증)이 필요합니다. 원하시면 절차 안내 또는 자동 등록을 위한 스크립트를 제공하겠습니다.
