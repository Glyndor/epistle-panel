import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { Route } from "next";

import { stubOverviewApi } from "@/features/overview/test-support/api";
import { stubFetchReject } from "@/lib/api/test-support/fetch";

import { OverviewNotice } from ".";

const originalFetch = globalThis.fetch;
const HERE = "/app/admin-1?since=7d" as Route;

const show = async () => {
	const notice = await OverviewNotice({ period: "7d", href: HERE });
	return render(notice ?? <p>nothing</p>);
};
const quietly = async (run: () => Promise<void>) => {
	const log = spyOn(console, "error").mockImplementation(() => {});
	await run();
	log.mockRestore();
};

afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

describe("OverviewNotice", () => {
	it("draws nothing when every read answers", async () => {
		stubOverviewApi();

		await show();

		expect(screen.getByText("nothing")).toBeVisible();
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("warns, once, when the API does not answer at all", async () => {
		await quietly(async () => {
			stubFetchReject();

			await show();

			const alert = screen.getByRole("alert");
			expect(alert).toHaveTextContent("unreachable");
			expect(alert).toHaveClass("bg-warning");
			expect(alert).not.toHaveClass("bg-destructive-soft");
		});
	});

	it("gives the way out: a plain link to the address the reader is on", async () => {
		await quietly(async () => {
			stubFetchReject();

			const { container } = await show();
			const link = within(screen.getByRole("alert")).getByRole("link", {
				name: "retry",
			});

			expect(link).toHaveAttribute("href", HERE);
			// The text of the warning, so it is read against the warning's fill.
			expect(link).toHaveClass("text-warning-foreground");
			expect(link).not.toHaveClass("text-primary");
			// Pressed, it keeps that colour whole (dimmed to 70 % it measured
			// 4.05:1 on the light warning) and shows a thicker line instead.
			expect(link).toHaveClass(
				"active:text-warning-foreground",
				"active:underline",
				"active:decoration-2",
			);
			expect(link.className).not.toMatch(/active:text-[a-z-]+\/\d/);
			// No padding to the sides, and its word at its own edge: on a touch
			// screen the link is 44 px wide and a short word sat 4.7 px in.
			expect(link).toHaveClass("px-0", "pointer-coarse:px-0");
			expect(link).toHaveClass("justify-start");
			expect(container.querySelector("[style]")).toBeNull();
		});
	});

	for (const [part, api] of [
		["the delivery log", { deliveries: 500 }],
		["the queue", { queue: 500 }],
		["the suppression list", { suppression: 500 }],
		["the status", { status: 500 }],
	] as const) {
		it(`warns when only ${part} fails`, async () => {
			await quietly(async () => {
				stubOverviewApi(api);

				await show();

				expect(screen.getByRole("alert")).toHaveTextContent(
					"unreachable",
				);
			});
		});
	}

	it("does not warn about a delivery log that is switched off", async () => {
		stubOverviewApi({ deliveries: 404 });

		await show();

		expect(screen.queryByRole("alert")).toBeNull();
	});
});
