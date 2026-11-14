import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
	forgetListMemory,
	listMemory,
} from "@/features/mail/components/message-list/list-memory";
import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import { withQuery } from "@/test/query-wrapper";

import { ListToolbar } from ".";

/** The conditions the toolbar draws: nothing narrowed. */
const CONDITIONS = EMPTY_CONDITIONS;

/** The conditions of a search: the words, and the starred ones. */
const SEARCH = { ...EMPTY_CONDITIONS, q: "invoice", starred: true };

afterEach(() => {
	cleanup();
	forgetListMemory();
});

describe("ListToolbar", () => {
	it("has no search of its own: it is in the header of the bar", () => {
		const { container } = render(
			withQuery(
				<ListToolbar
					box="Work/Q4"
					folderRole={null}
					conditions={CONDITIONS}
					page={1}
					density="comfortable"
				/>,
			),
		);

		expect(container.querySelector("form")).toBeNull();
		expect(screen.queryByRole("searchbox")).toBeNull();
	});

	it("offers no clear link without a search", () => {
		render(
			withQuery(
				<ListToolbar
					box="INBOX"
					folderRole="inbox"
					conditions={CONDITIONS}
					page={1}
					density="comfortable"
				/>,
			),
		);

		expect(screen.queryByRole("link", { name: "searchClear" })).toBeNull();
		expect(screen.queryByText("searchNote")).toBeNull();
	});

	it("says what the search reads and offers to clear it", () => {
		render(
			withQuery(
				<ListToolbar
					box="INBOX"
					folderRole="inbox"
					conditions={SEARCH}
					page={1}
					density="comfortable"
				/>,
			),
		);

		expect(screen.getByText("searchNote")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "searchClear" }),
		).toHaveAttribute("href", "/app/mail/inbox?starred=1");
	});

	it("remembers that the words were taken off, so the focus goes with them", () => {
		render(
			withQuery(
				<ListToolbar
					box="INBOX"
					folderRole="inbox"
					conditions={SEARCH}
					page={1}
					density="comfortable"
				/>,
			),
		);

		fireEvent.click(screen.getByRole("link", { name: "searchClear" }));

		expect(listMemory.chips).toBe("q");
	});

	it("has the filters and the order in one menu, and says how many are on", () => {
		render(
			withQuery(
				<ListToolbar
					box="INBOX"
					folderRole="inbox"
					conditions={{ ...EMPTY_CONDITIONS, unread: true }}
					page={1}
					density="comfortable"
				/>,
			),
		);

		const menu = screen.getByRole("button", { name: /filters/ });
		expect(menu).toHaveTextContent("filters");
		expect(menu).toHaveTextContent("1");
	});

	it("puts the density switch at the end of the line, in the density the server read", () => {
		for (const [density, pressed] of [
			["comfortable", "false"],
			["compact", "true"],
		] as const) {
			const { container } = render(
				withQuery(
					<ListToolbar
						box="INBOX"
						folderRole="inbox"
						conditions={CONDITIONS}
						page={1}
						density={density}
					/>,
				),
			);
			const toggle = screen.getByRole("button", {
				name: "densityCompact",
			});

			expect(toggle).toHaveAttribute("aria-pressed", pressed);
			// The filters have their own menu, beside the switch.
			expect(
				screen
					.getByRole("button", { name: /filters/ })
					.contains(toggle),
			).toBe(false);
			expect(
				screen.getByRole("button", { name: /filters/ })
					.parentElement ===
					container.firstElementChild?.firstElementChild,
			).toBe(true);
			cleanup();
		}
	});
});
