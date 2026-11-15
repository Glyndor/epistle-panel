import { afterEach, beforeEach, expect, it } from "bun:test";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { readRemoteImagesPreference } = await import(".");
beforeEach(() => cookies.reset());
afterEach(() => cookies.reset());
it("reads each exact cookie mode", async () => {
	for (const mode of ["ask", "always", "never"] as const) {
		cookies.jar.set("remote-images", mode);
		expect(await readRemoteImagesPreference()).toBe(mode);
	}
});
it("falls back to ask for missing, invalid and hostile cookies", async () => {
	expect(await readRemoteImagesPreference()).toBe("ask");
	for (const value of [
		"",
		"ASK",
		" always ",
		"__proto__",
		"<script>private-marker</script>",
		"x".repeat(5000),
	]) {
		cookies.jar.set("remote-images", value);
		expect(await readRemoteImagesPreference()).toBe("ask");
	}
});
