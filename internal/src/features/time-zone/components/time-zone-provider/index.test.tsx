import { afterEach, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { TimeZoneProvider, useTimeZone } from ".";

afterEach(cleanup);
function Clock() {
	return <output aria-label="zone">{useTimeZone()}</output>;
}
it("defaults to UTC and follows provider updates and nested scopes", () => {
	const view = render(<Clock />);
	expect(screen.getByLabelText("zone")).toHaveTextContent("UTC");
	view.rerender(
		<TimeZoneProvider timeZone="America/Bogota">
			<Clock />
		</TimeZoneProvider>,
	);
	expect(screen.getByLabelText("zone")).toHaveTextContent("America/Bogota");
	view.rerender(
		<TimeZoneProvider timeZone="America/Bogota">
			<TimeZoneProvider timeZone="Pacific/Kiritimati">
				<Clock />
			</TimeZoneProvider>
		</TimeZoneProvider>,
	);
	expect(screen.getByLabelText("zone")).toHaveTextContent(
		"Pacific/Kiritimati",
	);
});
it("falls back when the browser does not know a server zone", () => {
	render(
		<TimeZoneProvider timeZone="Mars/Base">
			<Clock />
		</TimeZoneProvider>,
	);
	expect(screen.getByLabelText("zone")).toHaveTextContent("UTC");
});
