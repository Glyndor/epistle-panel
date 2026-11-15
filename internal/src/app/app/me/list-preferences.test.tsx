import { afterEach, beforeEach, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clientSaid } from "@/test/next-intl";
import { resolveServerTree } from "@/test/server-tree";

const cookies = mockRequestCookies();
const SIZE = "EPISTLE_PANEL_PAGE_SIZE";
const PACE = "EPISTLE_PANEL_REFRESH";
const saved = { size: process.env[SIZE], pace: process.env[PACE] };
const { default: MePage } = await import("./page");
beforeEach(async () => {
	cookies.reset();
	delete process.env[SIZE];
	delete process.env[PACE];
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	cookies.reset();
	for (const [key, value] of [
		[SIZE, saved.size],
		[PACE, saved.pace],
	] as const) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});
it("paints the checked cookies as the size and the pace at first render", async () => {
	cookies.jar.set("page-size", "25");
	cookies.jar.set("refresh", "fast");
	render(await resolveServerTree(await MePage()));
	expect(screen.getByRole("combobox", { name: "pageSize" })).toHaveValue(
		"25",
	);
	expect(screen.getByRole("combobox", { name: "refresh" })).toHaveValue(
		"fast",
	);
});
it("paints the defaults when there is no cookie, 50 and normal", async () => {
	render(await resolveServerTree(await MePage()));
	expect(screen.getByRole("combobox", { name: "pageSize" })).toHaveValue(
		"50",
	);
	expect(screen.getByRole("combobox", { name: "refresh" })).toHaveValue(
		"normal",
	);
});
it("passes what the operator fixed to the form instead of offering the cookie choice", async () => {
	process.env[SIZE] = "100";
	process.env[PACE] = "slow";
	cookies.jar.set("page-size", "25");
	cookies.jar.set("refresh", "fast");
	render(await resolveServerTree(await MePage()));
	expect(screen.queryByRole("combobox", { name: "pageSize" })).toBeNull();
	expect(screen.queryByRole("combobox", { name: "refresh" })).toBeNull();
	expect(screen.getByRole("group", { name: "pageSize" })).toHaveTextContent(
		"pageSizeSetByOperator",
	);
	expect(screen.getByRole("group", { name: "refresh" })).toHaveTextContent(
		"refreshSetByOperator",
	);
	expect(clientSaid).toContainEqual({
		key: "refreshSetByOperator",
		values: { pace: "refresh_slow" },
	});
	expect(clientSaid).toContainEqual({
		key: "pageSizeOption",
		values: { count: 100 },
	});
});
