import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { FolderSheet } from ".";

const { showModal, close } = HTMLDialogElement.prototype;
afterEach(() => {
	cleanup();
	HTMLDialogElement.prototype.showModal = showModal;
	HTMLDialogElement.prototype.close = close;
});

// happy-dom has no showModal; the sheet's own tests cover the dialog, here the open state is read from the button.
describe("FolderSheet", () => {
	it("is a button that opens the tree as a dialog", () => {
		const shown: boolean[] = [];
		HTMLDialogElement.prototype.showModal = function () {
			shown.push(true);
			this.setAttribute("open", "");
		};
		HTMLDialogElement.prototype.close = function () {
			shown.push(false);
			this.removeAttribute("open");
		};
		render(
			<FolderSheet>
				<a href="/app/mail?box=Sent">Sent</a>
				<p>text</p>
			</FolderSheet>,
		);
		const button = screen.getByRole("button", { name: "folders" });
		expect(button).toHaveAttribute("aria-haspopup", "dialog");
		fireEvent.click(button);
		expect(shown).toEqual([true]);
		fireEvent.click(screen.getByText("text"));
		expect(shown).toEqual([true]);
		fireEvent.click(
			screen.getByRole("link", { name: "Sent", hidden: true }),
		);
		expect(shown).toEqual([true, false]);
	});
});
