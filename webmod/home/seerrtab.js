define(["exports"], function (_exports) {
    /**
     * Home "Requests" tab: navigate into the permanent plugin page
     * (configurationpage?name=seerrreq) which is a real Emby BaseView —
     * no iframe, uses ApiClient auth.
     */
    function SeerrTab(view) {
        this.view = view;
        if (view) {
            view.innerHTML =
                '<div class="padded-left padded-right padded-top padded-bottom" style="text-align:center;margin-top:40px;">' +
                '<p class="secondaryText">Opening Requests…</p>' +
                '</div>';
        }
        this._go();
    }

    SeerrTab.prototype._go = function () {
        try {
            if (typeof Emby !== 'undefined' && Emby.importModule) {
                Emby.importModule('./modules/approuter.js').then(function (appRouter) {
                    var r = appRouter && (appRouter.default || appRouter);
                    if (r && r.show) {
                        r.show('configurationpage?name=seerrreq');
                        return;
                    }
                    window.location.hash = '#!/configurationpage?name=seerrreq';
                }).catch(function () {
                    window.location.hash = '#!/configurationpage?name=seerrreq';
                });
                return;
            }
        } catch (e) { /* fall through */ }
        window.location.hash = '#!/configurationpage?name=seerrreq';
    };

    SeerrTab.prototype.onResume = function () {
        this._go();
    };
    SeerrTab.prototype.onPause = function () { };
    SeerrTab.prototype.destroy = function () {
        this.view = null;
    };

    _exports.default = SeerrTab;
});
