import { afterEach, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
	deliveryEntry,
	stubOverviewApi,
} from "@/features/overview/test-support/api";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { adminRoutes } from "@/lib/routes";
import { useFakeClock, useRealClock } from "@/test/fake-clock";
import { saidWith } from "@/test/next-intl";
import { TimelineCard } from ".";

const fetchBefore = globalThis.fetch;
afterEach(() => {
	cleanup();
	useRealClock();
	globalThis.fetch = fetchBefore;
});
// The translated column heading contains {zone}, and the card has to pass it.
it("names the person's zone for hour columns and UTC for day columns in the table headings", async () => {
	useFakeClock();
	for (const period of ["24h", "7d"] as const) {
		stubOverviewApi({
			deliveries: [deliveryEntry(1_800_000_000 - 60, "delivered")],
		});
		render(
			await TimelineCard({
				period,
				logPath: adminRoutes(TEST_ADMIN_ID).deliveries,
				timeZone: "Pacific/Kiritimati",
			}),
		);
		fireEvent.click(screen.getByRole("button", { name: "viewData" }));
		cleanup();
	}
	expect([
		saidWith("timeline.column.hour").at(-1),
		saidWith("timeline.column.day").at(-1),
	]).toEqual([
		// Hours are the person's; a column of a day is a day of Greenwich.
		{ zone: "Pacific/Kiritimati" },
		{ zone: "UTC" },
	]);
});
