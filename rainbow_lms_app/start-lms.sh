#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22 or newer is required." >&2
  exit 1
fi
echo "Starting Rainbow Restoration LMS at http://127.0.0.1:8787"
node --no-warnings server.js
