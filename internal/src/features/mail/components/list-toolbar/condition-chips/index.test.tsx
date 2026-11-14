import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

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
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { ConditionChips } = await import(".");

beforeEach(async () => {
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
});

// The stand-ins of the panel go back in place for the files that run after
// this one.
afterAll(() => {
	installNextIntlMocks();
});

const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000a2";

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
function chips(conditions: Partial<typeof EMPTY_CONDITIONS> = {}) {
	return render(
		withQuery(
			// biome-ignore lint/a11y/useValidAriaRole: this is the folder's role, not an ARIA role.
			<ConditionChips
				box="INBOX"
				role="inbox"
				page={1}
				conditions={{ ...EMPTY_CONDITIONS, ...conditions }}
			/>,
		),
	);
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
});
