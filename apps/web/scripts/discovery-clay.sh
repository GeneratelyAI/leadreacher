#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3000}"
URL="http://localhost:${PORT}/onboarding/discovery?test=clay"

cat <<EOF
Clay discovery demo
===================
URL: ${URL}

Auto-submitted answers:
1. Clay — data enrichment / workflow automation platform
2. Largest enrichment waterfall — 100+ providers
3. Sales ops / RevOps / growth engineers at B2B SaaS (50–5000)
4. Less manual research, more selling
5. clay.com

Requires: web dev server + API running, logged-in session.
EOF

if command -v open >/dev/null 2>&1; then
  open "${URL}"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "${URL}"
else
  echo ""
  echo "Open the URL above in your browser."
fi
