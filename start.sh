#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/arniygym"
ADMIN_DIR="$ROOT_DIR/arniygym-admin"
APP_PID=""
ADMIN_PID=""
APP_PORT=""
ADMIN_PORT=""

say() { printf '\n[ArniyGym] %s\n' "$*"; }
fail() { printf '\n[ArniyGym] Xato: %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || fail "Node.js topilmadi. Node.js 18 yoki yangiroq versiyasini o‘rnating."
command -v npm >/dev/null 2>&1 || fail "npm topilmadi. Node.js va npm o‘rnating."

node_version="$(node -p 'Number(process.versions.node.split(".")[0])')"
(( node_version >= 18 )) || fail "Node.js 18 yoki yangiroq versiyasi kerak."

install_if_needed() {
  local project_dir="$1"
  local label="$2"
  if [[ ! -d "$project_dir/node_modules" ]]; then
    say "$label kutubxonalarini o‘rnatyapman (birinchi ishga tushirishda internet kerak)."
    (cd "$project_dir" && npm ci)
  fi
}

cleanup() {
  trap - EXIT INT TERM
  [[ -z "$APP_PID" ]] || kill "$APP_PID" 2>/dev/null || true
  [[ -z "$ADMIN_PID" ]] || kill "$ADMIN_PID" 2>/dev/null || true
  [[ -z "$APP_PID" ]] || wait "$APP_PID" 2>/dev/null || true
  [[ -z "$ADMIN_PID" ]] || wait "$ADMIN_PID" 2>/dev/null || true
}

port_is_free() {
  node - "$1" <<'NODE'
const net = require('node:net');
const port = Number(process.argv[2]);
const server = net.createServer();
server.once('error', (error) => process.exit(error.code === 'EADDRINUSE' ? 1 : 2));
server.listen({ host: '127.0.0.1', port }, () => server.close(() => process.exit(0)));
NODE
}

choose_port() {
  local port="$1"
  while (( port < 65536 )); do
    if port_is_free "$port"; then printf '%s' "$port"; return 0
    else
      local status=$?
      (( status != 2 )) || fail "Port ${port} holatini tekshirish uchun localhost socket ochilmadi. Terminalda bind ruxsati bilan qayta ishga tushiring."
    fi
    port=$((port + 1))
  done
  fail "Bo‘sh localhost porti topilmadi."
}

install_if_needed "$APP_DIR" "Asosiy sayt"
install_if_needed "$ADMIN_DIR" "Admin panel"

APP_PORT="$(choose_port "${ARNIYGYM_PORT:-5173}")"
ADMIN_PORT="$(choose_port "${ARNIYGYM_ADMIN_PORT:-$((APP_PORT + 1))}")"
trap cleanup EXIT INT TERM

say "Asosiy sayt:  http://localhost:$APP_PORT"
say "Admin panel:  http://localhost:$ADMIN_PORT"
say "To‘xtatish uchun Ctrl+C bosing."

start_vite() {
  local project_dir="$1"
  local port="$2"
  cd "$project_dir"
  exec npm run dev -- --host 127.0.0.1 --port "$port" --strictPort
}

start_vite "$APP_DIR" "$APP_PORT" &
APP_PID=$!
start_vite "$ADMIN_DIR" "$ADMIN_PORT" &
ADMIN_PID=$!

wait "$APP_PID"
