import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Sheet } from ".";

afterEach(cleanup);

function renderSheet(
	open: boolean,
	onOpenChange = mock((_open: boolean) => {}),
) {
	const view = render(
		<Sheet
			open={open}
			onOpenChange={onOpenChange}
			side="left"
			title="Menu"
			description="Pages of the panel"
			closeLabel="Shut"
		>
			<p>content</p>
		</Sheet>,
	);
	return { onOpenChange, view };
}

function dialogOf(container: HTMLElement) {
	return container.querySelector("dialog") as HTMLDialogElement;
}

describe("Sheet", () => {
	it("stays closed until open is true, then opens as a modal dialog", () => {
		const { view } = renderSheet(false);
		expect(dialogOf(view.container).open).toBe(false);

		view.rerender(
			<Sheet
				open
				onOpenChange={() => {}}
				title="Menu"
				description="d"
				closeLabel="x"
			>
				<p>content</p>
			</Sheet>,
		);

		expect(dialogOf(view.container).open).toBe(true);
	});

	it("is named by its title and described by its description", () => {
		const { view } = renderSheet(true);

		const dialog = dialogOf(view.container);
		expect(dialog).toHaveAccessibleName("Menu");
		expect(dialog).toHaveAccessibleDescription("Pages of the panel");
	});

	it("closes through the translated close button", () => {
		const { onOpenChange } = renderSheet(true);

		fireEvent.click(screen.getByRole("button", { name: "Shut" }));

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("names its close button, an icon alone, in a tooltip", () => {
		renderSheet(true);

		fireEvent.pointerEnter(screen.getByRole("button", { name: "Shut" }));

		const tip = document.querySelector("[data-slot='tooltip']");
		expect(tip).toHaveTextContent("Shut");
		expect(tip).toHaveAttribute("aria-hidden", "true");
	});

	it("closes on a click on the backdrop but not on its content", () => {
		const { onOpenChange, view } = renderSheet(true);

		fireEvent.click(screen.getByText("content"));
		expect(onOpenChange).not.toHaveBeenCalled();

		fireEvent.click(dialogOf(view.container));
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("reports the browser closing it, as Escape does", () => {
		const { onOpenChange, view } = renderSheet(true);

		fireEvent(dialogOf(view.container), new Event("close"));

		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("keeps Tab inside: from the last control to the first and back", () => {
		renderSheet(true);
		const close = screen.getByRole("button", { name: "Shut" });
		const dialog = close.closest("dialog") as HTMLDialogElement;
		const outside = document.createElement("a");
		outside.href = "#";
		document.body.append(outside);
		dialog.insertAdjacentHTML(
			"afterbegin",
			'<a href="#a" id="first">first</a>',
		);
		const first = dialog.querySelector("#first") as HTMLElement;

		close.focus();
		fireEvent.keyDown(close, { key: "Tab" });
		expect(document.activeElement).toBe(first);

		fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
		expect(document.activeElement).toBe(close);
		outside.remove();
	});

	it("leaves Tab alone in the middle of the sheet and for other keys", () => {
		renderSheet(true);
		const close = screen.getByRole("button", { name: "Shut" });
		const dialog = close.closest("dialog") as HTMLDialogElement;
		dialog.insertAdjacentHTML(
			"afterbegin",
			'<a href="#a" id="first">first</a>',
		);
		const first = dialog.querySelector("#first") as HTMLElement;

		first.focus();
		const middle = new KeyboardEvent("keydown", {
			key: "Tab",
			bubbles: true,
			cancelable: true,
		});
		first.dispatchEvent(middle);
		expect(middle.defaultPrevented).toBe(false);

		close.focus();
		const other = new KeyboardEvent("keydown", {
			key: "a",
			bubbles: true,
			cancelable: true,
		});
		close.dispatchEvent(other);
		expect(other.defaultPrevented).toBe(false);
	});

	it("sits on the chosen edge and sets no inline style", () => {
		const { view } = renderSheet(true);

		const dialog = dialogOf(view.container);
		expect(dialog).toHaveClass("left-0");
		expect(dialog).not.toHaveAttribute("style");
	});

	it("puts a right-hand sheet on the right edge by default", () => {
		const { container } = render(
			<Sheet
				open={false}
				onOpenChange={() => {}}
				title="t"
				description="d"
				closeLabel="c"
			/>,
		);

		expect(dialogOf(container)).toHaveClass("right-0");
	});
});
