#!/usr/bin/env bash
# Forward explicit arguments to the common, preview-first installer.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" || exit 1
exec node "$SCRIPT_DIR/install.mjs" "$@"
