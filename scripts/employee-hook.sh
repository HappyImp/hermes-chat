#!/usr/bin/env bash
# employee-hook.sh — Shell Hooks for employee session tracking
# Called by Hermes on session start/end. Writes/reads /tmp/employees-active.json
# Usage: employee-hook.sh on_session_start | on_session_end

set -euo pipefail

ACTIVE_FILE="/tmp/employees-active.json"
PROD_ACTIVE_FILE="/var/www/chat/data/employees-active.json"
LOCK_FILE="/tmp/employees-active.lock"
EMPLOYEES=("老财" "铁壳" "小K" "404" "裁判君")

identify_employee() {
  local prompt="${HERMES_SESSION_PROMPT:-}"
  for name in "${EMPLOYEES[@]}"; do
    # Use glob pattern matching — works correctly with multi-byte UTF-8 names
    if [[ "$prompt" == *"$name"* ]]; then
      echo "$name"
      return 0
    fi
  done
  return 1
}

extract_task() {
  local prompt="${HERMES_SESSION_PROMPT:-}"
  local first_line
  first_line=$(echo "$prompt" | head -n1 | cut -c1-80)
  echo "${first_line:-进行中}"
}

ensure_file() {
  if [[ ! -f "$ACTIVE_FILE" ]] || ! python3 -c "import json; json.load(open('$ACTIVE_FILE'))" 2>/dev/null; then
    echo '{}' > "$ACTIVE_FILE"
  fi
}

sync_to_prod() {
  mkdir -p "$(dirname "$PROD_ACTIVE_FILE")" 2>/dev/null || true
  cp "$ACTIVE_FILE" "$PROD_ACTIVE_FILE" 2>/dev/null || true
}

on_session_start() {
  local employee
  employee=$(identify_employee) || return 0

  local task
  task=$(extract_task)

  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  (
    flock -n 200 || exit 0
    ensure_file
    python3 -c "
import json, sys, datetime
with open('$ACTIVE_FILE', 'r') as f:
    data = json.load(f)
# TTL cleanup: remove entries older than 2 hours (crashed/killed sessions)
now = datetime.datetime.utcnow()
stale = []
for emp, info in data.items():
    try:
        started = datetime.datetime.strptime(info['startedAt'], '%Y-%m-%dT%H:%M:%SZ')
        if (now - started).total_seconds() > 7200:
            stale.append(emp)
    except (KeyError, ValueError):
        stale.append(emp)
for emp in stale:
    del data[emp]
data['$employee'] = {'task': sys.argv[1], 'startedAt': '$ts'}
with open('$ACTIVE_FILE', 'w') as f:
    json.dump(data, f, ensure_ascii=False)
" "$task"
  ) 200>"$LOCK_FILE"
  sync_to_prod
}

on_session_end() {
  local employee
  employee=$(identify_employee) || return 0

  (
    flock -n 200 || exit 0
    ensure_file
    python3 -c "
import json
with open('$ACTIVE_FILE', 'r') as f:
    data = json.load(f)
data.pop('$employee', None)
with open('$ACTIVE_FILE', 'w') as f:
    json.dump(data, f, ensure_ascii=False)
"
  ) 200>"$LOCK_FILE"
  sync_to_prod
}

case "${1:-}" in
  on_session_start) on_session_start ;;
  on_session_end)   on_session_end ;;
  *)                echo "Usage: $0 {on_session_start|on_session_end}" >&2; exit 1 ;;
esac
