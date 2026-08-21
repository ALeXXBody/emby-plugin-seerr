using System;
using System.Collections.Generic;
using Emby.Plugin.Seerr.Configuration;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Emby.Plugin.Seerr
{
    public class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
    {
        public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
            : base(applicationPaths, xmlSerializer)
        {
            Instance = this;
        }

        public static Plugin Instance { get; private set; }

        public override Guid Id => new Guid("6f2b9c4e-1d5a-4f83-9e07-2c8b41d0a77e");

        public override string Name => "Seerr Requests";

        public override string Description =>
            "Search Seerr (Overseerr/Jellyseerr) and request movies & shows. " +
            "Open /emby/Seerr/Ui in any browser - on phones use 'Add to Home Screen' for an app-like experience.";

        // Dashboard pages: main config page (Settings button) + request UI link
        public IEnumerable<PluginPageInfo> GetPages()
        {
            return new[]
            {
                new PluginPageInfo
                {
                    Name = "seerrconfig",
                    DisplayName = "Seerr Requests",
                    EmbeddedResourcePath = "Emby.Plugin.Seerr.Configuration.config.html",
                    EnableInMainMenu = true,
                    EnableInUserMenu = false,
                    MenuSection = "advanced",
                    IsMainConfigPage = true
                },
                new PluginPageInfo
                {
                    Name = "seerrconfigjs",
                    DisplayName = "Seerr Requests",
                    EmbeddedResourcePath = "Emby.Plugin.Seerr.Configuration.config.js",
                    EnableInMainMenu = false,
                    EnableInUserMenu = false,
                    MenuSection = "",
                    IsMainConfigPage = false
                },
                // Permanent in-app Requests page (native Emby dashboard view, no iframe).
                // Appears in user menu via EnableInUserMenu; sidebar webmod links here too.
                new PluginPageInfo
                {
                    Name = "seerrreq",
                    DisplayName = "Requests",
                    EmbeddedResourcePath = "Emby.Plugin.Seerr.Ui.requestpage.html",
                    EnableInMainMenu = false,
                    EnableInUserMenu = true,
                    MenuIcon = "movie_filter",
                    MenuSection = "",
                    IsMainConfigPage = false
                },
                new PluginPageInfo
                {
                    Name = "seerrreqjs",
                    DisplayName = "Requests",
                    EmbeddedResourcePath = "Emby.Plugin.Seerr.Ui.requestpage.js",
                    EnableInMainMenu = false,
                    EnableInUserMenu = false,
                    MenuSection = "",
                    IsMainConfigPage = false
                },
                // Standalone full-page UI still available at /emby/Seerr/Ui (phones / TV browsers)
                new PluginPageInfo
                {
                    Name = "seerrui",
                    DisplayName = "Seerr Requests",
                    EmbeddedResourcePath = "Emby.Plugin.Seerr.Ui.index.html",
                    EnableInMainMenu = false,
                    EnableInUserMenu = false,
                    MenuSection = "",
                    IsMainConfigPage = false
                }
            };
        }
    }
}
