import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ConfirmProvider } from "@/components/ui/confirm-modal";
import { FlashMessages } from "@/components/layout/flash-messages";
import { readAndClearFlashes } from "@/lib/flash";
import { getSiteSettingsPublic } from "@/lib/data/site-settings";

// Root layout: shared by every route, including the admin dashboard and the standalone admin
// auth pages, which each have their own nested layout for the rest of the page chrome.
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettingsPublic();
  return {
    title: { default: site.shop_name, template: `%s — ${site.shop_name}` },
    description: site.tagline,
    authors: [{ name: "Er Gaurav Kumar" }],
    icons: { icon: "/img/favicon.svg", apple: "/img/icon-192.png" },
    manifest: site.feature_pwa ? "/manifest.webmanifest" : undefined,
    openGraph: {
      type: "website",
      title: site.shop_name,
      description: site.tagline,
      siteName: site.shop_name,
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#6d4423",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const flashes = await readAndClearFlashes();

  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <ConfirmProvider>
            <FlashMessages flashes={flashes} />
            {children}
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
