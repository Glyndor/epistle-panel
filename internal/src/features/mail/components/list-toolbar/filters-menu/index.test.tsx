import { afterAll, afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { parseListConditions } from "@/features/mail/schemas/list-conditions";
import {
	EMPTY_CONDITIONS,
	type ListConditions,
} from "@/features/mail/schemas/list-conditions-model";
import { registerStandIn } from "@/test/next-intl";
import { navigationStandIn } from "@/test/next-navigation";

/** The addresses the menu wrote. */
const pushed: string[] = [];

mock.module("next/navigation", () => ({
	useRouter: () => ({
		push: (href: string) => {
			pushed.push(href);
		},
		replace: () => {},
		refresh: () => {},
	}),
}));

const { FiltersMenu } = await import(".");

afterEach(() => {
	cleanup();
	pushed.length = 0;
});

// The router of the menu is this file's own: the stand-in goes back in place
// so the files that run after this one find the panel's own.
afterAll(() => {
	registerStandIn("next/navigation", navigationStandIn);
});

/** The menu of the filters and the order, in the page's main. */
function menu(conditions: Partial<ListConditions> = {}) {
	return render(
		<main id="main-content">
			{/* biome-ignore lint/a11y/useValidAriaRole: this is the folder's role, not an ARIA role. */}
			<FiltersMenu
				box="INBOX"
				role="inbox"
				conditions={{ ...EMPTY_CONDITIONS, ...conditions }}
			/>
		</main>,
	);
}

/** The button that opens the menu. */
const trigger = () => screen.getByRole("button", { name: /filters/ });

/** Open the menu with the keyboard, the way a person does. */
async function open() {
	fireEvent.keyDown(trigger(), { key: "Enter" });
	await screen.findByRole("menu");
}

/** The tick of a quick filter. */
async function tick(name: string) {
	return screen.findByRole("menuitemcheckbox", { name });
}

describe("the menu of the filters and the order", () => {
	it("says how many of the filters are on", () => {
		menu({ unread: true, starred: true });

		expect(trigger()).toHaveTextContent("2");
		// With none on, the button says only what it is.
		cleanup();
		menu();
		expect(trigger()).toHaveTextContent("filters");
		expect(trigger().textContent).not.toContain("1");
	});

	it("marks the filters that are on, and only those", async () => {
		menu({ starred: true });
		await open();

		expect(await tick("filterUnread")).toHaveAttribute(
			"aria-checked",
			"false",
		);
		expect(await tick("filterFlagged")).toHaveAttribute(
			"aria-checked",
			"true",
		);
		expect(await tick("filterImportant")).toHaveAttribute(
			"aria-checked",
			"false",
		);
		expect(await tick("filterAttachments")).toHaveAttribute(
			"aria-checked",
			"false",
		);
	});

	it("writes the address of a filter that is turned on", async () => {
		menu();
		await open();

		fireEvent.click(await tick("filterUnread"));

		expect(pushed).toEqual(["/app/mail/inbox?unread=1"]);
	});

	it("writes the address of a filter that is turned off", async () => {
		menu({ unread: true });
		await open();

		fireEvent.click(await tick("filterUnread"));

		expect(pushed).toEqual(["/app/mail/inbox"]);
	});

	it("keeps the other conditions when a filter is turned on", async () => {
		menu({ q: "invoice" });
		await open();

		fireEvent.click(await tick("filterAttachments"));

		expect(pushed).toEqual(["/app/mail/inbox?q=invoice&attachment=1"]);
	});

	it("offers the three orders and marks the one that is on", async () => {
		menu({ order: "oldest" });
		await open();

		const orders = await screen.findAllByRole("menuitemradio");
		expect(orders.map((item) => item.textContent)).toEqual([
			"orderNewest",
			"orderOldest",
			"orderLargest",
		]);
		expect(orders.map((item) => item.getAttribute("aria-checked"))).toEqual(
			["false", "true", "false"],
		);
	});

	it("writes the address of the order that is chosen", async () => {
		menu();
		await open();

		fireEvent.click(
			await screen.findByRole("menuitemradio", { name: "orderLargest" }),
		);

		expect(pushed).toEqual(["/app/mail/inbox?order=largest"]);
	});

	it("keeps the other conditions when the order is chosen", async () => {
		menu({ q: "invoice", unread: true });
		await open();

		fireEvent.click(
			await screen.findByRole("menuitemradio", { name: "orderOldest" }),
		);

		expect(pushed).toEqual([
			"/app/mail/inbox?q=invoice&unread=1&order=oldest",
		]);
	});

	it("takes every filter off with the action that shows all", async () => {
		menu({ unread: true, starred: true });
		await open();

		fireEvent.click(
			await screen.findByRole("menuitem", { name: "showAll" }),
		);

		expect(pushed).toEqual(["/app/mail/inbox"]);
	});

	it("dims the action that shows all when there is no filter on", async () => {
		menu();
		await open();

		const showAll = await screen.findByRole("menuitem", {
			name: "showAll",
		});
		expect(showAll).toHaveAttribute("aria-disabled", "true");
	});

	it("is reached and used with the keyboard alone", async () => {
		menu();
		await open();

		// The tick is a menu item: the keyboard moves to it and Enter picks
		// it, the way it does with the pointer.
		const unread = await tick("filterUnread");
		unread.focus();
		expect(document.activeElement).toBe(unread);
		fireEvent.keyDown(unread, { key: "Enter" });

		expect(pushed).toEqual(["/app/mail/inbox?unread=1"]);
	});

	it("is drawn inside the page's main, not on the body", async () => {
		menu();
		await open();

		const content = await screen.findByRole("menu");
		expect(screen.getByRole("main")).toContainElement(content);
		expect(document.body).not.toBe(content.parentElement);
	});

	it("shows the filter of the address from before as a tick of its own", async () => {
		// A link from before says `filter=flagged`: the panel reads it as the
		// quick filter it named.
		const { conditions } = parseListConditions({ filter: "flagged" });
		menu(conditions);
		await open();

		expect(await tick("filterFlagged")).toHaveAttribute(
			"aria-checked",
			"true",
		);
	});
});
