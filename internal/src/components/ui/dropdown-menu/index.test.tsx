import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from ".";

afterEach(cleanup);

function renderMenu(onValueChange = mock((_value: string) => {})) {
	render(
		<DropdownMenu>
			<DropdownMenuTrigger>Language</DropdownMenuTrigger>
			<DropdownMenuContent>
				<DropdownMenuLabel>Pick one</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuRadioGroup
					value="en"
					onValueChange={onValueChange}
				>
					<DropdownMenuRadioItem value="en">
						English
					</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="es">
						Español
					</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>,
	);
	return onValueChange;
}

function open() {
	const trigger = screen.getByRole("button", { name: "Language" });
	fireEvent.keyDown(trigger, { key: "Enter" });
	return trigger;
}

describe("DropdownMenu", () => {
	it("keeps its items out of the page until opened", () => {
		renderMenu();

		expect(screen.queryByRole("menu")).toBeNull();
		expect(
			screen.getByRole("button", { name: "Language" }),
		).toHaveAttribute("aria-expanded", "false");
	});

	it("opens from the keyboard and marks the current choice", async () => {
		renderMenu();
		open();

		const items = await screen.findAllByRole("menuitemradio");
		expect(items.map((item) => item.textContent)).toEqual([
			"English",
			"Español",
		]);
		expect(items[0]).toHaveAttribute("aria-checked", "true");
		expect(items[1]).toHaveAttribute("aria-checked", "false");
	});

	it("reports the chosen value", async () => {
		const onValueChange = renderMenu();
		open();

		fireEvent.click(
			await screen.findByRole("menuitemradio", { name: "Español" }),
		);

		expect(onValueChange).toHaveBeenCalledWith("es");
	});

	it("is not modal, so it injects no scroll-lock style element", async () => {
		const before = document.head.querySelectorAll("style").length;
		renderMenu();
		open();
		await screen.findByRole("menu");

		expect(document.head.querySelectorAll("style").length).toBe(before);
		expect(document.body).not.toHaveAttribute("data-scroll-locked");
	});

	it("renders in place, inside its landmark, not in a portal on the body", async () => {
		render(
			<aside aria-label="Side">
				<DropdownMenu>
					<DropdownMenuTrigger>Language</DropdownMenuTrigger>
					<DropdownMenuContent>
						<DropdownMenuRadioGroup value="en">
							<DropdownMenuRadioItem value="en">
								English
							</DropdownMenuRadioItem>
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>
			</aside>,
		);
		fireEvent.keyDown(screen.getByRole("button", { name: "Language" }), {
			key: "Enter",
		});

		expect(screen.getByRole("complementary")).toContainElement(
			await screen.findByRole("menu"),
		);
	});

	it("sizes items for a fine pointer and a coarse one, with no inline style on the list", async () => {
		renderMenu();
		open();

		const item = await screen.findByRole("menuitemradio", {
			name: "English",
		});
		expect(item).toHaveClass("min-h-8", "pointer-coarse:min-h-11");
		// A focused item must show a ring, not only a fill: the outline is drawn
		// inside the item and `outline-none` would cancel it in Tailwind 4.
		expect(item).toHaveClass("focus:outline-2", "focus:outline-ring");
		expect(item).not.toHaveClass("outline-none");
		// The pointer focuses the item it is over; a press differs from that.
		expect(item).toHaveClass("focus:bg-accent", "active:bg-accent/70");
		expect(screen.getByRole("menu")).toBeInTheDocument();
	});

	it("gives an action a row of its own size, a pressed fill, and the destructive tone only when asked", async () => {
		const onSelect = mock(() => {});
		render(
			<DropdownMenu defaultOpen>
				<DropdownMenuTrigger>Actions</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem onSelect={onSelect}>
						Open
					</DropdownMenuItem>
					<DropdownMenuItem variant="destructive">
						Delete
					</DropdownMenuItem>
					<DropdownMenuItem asChild>
						<a href="/x">Go</a>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>,
		);

		const open = await screen.findByRole("menuitem", { name: "Open" });
		expect(open).toHaveAttribute("data-variant", "default");
		expect(open).toHaveClass(
			"min-h-8",
			"pointer-coarse:min-h-11",
			"focus:bg-accent",
			"data-[variant=default]:active:bg-accent/70",
		);
		expect(
			screen.getByRole("menuitem", { name: "Delete" }),
		).toHaveAttribute("data-variant", "destructive");
		// With `asChild` the row is the link itself.
		const go = screen.getByRole("menuitem", { name: "Go" });
		expect(go.tagName).toBe("A");
		expect(go).toHaveAttribute("href", "/x");
		fireEvent.click(open);
		expect(onSelect).toHaveBeenCalledTimes(1);
	});
});
