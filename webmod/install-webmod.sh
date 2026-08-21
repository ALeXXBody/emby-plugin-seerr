#!/usr/bin/env bash
# Adds a "Requests" tab (next to Home / Favorites) to Emby Web's home screen,
# embedding the Seerr request UI.
#
# NOTE: this patches Emby's bundled web files, so it must be re-applied after
# every Emby Server update. It is idempotent - safe to run repeatedly.
#
# Usage:  sudo ./install-webmod.sh [/path/to/dashboard-ui]
#         default dashboard-ui: /opt/emby-server/system/dashboard-ui
set -euo pipefail

UI="${1:-/opt/emby-server/system/dashboard-ui}"
HOME_JS="$UI/home/home.js"
NAV_JS="$UI/modules/navdrawer/navdrawercontent.js"
MOD_SRC="$(cd "$(dirname "$0")" && pwd)/home/seerrtab.js"
MOD_DST="$UI/home/seerrtab.js"
RAW="https://raw.githubusercontent.com/ALeXXBody/emby-plugin-seerr/main/webmod/home/seerrtab.js"

for f in "$HOME_JS" "$NAV_JS"; do
  [[ -f "$f" ]] || { echo "ERROR: $f not found"; exit 1; }
done

if [[ -f "$MOD_SRC" ]]; then
  cp "$MOD_SRC" "$MOD_DST"
else
  curl -fsSL "$RAW" -o "$MOD_DST"
fi

python3 - "$HOME_JS" "$NAV_JS" <<'EOF'
import sys, shutil

path = sys.argv[1]
src = open(path, encoding="utf-8").read()
orig = src

TABS_OLD = '{name:_globalize.default.translate("Favorites"),id:"favorites"}]'
TABS_NEW = '{name:_globalize.default.translate("Favorites"),id:"favorites"},{name:"Requests",id:"seerr"}]'

CASE_OLD = 'case"favorites":return Emby.importModule("./home/favorites.js");default:'
CASE_NEW = ('case"favorites":return Emby.importModule("./home/favorites.js");'
            'case"seerr":return Emby.importModule("./home/seerrtab.js");default:')

if TABS_OLD in src:
    src = src.replace(TABS_OLD, TABS_NEW, 1)
elif '"Requests",id:"seerr"' not in src:
    print("ERROR: tab anchor not found - Emby version may be incompatible")
    sys.exit(1)

if CASE_OLD in src:
    src = src.replace(CASE_OLD, CASE_NEW, 1)
elif './home/seerrtab.js' not in src:
    print("ERROR: loader anchor not found - Emby version may be incompatible")
    sys.exit(1)

if src != orig:
    shutil.copyfile(path, path + ".orig")
    open(path, "w", encoding="utf-8").write(src)
    print("patched:", path)
else:
    print("already patched:", path)

# --- patch 2: main navigation drawer -> add "Requests" entry after Search ---
nav = sys.argv[2]
src = open(nav, encoding="utf-8").read()
orig = src

ANCHOR = 'ItemClass:"drawer-search",navMenuId:"search"})'
INSERT = (ANCHOR +
          ',menuItems.push({Name:"Requests",Icon:"&#xe04b;",'
          'href:"/emby/Seerr/Ui",navMenuId:"requests"})')

if 'navMenuId:"requests"' in src:
    pass
elif ANCHOR in src:
    src = src.replace(ANCHOR, INSERT, 1)
else:
    print("WARN: drawer anchor not found - skipping navdrawer patch")

if src != orig:
    shutil.copyfile(nav, nav + ".orig")
    open(nav, "w", encoding="utf-8").write(src)
    print("patched:", nav)
else:
    print("already patched / skipped:", nav)
EOF

echo "done. Restart Emby and hard-refresh the browser (Ctrl+F5)."
