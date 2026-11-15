import { afterEach, beforeEach, expect, it } from "bun:test";
import { stubJmap } from "@/features/mail/test-support/jmap-stub";
import { RefreshProvider } from "@/features/refresh/components/refresh-provider";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { default: MailLayout } = await import("./layout");

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	delete process.env["EPISTLE_PANEL_REFRESH"];
	await cookies.signIn("ana", "user");
	stubJmap({});
});
afterEach(() => {
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
});

/** The pace the layout gives the lists of the whole frame, sidebar and search included. */
async function paceOf() {
	const layout = (await MailLayout({
		children: <p>page</p>,
		trail: <nav>here</nav>,
		search: <p>search</p>,
	})) as React.ReactElement<{
		children: React.ReactElement<{ pace: string; children: unknown }>;
	}>;
	const provider = layout.props.children;
	expect(provider.type).toBe(RefreshProvider);
	return provider.props.pace;
}

it("wraps the whole frame in the pace the person chose, normal when nobody did", async () => {
	expect(await paceOf()).toBe("normal");
	cookies.jar.set("refresh", "slow");
	expect(await paceOf()).toBe("slow");
	cookies.jar.set("refresh", "off");
	expect(await paceOf()).toBe("normal");
});
it("gives the operator's pace over the person's", async () => {
	cookies.jar.set("refresh", "slow");
	process.env["EPISTLE_PANEL_REFRESH"] = "fast";
	expect(await paceOf()).toBe("fast");
});
