#!/usr/bin/env bash
# Populates libs/ with the Emby reference DLLs required to build the plugin.
#
# Emby's DLLs are proprietary, so they are NOT committed to this repository.
# Run one of:
#
#   ./scripts/restore-libs.sh /opt/emby-server   # native Emby install (default path)
#   ./scripts/restore-libs.sh --docker           # extract from official emby/embyserver image
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p libs

NEEDED=(
  MediaBrowser.Common.dll
  MediaBrowser.Model.dll
  MediaBrowser.Controller.dll
)

if [[ "${1:-}" == "--docker" ]]; then
  cid=$(docker create emby/embyserver:latest)
  trap 'docker rm "$cid" >/dev/null' EXIT
  for f in "${NEEDED[@]}"; do
    docker cp "$cid:/system/$f" "libs/$f"
  done
else
  PREFIX="${1:-/opt/emby-server}"
  for f in "${NEEDED[@]}"; do
    cp "$PREFIX/system/$f" "libs/$f"
  done
fi

echo "libs/ ready:"
ls -l libs/
