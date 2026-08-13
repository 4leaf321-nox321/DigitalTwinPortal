# Windows 배포 가이드 (간단)

요약: GitHub Release에서 제공되는 `deploy_package.zip`은 서버에 바로 올려 풀어 실행할 수 있는 패키지입니다. 패키지 구조는 `backend/`, optional `mcp_server/`, `site-packages/`, `run_server.ps1` 템플릿으로 구성됩니다.

사전조건 (운영서버)
- 동일한 Python 메이저/마이너 버전(예: 3.11) 설치
- 필요한 포트 허용 및 Windows 서비스 권한

배포 절차
1. 릴리스에서 `deploy_package.zip` 다운로드
2. 서버 대상 폴더로 업로드 후 압축 해제
   - 예: `C:\apps\digital-twin`로 압축 해제
3. (선택) `run_server.ps1`을 편집하여 실제 엔트리포인트(`backend\run.py` 등)가 맞는지 확인
4. 서버에서 PowerShell로 다음 실행

```powershell
cd C:\apps\digital-twin
.\run_server.ps1
```

서비스로 등록하려면(권장)
- NSSM 또는 Windows 서비스 래퍼를 사용해 `python C:\apps\digital-twin\backend\run.py`를 서비스로 등록

주의
- 배포 패키지는 `site-packages`에 의존성을 포함합니다. Python의 정확한 버전(특히 Windows용 바이너리 휠 호환성)을 맞춰야 합니다. 만약 배포 이후 의존성 변경이 잦다면, 릴리스 프로세스에서 `deploy_package.zip`을 재생성해야 합니다.
