import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import type { OverviewPeriod } from "@/features/overview/schemas/overview-input";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { adminRoutes } from "@/lib/routes";

import { PeriodNav } from ".";

const HOME = adminRoutes(TEST_ADMIN_ID).home;
const NAMES = { "24h": "24 hours", "7d": "7 days", "30d": "30 days" };

const show = (period: OverviewPeriod) =>
	render(
		<PeriodNav period={period} home={HOME} label="Period" names={NAMES} />,
	);

afterEach(cleanup);

describe("PeriodNav", () => {
	it("is a named navigation with a link per period", () => {
		show("24h");

		expect(
			screen.getByRole("navigation", { name: "Period" }),
		).toBeInTheDocument();
		expect(
			screen.getAllByRole("link").map((link) => link.textContent),
		).toEqual(["24 hours", "7 days", "30 days"]);
	});

	it("puts the period in the address, and nothing for the default one", () => {
		show("24h");

		expect(screen.getByRole("link", { name: "24 hours" })).toHaveAttribute(
			"href",
			`/app/${TEST_ADMIN_ID}`,
		);
		expect(screen.getByRole("link", { name: "7 days" })).toHaveAttribute(
			"href",
			`/app/${TEST_ADMIN_ID}?since=7d`,
		);
		expect(screen.getByRole("link", { name: "30 days" })).toHaveAttribute(
			"href",
			`/app/${TEST_ADMIN_ID}?since=30d`,
		);
	});

	it("marks the current period for a screen reader, as a pill of the secondary surface in bold", () => {
		show("7d");
		const current = screen.getByRole("link", { name: "7 days" });
		const other = screen.getByRole("link", { name: "24 hours" });

		expect(current).toHaveAttribute("aria-current", "page");
		expect(current).toHaveClass("bg-secondary", "font-semibold");
		expect(other).not.toHaveAttribute("aria-current");
		expect(other).not.toHaveClass("bg-secondary");
		expect(other).not.toHaveClass("font-semibold");
	});

	it("draws no line under any period, the current one included", () => {
		const { container } = show("7d");

		expect(container.innerHTML).not.toMatch(
			/underline|decoration-|border|divide-|h-px/,
		);
	});

	it("keeps the focus ring off the pill, on the page's own surface, whatever the period", () => {
		show("7d");

		for (const link of screen.getAllByRole("link")) {
			// The primary fill left the ring at 2.27:1 in the dark theme.
			expect(link).not.toHaveClass("bg-primary");
			expect(link).toHaveClass(
				"focus-visible:outline-2",
				"focus-visible:outline-offset-2",
			);
		}
	});

	it("has links a finger can press and no style attribute", () => {
		const { container } = show("30d");

		for (const link of screen.getAllByRole("link")) {
			expect(link).toHaveClass("min-h-8", "pointer-coarse:min-h-11");
		}
		expect(container.querySelector("[style]")).toBeNull();
	});
});
