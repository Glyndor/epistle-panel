import { afterEach, describe, expect, it } from "bun:test";

import { NextRequest } from "next/server";

import { createSession, SESSION_COOKIE } from "@/lib/auth/session";

import { proxy } from "./proxy";

/**
 * The policy the proxy writes with the operator's content delivery origins:
 * the static origin the build was made for and the brand origin go to
 * `img-src` of every response that carries a policy, and to nothing else.
 * Beside `proxy.test.ts`.
 */
describe("proxy with a static or a brand origin", () => {
	const KEYS = ["PANEL_BUILT_STATIC_ORIGIN", "EPISTLE_PANEL_BRAND_ORIGIN"];
	const saved = Object.fromEntries(
		KEYS.map((key) => [key, process.env[key]]),
	);
	afterEach(() => {
		for (const key of KEYS) {
			const value = saved[key];
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	});

	const get = (path: string, cookie?: string) => {
		const req = new NextRequest(`http://panel.test${path}`);
		if (cookie) req.cookies.set(SESSION_COOKIE, cookie);
		return req;
	};
	const csp = (response: Response) =>
		response.headers.get("content-security-policy") ?? "";
	/** The policy with its nonce blanked, split by directive, `img-src` aside. */
	const rest = (response: Response) =>
		csp(response)
			.replace(/'nonce-[^']+'/g, "'nonce-X'")
			.split("; ")
			.filter((part) => !part.startsWith("img-src "));
	const img = (response: Response) =>
		csp(response)
			.split("; ")
			.find((part) => part.startsWith("img-src "));

	it("keeps `img-src 'self' data:` with neither origin set", async () => {
		for (const key of KEYS) delete process.env[key];
		const response = await proxy(get("/"));
		expect(img(response)).toBe("img-src 'self' data:");
	});

	it("adds the origins to `img-src` of the sign-in page, a signed-in page and a redirect", async () => {
		const session = await createSession("ana", "user");
		const baseline = await proxy(get("/"));
		process.env["PANEL_BUILT_STATIC_ORIGIN"] = "https://static.example.com";
		process.env["EPISTLE_PANEL_BRAND_ORIGIN"] = "https://brand.example.com";
		for (const response of [
			await proxy(get("/")),
			await proxy(get("/app/mail", session)),
			await proxy(get("/app/mail")),
		]) {
			expect(img(response)).toBe(
				"img-src 'self' data: https://static.example.com https://brand.example.com",
			);
		}
		expect(rest(await proxy(get("/")))).toEqual(rest(baseline));
	});

	it("adds only the brand origin when the build has no static origin", async () => {
		delete process.env["PANEL_BUILT_STATIC_ORIGIN"];
		process.env["EPISTLE_PANEL_BRAND_ORIGIN"] = "https://brand.example.com";
		expect(img(await proxy(get("/")))).toBe(
			"img-src 'self' data: https://brand.example.com",
		);
	});

	it("sends the same policy on the header Next reads the nonce from", async () => {
		process.env["EPISTLE_PANEL_BRAND_ORIGIN"] = "https://brand.example.com";
		const response = await proxy(get("/"));
		expect(
			response.headers.get(
				"x-middleware-request-content-security-policy",
			),
		).toContain("img-src 'self' data: https://brand.example.com;");
	});
});
