import { expect, it } from "bun:test";
import { writePageSizeCookie } from ".";

it("writes every size as a private secure app cookie for a year", () => {
	for (const choice of ["25", "50", "100"] as const) {
		const writes: unknown[][] = [];
		writePageSizeCookie({ set: (...args) => writes.push(args) }, choice);
		expect(writes).toEqual([
			[
				"page-size",
				choice,
				{
					httpOnly: true,
					secure: true,
					sameSite: "lax",
					path: "/app",
					maxAge: 31536000,
				},
			],
		]);
	}
});
