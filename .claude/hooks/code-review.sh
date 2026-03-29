#!/bin/bash
# Hook PostToolUse — Code review automatique (ESLint)
# Fault-tolerant: never blocks on internal errors, only on real ESLint issues

set -o pipefail

# Extract file_path via dedicated Node.js script (handles Windows paths)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FILE_PATH=$(node "$SCRIPT_DIR/code-review.js" 2>/dev/null) || exit 0

# Skip if empty or not a TS/JS file
[[ -z "$FILE_PATH" ]] && exit 0
[[ "$FILE_PATH" != *.ts && "$FILE_PATH" != *.tsx && "$FILE_PATH" != *.js && "$FILE_PATH" != *.jsx ]] && exit 0

# Go to project root
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" 2>/dev/null || exit 0

# Run ESLint
LINT_OUTPUT=$(npx eslint "$FILE_PATH" 2>&1)
LINT_EXIT=$?

if [ $LINT_EXIT -ne 0 ]; then
  echo "=== Code Review: $(basename "$FILE_PATH") ===" >&2
  echo "$LINT_OUTPUT" >&2
  echo "⚠ ESLint: corrige avant de continuer." >&2
  exit 2
fi

exit 0
