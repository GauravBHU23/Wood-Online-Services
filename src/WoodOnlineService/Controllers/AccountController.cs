using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WoodOnlineService.Data;
using WoodOnlineService.Models;
using WoodOnlineService.Services;
using WoodOnlineService.ViewModels;

namespace WoodOnlineService.Controllers;

public class AccountController : BaseController
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly ICartService _cart;
    private readonly INotificationService _notify;
    private readonly ILogger<AccountController> _logger;

    public AccountController(
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        ICartService cart,
        INotificationService notify,
        ILogger<AccountController> logger)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _cart = cart;
        _notify = notify;
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

        if (!ModelState.IsValid) return View(model);

        var result = await _signInManager.PasswordSignInAsync(
            model.Email, model.Password, model.RememberMe, lockoutOnFailure: true);

        if (result.Succeeded)
        {
            var user = await _userManager.FindByEmailAsync(model.Email);
            if (user is not null)
                await _cart.MergeGuestCartAsync(HttpContext, user.Id);

            _logger.LogInformation("Sign-in succeeded for {Email}", model.Email);

            TempData["Success"] = $"Welcome back{(user?.FullName is { Length: > 0 } n ? ", " + n : "")}!";

            if (user is not null &&
                await _userManager.IsInRoleAsync(user, Roles.Admin) &&
                string.IsNullOrEmpty(returnUrl))
            {
                return RedirectToAction("Index", "Dashboard", new { area = "Admin" });
            }

            return RedirectToLocal(returnUrl);
        }

        if (result.IsLockedOut)
        {
            _logger.LogWarning("Account locked out: {Email}", model.Email);
            ModelState.AddModelError(string.Empty,
                "Too many failed attempts. Your account is locked for 15 minutes.");
            return View(model);
        }

        // Deliberately vague so the form cannot be used to discover which emails are registered.
        _logger.LogWarning("Failed sign-in attempt for {Email}", model.Email);
        ModelState.AddModelError(string.Empty, "Incorrect email or password.");
        return View(model);
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
            await _signInManager.SignInAsync(user, isPersistent: true);
            await _cart.MergeGuestCartAsync(HttpContext, user.Id);

            _logger.LogInformation("New customer registered: {Email}", model.Email);

            await _notify.NotifyWelcomeAsync(user.Email!, user.FullName);

            TempData["Success"] = $"Welcome, {user.FullName}! Your account is ready.";
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
            await _signInManager.RefreshSignInAsync(user);
            _logger.LogInformation("Password changed for {UserId}", user.Id);

            TempData["Success"] = "Your password has been changed.";
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

        // The confirmation is identical whether or not the address is registered, so this
        // form cannot be used to discover which emails have accounts.
        if (user is not null)
        {
            var token = await _userManager.GeneratePasswordResetTokenAsync(user);

            var link = Url.Action(
                nameof(ResetPassword), "Account",
                new { email = user.Email, token },
                protocol: Request.Scheme)!;

            await _notify.NotifyPasswordResetAsync(user.Email!, user.FullName, link);

            _logger.LogInformation("Password reset requested for {Email}", model.Email);
        }
        else
        {
            _logger.LogInformation("Password reset requested for an unregistered address.");
        }

        TempData["Success"] =
            "If an account exists for that email, we have sent a link to reset the password. " +
            "Please check your inbox, including the spam folder.";

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
