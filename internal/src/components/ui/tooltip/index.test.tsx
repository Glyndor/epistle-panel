import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from ".";

afterEach(cleanup);

const tip = () => document.querySelector<HTMLElement>("[data-slot='tooltip']");

/** Give the control a rectangle, which happy-dom does not lay out. */
function place(element: HTMLElement, box: Partial<DOMRect>) {
	element.getBoundingClientRect = () =>
		({
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			width: 0,
			height: 0,
			x: 0,
			y: 0,
			toJSON: () => ({}),
			...box,
		}) as DOMRect;
}

/** Say whether the control's focus is a keyboard one. */
function keyboardFocus(element: HTMLElement, visible: boolean) {
	const original = element.matches.bind(element);
	element.matches = ((selector: string) =>
		selector === ":focus-visible"
			? visible
			: original(selector)) as typeof element.matches;
}

function renderTip(props: Partial<Parameters<typeof Tooltip>[0]> = {}) {
	render(
		<Tooltip label="Toggle sidebar" {...props}>
			<button type="button">
				<span className="sr-only">Toggle sidebar</span>
			</button>
		</Tooltip>,
	);
	return screen.getByRole("button", { name: "Toggle sidebar" });
}

describe("Tooltip", () => {
	it("is not in the page until the control is reached", () => {
		renderTip();

		expect(tip()).toBeNull();
	});

	it("is not in the served page and writes no style there", () => {
		const html = renderToString(
			<Tooltip label="Theme" shortcut="Ctrl+B">
				<button type="button">x</button>
			</Tooltip>,
		);

		expect(html).toBe('<button type="button">x</button>');
		expect(html).not.toContain("style");
	});

	it("names the control on hover, hidden from assistive tech, which already has the name", () => {
		const button = renderTip();

		fireEvent.pointerEnter(button);

		expect(tip()).toHaveTextContent("Toggle sidebar");
		expect(tip()).toHaveAttribute("aria-hidden", "true");
		expect(tip()).toHaveClass("fixed");
	});

	it("shows the key after the name when the control has one", () => {
		const button = renderTip({ shortcut: "Ctrl+B" });

		fireEvent.pointerEnter(button);

		const parts = [...(tip()?.firstElementChild?.children ?? [])].map(
			(part) => part.textContent,
		);
		expect(parts).toEqual(["Toggle sidebar", "Ctrl+B"]);
	});

	it("sits under the control, in line with the edge it was told", () => {
		window.innerWidth = 1024;
		const box = { top: 10, bottom: 42, left: 900, right: 932, width: 32 };

		const centred = renderTip();
		place(centred, box);
		fireEvent.pointerEnter(centred);
		expect(tip()?.style.top).toBe("42px");
		expect(tip()?.style.left).toBe("916px");
		expect(tip()).toHaveClass("-translate-x-1/2");
		cleanup();

		const start = renderTip({ align: "start" });
		place(start, box);
		fireEvent.pointerEnter(start);
		expect(tip()?.style.left).toBe("900px");
		expect(tip()).not.toHaveClass("-translate-x-1/2");
		cleanup();

		// At the end of a bar it is held by its far edge, so it stays in the window.
		const end = renderTip({ align: "end" });
		place(end, box);
		fireEvent.pointerEnter(end);
		expect(tip()?.style.left).toBe("");
		expect(tip()?.style.right).toBe(
			`${document.documentElement.clientWidth - 932}px`,
		);
	});

	it("sits beside the control, as tall as it, when told the right side", () => {
		const button = renderTip({ side: "right" });
		place(button, { top: 100, right: 48, height: 32 });

		fireEvent.pointerEnter(button);

		expect(tip()).toHaveAttribute("data-side", "right");
		expect(tip()?.style.top).toBe("100px");
		expect(tip()?.style.left).toBe("48px");
		expect(tip()?.style.height).toBe("32px");
	});

	it("does not show on touch", () => {
		const button = renderTip();

		fireEvent.pointerEnter(button, { pointerType: "touch" });

		expect(tip()).toBeNull();
	});

	it("shows on a keyboard focus, not on one the pointer gave, and goes on blur", async () => {
		const button = renderTip();

		keyboardFocus(button, false);
		fireEvent.focus(button);
		expect(tip()).toBeNull();

		keyboardFocus(button, true);
		fireEvent.focus(button);
		expect(tip()).toHaveTextContent("Toggle sidebar");

		fireEvent.blur(button);
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(tip()).toBeNull();
	});

	it("is dismissed by Escape, and by using the control", () => {
		const button = renderTip();

		fireEvent.pointerEnter(button);
		fireEvent.keyDown(button, { key: "Escape" });
		expect(tip()).toBeNull();

		fireEvent.pointerEnter(button);
		fireEvent.pointerDown(button);
		expect(tip()).toBeNull();

		for (const key of ["Enter", " "]) {
			keyboardFocus(button, true);
			fireEvent.focus(button);
			expect(tip()).not.toBeNull();
			fireEvent.keyDown(button, { key });
			expect(tip()).toBeNull();
		}
	});

	it("stays while the pointer moves onto it, and goes after it leaves", async () => {
		const button = renderTip();
		fireEvent.pointerEnter(button);
		fireEvent.pointerLeave(button);

		fireEvent.pointerEnter(tip() as HTMLElement);
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(tip()).not.toBeNull();

		fireEvent.pointerLeave(tip() as HTMLElement);
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(tip()).toBeNull();
	});

	it("is never shown when disabled", () => {
		const button = renderTip({ disabled: true });

		fireEvent.pointerEnter(button);
		keyboardFocus(button, true);
		fireEvent.focus(button);

		expect(tip()).toBeNull();
	});

	it("runs the control's own handlers too", () => {
		const seen: string[] = [];
		render(
			<Tooltip label="X">
				<button
					type="button"
					onPointerEnter={() => seen.push("enter")}
					onPointerLeave={() => seen.push("leave")}
					onPointerDown={() => seen.push("down")}
					onFocus={() => seen.push("focus")}
					onBlur={() => seen.push("blur")}
					onKeyDown={() => seen.push("key")}
				>
					X
				</button>
			</Tooltip>,
		);
		const button = screen.getByRole("button", { name: "X" });

		fireEvent.pointerEnter(button);
		fireEvent.pointerLeave(button);
		fireEvent.pointerDown(button);
		fireEvent.focus(button);
		fireEvent.blur(button);
		fireEvent.keyDown(button, { key: "a" });

		expect(seen).toEqual([
			"enter",
			"leave",
			"down",
			"focus",
			"blur",
			"key",
		]);
	});

	it("passes on to the control what a trigger around it hands down, and stays away while its menu is open", async () => {
		render(
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Tooltip label="Theme">
						<button type="button">
							<span className="sr-only">Theme</span>
						</button>
					</Tooltip>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<DropdownMenuItem>Dark</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>,
		);
		const button = screen.getByRole("button", { name: "Theme" });

		// The trigger's own attributes reach the button through the tooltip.
		expect(button).toHaveAttribute("aria-haspopup", "menu");
		expect(button).toHaveAttribute("aria-expanded", "false");
		fireEvent.pointerEnter(button);
		expect(tip()).toHaveTextContent("Theme");

		// And so do its handlers: the key opens the menu.
		fireEvent.keyDown(button, { key: "Enter" });
		await screen.findByRole("menu");
		expect(button).toHaveAttribute("aria-expanded", "true");
		expect(tip()).toBeNull();
		fireEvent.pointerEnter(button);
		expect(tip()).toBeNull();
	});

	it("still shows for a control that is open but has no menu of its own", () => {
		render(
			<Tooltip label="Toggle sidebar">
				<button type="button" aria-expanded="true">
					<span className="sr-only">Toggle sidebar</span>
				</button>
			</Tooltip>,
		);

		fireEvent.pointerEnter(
			screen.getByRole("button", { name: "Toggle sidebar" }),
		);

		expect(tip()).toHaveTextContent("Toggle sidebar");
	});
});
