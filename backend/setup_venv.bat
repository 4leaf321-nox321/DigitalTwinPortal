@echo off
REM ========================================
REM Backend 가상환경 자동 설정 스크립트
REM ========================================

echo ========================================
echo   Backend Virtual Environment Setup
echo ========================================
echo.

REM Step 1: Python 버전 확인
echo [Step 1/4] Python 버전 확인...
python --version >nul 2>&1
if errorlevel 1 (
    echo [!] Python을 찾을 수 없습니다.
    echo     Python 3.13을 설치해주세요.
    pause
    exit /b 1
)

python --version
echo.

REM Step 2: 가상환경 생성
echo [Step 2/4] 가상환경 생성 중...
if exist venv (
    echo [!] venv 폴더가 이미 존재합니다.
    echo.
    set /p RECREATE="기존 가상환경을 삭제하고 새로 생성하시겠습니까? (y/n): "
    if /i "%RECREATE%"=="y" (
        echo     기존 venv 삭제 중...
        rmdir /s /q venv
        echo     새 가상환경 생성 중...
        python -m venv venv
        if errorlevel 1 (
            echo [!] 가상환경 생성 실패
            pause
            exit /b 1
        )
        echo [OK] 가상환경이 생성되었습니다.
    ) else (
        echo [*] 기존 가상환경을 사용합니다.
    )
) else (
    echo     가상환경 생성 중...
    python -m venv venv
    if errorlevel 1 (
        echo [!] 가상환경 생성 실패
        pause
        exit /b 1
    )
    echo [OK] 가상환경이 생성되었습니다.
)
echo.

REM Step 3: 가상환경 활성화 및 pip 업그레이드
echo [Step 3/4] pip 업그레이드...
call venv\Scripts\activate.bat
python -m pip install --upgrade pip --no-index --find-links=packages 2>nul
echo [OK] pip 준비 완료
echo.

REM Step 4: 패키지 설치
echo [Step 4/4] Python 패키지 설치 중...
echo     (시간이 걸릴 수 있습니다)
echo.

if not exist packages (
    echo [!] packages 폴더를 찾을 수 없습니다.
    echo     backend/packages 폴더에 .whl 파일들이 있는지 확인해주세요.
    pause
    exit /b 1
)

pip install --no-index --find-links=packages -r requirements.txt
if errorlevel 1 (
    echo.
    echo [!] 패키지 설치 중 오류 발생
    echo     Python 버전이 3.13인지 확인해주세요.
    echo     python --version
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo 가상환경이 준비되었습니다!
echo.
echo 다음 단계:
echo   1. .env 파일 설정
echo      copy .env.example .env
echo      notepad .env
echo.
echo   2. 데이터베이스 복원
echo      python import_database.py database_dump_YYYYMMDD_HHMMSS.sql
echo.
echo   3. 서버 실행
echo      python run.py
echo.
echo 주의: 매번 서버 실행 시 가상환경을 활성화해야 합니다.
echo      venv\Scripts\activate
echo.
pause
