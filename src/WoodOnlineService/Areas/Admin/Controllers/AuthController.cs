using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using WoodOnlineService.Data;
using WoodOnlineService.Models;
using WoodOnlineService.Services;
using WoodOnlineService.ViewModels;

namespace WoodOnlineService.Areas.Admin.Controllers;

/// <summary>
/// Admin sign-in, entirely separate from the customer-facing /Account/Login form: a different
/// URL, a different view, and a password check that rejects any non-Admin account outright
/// rather than falling through to a customer sign-in. Two-factor (email OTP) is mandatory here
/// and only here — customers never see it.
///
/// Deliberately not an AdminBaseController: that base class requires
/// [Authorize(Roles = Roles.Admin)], which would lock this controller before the admin has even
/// signed in.
/// </summary>
[Area("Admin")]
public class AuthController : Controller
{
    private readonly ApplicationDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IAdminOtpService _adminOtp;
    private readonly ISuspiciousActivityService _suspiciousActivity;
    private readonly SecuritySettings _security;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        ApplicationDbContext db,
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        IAdminOtpService adminOtp,
        ISuspiciousActivityService suspiciousActivity,
        IOptions<SecuritySettings> security,
        ILogger<AuthController> logger)
    {
        _db = db;
        _userManager = userManager;
        _signInManager = signInManager;
        _adminOtp = adminOtp;
        _suspiciousActivity = suspiciousActivity;
        _security = security.Value;
        _logger = logger;
    }

    [HttpGet]
    public IActionResult Login(string? returnUrl = null)
    {
        ViewData["Title"] = "Admin Sign In";
        ViewData["ReturnUrl"] = returnUrl;
        return View(new LoginViewModel());
    }

    [HttpPost]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> Login(LoginViewModel model, string? returnUrl = null)
    {
        ViewData["Title"] = "Admin Sign In";
        ViewData["ReturnUrl"] = returnUrl;

        var ip = ClientIpHelper.GetIp(HttpContext);

        if (_suspiciousActivity.IsBlocked(ip))
        {
            _logger.LogWarning("Admin login blocked for suspicious IP {Ip}", ip);
            ModelState.AddModelError(string.Empty,
                $"Too many sign-in attempts from your network. Please try again in {_suspiciousActivity.MinutesRemaining(ip)} minutes.");
            return View(model);
        }

        if (!ModelState.IsValid) return View(model);

        var user = await _userManager.FindByEmailAsync(model.Email);

        var result = user is null
            ? Microsoft.AspNetCore.Identity.SignInResult.Failed
            : await _signInManager.CheckPasswordSignInAsync(user, model.Password, lockoutOnFailure: true);

        if (result.Succeeded && user is not null)
        {
            if (!await _userManager.IsInRoleAsync(user, Roles.Admin))
            {
                // A customer's correct password on this form still must not sign them in here —
                // this page's session is admin-only.
                _logger.LogWarning("Non-admin {Email} attempted the admin sign-in page.", model.Email);
                ModelState.AddModelError(string.Empty, "This sign-in page is for administrators only.");
                return View(model);
            }

            _suspiciousActivity.RecordSuccess(ip);

            var token = await _adminOtp.IssueAsync(user);

            _logger.LogInformation("Password verified for admin {Email}; OTP issued.", model.Email);

            TempData["Info"] = "We emailed you a 6-digit code. Enter it below to finish signing in.";
            return RedirectToAction(nameof(VerifyOtp), new { token, returnUrl });
        }

        _suspiciousActivity.RecordFailedAttempt(ip);

        if (result.IsLockedOut && user is not null)
        {
            // CheckPasswordSignInAsync just locked this out for the customer default
            // (Security:LockoutMinutes). Admin accounts get a longer lock on the same attempt
            // budget, since a compromised admin password is a bigger deal — extend it here
            // rather than configuring a second, global Identity lockout policy.
            await _userManager.SetLockoutEndDateAsync(user,
                DateTimeOffset.UtcNow.AddMinutes(_security.AdminLockoutMinutes));

            _logger.LogWarning("Admin account locked out: {Email}", model.Email);
            ModelState.AddModelError(string.Empty,
                $"Too many failed attempts. This account is locked for {_security.AdminLockoutMinutes} minutes.");
            return View(model);
        }

        _logger.LogWarning("Failed admin sign-in attempt for {Email}", model.Email);
        ModelState.AddModelError(string.Empty, "Incorrect email or password.");
        return View(model);
    }

    [HttpGet]
    public IActionResult VerifyOtp(Guid token, string? returnUrl = null)
    {
        ViewData["Title"] = "Verify Code";
        ViewData["ReturnUrl"] = returnUrl;
        return View(new VerifyOtpViewModel { Token = token });
    }

    [HttpPost]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> VerifyOtp(VerifyOtpViewModel model, string? returnUrl = null)
    {
        ViewData["Title"] = "Verify Code";
        ViewData["ReturnUrl"] = returnUrl;

        if (!ModelState.IsValid) return View(model);

        var verifyResult = await _adminOtp.VerifyAsync(model.Token, model.Code);

        switch (verifyResult)
        {
            case OtpVerifyResult.Success:
                break;

            case OtpVerifyResult.InvalidCode:
                ModelState.AddModelError(string.Empty, "That code is incorrect. Please try again.");
                return View(model);

            case OtpVerifyResult.Expired:
                ModelState.AddModelError(string.Empty,
                    "That code has expired. Please sign in again to get a new one.");
                return View(model);

            case OtpVerifyResult.TooManyAttempts:
                ModelState.AddModelError(string.Empty,
                    "Too many incorrect attempts. Please sign in again to get a new code.");
                return View(model);

            default:
                ModelState.AddModelError(string.Empty,
                    "That code is no longer valid. Please sign in again.");
                return View(model);
        }

        var otp = await _db.AdminLoginOtps.AsNoTracking()
            .FirstOrDefaultAsync(o => o.PublicToken == model.Token);

        var user = otp is null ? null : await _userManager.FindByIdAsync(otp.UserId);

        if (user is null || !await _userManager.IsInRoleAsync(user, Roles.Admin))
        {
            ModelState.AddModelError(string.Empty, "That code is no longer valid. Please sign in again.");
            return View(model);
        }

        user.CurrentSessionId = Guid.NewGuid().ToString("N");
        await _userManager.UpdateAsync(user);
        await _signInManager.SignInAsync(user, isPersistent: false);

        _logger.LogInformation("Admin OTP verified; sign-in completed for {UserId}", user.Id);

        if (user.MustChangePassword)
        {
            TempData["Error"] = "For security, you must set a new password before continuing.";
            return RedirectToAction("ChangePassword", "Account", new { area = "" });
        }

        TempData["Success"] = $"Welcome back, {user.FullName}!";

        if (!string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl))
            return Redirect(returnUrl);

        return RedirectToAction("Index", "Dashboard");
    }

    /// <summary>Re-sends the OTP for the in-progress sign-in, subject to the 3-minute cooldown.</summary>
    [HttpPost]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> ResendOtp([FromForm] Guid token)
    {
        var result = await _adminOtp.ResendAsync(token);

        if (!result.Success)
        {
            return result.NewToken is null && result.SecondsUntilAllowed == 0
                ? NotFound(new { success = false, message = "That sign-in attempt is no longer valid. Please sign in again." })
                : Ok(new { success = false, secondsRemaining = result.SecondsUntilAllowed });
        }

        return Ok(new { success = true, token = result.NewToken });
    }

    [HttpPost]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        TempData["Success"] = "You have been signed out.";
        return RedirectToAction(nameof(Login));
    }
}
