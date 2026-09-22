import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ported from SecurityHeadersMiddleware.cs, which stripped Server/X-Powered-By/
  // X-AspNet(Mvc)-Version so the response doesn't advertise the server stack. Next.js's
  // X-Powered-By header is added after middleware runs, so it can only be turned off here, not
  // removed in proxy.ts (see proxy.ts for the rest of the security headers it does set).
  poweredByHeader: false,
};

export default nextConfig;
