import { describe, expect, it } from "bun:test";

import { THEME_CHOICES } from "@/features/theme/config/choices";

import { writeThemeCookie } from ".";

describe("writeThemeCookie", () => {
	it("writes the theme cookie for every choice, readable by the page that replaces a failed layout", () => {
		for (const choice of THEME_CHOICES) {
			const writes: unknown[][] = [];
			writeThemeCookie({ set: (...args) => writes.push(args) }, choice);

			expect(writes).toEqual([
				[
					"theme",
					choice,
					{
						httpOnly: false,
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
