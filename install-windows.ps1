param(
  [string]$AppDir = 'C:\orderSYS',
  [string]$RepoUrl = 'https://github.com/garyay2008/ordersys.git',
  [string]$PgUser = 'ordersys',
  [string]$PgPass = 'ordersys',
  [string]$PgDb = 'ordersys',
  [string]$PgPkg = 'PostgreSQL.PostgreSQL.16',
  [string]$NodePkg = 'OpenJS.NodeJS.LTS',
  [string]$GitPkg = 'Git.Git',
  [string]$RedisPkg = 'Memurai.MemuraiDeveloper'
)

$ErrorActionPreference = 'Stop'

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Info($msg) { Write-Host "    $msg" -ForegroundColor Gray }
function Warn($msg) { Write-Host "    [警告] $msg" -ForegroundColor Yellow }

function Test-Admin {
  $id = [System.Security.Principal.WindowsIdentity]::GetCurrent()
  $p = New-Object System.Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Update-SessionPath {
  $machine = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $user = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$machine;$user"
}

function Find-First($patterns) {
  foreach ($p in $patterns) {
    $found = Get-ChildItem -Path $p -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { return $found.FullName }
  }
  return $null
}

function New-RandomHex($bytes) {
  $buf = New-Object byte[] $bytes
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
  return (($buf | ForEach-Object { $_.ToString('x2') }) -join '')
}

if (-not (Test-Admin)) {
  Write-Host '需要系統管理員權限，正在重新以系統管理員啟動...' -ForegroundColor Yellow
  Start-Process -FilePath 'powershell.exe' -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
  exit
}

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  throw '找不到 winget。請先安裝「App Installer」（Windows 10 1809+ 通常內建）。'
}

Step '1/8 安裝 Node.js / Git / PostgreSQL / Memurai（Redis）'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Info "安裝 $NodePkg"
  winget install --id $NodePkg -e --silent --accept-package-agreements --accept-source-agreements
} else { Info 'Node.js 已安裝' }

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Info "安裝 $GitPkg"
  winget install --id $GitPkg -e --silent --accept-package-agreements --accept-source-agreements
} else { Info 'Git 已安裝' }

Update-SessionPath

$psql = Find-First @('C:\Program Files\PostgreSQL\*\bin\psql.exe')
if (-not $psql) {
  Info "安裝 $PgPkg"
  winget install --id $PgPkg -e --silent --accept-package-agreements --accept-source-agreements
  $psql = Find-First @('C:\Program Files\PostgreSQL\*\bin\psql.exe')
}
if (-not $psql) { throw '找不到 psql.exe，PostgreSQL 安裝可能失敗。' }
Info "psql：$psql"

$memuraiSvc = Get-Service | Where-Object { $_.Name -like '*memurai*' } | Select-Object -First 1
if (-not $memuraiSvc) {
  Info "安裝 $RedisPkg"
  winget install --id $RedisPkg -e --silent --accept-package-agreements --accept-source-agreements
  $memuraiSvc = Get-Service | Where-Object { $_.Name -like '*memurai*' } | Select-Object -First 1
}
if (-not $memuraiSvc) { throw '找不到 Memurai 服務，Redis 安裝可能失敗。' }
Info "Redis 服務：$($memuraiSvc.Name)"

Step '2/8 建立 PostgreSQL 資料庫與使用者'
$env:PGPASSWORD = 'postgres'
& $psql -U postgres -h 127.0.0.1 -p 5432 -c "SELECT 1" | Out-Null
$roleExists = & $psql -U postgres -h 127.0.0.1 -p 5432 -tAc "SELECT 1 FROM pg_roles WHERE rolname='$PgUser'"
if ($roleExists -notmatch '1') {
  & $psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE USER $PgUser WITH PASSWORD '$PgPass';" | Out-Null
  Info "已建立使用者 $PgUser"
} else { Info "使用者 $PgUser 已存在" }
$dbExists = & $psql -U postgres -h 127.0.0.1 -p 5432 -tAc "SELECT 1 FROM pg_database WHERE datname='$PgDb'"
if ($dbExists -notmatch '1') {
  & $psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE $PgDb OWNER $PgUser;" | Out-Null
  Info "已建立資料庫 $PgDb"
} else { Info "資料庫 $PgDb 已存在" }
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

Step '3/8 設定 Memurai（Redis）密碼與 AOF 持久化'
$conf = Find-First @('C:\Program Files\Memurai\memurai.conf', 'C:\Program Files (x86)\Memurai\memurai.conf')
if (-not $conf) {
  $wmi = Get-CimInstance Win32_Service -Filter "Name='$($memuraiSvc.Name)'" -ErrorAction SilentlyContinue
  if ($wmi -and $wmi.PathName) {
    $exe = ($wmi.PathName -replace '^"', '' -replace '"$', '')
    $dir = Split-Path $exe -Parent
    $conf = Find-First @((Join-Path $dir 'memurai.conf'))
  }
}
if (-not $conf) { throw '找不到 memurai.conf' }
Info "memurai.conf：$conf"

$redisPass = New-RandomHex 16
$dataDir = 'C:/ProgramData/orderSYS/redis'
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$confLines = Get-Content $conf | Where-Object { $_ -notmatch '^(\s*#)?\s*(appendonly|appendfsync|requirepass|dir)\s' }
$confLines += 'appendonly yes'
$confLines += 'appendfsync everysec'
$confLines += "requirepass $redisPass"
$confLines += "dir `"$dataDir`""
Set-Content -Path $conf -Value $confLines -Encoding Ascii
Restart-Service -Name $memuraiSvc.Name
Start-Sleep 2
Info "Redis 密碼已寫入 $conf（請勿外流）"

Step '4/8 取得 orderSYS 程式'
if (Test-Path $AppDir) {
  if (Test-Path (Join-Path $AppDir '.git')) {
    Push-Location $AppDir
    git pull --ff-only
    Pop-Location
  } else {
    Warn "$AppDir 已存在但非 Git 目錄，改為直接在其內安裝"
  }
} else {
  git clone $RepoUrl $AppDir
}

Step '5/8 安裝後端與前端'
Push-Location $AppDir
npm install --no-audit --no-fund
Set-Location client
npm install --no-audit --no-fund
npm run build
Pop-Location

Step '6/8 建立後端啟動腳本'
$jwt = New-RandomHex 32
$startCmd = Join-Path $AppDir 'start-backend.cmd'
$cmdLines = @(
  '@echo off',
  "set `"JWT_SECRET=$jwt`"",
  "set `"PG_CONN=postgres://${PgUser}:${PgPass}@127.0.0.1:5432/${PgDb}`"",
  "set `"REDIS_URL=redis://:${redisPass}@127.0.0.1:6379`"",
  'set "PORT=3000"',
  "cd /d `"$AppDir`"",
  'node server.js'
)
Set-Content -Path $startCmd -Value $cmdLines -Encoding Ascii
Info "啟動腳本：$startCmd"

Step '7/8 設定防火牆與開機自動啟動'
New-NetFirewallRule -DisplayName 'orderSYS Web (3000)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 -ErrorAction SilentlyContinue | Out-Null
$logFile = 'C:\ProgramData\orderSYS\ordersys.log'
New-Item -ItemType Directory -Force -Path (Split-Path $logFile) | Out-Null
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"$startCmd >> $logFile 2>&1`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName 'orderSYS Backend' -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null
Info '已註冊排程工作：orderSYS Backend（開機自動啟動）'

Step '8/8 啟動 orderSYS'
Start-Process -FilePath 'cmd.exe' -ArgumentList "/c `"$startCmd`"" -WindowStyle Hidden
Start-Sleep 5
$listening = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue

Write-Host ''
Write-Host '安裝完成。' -ForegroundColor Green
Write-Host '   1) 本機開啟：http://127.0.0.1:3000'
Write-Host '   2) 其他分機/平板連：http://<主機IP>:3000'
Write-Host '   3) 第一次使用先開：http://<主機IP>:3000/init 建立管理員帳號'
Write-Host "   4) Redis 密碼在 $conf（勿外流）"
Write-Host "   5) 後端記錄：$logFile"
if (-not $listening) {
  Warn '尚未偵測到 3000 埠在監聽，請查看上方記錄檔確認後端是否正常啟動。'
} else {
  Info '3000 埠已正常監聽。'
}
