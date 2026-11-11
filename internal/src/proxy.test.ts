import { describe, expect, it } from "bun:test";

import { NextRequest } from "next/server";

import { createSession, SESSION_COOKIE } from "@/lib/auth/session";

import { config, proxy } from "./proxy";

// Next compiles the matcher itself; the pattern is plain enough to anchor and
// run as a regular expression here to see which paths the gate covers.
const gate = new RegExp(`^${config.matcher[0]}$`);

describe("proxy matcher", () => {
	it("leaves the login route and static assets open", () => {
		for (const path of [
			"/login",
			"/login/",
			"/_next/static/chunk.js",
			"/favicon.ico",
		]) {
			expect(gate.test(path)).toBe(false);
		}
	});

	it("gates every other route, including look-alikes of the login route", () => {
		for (const path of [
			"/",
			"/queue",
			"/loginx",
			"/login-admin",
			"/logins/x",
		]) {
			expect(gate.test(path)).toBe(true);
		}
	});
});

describe("proxy", () => {
	// happy-dom's `Headers` drops `cookie` as a forbidden header, so the
	// cookie is set through the request's own jar instead of a header.
	const request = (cookie?: string) => {
		const req = new NextRequest("http://panel.test/queue?x=1");
		if (cookie) {
			req.cookies.set(SESSION_COOKIE, cookie);
		}
		return req;
	};

	it("lets a request with a valid session through", async () => {
		const response = await proxy(request(await createSession("admin")));

		expect(response.status).toBe(200);
		expect(response.headers.get("location")).toBeNull();
	});

	it("redirects to the login page without a session or with a forged one", async () => {
		for (const cookie of [undefined, "forged.token"]) {
			const response = await proxy(request(cookie));

			expect(response.status).toBe(307);
			expect(response.headers.get("location")).toBe(
				"http://panel.test/login",
			);
		}
	});
});
