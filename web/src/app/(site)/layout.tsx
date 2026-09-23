import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { ChatWidget } from "@/components/chat/chat-widget";
import { FeedbackPromptTrigger } from "@/components/shop/feedback-prompt-trigger";
import { PwaManager } from "@/components/layout/pwa-manager";
import { IdleLogout } from "@/components/layout/idle-logout";
import { getSiteSettingsPublic } from "@/lib/data/site-settings";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/lib/auth/actions";

// Full site chrome (header, footer, chat widget) — everything under the (site) route group.
// /admin/login and /admin/verify-otp intentionally live outside this group so they get the
// minimal _AdminAuthLayout-equivalent instead (see app/admin/(auth)/layout.tsx).
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const site = await getSiteSettingsPublic();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <a href="#mainContent" className="visually-hidden-focusable skip-link">
        Skip to main content
      </a>

      <div id="offlineBanner" className="offline-banner" role="status">
        You are offline. Some features are unavailable.
      </div>

      <Header />

      <main id="mainContent">{children}</main>

      <Footer />

      <ChatWidget shopName={site.shop_name} whatsappNumber={site.whatsapp_number} />

      <FeedbackPromptTrigger />

      {site.feature_pwa && <PwaManager shopName={site.shop_name} />}

      <IdleLogout isSignedIn={!!user} logoutAction={logoutAction} loginPath="/account/login" />
    </>
  );
}
