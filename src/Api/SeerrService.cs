using System;
using System.Linq;
using Emby.Plugin.Seerr.Seerr;
using Emby.Plugin.Seerr.Ui;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Net;
using MediaBrowser.Model.Services;

namespace Emby.Plugin.Seerr.Api
{
    public class SeerrService : IService, IRequiresRequest, IHasResultFactory
    {
        private readonly IAuthorizationContext _auth;

        public SeerrService(IAuthorizationContext auth)
        {
            _auth = auth;
        }

        public IRequest Request { get; set; }
        public IHttpResultFactory ResultFactory { get; set; }

        private static readonly char[] AllowedChars =
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -._':,!?()&;#+?"
            .ToCharArray();

        private static string Sanitize(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return new string(s.Where(AllowedChars.Contains).ToArray());
        }

        private object Raw(int status, string contentType, string body)
        {
            if (Request != null && Request.Response != null)
            {
                try { Request.Response.StatusCode = status; } catch { /* ignore */ }
                try { Request.Response.ContentType = contentType; } catch { /* ignore */ }
            }
            return body;
        }

        private object Json(int status, string body)
        {
            return Raw(status, "application/json; charset=utf-8", body);
        }

        private object Forbidden(string msg)
        {
            return Json(403, "{\"error\":\"" + (msg ?? "forbidden").Replace("\"", "'") + "\"}");
        }

        /// <summary>
        /// Require authenticated Emby user and optional AllowedUsers allow-list.
        /// Returns null when allowed; otherwise an error response object.
        /// </summary>
        private object RequireAllowedUser(out User user)
        {
            user = AccessControl.GetUser(_auth, Request);
            if (user == null)
            {
                return Json(401, "{\"error\":\"authentication required\"}");
            }

            if (!AccessControl.IsUserAllowed(user))
            {
                return Forbidden("user is not allowed to use Seerr Requests");
            }

            return null;
        }

        // GET /Seerr/Ping
        public object Get(GetSeerrPing request)
        {
            User user;
            var denied = RequireAllowedUser(out user);
            if (denied != null) return denied;

            try
            {
                var r = SeerrClient.GetAsync("/api/v1/status").ConfigureAwait(false).GetAwaiter().GetResult();
                bool ok = r.Status == 200 && (r.Body ?? "").IndexOf("version", StringComparison.OrdinalIgnoreCase) >= 0;
                return Json(ok ? 200 : 502, ok ? "{\"ok\":true}" : "{\"ok\":false,\"status\":" + r.Status + "}");
            }
            catch (Exception ex)
            {
                var msg = Sanitize(ex.Message ?? "error").Replace("\"", "'");
                return Json(502, "{\"ok\":false,\"error\":\"" + msg + "\"}");
            }
        }

        // GET /Seerr/Search?query=
        public object Get(GetSeerrSearch request)
        {
            User user;
            var denied = RequireAllowedUser(out user);
            if (denied != null) return denied;

            var query = request.Query;
            if (string.IsNullOrWhiteSpace(query))
            {
                return Json(200, "{}");
            }
            var q = Uri.EscapeDataString(Sanitize(query));
            try
            {
                var r = SeerrClient.GetAsync("/api/v1/search?query=" + q + "&page=1")
                    .ConfigureAwait(false).GetAwaiter().GetResult();
                return Json(r.Status == 200 ? 200 : 502, r.Body);
            }
            catch (Exception ex)
            {
                return Json(502, "{\"error\":" + Quote(Sanitize(ex.Message)) + "}");
            }
        }

        // GET /Seerr/Discover?page=
        public object Get(GetSeerrDiscover request)
        {
            User user;
            var denied = RequireAllowedUser(out user);
            if (denied != null) return denied;

            var page = request.Page < 1 ? 1 : (request.Page > 500 ? 500 : request.Page);
            try
            {
                var r = SeerrClient.GetAsync("/api/v1/discover/trending?page=" + page)
                    .ConfigureAwait(false).GetAwaiter().GetResult();
                return Json(r.Status == 200 ? 200 : 502, r.Body);
            }
            catch (Exception ex)
            {
                return Json(502, "{\"error\":" + Quote(Sanitize(ex.Message)) + "}");
            }
        }

        // GET /Seerr/Recommended?mediaType=&tmdbId=
        public object Get(GetSeerrRecommended request)
        {
            User user;
            var denied = RequireAllowedUser(out user);
            if (denied != null) return denied;

            var mediaType = (request.MediaType ?? "").Trim().ToLowerInvariant();
            if (mediaType != "movie" && mediaType != "tv")
            {
                return Json(400, "{\"error\":\"mediaType must be movie or tv\"}");
            }
            if (request.TmdbId <= 0)
            {
                return Json(400, "{\"error\":\"invalid tmdbId\"}");
            }
            try
            {
                var r = SeerrClient.GetAsync("/api/v1/" + mediaType + "/" + request.TmdbId + "/recommendations?page=1")
                    .ConfigureAwait(false).GetAwaiter().GetResult();
                return Json(r.Status == 200 ? 200 : 502, r.Body);
            }
            catch (Exception ex)
            {
                return Json(502, "{\"error\":" + Quote(Sanitize(ex.Message)) + "}");
            }
        }

        // GET /Seerr/Requests?take=&skip=
        public object Get(GetSeerrRequests request)
        {
            User user;
            var denied = RequireAllowedUser(out user);
            if (denied != null) return denied;

            var take = request.Take < 1 ? 12 : (request.Take > 100 ? 100 : request.Take);
            var skip = request.Skip < 0 ? 0 : request.Skip;
            try
            {
                var r = SeerrClient.GetAsync("/api/v1/request?take=" + take + "&skip=" + skip + "&sort=added")
                    .ConfigureAwait(false).GetAwaiter().GetResult();
                return Json(r.Status == 200 ? 200 : 502, r.Body);
            }
            catch (Exception ex)
            {
                return Json(502, "{\"error\":" + Quote(Sanitize(ex.Message)) + "}");
            }
        }

        // POST /Seerr/Request
        public object Post(CreateSeerrRequest request)
        {
            User user;
            var denied = RequireAllowedUser(out user);
            if (denied != null) return denied;

            string rateErr;
            if (!AccessControl.TryConsumeRequestQuota(user, out rateErr))
            {
                return Json(429, "{\"error\":\"" + rateErr.Replace("\"", "'") + "\"}");
            }

            var mediaType = (request.MediaType ?? "").Trim().ToLowerInvariant();
            if (mediaType != "movie" && mediaType != "tv")
            {
                return Json(400, "{\"error\":\"mediaType must be movie or tv\"}");
            }
            if (request.MediaId <= 0)
            {
                return Json(400, "{\"error\":\"invalid mediaId\"}");
            }

            // Seerr 3.x requires `seasons` for TV ("all" or [1,2,...]). Omitting it returns 500.
            var body = "{\"mediaType\":\"" + mediaType + "\",\"mediaId\":" + request.MediaId;
            if (mediaType == "tv")
            {
                var seasonsJson = BuildSeasonsJson(request.Seasons);
                body += ",\"seasons\":" + seasonsJson;
            }
            body += "}";

            try
            {
                var r = SeerrClient.PostJsonAsync("/api/v1/request", body)
                    .ConfigureAwait(false).GetAwaiter().GetResult();
                // Normalize Seerr error shape so UIs can show a useful message.
                if (r.Status >= 400)
                {
                    return Json(r.Status, NormalizeSeerrError(r.Body, r.Status));
                }
                return Json(r.Status, r.Body);
            }
            catch (Exception ex)
            {
                return Json(502, "{\"error\":" + Quote(Sanitize(ex.Message)) + "}");
            }
        }

        // GET /Seerr/Ui  (public HTML shell — login is client-side)
        public object Get(GetSeerrUi request)
        {
            if (Request != null && Request.Response != null)
            {
                try
                {
                    var headers = Request.Response.Headers;
                    // Best-effort hardening; Emby may merge/override.
                    headers["X-Content-Type-Options"] = "nosniff";
                    headers["X-Frame-Options"] = "SAMEORIGIN";
                    headers["Referrer-Policy"] = "no-referrer";
                    headers["Content-Security-Policy"] =
                        "default-src 'none'; base-uri 'none'; frame-ancestors 'self'; " +
                        "img-src 'self' https://image.tmdb.org data:; " +
                        "style-src 'unsafe-inline'; script-src 'unsafe-inline'; " +
                        "connect-src 'self'; form-action 'self'";
                    headers["Cache-Control"] = "no-store";
                }
                catch { /* ignore header failures */ }
            }

            return Raw(200, "text/html; charset=utf-8", UiPage.Html);
        }

        /// <summary>
        /// Build Seerr seasons JSON. Empty/null => "all". "all" => "all". "1,2" => [1,2].
        /// </summary>
        private static string BuildSeasonsJson(string seasons)
        {
            if (string.IsNullOrWhiteSpace(seasons))
            {
                return "\"all\"";
            }

            var trimmed = seasons.Trim();
            if (string.Equals(trimmed, "all", StringComparison.OrdinalIgnoreCase))
            {
                return "\"all\"";
            }

            var list = trimmed
                .Split(new[] { ',', ' ', ';' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(x => x.Trim())
                .Where(x => x.All(char.IsDigit))
                .Select(int.Parse)
                .Where(n => n > 0 && n < 200)
                .Distinct()
                .OrderBy(n => n)
                .ToList();

            if (list.Count == 0)
            {
                return "\"all\"";
            }

            return "[" + string.Join(",", list) + "]";
        }

        private static string NormalizeSeerrError(string body, int status)
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                return "{\"error\":\"Seerr request failed (" + status + ")\"}";
            }

            try
            {
                // Already has "error"
                if (body.IndexOf("\"error\"", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    return body;
                }
                // Seerr uses { "message": "..." }
                const string key = "\"message\"";
                var idx = body.IndexOf(key, StringComparison.OrdinalIgnoreCase);
                if (idx >= 0)
                {
                    var colon = body.IndexOf(':', idx + key.Length);
                    if (colon > 0)
                    {
                        var firstQuote = body.IndexOf('"', colon + 1);
                        if (firstQuote > 0)
                        {
                            var secondQuote = body.IndexOf('"', firstQuote + 1);
                            if (secondQuote > firstQuote)
                            {
                                var msg = body.Substring(firstQuote + 1, secondQuote - firstQuote - 1);
                                return "{\"error\":" + Quote(Sanitize(msg)) + ",\"status\":" + status + "}";
                            }
                        }
                    }
                }
            }
            catch { /* fall through */ }

            return "{\"error\":\"Seerr request failed (" + status + ")\"}";
        }

        private static string Quote(string s)
        {
            return "\"" + (s ?? "").Replace("\"", "'").Replace("\n", " ").Replace("\r", "") + "\"";
        }
    }
}
