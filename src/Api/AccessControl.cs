using System;
using System.Collections.Concurrent;
using System.Linq;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Net;
using MediaBrowser.Model.Services;

namespace Emby.Plugin.Seerr.Api
{
    internal static class AccessControl
    {
        private static readonly ConcurrentDictionary<string, RateBucket> RequestBuckets =
            new ConcurrentDictionary<string, RateBucket>(StringComparer.Ordinal);

        // Soft limit: 20 requests per rolling minute per Emby user (or token key).
        private const int RequestLimit = 20;
        private static readonly TimeSpan RequestWindow = TimeSpan.FromMinutes(1);

        public static User GetUser(IAuthorizationContext auth, IRequest request)
        {
            if (auth == null || request == null) return null;
            try
            {
                var info = auth.GetAuthorizationInfo(request);
                return info != null ? info.User : null;
            }
            catch
            {
                return null;
            }
        }

        public static bool IsUserAllowed(User user)
        {
            if (user == null) return false;

            var raw = Plugin.Instance != null && Plugin.Instance.Configuration != null
                ? Plugin.Instance.Configuration.AllowedUsers
                : null;

            if (string.IsNullOrWhiteSpace(raw)) return true;

            var name = (user.Name ?? "").Trim();
            if (name.Length == 0) return false;

            var allowed = raw
                .Split(new[] { ',', ';', '\n' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(x => x.Trim())
                .Where(x => x.Length > 0);

            return allowed.Any(a => string.Equals(a, name, StringComparison.OrdinalIgnoreCase));
        }

        public static bool TryConsumeRequestQuota(User user, out string error)
        {
            error = null;
            var key = user != null && user.Id != Guid.Empty
                ? user.Id.ToString("N")
                : "_anonymous_";

            var now = DateTime.UtcNow;
            var bucket = RequestBuckets.GetOrAdd(key, _ => new RateBucket());
            lock (bucket)
            {
                if (now - bucket.WindowStart >= RequestWindow)
                {
                    bucket.WindowStart = now;
                    bucket.Count = 0;
                }

                if (bucket.Count >= RequestLimit)
                {
                    error = "rate limit exceeded — try again in a minute";
                    return false;
                }

                bucket.Count++;
                return true;
            }
        }

        private sealed class RateBucket
        {
            public DateTime WindowStart = DateTime.UtcNow;
            public int Count;
        }
    }
}
