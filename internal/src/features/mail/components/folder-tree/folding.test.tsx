import { afterEach, beforeEach, expect, it } from "bun:test";
import { fireEvent, screen } from "@testing-library/react";
import { box, boxes, disclosure, install, reset, tree } from "./test-support";

beforeEach(install);
afterEach(reset);

it("starts with branches open and gives the disclosure its folder's accessible name", () => {
	tree();
	expect(disclosure()).toHaveAttribute("aria-expanded", "true");
	expect(disclosure()).not.toHaveAttribute("aria-disabled");
	expect(
		screen.getByRole("link", { name: "Q4 2 unread" }),
	).toBeInTheDocument();
});

it("keeps the native disclosure button and folder link as separate sequential focus stops", () => {
	tree();
	const toggle = disclosure();
	const link = screen.getByRole("link", { name: "Work 1 unread" });
	expect(toggle.tagName).toBe("BUTTON");
	expect(toggle).toHaveAttribute("type", "button");
	expect(toggle.tabIndex).toBe(0);
	expect(link.tabIndex).toBe(0);
	expect(link).toHaveAttribute("href", "/app/mail/folder/Work");
	expect(toggle.closest("a")).toBeNull();
	expect(link.querySelector("button")).toBeNull();
	expect(
		toggle.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING,
	).not.toBe(0);
	toggle.focus();
	expect(toggle).toHaveFocus();
	link.focus();
	expect(link).toHaveFocus();
});

it("clicking folds and unfolds only that branch and updates its unread badge", () => {
	tree();
	fireEvent.click(disclosure());
	expect(disclosure("Work", false)).toHaveAttribute("aria-expanded", "false");
	expect(screen.queryByRole("link", { name: /Q4/ })).toBeNull();
	expect(screen.getByRole("link", { name: "Other" })).toBeInTheDocument();
	expect(
		screen.getByRole("link", { name: "Work 3 unread" }),
	).toBeInTheDocument();
	fireEvent.click(disclosure("Work", false));
	expect(disclosure()).toHaveAttribute("aria-expanded", "true");
	expect(
		screen.getByRole("link", { name: "Q4 2 unread" }),
	).toBeInTheDocument();
	expect(
		screen.getByRole("link", { name: "Work 1 unread" }),
	).toBeInTheDocument();
});

it("opens a previously folded active branch and restores its fold after navigating away", () => {
	const view = tree();
	fireEvent.click(disclosure());
	view.navigate("/app/mail/folder/Q4");
	expect(disclosure()).toHaveAttribute("aria-expanded", "true");
	expect(disclosure()).toHaveAttribute("aria-disabled", "true");
	expect(screen.getByRole("link", { name: "Q4 2 unread" })).toHaveAttribute(
		"aria-current",
		"page",
	);
	view.navigate("/app/mail/compose");
	expect(disclosure("Work", false)).toHaveAttribute("aria-expanded", "false");
	expect(screen.queryByRole("link", { name: /Q4/ })).toBeNull();
});

it("does not change a held branch's remembered state when its disclosure is pressed", () => {
	const view = tree();
	view.navigate("/app/mail/folder/Q4");
	fireEvent.click(disclosure());
	expect(disclosure()).toHaveAttribute("aria-expanded", "true");
	view.navigate("/app/mail/compose");
	expect(disclosure()).toHaveAttribute("aria-expanded", "true");
	expect(screen.getByRole("link", { name: /Q4/ })).toBeInTheDocument();
});

it("does not give a leaf a disclosure but retains its alignment column", () => {
	const { container } = tree();
	expect(
		screen.queryByRole("button", { name: /(?:Fold|Unfold) (?:Q4|Other)/ }),
	).toBeNull();
	expect(
		container.querySelectorAll('[data-slot="folder-twisty"]'),
	).toHaveLength(3);
});

it("removes disclosure controls and their columns from the collapsed icon rail", () => {
	const { container } = tree(boxes, false);
	expect(
		screen.queryByRole("button", { name: /(?:Fold|Unfold) Work/ }),
	).toBeNull();
	expect(container.querySelector('[data-slot="folder-twisty"]')).toBeNull();
	expect(screen.getAllByRole("link")).toHaveLength(3);
});

it("retains an unloaded branch's fold across mailbox refreshes", () => {
	const view = tree();
	fireEvent.click(disclosure());
	view.load([box("Other")]);
	expect(screen.getAllByRole("link")).toHaveLength(1);
	view.load(boxes);
	expect(disclosure("Work", false)).toHaveAttribute("aria-expanded", "false");
	expect(screen.queryByRole("link", { name: /Q4/ })).toBeNull();
});

it("keeps independent nested folds among many siblings", () => {
	const list = [
		box("root"),
		box("middle", "root"),
		box("inner", "middle"),
		box("leaf", "inner"),
		...Array.from({ length: 40 }, (_, i) => box(`sibling${i}`, "root")),
	];
	tree(list);
	expect(screen.getAllByRole("link")).toHaveLength(44);
	fireEvent.click(disclosure("inner"));
	fireEvent.click(disclosure("root"));
	expect(screen.getAllByRole("link")).toHaveLength(1);
	fireEvent.click(disclosure("root", false));
	expect(screen.getAllByRole("link")).toHaveLength(43);
	expect(disclosure("inner", false)).toHaveAttribute(
		"aria-expanded",
		"false",
	);
	fireEvent.click(disclosure("inner", false));
	expect(screen.getByRole("link", { name: "leaf" })).toBeInTheDocument();
});
