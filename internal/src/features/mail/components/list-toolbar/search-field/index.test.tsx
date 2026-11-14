import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
	forgetListMemory,
	listMemory,
} from "@/features/mail/components/message-list/list-memory";

import { SearchField } from ".";

/** Keys that reached the page as shortcuts would hear them. */
let heard: string[] = [];
const shortcut = (event: KeyboardEvent) => {
	heard.push(event.key);
};
document.addEventListener("keydown", shortcut);

afterEach(() => {
	heard = [];
	cleanup();
	forgetListMemory();
});

const page = (max = 200) => (
	<>
		<SearchField
			name="q"
			defaultValue=""
			maxLength={max}
			aria-label="search"
		/>
		<button type="button">another control</button>
	</>
);
const field = () => screen.getByRole<HTMLInputElement>("searchbox");
/** Type one key the way a browser does with the focus on the page. */
const press = (key: string, more: KeyboardEventInit = {}) =>
	fireEvent.keyDown(document.body, { key, ...more });
/** Go to the field and type in it. */
function typeInField(text: string) {
	field().focus();
	fireEvent.input(field(), { target: { value: text } });
}

describe("SearchField", () => {
	it("is the search field of the list, with the length it takes", () => {
		render(page(64));

		expect(field()).toHaveAttribute("type", "search");
		expect(field()).toHaveAttribute("maxlength", "64");
		expect(field()).toHaveAttribute("data-mail-search", "");
		expect(listMemory.search).toBeNull();
	});

	it("says that it has the focus and what it reads", () => {
		render(page());
		field().focus();
		expect(listMemory.search).toEqual({ text: "", max: 200 });

		fireEvent.input(field(), { target: { value: "sal" } });

		expect(listMemory.search).toEqual({ text: "sal", max: 200 });
	});

	it("takes the focus and the text back when it is drawn anew with its page", () => {
		const first = render(page());
		typeInField("sal");
		first.unmount();
		expect(document.activeElement).toBe(document.body);

		render(page());

		expect(document.activeElement).toBe(field());
		expect(field().value).toBe("sal");
		expect(field().selectionStart).toBe(3);
	});

	it("keeps what is typed while it is away, and lets none of it be a shortcut", () => {
		const first = render(page());
		typeInField("sa");
		first.unmount();

		const l = press("l");
		press("x");
		press("Backspace");
		press("e");

		expect(heard).toEqual([]);
		expect(l).toBe(false);
		render(page());
		expect(field().value).toBe("sale");
	});

	it("keeps no more than the field takes", () => {
		const first = render(page(5));
		typeInField("sale");
		first.unmount();

		press("s");
		press("!");

		expect(listMemory.search?.text).toBe("sales");
	});

	it("leaves a key with a modifier, and a key that types nothing, to the page", () => {
		const first = render(page());
		typeInField("sa");
		first.unmount();

		press("k", { ctrlKey: true });
		press("ArrowDown");

		expect(heard).toEqual(["k", "ArrowDown"]);
		expect(listMemory.search?.text).toBe("sa");
	});

	it.each([["Escape"], ["Tab"]])(
		"lets go of the focus with %s, and the next key is a shortcut again",
		(key) => {
			const first = render(page());
			typeInField("sa");
			first.unmount();

			press(key);
			press("e");

			expect(listMemory.search).toBeNull();
			expect(heard).toEqual([key, "e"]);
		},
	);

	it("lets go when the person takes the focus to another control", () => {
		render(page());
		typeInField("sa");

		screen.getByRole("button", { name: "another control" }).focus();

		expect(listMemory.search).toBeNull();
	});

	it("lets go with a press outside it, and not with a press on it", () => {
		render(page());
		typeInField("sa");

		fireEvent.pointerDown(field());
		expect(listMemory.search).toEqual({ text: "sa", max: 200 });
		fireEvent.pointerDown(document.body);

		expect(listMemory.search).toBeNull();
	});

	it("does not take the focus from a control that has it, nor change what it reads", () => {
		const other = document.createElement("button");
		document.body.append(other);
		other.focus();
		// Remembered from the page before, with the focus since moved by
		// something that sent no word of it.
		listMemory.search = { text: "sal", max: 200 };

		render(page());

		expect(document.activeElement).toBe(other);
		expect(field().value).toBe("");
		other.remove();
	});

	it("keeps the focus owed while it cannot take it, where the list is not in view", () => {
		const first = render(page());
		typeInField("sal");
		first.unmount();
		const focus = HTMLElement.prototype.focus;
		HTMLElement.prototype.focus = () => {};

		render(page());
		HTMLElement.prototype.focus = focus;
		press("e");

		expect(heard).toEqual([]);
		expect(listMemory.search?.text).toBe("sale");
	});

	it("types as any field does while it has the focus", () => {
		render(page());
		typeInField("sa");

		fireEvent.keyDown(field(), { key: "l" });

		expect(heard).toEqual(["l"]);
		expect(listMemory.search?.text).toBe("sa");
	});
});
