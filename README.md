# Emby.Plugin.Seerr

[![Build](https://github.com/ALeXXBody/emby-plugin-seerr/actions/workflows/build.yml/badge.svg)](https://github.com/ALeXXBody/emby-plugin-seerr/actions/workflows/build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/ALeXXBody/emby-plugin-seerr)](../../releases)

An [Emby Server](https://emby.media) plugin that integrates [Seerr](https://seerr.dev)
(Overseerr / Jellyseerr), so you can **search and request movies & TV shows from any
browser** — including your phone via *Add to Home Screen*, which gives an app-like UX.

> Native Emby apps (Android / iOS / TV) have closed UIs and cannot host third-party
> interfaces — that is an Emby platform limitation. This plugin serves its own mobile-friendly
> web UI straight from your Emby server, reachable at `/emby/Seerr/Ui` in any browser.

## How it works

```
Browser ──> Emby Server ──> Seerr plugin (this repo)
                │                    │
   auth via Emby login        REST proxy (X-Api-Key)
                                     ▼
                                  Seerr ──> Radarr / Sonarr ──> qBittorrent ...
```

- All endpoints require a normal **Emby login** (401 otherwise).
- Requests are created in Seerr under the API-key owner account.
- The plugin is a thin proxy: search results, request creation and request history come
  live from your Seerr instance.

## Requirements

| Component | Version |
|---|---|
| Emby Server | 4.10.x (tested on 4.10.0.25) |
| Seerr / Jellyseerr / Overseerr | 3.x (tested on 3.4.1) |
| .NET 8 SDK | only if building from source |

## Install

### 1. Download the plugin

Grab `Emby.Plugin.Seerr.zip` from the [latest release](../../releases/latest) and unzip it.

### 2. Copy the DLL into your Emby plugins folder

Emby loads plugins from the **data folder** (`plugins/` subfolder):

| Install type | Path |
|---|---|
| Linux native (.deb) | `/var/lib/emby/plugins/` |
| Docker | `<host path mapped to /config>/plugins/` |
| Windows | `%AppData%\Emby-Server\plugins\` |

```bash
sudo chown emby:emby /var/lib/emby/plugins/Emby.Plugin.Seerr.dll
```

### 3. Restart Emby Server

```bash
sudo systemctl restart emby-server
```

### 4. Configure

Dashboard → **Plugins** → **Seerr Requests** → **Settings**:

| Setting | Example | Notes |
|---|---|---|
| Seerr URL | `http://192.168.1.10:5055` | Base URL of your Seerr instance |
| Seerr API Key | *(paste)* | Seerr → Settings → General → API Key |
| Allowed Users | `alice,bob` | Optional allow-list of Emby user names; empty = everyone |

Save, then verify: open `http://<emby-host>:8096/emby/Seerr/Ping` while logged in —
it should return `{"ok":true}`.

## Usage

Open **`http://<emby-host>:8096/emby/Seerr/Ui`**, log in with any Emby account.

The UI opens on a **Trending** wall (no typing needed); use the *Search* tab to look
up specific titles, *Recent* for request history.

### On TVs

Native Emby TV apps can't host plugin UIs, but the page works in TV browsers:

- **Samsung (Tizen):** open the built-in *Internet* browser → go to
  `/emby/Seerr/Ui` → save as bookmark. Arrow keys / D-pad move focus; Enter requests.
- **Android TV / Fire TV:** install [TV Bro](https://play.google.com/store/apps/details?id=com.phlox.tvwebbrowser)
  (free, open source, remote-friendly) and set the Ui URL as its homepage.

### Phone "app"

1. Log into Emby Web once in the phone browser.
2. Open `/emby/Seerr/Ui`.
3. Safari: Share → *Add to Home Screen*. Chrome Android: ⋮ → *Add to Home screen*.

### HTTP endpoints

All require Emby authentication.

| Endpoint | Method | Purpose |
|---|---|---|
| `/emby/Seerr/Ui` | GET | Mobile/TV request UI (HTML) |
| `/emby/Seerr/Ping` | GET | Config/connectivity check → `{"ok":true}` |
| `/emby/Seerr/Discover?page=` | GET | Trending movies & shows |
| `/emby/Seerr/Search?query=` | GET | Proxy to Seerr search |
| `/emby/Seerr/Requests?take=&skip=` | GET | Recent requests |
| `/emby/Seerr/Request` | POST | Create request — body: `{"mediaType":"movie"\|"tv","mediaId":123,"seasons":"1,2"}` (`seasons` optional, TV only) |

Example:

```bash
curl -X POST "http://localhost:8096/emby/Seerr/Request" \
  -H "Authorization: MediaBrowser Token=\"<emby-token>\"" \
  -H "Content-Type: application/json" \
  -d '{"mediaType":"tv","mediaId":125988,"seasons":"1"}'
```

## Building from source

Emby's reference DLLs are proprietary and therefore **not committed** to this repo.
Fetch them first:

```bash
git clone https://github.com/ALeXXBody/emby-plugin-seerr.git
cd emby-plugin-seerr

# either from a local Emby install...
./scripts/restore-libs.sh /opt/emby-server
# ...or from the official Docker image
./scripts/restore-libs.sh --docker

dotnet build src/Emby.Plugin.Seerr.csproj -c Release
# output: src/bin/Release/Emby.Plugin.Seerr.dll
```

CI builds every push to `main` using the official `emby/embyserver` image for
reference DLLs — see the [Actions tab](../../actions).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Ping returns `{"ok":false}` or 500 | Wrong Seerr URL / API key in plugin settings |
| 401 everywhere | Not logged in to Emby, or user not in *Allowed Users* |
| Search works, requests fail | Seerr must have Radarr/Sonarr configured and the API-key owner needs permission to request |
| Plugin missing after restart | DLL not in the right `plugins/` folder, or wrong architecture-independent build — re-download the release zip |

## Limitations

- No per-user attribution in Seerr yet: all requests are created by the API-key owner.
- Native Emby apps can't embed the UI (use a browser / home-screen shortcut).
- Unofficial project — not affiliated with Emby or the Seerr team.

## License

[MIT](LICENSE)
