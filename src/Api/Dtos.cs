using MediaBrowser.Model.Services;

namespace Emby.Plugin.Seerr.Api
{
    [Route("/Seerr/Ping", "GET", Summary = "Verifies Seerr connectivity and configuration")]
    public class GetSeerrPing : IReturnVoid
    {
    }

    [Route("/Seerr/Search", "GET", Summary = "Search the Seerr catalog (movies, shows, people)")]
    public class GetSeerrSearch : IReturn<string>
    {
        [ApiMember(Name = "Query", Description = "Search text", IsRequired = true)]
        public string Query { get; set; }
    }

    [Route("/Seerr/Discover", "GET", Summary = "Trending movies & shows from Seerr")]
    public class GetSeerrDiscover : IReturn<string>
    {
        public int Page { get; set; } = 1;
    }

    [Route("/Seerr/Requests", "GET", Summary = "Recent Seerr requests")]
    public class GetSeerrRequests : IReturn<string>
    {
        public int Take { get; set; } = 12;
        public int Skip { get; set; } = 0;
    }

    [Route("/Seerr/Request", "POST", Summary = "Create a request in Seerr")]
    public class CreateSeerrRequest : IReturn<string>
    {
        /// <summary>movie or tv</summary>
        public string MediaType { get; set; }

        /// <summary>Seerr media id (from search results)</summary>
        public int MediaId { get; set; }

        /// <summary>Optional comma separated season numbers for TV, e.g. "1,2"</summary>
        public string Seasons { get; set; }
    }

    [Route("/Seerr/Ui", "GET", Summary = "Mobile friendly request UI")]
    public class GetSeerrUi : IReturnVoid
    {
    }
}
