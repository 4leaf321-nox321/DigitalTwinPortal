<#
.SYNOPSIS
  기술정보(intel) 역량·도구 분류를 운영 DB 에 씨뿌린다.

.DESCRIPTION
  정본은 backend\scripts 의 두 파이썬 스크립트다. 이 파일은 그 둘을 운영 배치
  (앱 폴더 + 형제 폴더의 _venvs) 에 맞춰 순서대로 부르는 껍데기일 뿐이다.

      check_intel_taxonomy.py   미리보기 — 아무것도 안 고친다. 지워질 역량·
                                떨어질 도구·규칙 위반·부딪히는 이름·새 역량을 센다.
      seed_intel_taxonomy.py    씨뿌리기 — 이름이 같은 줄은 uuid 를 두고 부모만
                                옮기므로 근거 소식·사업부 줄이 끊기지 않는다.
                                여러 번 돌려도 같은 결과.

  ⚠️ 기본은 미리보기만이다. 실제로 쓰려면 -Apply 를 줘야 한다 — 씨뿌리기는
     표에 없는 역량을 **지우고**, 그건 되돌릴 수 없다. 미리보기에 「지워질 역량」이
     0 이 아니면 운영에서 누가 손으로 넣은 역량이다. 그것부터 판단할 것.

  ⚠️ 마이그레이션이 먼저다. deploy.ps1 이 돌렸으면 됐고, -SkipMigrations 로
     건너뛰었다면 `python -m flask db upgrade` 부터.

.PARAMETER AppPath
  운영 앱 폴더. 생략하면 이 파일의 위치(<앱>\scripts\deploy)에서 계산한다.
  가상환경은 deploy.ps1 과 같은 규칙으로 <AppPath>_venvs\backend 에서 찾는다.

.PARAMETER Apply
  미리보기 뒤에 실제로 씨뿌린다. 없으면 미리보기만.

.EXAMPLE
  cd C:\Server\DigitalTwinPortal
  .\scripts\deploy\seed_production.ps1            # 미리보기
  .\scripts\deploy\seed_production.ps1 -Apply     # 씨뿌리기
#>
[CmdletBinding()]
param(
    [string]$AppPath,
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'

if (-not $AppPath) {
    $AppPath = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}
$AppPath = $AppPath.TrimEnd('\')

$backend = Join-Path $AppPath 'backend'
$python  = Join-Path ($AppPath + '_venvs') 'backend\Scripts\python.exe'

if (-not (Test-Path (Join-Path $backend 'scripts\seed_intel_taxonomy.py'))) {
    throw "backend\scripts\seed_intel_taxonomy.py 가 없습니다: $backend (AppPath 가 맞습니까?)"
}
if (-not (Test-Path $python)) {
    throw "백엔드 가상환경이 없습니다: $python  (deploy.ps1 이 만드는 위치입니다. venv_sync.ps1 을 먼저 돌리세요)"
}

Write-Host "앱 폴더 : $AppPath"
Write-Host "python  : $python"
Write-Host ''

Push-Location $backend
try {
    $env:PYTHONPATH = ''
    $env:PYTHONIOENCODING = 'utf-8'

    Write-Host '== 1/2 미리보기 (check_intel_taxonomy.py) — 아무것도 안 고칩니다 =='
    & $python scripts\check_intel_taxonomy.py
    if ($LASTEXITCODE -ne 0) { throw "미리보기가 실패했습니다 (exit $LASTEXITCODE)" }

    if (-not $Apply) {
        Write-Host ''
        Write-Host '미리보기만 했습니다. 위 결과가 괜찮으면 -Apply 를 붙여 다시 돌리세요.'
        return
    }

    Write-Host ''
    Write-Host '== 2/2 씨뿌리기 (seed_intel_taxonomy.py) =='
    & $python scripts\seed_intel_taxonomy.py
    if ($LASTEXITCODE -ne 0) { throw "씨뿌리기가 실패했습니다 (exit $LASTEXITCODE)" }

    Write-Host ''
    Write-Host '끝. 확인할 곳: 기술정보 레이더에 역량이 서는지, 전략 ① 진단에 「기술 근거」 패널이 뜨는지.'
} finally {
    Pop-Location
}
