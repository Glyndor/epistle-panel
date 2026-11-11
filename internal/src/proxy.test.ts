import { describe, expect, it } from "bun:test";

import { config } from "./proxy";

// Next compiles the matcher itself; the pattern is plain enough to anchor and
// run as a regular expression here to see which paths the gate covers.
const gate = new RegExp(`^${config.matcher[0]}$`);

describe("proxy matcher", () => {
	it("leaves the login route and static assets open", () => {
		for (const path of [
			"/login",
			"/login/",
			"/_next/static/chunk.js",
			"/favicon.ico",
		]) {
			expect(gate.test(path)).toBe(false);
		}
	});

	it("gates every other route, including look-alikes of the login route", () => {
		for (const path of [
			"/",
			"/queue",
			"/loginx",
			"/login-admin",
			"/logins/x",
		]) {
			expect(gate.test(path)).toBe(true);
		}
	});
});
