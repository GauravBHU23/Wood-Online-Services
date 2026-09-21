export interface ActionResult {
  success: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** True when a forced password change should redirect to the admin dashboard instead of /account/profile. */
  redirectToAdminDashboard?: boolean;
}
