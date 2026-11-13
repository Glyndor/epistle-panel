import { describe, expect, it } from "bun:test";

import {
	followRedirect,
	mockRequestCookies,
} from "@/lib/auth/test-support/cookies";

mockRequestCookies();

const { default: RootPage } = await import("./page");

describe("RootPage", () => {
	it("redirects to the signed-in home, with no session check of its own", async () => {
		const signal = await followRedirect((async () => RootPage())());

		expect(signal.target).toBe("/app");
	});
});
