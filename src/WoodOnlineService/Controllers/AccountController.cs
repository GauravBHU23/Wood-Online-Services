using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using WoodOnlineService.Data;
using WoodOnlineService.Models;
using WoodOnlineService.Services;
using WoodOnlineService.ViewModels;

namespace WoodOnlineService.Controllers;

/// <summary>Customer-facing account actions only. Admin sign-in lives entirely under Areas/Admin/Controllers/AuthController.</summary>
public class AccountController : BaseController
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly ICartService _cart;
    private readonly INotificationService _notify;
    private readonly ISuspiciousActivityService _suspiciousActivity;
    private readonly SecuritySettings _security;
    private readonly ILogger<AccountController> _logger;

    public AccountController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        ICartService cart,
        INotificationService notify,
        ISuspiciousActivityService suspiciousActivity,
        IOptions<SecuritySettings> security,
        ILogger<AccountController> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _cart = cart;
        _notify = notify;
        _suspiciousActivity = suspiciousActivity;
        _security = security.Value;
        _logger = logger;
    }

    [HttpGet]
    public IActionResult Login(string? returnUrl = null)
    {
        ViewData["Title"] = "Sign In";
        ViewData["ReturnUrl"] = returnUrl;
        return View(new LoginViewModel());
    }

    [HttpPost]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> Login(LoginViewModel model, string? returnUrl = null)
    {
        ViewData["Title"] = "Sign In";
        ViewData["ReturnUrl"] = returnUrl;

        var ip = ClientIpHelper.GetIp(HttpContext);

        // Catches credential stuffing that per-account lockout misses: many failed attempts
        // from one IP, each against a different email, never trips any single account's limit.
        if (_suspiciousActivity.IsBlocked(ip))
        {
            _logger.LogWarning("Login blocked for suspicious IP {Ip}", ip);
            ModelState.AddModelError(string.Empty,
                $"Too many sign-in attempts from your network. Please try again in {_suspiciousActivity.MinutesRemaining(ip)} minutes.");
            return View(model);
        }

        if (!ModelState.IsValid) return View(model);

        // CheckPasswordSignInAsync verifies the password (and still counts it toward account
        // lockout) without ever setting the auth cookie — required so an Admin account can be
        // rejected below rather than being signed in here at all. Admins have their own sign-in
        // page (with its own OTP step) entirely separate from this customer form.
        var user = await _userManager.FindByEmailAsync(model.Email);

        var result = user is null
            ? Microsoft.AspNetCore.Identity.SignInResult.Failed
            : await _signInManager.CheckPasswordSignInAsync(user, model.Password, lockoutOnFailure: true);

        if (result.Succeeded && user is not null)
        {
            if (await _userManager.IsInRoleAsync(user, Roles.Admin))
            {
                _logger.LogInformation("Admin {Email} attempted the customer login form; redirected.", model.Email);
                ModelState.AddModelError(string.Empty,
                    "Admin accounts sign in from the admin sign-in page, not here.");
                return View(model);
            }

            _suspiciousActivity.RecordSuccess(ip);

            await CompleteSignInAsync(user, isPersistent: model.RememberMe);
            await _cart.MergeGuestCartAsync(HttpContext, user.Id);

            _logger.LogInformation("Sign-in succeeded for {Email}", model.Email);

            if (user.MustChangePassword)
            {
                TempData["Error"] = "For security, you must set a new password before continuing.";
                return RedirectToAction(nameof(ChangePassword));
            }

            TempData["Success"] = $"Welcome back{(user.FullName is { Length: > 0 } n ? ", " + n : "")}!";
            return RedirectToLocal(returnUrl);
        }

        _suspiciousActivity.RecordFailedAttempt(ip);

        if (result.IsLockedOut)
        {
            // An admin-issued block sets a lockout far in the future — anything beyond a day is
            // treated as that rather than the ordinary too-many-attempts timeout, so the message
            // doesn't wrongly promise the account will be usable again shortly.
            if (user is not null && user.LockoutEnd is { } until && until - DateTimeOffset.UtcNow > TimeSpan.FromDays(1))
            {
                _logger.LogWarning("Blocked account attempted sign-in: {Email}", model.Email);
                ModelState.AddModelError(string.Empty,
                    "This account has been blocked. Please contact us if you believe this is a mistake.");
                return View(model);
            }

            _logger.LogWarning("Account locked out: {Email}", model.Email);
            ModelState.AddModelError(string.Empty,
                $"Too many failed attempts. Your account is locked for {_security.LockoutMinutes} minutes.");
            return View(model);
        }

        // Deliberately vague so the form cannot be used to discover which emails are registered.
        _logger.LogWarning("Failed sign-in attempt for {Email}", model.Email);
        ModelState.AddModelError(string.Empty, "Incorrect email or password.");
        return View(model);
    }

    /// <summary>Stamps a fresh single-device session id and actually signs the cookie in.</summary>
    private async Task CompleteSignInAsync(ApplicationUser user, bool isPersistent = false)
    {
        user.CurrentSessionId = Guid.NewGuid().ToString("N");
        await _userManager.UpdateAsync(user);
        await _signInManager.SignInAsync(user, isPersistent);
    }

    [HttpGet]
    public IActionResult Register(string? returnUrl = null)
    {
        ViewData["Title"] = "Create Account";
        ViewData["ReturnUrl"] = returnUrl;
        return View(new RegisterViewModel());
    }

    [HttpPost]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> Register(RegisterViewModel model, string? returnUrl = null)
    {
        ViewData["Title"] = "Create Account";
        ViewData["ReturnUrl"] = returnUrl;

        if (!ModelState.IsValid) return View(model);

        var user = new ApplicationUser
        {
            UserName = model.Email,
            Email = model.Email,
            FullName = model.FullName.Trim(),
            PhoneNumber = model.PhoneNumber.Trim(),
            EmailConfirmed = true
        };

        var result = await _userManager.CreateAsync(user, model.Password);

        if (result.Succeeded)
        {
            await _userManager.AddToRoleAsync(user, Roles.Customer);

            await CompleteSignInAsync(user, isPersistent: true);
            await _cart.MergeGuestCartAsync(HttpContext, user.Id);

            _logger.LogInformation("New customer registered: {Email}", model.Email);

            await _notify.NotifyWelcomeAsync(user.Email!, user.FullName);

            TempData["Success"] = $"Welcome, {user.FullName}! Your account is ready.";
            TempData["ShowFeedbackPrompt"] = true;
            return RedirectToLocal(returnUrl);
        }

        AddIdentityErrors(result);

        return View(model);
    }

    [HttpPost]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        TempData["Success"] = "You have been signed out.";
        return RedirectToAction("Index", "Home");
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> Profile()
    {
        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Challenge();

        ViewData["Title"] = "My Profile";

        return View(new ProfileViewModel
        {
            FullName = user.FullName,
            Email = user.Email ?? string.Empty,
            PhoneNumber = user.PhoneNumber ?? string.Empty,
            Address = user.Address,
            City = user.City,
            State = user.State,
            PinCode = user.PinCode
        });
    }

    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Profile(ProfileViewModel model)
    {
        ViewData["Title"] = "My Profile";

        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Challenge();

        // Email is the sign-in identity; it is fixed here and only echoed back for display.
        model.Email = user.Email ?? string.Empty;

        if (!ModelState.IsValid) return View(model);

        user.FullName = model.FullName.Trim();
        user.PhoneNumber = model.PhoneNumber.Trim();
        user.Address = model.Address?.Trim();
        user.City = model.City?.Trim();
        user.State = model.State?.Trim();
        user.PinCode = model.PinCode?.Trim();

        var result = await _userManager.UpdateAsync(user);
        if (result.Succeeded)
        {
            TempData["Success"] = "Your profile has been updated.";
            return RedirectToAction(nameof(Profile));
        }

        AddIdentityErrors(result);

        return View(model);
    }

    [HttpGet]
    [Authorize]
    public IActionResult ChangePassword()
    {
        ViewData["Title"] = "Change Password";
        return View(new ChangePasswordViewModel());
    }

    [HttpPost]
    [Authorize]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> ChangePassword(ChangePasswordViewModel model)
    {
        ViewData["Title"] = "Change Password";

        if (!ModelState.IsValid) return View(model);

        var user = await _userManager.GetUserAsync(User);
        if (user is null) return Challenge();

        var result = await _userManager.ChangePasswordAsync(user, model.CurrentPassword, model.NewPassword);

        if (result.Succeeded)
        {
            var wasForced = user.MustChangePassword;
            if (wasForced)
            {
                user.MustChangePassword = false;
                await _userManager.UpdateAsync(user);
            }

            await _signInManager.RefreshSignInAsync(user);
            _logger.LogInformation("Password changed for {UserId}", user.Id);

            TempData["Success"] = "Your password has been changed.";

            if (wasForced && await _userManager.IsInRoleAsync(user, Roles.Admin))
                return RedirectToAction("Index", "Dashboard", new { area = "Admin" });

            return RedirectToAction(nameof(Profile));
        }

        AddIdentityErrors(result);

        return View(model);
    }

    // ---------------------------------------------------------------- password reset

    [HttpGet]
    public IActionResult ForgotPassword()
    {
        ViewData["Title"] = "Forgot Password";
        return View(new ForgotPasswordViewModel());
    }

    [HttpPost]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordViewModel model)
    {
        ViewData["Title"] = "Forgot Password";

        if (!ModelState.IsValid) return View(model);

        var user = await _userManager.FindByEmailAsync(model.Email);

        if (user is null)
        {
            _logger.LogInformation("Password reset requested for an unregistered address.");

            // Told explicitly, at the owner's request, rather than the generic anti-enumeration
            // message — this does mean an attacker can use this form to test which emails are
            // registered, which is the accepted trade-off here for a clearer user experience.
            ModelState.AddModelError(string.Empty, "No account is linked with this email address.");
            return View(model);
        }

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);

        var link = Url.Action(
            nameof(ResetPassword), "Account",
            new { email = user.Email, token },
            protocol: Request.Scheme)!;

        await _notify.NotifyPasswordResetAsync(user.Email!, user.FullName, link);

        _logger.LogInformation("Password reset requested for {Email}", model.Email);

        TempData["Success"] = "A password reset link has been sent to your email. Please check your inbox, including the spam folder.";
        return RedirectToAction(nameof(Login));
    }

    [HttpGet]
    public IActionResult ResetPassword(string? email, string? token)
    {
        if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(token))
        {
            TempData["Error"] = "That password reset link is not valid. Please request a new one.";
            return RedirectToAction(nameof(ForgotPassword));
        }

        ViewData["Title"] = "Reset Password";
        return View(new ResetPasswordViewModel { Email = email, Token = token });
    }

    [HttpPost]
    [EnableRateLimiting("sensitive")]
    public async Task<IActionResult> ResetPassword(ResetPasswordViewModel model)
    {
        ViewData["Title"] = "Reset Password";

        if (!ModelState.IsValid) return View(model);

        var user = await _userManager.FindByEmailAsync(model.Email);

        if (user is null)
        {
            // Same wording as a bad token: never reveal whether the address exists.
            TempData["Error"] = "That reset link is no longer valid. Please request a new one.";
            return RedirectToAction(nameof(ForgotPassword));
        }

        var result = await _userManager.ResetPasswordAsync(user, model.Token, model.Password);

        if (result.Succeeded)
        {
            _logger.LogInformation("Password reset completed for {Email}", model.Email);

            TempData["Success"] = "Your password has been reset. Please sign in with your new password.";
            return RedirectToAction(nameof(Login));
        }

        // An expired or already-used token lands here.
        if (result.Errors.Any(e => e.Code.Contains("Token", StringComparison.OrdinalIgnoreCase)))
        {
            TempData["Error"] = "That reset link has expired or has already been used. Please request a new one.";
            return RedirectToAction(nameof(ForgotPassword));
        }

        AddIdentityErrors(result);
        return View(model);
    }

    [HttpGet]
    public IActionResult AccessDenied()
    {
        ViewData["Title"] = "Access Denied";
        return View();
    }

    private IActionResult RedirectToLocal(string? returnUrl) =>
        !string.IsNullOrEmpty(returnUrl) && Url.IsLocalUrl(returnUrl)
            ? Redirect(returnUrl)
            : RedirectToAction("Index", "Home");


    /// <summary>
    /// Surfaces Identity's errors once each. Identity reports one problem under several codes -
    /// a taken email arrives as both DuplicateUserName and DuplicateEmail - and those translate
    /// to the same sentence, so without this the customer sees it twice.
    /// </summary>
    private void AddIdentityErrors(IdentityResult result)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var error in result.Errors)
        {
            var message = TranslateIdentityError(error);
            if (seen.Add(message))
                ModelState.AddModelError(string.Empty, message);
        }
    }

    /// <summary>Identity's default wording is replaced with clearer, customer-facing text.</summary>
    private static string TranslateIdentityError(IdentityError error) => error.Code switch
    {
        "DuplicateUserName" or "DuplicateEmail" =>
            "An account with this email already exists. Please sign in instead.",
        "PasswordTooShort" => "Your password must be at least 8 characters long.",
        "PasswordRequiresDigit" => "Your password must contain at least one number.",
        "PasswordRequiresUpper" => "Your password must contain at least one uppercase letter.",
        "PasswordRequiresLower" => "Your password must contain at least one lowercase letter.",
        "PasswordMismatch" => "Your current password is incorrect.",
        "InvalidEmail" => "Please enter a valid email address.",
        _ => error.Description
    };
}
