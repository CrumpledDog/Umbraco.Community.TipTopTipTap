using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Umbraco.Cms.Api.Common.Attributes;
using Umbraco.Cms.Api.Common.Filters;
using Umbraco.Cms.Web.Common.Authorization;
using Umbraco.Cms.Web.Common.Routing;

namespace Umbraco.Community.TipTopTipTap.Controllers
{
    [ApiController]
    [BackOfficeRoute("umbracocommunitytiptoptiptap/api/v{version:apiVersion}")]
    [Authorize(Policy = AuthorizationPolicies.SectionAccessContent)]
    [MapToApi(Constants.ApiName)]
    [JsonOptionsName(Umbraco.Cms.Core.Constants.JsonOptionsNames.BackOffice)]
    public class UmbracoCommunityTipTopTipTapApiControllerBase : ControllerBase
    {
    }
}
