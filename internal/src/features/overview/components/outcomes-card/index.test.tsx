import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";

import {
	deliveryEntries,
	deliveryEntry,
	stubOverviewApi,
} from "@/features/overview/test-support/api";
import { sentRequests, stubFetchReject } from "@/lib/api/test-support/fetch";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { adminRoutes } from "@/lib/routes";
import { useFakeClock, useRealClock } from "@/test/fake-clock";

import { OutcomesCard } from ".";

const originalFetch = globalThis.fetch;
const LOG = adminRoutes(TEST_ADMIN_ID).deliveries;
/** The fake clock's start in seconds. */
const NOW = 1_800_000_000;

const show = async (period: "24h" | "7d" | "30d" = "24h") =>
	render(await OutcomesCard({ period, logPath: LOG }));
const row = (container: HTMLElement, outcome: string) => {
	const found = container.querySelector(`tr[data-outcome="${outcome}"]`);
	if (!(found instanceof HTMLElement)) {
		throw new Error(`no row for ${outcome}`);
	}
	return found;
};

beforeEach(() => {
	useFakeClock();
});
afterEach(() => {
	cleanup();
	useRealClock();
	globalThis.fetch = originalFetch;
});

describe("OutcomesCard", () => {
	it("leads with how many records the period has", async () => {
		stubOverviewApi({
			deliveries: deliveryEntries(NOW - 60, { delivered: 6, failed: 2 }),
		});

		const { container } = await show();

		expect(
			container.querySelector('[data-slot="chart-figure"]')?.textContent,
		).toBe("8deliveries.records");
		expect(screen.getByText("inPeriod.24h")).toBeVisible();
	});

	it("lists every outcome with its count and its share, also the ones nothing had", async () => {
		stubOverviewApi({
			deliveries: deliveryEntries(NOW - 60, {
				delivered: 5,
				deferred: 1,
				failed: 2,
			}),
		});

		const { container } = await show();
		const cells = (outcome: string) =>
			Array.from(row(container, outcome).querySelectorAll("td")).map(
				(cell) => cell.textContent,
			);

		// The stand-in formatter prints the number it was given: a share of
		// 62.5 % is asked for as 0.625.
		expect(cells("delivered")).toEqual(["5", "0.625"]);
		expect(cells("deferred")).toEqual(["1", "0.125"]);
		expect(cells("failed")).toEqual(["2", "0.25"]);
		expect(cells("suppressed")).toEqual(["0", "0"]);
		expect(cells("canceled")).toEqual(["0", "0"]);
	});

	it("draws one part of the bar per outcome that has records, as wide as its share", async () => {
		stubOverviewApi({
			deliveries: deliveryEntries(NOW - 60, {
				delivered: 5,
				deferred: 1,
				failed: 2,
			}),
		});

		const { container } = await show();
		const parts = Array.from(
			container.querySelectorAll('[data-slot="segmented-bar"] svg'),
		).map((mark) => [
			mark.getAttribute("data-part"),
			mark.getAttribute("width"),
			mark.getAttribute("class")?.match(/bg-chart-\d/)?.[0],
		]);

		expect(parts).toEqual([
			["delivered", "62.5%", "bg-chart-1"],
			["deferred", "12.5%", "bg-chart-2"],
			["failed", "25%", "bg-chart-3"],
		]);
	});

	it("keys each row with the colour of its part of the bar", async () => {
		stubOverviewApi({
			deliveries: deliveryEntries(NOW - 60, { delivered: 1 }),
		});

		const { container } = await show();
		const key = (outcome: string) =>
			row(container, outcome).querySelector(
				'[data-slot="chart-swatch"] span',
			);

		expect(key("delivered")).toHaveClass("bg-chart-1");
		expect(key("deferred")).toHaveClass("bg-chart-2");
		expect(key("failed")).toHaveClass("bg-chart-3");
		expect(key("suppressed")).toHaveClass("bg-chart-4");
		expect(key("canceled")).toHaveClass("bg-chart-5");
	});

	it("links each outcome to the delivery log filtered by it and by the period", async () => {
		stubOverviewApi({
			deliveries: deliveryEntries(NOW - 60, { delivered: 1 }),
		});

		const { container } = await show("7d");

		expect(
			within(row(container, "failed")).getByRole("link", {
				name: "outcomes.failed",
			}),
		).toHaveAttribute(
			"href",
			`/app/${TEST_ADMIN_ID}/deliveries?outcome=failed&since=7d`,
		);
		expect(
			screen.getByRole("link", { name: "deliveries.open" }),
		).toHaveAttribute("href", `/app/${TEST_ADMIN_ID}/deliveries?since=7d`);
	});

	it("keeps the link of a row beside its colour on a touch screen, in a row of 44 px", async () => {
		stubOverviewApi({
			deliveries: deliveryEntries(NOW - 60, { delivered: 1 }),
		});

		const { container } = await show();
		const link = within(row(container, "failed")).getByRole("link");

		// The button's own padding for a coarse pointer would put 16 px
		// between the colour and its name and widen the table past a phone.
		expect(link).toHaveClass("px-0", "pointer-coarse:px-0");
		expect(link).not.toHaveClass("pointer-coarse:px-4");
		// A short name in a link 44 px wide starts at the link's edge, not in
		// its middle: every name is the same 10 px from its colour.
		expect(link).toHaveClass("justify-start");
		expect(link).not.toHaveClass("justify-center");
		// The link is 44 px high there; the cells add nothing to it.
		expect(link).toHaveClass("pointer-coarse:min-h-11");
		for (const cell of row(container, "failed").children) {
			expect(cell).toHaveClass("pointer-coarse:py-0");
			expect(cell).not.toHaveClass("pointer-coarse:py-3");
		}
	});

	it("is a figure whose drawing is one image, named by the title and described", async () => {
		stubOverviewApi({
			deliveries: deliveryEntries(NOW - 60, { delivered: 1 }),
		});

		await show();

		expect(
			screen.getByRole("figure", { name: "outcomes.title" }),
		).toBeInTheDocument();
		const image = screen.getByRole("img", { name: "outcomes.title" });
		expect(image).toHaveAccessibleDescription("outcomes.description");
		// The links are outside the image: what is inside is hidden from a
		// screen reader.
		expect(image.querySelector("a")).toBeNull();
	});

	it("says the figures are of 100 records only when the answer came back full", async () => {
		stubOverviewApi({
			deliveries: Array.from({ length: 100 }, (_, index) =>
				deliveryEntry(NOW - 60 - index, "delivered", index),
			),
		});

		await show();

		expect(screen.getByText("deliveries.full")).toBeVisible();
	});

	it("says no such thing one record short of 100", async () => {
		stubOverviewApi({
			deliveries: Array.from({ length: 99 }, (_, index) =>
				deliveryEntry(NOW - 60 - index, "delivered", index),
			),
		});

		await show();

		expect(screen.queryByText("deliveries.full")).toBeNull();
	});

	it("explains a log that is switched off in place of a chart", async () => {
		stubOverviewApi({ deliveries: 404 });

		const { container } = await show();

		expect(screen.getByText("deliveries.disabledTitle")).toBeVisible();
		expect(screen.getByText("deliveries.disabled")).toBeVisible();
		expect(screen.queryByRole("img")).toBeNull();
		expect(container.querySelector("table")).toBeNull();
	});

	it("says a period has no delivery in place of an empty chart", async () => {
		stubOverviewApi({ deliveries: [] });

		await show();

		expect(screen.getByText("deliveries.emptyTitle")).toBeVisible();
		expect(screen.queryByRole("img")).toBeNull();
	});

	it("says it was not loaded, with no warning of its own and still its title, when the API fails", async () => {
		const log = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		await show();

		expect(screen.queryByRole("alert")).toBeNull();
		expect(screen.getByText("unavailableTitle")).toBeVisible();
		expect(screen.getByText("unavailable")).toBeVisible();
		expect(
			screen.getByRole("heading", { name: "outcomes.title" }),
		).toBeVisible();
		log.mockRestore();
	});

	it("reads the API once and puts no style attribute in the page", async () => {
		stubOverviewApi({
			deliveries: deliveryEntries(NOW - 60, {
				delivered: 2,
				canceled: 1,
			}),
		});

		const { container } = await show();

		expect(sentRequests()).toHaveLength(1);
		expect(container.querySelector("[style]")).toBeNull();
	});

	it("is as high with nothing to draw as with a chart: each message stands in the place of the figure, the bar and the table", async () => {
		for (const deliveries of [[], 404, 500]) {
			const log = spyOn(console, "error").mockImplementation(() => {});
			stubOverviewApi({ deliveries });

			const { container, unmount } = await show();
			const place = container.querySelector(
				'[data-slot="chart-state"] > .invisible',
			);

			// The thin bar and the six rows of the table, flush with the bottom.
			expect(place?.querySelector(".h-3.rounded-full")).not.toBeNull();
			expect(place?.querySelector(".-mb-4")?.children).toHaveLength(6);
			expect(place).toHaveAttribute("aria-hidden", "true");
			unmount();
			log.mockRestore();
		}
	});
});
