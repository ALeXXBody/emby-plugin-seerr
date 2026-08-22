using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Sockets;
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
        private static readonly HttpClientHandler Handler = CreateHandler();

        private static readonly HttpClient Http = new HttpClient(Handler)
        {
            Timeout = TimeSpan.FromSeconds(25)
        };

        public sealed class Reply
        {
            public int Status;
            public string Body;
        }

        private static HttpClientHandler CreateHandler()
        {
            return new HttpClientHandler
            {
                AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate,
                // Avoid open-redirect SSRF chains.
                AllowAutoRedirect = false
            };
        }

        private static string BaseUrl()
        {
            var url = Plugin.Instance.Configuration.SeerrUrl ?? "";
            return url.Trim().TrimEnd('/');
        }

        private static string ApiKey()
        {
            return Plugin.Instance.Configuration.SeerrApiKey ?? "";
        }

        /// <summary>
        /// Validates configured Seerr base URL before any outbound call.
        /// Allows LAN private addresses (typical home lab Seerr) but blocks
        /// loopback, link-local/metadata, and non-http(s) schemes.
        /// </summary>
        public static bool TryValidateBaseUrl(out string error)
        {
            error = null;
            var raw = BaseUrl();
            if (string.IsNullOrWhiteSpace(raw))
            {
                error = "Seerr URL is not configured";
                return false;
            }

            if (!Uri.TryCreate(raw, UriKind.Absolute, out var uri))
            {
                error = "Seerr URL is invalid";
                return false;
            }

            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            {
                error = "Seerr URL must be http or https";
                return false;
            }

            if (!string.IsNullOrEmpty(uri.UserInfo))
            {
                error = "Seerr URL must not contain credentials";
                return false;
            }

            if (string.IsNullOrEmpty(uri.Host))
            {
                error = "Seerr URL host is missing";
                return false;
            }

            if (IsBlockedHost(uri.Host))
            {
                error = "Seerr URL host is not allowed";
                return false;
            }

            return true;
        }

        private static bool IsBlockedHost(string host)
        {
            if (string.IsNullOrWhiteSpace(host)) return true;

            // Cloud metadata hostnames.
            if (host.Equals("metadata.google.internal", StringComparison.OrdinalIgnoreCase))
                return true;
            if (host.EndsWith(".metadata.google.internal", StringComparison.OrdinalIgnoreCase))
                return true;

            IPAddress ip;
            if (IPAddress.TryParse(host, out ip))
            {
                return IsBlockedIp(ip);
            }

            // Hostname: resolve and reject if any address is blocked (DNS rebinding defense).
            try
            {
                var addresses = Dns.GetHostAddresses(host);
                if (addresses == null || addresses.Length == 0) return true;
                foreach (var addr in addresses)
                {
                    if (IsBlockedIp(addr)) return true;
                }
            }
            catch
            {
                return true;
            }

            return false;
        }

        private static bool IsBlockedIp(IPAddress ip)
        {
            if (IPAddress.IsLoopback(ip)) return true;

            if (ip.AddressFamily == AddressFamily.InterNetwork)
            {
                var b = ip.GetAddressBytes();
                // 0.0.0.0/8
                if (b[0] == 0) return true;
                // 169.254.0.0/16 link-local (includes AWS/GCP metadata 169.254.169.254)
                if (b[0] == 169 && b[1] == 254) return true;
                // 224.0.0.0/4 multicast and reserved
                if (b[0] >= 224) return true;
                // Note: RFC1918 (10/8, 172.16/12, 192.168/16) intentionally allowed —
                // Seerr commonly runs on the LAN next to Emby.
            }
            else if (ip.AddressFamily == AddressFamily.InterNetworkV6)
            {
                if (ip.IsIPv6LinkLocal || ip.IsIPv6Multicast)
                    return true;
                if (ip.IsIPv4MappedToIPv6)
                    return IsBlockedIp(ip.MapToIPv4());
            }

            return false;
        }

        public static async Task<Reply> GetAsync(string pathAndQuery)
        {
            string err;
            if (!TryValidateBaseUrl(out err))
            {
                return new Reply { Status = 503, Body = JsonError(err) };
            }

            var target = BaseUrl() + pathAndQuery;
            if (!IsSafeRequestUrl(target))
            {
                return new Reply { Status = 503, Body = JsonError("Seerr URL host is not allowed") };
            }

            using (var req = new HttpRequestMessage(HttpMethod.Get, target))
            {
                req.Headers.Add("X-Api-Key", ApiKey());
                req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                var resp = await Http.SendAsync(req).ConfigureAwait(false);
                var body = resp.Content == null ? "" : await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                if ((int)resp.StatusCode >= 300 && (int)resp.StatusCode < 400)
                {
                    return new Reply { Status = 502, Body = JsonError("unexpected redirect from Seerr") };
                }
                return new Reply { Status = (int)resp.StatusCode, Body = Truncate(body) };
            }
        }

        public static async Task<Reply> PostJsonAsync(string path, string jsonBody)
        {
            string err;
            if (!TryValidateBaseUrl(out err))
            {
                return new Reply { Status = 503, Body = JsonError(err) };
            }

            var target = BaseUrl() + path;
            if (!IsSafeRequestUrl(target))
            {
                return new Reply { Status = 503, Body = JsonError("Seerr URL host is not allowed") };
            }

            using (var req = new HttpRequestMessage(HttpMethod.Post, target))
            {
                req.Headers.Add("X-Api-Key", ApiKey());
                req.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
                req.Content = new StringContent(jsonBody ?? "{}", Encoding.UTF8, "application/json");
                var resp = await Http.SendAsync(req).ConfigureAwait(false);
                var body = resp.Content == null ? "" : await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
                if ((int)resp.StatusCode >= 300 && (int)resp.StatusCode < 400)
                {
                    return new Reply { Status = 502, Body = JsonError("unexpected redirect from Seerr") };
                }
                return new Reply { Status = (int)resp.StatusCode, Body = Truncate(body) };
            }
        }

        private static bool IsSafeRequestUrl(string url)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)) return false;
            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return false;
            return !IsBlockedHost(uri.Host);
        }

        private static string Truncate(string body)
        {
            if (string.IsNullOrEmpty(body)) return "";
            const int max = 512 * 1024;
            return body.Length <= max ? body : body.Substring(0, max);
        }

        private static string JsonError(string msg)
        {
            return "{\"error\":\"" + (msg ?? "error").Replace("\\", "\\\\").Replace("\"", "'") + "\"}";
        }
    }
}
