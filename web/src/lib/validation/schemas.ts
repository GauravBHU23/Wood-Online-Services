import { z } from "zod";

// Mirrors the [RegularExpression]/[StringLength] rules on the original C# models
// (Models/Order.cs, Models/Inquiry.cs, Models/Review.cs, Models/ApplicationUser.cs) so client
// and server share one definition instead of drifting like the old Razor + jQuery pair did.

export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Please enter a valid phone number")
  .max(20, "Please enter a valid phone number")
  .regex(/^[0-9+\-\s]{7,20}$/, "Please enter a valid phone number");

export const pinCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Please enter a 6-digit PIN code");

export const emailSchema = z.string().trim().email("Please enter a valid email address");

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(1, "Full name is required").max(100),
    email: emailSchema,
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password needs an uppercase letter")
      .regex(/[a-z]/, "Password needs a lowercase letter")
      .regex(/[0-9]/, "Password needs a digit"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

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
