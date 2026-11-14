import { afterEach, describe, expect, it, spyOn } from "bun:test";
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

import { SuppressionCard } from ".";

const originalFetch = globalThis.fetch;
const LIST = adminRoutes(TEST_ADMIN_ID).suppression;

const at = (domain: string, count: number) =>
	Array.from({ length: count }, (_, index) => `u${index}@${domain}`);
const show = async () =>
	render(await SuppressionCard({ suppressionPath: LIST }));
const bar = (container: HTMLElement, key: string) =>
	container.querySelector(`[data-row="${key}"] svg`);

afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

describe("SuppressionCard", () => {
	it("leads with how many addresses are suppressed", async () => {
		stubOverviewApi({
			suppression: [[...at("a.example", 4), ...at("b.example", 2)]],
		});

		const { container } = await show();

		expect(
			container.querySelector('[data-slot="chart-figure"]')?.textContent,
		).toBe("6suppression.addresses");
	});

	it("draws a bar per domain, the one with the most first and across the row", async () => {
		stubOverviewApi({
			suppression: [[...at("b.example", 2), ...at("a.example", 4)]],
		});

		const { container } = await show();
		const rows = Array.from(container.querySelectorAll("[data-row]")).map(
			(row) => row.getAttribute("data-row"),
		);

		expect(rows).toEqual(["a.example", "b.example"]);
		expect(bar(container, "a.example")?.getAttribute("width")).toBe("100%");
		expect(bar(container, "b.example")?.getAttribute("width")).toBe("50%");
	});

	it("keeps five domains and gathers the rest in one quiet row", async () => {
		stubOverviewApi({
			suppression: [
				[
					...at("one.example", 7),
					...at("two.example", 6),
					...at("three.example", 5),
					...at("four.example", 4),
					...at("five.example", 3),
					...at("six.example", 2),
					...at("seven.example", 1),
				],
			],
		});

		const { container } = await show();

		expect(container.querySelectorAll("[data-row]")).toHaveLength(6);
		expect(screen.getByText("suppression.other")).toBeVisible();
		expect(bar(container, "")).toHaveClass("bg-muted-foreground");
		expect(screen.queryByText("six.example")).toBeNull();
	});

	it("renders a domain that looks like markup as text", async () => {
		stubOverviewApi({
			suppression: [["x@<img src=x onerror=alert(1)>.test"]],
		});

		const { container } = await show();

		expect(container.querySelector("img")).toBeNull();
		expect(
			screen.getByText("<img src=x onerror=alert(1)>.test"),
		).toBeVisible();
	});

	it("is one image named by the title and described, with the same numbers in a table behind a button", async () => {
		stubOverviewApi({
			suppression: [[...at("a.example", 3), ...at("b.example", 1)]],
		});

		const { container } = await show();

		expect(
			screen.getByRole("img", { name: "suppression.title" }),
		).toHaveAccessibleDescription("suppression.description");
		expect(container.querySelector("table")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "viewData" }));
		const rows = within(screen.getByRole("table")).getAllByRole("row");
		expect(rows[1]).toHaveTextContent("a.example");
		expect(
			Array.from(rows[1]?.querySelectorAll("td") ?? []).map(
				(cell) => cell.textContent,
			),
		).toEqual(["3", "0.75"]);
	});

	it("links to the suppression page, outside the image", async () => {
		stubOverviewApi({ suppression: [at("a.example", 1)] });

		await show();

		expect(
			screen.getByRole("link", { name: "suppression.open" }),
		).toHaveAttribute("href", `/app/${TEST_ADMIN_ID}/suppression`);
		expect(screen.getByRole("img").querySelector("a")).toBeNull();
	});

	it("says how many addresses it counted when the list is longer than it reads", async () => {
		stubOverviewApi({
			suppression: Array.from({ length: 6 }, (_, n) => [`u${n}@x.test`]),
		});

		const { container } = await show();

		expect(screen.getByText("suppression.capped")).toBeVisible();
		expect(
			container.querySelector('[data-slot="chart-figure"]')?.textContent,
		).toBe("5suppression.read");
		// The sentence a screen reader hears does not count them as the list.
		expect(screen.getByRole("img")).toHaveAccessibleDescription(
			"suppression.descriptionRead",
		);
	});

	it("describes a list it read whole as the list", async () => {
		stubOverviewApi({ suppression: [["a@x.test", "b@y.test"]] });

		await show();

		expect(screen.queryByText("suppression.capped")).toBeNull();
		expect(screen.getByRole("img")).toHaveAccessibleDescription(
			"suppression.description",
		);
	});

	it("says no address is suppressed in place of an empty chart", async () => {
		stubOverviewApi({ suppression: [[]] });

		await show();

		expect(screen.getByText("suppression.emptyTitle")).toBeVisible();
		expect(screen.queryByRole("img")).toBeNull();
		expect(screen.queryByText("suppression.capped")).toBeNull();
	});

	it("says it was not loaded when the API fails, with no warning of its own and no style attribute", async () => {
		const log = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		const { container } = await show();

		expect(screen.queryByRole("alert")).toBeNull();
		expect(screen.getByText("unavailableTitle")).toBeVisible();
		expect(screen.getByText("unavailable")).toBeVisible();
		expect(container.querySelector("[style]")).toBeNull();
		log.mockRestore();
	});

	it("is as high with no address as with a chart of six rows: the message stands in the chart's place", async () => {
		stubOverviewApi({ suppression: [[]] });

		const { container } = await show();
		const place = container.querySelector(
			'[data-slot="chart-state"] > .invisible',
		);

		expect(place?.querySelectorAll(".h-2.rounded-full")).toHaveLength(6);
		expect(place).toHaveAttribute("aria-hidden", "true");
		expect(screen.getByText("suppression.emptyTitle")).toBeVisible();
	});
});
