import { afterEach, beforeEach, expect, it } from "bun:test";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const KEY = "EPISTLE_PANEL_REMOTE_IMAGES";
const saved = process.env[KEY];
const { readEffectiveRemoteImagesMode } = await import(".");
beforeEach(() => cookies.reset());
afterEach(() => {
	cookies.reset();
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});
it("uses operator then cookie then ask across the precedence table", async () => {
	for (const operator of [undefined, "ask", "always", "never"])
		for (const cookie of [undefined, "ask", "always", "never", "hostile"]) {
			if (operator === undefined) delete process.env[KEY];
			else process.env[KEY] = operator;
			cookies.jar.delete("remote-images");
			if (cookie !== undefined) cookies.jar.set("remote-images", cookie);
			expect([
				operator,
				cookie,
				await readEffectiveRemoteImagesMode(),
			]).toEqual([
				operator,
				cookie,
				operator ?? (cookie && cookie !== "hostile" ? cookie : "ask"),
			]);
		}
});
