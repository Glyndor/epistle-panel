import { afterEach, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { TableIdentity } from ".";

afterEach(cleanup);

it.each(["users", "globe", "inbox", "send", "ban"] as const)(
	"renders the %s mask as empty decoration before unchanged text",
	(icon) => {
		const { container } = render(
			<TableIdentity icon={icon}>alice@example.org</TableIdentity>,
		);
		const identity = container.firstElementChild;
		const mark = identity?.firstElementChild;
		expect(mark).toHaveAttribute("data-glyph", icon);
		expect(mark).toHaveAttribute("aria-hidden", "true");
		expect(mark).toHaveClass(
			"glyph",
			`glyph-${icon}`,
			"size-4",
			"shrink-0",
			// Level with the first line of a name that wraps, not with the middle of the block.
			"mt-[calc((1lh-1rem)/2)]",
		);
		expect(mark?.childNodes.length).toBe(0);
		expect(identity).toHaveClass(
			"inline-flex",
			"max-w-full",
			"items-start",
			"gap-2",
		);
		expect(identity?.children).toHaveLength(2);
		expect(identity?.lastElementChild).toHaveClass(
			"min-w-0",
			"wrap-anywhere",
		);
		expect(identity?.textContent).toBe("alice@example.org");
		expect(container.querySelector("svg, [style], a")).toBeNull();
	},
);

it("merges the caller's classes and preserves a child's link name and target", () => {
	render(
		<TableIdentity icon="users" className="font-mono gap-3">
			<a href="/accounts/alice?view=mail">Alice & mail</a>
		</TableIdentity>,
	);
	const link = screen.getByRole("link", { name: "Alice & mail" });
	expect(link).toHaveAttribute("href", "/accounts/alice?view=mail");
	expect(link.textContent).toBe("Alice & mail");
	const identity = link.parentElement?.parentElement;
	expect(identity).toHaveClass("font-mono", "gap-3");
	expect(identity).not.toHaveClass("gap-2");
	expect(identity?.querySelectorAll("a")).toHaveLength(1);
});
