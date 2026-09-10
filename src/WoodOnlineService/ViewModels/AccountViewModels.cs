using System.ComponentModel.DataAnnotations;

namespace WoodOnlineService.ViewModels;

public class LoginViewModel
{
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Please enter a valid email address")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required")]
    [DataType(DataType.Password)]
    public string Password { get; set; } = string.Empty;

    [Display(Name = "Remember me")]
    public bool RememberMe { get; set; } = true;
}

public class RegisterViewModel
{
    [Required(ErrorMessage = "Please enter your name")]
    [StringLength(100)]
    [Display(Name = "Full Name")]
    public string FullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Please enter a valid email address")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Phone number is required")]
    [RegularExpression(@"^[0-9+\-\s]{7,20}$", ErrorMessage = "Please enter a valid phone number")]
    [Display(Name = "Phone Number")]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required")]
    [StringLength(100, MinimumLength = 6, ErrorMessage = "Password must be at least 8 characters")]
    [DataType(DataType.Password)]
    public string Password { get; set; } = string.Empty;

    [DataType(DataType.Password)]
    [Display(Name = "Confirm Password")]
    [Compare(nameof(Password), ErrorMessage = "The passwords do not match")]
    public string ConfirmPassword { get; set; } = string.Empty;
}

public class ProfileViewModel
{
    [Required(ErrorMessage = "Please enter your name")]
    [StringLength(100)]
    [Display(Name = "Full Name")]
    public string FullName { get; set; } = string.Empty;

    [Display(Name = "Email")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Phone number is required")]
    [RegularExpression(@"^[0-9+\-\s]{7,20}$", ErrorMessage = "Please enter a valid phone number")]
    [Display(Name = "Phone Number")]
    public string PhoneNumber { get; set; } = string.Empty;

    [StringLength(300)]
    [Display(Name = "Address")]
    public string? Address { get; set; }

    [StringLength(100)]
    [Display(Name = "City")]
    public string? City { get; set; }

    [StringLength(100)]
    [Display(Name = "State")]
    public string? State { get; set; }

    [StringLength(10)]
    [RegularExpression(@"^\d{6}$", ErrorMessage = "Please enter a 6-digit PIN code")]
    [Display(Name = "PIN Code")]
    public string? PinCode { get; set; }
}

public class ChangePasswordViewModel
{
    [Required(ErrorMessage = "Please enter your current password")]
    [DataType(DataType.Password)]
    [Display(Name = "Current Password")]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "Please enter a new password")]
    [StringLength(100, MinimumLength = 6, ErrorMessage = "Password must be at least 8 characters")]
    [DataType(DataType.Password)]
    [Display(Name = "New Password")]
    public string NewPassword { get; set; } = string.Empty;

    [DataType(DataType.Password)]
    [Display(Name = "New Confirm Password")]
    [Compare(nameof(NewPassword), ErrorMessage = "The passwords do not match")]
    public string ConfirmPassword { get; set; } = string.Empty;
}

public class ForgotPasswordViewModel
{
    [Required(ErrorMessage = "Please enter your email address")]
    [EmailAddress(ErrorMessage = "Please enter a valid email address")]
    [Display(Name = "Email")]
    public string Email { get; set; } = string.Empty;
}

public class ResetPasswordViewModel
{
    [Required]
    public string Email { get; set; } = string.Empty;

    /// <summary>Single-use token issued by Identity and delivered by email.</summary>
    [Required]
    public string Token { get; set; } = string.Empty;

    [Required(ErrorMessage = "Please enter a new password")]
    [StringLength(100, MinimumLength = 8, ErrorMessage = "Password must be at least 8 characters")]
    [DataType(DataType.Password)]
    [Display(Name = "New Password")]
    public string Password { get; set; } = string.Empty;

    [DataType(DataType.Password)]
    [Display(Name = "Confirm New Password")]
    [Compare(nameof(Password), ErrorMessage = "The passwords do not match")]
    public string ConfirmPassword { get; set; } = string.Empty;
}
