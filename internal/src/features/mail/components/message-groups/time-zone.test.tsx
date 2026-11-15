import { afterEach, expect, it, spyOn } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import * as intl from "next-intl";
import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import { summary } from "@/features/mail/test-support/fixtures";
import { TimeZoneProvider } from "@/features/time-zone/components/time-zone-provider";
import { withQuery } from "@/test/query-wrapper";
import { MessageGroups } from ".";

afterEach(cleanup);
it("groups by the provider clock and uses it for headings and row dates", () => {
	const zones: string[] = [];
	const formatter = spyOn(intl, "useFormatter").mockReturnValue({
		dateTime: (date: Date, options: Intl.DateTimeFormatOptions) => {
			zones.push(String(options.timeZone));
			return new Intl.DateTimeFormat("en-GB", options).format(date);
		},
	} as ReturnType<typeof intl.useFormatter>);
	try {
		render(
			withQuery(
				<TimeZoneProvider timeZone="America/New_York">
					<MessageGroups
						items={[
							summary({
								id: "00000000-0000-4000-8000-000000000001",
								receivedAt: "2026-03-09T03:59:59Z",
							}),
							summary({
								id: "00000000-0000-4000-8000-000000000002",
								receivedAt: "2026-03-01T04:59:59Z",
							}),
						]}
						today="2026-03-09"
						selectedId={undefined}
						view={{
							box: "INBOX",
							role: "inbox",
							page: 1,
							conditions: EMPTY_CONDITIONS,
						}}
					/>
				</TimeZoneProvider>,
			),
		);
		expect(
			screen
				.getAllByRole("heading", { level: 3 })
				.map((h) => h.textContent),
		).toEqual(["groupYesterday", "February 2026"]);
		expect(screen.getByText("23:59")).toBeVisible();
		expect(zones.length).toBeGreaterThan(2);
		expect(new Set(zones)).toEqual(new Set(["America/New_York"]));
	} finally {
		formatter.mockRestore();
	}
});
