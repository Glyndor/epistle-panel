import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";

import { stubOverviewApi } from "@/features/overview/test-support/api";
import { stubFetchReject } from "@/lib/api/test-support/fetch";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { adminRoutes } from "@/lib/routes";
import { useFakeClock, useRealClock } from "@/test/fake-clock";
import { resetIntl, saidWith } from "@/test/next-intl";

import { QueueCard } from ".";

const originalFetch = globalThis.fetch;
const QUEUE = adminRoutes(TEST_ADMIN_ID).queue;

/** Version 7 ids by how long before the fake clock's start they were made. */
const NOW_ID = "01a3185c-5000-7abc-8def-0123456789ab";
const HALF_HOUR = "01a31840-d8c0-7abc-8def-0123456789ab";
const THREE_HOURS = "01a317b7-8480-7abc-9def-0123456789ab";
const THREE_DAYS = "01a308e9-3c00-7abc-bdef-0123456789ab";
const VERSION_4 = "11111111-1111-4111-8111-111111111111";

const message = (id: string, recipients = 1) => ({
	id,
	recipients: Array.from(
		{ length: recipients },
		(_, i) => `r${i}@example.net`,
	),
});
const show = async () => render(await QueueCard({ queuePath: QUEUE }));
const bar = (container: HTMLElement, age: string) =>
	container.querySelector(`[data-row="${age}"] svg`);

beforeEach(() => {
	useFakeClock();
});
afterEach(() => {
	cleanup();
	useRealClock();
	globalThis.fetch = originalFetch;
});

describe("QueueCard", () => {
	it("leads with how many messages wait and for how many recipients", async () => {
		stubOverviewApi({
			queue: [
				[message(THREE_DAYS, 3), message(NOW_ID), message(HALF_HOUR)],
			],
		});

		const { container } = await show();

		expect(
			container.querySelector('[data-slot="chart-figure"]')?.textContent,
		).toBe("3queue.waiting");
		expect(screen.getByText("queue.recipients")).toBeVisible();
	});

	it("draws a bar per waiting time, as long as its count, and none for an empty one", async () => {
		stubOverviewApi({
			queue: [
				[
					message(THREE_DAYS),
					message(THREE_HOURS),
					message(NOW_ID),
					message(HALF_HOUR),
				],
			],
		});

		const { container } = await show();

		expect(bar(container, "under1h")?.getAttribute("width")).toBe("100%");
		expect(bar(container, "under6h")?.getAttribute("width")).toBe("50%");
		expect(container.querySelector('[data-row="under24h"]')).not.toBeNull();
		expect(bar(container, "under24h")).toBeNull();
		expect(bar(container, "over24h")?.getAttribute("width")).toBe("50%");
		expect(container.querySelector('[data-row="unknown"]')).toBeNull();
	});

	it("counts a message whose id carries no time apart, in the quiet grey", async () => {
		stubOverviewApi({ queue: [[message(VERSION_4), message(NOW_ID)]] });

		const { container } = await show();

		expect(screen.getByText("queue.ages.unknown")).toBeVisible();
		expect(bar(container, "unknown")).toHaveClass("bg-muted-foreground");
		expect(bar(container, "under1h")).toHaveClass("bg-chart-1");
	});

	it("is one image named by the title and described, with the same numbers in a table behind a button", async () => {
		stubOverviewApi({
			queue: [
				[message(THREE_HOURS), message(NOW_ID), message(HALF_HOUR)],
			],
		});

		const { container } = await show();

		expect(
			screen.getByRole("img", { name: "queue.title" }),
		).toHaveAccessibleDescription("queue.description");
		expect(container.querySelector("table")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "viewData" }));
		const cells = (age: string) =>
			Array.from(
				within(screen.getByRole("table"))
					.getAllByRole("row")
					.find((row) => row.getAttribute("data-age") === age)
					?.querySelectorAll("td") ?? [],
			).map((cell) => cell.textContent);
		// The stand-in formatter prints the share as the fraction asked for.
		expect(cells("under1h")).toEqual(["2", "0.667"]);
		expect(cells("under6h")).toEqual(["1", "0.333"]);
		expect(cells("over24h")).toEqual(["0", "0"]);
	});

	it("links to the queue page, outside the image", async () => {
		stubOverviewApi({ queue: [[message(NOW_ID)]] });

		await show();

		expect(
			screen.getByRole("link", { name: "queue.open" }),
		).toHaveAttribute("href", `/app/${TEST_ADMIN_ID}/queue`);
		expect(screen.getByRole("img").querySelector("a")).toBeNull();
	});

	it("says what it read is the oldest part when the queue is longer than it reads", async () => {
		stubOverviewApi({
			queue: Array.from({ length: 6 }, () => [message(NOW_ID)]),
		});

		const { container } = await show();

		expect(screen.getByText("queue.capped")).toBeVisible();
		expect(
			container.querySelector('[data-slot="chart-figure"]')?.textContent,
		).toBe("5queue.read");
		// Nothing on the card counts what it read as the whole queue: not the
		// recipients under the title, not the sentence a screen reader hears.
		expect(screen.getByText("queue.recipientsRead")).toBeVisible();
		expect(screen.queryByText("queue.recipients")).toBeNull();
		expect(screen.getByRole("img")).toHaveAccessibleDescription(
			"queue.descriptionRead",
		);
	});

	it("says no such thing for a queue it read whole", async () => {
		stubOverviewApi({ queue: [[message(NOW_ID)]] });

		await show();

		expect(screen.queryByText("queue.capped")).toBeNull();
		expect(screen.getByText("queue.recipients")).toBeVisible();
		expect(screen.queryByText("queue.recipientsRead")).toBeNull();
		expect(screen.getByRole("img")).toHaveAccessibleDescription(
			"queue.description",
		);
	});

	it("says the queue is empty in place of an empty chart", async () => {
		stubOverviewApi({ queue: [[]] });

		await show();

		expect(screen.getByText("queue.emptyTitle")).toBeVisible();
		expect(screen.queryByRole("img")).toBeNull();
		expect(screen.queryByRole("button", { name: "viewData" })).toBeNull();
	});

	it("says it was not loaded when the API fails, with no warning of its own and no style attribute", async () => {
		const log = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		const { container } = await show();

		expect(screen.queryByRole("alert")).toBeNull();
		expect(screen.getByText("unavailableTitle")).toBeVisible();
		expect(screen.getByText("unavailable")).toBeVisible();
		expect(
			screen.getByRole("heading", { name: "queue.title" }),
		).toBeVisible();
		expect(container.querySelector("[style]")).toBeNull();
		log.mockRestore();
	});

	it("is as high with an empty queue as with a chart: the message stands in the chart's place, under a line that counts no recipient", async () => {
		resetIntl();
		stubOverviewApi({ queue: [[]] });

		const { container } = await show();
		const place = container.querySelector(
			'[data-slot="chart-state"] > .invisible',
		);

		// The figure, four rows of a name over a bar and the button.
		expect(place?.querySelectorAll(".h-2.rounded-full")).toHaveLength(4);
		expect(place).toHaveAttribute("aria-hidden", "true");
		expect(screen.getByText("queue.emptyTitle")).toBeVisible();
		// The card with a chart has a line under its title; so has this one.
		expect(screen.getByText("queue.recipients")).toBeVisible();
		expect(saidWith("queue.recipients")).toEqual([{ count: 0 }]);
	});

	it("is as high when it was not loaded", async () => {
		const log = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		const { container } = await show();

		expect(
			container
				.querySelector('[data-slot="chart-state"] > .invisible')
				?.querySelectorAll(".h-2.rounded-full"),
		).toHaveLength(4);
		log.mockRestore();
	});
});
