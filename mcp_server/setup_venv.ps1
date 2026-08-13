# ========================================
#  MCP 서버 가상환경 설정 (PowerShell)
#
#  인터넷이 없는 곳에서도 된다 — `packages` 폴더의 wheel 만 쓴다(`--no-index`).
#  backend\setup_venv.ps1 과 같은 방식이고, DB·.env 단계가 없을 뿐이다.
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MCP Server Virtual Environment Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Python 확인
Write-Host "[Step 1/4] Python 버전 확인..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host $pythonVersion -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "[!] Python 을 찾을 수 없습니다." -ForegroundColor Red
    Write-Host "    Python 3.13 을 설치해 주세요 (백엔드와 같은 버전)." -ForegroundColor Red
    Read-Host "계속하려면 Enter 키를 누르세요"
    exit 1
}

# Step 2: 가상환경 생성
Write-Host "[Step 2/4] 가상환경 생성 중..." -ForegroundColor Yellow
if (Test-Path "venv") {
    Write-Host "[!] venv 폴더가 이미 있습니다." -ForegroundColor Yellow
    $recreate = Read-Host "삭제하고 새로 만들까요? (y/n)"
    if ($recreate -eq "y" -or $recreate -eq "Y") {
        Remove-Item -Recurse -Force venv
        python -m venv venv
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[!] 가상환경 생성 실패" -ForegroundColor Red
            Read-Host "계속하려면 Enter 키를 누르세요"
            exit 1
        }
        Write-Host "[OK] 새로 만들었습니다." -ForegroundColor Green
    } else {
        Write-Host "[*] 기존 가상환경을 씁니다." -ForegroundColor Cyan
    }
} else {
    python -m venv venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!] 가상환경 생성 실패" -ForegroundColor Red
        Read-Host "계속하려면 Enter 키를 누르세요"
        exit 1
    }
    Write-Host "[OK] 가상환경을 만들었습니다." -ForegroundColor Green
}
Write-Host ""

# Step 3: 패키지 설치 (오프라인)
Write-Host "[Step 3/4] 패키지 설치 중 (인터넷 사용 안 함)..." -ForegroundColor Yellow
if (-not (Test-Path "packages")) {
    Write-Host "[!] packages 폴더가 없습니다." -ForegroundColor Red
    Write-Host "    반입할 때 mcp_server\packages 가 빠진 것입니다." -ForegroundColor Red
    Write-Host "    온라인 PC 에서 다시 만들려면 mcp_server\README.md 의 '번들 다시 만들기' 참고." -ForegroundColor Yellow
    Read-Host "계속하려면 Enter 키를 누르세요"
    exit 1
}

venv\Scripts\python.exe -m pip install --no-index --find-links=packages -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[!] 패키지 설치 실패" -ForegroundColor Red
    Write-Host "    Python 이 3.13 인지 확인해 주세요 — wheel 이 cp313 용입니다." -ForegroundColor Red
    Write-Host "    python --version" -ForegroundColor Yellow
    Read-Host "계속하려면 Enter 키를 누르세요"
    exit 1
}
Write-Host "[OK] 설치 완료" -ForegroundColor Green
Write-Host ""

# Step 4: 실제로 뜨는지 확인
#
# ⚠️ 여기서 `mcp.server.fastmcp` 를 확인하는 이유 — mcp 2.0 에서 그 모듈이 **사라졌다.**
#    번들이 어쩌다 2.x 로 채워지면 설치는 멀쩡히 끝나고 **띄울 때 비로소 깨진다.**
Write-Host "[Step 4/4] 기동 확인..." -ForegroundColor Yellow
venv\Scripts\python.exe -c "from mcp.server.fastmcp import FastMCP; from importlib.metadata import version; import server; print('  mcp ' + version('mcp') + ' | httpx ' + version('httpx') + ' | 도구 ' + str(len(server.mcp._tool_manager.list_tools())) + '개')"
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[!] 기동 확인 실패." -ForegroundColor Red
    Write-Host "    mcp.server.fastmcp 가 없다면 mcp 가 2.x 로 깔린 것입니다" -ForegroundColor Red
    Write-Host "    (requirements.txt 는 1.x 로 고정돼 있습니다)." -ForegroundColor Red
    Read-Host "계속하려면 Enter 키를 누르세요"
    exit 1
}
Write-Host "[OK] 기동 확인 완료" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "실행:" -ForegroundColor Yellow
Write-Host "  set DT_API_BASE=http://localhost:5174" -ForegroundColor Cyan
Write-Host "  venv\Scripts\python.exe server.py" -ForegroundColor Cyan
Write-Host ""
Write-Host "주의: DT 백엔드가 떠 있어야 합니다. 이 서버는 그 REST API 를 부르는 대리인입니다." -ForegroundColor Yellow
Write-Host "      콘솔 창을 닫으면 죽습니다 — 상시 기동 방법은 아직 안 정했습니다." -ForegroundColor Yellow
Write-Host ""
Read-Host "계속하려면 Enter 키를 누르세요"
