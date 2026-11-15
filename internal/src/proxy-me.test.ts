import { describe, expect, it } from "bun:test";

import { NextRequest } from "next/server";

import { createSession, SESSION_COOKIE } from "@/lib/auth/session";

import { proxy } from "./proxy";

/**
 * The person's own page in the proxy: `/app/me`, for a session of any role,
 * the sign-in page for a visitor without one, and the one 404 for every other
 * spelling and for anything below it. Beside `proxy.test.ts` and
 * `proxy-mail.test.ts`.
 */
describe("proxy: the person's own page", () => {
	// happy-dom's `Headers` drops `cookie` as a forbidden header, so the
	// cookie is set through the request's own jar instead of a header.
	const request = (
		cookie: string | undefined,
		path: string,
		method = "GET",
	) => {
		const req = new NextRequest(`http://panel.test${path}`, { method });
		if (cookie) {
			req.cookies.set(SESSION_COOKIE, cookie);
		}
		return req;
	};
	const admin = () => createSession("ops", "admin");
	const user = () => createSession("ana", "user");

	const isHidden = (response: Response) =>
		response.status === 200 &&
		/^http:\/\/panel\.test\/__not-found__\/?$/.test(
			response.headers.get("x-middleware-rewrite") ?? "",
		);

	const expectHeaders = (response: Response) => {
		expect(response.headers.get("content-security-policy")).toContain(
			"frame-ancestors 'none'",
		);
		expect(response.headers.get("x-frame-options")).toBe("DENY");
		expect(response.headers.get("x-robots-tag")).toBe(
			"noindex, nofollow, noarchive, nosnippet, noimageindex",
		);
	};

	it("lets a session of either role onto the page, with the headers and the nonce forwarded", async () => {
		for (const cookie of [await admin(), await user()]) {
			for (const path of ["/app/me", "/app/me/"]) {
				const response = await proxy(request(cookie, path));

				expect([path, response.status]).toEqual([path, 200]);
				expect(response.headers.get("location")).toBeNull();
				expect(isHidden(response)).toBe(false);
				expectHeaders(response);
				// Next reads the nonce from the request headers the proxy forwards.
				expect(
					response.headers.get(
						"x-middleware-request-content-security-policy",
					),
				).toContain("'nonce-");
			}
		}
	});

	it("sends a visitor without a session, with a forged one or an altered one to the sign-in page", async () => {
		const good = await user();
		for (const cookie of [undefined, "forged.token", `${good}x`]) {
			for (const path of [
				"/app/me",
				"/app/me/",
				"/APP/ME",
				"/app/me/x",
			]) {
				const response = await proxy(request(cookie, path));

				expect([path, response.status]).toEqual([path, 307]);
				expect(response.headers.get("location")).toBe(
					"http://panel.test/",
				);
				expectHeaders(response);
			}
		}
	});

	it("hides every other spelling and anything below the page from a session, never with a redirect", async () => {
		for (const cookie of [await admin(), await user()]) {
			for (const path of [
				"/app/me/x",
				"/app/me/x/",
				"/app/me//",
				"/app/Me",
				"/APP/ME",
				"/app/m%65",
				"/app/me;x",
			]) {
				const response = await proxy(request(cookie, path));

				expect([path, isHidden(response)]).toEqual([path, true]);
				expect(response.headers.get("location")).toBeNull();
				expectHeaders(response);
			}
		}
	});

	it("keeps the page's answer the same for a post as for a read, so the action is gated as the page is", async () => {
		const good = await user();
		expect((await proxy(request(good, "/app/me", "POST"))).status).toBe(
			200,
		);
		const refused = await proxy(request(undefined, "/app/me", "POST"));
		expect(refused.status).toBe(307);
		expect(refused.headers.get("location")).toBe("http://panel.test/");
	});
});
