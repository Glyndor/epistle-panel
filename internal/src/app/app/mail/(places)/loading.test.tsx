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

	it("the composer shows the place of its form", () => {
		const { container } = render(<ComposeLoading />);

		expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
		expect(container.querySelector("[style]")).toBeNull();
	});
});
