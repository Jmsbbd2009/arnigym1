#!/usr/bin/env bash
# Local E2E: mocked Supabase over HTTPS + production build + Chrome (Playwright).
# Needs: python3, pip install playwright, Chrome/Chromium (set CHROME_PATH if not bundled), openssl, Node 18+.
set -Eeuo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$HERE/../.."
APP="$ROOT/arniygym"
cleanup() { [[ -z "${MOCK:-}" ]] || kill "$MOCK" 2>/dev/null || true; [[ -z "${PREVIEW:-}" ]] || kill "$PREVIEW" 2>/dev/null || true; }
trap cleanup EXIT
[[ -f "$HERE/cert.pem" ]] || openssl req -x509 -newkey rsa:2048 -nodes -keyout "$HERE/key.pem" -out "$HERE/cert.pem" -days 30 \
  -subj "/CN=test-project.supabase.co" -addext "subjectAltName=DNS:test-project.supabase.co" >/dev/null 2>&1
(cd "$APP" && VITE_SUPABASE_URL=https://test-project.supabase.co VITE_SUPABASE_ANON_KEY=test-anon-key \
  VITE_VAPID_PUBLIC_KEY=BElocalTestKeyForUiOnly000000000000000000000000000000000000000000000000000000000000000 \
  npx vite build --outDir "$HERE/dist" --emptyOutDir >/dev/null)
(cd "$ROOT/arniygym-admin" && npx esbuild src/lib/newsImage.ts --bundle --format=iife --global-name=NI --outfile="$HERE/newsImage.js" --log-level=warning)
python3 "$HERE/mock_supabase.py" & MOCK=$!
(cd "$APP" && exec npx vite preview --outDir "$HERE/dist" --port 4173 --strictPort >/dev/null) & PREVIEW=$!
sleep 4
# The mock is reached by host-resolver mapping; bypass any corporate/system proxy for this run.
env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy python3 -u "$HERE/e2e.py"
env -u HTTPS_PROXY -u HTTP_PROXY -u https_proxy -u http_proxy python3 -u "$HERE/img_e2e.py"
