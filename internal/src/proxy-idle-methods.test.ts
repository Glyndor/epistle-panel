import { afterEach, beforeEach, expect, it, setSystemTime } from "bun:test";
import { NextRequest } from "next/server";
import {
	createSession,
	SESSION_COOKIE,
	verifySession,
} from "@/lib/auth/session";
import { proxy } from "./proxy";

const IDLE = "EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES";
const START = 1_800_000_000;
let previousIdle: string | undefined;

beforeEach(() => {
	previousIdle = process.env[IDLE];
	process.env[IDLE] = "30";
	setSystemTime(new Date(START * 1000));
});
afterEach(() => {
	if (previousIdle === undefined) delete process.env[IDLE];
	else process.env[IDLE] = previousIdle;
	setSystemTime();
});

function request(method: string, cookie?: string) {
	const req = new NextRequest("http://panel.test/app/mail", {
		method: method === "TRACE" ? "GET" : method,
	});
	// Fetch forbids constructing TRACE; model the server-received method on
	// this request alone, without changing the global Request prototype.
	if (method === "TRACE")
		Object.defineProperty(req, "method", { value: method });
	// happy-dom filters Cookie headers; use the NextRequest cookie jar.
	if (cookie) req.cookies.set(SESSION_COOKIE, cookie);
	return req;
}

for (const method of ["PUT", "DELETE", "PATCH", "OPTIONS", "TRACE", "HEAD"]) {
	it(`does not renew idle activity for authenticated ${method}`, async () => {
		const cookie = await createSession("ana", "user");
		setSystemTime(new Date((START + 60) * 1000));
		const response = await proxy(request(method, cookie));
		expect(response.headers.get("x-middleware-next")).toBe("1");
		expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
		expect(response.headers.get("set-cookie")).toBeNull();
	});
}

for (const method of ["GET", "POST"]) {
	it(`renews idle activity for authenticated ${method}`, async () => {
		const cookie = await createSession("ana", "user");
		setSystemTime(new Date((START + 60) * 1000));
		const response = await proxy(request(method, cookie));
		const renewed = response.cookies.get(SESSION_COOKIE)?.value;
		expect(renewed).toBeTruthy();
		expect(renewed).not.toBe(cookie);
		expect(await verifySession(renewed)).toEqual({
			sub: "ana",
			role: "user",
		});
		// The renewed token must survive beyond the original idle deadline.
		setSystemTime(new Date((START + 30 * 60 + 1) * 1000));
		expect(await verifySession(renewed)).toEqual({
			sub: "ana",
			role: "user",
		});
	});
}

for (const [header, value] of [
	["next-router-prefetch", "1"],
	["next-router-segment-prefetch", "/"],
	["purpose", "prefetch"],
	["sec-purpose", "prefetch;prerender"],
] as const) {
	it(`does not renew idle activity for ${header}`, async () => {
		const cookie = await createSession("ana", "user");
		setSystemTime(new Date((START + 60) * 1000));
		const req = request("GET", cookie);
		req.headers.set(header, value);
		const response = await proxy(req);
		expect(response.headers.get("x-middleware-next")).toBe("1");
		expect(response.headers.get("set-cookie")).toBeNull();
	});
}

for (const method of [
	"PUT",
	"DELETE",
	"PATCH",
	"OPTIONS",
	"TRACE",
	"GET",
	"POST",
	"HEAD",
]) {
	it(`redirects anonymous ${method} to sign-in`, async () => {
		const response = await proxy(request(method));
		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe("http://panel.test/");
		expect(response.headers.get("set-cookie")).toBeNull();
	});
}
