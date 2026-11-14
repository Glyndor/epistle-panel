import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";

import {
	deliveryEntry,
	stubOverviewApi,
} from "@/features/overview/test-support/api";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { adminRoutes } from "@/lib/routes";
import { useFakeClock, useRealClock } from "@/test/fake-clock";
import { resetIntl, saidWith } from "@/test/next-intl";

import { TimelineCard } from ".";

const originalFetch = globalThis.fetch;
const LOG = adminRoutes(TEST_ADMIN_ID).deliveries;
/** The fake clock's start in seconds: 2027-01-15 08:00:00 UTC. */
const NOW = 1_800_000_000;
const HOUR = 3600;

const show = async (period: "24h" | "7d" | "30d" = "24h") =>
	render(await TimelineCard({ period, logPath: LOG }));
const column = (container: HTMLElement, start: number) =>
	container.querySelector(`[data-column="${start}"]`);
const openTable = () =>
	fireEvent.click(screen.getByRole("button", { name: "viewData" }));

beforeEach(() => {
	useFakeClock();
	resetIntl();
});
afterEach(() => {
	cleanup();
	useRealClock();
	globalThis.fetch = originalFetch;
});

describe("TimelineCard on an answer at the limit of the API", () => {
	it("fills the hours a full answer may not have returned with a band and names it", async () => {
		// A hundred records, all in the first two hours of today: the answer
		// stopped there and never reached the later hours or yesterday.
		const today = NOW - 8 * HOUR;
		stubOverviewApi({
			deliveries: Array.from({ length: 100 }, (_, index) =>
				deliveryEntry(today + index * 60, "delivered", index),
			),
		});

		const { container } = await show();

		expect(column(container, today)).not.toHaveAttribute("data-shaded");
		expect(column(container, today + HOUR)).toHaveAttribute(
			"data-shaded",
			"true",
		);
		expect(column(container, today + 5 * HOUR)).toHaveAttribute(
			"data-shaded",
			"true",
		);
		expect(column(container, today - 3 * HOUR)).toHaveAttribute(
			"data-shaded",
			"true",
		);
		expect(column(container, today + 5 * HOUR)).toHaveAttribute(
			"title",
			"timeline.hintMissing",
		);
		expect(column(container, today)).toHaveAttribute(
			"title",
			"timeline.hintParts",
		);
		// The hour the answer stopped in says it may hold more than it shows.
		expect(column(container, today + HOUR)).toHaveAttribute(
			"title",
			"timeline.hintPartial",
		);
		expect(saidWith("timeline.hintPartial")).toEqual([
			{ when: "2027-01-15T01:00:00.000Z", count: 40, parts: "part" },
		]);
		// The band is over what the hour holds, and fills an hour with nothing.
		expect(
			column(container, today + HOUR)?.querySelectorAll(
				'[data-slot="chart-missing"], svg',
			),
		).toHaveLength(2);
		expect(
			column(container, today + 5 * HOUR)?.querySelector(
				'[data-slot="chart-missing"]',
			),
		).not.toBeNull();
		expect(
			column(container, today)?.querySelector(
				'[data-slot="chart-missing"]',
			),
		).toBeNull();
		expect(
			container.querySelector('[data-slot="chart-legend"]')
				?.lastElementChild?.textContent,
		).toBe("timeline.notReturned");
		expect(screen.getByText("timeline.full")).toBeVisible();
	});

	it("writes not returned, never a zero, in the table for an hour it did not read", async () => {
		const today = NOW - 8 * HOUR;
		stubOverviewApi({
			deliveries: Array.from({ length: 100 }, (_, index) =>
				deliveryEntry(today + index * 60, "delivered", index),
			),
		});

		await show();
		openTable();
		const rows = within(screen.getByRole("table")).getAllByRole("row");
		const text = (index: number) =>
			Array.from(rows[index]?.querySelectorAll("td") ?? []).map(
				(cell) => cell.textContent,
			);

		// Row 17 is the first hour of today, read whole; 18 the hour the answer
		// stopped in; 19 an hour it never reached.
		expect(rows[17]).toHaveAttribute("data-state", "complete");
		expect(text(17)).toEqual(["60", "0", "0", "0", "0", "60"]);
		expect(rows[18]).toHaveAttribute("data-state", "partial");
		expect(rows[18]).toHaveTextContent("timeline.state.partial");
		expect(text(18)).toEqual(["40", "0", "0", "0", "0", "40"]);
		expect(rows[19]).toHaveAttribute("data-state", "missing");
		expect(rows[19]).toHaveTextContent("timeline.state.missing");
		expect(text(19)).toEqual([
			"none",
			"none",
			"none",
			"none",
			"none",
			"none",
		]);
	});

	it("shades nothing and adds no caveat when the answer was whole", async () => {
		stubOverviewApi({ deliveries: [deliveryEntry(NOW - 60, "delivered")] });

		const { container } = await show();

		expect(container.querySelector("[data-shaded]")).toBeNull();
		expect(screen.queryByText("timeline.full")).toBeNull();
		expect(
			container.querySelector('[data-slot="chart-legend"]')?.children,
		).toHaveLength(5);
	});
});
