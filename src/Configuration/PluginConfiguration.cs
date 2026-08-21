using MediaBrowser.Model.Plugins;

namespace Emby.Plugin.Seerr.Configuration
{
    public class PluginConfiguration : BasePluginConfiguration
    {
        /// <summary>
        /// Base URL of the Seerr (Overseerr/Jellyseerr) instance.
        /// </summary>
        public string SeerrUrl { get; set; } = "";

        /// <summary>
        /// Seerr API key (Settings - General - API Key).
        /// </summary>
        public string SeerrApiKey { get; set; } = "";

        /// <summary>
        /// Optional: restrict who can see/use the request UI.
        /// Comma separated Emby user names. Empty = everyone.
        /// </summary>
        public string AllowedUsers { get; set; } = "";
    }
}
