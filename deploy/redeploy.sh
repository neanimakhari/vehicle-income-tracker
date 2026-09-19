#!/usr/bin/env bash
# Selective redeploy for VIT Docker Compose services on the droplet.
# Usage:
#   ./redeploy.sh                      # reads SERVICES from redeploy.targets
#   ./redeploy.sh --services tenant-admin
#   ./redeploy.sh --services api,system-admin
#   ./redeploy.sh --services all
#   ./redeploy.sh --no-cache           # force fresh image build (default)
#   ./redeploy.sh --use-cache          # faster rebuild using Docker cache
#   ./redeploy.sh --skip-pull          # do not git pull / reset (already at desired ref)
#
# Run from repo root or from deploy/. Safe to run on the droplet.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TARGETS_FILE="${SCRIPT_DIR}/redeploy.targets"

NO_CACHE=1
DO_PULL=1
SERVICES_RAW=""

usage() {
  sed -n '2,14p' "$0" | sed 's/^# \?//'
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --services|-s)
      SERVICES_RAW="${2:-}"
      shift 2
      ;;
    --no-cache)
      NO_CACHE=1
      shift
      ;;
    --use-cache)
      NO_CACHE=0
      shift
      ;;
    --skip-pull)
      DO_PULL=0
      shift
      ;;
    -h|--help)
      usage 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage 1
      ;;
  esac
done

if [[ -z "${SERVICES_RAW}" && -f "${TARGETS_FILE}" ]]; then
  # shellcheck disable=SC1090
  SERVICES_RAW="$(grep -E '^[[:space:]]*SERVICES=' "${TARGETS_FILE}" | tail -n1 | cut -d= -f2- | tr -d '[:space:]')"
fi

if [[ -z "${SERVICES_RAW}" ]]; then
  echo "No SERVICES set. Edit deploy/redeploy.targets or pass --services." >&2
  exit 1
fi

normalize_service() {
  local s
  s="$(echo "$1" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]')"
  case "$s" in
    api|vit-api) echo "api" ;;
    system-admin|system_admin|platform|platform-admin|vit-platform) echo "system-admin" ;;
    tenant-admin|tenant_admin|tenant|vit-admin) echo "tenant-admin" ;;
    gps-ingest|gps_ingest|ingest) echo "gps-ingest" ;;
    all) echo "all" ;;
    "" ) ;;
    *)
      echo "Unknown service/alias: $1" >&2
      echo "Use: api | system-admin | tenant-admin | gps-ingest | all" >&2
      exit 1
      ;;
  esac
}

declare -a SERVICES=()
IFS=',' read -r -a RAW_PARTS <<< "${SERVICES_RAW}"
for part in "${RAW_PARTS[@]}"; do
  norm="$(normalize_service "$part")"
  [[ -z "$norm" ]] && continue
  if [[ "$norm" == "all" ]]; then
    SERVICES=(api system-admin tenant-admin gps-ingest)
    break
  fi
  # de-dupe
  skip=0
  for existing in "${SERVICES[@]:-}"; do
    if [[ "$existing" == "$norm" ]]; then skip=1; break; fi
  done
  if [[ $skip -eq 0 ]]; then
    SERVICES+=("$norm")
  fi
done

if [[ ${#SERVICES[@]} -eq 0 ]]; then
  echo "No valid services after parsing: ${SERVICES_RAW}" >&2
  exit 1
fi

echo "==> Redeploying: ${SERVICES[*]}"

cd "${REPO_ROOT}"

if [[ "${DO_PULL}" -eq 1 ]]; then
  echo "==> Updating git checkout"
  git fetch --all --prune
  git checkout -f main
  git reset --hard origin/main
fi

cd "${SCRIPT_DIR}"

test -f .env || { echo "Missing deploy/.env" >&2; exit 1; }
test -d secrets || { echo "Missing deploy/secrets/" >&2; exit 1; }

BUILD_ARGS=(compose -f docker-compose.yml build)
if [[ "${NO_CACHE}" -eq 1 ]]; then
  BUILD_ARGS+=(--no-cache)
fi
BUILD_ARGS+=("${SERVICES[@]}")

echo "==> docker ${BUILD_ARGS[*]}"
docker "${BUILD_ARGS[@]}"

echo "==> docker compose up -d --no-deps ${SERVICES[*]}"
# --no-deps avoids restarting healthy dependencies when redeploying one frontend
docker compose -f docker-compose.yml up -d --no-deps --remove-orphans "${SERVICES[@]}"

echo "==> Status"
docker compose -f docker-compose.yml ps

echo "==> Done"
