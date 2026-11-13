import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { assertSafeOutput } from "../../sanitize/test-support/assert-safe";
import { emailFixture, stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { bodyResponse } = await import(".");

const ID = "00000000-0000-4000-8000-0000000000cc";
const html = (value: string) =>
	emailFixture({
		id: ID,
		htmlBody: [{ partId: "1", type: "text/html" }],
		bodyValues: { "1": { value } },
	});

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "operator-token";
	await cookies.signIn("admin");
});
afterEach(() => {
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
});

describe("bodyResponse", () => {
	it("serves the sanitised body under the strict policy, with nothing the sender wrote that can run", async () => {
		stubJmap({
			"Email/get": {
				list: [
					html(
						'<p onclick="x()">hi</p><script>alert(1)</script><a href="javascript:alert(1)">l</a><img src="https://t.example/p.gif"><svg onload="alert(1)"></svg><meta http-equiv="refresh" content="0;url=https://evil.example"><base href="https://evil.example/"><div style="background:url(https://t.example/x)">d</div>',
					),
				],
			},
		});

		const response = await bodyResponse(ID, false);
		const page = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-security-policy")).toContain(
			"default-src 'none'",
		);
		expect(response.headers.get("content-security-policy")).toContain(
			"img-src data:;",
		);
		expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(page).toContain("<p>hi</p>");
		expect(page).not.toMatch(
			/script|onclick|javascript:|<svg|<meta http|<base|style=|t\.example/u,
		);
		assertSafeOutput(page.slice(page.indexOf("<body>")));
	});

	it("loads remote images only when asked, and widens the policy for exactly that", async () => {
		stubJmap({
			"Email/get": {
				list: [html('<img src="https://img.example/p.png">')],
			},
		});
		const blocked = await bodyResponse(ID, false);
		expect(await blocked.text()).not.toContain("img.example");
		stubJmap({
			"Email/get": {
				list: [html('<img src="https://img.example/p.png">')],
			},
		});
		const loaded = await bodyResponse(ID, true);
		expect(loaded.headers.get("content-security-policy")).toContain(
			"img-src data: https: http:;",
		);
		expect(await loaded.text()).toContain(
			'src="https://img.example/p.png"',
		);
	});

	it("refuses an id that is not a UUID without asking JMAP", async () => {
		const seen = stubJmap({});
		for (const bad of ["x", "../etc/passwd", `${ID}.1`, ""]) {
			expect((await bodyResponse(bad, false)).status).toBe(404);
		}
		expect(seen).toHaveLength(0);
	});

	it("is a 401 without a session and a 404 for a missing message or one with no HTML body", async () => {
		stubJmap({ "Email/get": { list: [] } });
		expect((await bodyResponse(ID, false)).status).toBe(404);
		stubJmap({ "Email/get": { list: [emailFixture({ id: ID })] } });
		expect((await bodyResponse(ID, false)).status).toBe(404);
		cookies.reset();
		const seen = stubJmap({});
		const response = await bodyResponse(ID, false);
		expect(response.status).toBe(401);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(seen).toHaveLength(0);
	});

	it("answers 502 with nothing of the error when JMAP fails", async () => {
		stubJmap({});
		const response = await bodyResponse(ID, false);
		expect(response.status).toBe(502);
		expect(await response.text()).toBe("Unavailable");
	});
});
