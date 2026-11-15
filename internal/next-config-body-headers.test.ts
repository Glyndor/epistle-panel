import { expect, it } from "bun:test";
import { NextRequest } from "next/server";
import config from "./next.config";
import { createSession, SESSION_COOKIE } from "./src/lib/auth/session";
import { isMailBodyPath } from "./src/lib/routes";
import { proxy } from "./src/proxy";

// Audits 8/9: the config's exclusion and the proxy predicate share this corpus.
const paths = [
	["/app/mail/body/x", true],
	["/app/mail/body/x/y", false],
	["/app/mail/body/", false],
	["/app/mail/body/a%2Fb", true],
	["/APP/MAIL/body/x", false],
	["/app/mail/body/%2e%2e", true],
] as const;
it.each(paths)(
	"agrees on the literal path %s (body=%s)",
	async (path, body) => {
		const rules = await config.headers?.();
		expect(rules).toHaveLength(1);
		const rule = rules?.[0];
		expect(rule).toBeDefined();
		const staticApplies = new RegExp(`^${rule?.source}$`).test(path);
		expect(staticApplies).toBe(!body);
		expect(isMailBodyPath(path)).toBe(body);
		// Feed the literal spelling into the proxy; URL constructor normalisation
		// is tested separately over HTTP with curl --path-as-is.
		const request = new NextRequest("https://panel.test/");
		Object.defineProperty(request.nextUrl, "pathname", {
			value: path,
			writable: true,
			configurable: true,
		});
		request.cookies.set(
			SESSION_COOKIE,
			await createSession("body-audit", "user"),
		);
		const response = await proxy(request);
		expect(response.headers.get("x-frame-options")).toBe(
			body ? null : "DENY",
		);
		expect(response.headers.get("referrer-policy")).toBe(
			body ? null : "same-origin",
		);
		expect(rule?.headers).toEqual(
			expect.arrayContaining([
				{ key: "X-Frame-Options", value: "DENY" },
				{ key: "Referrer-Policy", value: "same-origin" },
			]),
		);
	},
);
