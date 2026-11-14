import { afterEach, describe, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from ".";

afterEach(cleanup);

function setup() {
	return render(
		<Dialog>
			<DialogTrigger>Open</DialogTrigger>
			<DialogContent closeLabel="Shut">
				<DialogHeader>
					<DialogTitle>New thing</DialogTitle>
					<DialogDescription>Fill it in.</DialogDescription>
				</DialogHeader>
				<input aria-label="Name" />
				<DialogFooter>
					<DialogClose>Never mind</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>,
	);
}

describe("Dialog", () => {
	it("is closed until its trigger is used, then is a dialog named by its title and described", async () => {
		setup();
		expect(screen.queryByRole("dialog")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Open" }));
		const dialog = await screen.findByRole("dialog", { name: "New thing" });

		expect(dialog).toHaveAccessibleDescription("Fill it in.");
		expect(dialog.querySelector("[style]")).toBeNull();
	});

	it("closes with Escape, with its close button and with a control inside, and gives the focus back", async () => {
		setup();
		const trigger = screen.getByRole("button", { name: "Open" });

		fireEvent.click(trigger);
		fireEvent.keyDown(await screen.findByRole("dialog"), {
			key: "Escape",
		});
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(trigger).toHaveFocus();

		fireEvent.click(trigger);
		await screen.findByRole("dialog");
		fireEvent.click(screen.getByRole("button", { name: "Shut" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

		fireEvent.click(trigger);
		await screen.findByRole("dialog");
		fireEvent.click(screen.getByRole("button", { name: "Never mind" }));
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("keeps a 44 px close button on a coarse pointer and draws its focus as an outline", async () => {
		setup();
		fireEvent.click(screen.getByRole("button", { name: "Open" }));
		await screen.findByRole("dialog");
		const close = screen.getByRole("button", { name: "Shut" });

		expect(close.className).toContain("pointer-coarse:size-11");
		expect(close.className).toContain("focus-visible:outline-2");
		expect(close.className).not.toContain("outline-none");
	});

	it("names its close button, an icon alone, in a tooltip", async () => {
		setup();
		fireEvent.click(screen.getByRole("button", { name: "Open" }));
		const close = await screen.findByRole("button", { name: "Shut" });

		fireEvent.pointerEnter(close);

		const tip = document.querySelector("[data-slot='tooltip']");
		expect(tip).toHaveTextContent("Shut");
		expect(tip).toHaveAttribute("aria-hidden", "true");
		// Inside the dialog: the page behind a modal is out of reach.
		expect(screen.getByRole("dialog")).toContainElement(tip as HTMLElement);
	});

	it("is centred with its margins and no transform, which a tooltip inside it would be placed against", async () => {
		setup();
		fireEvent.click(screen.getByRole("button", { name: "Open" }));
		const dialog = await screen.findByRole("dialog");

		expect(dialog).toHaveClass("fixed", "inset-0", "m-auto", "h-fit");
		expect(dialog.className).not.toMatch(/translate|rotate|scale|skew/);
		expect(dialog.className).not.toMatch(/(^|\s)(top|left)-1\/2/);
	});
});
