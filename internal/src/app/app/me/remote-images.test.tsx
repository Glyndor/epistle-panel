import { afterEach, beforeEach, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clientSaid } from "@/test/next-intl";
import { resolveServerTree } from "@/test/server-tree";

const cookies = mockRequestCookies();
const KEY = "EPISTLE_PANEL_REMOTE_IMAGES";
const saved = process.env[KEY];
const { default: MePage } = await import("./page");
beforeEach(async () => {
	cookies.reset();
	delete process.env[KEY];
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	cookies.reset();
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});
it("paints the checked cookie as the fourth choice at first render", async () => {
	cookies.jar.set("remote-images", "never");
	render(await resolveServerTree(await MePage()));
	expect(screen.getByRole("combobox", { name: "remoteImages" })).toHaveValue(
		"never",
	);
});
it("passes the fixed operator policy to the form instead of offering the cookie choice", async () => {
	process.env[KEY] = "always";
	cookies.jar.set("remote-images", "never");
	render(await resolveServerTree(await MePage()));
	expect(screen.queryByRole("combobox", { name: "remoteImages" })).toBeNull();
	expect(
		screen.getByRole("group", { name: "remoteImages" }),
	).toHaveTextContent("remoteImagesSetByOperator");
	expect(clientSaid).toContainEqual({
		key: "remoteImagesSetByOperator",
		values: { mode: "remoteImages_always" },
	});
});
