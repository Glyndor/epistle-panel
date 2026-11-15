import { afterEach, describe, expect, it, setSystemTime } from "bun:test";

import { NextRequest } from "next/server";

import {
	createSession,
	SESSION_COOKIE,
	verifySession,
} from "@/lib/auth/session";

import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";

import { proxy } from "./proxy";

/**
 * The idle timeout in the proxy: the token carries the moment of the last
 * activity, so the cookie the browser holds is re-signed with the moment of
 * the request, and a session nobody used for longer than the operator's
 * timeout goes to the sign-in page. Beside `proxy.test.ts`, which holds the
 * admin area and the headers.
 */
describe("proxy: the idle timeout", () => {
	const IDLE = "EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES";
	// happy-dom's `Headers` drops `cookie` as a forbidden header, so the
	// cookie is set through the request's own jar instead of a header.
	const request = (cookie: string | undefined, path = "/app/mail") => {
		const req = new NextRequest(`http://panel.test${path}`);
		if (cookie) {
			req.cookies.set(SESSION_COOKIE, cookie);
		}
		return req;
	};
	const user = () => createSession("ana", "user");

	/** The claims a token carries, read from its payload. */
	const payloadOf = (token: string) => {
		const encoded = token.split(".")[0] as string;
		return JSON.parse(
			atob(encoded.replaceAll("-", "+").replaceAll("_", "/")),
		) as { sub: string; role: string; exp: number; act?: number };
	};

	afterEach(() => {
		delete process.env[IDLE];
		setSystemTime();
	});

	it("re-signs the session cookie with the moment of the request", async () => {
		process.env[IDLE] = "30";
		const cookie = await user();
		setSystemTime(new Date(Date.now() + 60_000));

		const response = await proxy(request(cookie));

		const written = response.cookies.get(SESSION_COOKIE);
		expect(written?.value).toBeTruthy();
		expect(written?.value).not.toBe(cookie);
		expect(payloadOf(written?.value ?? "").act).toBe(
			Math.floor(Date.now() / 1000),
		);
		expect(await verifySession(written?.value)).toEqual({
			sub: "ana",
			role: "user",
		});
	});

	it("leaves the cookie alone while the idle timeout is off", async () => {
		const cookie = await user();

		const response = await proxy(request(cookie));

		expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
	});

	it("sends a session idle for longer than the timeout to the sign-in page", async () => {
		process.env[IDLE] = "30";
		const cookie = await user();
		setSystemTime(new Date(Date.now() + 31 * 60_000));

		const response = await proxy(request(cookie));

		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toContain("/");
		expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
	});

	it("keeps a session that was used inside the timeout", async () => {
		process.env[IDLE] = "30";
		const cookie = await user();
		setSystemTime(new Date(Date.now() + 29 * 60_000));

		const response = await proxy(request(cookie));

		expect(response.status).toBe(200);
		expect(response.headers.get("location")).toBeNull();
	});
	it("renews each role with exact remaining lifetime and all Host cookie attributes", async () => {
		process.env[IDLE] = "30";
		const start = 1_800_000_000;
		for (const [role, duration] of [
			["user", 7],
			["admin", 11],
		] as const) {
			process.env[
				`EPISTLE_PANEL_SESSION_${role.toUpperCase()}_MAX_AGE_MINUTES`
			] = String(duration);
			try {
				setSystemTime(new Date(start * 1000));
				const cookie = await createSession("same-account", role);
				setSystemTime(new Date((start + 61) * 1000));
				const path =
					role === "admin"
						? `/app/${TEST_ADMIN_ID}/queue`
						: "/app/mail";
				const response = await proxy(request(cookie, path));
				const written = response.cookies.get(SESSION_COOKIE);
				expect(written).toMatchObject({
					httpOnly: true,
					secure: true,
					sameSite: "lax",
					path: "/",
					maxAge: duration * 60 - 61,
				});
				expect(written).not.toHaveProperty("domain");
				expect(payloadOf(written?.value ?? "").exp).toBe(
					start + duration * 60,
				);
			} finally {
				delete process.env[
					`EPISTLE_PANEL_SESSION_${role.toUpperCase()}_MAX_AGE_MINUTES`
				];
			}
		}
	});

	it("does not renew static assets, prefetches, HEAD, hidden routes or redirect chains", async () => {
		process.env[IDLE] = "30";
		const cookie = await user();
		const paths = [
			"/_next/static/chunk.js",
			"/_next/image",
			"/favicon.ico",
			"/robots.txt",
			"/theme.css",
			"/brand/logo",
			"/brand/favicon",
			"/",
			"/__not-found__",
			"/app/mail/unknown",
			`/app/${TEST_ADMIN_ID}/queue`,
			"/app/mail?box=inbox",
		];
		for (const path of paths) {
			const response = await proxy(request(cookie, path));
			expect(response.cookies.get(SESSION_COOKIE), path).toBeUndefined();
			expect(response.headers.get("set-cookie"), path).toBeNull();
		}
		for (const [name, value] of [
			["next-router-prefetch", "1"],
			["next-router-segment-prefetch", "/"],
			["purpose", "prefetch"],
			["sec-purpose", "prefetch;prerender"],
			["sec-purpose", "prefetch"],
		] as const) {
			const req = request(cookie);
			req.headers.set(name, value);
			const response = await proxy(req);
			expect(response.headers.get("x-middleware-next"), name).toBe("1");
			expect(response.cookies.get(SESSION_COOKIE), name).toBeUndefined();
		}
		const head = new NextRequest("http://panel.test/app/mail", {
			method: "HEAD",
		});
		head.cookies.set(SESSION_COOKIE, cookie);
		expect((await proxy(head)).cookies.get(SESSION_COOKIE)).toBeUndefined();
	});

	it("keeps both protected areas locked for bad policy and absent secret", async () => {
		const secret = process.env["EPISTLE_PANEL_SESSION_SECRET"];
		const token = await createSession("ops", "admin");
		try {
			for (const missingSecret of [false, true]) {
				if (missingSecret)
					delete process.env["EPISTLE_PANEL_SESSION_SECRET"];
				else process.env[IDLE] = "invalid";
				const mail = await proxy(request(token));
				const admin = await proxy(
					request(token, `/app/${TEST_ADMIN_ID}/queue`),
				);
				expect(mail.status).toBe(307);
				expect(admin.headers.get("x-middleware-rewrite")).toContain(
					"/__not-found__",
				);
				expect(mail.headers.get("set-cookie")).toBeNull();
				expect(admin.headers.get("set-cookie")).toBeNull();
				delete process.env[IDLE];
			}
		} finally {
			process.env["EPISTLE_PANEL_SESSION_SECRET"] = secret;
		}
	});
});
