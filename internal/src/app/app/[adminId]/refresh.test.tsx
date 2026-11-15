import { afterEach, beforeEach, expect, it } from "bun:test";

import { RefreshProvider } from "@/features/refresh/components/refresh-provider";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";

const cookies = mockRequestCookies();
const saved = process.env["EPISTLE_PANEL_REFRESH"];
const { default: AdminLayout } = await import("./layout");

beforeEach(async () => {
	cookies.reset();
	delete process.env["EPISTLE_PANEL_REFRESH"];
	await cookies.signIn("ops");
});
afterEach(() => {
	if (saved === undefined) delete process.env["EPISTLE_PANEL_REFRESH"];
	else process.env["EPISTLE_PANEL_REFRESH"] = saved;
});

/** The pace the layout gives the lists of the whole frame, sidebar included. */
async function paceOf() {
	const routes = (await AdminLayout({
		children: <p>page</p>,
		trail: <nav>here</nav>,
		params: Promise.resolve({ adminId: TEST_ADMIN_ID }),
	})) as React.ReactElement<{
		children: React.ReactElement<{
			children: React.ReactElement<{ pace: string }>;
		}>;
	}>;
	const provider = routes.props.children.props.children;
	expect(provider.type).toBe(RefreshProvider);
	return provider.props.pace;
}

it("wraps the whole frame in the pace the person chose, normal when nobody did", async () => {
	expect(await paceOf()).toBe("normal");
	cookies.jar.set("refresh", "fast");
	expect(await paceOf()).toBe("fast");
	cookies.jar.set("refresh", "off");
	expect(await paceOf()).toBe("normal");
});
it("runs slow as normal under an idle timeout of 1 or 2 minutes, and as itself otherwise", async () => {
	const IDLE = "EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES";
	const before = process.env[IDLE];
	try {
		cookies.jar.set("refresh", "slow");
		for (const [idle, pace] of [
			["1", "normal"],
			["2", "normal"],
			["3", "slow"],
		] as const) {
			process.env[IDLE] = idle;
			await cookies.signIn("ops");
			expect([idle, await paceOf()]).toEqual([idle, pace]);
		}
		process.env[IDLE] = "1";
		await cookies.signIn("ops");
		cookies.jar.set("refresh", "fast");
		expect(await paceOf()).toBe("fast");
		process.env["EPISTLE_PANEL_REFRESH"] = "slow";
		expect(await paceOf()).toBe("normal");
	} finally {
		if (before === undefined) delete process.env[IDLE];
		else process.env[IDLE] = before;
	}
});
it("gives the operator's pace over the person's", async () => {
	cookies.jar.set("refresh", "fast");
	process.env["EPISTLE_PANEL_REFRESH"] = "slow";
	expect(await paceOf()).toBe("slow");
});
