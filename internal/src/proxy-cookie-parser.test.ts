import { expect, it } from "bun:test";
import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import {
	createSession,
	SESSION_COOKIE,
	verifySession,
} from "@/lib/auth/session";

// Audits 1/2: real Next parser, supplemental to cookie-parsing.sh on HTTP.
const parse = (cookie: string) =>
	new RequestCookies({
		get: (name: string) => (name === "cookie" ? cookie : null),
	} as Headers).get(SESSION_COOKIE)?.value;
it("uses the final duplicate cookie, and never authenticates the forged value", async () => {
	const token = await createSession("cookie-audit", "user");
	expect(parse(`${SESSION_COOKIE}=${token}; ${SESSION_COOKIE}=FORGED`)).toBe(
		"FORGED",
	);
	expect(
		await verifySession(
			parse(`${SESSION_COOKIE}=${token}; ${SESSION_COOKIE}=FORGED`),
		),
	).toBeNull();
	expect(parse(`${SESSION_COOKIE}=FORGED; ${SESSION_COOKIE}=${token}`)).toBe(
		token,
	);
	expect(
		await verifySession(
			parse(`${SESSION_COOKIE}=FORGED; ${SESSION_COOKIE}=${token}`),
		),
	).toEqual({ sub: "cookie-audit", role: "user" });
});
it("discards malformed percent escapes; suffixing a signed token also invalidates its signature", async () => {
	const token = await createSession("cookie-audit", "user");
	for (const suffix of ["%zz", "%"]) {
		expect(parse(`${SESSION_COOKIE}=${token}${suffix}`)).toBeUndefined();
		expect(await verifySession(`${token}${suffix}`)).toBeNull();
	}
});
