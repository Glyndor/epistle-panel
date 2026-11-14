import { describe, expect, it } from "bun:test";

import { bodyCsp, bodyDocument, bodyHeaders } from ".";

describe("bodyCsp", () => {
	it("allows nothing but data images and sandboxes the response", () => {
		const csp = bodyCsp(false);
		expect(csp).toContain("default-src 'none'");
		expect(csp).toContain("img-src data:;");
		expect(csp).toContain("script-src 'none'");
		expect(csp).toContain("style-src 'none'");
		expect(csp).toContain("base-uri 'none'");
		expect(csp).toContain("form-action 'none'");
		expect(csp).toContain("frame-ancestors 'self'");
		expect(csp).toContain(
			"sandbox allow-popups allow-popups-to-escape-sandbox",
		);
		expect(csp).not.toContain("allow-scripts");
		expect(csp).not.toContain("allow-same-origin");
		expect(csp).not.toContain("unsafe-inline");
	});

	it("adds remote images only when they were asked for", () => {
		expect(bodyCsp(true)).toContain("img-src data: https: http:;");
		expect(bodyCsp(false)).not.toContain("https:");
	});
});

describe("bodyHeaders", () => {
	it("frames only for the same origin, never sniffs, never caches and sends no referrer", () => {
		const headers = bodyHeaders(false);
		expect(headers["X-Frame-Options"]).toBe("SAMEORIGIN");
		expect(headers["X-Content-Type-Options"]).toBe("nosniff");
		expect(headers["Cache-Control"]).toBe("private, no-store");
		expect(headers["Referrer-Policy"]).toBe("no-referrer");
		expect(headers["Content-Type"]).toBe("text/html; charset=utf-8");
		expect(headers["Content-Security-Policy"]).toBe(bodyCsp(false));
		expect(headers["X-Robots-Tag"]).toContain("noindex");
	});
});

describe("bodyDocument", () => {
	it("wraps a fragment in a page with no style, script or base", () => {
		const page = bodyDocument("<p>x</p>");
		expect(page).toStartWith("<!doctype html>");
		expect(page).toContain("<body><p>x</p></body>");
		expect(page).not.toMatch(/<style|<script|<base|<link/u);
		expect(page).toContain('name="referrer" content="no-referrer"');
	});

	it("follows the browser's scheme without a chosen theme, and takes a chosen one", () => {
		expect(bodyDocument("<p>x</p>")).toContain(
			'<meta name="color-scheme" content="light dark">',
		);
		expect(bodyDocument("<p>x</p>", null)).toContain(
			'name="color-scheme" content="light dark"',
		);
		expect(bodyDocument("<p>x</p>", "dark")).toContain(
			'<meta name="color-scheme" content="dark">',
		);
		expect(bodyDocument("<p>x</p>", "light")).toContain(
			'<meta name="color-scheme" content="light">',
		);
	});

	it("writes nothing but the two themes into the markup, whatever it is handed", () => {
		for (const value of [
			"system",
			"DARK",
			"dark light",
			'dark"><script>alert(1)</script>',
			'" http-equiv="refresh',
			"",
		]) {
			expect(bodyDocument("<p>x</p>", value)).toBe(
				bodyDocument("<p>x</p>"),
			);
		}
	});
});
