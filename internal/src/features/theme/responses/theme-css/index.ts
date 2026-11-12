import "server-only";

import { readThemeCss } from "@/features/theme/queries/theme-css";
import { logApiFailure } from "@/lib/api/log-failure";

/** Seconds a browser may reuse the stylesheet; short, so an edit shows up soon. */
export const THEME_MAX_AGE_SECONDS = 60;

/**
 * Answer `GET /theme.css`: the operator's stylesheet, or a 404 when none is
 * configured or the file is unusable (the reason goes to the server log, never
 * to the client). The route is public, since the sign-in page needs it, and it
 * opens nothing else.
 */
export async function themeCssResponse(): Promise<Response> {
	let css: string | undefined;
	try {
		css = await readThemeCss();
	} catch (error) {
		logApiFailure("theme stylesheet", error);
	}
	if (css === undefined) {
		return new Response(null, { status: 404 });
	}
	return new Response(css, {
		headers: {
			"Content-Type": "text/css; charset=utf-8",
			"Cache-Control": `public, max-age=${THEME_MAX_AGE_SECONDS}`,
		},
	});
}
