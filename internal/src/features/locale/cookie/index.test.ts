import { describe, expect, it } from "bun:test";

import { SUPPORTED_LOCALES } from "@/i18n/locales";

import { writeLocaleCookie } from ".";

describe("writeLocaleCookie", () => {
	it("writes the locale cookie for every shipped locale, out of reach of a script, sent everywhere", () => {
		for (const locale of SUPPORTED_LOCALES) {
			const writes: unknown[][] = [];
			writeLocaleCookie({ set: (...args) => writes.push(args) }, locale);

			expect(writes).toEqual([
				[
					"locale",
					locale,
					{
						httpOnly: true,
						secure: true,
						sameSite: "lax",
						path: "/",
						maxAge: 31_536_000,
					},
				],
			]);
		}
	});
});
