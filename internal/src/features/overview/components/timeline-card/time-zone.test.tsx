import { afterEach, expect, it, spyOn } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as intl from "next-intl/server";
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
it("keeps UTC bucket boundaries while ticks, hints, reading clock and table use the supplied zone", async () => {
	useFakeClock();
	const zones: string[] = [];
	const formatter = spyOn(intl, "getFormatter").mockResolvedValue({
		number: String,
		list: (values: Iterable<string>) => [...values].join(", "),
		dateTime: (date: Date, options: Intl.DateTimeFormatOptions) => {
			zones.push(String(options.timeZone));
			return new Intl.DateTimeFormat("en-GB", options).format(date);
		},
	} as unknown as Awaited<ReturnType<typeof intl.getFormatter>>);
	try {
		for (const zone of ["UTC", "Asia/Kolkata", "Pacific/Kiritimati"])
			for (const period of ["24h", "7d"] as const) {
				zones.length = 0;
				stubOverviewApi({
					deliveries: [deliveryEntry(1800000000 - 60, "delivered")],
				});
				const { container } = render(
					await TimelineCard({
						period,
						logPath: adminRoutes(TEST_ADMIN_ID).deliveries,
						timeZone: zone,
					}),
				);
				expect(
					container.querySelectorAll("[data-column]"),
				).toHaveLength(period === "24h" ? 25 : 8);
				const start = Number(
					container
						.querySelector("[data-column]")
						?.getAttribute("data-column"),
				);
				expect(start % (period === "24h" ? 3600 : 86400)).toBe(0);
				fireEvent.click(
					screen.getByRole("button", { name: "viewData" }),
				);
				expect(zones.length).toBeGreaterThan(20);
				expect(new Set(zones)).toEqual(
					new Set(period === "24h" ? [zone] : ["UTC"]),
				);
				expect(
					saidWith(
						`timeline.note.${period === "24h" ? "hour" : "day"}`,
					).at(-1)?.["zone"],
				).toBe(period === "24h" ? zone : "UTC");
				const labels = Array.from(
					container.querySelectorAll('[data-slot="chart-tick"]'),
				).map((x) => x.textContent);
				if (period === "24h" && zone === "Asia/Kolkata")
					expect(labels).toEqual([
						"17:30",
						"23:30",
						"05:30",
						"11:30",
					]);
				// A column of a day is a day of Greenwich: the same labels in every zone.
				if (period === "7d" && zone === "Pacific/Kiritimati")
					expect(labels).toEqual([
						"9 Jan",
						"11 Jan",
						"13 Jan",
						"15 Jan",
					]);
				cleanup();
			}
	} finally {
		formatter.mockRestore();
	}
});
