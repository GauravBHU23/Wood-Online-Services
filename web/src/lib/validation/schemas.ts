import { z } from "zod";

// Mirrors the [RegularExpression]/[StringLength] rules on the original C# models and
// ViewModels (Models/Order.cs, Models/Inquiry.cs, Models/Review.cs, ViewModels/AccountViewModels.cs)
// so client and server share one definition instead of drifting like the old Razor + jQuery pair did.

export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Please enter a valid phone number")
  .max(20, "Please enter a valid phone number")
  .regex(/^[0-9+\-\s]{7,20}$/, "Please enter a valid phone number");

/** A real 10-digit Indian mobile number, starting 6-9 — used at registration and checkout. */
export const mobileSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit mobile number");

export const pinCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Please enter a 6-digit PIN code");

export const emailSchema = z.string().trim().email("Please enter a valid email address");

/**
 * At least two words, each made only of letters plus the marks real names use (apostrophe,
 * hyphen, dot) — no digits or symbols, so "asdasd123" or a single junk word like "Test" can't
 * pass. Requiring a first AND last name also rules out single-word placeholders.
 */
const fullNamePattern = /^[A-Za-z][A-Za-z.'-]*(?:\s+[A-Za-z][A-Za-z.'-]*)+$/;

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Please enter your full name")
      .max(100, "Please enter your full name")
      .regex(fullNamePattern, "Please enter your real full name (first and last name)"),
    email: emailSchema,
    phoneNumber: mobileSchema,
    // StringLength(100, MinimumLength = 6) in the C# model, but the error message says 8 and
    // Supabase Auth itself enforces a 6-char floor — kept at 8 to match the message actually
    // shown to the customer, which is the behaviour that matters.
    password: z.string().min(8, "Password must be at least 8 characters").max(100),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "The passwords do not match",
    path: ["confirmPassword"],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const profileSchema = z.object({
  fullName: z.string().trim().min(1, "Please enter your name").max(100),
  phoneNumber: phoneSchema,
  address: z.string().trim().max(300).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  state: z.string().trim().max(100).optional().or(z.literal("")),
  pinCode: z.union([pinCodeSchema, z.literal("")]).optional(),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Please enter your current password"),
    newPassword: z.string().min(8, "Password must be at least 8 characters").max(100),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "The passwords do not match",
    path: ["confirmPassword"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const verifyOtpSchema = z.object({
  token: z.string().uuid(),
  code: z
    .string()
    .trim()
    .length(6, "The code is 6 digits")
    .regex(/^\d{6}$/, "The code is 6 digits"),
});
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

export const inquirySchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  phone: phoneSchema,
  email: z.union([emailSchema, z.literal("")]).optional(),
  productId: z.number().int().positive().nullable().optional(),
  message: z.string().trim().min(1, "Please write your message").max(2000),
});
export type InquiryInput = z.infer<typeof inquirySchema>;

export const addressSchema = z.object({
  shippingName: z.string().trim().min(1, "Name is required").max(100),
  shippingPhone: phoneSchema,
  shippingAddress: z.string().trim().min(1, "Address is required").max(300),
  shippingCity: z.string().trim().min(1, "City is required").max(100),
  shippingState: z.string().trim().min(1, "State is required").max(100),
  shippingPinCode: pinCodeSchema,
  notes: z.string().trim().max(500).optional(),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const checkoutSchema = addressSchema.extend({
  paymentMethod: z.enum(["cod", "online"]),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const reviewSchema = z.object({
  productId: z.number().int().positive(),
  rating: z.number().int().min(1, "Rating must be between 1 and 5 stars").max(5),
  title: z.string().trim().max(150).optional(),
  comment: z
    .string()
    .trim()
    .min(10, "Review must be between 10 and 2000 characters")
    .max(2000, "Review must be between 10 and 2000 characters"),
});
export type ReviewInput = z.infer<typeof reviewSchema>;

export const siteFeedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .min(5, "Feedback must be between 5 and 1000 characters")
    .max(1000, "Feedback must be between 5 and 1000 characters"),
  fromWelcomePrompt: z.boolean().optional(),
});
export type SiteFeedbackInput = z.infer<typeof siteFeedbackSchema>;

export const cartAddSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(50).default(1),
});
export type CartAddInput = z.infer<typeof cartAddSchema>;
