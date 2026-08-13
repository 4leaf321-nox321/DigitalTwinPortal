# ========================================
# Backend 가상환경 자동 설정 스크립트 (PowerShell)
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Backend Virtual Environment Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Python 버전 확인
Write-Host "[Step 1/4] Python 버전 확인..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host $pythonVersion -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "[!] Python을 찾을 수 없습니다." -ForegroundColor Red
    Write-Host "    Python 3.13을 설치해주세요." -ForegroundColor Red
    Read-Host "계속하려면 Enter 키를 누르세요"
    exit 1
}

# Step 2: 가상환경 생성
Write-Host "[Step 2/4] 가상환경 생성 중..." -ForegroundColor Yellow
if (Test-Path "venv") {
    Write-Host "[!] venv 폴더가 이미 존재합니다." -ForegroundColor Yellow
    Write-Host ""
    $recreate = Read-Host "기존 가상환경을 삭제하고 새로 생성하시겠습니까? (y/n)"
    if ($recreate -eq "y" -or $recreate -eq "Y") {
        Write-Host "    기존 venv 삭제 중..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force venv
        Write-Host "    새 가상환경 생성 중..." -ForegroundColor Yellow
        python -m venv venv
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[!] 가상환경 생성 실패" -ForegroundColor Red
            Read-Host "계속하려면 Enter 키를 누르세요"
            exit 1
        }
        Write-Host "[OK] 가상환경이 생성되었습니다." -ForegroundColor Green
    } else {
        Write-Host "[*] 기존 가상환경을 사용합니다." -ForegroundColor Cyan
    }
} else {
    Write-Host "    가상환경 생성 중..." -ForegroundColor Yellow
    python -m venv venv
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[!] 가상환경 생성 실패" -ForegroundColor Red
        Read-Host "계속하려면 Enter 키를 누르세요"
        exit 1
    }
    Write-Host "[OK] 가상환경이 생성되었습니다." -ForegroundColor Green
}
Write-Host ""

# Step 3: 가상환경 활성화 및 pip 업그레이드
Write-Host "[Step 3/4] pip 업그레이드..." -ForegroundColor Yellow
& "venv\Scripts\Activate.ps1"
python -m pip install --upgrade pip --no-index --find-links=packages 2>$null
Write-Host "[OK] pip 준비 완료" -ForegroundColor Green
Write-Host ""

# Step 4: 패키지 설치
Write-Host "[Step 4/4] Python 패키지 설치 중..." -ForegroundColor Yellow
Write-Host "    (시간이 걸릴 수 있습니다)" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path "packages")) {
    Write-Host "[!] packages 폴더를 찾을 수 없습니다." -ForegroundColor Red
    Write-Host "    backend/packages 폴더에 .whl 파일들이 있는지 확인해주세요." -ForegroundColor Red
    Read-Host "계속하려면 Enter 키를 누르세요"
    exit 1
}

pip install --no-index --find-links=packages -r requirements.txt
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[!] 패키지 설치 중 오류 발생" -ForegroundColor Red
    Write-Host "    Python 버전이 3.13인지 확인해주세요." -ForegroundColor Red
    Write-Host "    python --version" -ForegroundColor Yellow
    Read-Host "계속하려면 Enter 키를 누르세요"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "가상환경이 준비되었습니다!" -ForegroundColor Green
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Yellow
Write-Host "  1. .env 파일 설정" -ForegroundColor White
Write-Host "     copy .env.example .env" -ForegroundColor Cyan
Write-Host "     notepad .env" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. 데이터베이스 복원" -ForegroundColor White
Write-Host "     python import_database.py database_dump_YYYYMMDD_HHMMSS.sql" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. 서버 실행" -ForegroundColor White
Write-Host "     python run.py" -ForegroundColor Cyan
Write-Host ""
Write-Host "주의: 매번 서버 실행 시 가상환경을 활성화해야 합니다." -ForegroundColor Yellow
Write-Host "     venv\Scripts\Activate.ps1" -ForegroundColor Cyan
Write-Host ""
Read-Host "계속하려면 Enter 키를 누르세요"
