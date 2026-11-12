import { describe, expect, it } from "bun:test";

import {
	applySecurityHeaders,
	buildCsp,
	generateNonce,
	STATIC_SECURITY_HEADERS,
} from ".";

describe("generateNonce", () => {
	it("returns a base64 value carrying 128 bits, different every call", () => {
		const nonces = new Set(Array.from({ length: 50 }, generateNonce));

		expect(nonces.size).toBe(50);
		for (const nonce of nonces) {
			expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
		}
	});
});

describe("buildCsp", () => {
	const directive = (csp: string, name: string) =>
		csp.split("; ").find((part) => part.startsWith(`${name} `));

	it("forbids framing, plugins and base-tag injection", () => {
		const csp = buildCsp("abc");

		expect(directive(csp, "frame-ancestors")).toBe(
			"frame-ancestors 'none'",
		);
		expect(directive(csp, "default-src")).toBe("default-src 'self'");
		expect(directive(csp, "object-src")).toBe("object-src 'none'");
		expect(directive(csp, "base-uri")).toBe("base-uri 'none'");
		expect(directive(csp, "form-action")).toBe("form-action 'self'");
	});

	it("allows scripts only by nonce, never inline or eval, in production", () => {
		const script = directive(buildCsp("abc"), "script-src");

		expect(script).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'");
		expect(script).not.toContain("unsafe-inline");
		expect(script).not.toContain("unsafe-eval");
	});

	it("adds unsafe-eval for development only", () => {
		expect(directive(buildCsp("abc", true), "script-src")).toContain(
			"'unsafe-eval'",
		);
	});

	it("is exactly this policy in production, so no source is widened unnoticed", () => {
		expect(buildCsp("abc")).toBe(
			[
				"default-src 'self'",
				"script-src 'self' 'nonce-abc' 'strict-dynamic'",
				"style-src 'self'",
				"img-src 'self' data:",
				"font-src 'self'",
				"connect-src 'self'",
				"object-src 'none'",
				"base-uri 'none'",
				"form-action 'self'",
				"frame-ancestors 'none'",
			].join("; "),
		);
	});

	it("differs in development by 'unsafe-eval' in script-src and nothing else", () => {
		expect(buildCsp("abc", true)).toBe(
			buildCsp("abc").replace(
				"'strict-dynamic'",
				"'strict-dynamic' 'unsafe-eval'",
			),
		);
	});

	it("does not allow inline styles", () => {
		expect(directive(buildCsp("abc"), "style-src")).toBe(
			"style-src 'self'",
		);
	});
});

describe("applySecurityHeaders", () => {
	it("sets every header and replaces rather than duplicates", () => {
		const headers = new Headers({ "X-Frame-Options": "SAMEORIGIN" });

		applySecurityHeaders(headers, "default-src 'none'");
		applySecurityHeaders(headers, "default-src 'self'");

		expect(headers.get("content-security-policy")).toBe(
			"default-src 'self'",
		);
		expect(headers.get("x-frame-options")).toBe("DENY");
		expect(headers.get("x-content-type-options")).toBe("nosniff");
		expect(headers.get("referrer-policy")).toBe("no-referrer");
	});

	it("denies every browser feature the panel does not use", () => {
		const headers = new Headers();

		applySecurityHeaders(headers, "default-src 'self'");

		expect(headers.get("permissions-policy")).toBe(
			[
				"accelerometer=()",
				"autoplay=()",
				"camera=()",
				"display-capture=()",
				"geolocation=()",
				"gyroscope=()",
				"magnetometer=()",
				"microphone=()",
				"midi=()",
				"payment=()",
				"usb=()",
			].join(", "),
		);
	});

	it("lists the headers the static config shares with the proxy", () => {
		expect(STATIC_SECURITY_HEADERS.map(([name]) => name)).toEqual([
			"X-Frame-Options",
			"X-Content-Type-Options",
			"Referrer-Policy",
			"Permissions-Policy",
		]);
	});
});
