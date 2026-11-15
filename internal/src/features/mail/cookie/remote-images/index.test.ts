import { expect, it } from "bun:test";
import { writeRemoteImagesCookie } from ".";

it("writes every mode as a private secure app cookie for a year", () => {
	for (const mode of ["ask", "always", "never"] as const) {
		const writes: unknown[][] = [];
		writeRemoteImagesCookie({ set: (...args) => writes.push(args) }, mode);
		expect(writes).toEqual([
			[
				"remote-images",
				mode,
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
