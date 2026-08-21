using System;
using System.IO;
using System.Reflection;

namespace Emby.Plugin.Seerr.Ui
{
    /// <summary>
    /// Serves the embedded single-page request UI (Ui.index.html).
    /// </summary>
    public static class UiPage
    {
        private const string ResourceName = "Emby.Plugin.Seerr.Ui.index.html";
        private static string _cached;

        public static string Html
        {
            get
            {
                if (_cached != null) return _cached;
                var asm = typeof(UiPage).GetTypeInfo().Assembly;
                using (var stream = asm.GetManifestResourceStream(ResourceName))
                {
                    if (stream == null)
                    {
                        return "<html><body><h3>UI resource missing</h3></body></html>";
                    }
                    using (var reader = new StreamReader(stream))
                    {
                        _cached = reader.ReadToEnd();
                    }
                }
                return _cached;
            }
        }
    }
}
