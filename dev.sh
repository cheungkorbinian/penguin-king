#!/bin/sh
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  export PATH="$HOME/.local/node/bin:$PATH"
fi
if ! command -v node >/dev/null 2>&1; then
  echo "需要先安装 Node.js 18+：https://nodejs.org"
  exit 1
fi
if [ ! -d node_modules ]; then
  npm install
fi
npm run dev
