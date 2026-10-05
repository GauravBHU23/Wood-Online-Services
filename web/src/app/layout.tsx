import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast-provider";
import { ConfirmProvider } from "@/components/ui/confirm-modal";
import { FlashMessages } from "@/components/layout/flash-messages";
import { readFlashes } from "@/lib/flash";
import { getSiteSettingsPublic } from "@/lib/data/site-settings";

// Root layout: shared by every route, including the admin dashboard and the standalone admin
// auth pages, which each have their own nested layout for the rest of the page chrome.
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettingsPublic();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  return {
    ...(siteUrl ? { metadataBase: new URL(siteUrl) } : {}),
    title: { default: site.shop_name, template: `%s — ${site.shop_name}` },
    description: site.tagline,
    authors: [{ name: "Er Gaurav Kumar" }],
    icons: { icon: "/img/favicon.svg", apple: "/img/icon-192.png" },
    manifest: site.feature_pwa ? "/manifest.webmanifest" : undefined,
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      title: site.shop_name,
      description: site.tagline,
      siteName: site.shop_name,
      images: [{ url: "/img/icon-512.png", width: 512, height: 512, alt: site.shop_name }],
    },
    twitter: {
      card: "summary",
      title: site.shop_name,
      description: site.tagline,
      images: ["/img/icon-512.png"],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#6d4423",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [flashes, site] = await Promise.all([readFlashes(), getSiteSettingsPublic()]);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.shop_name,
    description: site.tagline,
    ...(siteUrl && { url: siteUrl }),
    ...(site.phone && { telephone: site.phone }),
    ...(site.email && { email: site.email }),
    ...((site.address_line1 || site.address_line2) && {
      address: {
        "@type": "PostalAddress",
        streetAddress: site.address_line1 || undefined,
        addressLocality: site.address_line2 || undefined,
      },
    }),
  };

  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
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
