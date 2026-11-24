#!/usr/bin/env bash
# Prepara o ambiente macOS da Clara Finance: Node, Xcode CLT e npm ci.
# better-sqlite3 pode exigir compilação nativa (clang via Command Line Tools).
set -euo pipefail

MIN_NODE="22.13.0"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKIP_NPM_CI=0
ASSUME_YES=0

for arg in "$@"; do
  case "$arg" in
    --skip-npm-ci) SKIP_NPM_CI=1 ;;
    -y|--yes) ASSUME_YES=1 ;;
    -h|--help)
      echo "Uso: ./scripts/setup-macos.sh [--yes] [--skip-npm-ci]"
      exit 0
      ;;
  esac
done

cd "$REPO_ROOT"

step() { printf '\n==> %s\n' "$1"; }
ok() { printf '  OK  %s\n' "$1"; }
info() { printf '  ..  %s\n' "$1"; }
warn() { printf '  !!  %s\n' "$1"; }
fail() { printf '  XX  %s\n' "$1" >&2; }

version_ge() {
  # retorna 0 se $1 >= $2
  printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1 | grep -qx "$2"
}

get_node_version() {
  if ! command -v node >/dev/null 2>&1; then
    return 1
  fi
  local raw
  raw="$(node -v 2>/dev/null | tr -d 'v')"
  if [[ -z "$raw" ]]; then
    return 1
  fi
  printf '%s' "$raw"
}

test_node_ok() {
  local ver
  ver="$(get_node_version)" || return 1
  version_ge "$ver" "$MIN_NODE"
}

test_clt() {
  # xcode-select -p falha se CLT/Xcode não estiver instalado
  xcode-select -p >/dev/null 2>&1
}

confirm() {
  local summary="$1"
  warn "$summary"
  if [[ "$ASSUME_YES" -eq 1 ]]; then
    return 0
  fi
  read -r -p "Continuar? (s/N) " answer
  [[ "$answer" =~ ^[sSyY] ]]
}

ensure_brew() {
  if command -v brew >/dev/null 2>&1; then
    ok "Homebrew"
    return 0
  fi
  warn "Homebrew não encontrado."
  if ! confirm "Instalar Homebrew (necessário para instalar o Node automaticamente)?"; then
    fail "Instale o Node.js $MIN_NODE+ manualmente em https://nodejs.org e rode de novo."
    exit 1
  fi
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Apple Silicon: brew fica em /opt/homebrew
  if [[ -x /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -x /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  if ! command -v brew >/dev/null 2>&1; then
    fail "Homebrew instalado, mas não está no PATH. Abra um terminal novo e rode ./scripts/setup-macos.sh de novo."
    exit 1
  fi
  ok "Homebrew"
}

install_node() {
  ensure_brew
  step "Instalando Node.js"
  brew install node
  hash -r || true
}

install_clt() {
  warn "Xcode Command Line Tools ausentes."
  if ! confirm "Abrir o instalador das Command Line Tools?"; then
    fail "Instale com: xcode-select --install"
    exit 1
  fi
  step "Instalando Xcode Command Line Tools"
  info "Uma janela do sistema deve abrir. Conclua a instalação e rode este script de novo."
  xcode-select --install || true
  fail "Aguarde o fim da instalação das CLT e execute: ./scripts/setup-macos.sh"
  exit 1
}

echo "Clara Finance — setup macOS"
echo "Pasta: $REPO_ROOT"

step "Checando Node.js"
NEED_NODE=0
if test_node_ok; then
  ok "Node v$(get_node_version)"
else
  ver="$(get_node_version 2>/dev/null || true)"
  if [[ -n "${ver:-}" ]]; then
    warn "Node $ver encontrado; necessário >= $MIN_NODE."
  else
    warn "Node.js não encontrado."
  fi
  NEED_NODE=1
fi

step "Checando Xcode Command Line Tools"
NEED_CLT=0
if test_clt; then
  ok "Command Line Tools ($(xcode-select -p))"
else
  NEED_CLT=1
fi

if [[ "$NEED_CLT" -eq 1 ]]; then
  install_clt
fi

if [[ "$NEED_NODE" -eq 1 ]]; then
  if ! confirm "Instalar Node.js $MIN_NODE+ via Homebrew?"; then
    fail "Instale o Node.js $MIN_NODE+ e rode de novo."
    exit 1
  fi
  install_node
  if ! test_node_ok; then
    fail "Node.js >= $MIN_NODE ainda ausente. Abra um terminal novo e rode ./scripts/setup-macos.sh de novo."
    exit 1
  fi
  ok "Node v$(get_node_version)"
else
  ok "Nada a instalar no sistema (Node)"
fi

if [[ "$SKIP_NPM_CI" -eq 0 ]]; then
  step "npm ci"
  if ! command -v npm >/dev/null 2>&1; then
    fail "npm não encontrado no PATH. Reabra o terminal após instalar o Node."
    exit 1
  fi
  npm ci
  ok "Dependências npm instaladas"
fi

echo ""
echo "Pronto. Próximo passo:"
echo "  npm run dev"
echo "Abra http://127.0.0.1:3000"
exit 0
