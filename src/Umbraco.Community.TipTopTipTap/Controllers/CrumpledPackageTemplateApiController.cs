using Asp.Versioning;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Umbraco.Community.TipTopTipTap.Controllers
{
    // Minimal starting point - replace with your package's real Management API. See
    // https://docs.umbraco.com/umbraco-cms/tutorials/creating-a-backoffice-api for the full guide.
    [ApiVersion("1.0")]
    [ApiExplorerSettings(GroupName = "Umbraco.Community.TipTopTipTap")]
    public class UmbracoCommunityTipTopTipTapApiController : UmbracoCommunityTipTopTipTapApiControllerBase
    {
        [HttpGet("ping")]
        [ProducesResponseType<string>(StatusCodes.Status200OK)]
        public string Ping() => "Pong";
    }
}
