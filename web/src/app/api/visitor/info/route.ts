import { apiSuccess, apiError } from "@/lib/api-response";
import { trackAndGetVisitor, locationLabel } from "@/lib/data/visitor";
import { getSiteSettingsPublic } from "@/lib/data/site-settings";

// Ported from Controllers/Api/VisitorApiController.cs#Info. Powers the footer badge.
export async function GET(request: Request) {
  try {
    const site = await getSiteSettingsPublic();
    const landingPage = new URL(request.url).searchParams.get("from") ?? "/";

    const info = await trackAndGetVisitor(site.feature_visitor_counter, site.feature_geolocation, landingPage);

    return apiSuccess({
      ipAddress: info.ipAddress,
      location: locationLabel(info),
      city: info.city,
      region: info.region,
      country: info.country,
      countryCode: info.countryCode,
      totalVisits: info.totalVisits,
    });
  } catch {
    return apiError("Could not load visitor info.", 500);
  }
}
