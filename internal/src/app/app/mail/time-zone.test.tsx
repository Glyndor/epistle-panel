import { afterEach, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { Children, isValidElement, type ReactNode } from "react";
import { stubJmap } from "@/features/mail/test-support/jmap-stub";
import {
	TimeZoneProvider,
	useTimeZone,
} from "@/features/time-zone/components/time-zone-provider";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const saved = process.env["EPISTLE_PANEL_TIME_ZONE"];
const fetchBefore = globalThis.fetch;
const { default: Layout } = await import("./layout");
afterEach(() => {
	cleanup();
	cookies.reset();
	globalThis.fetch = fetchBefore;
	if (saved === undefined) delete process.env["EPISTLE_PANEL_TIME_ZONE"];
	else process.env["EPISTLE_PANEL_TIME_ZONE"] = saved;
});
function find(node: ReactNode): ReactNode {
	if (!isValidElement<{ children?: ReactNode }>(node)) return null;
	if (node.type === TimeZoneProvider) return node;
	return (
		Children.toArray(node.props.children).map(find).find(Boolean) ?? null
	);
}
function Clock() {
	return <output aria-label="zone">{useTimeZone()}</output>;
}
it("places page children under the effective zone in the layout", async () => {
	cookies.reset();
	await cookies.signIn();
	stubJmap({ "Mailbox/get": { list: [] }, "Quota/get": { list: [] } });
	cookies.jar.set("time-zone", "Pacific/Kiritimati");
	for (const operator of [undefined, "America/Bogota"]) {
		if (operator) process.env["EPISTLE_PANEL_TIME_ZONE"] = operator;
		else delete process.env["EPISTLE_PANEL_TIME_ZONE"];
		const tree = await Layout({
			children: <Clock />,
			trail: <p>trail</p>,
			search: <p>search</p>,
		});
		const provider = find(tree);
		expect(provider).not.toBeNull();
		render(provider);
		expect(screen.getByLabelText("zone")).toHaveTextContent(
			operator ?? "Pacific/Kiritimati",
		);
		cleanup();
	}
});
