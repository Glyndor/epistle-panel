import { STATIC_SECURITY_HEADERS } from "@/lib/security-headers";

/**
 * The Content-Security-Policy of the page that shows one message's body.
 *
 * It allows nothing but the images the reader asked for: no script, no style,
 * no frame, no form, no `<base>`, no font, no connection; `sandbox` repeats the
 * iframe's own sandbox on the response itself, so the policy holds when the
 * address is opened on its own. `frame-ancestors 'self'` lets the panel's own
 * reader embed it and nothing else.
 */
export function bodyCsp(remoteImages: boolean): string {
	return [
		"default-src 'none'",
		`img-src data:${remoteImages ? " https: http:" : ""}`,
		"style-src 'none'",
		"script-src 'none'",
		"form-action 'none'",
		"base-uri 'none'",
		"frame-ancestors 'self'",
		"sandbox allow-popups allow-popups-to-escape-sandbox",
	].join("; ");
}

/**
 * Headers of the body page: the panel's own static security headers with the
 * framing ones relaxed to the same origin, and the policy above. This is the
 * only response of the panel that may be framed, so the proxy and the static
 * headers of `next.config.ts` leave it alone and these stand.
 */
export function bodyHeaders(remoteImages: boolean): Record<string, string> {
	return {
		...Object.fromEntries(STATIC_SECURITY_HEADERS),
		"Content-Type": "text/html; charset=utf-8",
		"Content-Security-Policy": bodyCsp(remoteImages),
		"X-Frame-Options": "SAMEORIGIN",
		"Cache-Control": "private, no-store",
	};
}

/** The page that holds a sanitised fragment. It carries no style and no script. */
export function bodyDocument(fragment: string): string {
	return `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark"><meta name="referrer" content="no-referrer"></head><body>${fragment}</body></html>`;
}
