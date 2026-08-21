#!/usr/bin/env bash
# Adds a "Requests" entry to Emby Web's main sidebar (nav drawer).
# Opens the native plugin page (configurationpage?name=seerrreq).
#
# Also REMOVES any older Home "Requests" tab patches (3rd tab is not used).
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
SEERRTAB="$UI/home/seerrtab.js"

[[ -f "$NAV_JS" ]] || { echo "ERROR: $NAV_JS not found"; exit 1; }

python3 - "$HOME_JS" "$NAV_JS" "$HOME_HTML" "$SEERRTAB" <<'EOF'
import sys, shutil, os, re

def backup(path):
    orig = path + ".orig"
    if os.path.isfile(path) and not os.path.exists(orig):
        shutil.copyfile(path, orig)

# --- 1) REMOVE home.js Requests tab (if previously patched) ---
home_js = sys.argv[1]
if os.path.isfile(home_js):
    src = open(home_js, encoding="utf-8").read()
    orig = src
    # strip tab entry
    src = src.replace(',{name:"Requests",id:"seerr"}', '')
    src = src.replace('{name:"Requests",id:"seerr"},', '')
    # strip loader case
    src = src.replace('case"seerr":return Emby.importModule("./home/seerrtab.js");', '')
    if src != orig:
        backup(home_js)
        open(home_js, "w", encoding="utf-8").write(src)
        print("removed Home Requests tab from:", home_js)
    else:
        print("home.js: no Requests tab (ok)")
else:
    print("WARN: home.js not found, skip tab cleanup")

# --- 2) REMOVE 3rd tabContent slot from home.html ---
home_html = sys.argv[3]
if os.path.isfile(home_html):
    h = open(home_html, encoding="utf-8").read()
    ho = h
    # remove our injected slot (with flexible whitespace)
    h = re.sub(
        r'\s*<div class="tabContent tabContent-positioned flex flex-grow" data-index="2">\s*</div>\s*',
        '\n',
        h,
        count=1,
    )
    if h != ho:
        backup(home_html)
        open(home_html, "w", encoding="utf-8").write(h)
        print("removed 3rd tabContent from:", home_html)
    else:
        print("home.html: no 3rd tab slot (ok)")
else:
    print("WARN: home.html not found, skip")

# --- 3) remove leftover seerrtab.js ---
seerrtab = sys.argv[4]
if os.path.isfile(seerrtab):
    try:
        os.remove(seerrtab)
        print("removed:", seerrtab)
    except OSError as e:
        print("WARN: could not remove seerrtab.js:", e)

# --- 4) sidebar -> native plugin page (content works; not Home tab) ---
nav = sys.argv[2]
src = open(nav, encoding="utf-8").read()
orig = src

GOOD = 'href:"configurationpage?name=seerrreq"'
ANCHOR = 'ItemClass:"drawer-search",navMenuId:"search"})'
INSERT = (
    ANCHOR
    + ',menuItems.push({Name:"Requests",Icon:"&#xe04b;",'
    + GOOD
    + ',navMenuId:"requests"})'
)

for bad in (
    'href:"/home&tab=seerr"',
    'href:"/web/configurationpage?name=seerrreq"',
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
    print("WARN: requests entry present but href could not be normalized")
else:
    print("WARN: drawer anchor not found - skipping navdrawer patch")
    sys.exit(0)

if src != orig:
    backup(nav)
    open(nav, "w", encoding="utf-8").write(src)
    print("patched sidebar:", nav)
else:
    print("sidebar already ok:", nav)
EOF

echo "done. Hard-refresh the browser (Ctrl+F5)."
