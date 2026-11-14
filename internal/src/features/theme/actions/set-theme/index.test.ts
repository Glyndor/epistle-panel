import { beforeEach, describe, expect, it } from "bun:test";

import { HOSTILE_THEME_VALUES } from "@/features/theme/test-support/hostile-choices";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { setTheme } = await import(".");

beforeEach(() => {
	cookies.reset();
});

describe("setTheme", () => {
	it("stores each choice for a signed-in account, with the cookie's attributes", async () => {
		for (const role of ["admin", "user"] as const) {
			cookies.reset();
			await cookies.signIn("ana", role);

			for (const choice of ["system", "light", "dark"]) {
				cookies.writes.length = 0;

				expect(await setTheme(choice)).toBe(true);

				expect(cookies.writes).toHaveLength(1);
				const [write] = cookies.writes;
				expect(write?.name).toBe("theme");
				expect(write?.value).toBe(choice);
				expect(write?.options).toEqual({
					httpOnly: false,
					secure: true,
					sameSite: "lax",
					path: "/",
					maxAge: 31_536_000,
				});
			}
		}
	});

	it("writes nothing without a session", async () => {
		expect(await setTheme("dark")).toBe(false);
		expect(cookies.writes).toHaveLength(0);
	});

	it("writes nothing with a session cookie that is not a session", async () => {
		const token = await cookies.signIn();
		cookies.jar.set("__Host-epistle_session", `${token}x`);

		expect(await setTheme("dark")).toBe(false);
		expect(cookies.writes).toHaveLength(0);
	});

	it("writes nothing for a value outside the choices", async () => {
		await cookies.signIn();

		for (const value of HOSTILE_THEME_VALUES) {
			expect(await setTheme(value)).toBe(false);
		}
		for (const value of [undefined, null, 1, ["dark"], { a: "dark" }]) {
			expect(await setTheme(value as unknown as string)).toBe(false);
		}
		expect(cookies.writes).toHaveLength(0);
	});
});
