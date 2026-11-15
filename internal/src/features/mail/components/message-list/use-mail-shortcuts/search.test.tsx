import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NarrowSearch } from "@/features/mail/components/mail-search/narrow";
import { useMailShortcuts } from ".";

const width = window.innerWidth;
afterEach(() => {
	cleanup();
	Object.defineProperty(window, "innerWidth", {
		configurable: true,
		value: width,
	});
});

function Harness() {
	useMailShortcuts({ ids: [], selectedId: undefined });
	return (
		<>
			<NarrowSearch label="search" closeLabel="close">
				<input type="search" aria-label="words" data-mail-search="" />
			</NarrowSearch>
			<input aria-label="other input" />
			<textarea aria-label="area" />
			<select aria-label="select">
				<option>one</option>
			</select>
			<div
				contentEditable="true"
				suppressContentEditableWarning
				data-testid="editable"
			>
				<span data-testid="nested">edit</span>
			</div>
		</>
	);
}
function draw(size: number) {
	Object.defineProperty(window, "innerWidth", {
		configurable: true,
		value: size,
	});
	render(<Harness />);
	return {
		icon: screen.getByRole("button", { name: "search" }),
		input: screen.getByRole("searchbox"),
	};
}

describe("search shortcut with the real narrow field", () => {
	it.each([360, 1023])(
		"opens the hidden field and focuses it at %s px",
		(size) => {
			const { icon, input } = draw(size);
			expect(icon).toHaveAttribute("aria-expanded", "false");
			expect(fireEvent.keyDown(document.body, { key: "/" })).toBe(false);
			expect(icon).toHaveAttribute("aria-expanded", "true");
			expect(icon).toHaveAttribute("tabindex", "-1");
			expect(input.parentElement?.className).not.toContain("hidden");
			expect(document.activeElement).toBe(input);
		},
	);
	it("focuses the wide field at 1024 px without opening an overlay", () => {
		const { icon, input } = draw(1024);
		fireEvent.keyDown(document.body, { key: "/" });
		expect(document.activeElement).toBe(input);
		expect(icon).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("button", { name: "close" })).toBeNull();
	});
	it.each(["other input", "area", "select", "editable", "nested"])(
		"leaves / alone in %s",
		(name) => {
			const { icon } = draw(360);
			const target =
				name === "editable" || name === "nested"
					? screen.getByTestId(name)
					: screen.getByLabelText(name);
			target.focus();
			expect(fireEvent.keyDown(target, { key: "/" })).toBe(true);
			expect(icon).toHaveAttribute("aria-expanded", "false");
		},
	);
	it.each(["ctrlKey", "metaKey", "altKey", "isComposing"])(
		"ignores / with %s",
		(key) => {
			const { icon, input } = draw(360);
			expect(
				fireEvent.keyDown(document.body, { key: "/", [key]: true }),
			).toBe(true);
			expect(icon).toHaveAttribute("aria-expanded", "false");
			expect(document.activeElement).not.toBe(input);
		},
	);
	it("opens the search with / typed with Shift, as es, it, de and fr layouts do", () => {
		const { icon, input } = draw(360);
		expect(
			fireEvent.keyDown(document.body, { key: "/", shiftKey: true }),
		).toBe(false);
		expect(icon).toHaveAttribute("aria-expanded", "true");
		expect(document.activeElement).toBe(input);
	});
	it("still ignores other keys typed with Shift", () => {
		const { icon } = draw(360);
		expect(
			fireEvent.keyDown(document.body, { key: "?", shiftKey: true }),
		).toBe(true);
		expect(icon).toHaveAttribute("aria-expanded", "false");
	});
});
