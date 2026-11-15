/**
 * Parse the value of an operator variable that names one `https` origin, the
 * way a Content-Security-Policy host source needs it: scheme, host and an
 * optional port, nothing else.
 *
 * This file has no imports and no `server-only` mark on purpose: `next.config.ts`
 * reads it at build time, where the static origin is fixed, and the server
 * reads it at start.
 *
 * Accepted: `https://cdn.example.com`, `https://cdn.example.com:8443` and the
 * same with one trailing `/`. The scheme and the host are case-insensitive and
 * come back in lower case, and a port of 443 comes back without it, so the
 * result is the exact origin a browser matches. Refused: any other scheme
 * (`http` included, even for loopback), a wildcard, a path other than `/`, a
 * query, a fragment, credentials, a space or a control character anywhere inside the
 * value, an IP literal in brackets, a host outside ASCII (write an
 * internationalised name in its `xn--` form), and a port that is not 1 to
 * 65535. A host is checked label by label against letters, digits and hyphens
 * before the URL parser sees it, because that parser lets characters through
 * in a host (`;`, `,`, `'`) that would end a policy directive or add a source.
 */

const LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const ORIGIN = new RegExp(
	`^https://(${LABEL}(?:\\.${LABEL})*)(?::([0-9]{1,5}))?/?$`,
	"i",
);

/** The exact origin `value` names, or `undefined` when it is not one. */
export function parseHttpsOrigin(value: string): string | undefined {
	const trimmed = value.trim();
	if (trimmed === "") {
		return undefined;
	}
	const match = ORIGIN.exec(trimmed);
	if (match === null) {
		return undefined;
	}
	const host = match[1] as string;
	if (host.length > 253) {
		return undefined;
	}
	const port = match[2];
	// The URL parser below refuses a port above 65535; it accepts 0.
	if (port !== undefined && Number(port) < 1) {
		return undefined;
	}
	let url: URL;
	try {
		url = new URL(`https://${host}${port === undefined ? "" : `:${port}`}`);
	} catch {
		return undefined;
	}
	return url.origin;
}
