import { afterEach, describe, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { NarrowSearch } from "@/features/mail/components/mail-search/narrow";
import { forgetListMemory } from "@/features/mail/components/message-list/list-memory";
import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import { withQuery } from "@/test/query-wrapper";
import { SearchForm } from ".";

afterEach(() => {
	cleanup();
	forgetListMemory();
});

function draw(narrow = false) {
	const form = (
		<SearchForm path="/app/mail/inbox" conditions={EMPTY_CONDITIONS} />
	);
	render(
		withQuery(
			<>
				<button type="button">outside</button>
				{narrow ? (
					<NarrowSearch label="search" closeLabel="close">
						{form}
					</NarrowSearch>
				) : (
					form
				)}
			</>,
		),
	);
	const trigger = screen
		.getByText("searchFields")
		.closest("summary") as HTMLElement;
	const details = trigger.closest("details") as HTMLDetailsElement;
	return { trigger, details };
}

describe("search fields dismissal", () => {
	it("Escape closes only the fields, returns focus and reports the native expanded state", async () => {
		const { trigger, details } = draw(true);
		const icon = screen.getByRole("button", { name: "search" });
		fireEvent.click(icon);
		fireEvent.click(trigger);
		await waitFor(() =>
			expect(trigger).toHaveAttribute("aria-expanded", "true"),
		);
		const from = screen.getByLabelText("from");
		from.focus();
		fireEvent.keyDown(from, { key: "Escape" });
		expect(details.open).toBe(false);
		expect(document.activeElement).toBe(trigger);
		expect(icon).toHaveAttribute("aria-expanded", "true");
		await waitFor(() =>
			expect(trigger).toHaveAttribute("aria-expanded", "false"),
		);
	});

	it("Space toggles the native panel and keeps expanded state synchronized", async () => {
		const { trigger, details } = draw();
		trigger.focus();
		fireEvent.keyDown(trigger, { key: " " });
		expect(details.open).toBe(true);
		await waitFor(() =>
			expect(trigger).toHaveAttribute("aria-expanded", "true"),
		);
		fireEvent.keyDown(trigger, { key: " " });
		expect(details.open).toBe(false);
		expect(document.activeElement).toBe(trigger);
		await waitFor(() =>
			expect(trigger).toHaveAttribute("aria-expanded", "false"),
		);
	});

	it.each(["pointer", "click", "focus"])(
		"closes on outside %s and leaves focus outside",
		async (kind) => {
			const { trigger, details } = draw();
			fireEvent.click(trigger);
			screen.getByLabelText("from").focus();
			const outside = screen.getByRole("button", { name: "outside" });
			if (kind === "pointer") fireEvent.pointerDown(outside);
			if (kind === "click") fireEvent.click(outside);
			if (kind !== "focus") expect(details.open).toBe(false);
			outside.focus();
			expect(details.open).toBe(false);
			expect(document.activeElement).toBe(outside);
			await waitFor(() =>
				expect(trigger).toHaveAttribute("aria-expanded", "false"),
			);
		},
	);

	it("keeps internal interactions open and the DOM keyboard order, then closes by its button", async () => {
		const { trigger, details } = draw();
		expect(trigger).toHaveAttribute("aria-expanded", "false");
		fireEvent.click(trigger);
		const from = screen.getByLabelText("from");
		const to = screen.getByLabelText("to");
		from.focus();
		fireEvent.pointerDown(to);
		fireEvent.click(to);
		to.focus();
		expect(details.open).toBe(true);
		expect(document.activeElement).toBe(to);
		expect(trigger.hasAttribute("tabindex")).toBe(false);
		expect(from.hasAttribute("tabindex")).toBe(false);
		expect(
			trigger.compareDocumentPosition(from) &
				Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(
			from.compareDocumentPosition(to) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		fireEvent.click(trigger);
		expect(details.open).toBe(false);
		await waitFor(() =>
			expect(trigger).toHaveAttribute("aria-expanded", "false"),
		);
	});
});
