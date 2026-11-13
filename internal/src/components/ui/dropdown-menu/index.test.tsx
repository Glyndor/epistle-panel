import { afterEach, describe, expect, it, mock } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
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
		expect(item).toHaveClass("focus:outline-2", "outline-ring");
		expect(item).not.toHaveClass("outline-none");
		// The pointer focuses the item it is over; a press differs from that, and
		// the fill changes over a moment, not at once.
		expect(item).toHaveClass(
			"focus:bg-accent",
			"active:bg-accent/70",
			"transition-colors",
		);
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

	it("gives an action the same size, ring and answer to a press, and dims one that cannot be used", async () => {
		render(
			<DropdownMenu>
				<DropdownMenuTrigger>Row</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem>Open</DropdownMenuItem>
					<DropdownMenuItem disabled>Clear</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>,
		);
		fireEvent.keyDown(screen.getByRole("button", { name: "Row" }), {
			key: "Enter",
		});

		const item = await screen.findByRole("menuitem", { name: "Open" });
		expect(item).toHaveClass(
			"min-h-8",
			"pointer-coarse:min-h-11",
			"focus:outline-2",
			"outline-ring",
			"data-[variant=default]:active:bg-accent/70",
			"transition-colors",
		);
		const off = screen.getByRole("menuitem", { name: "Clear" });
		expect(off).toHaveAttribute("aria-disabled", "true");
		expect(off).toHaveClass(
			"data-[disabled]:pointer-events-none",
			"data-[disabled]:opacity-50",
		);
	});
});

describe("DropdownMenu tick boxes", () => {
	function renderChecks(
		onCheckedChange = mock((_checked: boolean) => {}),
		keepOpen = true,
	) {
		render(
			<DropdownMenu>
				<DropdownMenuTrigger>Filters</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuGroup aria-labelledby="state-label">
						<DropdownMenuLabel id="state-label">
							State
						</DropdownMenuLabel>
						<DropdownMenuCheckboxItem
							checked
							onCheckedChange={onCheckedChange}
							onSelect={(event) => {
								if (keepOpen) {
									event.preventDefault();
								}
							}}
						>
							Active
						</DropdownMenuCheckboxItem>
						<DropdownMenuCheckboxItem checked={false}>
							Off
						</DropdownMenuCheckboxItem>
					</DropdownMenuGroup>
				</DropdownMenuContent>
			</DropdownMenu>,
		);
		fireEvent.keyDown(screen.getByRole("button", { name: "Filters" }), {
			key: "Enter",
		});
		return onCheckedChange;
	}

	it("groups the boxes under the name of their group", async () => {
		renderChecks();

		const group = await screen.findByRole("group", { name: "State" });
		expect(
			[...group.querySelectorAll('[role="menuitemcheckbox"]')].map(
				(item) => item.textContent,
			),
		).toEqual(["Active", "Off"]);
	});

	it("says which boxes are ticked, and draws the box of both", async () => {
		renderChecks();

		const active = await screen.findByRole("menuitemcheckbox", {
			name: "Active",
		});
		const off = screen.getByRole("menuitemcheckbox", { name: "Off" });
		expect(active).toHaveAttribute("aria-checked", "true");
		expect(off).toHaveAttribute("aria-checked", "false");
		// The box is there in both states; the tick only in the ticked one.
		for (const item of [active, off]) {
			expect(item.querySelector("span")).toHaveClass(
				"size-4",
				"bg-field",
				"inset-ring-2",
				"inset-ring-field-edge",
				"group-data-[state=checked]/check:bg-primary",
				"group-data-[state=checked]/check:inset-ring-0",
			);
		}
		expect(active.querySelector("svg")).not.toBeNull();
		expect(off.querySelector("svg")).toBeNull();
	});

	it("reports a tick and stays open when the item asks to", async () => {
		const onCheckedChange = renderChecks();

		fireEvent.click(
			await screen.findByRole("menuitemcheckbox", { name: "Active" }),
		);

		expect(onCheckedChange).toHaveBeenCalledWith(false);
		expect(screen.getByRole("menu")).toBeInTheDocument();
	});

	it("closes on a tick when the item does not ask to stay open", async () => {
		const onCheckedChange = renderChecks(undefined, false);

		fireEvent.click(
			await screen.findByRole("menuitemcheckbox", { name: "Active" }),
		);

		expect(onCheckedChange).toHaveBeenCalledWith(false);
		await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
	});

	it("sizes a box row for both pointers and rings the focused one", async () => {
		renderChecks();

		const item = await screen.findByRole("menuitemcheckbox", {
			name: "Active",
		});
		expect(item).toHaveClass(
			"min-h-8",
			"pointer-coarse:min-h-11",
			"focus:outline-2",
			"outline-ring",
		);
		expect(item).not.toHaveClass("outline-none");
		// A press answers too, and the fill changes over a moment, not at once.
		expect(item).toHaveClass("active:bg-accent/70", "transition-colors");
	});

	it("draws the box with a small corner taken from the theme's radius, not a round one", async () => {
		renderChecks();

		const item = await screen.findByRole("menuitemcheckbox", {
			name: "Active",
		});
		expect(item.querySelector("span")).toHaveClass("rounded-xs");
	});

	it("draws the ring of every kind of item in the ring colour from the start, not only once focused", async () => {
		render(
			<DropdownMenu>
				<DropdownMenuTrigger>All</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem>Open</DropdownMenuItem>
					<DropdownMenuCheckboxItem checked>
						Active
					</DropdownMenuCheckboxItem>
					<DropdownMenuRadioGroup value="en">
						<DropdownMenuRadioItem value="en">
							English
						</DropdownMenuRadioItem>
					</DropdownMenuRadioGroup>
				</DropdownMenuContent>
			</DropdownMenu>,
		);
		fireEvent.keyDown(screen.getByRole("button", { name: "All" }), {
			key: "Enter",
		});
		await screen.findByRole("menu");

		for (const role of ["menuitem", "menuitemcheckbox", "menuitemradio"]) {
			const item = screen.getByRole(role);
			// With the colour set only on focus, the colour transition faded the
			// ring in from the text colour over its first 150 ms.
			expect(item).toHaveClass("outline-ring", "focus:outline-2");
			expect(item.className).not.toContain("focus:outline-ring");
		}
	});
});
