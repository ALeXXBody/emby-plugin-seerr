define(["exports"], function (_exports) {
    function SeerrTab(view) {
        this.view = view;
        this.iframe = null;
        var f = document.createElement("iframe");
        f.src = "/emby/Seerr/Ui";
        f.setAttribute("allow", "fullscreen");
        f.style.cssText = "width:100%;height:100%;border:0;display:block;background:#0f1115";
        (view || document.body).appendChild(f);
        this.iframe = f;
    }
    SeerrTab.prototype.onResume = function () {
        if (this.iframe && !this.iframe.src) {
            this.iframe.src = "/emby/Seerr/Ui";
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
