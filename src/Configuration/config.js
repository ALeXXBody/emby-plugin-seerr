define(['baseView', 'dom', 'loading', 'globalize', 'emby-input', 'emby-button', 'emby-scroller'], function (BaseView, dom, loading, globalize) {
    'use strict';

    var pid = '6f2b9c4e-1d5a-4f83-9e07-2c8b41d0a77e';

    function loadPage(page, config) {
        page.querySelector('#SeerrUrl').value = config.SeerrUrl || '';
        page.querySelector('#SeerrApiKey').value = config.SeerrApiKey || '';
        page.querySelector('#AllowedUsers').value = config.AllowedUsers || '';
        loading.hide();
    }

    function View(view, params) {
        BaseView.apply(this, arguments);

        var self = this;

        view.querySelector('form.seerrConfigForm').addEventListener('submit', function (e) {
            e.preventDefault();
            e.stopPropagation();
            loading.show();

            ApiClient.getPluginConfiguration(pid).then(function (config) {
                config.SeerrUrl = self.view.querySelector('#SeerrUrl').value.trim();
                config.SeerrApiKey = self.view.querySelector('#SeerrApiKey').value.trim();
                config.AllowedUsers = self.view.querySelector('#AllowedUsers').value.trim();

                ApiClient.updatePluginConfiguration(pid, config).then(Dashboard.processServerConfigurationUpdateResult);
            });
        });
    }

    Object.assign(View.prototype, BaseView.prototype);

    View.prototype.onResume = function (options) {

        BaseView.prototype.onResume.apply(this, arguments);

        loading.show();

        var page = this.view;

        ApiClient.getPluginConfiguration(pid).then(function (config) {
            loadPage(page, config);
        });
    };

    return View;
});
