import { beforeEach, describe, expect, it } from "bun:test";

import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { setLocale } = await import(".");

beforeEach(() => {
	cookies.reset();
});

describe("setLocale", () => {
	it("stores the locale for a signed-in admin, with hardened attributes", async () => {
		await cookies.signIn();

		expect(await setLocale("es")).toBe(true);

		expect(cookies.writes).toHaveLength(1);
		const [write] = cookies.writes;
		expect(write?.name).toBe("locale");
		expect(write?.value).toBe("es");
		expect(write?.options).toMatchObject({
			httpOnly: true,
			secure: true,
			sameSite: "lax",
			path: "/",
		});
	});

	it("writes nothing without a session", async () => {
		expect(await setLocale("es")).toBe(false);
		expect(cookies.writes).toHaveLength(0);
	});

	it("writes nothing for a value outside the shipped locales", async () => {
		await cookies.signIn();

		for (const value of ["", "fr", "ES", "es; Path=/", "../en"]) {
			expect(await setLocale(value)).toBe(false);
		}
		expect(cookies.writes).toHaveLength(0);
	});
});
