import { afterEach, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clientSaid } from "@/test/next-intl";

const cookies = mockRequestCookies();
const saved = process.env["EPISTLE_PANEL_TIME_ZONE"];
const { default: MePage } = await import("./page");
afterEach(() => {
	cleanup();
	cookies.reset();
	if (saved === undefined) delete process.env["EPISTLE_PANEL_TIME_ZONE"];
	else process.env["EPISTLE_PANEL_TIME_ZONE"] = saved;
});
it("renders the cookie zone on the first paint and the operator statement when fixed", async () => {
	cookies.reset();
	await cookies.signIn("ana", "user");
	delete process.env["EPISTLE_PANEL_TIME_ZONE"];
	cookies.jar.set("time-zone", "Pacific/Kiritimati");
	render(await MePage());
	expect(screen.getByRole("combobox", { name: "timeZone" })).toHaveValue(
		"Pacific/Kiritimati",
	);
	cleanup();
	process.env["EPISTLE_PANEL_TIME_ZONE"] = "America/Bogota";
	render(await MePage());
	expect(screen.queryByRole("combobox", { name: "timeZone" })).toBeNull();
	expect(screen.getByRole("group", { name: "timeZone" })).toHaveTextContent(
		"timeZoneSetByOperator",
	);
	expect(clientSaid).toContainEqual({
		key: "timeZoneSetByOperator",
		values: { zone: "America/Bogota" },
	});
});
