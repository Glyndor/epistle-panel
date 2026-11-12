import type { MetadataRoute } from "next";

/**
 * `/robots.txt`: ask every crawler to stay out of the whole panel. The proxy
 * lets exactly this path through without a session, so a crawler reads the
 * refusal instead of being redirected to the login page.
 */
export default function robots(): MetadataRoute.Robots {
	return {
		rules: { userAgent: "*", disallow: "/" },
	};
}
