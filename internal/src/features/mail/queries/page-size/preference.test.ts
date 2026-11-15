import { afterEach, beforeEach, expect, it } from "bun:test";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { readPageSizePreference } = await import(".");
beforeEach(() => cookies.reset());
afterEach(() => cookies.reset());
it("reads each exact cookie size", async () => {
	for (const size of ["25", "50", "100"] as const) {
		cookies.jar.set("page-size", size);
		expect(await readPageSizePreference()).toBe(size);
	}
});
it("falls back to 50 for missing, invalid and hostile cookies", async () => {
	expect(await readPageSizePreference()).toBe("50");
	for (const value of [
		"",
		"0",
		"10",
		" 100 ",
		"1e2",
		"__proto__",
		"<script>private-marker</script>",
		"9".repeat(5000),
	]) {
		cookies.jar.set("page-size", value);
		expect(await readPageSizePreference()).toBe("50");
	}
});
