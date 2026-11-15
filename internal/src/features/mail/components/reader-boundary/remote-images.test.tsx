import { afterEach, beforeEach, expect, it } from "bun:test";
import type { ReactElement } from "react";
import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const KEY = "EPISTLE_PANEL_REMOTE_IMAGES";
const saved = process.env[KEY];
const { ReaderBoundary } = await import(".");
beforeEach(() => {
	cookies.reset();
	delete process.env[KEY];
});
afterEach(() => {
	cookies.reset();
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});
it("hands the effective mode to MessageReader including operator precedence", async () => {
	for (const mode of ["ask", "always", "never"]) {
		cookies.jar.set("__Host-remote-images", mode);
		const tree = await ReaderBoundary({
			id: "m1",
			place: { role: "inbox" },
			page: 1,
			conditions: EMPTY_CONDITIONS,
		});
		expect(
			(tree.props.children as ReactElement<{ remoteImagesMode: string }>)
				.props.remoteImagesMode,
		).toBe(mode);
	}
	process.env[KEY] = "never";
	cookies.jar.set("__Host-remote-images", "always");
	const tree = await ReaderBoundary({
		id: "m1",
		place: { role: "inbox" },
		page: 1,
		conditions: EMPTY_CONDITIONS,
	});
	expect(
		(tree.props.children as ReactElement<{ remoteImagesMode: string }>)
			.props.remoteImagesMode,
	).toBe("never");
});
