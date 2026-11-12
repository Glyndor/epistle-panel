/**
 * Security response headers for the panel.
 *
 * The Content-Security-Policy carries a per-request nonce: Next injects inline
 * scripts (the streamed React payload and the bootstrap), and a nonce is the
 * strictest way to allow exactly those without `'unsafe-inline'`. A nonce only
 * works on dynamically rendered pages, which every panel route is, because the
 * root layout reads the session cookie. Building the headers here keeps the
 * proxy (which owns the nonce) and its tests on one definition.
 */

import type { CspWidening } from "./captcha-sources";

/** Header Next reads from the request to learn the nonce it must stamp on its inline scripts. */
export const CSP_HEADER = "content-security-policy";

/** Number of random bytes behind each nonce (128 bits). */
const NONCE_BYTES = 16;

/**
 * Create an unguessable, base64 nonce. Call it once per request and never
 * reuse the value, or the nonce stops being a secret.
 */
export function generateNonce(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
	return btoa(String.fromCharCode(...bytes));
}

/**
 * Build the Content-Security-Policy for one request.
 *
 * `'strict-dynamic'` lets the nonced bootstrap load Next's chunks, and the
 * host allowlist is ignored by browsers that support it. `development` adds
 * `'unsafe-eval'`, which React's dev tooling needs and production never does.
 * `widening` adds one CAPTCHA provider's sources to `script-src`, `connect-src`
 * and a new `frame-src`, and to nothing else; the proxy passes it for the
 * sign-in page only.
 */
export function buildCsp(
	nonce: string,
	development = false,
	widening?: CspWidening,
): string {
	const scriptSrc = [
		"'self'",
		`'nonce-${nonce}'`,
		"'strict-dynamic'",
		...(development ? ["'unsafe-eval'"] : []),
		...(widening?.script ?? []),
	];
	const connectSrc = ["'self'", ...(widening?.connect ?? [])];
	return [
		"default-src 'self'",
		`script-src ${scriptSrc.join(" ")}`,
		"style-src 'self'",
		"img-src 'self' data:",
		"font-src 'self'",
		`connect-src ${connectSrc.join(" ")}`,
		// Frames fall back to `default-src 'self'` unless a provider needs more.
		...(widening ? [`frame-src 'self' ${widening.frame.join(" ")}`] : []),
		"object-src 'none'",
		"base-uri 'none'",
		"form-action 'self'",
		"frame-ancestors 'none'",
	].join("; ");
}

/** Browser features the panel never uses, denied to the page and to any frame. */
const DENIED_FEATURES = [
	"accelerometer",
	"autoplay",
	"camera",
	"display-capture",
	"geolocation",
	"gyroscope",
	"magnetometer",
	"microphone",
	"midi",
	"payment",
	"usb",
] as const;

/**
 * The panel is never indexed: every response says so, including redirects,
 * static assets and `robots.txt`, whatever the markup contains.
 */
export const ROBOTS_DIRECTIVES =
	"noindex, nofollow, noarchive, nosnippet, noimageindex";

/** Headers that do not vary per request, as name/value pairs. */
export const STATIC_SECURITY_HEADERS: ReadonlyArray<
	readonly [name: string, value: string]
> = [
	["X-Frame-Options", "DENY"],
	["X-Content-Type-Options", "nosniff"],
	["Referrer-Policy", "no-referrer"],
	["X-Robots-Tag", ROBOTS_DIRECTIVES],
	["Permissions-Policy", DENIED_FEATURES.map((f) => `${f}=()`).join(", ")],
];

/**
 * Set every security header, including the CSP, on a response's headers.
 * `set` replaces any earlier value, so calling it twice never duplicates one.
 */
export function applySecurityHeaders(headers: Headers, csp: string): void {
	headers.set("Content-Security-Policy", csp);
	for (const [name, value] of STATIC_SECURITY_HEADERS) {
		headers.set(name, value);
	}
}
