import { describe, expect, it } from "bun:test";

import { LIST_DENSITIES } from "@/features/mail/config/list-density";

import { writeListDensityCookie } from ".";

describe("writeListDensityCookie", () => {
	it("writes the density cookie for every density, under /app and out of reach of a script", () => {
		for (const density of LIST_DENSITIES) {
			const writes: unknown[][] = [];
			writeListDensityCookie(
				{ set: (...args) => writes.push(args) },
				density,
			);

			expect(writes).toEqual([
				[
					"list-density",
					density,
					{
						httpOnly: true,
						secure: true,
						sameSite: "lax",
						path: "/app",
						maxAge: 31_536_000,
					},
				],
			]);
		}
	});
});
