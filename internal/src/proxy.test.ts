import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { NextRequest } from "next/server";

import { createSession, SESSION_COOKIE } from "@/lib/auth/session";
import {
	OTHER_ADMIN_ID,
	TEST_ADMIN_ID,
} from "@/lib/config/test-support/admin-id";

import { HIDDEN_PATH, proxy } from "./proxy";

describe("proxy", () => {
	const ID = TEST_ADMIN_ID;
	// happy-dom's `Headers` drops `cookie` as a forbidden header, so the
	// cookie is set through the request's own jar instead of a header.
	const request = (cookie?: string, path = `/app/${ID}/queue?x=1`) => {
		const req = new NextRequest(`http://panel.test${path}`);
		if (cookie) {
			req.cookies.set(SESSION_COOKIE, cookie);
		}
		return req;
	};
	const admin = () => createSession("ops", "admin");
	const user = () => createSession("ana", "user");

	const expectSecurityHeaders = (response: Response) => {
		expect(response.headers.get("content-security-policy")).toContain(
			"frame-ancestors 'none'",
		);
		expect(response.headers.get("x-frame-options")).toBe("DENY");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
		expect(response.headers.get("referrer-policy")).toBe("same-origin");
		expect(response.headers.get("permissions-policy")).toContain(
			"camera=()",
		);
		expect(response.headers.get("x-robots-tag")).toBe(
			"noindex, nofollow, noarchive, nosnippet, noimageindex",
		);
	};

	/** Whether the proxy hid the request: a rewrite to the one fixed 404 path. */
	const isHidden = (response: Response) =>
		response.status === 200 &&
		/^http:\/\/panel\.test\/__not-found__\/?$/.test(
			response.headers.get("x-middleware-rewrite") ?? "",
		);

	it("lets an admin session through under /app/{id}, with the headers", async () => {
		const response = await proxy(request(await admin()));

		expect(response.status).toBe(200);
		expect(response.headers.get("location")).toBeNull();
		expect(response.headers.get("x-middleware-rewrite")).toBeNull();
		expectSecurityHeaders(response);
	});

	it("leaves the framed message body's headers to its route, only with a session", async () => {
		const id = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";
		const framed = await proxy(
			request(await user(), `/app/mail/body/${id}?images=1`),
		);
		expect(framed.status).toBe(200);
		expect(framed.headers.get("content-security-policy")).toBeNull();
		expect(framed.headers.get("x-frame-options")).toBeNull();

		// Without a session it is the redirect to the sign-in page, with the panel's headers.
		const denied = await proxy(request(undefined, `/app/mail/body/${id}`));
		expect(denied.status).toBe(307);
		expectSecurityHeaders(denied);

		// A different spelling is not that route and keeps the panel's headers, which forbid framing.
		for (const path of [
			`/APP/mail/body/${id}`,
			`/app/mail/body/${id}/x`,
			"/app/mail/body/",
			"/app/mail",
		]) {
			expectSecurityHeaders(await proxy(request(await user(), path)));
		}
	});

	it("hands the nonce to Next through the forwarded request headers", async () => {
		const response = await proxy(request(await admin()));

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
		const cookie = await admin();
		const first = await proxy(request(cookie));
		const second = await proxy(request(cookie));

		expect(first.headers.get("content-security-policy")).not.toBe(
			second.headers.get("content-security-policy"),
		);
	});

	it("hides the admin area, never redirects, without a session, with a forged one, and with a user session", async () => {
		for (const cookie of [undefined, "forged.token", await user()]) {
			const response = await proxy(request(cookie));

			expect(response.headers.get("location")).toBeNull();
			expect(isHidden(response)).toBe(true);
			expectSecurityHeaders(response);
		}
	});

	it("answers the same hidden response whichever part is wrong, so it tells nothing", async () => {
		const cases: Array<[string | undefined, string]> = [
			[undefined, `/app/${ID}/queue`],
			[await user(), `/app/${ID}/queue`],
			[await admin(), `/app/${OTHER_ADMIN_ID}/queue`],
			[await admin(), "/app/queue"],
			[await admin(), "/app"],
		];
		const seen = new Set<string>();
		for (const [cookie, path] of cases) {
			const response = await proxy(request(cookie, path));
			expect(isHidden(response), path).toBe(true);
			const headers = new Headers(response.headers);
			// Next consumes this internal list (it names the request headers it
			// forwards) and the forwarded cookie, and never sends them; the nonce is the
			// only other thing that may differ between two requests.
			headers.delete("x-middleware-override-headers");
			headers.delete("x-middleware-request-cookie");
			for (const name of [
				"content-security-policy",
				"x-middleware-request-content-security-policy",
			]) {
				headers.set(
					name,
					(headers.get(name) ?? "").replace(
						/'nonce-[^']+'/g,
						"'nonce'",
					),
				);
			}
			seen.add(JSON.stringify([...headers].sort()));
		}
		expect(seen.size).toBe(1);
	});

	it("hides /app, /app/ and every other second segment, also for an admin", async () => {
		const session = await admin();
		for (const path of [
			"/app",
			"/app/",
			"/app/queue",
			"/app/accounts/alice",
			"/app/unknown",
			"/APP/queue",
			"/%61pp/queue",
			"//app/queue",
			"/app%2fqueue",
			"/login/../app/queue",
			"/./app/queue",
			"/x/../app/queue",
			"/%2e%2e/app/queue",
			"/app;x",
			"/app/%E0%A4%A",
		]) {
			for (const cookie of [undefined, session]) {
				const response = await proxy(request(cookie, path));

				expect(isHidden(response), path).toBe(true);
			}
		}
	});

	it("hides every near miss of the configured id, an admin session included", async () => {
		const session = await admin();
		const longer = `${ID}0`;
		for (const segment of [
			ID.toUpperCase(),
			`${ID.slice(0, 8)}`,
			ID.slice(0, -1),
			longer,
			ID.replace("-", ""),
			OTHER_ADMIN_ID,
			"mailx",
			"",
			"6ba7b810-9dad-11d1-80b4-00c04fd430c8",
			"018f3a6e-7b2c-7c5a-9a3b-1c2d3e4f5a6b",
			`${ID}%00`,
			`${ID}%20`,
			"３f2b8c1e-5d4a-4b7e-9c3d-1a2b3c4d5e6f",
			ID.replaceAll("f", "%66").toUpperCase(),
		]) {
			const response = await proxy(
				request(session, `/app/${segment}/queue`),
			);

			expect(isHidden(response), segment).toBe(true);
		}
	});

	it("reads the id in the spellings a router would, so an admin still gets in, with a trailing or doubled slash", async () => {
		const session = await admin();
		for (const path of [
			`/app/${ID}`,
			`/app/${ID}/`,
			`/app//${ID}`,
			`/app/${ID}//queue`,
			`//app/${ID}/queue`,
			`/%61pp/${ID}/queue`,
			`/app/${ID.replace("3f", "%33f")}/queue`,
			`/app/${ID};x=1/queue`,
		]) {
			const response = await proxy(request(session, path));

			expect(isHidden(response), path).toBe(false);
			expect(response.status, path).toBe(200);
		}
	});

	it("hides the admin area when the installation has no admin id, even from an admin", async () => {
		const saved = process.env["EPISTLE_PANEL_ADMIN_ID"];
		delete process.env["EPISTLE_PANEL_ADMIN_ID"];
		try {
			for (const path of [
				`/app/${ID}/queue`,
				"/app/",
				"/app/mail/x/..",
			]) {
				const response = await proxy(request(await admin(), path));
				if (path.startsWith("/app/mail")) {
					expect(isHidden(response)).toBe(false);
				} else {
					expect(isHidden(response), path).toBe(true);
				}
			}
		} finally {
			process.env["EPISTLE_PANEL_ADMIN_ID"] = saved;
		}
	});

	it("hides the admin area, and does not fall open, when the configured id is malformed or its file unreadable", async () => {
		const saved = process.env["EPISTLE_PANEL_ADMIN_ID"];
		try {
			for (const value of ["", "not-a-uuid", ID.toUpperCase()]) {
				process.env["EPISTLE_PANEL_ADMIN_ID"] = value;
				// The segment the attacker sends equals the malformed value.
				const path = `/app/${encodeURIComponent(value)}/queue`;
				const response = await proxy(request(await admin(), path));
				expect(isHidden(response), value).toBe(true);
			}
		} finally {
			process.env["EPISTLE_PANEL_ADMIN_ID"] = saved;
		}
	});

	it("sends /app/mail to the sign-in page without a session, with the headers", async () => {
		for (const cookie of [undefined, "forged.token"]) {
			for (const path of ["/app/mail", "/app/mail/", "/APP/MAIL/x"]) {
				const response = await proxy(request(cookie, path));

				expect(response.status, path).toBe(307);
				expect(response.headers.get("location")).toBe(
					"http://panel.test/",
				);
				expectSecurityHeaders(response);
			}
		}
	});

	it("lets a session into the routes of the mail area and hides what is none, with the one 404", async () => {
		const cookie = await user();
		for (const path of [
			"/app/mail/inbox",
			"/app/mail/folder/Work_2FQ4",
			`/app/mail/trash/${ID}`,
			"/app/mail/compose",
		]) {
			expect([
				path,
				isHidden(await proxy(request(cookie, path))),
			]).toEqual([path, false]);
		}
		for (const path of [
			"/app/mail/no-such-place",
			"/app/mail/Inbox",
			"/app/mail/label/Work",
			"/app/mail/inbox/not-an-id",
			// Shaped like an id, but not one the page reads: the page would answer 200.
			"/app/mail/inbox/11111111-1111-1111-1111-111111111111",
			"/app/mail/folder/Work%2FQ4",
			"/app/mail/folder/Work_2fQ4",
			"/app/mail/folder/a_00b",
			"/APP/MAIL/inbox",
		]) {
			const response = await proxy(request(cookie, path));
			expect([path, isHidden(response)]).toEqual([path, true]);
			// Hidden, never a redirect that would tell it apart from any other path.
			expect(response.headers.get("location")).toBeNull();
		}
	});

	it("redirects an address from before a folder was a path, for a session, with a real 307", async () => {
		const cookie = await user();
		const cases = [
			["/app/mail?box=Archive", "/app/mail/folder/Archive", ""],
			[
				`/app/mail?box=Work%2FQ4&page=2&filter=unread&q=a+b&msg=${ID}`,
				`/app/mail/folder/Work_2FQ4/${ID}`,
				"?page=2&filter=unread&q=a+b",
			],
			[`/app/mail/?msg=${ID}`, `/app/mail/inbox/${ID}`, ""],
		] as const;
		for (const [path, pathname, search] of cases) {
			const response = await proxy(request(cookie, path));
			expect([path, response.status]).toEqual([path, 307]);
			const to = new URL(response.headers.get("location") ?? "");
			expect([to.origin, to.pathname, to.search]).toEqual([
				"http://panel.test",
				pathname,
				search,
			]);
			// The redirect carries the panel's headers like any other response.
			expect(response.headers.get("content-security-policy")).toContain(
				"frame-ancestors 'none'",
			);
		}
	});

	it("redirects an old address nowhere but into the mail area", async () => {
		const cookie = await user();
		for (const box of [
			"//evil.example",
			"https://evil.example/",
			"../../..",
			"@evil.example",
			"/\\evil.example",
		]) {
			const response = await proxy(
				request(cookie, `/app/mail?box=${encodeURIComponent(box)}`),
			);
			expect([box, response.status]).toEqual([box, 307]);
			const to = new URL(response.headers.get("location") ?? "");
			expect([box, to.origin]).toEqual([box, "http://panel.test"]);
			expect([box, to.pathname.startsWith("/app/mail/folder/")]).toEqual([
				box,
				true,
			]);
			expect([box, to.pathname.split("/").length]).toEqual([box, 5]);
		}
	});

	it("does not redirect what names no folder and no message, another page, a form post, or a visitor with no session", async () => {
		const cookie = await user();
		for (const path of [
			"/app/mail",
			"/app/mail?page=2&filter=unread&q=x",
			"/app/mail?box=a%0Ab&msg=nope",
			"/app/mail/inbox?box=Sent",
			"/app/mail/compose?msg=" + ID,
		]) {
			const response = await proxy(request(cookie, path));
			expect([path, response.headers.get("location")]).toEqual([
				path,
				null,
			]);
			expect([path, isHidden(response)]).toEqual([path, false]);
		}
		// A Server Action posted to the home is the action, whatever its query.
		const post = new NextRequest("http://panel.test/app/mail?box=Sent", {
			method: "POST",
		});
		post.cookies.set(SESSION_COOKIE, cookie);
		const posted = await proxy(post);
		expect(posted.headers.get("location")).toBeNull();
		expect(isHidden(posted)).toBe(false);
		// Without a session the old address says nothing of where it would lead.
		const anonymous = await proxy(request(undefined, "/app/mail?box=Sent"));
		expect(anonymous.status).toBe(307);
		const to = new URL(anonymous.headers.get("location") ?? "");
		expect([to.pathname, to.search]).toEqual(["/", ""]);
	});

	it("still sends any path under the mail area to the sign-in page without a session", async () => {
		for (const path of [
			"/app/mail/inbox",
			"/app/mail/no-such-place",
			"/app/mail/folder/Work%2FQ4",
		]) {
			const response = await proxy(request(undefined, path));
			expect([path, response.status]).toEqual([path, 307]);
			expect(
				new URL(response.headers.get("location") ?? "").pathname,
			).toBe("/");
		}
	});

	it("lets a session of any role into /app/mail", async () => {
		for (const cookie of [await admin(), await user()]) {
			const response = await proxy(request(cookie, "/app/mail"));

			expect(response.status).toBe(200);
			expect(response.headers.get("location")).toBeNull();
			expect(isHidden(response)).toBe(false);
		}
	});

	it("serves the sign-in page without a session, with the headers", async () => {
		const response = await proxy(request(undefined, "/"));

		expect(response.status).toBe(200);
		expect(response.headers.get("location")).toBeNull();
		expectSecurityHeaders(response);
	});

	it("hides every other path as the one 404: the old login and the old unprefixed paths", async () => {
		for (const path of [
			"/login",
			"/loginx",
			"/accounts",
			"/domains",
			"/queue",
			"/application",
			"/x/app",
			"/zzz",
		]) {
			for (const cookie of [undefined, await admin()]) {
				const response = await proxy(request(cookie, path));

				expect(response.headers.get("location"), path).toBeNull();
				expect(isHidden(response), path).toBe(true);
				expectSecurityHeaders(response);
			}
		}
	});

	it("lets the hidden path itself on, so a rewrite that Next sends over the network does not loop", async () => {
		const response = await proxy(request(undefined, HIDDEN_PATH));

		expect(response.status).toBe(200);
		expect(response.headers.get("x-middleware-rewrite")).toBeNull();
		expect(isHidden(response)).toBe(false);
	});

	it("rewrites to a fixed path and drops the query and the trailing slash of the hidden request", async () => {
		const response = await proxy(request(undefined, "/app/zzz/?a=1&b=2"));

		expect(response.headers.get("x-middleware-rewrite")).toMatch(
			/^http:\/\/panel\.test\/__not-found__\/?$/,
		);
		expect(HIDDEN_PATH).toBe("/__not-found__");
	});

	it("keeps the redirect on the request's own origin and drops the query", async () => {
		// The forwarded host is out of the proxy's hands: Next derives the
		// request origin from it, and rewrites a same-origin Location into a
		// relative one on the wire. What the proxy owns is that the redirect
		// never leaves that origin and carries nothing from the request.
		const req = new NextRequest(
			"http://panel.test/app/mail?next=http://evil.test",
			{
				headers: { "x-forwarded-host": "evil.test" },
			},
		);

		const response = await proxy(req);

		expect(new URL(response.headers.get("location") ?? "").pathname).toBe(
			"/",
		);
		expect(new URL(response.headers.get("location") ?? "").search).toBe("");
		expect(new URL(response.headers.get("location") ?? "").origin).toBe(
			req.nextUrl.origin,
		);
	});
});

describe("proxy script policy per environment", () => {
	const cookie = () => createSession("admin", "admin");

	/** Run `body` with `NODE_ENV` set to `value`, then put the old value back. */
	async function underNodeEnv(
		value: string,
		body: () => Promise<void>,
	): Promise<void> {
		const env = process.env as Record<string, string | undefined>;
		const saved = env["NODE_ENV"];
		env["NODE_ENV"] = value;
		try {
			await body();
		} finally {
			env["NODE_ENV"] = saved;
		}
	}

	const scriptSrc = (response: Response): string =>
		(response.headers.get("content-security-policy") ?? "")
			.split("; ")
			.find((part) => part.startsWith("script-src ")) ?? "";

	const signedIn = async () => {
		const req = new NextRequest(
			`http://panel.test/app/${TEST_ADMIN_ID}/queue`,
		);
		req.cookies.set(SESSION_COOKIE, await cookie());
		return req;
	};

	for (const value of ["production", "test"]) {
		it(`never allows eval when NODE_ENV is ${value}`, async () => {
			await underNodeEnv(value, async () => {
				const allowed = await proxy(await signedIn());
				const redirected = await proxy(
					new NextRequest("http://panel.test/app/mail"),
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
				new NextRequest("http://panel.test/app/mail"),
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

describe("proxy with a CAPTCHA provider enabled", () => {
	const names = [
		"EPISTLE_PANEL_CAPTCHA_PROVIDER",
		"EPISTLE_PANEL_CAPTCHA_SITE_KEY",
		"EPISTLE_PANEL_CAPTCHA_SECRET_KEY",
	];
	const csp = (response: Response) =>
		response.headers.get("content-security-policy") ?? "";
	const get = (path: string, cookie?: string) => {
		const req = new NextRequest(`http://panel.test${path}`);
		if (cookie) {
			req.cookies.set(SESSION_COOKIE, cookie);
		}
		return proxy(req);
	};

	beforeEach(() => {
		process.env["EPISTLE_PANEL_CAPTCHA_PROVIDER"] = "turnstile";
		process.env["EPISTLE_PANEL_CAPTCHA_SITE_KEY"] = "site";
		process.env["EPISTLE_PANEL_CAPTCHA_SECRET_KEY"] = "secret";
	});
	afterEach(() => {
		for (const name of names) {
			delete process.env[name];
		}
	});

	it("widens the sign-in page's policy with that provider's hosts, and keeps it free of inline styles", async () => {
		for (const path of ["/"]) {
			const policy = csp(await get(path));

			expect(policy).toContain("script-src 'self'");
			expect(policy).toContain("https://challenges.cloudflare.com");
			expect(policy).toContain(
				"frame-src 'self' https://challenges.cloudflare.com",
			);
			expect(policy).toContain("style-src 'self';");
			expect(policy).not.toContain("unsafe-inline");
		}
	});

	it("widens no other response: a page, a redirect, and look-alikes of the login path", async () => {
		const session = await createSession("admin", "admin");
		for (const response of [
			await get(`/app/${TEST_ADMIN_ID}/queue`, session),
			await get("/app/mail"),
			await get("/app/queue"),
			await get("/login"),
			await get("/x/login"),
		]) {
			expect(csp(response)).not.toContain("challenges.cloudflare.com");
			expect(csp(response)).not.toContain("frame-src");
		}
	});

	it("leaves the sign-in page's policy alone when the CAPTCHA is off or misconfigured", async () => {
		delete process.env["EPISTLE_PANEL_CAPTCHA_PROVIDER"];
		expect(csp(await get("/"))).not.toContain("challenges.cloudflare.com");

		process.env["EPISTLE_PANEL_CAPTCHA_PROVIDER"] = "turnstile";
		delete process.env["EPISTLE_PANEL_CAPTCHA_SITE_KEY"];
		expect(csp(await get("/"))).not.toContain("challenges.cloudflare.com");
	});

	it("still serves the sign-in page without a session", async () => {
		expect((await get("/")).status).toBe(200);
	});
});
