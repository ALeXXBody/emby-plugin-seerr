define(['baseView', 'emby-scroller'], function (BaseView) {
    'use strict';

    function accessToken() {
        try {
            if (typeof ApiClient !== 'undefined' && ApiClient.accessToken) {
                return ApiClient.accessToken() || '';
            }
        } catch (e) { /* ignore */ }
        return '';
    }

    function uiUrl() {
        var url = '/emby/Seerr/Ui';
        var t = accessToken();
        if (t) {
            url += '?api_key=' + encodeURIComponent(t);
        }
        return url;
    }

    function View(view, params) {
        BaseView.apply(this, arguments);

        var host = view.querySelector('#seerrReqHost') || view;
        host.style.cssText = 'position:relative;flex:1 1 auto;min-height:0;height:100%;width:100%;';

        var f = document.createElement('iframe');
        f.src = uiUrl();
        f.setAttribute('allow', 'fullscreen');
        f.setAttribute('title', 'Requests');
        f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:#0f1115';
        host.appendChild(f);
        this.frame = f;
    }

    Object.assign(View.prototype, BaseView.prototype);

    View.prototype.onResume = function () {
        BaseView.prototype.onResume.apply(this, arguments);
        if (this.frame && (!this.frame.src || this.frame.src === 'about:blank')) {
            this.frame.src = uiUrl();
        }
    };

    View.prototype.onPause = function () {
        BaseView.prototype.onPause.apply(this, arguments);
    };

    View.prototype.destroy = function () {
        if (this.frame) {
            this.frame.remove();
            this.frame = null;
        }
        BaseView.prototype.destroy.apply(this, arguments);
    };

    return View;
});
