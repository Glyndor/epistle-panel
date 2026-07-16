import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
	// Emit a self-contained server bundle so the panel ships as a minimal
	// container image running under the isolated user — the container is the
	// install, so the standalone output is required, not optional.
	output: "standalone",
	reactCompiler: true,
};

export default withNextIntl(nextConfig);
