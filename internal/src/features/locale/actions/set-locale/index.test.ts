import { beforeEach, describe, expect, it } from "bun:test";

import { SUPPORTED_LOCALES } from "@/i18n/locales";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { setLocale } = await import(".");

beforeEach(() => {
	cookies.reset();
});

describe("setLocale", () => {
	it("stores each shipped locale for a signed-in admin, with hardened attributes", async () => {
		await cookies.signIn();

		for (const locale of SUPPORTED_LOCALES) {
			cookies.writes.length = 0;

			expect(await setLocale(locale)).toBe(true);

			expect(cookies.writes).toHaveLength(1);
			const [write] = cookies.writes;
			expect(write?.name).toBe("locale");
			expect(write?.value).toBe(locale);
			expect(write?.options).toMatchObject({
				httpOnly: true,
				secure: true,
				sameSite: "lax",
				path: "/",
			});
		}
	});

	it("writes nothing without a session", async () => {
		expect(await setLocale("es")).toBe(false);
		expect(cookies.writes).toHaveLength(0);
	});

	it("writes nothing for a value outside the shipped locales", async () => {
		await cookies.signIn();

		const hostile = [
			"",
			"ja",
			"xx",
			// Case and neighbours of a shipped code.
			"ES",
			"Pt",
			"DE",
			"pt-BR",
			"fr-FR",
			"en ",
			" en",
			"en\n",
			"en\0",
			// Path and cookie-attribute injection.
			"../en",
			"../../etc/passwd",
			"en/../es",
			"es; Path=/",
			"es\r\nSet-Cookie: a=b",
			// Prototype keys, which an object lookup would accept.
			"__proto__",
			"constructor",
			"toString",
			// Far longer than any code.
			"e".repeat(10_000),
			`${"../".repeat(2_000)}en`,
		];
		for (const value of hostile) {
			expect(await setLocale(value)).toBe(false);
		}
		expect(cookies.writes).toHaveLength(0);
	});
});
