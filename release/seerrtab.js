define(["exports"], function (_exports) {
    function accessToken() {
        try {
            if (typeof ApiClient !== "undefined" && ApiClient.accessToken) {
                return ApiClient.accessToken() || "";
            }
        } catch (e) { /* ignore */ }
        return "";
    }

    function uiUrl() {
        var url = "/emby/Seerr/Ui";
        var t = accessToken();
        if (t) {
            url += "?api_key=" + encodeURIComponent(t);
        }
        return url;
    }

    function SeerrTab(view) {
        this.view = view;
        this.iframe = null;
        if (view) {
            view.style.cssText = (view.getAttribute("style") || "") +
                ";position:relative;flex:1 1 auto;min-height:0;height:100%;width:100%;";
        }
        var f = document.createElement("iframe");
        f.src = uiUrl();
        f.setAttribute("allow", "fullscreen");
        f.setAttribute("title", "Requests");
        f.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#0f1115";
        (view || document.body).appendChild(f);
        this.iframe = f;
    }
    SeerrTab.prototype.onResume = function () {
        if (this.iframe && (!this.iframe.src || this.iframe.src === "about:blank")) {
            this.iframe.src = uiUrl();
        }
    };
    SeerrTab.prototype.onPause = function () { };
    SeerrTab.prototype.destroy = function () {
        if (this.iframe) {
            this.iframe.remove();
            this.iframe = null;
        }
    };
    _exports.default = SeerrTab;
});
