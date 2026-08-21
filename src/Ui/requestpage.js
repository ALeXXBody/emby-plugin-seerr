define([
    'baseView',
    'loading',
    'emby-input',
    'emby-button',
    'emby-scroller'
], function (BaseView, loading) {
    'use strict';

    var TMDB = 'https://image.tmdb.org/t/p/w200';

    function notify(msg) {
        try {
            if (typeof Dashboard !== 'undefined' && Dashboard.alert) {
                // keep silent in-page; log for diagnostics
            }
        } catch (e) { /* ignore */ }
        if (window.console && console.log) console.log('[Seerr]', msg);
    }

    function apiClient() {
        if (typeof ApiClient !== 'undefined' && ApiClient) return ApiClient;
        throw new Error('ApiClient not available');
    }

    function seerrUrl(path, query) {
        return apiClient().getUrl('Seerr/' + String(path || '').replace(/^\/+/, ''), query || {});
    }

    function seerrGet(path, query) {
        return apiClient().getJSON(seerrUrl(path, query));
    }

    function seerrPost(path, body) {
        return apiClient().ajax({
            type: 'POST',
            url: seerrUrl(path),
            data: JSON.stringify(body || {}),
            contentType: 'application/json',
            dataType: 'json'
        });
    }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function badgeFor(st) {
        if (st === 5) return '<span class="seerr-badge seerr-b-ok">Available</span>';
        if (st === 4) return '<span class="seerr-badge seerr-b-part">Partial</span>';
        if (st === 3) return '<span class="seerr-badge seerr-b-proc">Processing</span>';
        if (st === 2) return '<span class="seerr-badge seerr-b-req">Pending</span>';
        return '';
    }

    function cardHtml(item) {
        var mt = item.mediaType;
        if (mt === 'person' || mt === 'network') return '';
        var title = mt === 'movie' ? item.title : (item.name || item.title);
        var year = (mt === 'movie' ? item.releaseDate : (item.firstAirDate || '')) || '';
        year = year ? String(year).slice(0, 4) : '';
        var st = item.mediaInfo ? item.mediaInfo.status : 0;
        var poster = item.posterPath ? TMDB + item.posterPath : '';
        var tid = item.tmdbId || item.id || 0;
        var btn = (st >= 2 && st <= 5)
            ? ''
            : '<button is="emby-button" type="button" class="raised button-submit block seerr-reqbtn seerr-req" data-mt="' + esc(mt) + '" data-id="' + tid + '"><span>Request</span></button>';
        return (
            '<div class="seerr-card" tabindex="0" data-mt="' + esc(mt) + '" data-tid="' + tid + '" data-title="' + esc(title) + '">' +
            '<div class="seerr-poster">' +
            (poster
                ? '<img loading="lazy" src="' + poster + '" alt="">'
                : '<div class="seerr-noposter">🎬</div>') +
            '</div>' +
            '<div class="seerr-meta"><span class="seerr-t">' + esc(title) + '</span>' +
            (year ? '<span class="seerr-y">' + esc(year) + '</span>' : '') +
            badgeFor(st) + btn +
            '</div></div>'
        );
    }

    function setTab(view, name) {
        view.querySelectorAll('.seerrTab').forEach(function (b) {
            if (b.getAttribute('data-tab') === name) b.classList.add('on');
            else b.classList.remove('on');
        });
    }

    function setStatus(view, ok) {
        var el = view.querySelector('#seerrStatusDot');
        if (!el) return;
        el.textContent = ok ? '● online' : '● offline';
        el.classList.toggle('on', !!ok);
        el.classList.toggle('off', !ok);
    }

    function View(view, params) {
        BaseView.apply(this, arguments);
        var self = this;
        this.trendPage = 1;
        this.busy = false;

        view.querySelector('#seerrBtnSearch').addEventListener('click', function () {
            var q = (view.querySelector('#seerrSearch').value || '').trim();
            if (q.length >= 2) {
                setTab(view, 'search');
                self.doSearch(q);
            }
        });

        view.querySelector('#seerrSearch').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                view.querySelector('#seerrBtnSearch').click();
            }
        });

        var searchTimer = null;
        view.querySelector('#seerrSearch').addEventListener('input', function () {
            clearTimeout(searchTimer);
            var v = this.value.trim();
            searchTimer = setTimeout(function () {
                if (v.length >= 2) {
                    setTab(view, 'search');
                    self.doSearch(v);
                }
            }, 420);
        });

        view.querySelectorAll('.seerrTab').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var tab = btn.getAttribute('data-tab');
                setTab(view, tab);
                if (tab === 'trending') self.doTrending(false);
                else if (tab === 'search') {
                    view.querySelector('#seerrSearch').focus();
                    self.showHint('Type to search for movies and TV shows.');
                } else self.doRecent();
            });
        });

        view.querySelector('#seerrBtnMore').addEventListener('click', function () {
            self.doTrending(true);
        });

        view.querySelector('#seerrModalClose').addEventListener('click', function () {
            self.closeModal();
        });
        view.querySelector('#seerrModal').addEventListener('click', function (e) {
            if (e.target === this) self.closeModal();
        });

        // event delegation for cards + request buttons
        view.querySelector('#seerrContent').addEventListener('click', function (e) {
            var req = e.target.closest('.seerr-req');
            if (req) {
                e.preventDefault();
                e.stopPropagation();
                self.request(req, req.getAttribute('data-mt'), parseInt(req.getAttribute('data-id'), 10));
                return;
            }
            var card = e.target.closest('.seerr-card');
            if (card) {
                self.openRecs(card);
            }
        });

        view.querySelector('#seerrModalBody').addEventListener('click', function (e) {
            var req = e.target.closest('.seerr-req');
            if (req) {
                e.preventDefault();
                e.stopPropagation();
                self.request(req, req.getAttribute('data-mt'), parseInt(req.getAttribute('data-id'), 10));
                return;
            }
            var card = e.target.closest('.seerr-card');
            if (card) self.openRecs(card);
        });
    }

    Object.assign(View.prototype, BaseView.prototype);

    View.prototype.showHint = function (msg) {
        var c = this.view.querySelector('#seerrContent');
        c.innerHTML = '<p class="secondaryText" style="text-align:center;margin:40px 16px;">' + esc(msg) + '</p>';
        this.view.querySelector('#seerrMoreWrap').classList.add('hide');
    };

    View.prototype.showGrid = function (html, append) {
        var c = this.view.querySelector('#seerrContent');
        if (!html) {
            if (!append) this.showHint('Nothing to show.');
            return;
        }
        if (append) {
            c.insertAdjacentHTML('beforeend', '<div class="seerr-grid">' + html + '</div>');
        } else {
            c.innerHTML = '<div class="seerr-grid">' + html + '</div>';
        }
    };

    View.prototype.ping = function () {
        var view = this.view;
        return seerrGet('Ping').then(function (d) {
            setStatus(view, d && d.ok === true);
        }).catch(function () {
            setStatus(view, false);
        });
    };

    View.prototype.doTrending = function (append) {
        var self = this;
        if (self.busy) return;
        self.busy = true;
        if (!append) {
            self.trendPage = 1;
            loading.show();
            self.view.querySelector('#seerrContent').innerHTML =
                '<p class="secondaryText" style="text-align:center;margin:40px 16px;">Loading trending…</p>';
        }
        seerrGet('Discover', { page: self.trendPage }).then(function (d) {
            loading.hide();
            self.busy = false;
            if (!d || !d.results) {
                if (!append) self.showHint('Could not load trending. Is the plugin configured?');
                return;
            }
            var html = d.results.map(cardHtml).join('');
            if (!html && !append) {
                self.showHint('Nothing trending right now.');
                return;
            }
            self.showGrid(html, append);
            self.trendPage += 1;
            self.view.querySelector('#seerrMoreWrap').classList.remove('hide');
        }).catch(function (err) {
            loading.hide();
            self.busy = false;
            if (!append) self.showHint('Could not load trending (' + (err && err.status ? err.status : 'error') + ').');
        });
    };

    View.prototype.doSearch = function (q) {
        var self = this;
        if (self.busy) return;
        self.busy = true;
        loading.show();
        self.view.querySelector('#seerrMoreWrap').classList.add('hide');
        self.view.querySelector('#seerrContent').innerHTML =
            '<p class="secondaryText" style="text-align:center;margin:40px 16px;">Searching…</p>';
        seerrGet('Search', { query: q }).then(function (d) {
            loading.hide();
            self.busy = false;
            if (!d || !d.results) {
                self.showHint('Search failed. Is the plugin configured?');
                return;
            }
            var html = d.results.map(cardHtml).join('');
            if (!html) self.showHint('No results for "' + q + '".');
            else self.showGrid(html, false);
        }).catch(function () {
            loading.hide();
            self.busy = false;
            self.showHint('Search failed.');
        });
    };

    View.prototype.doRecent = function () {
        var self = this;
        if (self.busy) return;
        self.busy = true;
        loading.show();
        self.view.querySelector('#seerrMoreWrap').classList.add('hide');
        seerrGet('Requests', { take: 24, skip: 0 }).then(function (d) {
            loading.hide();
            self.busy = false;
            if (!d || !d.results) {
                self.showHint('Could not load requests.');
                return;
            }
            if (!d.results.length) {
                self.showHint('No requests yet.');
                return;
            }
            var html = d.results.map(function (req) {
                var m = req.media || {};
                var title = req.is4k ? (m.title4k || m.title) : (m.title || m.name);
                var poster = (req.is4k ? (m.posterPath4k || m.posterPath) : m.posterPath) || '';
                var who = req.requestedBy && req.requestedBy.displayName
                    ? '<span class="seerr-y">by ' + esc(req.requestedBy.displayName) + '</span>'
                    : '';
                var st = req.status === 1 ? 2 : (req.status === 2 ? 3 : req.status === 3 ? 5 : 2);
                return (
                    '<div class="seerr-card" tabindex="0">' +
                    '<div class="seerr-poster">' +
                    (poster
                        ? '<img loading="lazy" src="' + TMDB + poster + '" alt="">'
                        : '<div class="seerr-noposter">🎬</div>') +
                    '</div>' +
                    '<div class="seerr-meta"><span class="seerr-t">' + esc(title) + '</span>' +
                    who + badgeFor(st) + '</div></div>'
                );
            }).join('');
            self.showGrid(html, false);
        }).catch(function () {
            loading.hide();
            self.busy = false;
            self.showHint('Could not load requests.');
        });
    };

    View.prototype.request = function (btn, mt, id) {
        if (!id) return;
        var label = btn.querySelector('span') || btn;
        btn.disabled = true;
        label.textContent = 'Sending…';
        seerrPost('Request', { mediaType: mt, mediaId: id }).then(function () {
            btn.outerHTML = '<span class="seerr-badge seerr-b-req">Pending</span>';
            notify('Request sent to Seerr');
        }).catch(function (err) {
            btn.disabled = false;
            label.textContent = 'Retry';
            var msg = 'Request failed';
            try {
                if (err && err.responseText) {
                    var j = JSON.parse(err.responseText);
                    if (j && j.error) msg = j.error;
                }
            } catch (e) { /* ignore */ }
            notify(msg);
        });
    };

    View.prototype.openRecs = function (el) {
        var mt = el.getAttribute('data-mt');
        var tid = el.getAttribute('data-tid');
        var title = el.getAttribute('data-title') || '';
        if (!tid || tid === '0') return;

        var modal = this.view.querySelector('#seerrModal');
        var body = this.view.querySelector('#seerrModalBody');
        this.view.querySelector('#seerrModalTitle').textContent = title;
        this.view.querySelector('#seerrModalSub').textContent = 'Recommended because of ' + title;
        body.innerHTML = '<p class="secondaryText" style="text-align:center;">Loading…</p>';
        modal.classList.remove('hide');

        seerrGet('Recommended', { mediaType: mt, tmdbId: parseInt(tid, 10) }).then(function (d) {
            if (!d || !d.results) {
                body.innerHTML = '<p class="secondaryText">No recommendations found.</p>';
                return;
            }
            var html = d.results.map(cardHtml).join('');
            body.innerHTML = html
                ? '<div class="seerr-grid">' + html + '</div>'
                : '<p class="secondaryText">No recommendations for this title yet.</p>';
        }).catch(function () {
            body.innerHTML = '<p class="secondaryText">Failed to load recommendations.</p>';
        });
    };

    View.prototype.closeModal = function () {
        var modal = this.view.querySelector('#seerrModal');
        modal.classList.add('hide');
        this.view.querySelector('#seerrModalBody').innerHTML = '';
    };

    View.prototype.onResume = function (options) {
        BaseView.prototype.onResume.apply(this, arguments);
        this.ping();
        // refresh content when first shown or forced
        if (!options || options.refresh !== false) {
            setTab(this.view, 'trending');
            this.doTrending(false);
        }
    };

    View.prototype.onPause = function () {
        this.closeModal();
        BaseView.prototype.onPause.apply(this, arguments);
    };

    View.prototype.destroy = function () {
        this.closeModal();
        BaseView.prototype.destroy.apply(this, arguments);
    };

    return View;
});
