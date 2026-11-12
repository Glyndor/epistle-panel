import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

import { STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request/index.ts");

const nextConfig: NextConfig = {
	// Emit a self-contained server bundle so the panel ships as a minimal
	// container image running under the isolated user — the container is the
	// install, so the standalone output is required, not optional.
	output: "standalone",
	reactCompiler: true,
	typedRoutes: true,
	experimental: {
		serverActions: { bodySizeLimit: "8kb" },
	},
	// Do not announce the framework on every response.
	poweredByHeader: false,
	// The proxy stamps every header on the routes it covers; this covers the
	// static assets its matcher skips, which still need `nosniff` and the rest.
	async headers() {
		return [
			{
				source: "/:path*",
				headers: STATIC_SECURITY_HEADERS.map(([key, value]) => ({
					key,
					value,
				})),
			},
		];
	},
};

export default withNextIntl(nextConfig);
