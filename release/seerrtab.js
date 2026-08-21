define(["exports", "./../modules/loading/loading.js"], function (_exports, _loading) {
    "use strict";

    var loading = _loading && (_loading.default || _loading);
    var TMDB = "https://image.tmdb.org/t/p/w200";

    function apiClient() {
        if (typeof ApiClient !== "undefined" && ApiClient) return ApiClient;
        throw new Error("ApiClient not available");
    }

    function seerrUrl(path, query) {
        return apiClient().getUrl("Seerr/" + String(path || "").replace(/^\/+/, ""), query || {});
    }

    function seerrGet(path, query) {
        return apiClient().getJSON(seerrUrl(path, query));
    }

    function seerrPost(path, body) {
        return apiClient().ajax({
            type: "POST",
            url: seerrUrl(path),
            data: JSON.stringify(body || {}),
            contentType: "application/json",
            dataType: "json"
        });
    }

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
        });
    }

    function badgeFor(st) {
        if (st === 5) return '<span class="seerr-badge seerr-b-ok">Available</span>';
        if (st === 4) return '<span class="seerr-badge seerr-b-part">Partial</span>';
        if (st === 3) return '<span class="seerr-badge seerr-b-proc">Processing</span>';
        if (st === 2) return '<span class="seerr-badge seerr-b-req">Pending</span>';
        return "";
    }

    function cardHtml(item) {
        var mt = item.mediaType;
        if (mt === "person" || mt === "network") return "";
        var title = mt === "movie" ? item.title : (item.name || item.title);
        var year = (mt === "movie" ? item.releaseDate : (item.firstAirDate || "")) || "";
        year = year ? String(year).slice(0, 4) : "";
        var st = item.mediaInfo ? item.mediaInfo.status : 0;
        var poster = item.posterPath ? TMDB + item.posterPath : "";
        var tid = item.tmdbId || item.id || 0;
        var btn = (st >= 2 && st <= 5)
            ? ""
            : '<button type="button" class="seerr-reqbtn seerr-req" data-mt="' + esc(mt) + '" data-id="' + tid + '">Request</button>';
        return (
            '<div class="seerr-card" tabindex="0" data-mt="' + esc(mt) + '" data-tid="' + tid + '" data-title="' + esc(title) + '">' +
            '<div class="seerr-poster">' +
            (poster ? '<img loading="lazy" src="' + poster + '" alt="">' : '<div class="seerr-noposter">🎬</div>') +
            "</div>" +
            '<div class="seerr-meta"><span class="seerr-t">' + esc(title) + "</span>" +
            (year ? '<span class="seerr-y">' + esc(year) + "</span>" : "") +
            badgeFor(st) + btn +
            "</div></div>"
        );
    }

    var SHELL =
        '<div class="seerr-tab padded-left padded-left-page padded-right padded-top padded-bottom" style="width:100%;box-sizing:border-box;">' +
        '<div class="flex align-items-center" style="gap:10px;margin-bottom:12px;flex-wrap:wrap;">' +
        '<h2 style="margin:0;flex:1 1 auto;">Requests</h2>' +
        '<span class="seerr-status secondaryText" style="font-size:12px;">● …</span>' +
        "</div>" +
        '<div class="flex align-items-center" style="gap:8px;margin-bottom:14px;flex-wrap:wrap;">' +
        '<input class="seerr-search" type="search" placeholder="Search movies &amp; shows..." ' +
        'style="flex:1 1 220px;min-width:160px;padding:10px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.25);color:inherit;font-size:15px;" />' +
        '<button type="button" class="seerr-btn-search" style="padding:10px 16px;border-radius:8px;border:0;background:var(--theme-primary-color,#52b54b);color:#fff;font-weight:700;cursor:pointer;">Search</button>' +
        "</div>" +
        '<div class="seerr-tabs flex align-items-center" style="gap:6px;margin-bottom:16px;flex-wrap:wrap;">' +
        '<button type="button" class="seerr-tabbtn on" data-tab="trending">Trending</button>' +
        '<button type="button" class="seerr-tabbtn" data-tab="search">Search</button>' +
        '<button type="button" class="seerr-tabbtn" data-tab="mine">Recent</button>' +
        "</div>" +
        '<div class="seerr-content"><p class="secondaryText" style="text-align:center;margin:40px 16px;">Loading…</p></div>' +
        '<div class="seerr-more hide" style="text-align:center;margin:18px 0;"><button type="button" class="seerr-btn-more">More</button></div>' +
        '<style>' +
        ".seerr-tab .seerr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px}" +
        ".seerr-tab .seerr-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;cursor:pointer}" +
        ".seerr-tab .seerr-card:focus{outline:3px solid var(--theme-primary-color,#52b54b);outline-offset:2px}" +
        ".seerr-tab .seerr-poster{position:relative;width:100%;aspect-ratio:2/3;background:#222}" +
        ".seerr-tab .seerr-poster img{width:100%;height:100%;object-fit:cover;display:block}" +
        ".seerr-tab .seerr-noposter{width:100%;height:100%;display:flex;align-items:center;justify-content:center;opacity:.4;font-size:28px}" +
        ".seerr-tab .seerr-meta{padding:8px 10px 10px;display:flex;flex-direction:column;gap:6px;flex:1}" +
        ".seerr-tab .seerr-t{font-size:13px;font-weight:600;line-height:1.25;max-height:34px;overflow:hidden}" +
        ".seerr-tab .seerr-y{font-size:11px;opacity:.65}" +
        ".seerr-tab .seerr-badge{align-self:flex-start;font-size:10px;font-weight:800;letter-spacing:.4px;padding:3px 8px;border-radius:99px;text-transform:uppercase}" +
        ".seerr-tab .seerr-b-req{background:#e0a63c;color:#231a05}" +
        ".seerr-tab .seerr-b-proc{background:#4a90d9;color:#fff}" +
        ".seerr-tab .seerr-b-part{background:#2fa6a0;color:#fff}" +
        ".seerr-tab .seerr-b-ok{background:#3fb26f;color:#03130a}" +
        ".seerr-tab .seerr-reqbtn{margin-top:auto;width:100%;border:0;border-radius:8px;padding:9px 0;font-size:13px;font-weight:700;color:#fff;background:var(--theme-primary-color,#52b54b);cursor:pointer}" +
        ".seerr-tab .seerr-tabbtn{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:inherit;padding:7px 14px;border-radius:99px;font-size:13px;cursor:pointer}" +
        ".seerr-tab .seerr-tabbtn.on{background:var(--theme-primary-color,#52b54b);border-color:transparent;color:#fff}" +
        ".seerr-tab .seerr-status.on{color:#3fb26f}" +
        ".seerr-tab .seerr-status.off{color:#d95c5c}" +
        ".seerr-tab .hide{display:none!important}" +
        ".seerr-tab .seerr-btn-more{padding:10px 26px;border-radius:99px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:inherit;font-weight:700;cursor:pointer}" +
        "</style></div>";

    function SeerrTab(view) {
        this.view = view;
        this.trendPage = 1;
        this.busy = false;
        this._built = false;
        this._onClick = null;
        this._onSearch = null;
    }

    function setTab(root, name) {
        root.querySelectorAll(".seerr-tabbtn").forEach(function (b) {
            b.classList.toggle("on", b.getAttribute("data-tab") === name);
        });
    }

    SeerrTab.prototype._root = function () {
        return this.view && (this.view.querySelector(".seerr-tab") || this.view);
    };

    SeerrTab.prototype._ensure = function () {
        if (!this.view || this._built) return;
        this.view.innerHTML = SHELL;
        var root = this._root();
        var self = this;

        this._onClick = function (e) {
            var t = e.target;
            if (t.closest && t.closest(".seerr-btn-search")) {
                var q = (root.querySelector(".seerr-search").value || "").trim();
                if (q.length >= 2) {
                    setTab(root, "search");
                    self.doSearch(q);
                }
                return;
            }
            if (t.closest && t.closest(".seerr-btn-more")) {
                self.doTrending(true);
                return;
            }
            var tabBtn = t.closest && t.closest(".seerr-tabbtn");
            if (tabBtn) {
                var tab = tabBtn.getAttribute("data-tab");
                setTab(root, tab);
                if (tab === "trending") self.doTrending(false);
                else if (tab === "search") {
                    root.querySelector(".seerr-search").focus();
                    self.showHint("Type to search for movies and TV shows.");
                } else self.doRecent();
                return;
            }
            var req = t.closest && t.closest(".seerr-req");
            if (req) {
                e.preventDefault();
                e.stopPropagation();
                self.request(req, req.getAttribute("data-mt"), parseInt(req.getAttribute("data-id"), 10));
            }
        };
        root.addEventListener("click", this._onClick);

        var timer = null;
        this._onSearch = function () {
            clearTimeout(timer);
            var v = this.value.trim();
            timer = setTimeout(function () {
                if (v.length >= 2) {
                    setTab(root, "search");
                    self.doSearch(v);
                }
            }, 420);
        };
        root.querySelector(".seerr-search").addEventListener("input", this._onSearch);
        root.querySelector(".seerr-search").addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                root.querySelector(".seerr-btn-search").click();
            }
        });

        this._built = true;
    };

    SeerrTab.prototype.showHint = function (msg) {
        var root = this._root();
        var c = root.querySelector(".seerr-content");
        if (!c) return;
        c.innerHTML = '<p class="secondaryText" style="text-align:center;margin:40px 16px;">' + esc(msg) + "</p>";
        var more = root.querySelector(".seerr-more");
        if (more) more.classList.add("hide");
    };

    SeerrTab.prototype.showGrid = function (html, append) {
        var root = this._root();
        var c = root.querySelector(".seerr-content");
        if (!c) return;
        if (!html) {
            if (!append) this.showHint("Nothing to show.");
            return;
        }
        if (append) c.insertAdjacentHTML("beforeend", '<div class="seerr-grid">' + html + "</div>");
        else c.innerHTML = '<div class="seerr-grid">' + html + "</div>";
    };

    SeerrTab.prototype.ping = function () {
        var root = this._root();
        var el = root.querySelector(".seerr-status");
        return seerrGet("Ping").then(function (d) {
            var ok = d && d.ok === true;
            if (el) {
                el.textContent = ok ? "● online" : "● offline";
                el.classList.toggle("on", ok);
                el.classList.toggle("off", !ok);
            }
        }).catch(function () {
            if (el) {
                el.textContent = "● offline";
                el.classList.add("off");
                el.classList.remove("on");
            }
        });
    };

    SeerrTab.prototype.doTrending = function (append) {
        var self = this;
        if (self.busy) return;
        self.busy = true;
        var root = self._root();
        if (!append) {
            self.trendPage = 1;
            if (loading && loading.show) loading.show();
            var c = root.querySelector(".seerr-content");
            if (c) c.innerHTML = '<p class="secondaryText" style="text-align:center;margin:40px 16px;">Loading trending…</p>';
        }
        seerrGet("Discover", { page: self.trendPage }).then(function (d) {
            if (loading && loading.hide) loading.hide();
            self.busy = false;
            if (!d || !d.results) {
                if (!append) self.showHint("Could not load trending. Is the plugin configured?");
                return;
            }
            var html = d.results.map(cardHtml).join("");
            if (!html && !append) {
                self.showHint("Nothing trending right now.");
                return;
            }
            self.showGrid(html, append);
            self.trendPage += 1;
            var more = root.querySelector(".seerr-more");
            if (more) more.classList.remove("hide");
        }).catch(function () {
            if (loading && loading.hide) loading.hide();
            self.busy = false;
            if (!append) self.showHint("Could not load trending.");
        });
    };

    SeerrTab.prototype.doSearch = function (q) {
        var self = this;
        if (self.busy) return;
        self.busy = true;
        if (loading && loading.show) loading.show();
        var root = self._root();
        var more = root.querySelector(".seerr-more");
        if (more) more.classList.add("hide");
        var c = root.querySelector(".seerr-content");
        if (c) c.innerHTML = '<p class="secondaryText" style="text-align:center;margin:40px 16px;">Searching…</p>';
        seerrGet("Search", { query: q }).then(function (d) {
            if (loading && loading.hide) loading.hide();
            self.busy = false;
            if (!d || !d.results) {
                self.showHint("Search failed. Is the plugin configured?");
                return;
            }
            var html = d.results.map(cardHtml).join("");
            if (!html) self.showHint('No results for "' + q + '".');
            else self.showGrid(html, false);
        }).catch(function () {
            if (loading && loading.hide) loading.hide();
            self.busy = false;
            self.showHint("Search failed.");
        });
    };

    SeerrTab.prototype.doRecent = function () {
        var self = this;
        if (self.busy) return;
        self.busy = true;
        if (loading && loading.show) loading.show();
        var root = self._root();
        var more = root.querySelector(".seerr-more");
        if (more) more.classList.add("hide");
        seerrGet("Requests", { take: 24, skip: 0 }).then(function (d) {
            if (loading && loading.hide) loading.hide();
            self.busy = false;
            if (!d || !d.results) {
                self.showHint("Could not load requests.");
                return;
            }
            if (!d.results.length) {
                self.showHint("No requests yet.");
                return;
            }
            var html = d.results.map(function (req) {
                var m = req.media || {};
                var title = req.is4k ? (m.title4k || m.title) : (m.title || m.name);
                var poster = (req.is4k ? (m.posterPath4k || m.posterPath) : m.posterPath) || "";
                var who = req.requestedBy && req.requestedBy.displayName
                    ? '<span class="seerr-y">by ' + esc(req.requestedBy.displayName) + "</span>"
                    : "";
                var st = req.status === 1 ? 2 : (req.status === 2 ? 3 : req.status === 3 ? 5 : 2);
                return (
                    '<div class="seerr-card" tabindex="0">' +
                    '<div class="seerr-poster">' +
                    (poster ? '<img loading="lazy" src="' + TMDB + poster + '" alt="">' : '<div class="seerr-noposter">🎬</div>') +
                    "</div>" +
                    '<div class="seerr-meta"><span class="seerr-t">' + esc(title) + "</span>" +
                    who + badgeFor(st) + "</div></div>"
                );
            }).join("");
            self.showGrid(html, false);
        }).catch(function () {
            if (loading && loading.hide) loading.hide();
            self.busy = false;
            self.showHint("Could not load requests.");
        });
    };

    SeerrTab.prototype.request = function (btn, mt, id) {
        if (!id) return;
        btn.disabled = true;
        var prev = btn.textContent;
        btn.textContent = "Sending…";
        seerrPost("Request", { mediaType: mt, mediaId: id }).then(function () {
            btn.outerHTML = '<span class="seerr-badge seerr-b-req">Pending</span>';
        }).catch(function () {
            btn.disabled = false;
            btn.textContent = prev || "Retry";
        });
    };

    SeerrTab.prototype.onResume = function () {
        this._ensure();
        this.ping();
        setTab(this._root(), "trending");
        this.doTrending(false);
    };

    SeerrTab.prototype.onPause = function () { };

    SeerrTab.prototype.destroy = function () {
        if (this.view && this._onClick) {
            try { this._root().removeEventListener("click", this._onClick); } catch (e) { /* ignore */ }
        }
        this.view = null;
        this._built = false;
    };

    _exports.default = SeerrTab;
});
