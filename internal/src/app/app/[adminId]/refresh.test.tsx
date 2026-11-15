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
it("gives the operator's pace over the person's", async () => {
	cookies.jar.set("refresh", "fast");
	process.env["EPISTLE_PANEL_REFRESH"] = "slow";
	expect(await paceOf()).toBe("slow");
});
