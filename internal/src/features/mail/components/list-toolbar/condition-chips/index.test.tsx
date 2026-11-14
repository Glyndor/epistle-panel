import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { NarrowSearch } from "@/features/mail/components/mail-search/narrow";
import { SEARCH_FIELD_ID } from "@/features/mail/components/mail-search/search-field";
import { forgetListMemory } from "@/features/mail/components/message-list/list-memory";
import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { installNextIntlMocks } from "@/test/next-intl";
import { settled, withQuery } from "@/test/query-wrapper";
import { emailFixture, stubJmap } from "../../../test-support/jmap-stub";

// The client stand-in says the key and drops what the message is given, so
// the number of messages a chip counts would not be seen. This one says the
// key and the values, so the count can be read.
mock.module("next-intl", () => ({
	useTranslations: () => (key: string, values?: Record<string, unknown>) =>
		values === undefined ? key : `${key}${JSON.stringify(values)}`,
}));

const originalFetch = globalThis.fetch;
const originalMatchMedia = window.matchMedia;

/** The same breakpoint used by the header's lg utilities. */
function viewport(width: number) {
	window.matchMedia = (query: string) => {
		const media = originalMatchMedia.call(window, query);
		Object.defineProperty(media, "matches", { value: width >= 1024 });
		return media;
	};
}
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { ConditionChips } = await import(".");

beforeEach(async () => {
	viewport(1280);
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
	twoMessages();
});
afterEach(async () => {
	forgetListMemory();
	await settled();
	process.env = { ...savedEnv };
	cleanup();
	globalThis.fetch = originalFetch;
	window.matchMedia = originalMatchMedia;
});

// The stand-ins of the panel go back in place for the files that run after
// this one.
afterAll(() => {
	installNextIntlMocks();
});

const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000a2";
const char = (code: number) => String.fromCodePoint(code);

/** The server as it is: two messages that a search finds. */
function twoMessages() {
	return stubJmap({
		"Email/query": { ids: [A, B] },
		"Email/get": {
			list: [
				emailFixture({ id: A, subject: "Hello" }),
				emailFixture({ id: B, subject: "Hello" }),
			],
		},
	});
}

/** The chips over the results, with what narrows the list. */
function withConditions(conditions: Partial<typeof EMPTY_CONDITIONS> = {}) {
	return withQuery(
		// biome-ignore lint/a11y/useValidAriaRole: this is the folder's role, not an ARIA role.
		<ConditionChips
			box="INBOX"
			role="inbox"
			page={1}
			conditions={{ ...EMPTY_CONDITIONS, ...conditions }}
		/>,
	);
}

/** The chips over the results, with what narrows the list. */
function chips(conditions: Partial<typeof EMPTY_CONDITIONS> = {}) {
	return render(withConditions(conditions));
}

/** The field of the search, which the focus goes to when no chip is left. */
function searchField() {
	const field = document.createElement("input");
	field.id = SEARCH_FIELD_ID;
	document.body.append(field);
	return field;
}

/** The chip of a condition, by the badge that holds it. */
const badge = (container: HTMLElement, name: string) =>
	Array.from(container.querySelectorAll('[data-slot="badge"]')).find((chip) =>
		(chip.textContent ?? "").includes(name),
	);

describe("the chips of the active conditions", () => {
	it("are one per condition that narrows the list, and none for the order", () => {
		const { container } = chips({
			q: "invoice",
			unread: true,
			order: "oldest",
		});

		// The order says where a message shows, not whether it does.
		expect(container.querySelectorAll('[data-slot="badge"]')).toHaveLength(
			2,
		);
	});

	it("say the condition and the value it holds", () => {
		const { container } = chips({ q: "invoice", from: "ana" });

		expect(badge(container, "searchWords")).toHaveTextContent(
			"searchWords: invoice",
		);
		expect(badge(container, "from")).toHaveTextContent("from: ana");
	});

	it("take a bidi override out of the words they show", () => {
		const { container } = chips({ q: `invoice${char(0x202e)}receipt` });

		const chip = badge(container, "searchWords");
		expect(chip).toHaveTextContent("searchWords: invoicereceipt");
		expect(chip?.textContent).not.toContain(char(0x202e));
	});

	it("are in a navigation of their own, named", () => {
		chips({ q: "invoice" });

		expect(
			screen.getByRole("navigation", { name: "conditionsLabel" }),
		).toBeInTheDocument();
	});

	it("can each be taken off, with the keyboard", () => {
		const { container } = chips({ q: "invoice", unread: true });

		const removes = Array.from(
			container.querySelectorAll('[data-slot="badge"] a'),
		) as HTMLElement[];
		expect(removes).toHaveLength(2);
		for (const remove of removes) {
			// A link, so the keyboard reaches it and Enter follows it.
			expect(remove.tagName).toBe("A");
			expect(remove.getAttribute("href")).toBeTruthy();
			expect(remove.getAttribute("aria-label")).toBeTruthy();
			remove.focus();
			expect(document.activeElement).toBe(remove);
		}
		// The chip of the words goes away, the other one stays.
		expect(removes[0]).toHaveAttribute("href", "/app/mail/inbox?unread=1");
		expect(removes[1]).toHaveAttribute("href", "/app/mail/inbox?q=invoice");
	});

	it("take the last condition off with the clean address", () => {
		const { container } = chips({ q: "invoice" });

		const remove = container.querySelector('[data-slot="badge"] a');
		expect(remove).toHaveAttribute("href", "/app/mail/inbox");
	});

	it("take every condition off with the one that clears them all", () => {
		const { container } = chips({ q: "invoice", unread: true });

		const clear = screen.getByRole("link", { name: "clearAll" });
		expect(clear).toHaveAttribute("href", "/app/mail/inbox");
		expect(container.querySelectorAll('[data-slot="badge"]')).toHaveLength(
			2,
		);
	});

	it("leave the way out of an empty list to the empty list itself", async () => {
		stubJmap({ "Email/query": { ids: [] }, "Email/get": { list: [] } });
		const { container } = chips({ q: "invoice" });

		// The empty list says how to get out of it, with the button that takes
		// every condition off: here it would be a second way to do the same.
		await waitFor(() => {
			expect(screen.queryByRole("link", { name: "clearAll" })).toBeNull();
		});
		expect(container.querySelectorAll('[data-slot="badge"]')).toHaveLength(
			1,
		);
	});

	it("say how many messages matched", async () => {
		chips({ q: "Hello" });

		const count = await waitFor(() => {
			const found = screen.getByText(/messageCount/);
			expect(found.textContent).toContain('"count":2');
			return found;
		});
		expect(count).toBeInTheDocument();
	});

	it("draw no chip when nothing narrows the list", () => {
		const { container } = chips();

		expect(container.innerHTML).toBe("");
		expect(screen.queryByRole("navigation")).toBeNull();
	});

	it("give the focus to the chip that took the place of the one that was taken off", () => {
		const { container, rerender } = chips({ q: "invoice", from: "ana" });
		const remove = container.querySelector(
			'[data-chip="q"]',
		) as HTMLElement;

		fireEvent.click(remove);

		// The chips are drawn again without the chip that was taken off.
		rerender(withConditions({ from: "ana" }));

		expect(document.activeElement).toBe(
			container.querySelector('[data-chip="from"]'),
		);
	});

	it("wait for the change of the address before giving the focus away", () => {
		const { container, rerender } = chips({ q: "invoice", from: "ana" });

		fireEvent.click(
			container.querySelector('[data-slot="badge"] a') as HTMLElement,
		);

		// The chips are drawn again with the chip still there: the change of
		// the address has not landed yet, and the focus is not given away.
		rerender(withConditions({ q: "invoice", from: "ana" }));

		expect(document.activeElement).toBe(document.body);
	});

	for (const width of [360, 768, 1024, 1280]) {
		for (const action of ["last", "all"] as const) {
			it(`restores focus after removing ${action} at ${width}px`, () => {
				viewport(width);
				render(
					<header>
						<div>
							<NarrowSearch label="search" closeLabel="close">
								<input
									id={SEARCH_FIELD_ID}
									type="search"
									aria-label="words"
								/>
							</NarrowSearch>
						</div>
					</header>,
				);
				const field = screen.getByLabelText("words");
				const opener = screen.getByRole("button", { name: "search" });
				if (width < 1024) {
					// happy-dom does not lay out Tailwind: model the browser's
					// refusal to focus an input in the closed narrow panel.
					field.focus = () => {};
				}
				const { container, rerender } = chips({ q: "invoice" });
				const remove =
					action === "all"
						? screen.getByRole("link", { name: "clearAll" })
						: (container.querySelector(
								'[data-chip="q"]',
							) as HTMLElement);
				remove.focus();
				fireEvent.click(remove);
				rerender(withConditions({}));
				expect(document.activeElement).toBe(
					width < 1024 ? opener : field,
				);
				expect(document.activeElement).not.toBe(document.body);
			});
		}
	}

	it("keeps focus in an open narrow search when the last chip leaves", () => {
		viewport(360);
		render(
			<header>
				<NarrowSearch label="search" closeLabel="close">
					<input
						id={SEARCH_FIELD_ID}
						type="search"
						aria-label="words"
					/>
				</NarrowSearch>
			</header>,
		);
		fireEvent.click(screen.getByRole("button", { name: "search" }));
		const { container, rerender } = chips({ q: "invoice" });
		fireEvent.click(
			container.querySelector('[data-chip="q"]') as HTMLElement,
		);
		rerender(withConditions({}));
		expect(document.activeElement).toBe(screen.getByLabelText("words"));
	});

	it("give the focus to the search field when the last chip is taken off", () => {
		const { container, rerender } = chips({ q: "invoice" });
		const field = searchField();

		fireEvent.click(
			container.querySelector('[data-chip="q"]') as HTMLElement,
		);

		rerender(withConditions({}));

		expect(document.activeElement).toBe(field);
		field.remove();
	});

	it("give the focus to the search field when every condition is taken off", () => {
		const { rerender } = chips({ q: "invoice", unread: true });
		const field = searchField();

		fireEvent.click(screen.getByRole("link", { name: "clearAll" }));

		rerender(withConditions({}));

		expect(document.activeElement).toBe(field);
		field.remove();
	});
});
