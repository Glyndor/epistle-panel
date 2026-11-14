import { describe, expect, it } from "bun:test";

import { resetIntl, saidWith } from "@/test/next-intl";

import { skeletonWords } from ".";

describe("skeletonWords", () => {
	it("gives each card its own title and the words of its own link", async () => {
		const words = await skeletonWords("24h");

		// The stand-in prints a message as its key.
		expect(words.outcomes).toEqual({
			title: "outcomes.title",
			action: "deliveries.open",
		});
		expect(words.timeline).toEqual({
			title: "timeline.title",
			action: "deliveries.open",
		});
		expect(words.queue).toEqual({
			title: "queue.title",
			action: "queue.open",
		});
		expect(words.suppression).toEqual({
			title: "suppression.title",
			action: "suppression.open",
		});
		expect(words.viewData).toBe("viewData");
	});

	it("lists the outcomes of the legend in the order the chart stacks them, each with its series", async () => {
		const { legend } = await skeletonWords("7d");

		expect(legend).toEqual([
			{ key: "delivered", label: "outcomes.delivered", series: 0 },
			{ key: "deferred", label: "outcomes.deferred", series: 1 },
			{ key: "failed", label: "outcomes.failed", series: 2 },
			{ key: "suppressed", label: "outcomes.suppressed", series: 3 },
			{ key: "canceled", label: "outcomes.canceled", series: 4 },
		]);
	});

	it("writes the line under the timeline's title for the unit of the period, with a time of four zeros", async () => {
		resetIntl();

		expect((await skeletonWords("24h")).timelineNote).toBe(
			"timeline.note.hour",
		);
		expect((await skeletonWords("7d")).timelineNote).toBe(
			"timeline.note.day",
		);
		expect((await skeletonWords("30d")).timelineNote).toBe(
			"timeline.note.day",
		);
		// As wide as a real time of the clock, whatever it turns out to be.
		expect(saidWith("timeline.note.hour")).toEqual([{ time: "00:00" }]);
	});
});
