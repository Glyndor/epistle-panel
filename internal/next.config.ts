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
		serverActions: { bodySizeLimit: "16kb" },
		// The proxy buffers the body of every request it covers, in memory, before
		// it decides anything: measured, a request with no session was not answered
		// until its whole body had arrived, and eight of them held at 26 MB took the
		// server from 97 MB to 306 MB. So the buffer is as small as the largest body
		// a covered route reads (the composer's message, 1.5 MB), and the one route
		// that takes a file, `/app/mail/upload`, is outside the proxy and reads its
		// body as a stream after its own checks. Server Actions keep their own
		// 16 KB limit above.
		proxyClientMaxBodySize: "2mb",
	},
	// Do not announce the framework on every response.
	poweredByHeader: false,
	// The proxy stamps every header on the routes it covers; this covers the
	// static assets its matcher skips, which still need `nosniff` and the rest.
	async headers() {
		return [
			{
				// Every path but the framed message body, which sends its own headers
				// (`features/mail/sanitize/body-document`) in place of these.
				source: "/((?!app/mail/body/[^/]+$).*)",
				headers: STATIC_SECURITY_HEADERS.map(([key, value]) => ({
					key,
					value,
				})),
			},
		];
	},
};

export default withNextIntl(nextConfig);
