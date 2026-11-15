import { afterEach, beforeEach, expect, it } from "bun:test";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { readRefreshPacePreference } = await import(".");
beforeEach(() => cookies.reset());
afterEach(() => cookies.reset());
it("reads each exact cookie pace", async () => {
	for (const pace of ["normal", "slow", "fast"] as const) {
		cookies.jar.set("refresh", pace);
		expect(await readRefreshPacePreference()).toBe(pace);
	}
});
it("falls back to normal for missing, invalid and hostile cookies, off included", async () => {
	expect(await readRefreshPacePreference()).toBe("normal");
	for (const value of [
		"",
		"off",
		"FAST",
		" slow ",
		"__proto__",
		"<script>private-marker</script>",
		"x".repeat(5000),
	]) {
		cookies.jar.set("refresh", value);
		expect(await readRefreshPacePreference()).toBe("normal");
	}
});
