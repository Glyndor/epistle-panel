import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
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
import { stubFetchReject } from "@/lib/api/test-support/fetch";
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
const DAY = 86_400;

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

describe("TimelineCard", () => {
	it("draws a column per hour of the UTC clock for 24 hours", async () => {
		stubOverviewApi({
			deliveries: [deliveryEntry(NOW - 60, "delivered")],
		});

		const { container } = await show();

		expect(container.querySelectorAll("[data-column]")).toHaveLength(25);
		expect(screen.getByText("timeline.note.hour")).toBeVisible();
	});

	it("stacks the records of an hour by outcome, in the colours of the outcomes card", async () => {
		const hour = NOW - 3 * HOUR;
		stubOverviewApi({
			deliveries: [
				deliveryEntry(hour + 10, "failed", 1),
				deliveryEntry(hour + 20, "delivered", 2),
				deliveryEntry(hour + 30, "delivered", 3),
				deliveryEntry(hour + 40, "canceled", 4),
			],
		});

		const { container } = await show();
		const marks = Array.from(
			column(container, hour)?.querySelectorAll("svg") ?? [],
		).map((mark) => mark.getAttribute("class")?.match(/bg-chart-\d/)?.[0]);

		// From the baseline up: delivered, failed, canceled.
		expect(marks).toEqual(["bg-chart-1", "bg-chart-3", "bg-chart-5"]);
	});

	it("tells the pointer the total of a column and how it splits by outcome, leaving out what it has none of", async () => {
		const hour = NOW - 3 * HOUR;
		stubOverviewApi({
			deliveries: [
				deliveryEntry(hour + 10, "failed", 1),
				deliveryEntry(hour + 20, "delivered", 2),
				deliveryEntry(hour + 30, "delivered", 3),
				deliveryEntry(hour + 40, "canceled", 4),
			],
		});

		const { container } = await show();

		expect(column(container, hour)).toHaveAttribute(
			"title",
			"timeline.hintParts",
		);
		// The stand-in joins a list with commas and prints a message as its key.
		expect(saidWith("timeline.hintParts")).toEqual([
			{
				when: "2027-01-15T05:00:00.000Z",
				count: 4,
				parts: "part, part, part",
			},
		]);
		expect(saidWith("part").slice(-3)).toEqual([
			{ count: 2, name: "outcomes.delivered" },
			{ count: 1, name: "outcomes.failed" },
			{ count: 1, name: "outcomes.canceled" },
		]);
		// An hour with nothing has a total and no split to give.
		expect(column(container, hour + HOUR)).toHaveAttribute(
			"title",
			"timeline.hint",
		);
		expect(saidWith("timeline.hint")).toContainEqual({
			when: "2027-01-15T06:00:00.000Z",
			count: 0,
		});
	});

	it("names every outcome in a legend, in the order it stacks them", async () => {
		stubOverviewApi({ deliveries: [deliveryEntry(NOW - 60, "delivered")] });

		const { container } = await show();
		const legend = container.querySelector('[data-slot="chart-legend"]');

		expect(
			Array.from(legend?.children ?? []).map((item) => item.textContent),
		).toEqual([
			"outcomes.delivered",
			"outcomes.deferred",
			"outcomes.failed",
			"outcomes.suppressed",
			"outcomes.canceled",
		]);
	});

	it("labels every sixth hour of the UTC clock", async () => {
		stubOverviewApi({ deliveries: [deliveryEntry(NOW - 60, "delivered")] });

		const { container } = await show();
		const labels = Array.from(
			container.querySelectorAll('[data-slot="chart-tick"]'),
		).map((label) => label.textContent);

		// The stand-in formatter prints the instant: 12:00, 18:00, 00:00, 06:00.
		expect(labels).toEqual([
			"2027-01-14T12:00:00.000Z",
			"2027-01-14T18:00:00.000Z",
			"2027-01-15T00:00:00.000Z",
			"2027-01-15T06:00:00.000Z",
		]);
	});

	it("draws a column per UTC day for 7 days and labels every second one, today included", async () => {
		stubOverviewApi({
			deliveries: [deliveryEntry(NOW - 2 * DAY, "delivered")],
		});

		const { container } = await show("7d");

		expect(container.querySelectorAll("[data-column]")).toHaveLength(8);
		expect(
			Array.from(
				container.querySelectorAll('[data-slot="chart-tick"]'),
			).map((label) => label.textContent?.slice(0, 10)),
		).toEqual(["2027-01-09", "2027-01-11", "2027-01-13", "2027-01-15"]);
		expect(screen.getByText("timeline.note.day")).toBeVisible();
	});

	it("draws 31 columns for 30 days and labels every tenth day, today included", async () => {
		stubOverviewApi({
			deliveries: [deliveryEntry(NOW - 9 * DAY, "delivered")],
		});

		const { container } = await show("30d");

		expect(container.querySelectorAll("[data-column]")).toHaveLength(31);
		expect(
			Array.from(
				container.querySelectorAll('[data-slot="chart-tick"]'),
			).map((label) => label.textContent?.slice(0, 10)),
		).toEqual(["2026-12-16", "2026-12-26", "2027-01-05", "2027-01-15"]);
	});

	it("lets the keyboard scroll the table: its container takes the focus and has a name", async () => {
		stubOverviewApi({ deliveries: [deliveryEntry(NOW - 60, "delivered")] });

		await show();
		openTable();

		const group = screen.getByRole("group", { name: "timeline.title" });
		expect(group).toHaveAttribute("tabindex", "0");
		expect(group).toContainElement(screen.getByRole("table"));
	});

	it("is one image named by the title and described, with no link inside", async () => {
		stubOverviewApi({ deliveries: [deliveryEntry(NOW - 60, "delivered")] });

		await show();

		const image = screen.getByRole("img", { name: "timeline.title" });
		expect(image).toHaveAccessibleDescription("timeline.description");
		expect(image.querySelector("a, button")).toBeNull();
		expect(
			screen.getByRole("link", { name: "deliveries.open" }),
		).toHaveAttribute("href", `/app/${TEST_ADMIN_ID}/deliveries?since=24h`);
	});

	it("keeps the numbers of every hour in a table behind a button", async () => {
		const hour = NOW - 3 * HOUR;
		stubOverviewApi({
			deliveries: [
				deliveryEntry(hour + 10, "failed", 1),
				deliveryEntry(hour + 20, "delivered", 2),
				deliveryEntry(hour + 30, "delivered", 3),
			],
		});

		const { container } = await show();
		expect(container.querySelector("table")).toBeNull();
		openTable();

		const table = screen.getByRole("table");
		expect(
			within(table)
				.getAllByRole("columnheader")
				.map((header) => header.textContent),
		).toEqual([
			"timeline.column.hour",
			"outcomes.delivered",
			"outcomes.deferred",
			"outcomes.failed",
			"outcomes.suppressed",
			"outcomes.canceled",
			"timeline.total",
		]);
		const rows = within(table).getAllByRole("row");
		// A header row and a row per column.
		expect(rows).toHaveLength(26);
		const cells = Array.from(rows[22]?.querySelectorAll("td") ?? []).map(
			(cell) => cell.textContent,
		);
		expect(cells).toEqual(["2", "0", "1", "0", "0", "3"]);
	});

	it("explains a log that is off, an empty period and a failure in place of a chart", async () => {
		stubOverviewApi({ deliveries: 404 });
		const off = await show();
		expect(screen.getByText("deliveries.disabledTitle")).toBeVisible();
		expect(screen.queryByRole("img")).toBeNull();
		off.unmount();

		stubOverviewApi({ deliveries: [] });
		const empty = await show();
		expect(screen.getByText("deliveries.emptyTitle")).toBeVisible();
		expect(screen.queryByRole("img")).toBeNull();
		empty.unmount();

		const log = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();
		await show();
		// A quiet line, not a warning: the page gives the one warning.
		expect(screen.queryByRole("alert")).toBeNull();
		expect(screen.getByText("unavailableTitle")).toBeVisible();
		expect(screen.getByText("unavailable")).toBeVisible();
		expect(screen.queryByRole("img")).toBeNull();
		log.mockRestore();
	});

	it("puts no style attribute in the page", async () => {
		stubOverviewApi({ deliveries: [deliveryEntry(NOW - 60, "failed")] });

		const { container } = await show();

		expect(container.querySelector("[style]")).toBeNull();
	});

	it("is as high with nothing to draw as with a chart: each message stands in the place of the legend, the plot and the button", async () => {
		for (const deliveries of [[], 404, 500]) {
			const log = spyOn(console, "error").mockImplementation(() => {});
			stubOverviewApi({ deliveries });

			const { container, unmount } = await show();
			const place = container.querySelector(
				'[data-slot="chart-state"] > .invisible',
			);

			// The legend of the five outcomes, as the chart has it, and the plot.
			expect(
				Array.from(
					place?.querySelector('[data-slot="chart-legend"]')
						?.children ?? [],
				).map((item) => item.textContent),
			).toEqual([
				"outcomes.delivered",
				"outcomes.deferred",
				"outcomes.failed",
				"outcomes.suppressed",
				"outcomes.canceled",
			]);
			expect(place?.querySelector(".h-45")).not.toBeNull();
			expect(place).toHaveAttribute("aria-hidden", "true");
			unmount();
			log.mockRestore();
		}
	});
});
