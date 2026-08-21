using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;

namespace Emby.Plugin.Seerr.Seerr
{
    /// <summary>
    /// Minimal HTTP client for the Seerr API (v1).
    /// Responses are passed through as raw JSON strings.
    /// </summary>
    public static class SeerrClient
    {
        private static readonly HttpClient Http = new HttpClient(new HttpClientHandler
        {
            AutomaticDecompression = System.Net.DecompressionMethods.GZip | System.Net.DecompressionMethods.Deflate
        })
        {
            Timeout = TimeSpan.FromSeconds(25)
        };

        public sealed class Reply
        {
            public int Status;
            public string Body;
        }

        private static string BaseUrl()
        {
            var url = Plugin.Instance.Configuration.SeerrUrl ?? "";
            return url.TrimEnd('/');
        }

        private static string ApiKey()
        {
            return Plugin.Instance.Configuration.SeerrApiKey ?? "";
        }

        public static async Task<Reply> GetAsync(string pathAndQuery)
        {
            using (var req = new HttpRequestMessage(HttpMethod.Get, BaseUrl() + pathAndQuery))
            {
                req.Headers.Add("X-Api-Key", ApiKey());
                req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                var resp = await Http.SendAsync(req).ConfigureAwait(false);
                var body = resp.Content == null ? "" : await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                return new Reply { Status = (int)resp.StatusCode, Body = body };
            }
        }

        public static async Task<Reply> PostJsonAsync(string path, string jsonBody)
        {
            using (var req = new HttpRequestMessage(HttpMethod.Post, BaseUrl() + path))
            {
                req.Headers.Add("X-Api-Key", ApiKey());
                req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                req.Content = new StringContent(jsonBody ?? "{}", Encoding.UTF8, "application/json");
                var resp = await Http.SendAsync(req).ConfigureAwait(false);
                var body = resp.Content == null ? "" : await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                return new Reply { Status = (int)resp.StatusCode, Body = body };
            }
        }
    }
}
