using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Collections.Generic;
using Emby.Plugin.Seerr.Seerr;
using Emby.Plugin.Seerr.Ui;
using MediaBrowser.Controller.Net;
using MediaBrowser.Model.Services;

namespace Emby.Plugin.Seerr.Api
{
    public class SeerrService : IService, IRequiresRequest, IHasResultFactory
    {
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
                try { Request.Response.StatusCode = status; } catch { }
                try { Request.Response.ContentType = contentType; } catch { }
            }
            return body;
        }

        private object Json(int status, string body)
        {
            return Raw(status, "application/json", body);
        }

        // GET /Seerr/Ping
        public object Get(GetSeerrPing request)
        {
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

        // GET /Seerr/Requests?take=&skip=
        public object Get(GetSeerrRequests request)
        {
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
            var mediaType = (request.MediaType ?? "").Trim().ToLowerInvariant();
            if (mediaType != "movie" && mediaType != "tv")
            {
                return Json(400, "{\"error\":\"mediaType must be movie or tv\"}");
            }
            if (request.MediaId <= 0)
            {
                return Json(400, "{\"error\":\"invalid mediaId\"}");
            }

            var body = "{\"mediaType\":\"" + mediaType + "\",\"mediaId\":" + request.MediaId;

            if (!string.IsNullOrWhiteSpace(request.Seasons))
            {
                var seasons = request.Seasons
                    .Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(x => x.Trim())
                    .Where(x => x.All(char.IsDigit))
                    .Select(int.Parse)
                    .Where(n => n > 0 && n < 200)
                    .Distinct()
                    .OrderBy(n => n)
                    .ToList();

                if (seasons.Count > 0)
                {
                    body += ",\"seasons\":[" + string.Join(",", seasons) + "]";
                }
            }
            body += "}";

            try
            {
                var r = SeerrClient.PostJsonAsync("/api/v1/request", body)
                    .ConfigureAwait(false).GetAwaiter().GetResult();
                return Json(r.Status, r.Body);
            }
            catch (Exception ex)
            {
                return Json(502, "{\"error\":" + Quote(Sanitize(ex.Message)) + "}");
            }
        }

        // GET /Seerr/Ui
        public object Get(GetSeerrUi request)
        {
            return Raw(200, "text/html; charset=utf-8", UiPage.Html);
        }

        private static string Quote(string s)
        {
            return "\"" + (s ?? "").Replace("\"", "'").Replace("\n", " ").Replace("\r", "") + "\"";
        }
    }
}
