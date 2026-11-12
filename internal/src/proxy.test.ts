import { describe, expect, it } from "bun:test";

import { NextRequest } from "next/server";

import { createSession, SESSION_COOKIE } from "@/lib/auth/session";

import { config, proxy } from "./proxy";

// Next compiles the matcher itself; the pattern is plain enough to anchor and
// run as a regular expression here to see which paths reach the proxy.
const covered = new RegExp(`^${config.matcher[0]}$`);

describe("proxy matcher", () => {
	it("skips Next internals and static assets only", () => {
		for (const path of [
			"/_next/static/chunk.js",
			"/_next/image",
			"/favicon.ico",
		]) {
			expect(covered.test(path)).toBe(false);
		}
	});

	it("covers the login route so it gets the nonce, and every other route", () => {
		for (const path of [
			"/",
			"/login",
			"/queue",
			"/loginx",
			"/login-admin",
		]) {
			expect(covered.test(path)).toBe(true);
		}
	});

	it("does not let look-alikes of the skipped paths escape the proxy", () => {
		for (const path of [
			"/_next/staticx/a.js",
			"/favicon.icox",
			"/favicon.ico/queue",
			"/_NEXT/static/a.js",
		]) {
			expect(covered.test(path)).toBe(true);
		}
	});
});

describe("proxy", () => {
	// happy-dom's `Headers` drops `cookie` as a forbidden header, so the
	// cookie is set through the request's own jar instead of a header.
	const request = (cookie?: string, path = "/queue?x=1") => {
		const req = new NextRequest(`http://panel.test${path}`);
		if (cookie) {
			req.cookies.set(SESSION_COOKIE, cookie);
		}
		return req;
	};

	const expectSecurityHeaders = (response: Response) => {
		expect(response.headers.get("content-security-policy")).toContain(
			"frame-ancestors 'none'",
		);
		expect(response.headers.get("x-frame-options")).toBe("DENY");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("referrer-policy")).toBe("no-referrer");
		expect(response.headers.get("permissions-policy")).toContain(
			"camera=()",
		);
	};

	it("lets a request with a valid session through, with the headers", async () => {
		const response = await proxy(request(await createSession("admin")));

		expect(response.status).toBe(200);
		expect(response.headers.get("location")).toBeNull();
		expectSecurityHeaders(response);
	});

	it("hands the nonce to Next through the forwarded request headers", async () => {
		const response = await proxy(request(await createSession("admin")));

		const csp = response.headers.get("content-security-policy") ?? "";
		const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
		expect(nonce).toBeTruthy();
		expect(
			response.headers.get(
				"x-middleware-request-content-security-policy",
			),
		).toBe(csp);
	});

	it("uses a fresh nonce on every request", async () => {
		const cookie = await createSession("admin");
		const first = await proxy(request(cookie));
		const second = await proxy(request(cookie));

		expect(first.headers.get("content-security-policy")).not.toBe(
			second.headers.get("content-security-policy"),
		);
	});

	it("redirects to the login page without a session or with a forged one, with the headers", async () => {
		for (const cookie of [undefined, "forged.token"]) {
			const response = await proxy(request(cookie));

			expect(response.status).toBe(307);
			expect(response.headers.get("location")).toBe(
				"http://panel.test/login",
			);
			expectSecurityHeaders(response);
		}
	});

	it("serves the login route without a session, with the headers", async () => {
		for (const path of ["/login", "/login/"]) {
			const response = await proxy(request(undefined, path));

			expect(response.status).toBe(200);
			expectSecurityHeaders(response);
		}
	});

	it("gates look-alikes of the login route", async () => {
		for (const path of [
			"/LOGIN",
			"/Login",
			"/loginx",
			"/login-admin",
			"/logins/x",
			"/%6cogin",
			"/%6Cogin/",
			"//login",
			"/login%2f..%2fqueue",
			"/login/../queue",
			"/./queue",
			"/%2e%2e/queue",
			"/login;x",
		]) {
			const response = await proxy(request(undefined, path));

			expect(response.status, path).toBe(307);
		}
	});

	it("keeps the redirect on the request's own origin and drops the query", async () => {
		// The forwarded host is out of the proxy's hands: Next derives the
		// request origin from it, and rewrites a same-origin Location into a
		// relative one on the wire. What the proxy owns is that the redirect
		// never leaves that origin and carries nothing from the request.
		const req = new NextRequest(
			"http://panel.test/queue?next=http://evil.test",
			{
				headers: { "x-forwarded-host": "evil.test" },
			},
		);

		const response = await proxy(req);

		expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
			"/login",
		);
		expect(new URL(response.headers.get("location") ?? "").search).toBe("");
		expect(new URL(response.headers.get("location") ?? "").origin).toBe(
			req.nextUrl.origin,
		);
	});
});

describe("proxy script policy per environment", () => {
	const cookie = () => createSession("admin");

	/** Run `body` with `NODE_ENV` set to `value`, then put the old value back. */
	async function underNodeEnv(
		value: string,
		body: () => Promise<void>,
	): Promise<void> {
		const env = process.env as Record<string, string | undefined>;
		const saved = env.NODE_ENV;
		env.NODE_ENV = value;
		try {
			await body();
		} finally {
			env.NODE_ENV = saved;
		}
	}

	const scriptSrc = (response: Response): string =>
		(response.headers.get("content-security-policy") ?? "")
			.split("; ")
			.find((part) => part.startsWith("script-src ")) ?? "";

	const signedIn = async () => {
		const req = new NextRequest("http://panel.test/queue");
		req.cookies.set(SESSION_COOKIE, await cookie());
		return req;
	};

	for (const value of ["production", "test"]) {
		it(`never allows eval when NODE_ENV is ${value}`, async () => {
			await underNodeEnv(value, async () => {
				const allowed = await proxy(await signedIn());
				const redirected = await proxy(
					new NextRequest("http://panel.test/queue"),
				);

				for (const response of [allowed, redirected]) {
					expect(scriptSrc(response)).toMatch(
						/^script-src 'self' 'nonce-[^']+' 'strict-dynamic'$/,
					);
				}
				expect(
					allowed.headers.get(
						"x-middleware-request-content-security-policy",
					),
				).not.toContain("unsafe-eval");
			});
		});
	}

	it("allows eval in development only, on every response and on the forwarded header", async () => {
		await underNodeEnv("development", async () => {
			const allowed = await proxy(await signedIn());
			const redirected = await proxy(
				new NextRequest("http://panel.test/queue"),
			);

			expect(scriptSrc(allowed)).toEndWith(
				"'strict-dynamic' 'unsafe-eval'",
			);
			expect(scriptSrc(redirected)).toEndWith(
				"'strict-dynamic' 'unsafe-eval'",
			);
			expect(
				allowed.headers.get(
					"x-middleware-request-content-security-policy",
				),
			).toContain("'unsafe-eval'");
		});
	});
});
