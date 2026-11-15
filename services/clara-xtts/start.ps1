# Sobe o sidecar XTTS da Clara na porta 8020.
# Uso:  .\start.ps1
# Prefere uv + Python 3.12 (XTTS/torch). Fallback: py/python local.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# C: costuma ficar sem espaço — cache/temp em D: quando existir, senão no projeto.
$scratch = if (Test-Path "D:\") { "D:\clara-xtts-scratch" } else { $PSScriptRoot }
$env:UV_CACHE_DIR = Join-Path $scratch "uv-cache"
$env:TEMP = Join-Path $scratch "tmp"
$env:TMP = $env:TEMP
$env:HF_HOME = Join-Path $scratch "hf"
$env:HUGGINGFACE_HUB_CACHE = Join-Path $env:HF_HOME "hub"
$env:UV_LINK_MODE = "copy"
New-Item -ItemType Directory -Force -Path $env:UV_CACHE_DIR, $env:TEMP, $env:HUGGINGFACE_HUB_CACHE | Out-Null

$venv = Join-Path $PSScriptRoot ".venv"
$python = Join-Path $venv "Scripts\python.exe"
$uv = Get-Command uv -ErrorAction SilentlyContinue

if (-not (Test-Path $python)) {
  Write-Host "Criando venv em .venv (Python 3.12) ..."
  if ($uv) {
    & uv python install 3.12
    if ($LASTEXITCODE -ne 0) { throw "uv python install falhou ($LASTEXITCODE)" }
    & uv venv .venv --python 3.12
    if ($LASTEXITCODE -ne 0) { throw "uv venv falhou ($LASTEXITCODE)" }
    Write-Host "Instalando PyTorch (CPU) + deps via uv ..."
    & uv pip install --python $python --link-mode=copy torch torchaudio --index-url https://download.pytorch.org/whl/cpu
    if ($LASTEXITCODE -ne 0) { throw "uv pip torch falhou ($LASTEXITCODE)" }
    & uv pip install --python $python -r requirements.txt
    if ($LASTEXITCODE -ne 0) { throw "uv pip requirements falhou ($LASTEXITCODE)" }
  } else {
    py -3.12 -m venv .venv
    if (-not (Test-Path $python)) {
      py -3.11 -m venv .venv
    }
    if (-not (Test-Path $python)) {
      python -m venv .venv
    }
    if (-not (Test-Path $python)) {
      throw "Python 3.12/3.11 não encontrado. Instale ou use: winget install Python.Python.3.12"
    }
    & $python -m pip install --upgrade pip
    Write-Host "Instalando PyTorch (CPU). Para GPU, instale torch CUDA antes e rode de novo."
    & $python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
    & $python -m pip install -r requirements.txt
  }
}

$voices = @(Get-ChildItem (Join-Path $PSScriptRoot "voices") -Filter *.wav -ErrorAction SilentlyContinue)
if ($voices.Count -eq 0) {
  Write-Warning "Nenhum WAV em voices\ — converta os arquivos de docs\audio-refs (ver README)."
} else {
  Write-Host ("Referências: {0} arquivo(s) WAV" -f $voices.Count)
}

$env:COQUI_TOS_AGREED = "1"
$env:PORT = if ($env:PORT) { $env:PORT } else { "8020" }

Write-Host "Clara XTTS em http://127.0.0.1:$($env:PORT)  (Ctrl+C para parar)"
& $python server.py
