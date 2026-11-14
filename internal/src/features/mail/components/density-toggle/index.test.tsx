import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { clearToasts, Toaster } from "@/components/ui/toaster";
import type { ListDensity } from "@/features/mail/config/list-density";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { DensityToggle } = await import(".");

const writes = () => cookies.writes.filter((w) => w.name === "mail-density");

beforeEach(() => {
	cookies.reset();
});
afterEach(() => {
	cleanup();
	clearToasts();
});

/** The toggle inside a pane that carries the density, as the page renders it. */
function pane(density: ListDensity) {
	const view = render(
		<>
			<section data-density={density} data-testid="pane">
				<DensityToggle density={density} />
			</section>
			<Toaster label="toasts" closeLabel="close" />
		</>,
	);
	return {
		...view,
		pane: screen.getByTestId("pane"),
		button: screen.getByRole("button", { name: "densityCompact" }),
	};
}

describe("DensityToggle", () => {
	it("is a named button that says whether the list is compact", () => {
		expect(pane("comfortable").button).toHaveAttribute(
			"aria-pressed",
			"false",
		);
		cleanup();
		expect(pane("compact").button).toHaveAttribute("aria-pressed", "true");
	});

	it("shows the compact list at once on the pane and stores the choice", async () => {
		await cookies.signIn();
		const view = pane("comfortable");

		fireEvent.click(view.button);

		// Before the server answered: the pane and the button already changed.
		expect(view.pane).toHaveAttribute("data-density", "compact");
		expect(view.button).toHaveAttribute("aria-pressed", "true");
		await waitFor(() => expect(writes()).toHaveLength(1));
		expect(writes()[0]?.value).toBe("compact");
		expect(view.pane).toHaveAttribute("data-density", "compact");
	});

	it("goes back to comfortable from compact", async () => {
		await cookies.signIn();
		const view = pane("compact");

		fireEvent.click(view.button);

		expect(view.pane).toHaveAttribute("data-density", "comfortable");
		await waitFor(() => expect(writes()).toHaveLength(1));
		expect(writes()[0]?.value).toBe("comfortable");
	});

	it("puts the density back and says so when the server refuses", async () => {
		// No session: the action stores nothing and answers false.
		const view = pane("comfortable");

		fireEvent.click(view.button);

		expect(await screen.findByText("densityFailed")).toBeInTheDocument();
		expect(view.pane).toHaveAttribute("data-density", "comfortable");
		expect(view.button).toHaveAttribute("aria-pressed", "false");
		expect(writes()).toHaveLength(0);
	});

	it("puts the density back when the server cannot be reached at all", async () => {
		const view = pane("compact");
		// The action itself fails, as when the network is gone.
		const get = cookies.jar.get.bind(cookies.jar);
		cookies.jar.get = () => {
			throw new Error("unreachable");
		};

		fireEvent.click(view.button);

		try {
			expect(
				await screen.findByText("densityFailed"),
			).toBeInTheDocument();
			expect(view.pane).toHaveAttribute("data-density", "compact");
			expect(view.button).toHaveAttribute("aria-pressed", "true");
		} finally {
			cookies.jar.get = get;
		}
	});

	it("drops a second press while the first is being stored", async () => {
		await cookies.signIn();
		const view = pane("comfortable");

		fireEvent.click(view.button);
		expect(view.button).toHaveAttribute("aria-disabled", "true");
		fireEvent.click(view.button);

		await waitFor(() =>
			expect(view.button).not.toHaveAttribute("aria-disabled"),
		);
		// One write, and the list is what the first press asked for.
		expect(writes()).toHaveLength(1);
		expect(view.pane).toHaveAttribute("data-density", "compact");
	});

	it("follows the server when the pane is rendered again with another choice", () => {
		const view = pane("comfortable");

		view.rerender(
			<section data-density="compact" data-testid="pane">
				<DensityToggle density="compact" />
			</section>,
		);

		expect(
			screen.getByRole("button", { name: "densityCompact" }),
		).toHaveAttribute("aria-pressed", "true");
	});

	it("draws a different icon for each density, so the state is not the fill alone", () => {
		const comfortable = pane("comfortable").button.innerHTML;
		cleanup();
		const compact = pane("compact").button.innerHTML;

		expect(comfortable).not.toBe(compact);
		expect(comfortable).toContain("<svg");
		expect(compact).toContain("<svg");
	});

	it("looks different pressed, under the pointer, and both", () => {
		const { button } = pane("compact");

		expect(button).toHaveClass(
			"hover:bg-foreground/10",
			"aria-pressed:bg-accent",
			"aria-pressed:hover:bg-foreground/15",
		);
		// The ghost button's own hover is the accent, which is the pressed look.
		expect(button).not.toHaveClass("hover:bg-accent");
	});
});
