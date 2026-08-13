@echo off
REM ========================================
REM  MCP 서버 가상환경 설정
REM
REM  인터넷이 없는 곳에서도 된다 — packages 폴더의 wheel 만 쓴다(--no-index).
REM  backend\setup_venv.bat 과 같은 방식이고, DB·.env 단계가 없을 뿐이다.
REM ========================================

echo ========================================
echo   MCP Server Virtual Environment Setup
echo ========================================
echo.

REM Step 1: Python 확인
echo [Step 1/4] Python 버전 확인...
python --version >nul 2>&1
if errorlevel 1 (
    echo [!] Python을 찾을 수 없습니다.
    echo     Python 3.13을 설치해주세요 ^(백엔드와 같은 버전^).
    pause
    exit /b 1
)
python --version
echo.

REM Step 2: 가상환경 생성
REM
REM 괄호 블록 안에서 set /p 한 값을 %VAR% 로 읽으면 항상 빈 값이다(지연 확장이 없어서).
REM 그래서 goto 로 흐름을 나눈다 - setlocal enabledelayedexpansion 은 쓰지 않는다.
REM 그걸 켜면 아래 [!] 표시들이 변수 확장으로 먹혀 사라진다.
echo [Step 2/4] 가상환경 생성 중...
if not exist venv goto MAKEVENV

echo [!] venv 폴더가 이미 존재합니다.
set /p RECREATE="삭제하고 새로 만들까요? (y/n): "
if /i "%RECREATE%"=="y" goto DROPVENV
echo [*] 기존 가상환경을 사용합니다.
goto VENVREADY

:DROPVENV
rmdir /s /q venv

:MAKEVENV
python -m venv venv
if errorlevel 1 (
    echo [!] 가상환경 생성 실패
    pause
    exit /b 1
)
echo [OK] 가상환경이 준비되었습니다.

:VENVREADY
echo.

REM Step 3: 패키지 설치 (오프라인)
echo [Step 3/4] 패키지 설치 중 ^(인터넷 사용 안 함^)...
if not exist packages (
    echo [!] packages 폴더를 찾을 수 없습니다.
    echo     반입할 때 mcp_server\packages 가 빠진 것입니다.
    echo     다시 만들려면 mcp_server\README.md 의 '번들 다시 만들기' 참고.
    pause
    exit /b 1
)

venv\Scripts\python.exe -m pip install --no-index --find-links=packages -r requirements.txt
if errorlevel 1 (
    echo.
    echo [!] 패키지 설치 실패
    echo     Python이 3.13인지 확인해주세요 - wheel이 cp313용입니다.
    pause
    exit /b 1
)
echo [OK] 설치 완료
echo.

REM Step 4: 실제로 뜨는지 확인
REM
REM 여기서 mcp.server.fastmcp 를 확인하는 이유 - mcp 2.0 에서 그 모듈이 사라졌다.
REM 번들이 어쩌다 2.x 로 채워지면 설치는 멀쩡히 끝나고 띄울 때 비로소 깨진다.
echo [Step 4/4] 기동 확인...
venv\Scripts\python.exe -c "from mcp.server.fastmcp import FastMCP; from importlib.metadata import version; import server; print('  mcp ' + version('mcp') + ' | httpx ' + version('httpx') + ' | 도구 ' + str(len(server.mcp._tool_manager.list_tools())) + '개')"
if errorlevel 1 (
    echo.
    echo [!] 기동 확인 실패.
    echo     mcp.server.fastmcp 가 없다면 mcp 가 2.x 로 깔린 것입니다
    echo     ^(requirements.txt 는 1.x 로 고정돼 있습니다^).
    pause
    exit /b 1
)
echo [OK] 기동 확인 완료
echo.

echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo 실행:
echo   set DT_API_BASE=http://localhost:5174
echo   venv\Scripts\python.exe server.py
echo.
echo 주의: DT 백엔드가 떠 있어야 합니다. 이 서버는 그 REST API를 부르는 대리인입니다.
echo       콘솔 창을 닫으면 죽습니다 - 상시 기동 방법은 아직 안 정했습니다.
echo.
pause
