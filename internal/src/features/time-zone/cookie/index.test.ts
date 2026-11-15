import { expect, it } from "bun:test";
import { writeTimeZoneCookie } from ".";

it("writes the chosen zone as a private secure app cookie for one year", () => {
	const writes: unknown[][] = [];
	for (const zone of [
		"UTC",
		"America/Bogota",
		"Asia/Calcutta",
		"Pacific/Kiritimati",
	]) {
		writeTimeZoneCookie(
			{
				set: (...args) => {
					writes.push(args);
				},
			},
			zone,
		);
		expect(writes.at(-1)).toEqual([
			"time-zone",
			zone,
			{
				httpOnly: true,
				secure: true,
				sameSite: "lax",
				path: "/app",
				maxAge: 31536000,
			},
		]);
	}
});
