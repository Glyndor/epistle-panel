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
import { keyboardFocus, place, renderTip, tabTo, tip } from "./test-support";

afterEach(cleanup);

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

	it("stands over a control that is too near the bottom of the window, and hangs under it again when there is room", () => {
		const html = document.documentElement;
		const height = Object.getOwnPropertyDescriptor(html, "clientHeight");
		Object.defineProperty(html, "clientHeight", {
			value: 800,
			configurable: true,
		});
		try {
			// The last row in view: its button ends 4 px over the window's edge.
			const low = renderTip({ align: "end" });
			place(low, { top: 764, bottom: 796, left: 900, right: 932 });
			fireEvent.pointerEnter(low);
			expect(tip()?.style.top).toBe("");
			// Held by its lower edge at the control's upper one: 800 - 764.
			expect(tip()?.style.bottom).toBe("36px");
			expect(tip()).toHaveAttribute("data-side", "top");
			expect(tip()).toHaveClass("pb-1.5");
			expect(tip()).not.toHaveClass("pt-1.5");
			cleanup();

			// One that ends 30 px over the edge has just the room it needs.
			const fits = renderTip({ align: "end" });
			place(fits, { top: 738, bottom: 770, left: 900, right: 932 });
			fireEvent.pointerEnter(fits);
			expect(tip()?.style.top).toBe("770px");
			expect(tip()?.style.bottom).toBe("");
			expect(tip()).toHaveAttribute("data-side", "bottom");
			cleanup();

			// One pixel less room, and it goes over.
			const tight = renderTip({ align: "end" });
			place(tight, { top: 739, bottom: 771, left: 900, right: 932 });
			fireEvent.pointerEnter(tight);
			expect(tip()?.style.bottom).toBe("61px");
			cleanup();

			// A window so short that it fits nowhere: under, as it always was.
			const cramped = renderTip({ align: "end" });
			place(cramped, { top: 20, bottom: 790, left: 900, right: 932 });
			fireEvent.pointerEnter(cramped);
			expect(tip()?.style.top).toBe("790px");
			expect(tip()?.style.bottom).toBe("");
		} finally {
			if (height === undefined) {
				Reflect.deleteProperty(html, "clientHeight");
			} else {
				Object.defineProperty(html, "clientHeight", height);
			}
		}
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

	it("shows on a focus the Tab key brought, not on one the pointer gave nor one handed back, and goes on blur", async () => {
		const button = renderTip();

		// The pointer gave it: the browser does not show the focus either.
		keyboardFocus(button, false);
		fireEvent.keyDown(document.body, { key: "Tab" });
		fireEvent.focus(button);
		expect(tip()).toBeNull();

		// Handed back by something that closed (Escape, Enter in a menu, a
		// press elsewhere): the focus shows, and it is no visit.
		for (const before of [
			() => fireEvent.keyDown(document.body, { key: "Escape" }),
			() => fireEvent.keyDown(document.body, { key: "Enter" }),
			() => fireEvent.pointerDown(document.body),
		]) {
			fireEvent.blur(button);
			keyboardFocus(button, true);
			fireEvent.keyDown(document.body, { key: "Tab" });
			before();
			fireEvent.focus(button);
			expect(tip()).toBeNull();
		}

		// The Tab key brought it, forwards or back.
		fireEvent.blur(button);
		tabTo(button);
		expect(tip()).toHaveTextContent("Toggle sidebar");
		fireEvent.blur(button);
		keyboardFocus(button, true);
		fireEvent.keyDown(document.body, { key: "Tab", shiftKey: true });
		fireEvent.focus(button);
		expect(tip()).toHaveTextContent("Toggle sidebar");

		fireEvent.blur(button);
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

	it("follows its control when the control moves, and goes when the control stops being drawn", async () => {
		const button = renderTip({ align: "start" });
		const frame = () =>
			new Promise((resolve) =>
				requestAnimationFrame(() => resolve(null)),
			);
		place(button, { top: 8, bottom: 40, left: 240 });
		fireEvent.pointerEnter(button);
		expect(tip()?.style.left).toBe("240px");

		// The sidebar collapsed under the control: it is 176 px to the left.
		place(button, { top: 8, bottom: 40, left: 64 });
		await frame();
		await frame();
		expect(tip()?.style.left).toBe("64px");
		expect(tip()?.style.top).toBe("40px");

		// A pane scrolled: the control went up with it.
		place(button, { top: -20, bottom: 12, left: 64 });
		await frame();
		await frame();
		expect(tip()?.style.top).toBe("12px");

		// The part that holds the control was hidden.
		button.checkVisibility = () => false;
		await frame();
		await frame();
		expect(tip()).toBeNull();
	});

	it("goes when its control is scrolled wholly out of the box that clips it, and stays while a part is in view", async () => {
		render(
			<div data-testid="pane">
				<Tooltip label="Row actions">
					<button type="button">
						<span className="sr-only">Row actions</span>
					</button>
				</Tooltip>
			</div>,
		);
		const pane = screen.getByTestId("pane");
		const button = screen.getByRole("button", { name: "Row actions" });
		const frame = () =>
			new Promise((resolve) =>
				requestAnimationFrame(() => resolve(null)),
			);
		// The pane scrolls: it shows what lies between 48 and 400 px.
		pane.style.overflowY = "auto";
		place(pane, {
			top: 48,
			bottom: 400,
			left: 0,
			right: 800,
			width: 800,
			height: 352,
		});
		place(button, { top: 100, bottom: 132, left: 700, right: 732 });
		fireEvent.pointerEnter(button);
		expect(tip()).not.toBeNull();

		// One pixel of the control still shows under the pane's upper edge.
		place(button, { top: 17, bottom: 49, left: 700, right: 732 });
		await frame();
		await frame();
		expect(tip()).not.toBeNull();

		// It is wholly above the pane now, where the header is.
		place(button, { top: 16, bottom: 48, left: 700, right: 732 });
		await frame();
		await frame();
		expect(tip()).toBeNull();
	});

	it("stops following once it is gone, and leaves no frame asked for behind it", async () => {
		const asked: number[] = [];
		const cancelled: number[] = [];
		const request = globalThis.requestAnimationFrame;
		const cancel = globalThis.cancelAnimationFrame;
		globalThis.requestAnimationFrame = ((
			callback: FrameRequestCallback,
		) => {
			const id = request(callback);
			asked.push(id);
			return id;
		}) as typeof requestAnimationFrame;
		globalThis.cancelAnimationFrame = ((id: number) => {
			cancelled.push(id);
			cancel(id);
		}) as typeof cancelAnimationFrame;
		try {
			const button = renderTip();
			fireEvent.pointerEnter(button);
			expect(asked.length).toBeGreaterThan(0);

			fireEvent.keyDown(button, { key: "Escape" });
			expect(tip()).toBeNull();
			const afterDismiss = asked.length;
			await new Promise((resolve) => setTimeout(resolve, 60));

			expect(asked.length).toBe(afterDismiss);
			expect(cancelled).toContain(asked.at(-1) as number);
		} finally {
			globalThis.requestAnimationFrame = request;
			globalThis.cancelAnimationFrame = cancel;
		}
	});
});
