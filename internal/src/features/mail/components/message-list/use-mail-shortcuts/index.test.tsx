import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";

import { useMailShortcuts } from ".";

afterEach(cleanup);

function Harness({
	ids,
	selected,
}: {
	ids: string[];
	selected: string | undefined;
}) {
	useMailShortcuts({ ids, selectedId: selected });
	return (
		<div>
			{ids.map((id) => (
				<a key={id} href={`#${id}`} data-message-id={id}>
					{id}
				</a>
			))}
			<a href="#back" data-mail-back="">
				back
			</a>
			<input data-mail-search="" aria-label="search" />
			<textarea aria-label="area" />
			<dialog open aria-label="dlg">
				<button type="button">in dialog</button>
			</dialog>
		</div>
	);
}

function clicks(): string[] {
	const seen: string[] = [];
	for (const a of document.querySelectorAll("a")) {
		a.addEventListener("click", (event) => {
			event.preventDefault();
			seen.push(a.getAttribute("href") ?? "");
		});
	}
	return seen;
}

describe("useMailShortcuts", () => {
	it("j and k open the next and the previous message and move the focus there", () => {
		render(<Harness ids={["a", "b", "c"]} selected="b" />);
		const seen = clicks();
		fireEvent.keyDown(document.body, { key: "j" });
		expect(seen).toEqual(["#c"]);
		expect(document.activeElement).toHaveAttribute("data-message-id", "c");
		fireEvent.keyDown(document.body, { key: "k" });
		expect(seen).toEqual(["#c", "#a"]);
	});

	it("j opens the first message when none is open, and nothing moves past the ends", () => {
		const { rerender } = render(
			<Harness ids={["a", "b"]} selected={undefined} />,
		);
		const seen = clicks();
		fireEvent.keyDown(document.body, { key: "j" });
		expect(seen).toEqual(["#a"]);
		rerender(<Harness ids={["a", "b"]} selected="b" />);
		fireEvent.keyDown(document.body, { key: "j" });
		rerender(<Harness ids={["a", "b"]} selected="a" />);
		fireEvent.keyDown(document.body, { key: "k" });
		expect(seen).toEqual(["#a"]);
	});

	it("/ focuses the search field and u follows the back link only with a message open", () => {
		const { rerender } = render(
			<Harness ids={["a"]} selected={undefined} />,
		);
		const seen = clicks();
		fireEvent.keyDown(document.body, { key: "/" });
		expect(document.activeElement).toHaveAttribute("data-mail-search");
		(document.activeElement as HTMLElement).blur();
		fireEvent.keyDown(document.body, { key: "u" });
		expect(seen).toEqual([]);
		rerender(<Harness ids={["a"]} selected="a" />);
		fireEvent.keyDown(document.body, { key: "u" });
		expect(seen).toEqual(["#back"]);
	});

	it("leaves keys alone while typing, in a dialog, with a modifier, or for other keys", () => {
		render(<Harness ids={["a", "b"]} selected="a" />);
		const seen = clicks();
		const input = document.querySelector("input") as HTMLElement;
		fireEvent.keyDown(input, { key: "j" });
		fireEvent.keyDown(document.querySelector("textarea") as HTMLElement, {
			key: "j",
		});
		fireEvent.keyDown(
			document.querySelector("dialog button") as HTMLElement,
			{ key: "j" },
		);
		fireEvent.keyDown(document.body, { key: "j", ctrlKey: true });
		fireEvent.keyDown(document.body, { key: "j", metaKey: true });
		fireEvent.keyDown(document.body, { key: "j", altKey: true });
		fireEvent.keyDown(document.body, { key: "x" });
		expect(seen).toEqual([]);
	});

	it("stops listening when it unmounts", () => {
		const { unmount } = render(<Harness ids={["a", "b"]} selected="a" />);
		const seen = clicks();
		unmount();
		fireEvent.keyDown(document.body, { key: "j" });
		expect(seen).toEqual([]);
	});
});
