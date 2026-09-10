using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WoodOnlineService.Data;

namespace WoodOnlineService.Areas.Admin.Controllers;

[Area("Admin")]
[Authorize(Roles = Roles.Admin)]
public abstract class AdminBaseController : Controller
{
}
