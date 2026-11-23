#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js 20+ va npm o‘rnating, keyin qayta ishga tushiring."
  exit 1
fi
if [ ! -d node_modules ]; then npm install; fi
npm run dev -- --host 0.0.0.0
