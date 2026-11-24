#Requires -Version 5.1
<#
.SYNOPSIS
  Prepara o ambiente Windows da Clara Finance: Node, Build Tools, Windows SDK e npm ci.

.DESCRIPTION
  Detecta o que falta e instala via winget (pode pedir elevação UAC).
  Necessário porque better-sqlite3 pode exigir compilação nativa (MSVC + Windows SDK 10.0.26100).
#>
[CmdletBinding()]
param(
  [switch]$SkipNpmCi,
  [switch]$Yes
)

$ErrorActionPreference = "Stop"
$MinNodeVersion = [version]"22.13.0"
$RequiredSdkPrefix = "10.0.26100"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$VsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$KitsInclude = "${env:ProgramFiles(x86)}\Windows Kits\10\Include"

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
  Write-Host "  OK  $Message" -ForegroundColor Green
}

function Write-Info([string]$Message) {
  Write-Host "  ..  $Message"
}

function Write-WarnMsg([string]$Message) {
  Write-Host "  !!  $Message" -ForegroundColor Yellow
}

function Write-Fail([string]$Message) {
  Write-Host "  XX  $Message" -ForegroundColor Red
}

function Test-IsAdmin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Refresh-SessionPath {
  $machine = [Environment]::GetEnvironmentVariable("Path", "Machine")
  $user = [Environment]::GetEnvironmentVariable("Path", "User")
  $env:Path = "$machine;$user"
}

function Find-Winget {
  $cmd = Get-Command winget -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $candidates = @(
    (Join-Path $env:LOCALAPPDATA "Microsoft\WindowsApps\winget.exe"),
    (Join-Path $env:ProgramFiles "WindowsApps\Microsoft.DesktopAppInstaller_*_x64__8wekyb3d8bbwe\winget.exe")
  )
  foreach ($path in $candidates) {
    if ($path -match "\*") {
      $resolved = Get-Item $path -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($resolved) { return $resolved.FullName }
    }
    elseif (Test-Path -LiteralPath $path) {
      return $path
    }
  }
  return $null
}

function Get-NodeVersion {
  $node = Get-Command node -ErrorAction SilentlyContinue
  if (-not $node) { return $null }
  try {
    $raw = (& node -v 2>$null).Trim()
    if ($raw -match "^v?(\d+\.\d+\.\d+)") {
      return [version]$Matches[1]
    }
  }
  catch { }
  return $null
}

function Test-NodeOk {
  $version = Get-NodeVersion
  if (-not $version) { return $false }
  return $version -ge $MinNodeVersion
}

function Test-MsvcTools {
  if (-not (Test-Path -LiteralPath $VsWhere)) { return $false }
  $found = & $VsWhere `
    -products * `
    -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
    -property installationPath `
    -latest 2>$null
  return -not [string]::IsNullOrWhiteSpace($found)
}

function Test-WindowsSdk26100 {
  if (-not (Test-Path -LiteralPath $KitsInclude)) { return $false }
  $dirs = Get-ChildItem -LiteralPath $KitsInclude -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like "$RequiredSdkPrefix*" }
  return $null -ne $dirs
}

function Confirm-Install([string]$Summary) {
  Write-WarnMsg $Summary
  Write-WarnMsg "Pode pedir permissao de administrador (UAC) e demorar varios minutos / GB."
  if ($Yes) { return $true }
  $answer = Read-Host "Continuar com a instalacao? (S/N)"
  return $answer -match "^[sSyY]"
}

function Invoke-WingetInstall {
  param(
    [Parameter(Mandatory = $true)][string]$WingetPath,
    [Parameter(Mandatory = $true)][string]$Id,
    [string]$Override = $null
  )

  $args = @(
    "install",
    "--id", $Id,
    "--exact",
    "--accept-package-agreements",
    "--accept-source-agreements",
    "--disable-interactivity"
  )
  if ($Override) {
    $args += @("--override", $Override)
  }

  Write-Info "winget install $Id"
  $proc = Start-Process -FilePath $WingetPath -ArgumentList $args -Wait -PassThru -NoNewWindow
  # 0 = ok, -1978335189 (0x8A15002B) = already installed
  if ($proc.ExitCode -notin 0, -1978335189) {
    throw "winget falhou ao instalar $Id (codigo $($proc.ExitCode))."
  }
}

function Ensure-ElevatedForInstall {
  if (Test-IsAdmin) { return }

  Write-Fail "Instalacao de componentes do sistema exige privilegios de administrador."
  Write-Info "Feche e execute novamente como administrador, ou confirme o UAC se o script for reaberto."

  $psArgs = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$PSCommandPath`""
  )
  if ($SkipNpmCi) { $psArgs += "-SkipNpmCi" }
  $psArgs += "-Yes"

  $proc = Start-Process `
    -FilePath "powershell.exe" `
    -ArgumentList $psArgs `
    -Verb RunAs `
    -Wait `
    -PassThru

  if ($null -eq $proc -or $proc.ExitCode -ne 0) {
    throw "Instalacao elevada nao concluida. Execute setup-windows.cmd como administrador."
  }

  # Child already ran npm ci (unless SkipNpmCi). Exit parent successfully.
  exit 0
}

function Install-Missing {
  param(
    [bool]$NeedNode,
    [bool]$NeedToolchain
  )

  $winget = Find-Winget
  if (-not $winget) {
    throw "winget nao encontrado. Instale o App Installer da Microsoft Store e tente de novo."
  }
  Write-Ok "winget: $winget"

  $parts = @()
  if ($NeedNode) { $parts += "Node.js $MinNodeVersion+" }
  if ($NeedToolchain) { $parts += "Visual Studio 2022 Build Tools (C++) e Windows SDK $RequiredSdkPrefix" }
  $summary = "Vai instalar: " + ($parts -join "; ") + "."

  if (-not (Confirm-Install $summary)) {
    throw "Instalacao cancelada."
  }

  Ensure-ElevatedForInstall

  if ($NeedNode) {
    Write-Step "Instalando Node.js"
    # Current cobre 22.x; LTS pode ficar abaixo de 22.13 em algumas datas.
    try {
      Invoke-WingetInstall -WingetPath $winget -Id "OpenJS.NodeJS"
    }
    catch {
      Write-WarnMsg $_.Exception.Message
      Write-Info "Tentando OpenJS.NodeJS.LTS..."
      Invoke-WingetInstall -WingetPath $winget -Id "OpenJS.NodeJS.LTS"
    }
    Refresh-SessionPath
  }

  if ($NeedToolchain) {
    Write-Step "Instalando Visual Studio Build Tools + Windows SDK"
    $override = "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
    Invoke-WingetInstall `
      -WingetPath $winget `
      -Id "Microsoft.VisualStudio.2022.BuildTools" `
      -Override $override
    Refresh-SessionPath
  }
}

# --- main ---

Set-Location $RepoRoot
Write-Host "Clara Finance — setup Windows"
Write-Host "Pasta: $RepoRoot"

Write-Step "Checando Node.js"
$nodeVersion = Get-NodeVersion
$needNode = -not (Test-NodeOk)
if ($needNode) {
  if ($nodeVersion) {
    Write-WarnMsg "Node $nodeVersion encontrado; necessario >= $MinNodeVersion."
  }
  else {
    Write-WarnMsg "Node.js nao encontrado."
  }
}
else {
  Write-Ok "Node v$nodeVersion"
}

Write-Step "Checando ferramentas nativas (better-sqlite3)"
$needMsvc = -not (Test-MsvcTools)
$needSdk = -not (Test-WindowsSdk26100)
$needToolchain = $needMsvc -or $needSdk

if (-not $needMsvc) {
  Write-Ok "MSVC / Build Tools com VC Tools"
}
else {
  Write-WarnMsg "MSVC / Visual Studio Build Tools (C++) ausente."
}

if (-not $needSdk) {
  Write-Ok "Windows SDK $RequiredSdkPrefix"
}
else {
  Write-WarnMsg "Windows SDK $RequiredSdkPrefix ausente (erro tipico: versao do SDK nao encontrada)."
}

if ($needNode -or $needToolchain) {
  Install-Missing -NeedNode:$needNode -NeedToolchain:$needToolchain

  Refresh-SessionPath

  if (-not (Test-NodeOk)) {
    throw "Node.js >= $MinNodeVersion ainda ausente apos a instalacao. Feche o terminal, abra outro e rode setup-windows.cmd de novo."
  }
  Write-Ok "Node v$(Get-NodeVersion)"

  if (-not (Test-MsvcTools) -or -not (Test-WindowsSdk26100)) {
    Write-WarnMsg "Build Tools ou SDK ainda nao aparecem nesta sessao."
    Write-Info "Se o npm ci falhar, feche o terminal, abra outro e rode setup-windows.cmd de novo."
  }
  else {
    Write-Ok "Toolchain nativa pronta"
  }
}
else {
  Write-Ok "Nada a instalar no sistema"
}

if (-not $SkipNpmCi) {
  Write-Step "npm ci"
  $npm = Get-Command npm -ErrorAction SilentlyContinue
  if (-not $npm) {
    throw "npm nao encontrado no PATH. Reabra o terminal apos instalar o Node e rode de novo."
  }

  & npm ci
  if ($LASTEXITCODE -ne 0) {
    Write-Fail "npm ci falhou (codigo $LASTEXITCODE)."
    Write-Info "Se a mensagem citar Windows SDK $RequiredSdkPrefix, reinstale o Build Tools com o workload C++ e reabra o terminal."
    Write-Info "Depois: .\setup-windows.cmd"
    exit $LASTEXITCODE
  }
  Write-Ok "Dependencias npm instaladas"
}

Write-Host ""
Write-Host "Pronto. Proximo passo:" -ForegroundColor Green
Write-Host "  npm run dev"
Write-Host "  ou duplo clique em start-local.cmd"
Write-Host "Abra http://127.0.0.1:3000"
exit 0
