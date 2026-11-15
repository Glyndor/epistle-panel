import { afterEach, beforeEach, expect, it } from "bun:test";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const KEY = "EPISTLE_PANEL_REFRESH";
const saved = process.env[KEY];
const { readEffectiveRefreshPace } = await import(".");
beforeEach(() => cookies.reset());
afterEach(() => {
	cookies.reset();
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});
it("uses operator then cookie then normal across the precedence table", async () => {
	for (const operator of [undefined, "normal", "slow", "fast"])
		for (const cookie of [undefined, "normal", "slow", "fast", "hostile"]) {
			if (operator === undefined) delete process.env[KEY];
			else process.env[KEY] = operator;
			cookies.jar.delete("refresh");
			if (cookie !== undefined) cookies.jar.set("refresh", cookie);
			expect([
				operator,
				cookie,
				await readEffectiveRefreshPace(),
			]).toEqual([
				operator,
				cookie,
				operator ??
					(cookie && cookie !== "hostile" ? cookie : "normal"),
			]);
		}
});
