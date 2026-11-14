import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { useFirstItemFocus } from ".";

afterEach(cleanup);

function Menu({ wanted, items = true }: { wanted: boolean; items?: boolean }) {
	const content = useFirstItemFocus(wanted);
	return (
		<div ref={content} role="menu" tabIndex={-1}>
			<p>label</p>
			{items ? (
				<>
					<div
						role="menuitemradio"
						aria-checked="false"
						tabIndex={-1}
					>
						one
					</div>
					<div role="menuitem" tabIndex={-1}>
						two
					</div>
				</>
			) : null}
		</div>
	);
}

describe("useFirstItemFocus", () => {
	it("puts the focus on the first item of the menu when wanted", () => {
		render(<Menu wanted />);

		expect(document.activeElement).toBe(screen.getByText("one"));
	});

	it("leaves the focus alone when not wanted", () => {
		const before = document.activeElement;
		render(<Menu wanted={false} />);

		expect(document.activeElement).toBe(before);
	});

	it("does it once: a later render does not take the focus back", () => {
		const view = render(<Menu wanted />);
		screen.getByText("two").focus();

		view.rerender(<Menu wanted />);

		expect(document.activeElement).toBe(screen.getByText("two"));
	});

	it("does nothing in a menu with no item", () => {
		const before = document.activeElement;
		render(<Menu wanted items={false} />);

		expect(document.activeElement).toBe(before);
	});
});
