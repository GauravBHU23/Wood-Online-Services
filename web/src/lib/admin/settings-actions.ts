"use server";

import { revalidatePath } from "next/cache";
import { updateSiteSettingsGeneral } from "@/lib/data/site-settings";
import { siteSettingsGeneralSchema, type SiteSettingsGeneralInput } from "@/lib/validation/schemas";
import type { ActionResult } from "@/lib/auth/types";

// New admin feature — the original had no runtime settings UI at all (SiteSettings.cs is
// config-bound from appsettings.json, edited by hand on the server, never through the app).
// site_settings has exactly one row (seeded in migration 0001); this always updates that row.

export async function updateSiteSettingsAction(form: SiteSettingsGeneralInput): Promise<ActionResult> {
  const parsed = siteSettingsGeneralSchema.safeParse(form);
  if (!parsed.success) {
    return {
      success: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await updateSiteSettingsGeneral(parsed.data);

  // Every customer-facing page reads these through getSiteSettingsPublic() / getSiteSettingsFull(),
  // so a save here needs to invalidate the whole site, not just the settings page itself.
  revalidatePath("/", "layout");

  return { success: true, message: "Settings have been saved." };
}
