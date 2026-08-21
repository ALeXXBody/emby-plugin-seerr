#!/usr/bin/env bash
# One-shot installer for Emby.Plugin.Seerr + optional Emby Web "Requests" UI patch.
#
# Usage (on the Emby host, as root):
#   curl -fsSL https://raw.githubusercontent.com/ALeXXBody/emby-plugin-seerr/main/install.sh | sudo bash
#
# Or with options:
#   sudo bash install.sh --seerr-url http://192.168.1.10:5055 --seerr-key YOUR_KEY
#   sudo bash install.sh --no-webmod --no-restart
#   sudo bash install.sh --version v1.3.1 --plugins-dir /var/lib/emby/plugins
#
# Env vars (same as flags): SEERR_URL, SEERR_KEY, EMBY_TOKEN, PLUGINS_DIR, DASHBOARD_UI
set -euo pipefail

REPO="ALeXXBody/emby-plugin-seerr"
PLUGIN_DLL_NAME="Emby.Plugin.Seerr.dll"
PLUGIN_ID="6f2b9c4e-1d5a-4f83-9e07-2c8b41d0a77e"

VERSION=""                 # empty = latest GitHub release
PLUGINS_DIR="${PLUGINS_DIR:-}"
DASHBOARD_UI="${DASHBOARD_UI:-}"
SEERR_URL="${SEERR_URL:-}"
SEERR_KEY="${SEERR_KEY:-}"
EMBY_TOKEN="${EMBY_TOKEN:-}"
EMBY_URL="${EMBY_URL:-http://127.0.0.1:8096}"
DO_WEBMOD=1
DO_RESTART=1
DO_CONFIG=0
ALLOW_USERS="${ALLOW_USERS:-}"
WORK=""

log()  { printf '==> %s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }

usage() {
  cat <<'USAGE'
Emby.Plugin.Seerr one-shot installer

Usage (on the Emby host, as root):
  curl -fsSL https://raw.githubusercontent.com/ALeXXBody/emby-plugin-seerr/main/install.sh | sudo bash

Options:
  --version TAG          Release tag (default: latest), e.g. v1.3.1
  --plugins-dir PATH     Emby plugins folder
  --dashboard-ui PATH    Emby dashboard-ui folder (for web patch)
  --seerr-url URL        Write Seerr base URL into plugin config
  --seerr-key KEY        Write Seerr API key into plugin config
  --emby-token TOKEN     Emby API key (required for --seerr-url/--seerr-key)
  --emby-url URL         Emby base URL (default http://127.0.0.1:8096)
  --allow-users LIST     Optional Emby user allow-list (comma-separated)
  --no-webmod            Skip sidebar Requests patch
  --no-restart           Do not restart Emby
  -h, --help             Show this help

Env: SEERR_URL SEERR_KEY EMBY_TOKEN PLUGINS_DIR DASHBOARD_UI EMBY_URL ALLOW_USERS
USAGE
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage ;;
    --version) VERSION="${2:-}"; shift 2 ;;
    --plugins-dir) PLUGINS_DIR="${2:-}"; shift 2 ;;
    --dashboard-ui) DASHBOARD_UI="${2:-}"; shift 2 ;;
    --seerr-url) SEERR_URL="${2:-}"; DO_CONFIG=1; shift 2 ;;
    --seerr-key) SEERR_KEY="${2:-}"; DO_CONFIG=1; shift 2 ;;
    --emby-token) EMBY_TOKEN="${2:-}"; shift 2 ;;
    --emby-url) EMBY_URL="${2:-}"; shift 2 ;;
    --allow-users) ALLOW_USERS="${2:-}"; shift 2 ;;
    --no-webmod) DO_WEBMOD=0; shift ;;
    --no-restart) DO_RESTART=0; shift ;;
    --config-only) DO_CONFIG=1; shift ;;
    *) die "unknown arg: $1 (try --help)" ;;
  esac
done

[[ "$(id -u)" -eq 0 ]] || die "run as root (sudo)"

need curl
need python3
command -v tar >/dev/null 2>&1 || need unzip

# --- locate Emby paths -------------------------------------------------------

find_plugins_dir() {
  local d
  for d in \
    "$PLUGINS_DIR" \
    /var/lib/emby/plugins \
    /var/lib/emby-server/plugins \
    /config/plugins \
    /opt/emby-server/programdata/plugins \
    /usr/lib/emby-server/bin/plugins
  do
    [[ -n "$d" && -d "$d" ]] && { echo "$d"; return 0; }
  done
  # common docker bind: search shallow under /mnt and /data
  for d in $(find /mnt /data /home -maxdepth 5 -type d -name plugins 2>/dev/null | head -20); do
    if [[ -d "$(dirname "$d")/config" ]] || ls "$d"/*.dll >/dev/null 2>&1; then
      echo "$d"; return 0
    fi
  done
  return 1
}

find_dashboard_ui() {
  local d
  for d in \
    "$DASHBOARD_UI" \
    /opt/emby-server/system/dashboard-ui \
    /usr/lib/emby-server/system/dashboard-ui \
    /var/lib/emby/dashboard-ui \
    /system/dashboard-ui
  do
    [[ -n "$d" && -f "$d/home/home.js" && -f "$d/modules/navdrawer/navdrawercontent.js" ]] && {
      echo "$d"; return 0
    }
  done
  # search for navdrawercontent.js near emby installs
  local hit
  hit=$(find /opt /usr/lib /var/lib -path '*/dashboard-ui/modules/navdrawer/navdrawercontent.js' 2>/dev/null | head -1 || true)
  if [[ -n "$hit" ]]; then
    echo "${hit%/modules/navdrawer/navdrawercontent.js}"
    return 0
  fi
  return 1
}

emby_service_name() {
  for s in emby-server emby embyserver; do
    if systemctl list-unit-files 2>/dev/null | grep -q "^${s}\.service"; then
      echo "$s"; return 0
    fi
    if systemctl status "$s" >/dev/null 2>&1; then
      echo "$s"; return 0
    fi
  done
  return 1
}

# --- download release --------------------------------------------------------

download_release() {
  WORK=$(mktemp -d /tmp/emby-seerr-install.XXXXXX)
  trap 'rm -rf "$WORK"' EXIT

  local tag api asset_url
  if [[ -n "$VERSION" ]]; then
    tag="$VERSION"
    [[ "$tag" == v* ]] || tag="v$tag"
    api="https://api.github.com/repos/${REPO}/releases/tags/${tag}"
  else
    api="https://api.github.com/repos/${REPO}/releases/latest"
  fi

  log "Fetching release metadata ($api)"
  local meta
  meta=$(curl -fsSL "$api") || die "could not fetch release info from GitHub"

  tag=$(printf '%s' "$meta" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("tag_name",""))')
  [[ -n "$tag" ]] || die "could not determine release tag"
  log "Release: $tag"

  # Prefer tarball with everything; fall back to bare DLL
  asset_url=$(printf '%s' "$meta" | python3 -c '
import sys, json
assets = json.load(sys.stdin).get("assets") or []
prefer = ("Emby.Plugin.Seerr-1.3.1.tar.gz", "Emby.Plugin.Seerr.tar.gz")
# any .tar.gz first
for a in assets:
    n = a.get("name") or ""
    if n.endswith(".tar.gz") and "Seerr" in n:
        print(a["browser_download_url"]); raise SystemExit
for a in assets:
    n = a.get("name") or ""
    if n == "Emby.Plugin.Seerr.dll":
        print(a["browser_download_url"]); raise SystemExit
for a in assets:
    n = a.get("name") or ""
    if n.endswith(".dll") and "Seerr" in n:
        print(a["browser_download_url"]); raise SystemExit
print("")
')
  [[ -n "$asset_url" ]] || die "no plugin asset found on release $tag"

  log "Downloading: $asset_url"
  local dest="$WORK/asset"
  curl -fsSL "$asset_url" -o "$dest"

  if file "$dest" 2>/dev/null | grep -qi 'gzip\|tar'; then
    tar xzf "$dest" -C "$WORK"
  elif [[ "$asset_url" == *.tar.gz ]]; then
    tar xzf "$dest" -C "$WORK"
  elif [[ "$asset_url" == *.dll ]] || file "$dest" 2>/dev/null | grep -qi 'PE32'; then
    cp "$dest" "$WORK/$PLUGIN_DLL_NAME"
  else
    # try tar anyway, then treat as dll
    if tar tzf "$dest" >/dev/null 2>&1; then
      tar xzf "$dest" -C "$WORK"
    else
      cp "$dest" "$WORK/$PLUGIN_DLL_NAME"
    fi
  fi

  # normalize layout
  if [[ ! -f "$WORK/$PLUGIN_DLL_NAME" ]]; then
    local found
    found=$(find "$WORK" -name "$PLUGIN_DLL_NAME" | head -1 || true)
    [[ -n "$found" ]] || die "archive did not contain $PLUGIN_DLL_NAME"
    cp "$found" "$WORK/$PLUGIN_DLL_NAME"
  fi

  if [[ ! -f "$WORK/install-webmod.sh" ]]; then
    curl -fsSL "https://raw.githubusercontent.com/${REPO}/main/webmod/install-webmod.sh" \
      -o "$WORK/install-webmod.sh" || true
    chmod +x "$WORK/install-webmod.sh" 2>/dev/null || true
  fi
}

# --- install DLL -------------------------------------------------------------

install_dll() {
  local dir
  dir=$(find_plugins_dir) || die "could not find Emby plugins directory (set --plugins-dir)"
  PLUGINS_DIR="$dir"
  log "Plugins dir: $PLUGINS_DIR"

  mkdir -p "$PLUGINS_DIR"
  if [[ -f "$PLUGINS_DIR/$PLUGIN_DLL_NAME" ]]; then
    cp -a "$PLUGINS_DIR/$PLUGIN_DLL_NAME" "$PLUGINS_DIR/${PLUGIN_DLL_NAME}.bak.$(date +%Y%m%d%H%M%S)" || true
  fi
  install -m 644 "$WORK/$PLUGIN_DLL_NAME" "$PLUGINS_DIR/$PLUGIN_DLL_NAME"

  # fix ownership when emby user exists
  if id emby >/dev/null 2>&1; then
    chown emby:emby "$PLUGINS_DIR/$PLUGIN_DLL_NAME" || true
  elif id embyserver >/dev/null 2>&1; then
    chown embyserver:embyserver "$PLUGINS_DIR/$PLUGIN_DLL_NAME" || true
  fi
  log "Installed $PLUGIN_DLL_NAME"
}

# --- webmod ------------------------------------------------------------------

install_webmod() {
  [[ "$DO_WEBMOD" -eq 1 ]] || { log "Skipping webmod (--no-webmod)"; return 0; }

  local ui
  if ! ui=$(find_dashboard_ui); then
    warn "dashboard-ui not found — plugin DLL is installed, but home/drawer patch was skipped"
    warn "Re-run later: sudo ./install-webmod.sh /path/to/dashboard-ui"
    return 0
  fi
  DASHBOARD_UI="$ui"
  log "Dashboard UI: $DASHBOARD_UI"

  if [[ -f "$WORK/install-webmod.sh" ]]; then
    bash "$WORK/install-webmod.sh" "$DASHBOARD_UI"
  else
    die "install-webmod.sh missing from release bundle"
  fi
}

# --- restart -----------------------------------------------------------------

restart_emby() {
  [[ "$DO_RESTART" -eq 1 ]] || { log "Skipping restart (--no-restart)"; return 0; }

  local svc
  if svc=$(emby_service_name); then
    log "Restarting $svc"
    systemctl restart "$svc"
    # wait until HTTP answers
    local i
    for i in $(seq 1 30); do
      if curl -fsS -o /dev/null --connect-timeout 1 "${EMBY_URL}/emby/System/Info/Public" 2>/dev/null; then
        log "Emby is up"
        return 0
      fi
      sleep 1
    done
    warn "Emby did not answer on ${EMBY_URL} within 30s — check service logs"
  else
    warn "No emby systemd unit found — restart Emby manually"
  fi
}

# --- optional plugin config via API ------------------------------------------

configure_plugin() {
  [[ "$DO_CONFIG" -eq 1 ]] || return 0
  [[ -n "$SEERR_URL" && -n "$SEERR_KEY" ]] || {
    warn "config requested but --seerr-url / --seerr-key incomplete — skip"
    return 0
  }
  [[ -n "$EMBY_TOKEN" ]] || {
    warn "set --emby-token (or EMBY_TOKEN) to push Seerr settings via API — skip config"
    return 0
  }

  log "Writing plugin configuration via Emby API"
  # wait for plugin load
  local i ok=0
  for i in $(seq 1 40); do
    if curl -fsS -H "X-Emby-Token: $EMBY_TOKEN" \
      "${EMBY_URL}/emby/Plugins/${PLUGIN_ID}/Configuration" >/dev/null 2>&1; then
      ok=1; break
    fi
    sleep 1
  done
  [[ "$ok" -eq 1 ]] || { warn "plugin configuration endpoint not ready"; return 0; }

  python3 - "$EMBY_URL" "$EMBY_TOKEN" "$PLUGIN_ID" "$SEERR_URL" "$SEERR_KEY" "$ALLOW_USERS" <<'PY'
import json, sys, urllib.request
base, token, pid, url, key, allowed = sys.argv[1:7]
cfg_url = base.rstrip("/") + "/emby/Plugins/" + pid + "/Configuration"
req = urllib.request.Request(cfg_url, headers={"X-Emby-Token": token})
with urllib.request.urlopen(req, timeout=20) as r:
    cfg = json.loads(r.read().decode())
cfg["SeerrUrl"] = url
cfg["SeerrApiKey"] = key
if allowed:
    cfg["AllowedUsers"] = allowed
body = json.dumps(cfg).encode()
req = urllib.request.Request(
    cfg_url, data=body, method="POST",
    headers={"X-Emby-Token": token, "Content-Type": "application/json"},
)
with urllib.request.urlopen(req, timeout=20) as r:
    r.read()
print("config saved:", url)
PY

  # ping
  if curl -fsS -H "X-Emby-Token: $EMBY_TOKEN" "${EMBY_URL}/emby/Seerr/Ping" | grep -q '"ok":true'; then
    log "Seerr Ping OK"
  else
    warn "Seerr Ping did not return ok — check URL/API key in Dashboard → Plugins → Seerr Requests"
  fi
}

# --- main --------------------------------------------------------------------

log "Emby.Plugin.Seerr one-shot installer"

# Allow running from a local checkout without network if release/ exists next to script
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)
if [[ -n "${SCRIPT_DIR:-}" && -f "$SCRIPT_DIR/release/$PLUGIN_DLL_NAME" ]]; then
  log "Using local release/ bundle"
  WORK=$(mktemp -d /tmp/emby-seerr-install.XXXXXX)
  trap 'rm -rf "$WORK"' EXIT
  cp "$SCRIPT_DIR/release/$PLUGIN_DLL_NAME" "$WORK/"
  [[ -f "$SCRIPT_DIR/release/install-webmod.sh" ]] && cp "$SCRIPT_DIR/release/install-webmod.sh" "$WORK/" && chmod +x "$WORK/install-webmod.sh"
  [[ -f "$SCRIPT_DIR/webmod/install-webmod.sh" ]] && cp "$SCRIPT_DIR/webmod/install-webmod.sh" "$WORK/" && chmod +x "$WORK/install-webmod.sh"
elif [[ -n "${SCRIPT_DIR:-}" && -f "$SCRIPT_DIR/src/bin/Release/$PLUGIN_DLL_NAME" ]]; then
  log "Using locally built DLL"
  WORK=$(mktemp -d /tmp/emby-seerr-install.XXXXXX)
  trap 'rm -rf "$WORK"' EXIT
  cp "$SCRIPT_DIR/src/bin/Release/$PLUGIN_DLL_NAME" "$WORK/"
  cp "$SCRIPT_DIR/webmod/install-webmod.sh" "$WORK/" 2>/dev/null || true
  chmod +x "$WORK/install-webmod.sh" 2>/dev/null || true
else
  download_release
fi

install_dll
install_webmod
restart_emby
configure_plugin

cat <<EOF

------------------------------------------------------------
Install finished.

  Plugin DLL : ${PLUGINS_DIR}/${PLUGIN_DLL_NAME}
  Web UI     : ${DASHBOARD_UI:-'(not patched)'}

Next steps:
  1. Emby Dashboard → Plugins → Seerr Requests → set Seerr URL + API key
     (or re-run with --seerr-url --seerr-key --emby-token ...)
  2. Hard-refresh the browser (Ctrl+F5)
  3. Open sidebar → Requests   or   ${EMBY_URL}/emby/Seerr/Ui

Re-run this script after every Emby Server update (web files get replaced).
------------------------------------------------------------
EOF
