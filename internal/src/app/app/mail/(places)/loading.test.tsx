import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { default: ComposeLoading } = await import("../compose/loading");
const { default: MailLoading } = await import("./loading");

afterEach(() => {
	cleanup();
	cookies.reset();
});

describe("the webmail's loading states", () => {
	it("the mail page shows its panes with a skeleton and says it once to a screen reader", async () => {
		const { container } = render(await MailLoading());

		// The list streams into its skeleton; the reader is empty until a
		// message is opened, and the folders are the sidebar's.
		expect(
			container.querySelectorAll('[aria-busy="true"]').length,
		).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByRole("status")).toHaveLength(1);
		expect(container.querySelector("[style]")).toBeNull();
		const panes = [...(container.firstElementChild?.children ?? [])];
		expect(panes).toHaveLength(2);
		for (const pane of panes) {
			expect(pane).toHaveClass("bg-surface", "rounded-2xl");
		}
	});

	it("the mail page draws the list's place in the density the reader chose", async () => {
		const pane = async () =>
			render(await MailLoading())
				.container.querySelector('[data-slot="row-skeleton"]')
				?.closest("[data-density]");

		expect(await pane()).toHaveAttribute("data-density", "comfortable");
		cleanup();

		cookies.jar.set("mail-density", "compact");
		const compact = await pane();
		expect(compact).toHaveAttribute("data-density", "compact");
		// The rows read the density through the pane's group.
		expect(compact).toHaveClass("group/list");
		cleanup();

		cookies.jar.set("mail-density", "tiny");
		expect(await pane()).toHaveAttribute("data-density", "comfortable");
	});

	it("the mail page holds the place of the way into the composer the page draws below 768 px", async () => {
		const { container } = render(await MailLoading());
		const place = container.querySelector('[data-slot="write-place"]');
		// The same box as the page's own, read from its source, so the list
		// under it starts at the same height in both.
		const page = await Bun.file(
			new URL(
				"../../../../features/mail/components/mail-place/index.tsx",
				import.meta.url,
			),
		).text();
		const box = "flex items-center gap-2 p-2 md:hidden";

		expect(page).toContain(`className="${box}"`);
		expect(place).toHaveClass(...box.split(" "));
		expect(place).toHaveAttribute("aria-hidden", "true");
		// As tall as the link: 24 px, 44 px on a coarse pointer.
		expect(place?.firstElementChild).toHaveClass(
			"h-6",
			"pointer-coarse:h-11",
		);
		// And before the list's own place, inside the pane.
		expect(place?.nextElementSibling?.getAttribute("aria-hidden")).toBe(
			"true",
		);
		expect(place?.parentElement).toHaveAttribute("data-density");
	});

	it("the composer shows the place of its form", () => {
		const { container } = render(<ComposeLoading />);

		expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
		expect(container.querySelector("[style]")).toBeNull();
	});
});
