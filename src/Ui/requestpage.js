define(['baseView', 'emby-scroller'], function (BaseView) {
    'use strict';

    function View(view, params) {
        BaseView.apply(this, arguments);

        var host = view.querySelector('#seerrReqHost') || view;
        var f = document.createElement('iframe');
        f.src = '/emby/Seerr/Ui';
        f.setAttribute('allow', 'fullscreen');
        f.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#0f1115';
        host.appendChild(f);
        this.frame = f;
    }

    Object.assign(View.prototype, BaseView.prototype);

    View.prototype.onResume = function () {
        BaseView.prototype.onResume.apply(this, arguments);
        if (this.frame && !this.frame.src) {
            this.frame.src = '/emby/Seerr/Ui';
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
