#!/usr/bin/env bash
# Adds a "Requests" tab (next to Home / Favorites) + sidebar entry that stays
# on the normal Home chrome (not Settings).
#
# NOTE: patches Emby's bundled web files — re-run after every Emby Server update.
# Idempotent.
#
# Usage:  sudo ./install-webmod.sh [/path/to/dashboard-ui]
#         default: /opt/emby-server/system/dashboard-ui
set -euo pipefail

UI="${1:-/opt/emby-server/system/dashboard-ui}"
HOME_JS="$UI/home/home.js"
HOME_HTML="$UI/home/home.html"
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

python3 - "$HOME_JS" "$NAV_JS" "$HOME_HTML" <<'EOF'
import sys, shutil, os

def backup(path):
    orig = path + ".orig"
    if not os.path.exists(orig):
        shutil.copyfile(path, orig)

# --- patch 1: home.js tabs + loader ---
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
    backup(path)
    open(path, "w", encoding="utf-8").write(src)
    print("patched:", path)
else:
    print("already patched:", path)

# --- patch 2: home.html needs a 3rd tabContent slot (Emby ships only 2) ---
home_html = sys.argv[3]
if os.path.isfile(home_html):
    h = open(home_html, encoding="utf-8").read()
    ho = h
    MARKER = 'data-index="2"'
    SLOT = '''
    <div class="tabContent tabContent-positioned flex flex-grow" data-index="2">

    </div>
'''
    if MARKER not in h:
        # insert before closing </div> of root view — after last tabContent
        needle = 'data-index="1" data-swapnode="sectionstab">'
        alt = 'data-index="1"'
        if needle in h:
            # find end of that div block: after its closing </div>
            idx = h.find(needle)
            # find the closing </div> after this opening tag's content
            # structure is empty divs, so next </div> closes it
            close = h.find("</div>", idx)
            if close != -1:
                insert_at = close + len("</div>")
                h = h[:insert_at] + SLOT + h[insert_at:]
        elif h.count('tabContent') >= 2 and MARKER not in h:
            # fallback: before final root close
            last = h.rfind("</div>")
            if last != -1:
                h = h[:last] + SLOT + h[last:]
        if h == ho:
            print("WARN: could not add tabContent slot to home.html")
    if h != ho:
        backup(home_html)
        open(home_html, "w", encoding="utf-8").write(h)
        print("patched:", home_html)
    else:
        print("already patched / ok:", home_html)
else:
    print("WARN: home.html not found at", home_html)

# --- patch 3: sidebar -> /home&tab=seerr (same chrome as Favorites, NOT settings) ---
nav = sys.argv[2]
src = open(nav, encoding="utf-8").read()
orig = src

GOOD = 'href:"/home&tab=seerr"'
ANCHOR = 'ItemClass:"drawer-search",navMenuId:"search"})'
INSERT = (ANCHOR +
          ',menuItems.push({Name:"Requests",Icon:"&#xe04b;",'
          + GOOD + ',navMenuId:"requests"})')

# normalize any older broken hrefs
for bad in (
    'href:"/web/configurationpage?name=seerrreq"',
    'href:"configurationpage?name=seerrreq"',
    'href:"/emby/Seerr/Ui"',
    'href:"/emby/seerr/ui"',
):
    if bad in src:
        src = src.replace(bad, GOOD)

if 'navMenuId:"requests"' in src and GOOD in src:
    pass
elif ANCHOR in src and 'navMenuId:"requests"' not in src:
    src = src.replace(ANCHOR, INSERT, 1)
elif 'navMenuId:"requests"' in src:
    print("WARN: requests entry present but href could not be normalized to /home&tab=seerr")
else:
    print("WARN: drawer anchor not found - skipping navdrawer patch")

if src != orig:
    backup(nav)
    open(nav, "w", encoding="utf-8").write(src)
    print("patched:", nav)
else:
    print("already patched / skipped:", nav)
EOF

echo "done. Hard-refresh the browser (Ctrl+F5). Restart Emby only if files were locked."
