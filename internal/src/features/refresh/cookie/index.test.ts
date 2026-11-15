import { expect, it } from "bun:test";
import { writeRefreshCookie } from ".";

it("writes every pace as a private secure app cookie for a year", () => {
	for (const pace of ["normal", "slow", "fast"] as const) {
		const writes: unknown[][] = [];
		writeRefreshCookie({ set: (...args) => writes.push(args) }, pace);
		expect(writes).toEqual([
			[
				"refresh",
				pace,
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
