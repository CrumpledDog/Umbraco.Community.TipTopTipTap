using Umbraco.Community.TipTopTipTap.Controllers;

namespace Umbraco.Community.TipTopTipTap.Tests;

public class UmbracoCommunityTipTopTipTapApiControllerTests
{
    [Fact]
    public void Ping_ReturnsPong()
    {
        var sut = new UmbracoCommunityTipTopTipTapApiController();

        var result = sut.Ping();

        Assert.Equal("Pong", result);
    }
}
