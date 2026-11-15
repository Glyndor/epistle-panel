import { afterEach, beforeEach, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { resolveServerTree } from "@/test/server-tree";

const cookies = mockRequestCookies();
const PACE = "EPISTLE_PANEL_REFRESH";
const IDLE = "EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES";
const saved = { pace: process.env[PACE], idle: process.env[IDLE] };
const { default: MePage } = await import("./page");
beforeEach(async () => {
	cookies.reset();
	delete process.env[PACE];
	delete process.env[IDLE];
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	cookies.reset();
	for (const [key, value] of [
		[PACE, saved.pace],
		[IDLE, saved.idle],
	] as const) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

const help = () => {
	const field = screen.getByRole("combobox", { name: "refresh" });
	return (
		document.getElementById(field.getAttribute("aria-describedby") ?? "")
			?.textContent ?? ""
	);
};

it("keeps showing slow, and says it runs as normal, for an idle timeout of 1 or 2 minutes", async () => {
	cookies.jar.set("refresh", "slow");
	for (const idle of ["1", "2"]) {
		process.env[IDLE] = idle;
		await cookies.signIn();
		render(await resolveServerTree(await MePage()));
		expect(screen.getByRole("combobox", { name: "refresh" })).toHaveValue(
			"slow",
		);
		expect(help()).toContain("refreshDegraded");
		cleanup();
	}
});
it("says nothing of it with no idle timeout, with 3 minutes, or for normal and fast", async () => {
	for (const [idle, pace] of [
		[undefined, "slow"],
		["3", "slow"],
		["1", "normal"],
		["1", "fast"],
	] as const) {
		if (idle === undefined) delete process.env[IDLE];
		else process.env[IDLE] = idle;
		await cookies.signIn();
		cookies.jar.set("refresh", pace);
		render(await resolveServerTree(await MePage()));
		expect([idle, pace, help().includes("refreshDegraded")]).toEqual([
			idle,
			pace,
			false,
		]);
		cleanup();
	}
});
it("says the same of the operator's slow in its read-only text, and only when it is degraded", async () => {
	process.env[PACE] = "slow";
	process.env[IDLE] = "1";
	await cookies.signIn();
	render(await resolveServerTree(await MePage()));
	const group = screen.getByRole("group", { name: "refresh" });
	expect(group).toHaveTextContent("refreshSetByOperator refreshDegraded");
	cleanup();
	process.env[IDLE] = "3";
	await cookies.signIn();
	render(await resolveServerTree(await MePage()));
	expect(
		screen.getByRole("group", { name: "refresh" }),
	).not.toHaveTextContent("refreshDegraded");
	cleanup();
	process.env[PACE] = "fast";
	process.env[IDLE] = "1";
	await cookies.signIn();
	render(await resolveServerTree(await MePage()));
	expect(
		screen.getByRole("group", { name: "refresh" }),
	).not.toHaveTextContent("refreshDegraded");
});
