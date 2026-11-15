import { afterEach, beforeEach, expect, it } from "bun:test";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const KEY = "EPISTLE_PANEL_PAGE_SIZE";
const saved = process.env[KEY];
const { readEffectivePageSize } = await import(".");
beforeEach(() => cookies.reset());
afterEach(() => {
	cookies.reset();
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});
it("uses operator then cookie then 50 across the precedence table", async () => {
	for (const operator of [undefined, "25", "50", "100"])
		for (const cookie of [undefined, "25", "50", "100", "hostile"]) {
			if (operator === undefined) delete process.env[KEY];
			else process.env[KEY] = operator;
			cookies.jar.delete("page-size");
			if (cookie !== undefined) cookies.jar.set("page-size", cookie);
			expect([operator, cookie, await readEffectivePageSize()]).toEqual([
				operator,
				cookie,
				operator ?? (cookie && cookie !== "hostile" ? cookie : "50"),
			]);
		}
});
