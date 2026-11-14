import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import type { MessageSummary } from "@/features/mail/schemas/mail-view";
import { withQuery } from "@/test/query-wrapper";
import { summary } from "../../test-support/fixtures";

import { MessageRow } from ".";

afterEach(cleanup);

const ID = "00000000-0000-4000-8000-0000000000b1";
const view = {
	box: "INBOX",
	role: "inbox",
	page: 2,
	filter: "unread",
	q: "x",
} as const;
const EVERYTHING = {
	unread: true,
	flagged: true,
	important: true,
	answered: true,
	forwarded: true,
	draft: true,
	hasAttachment: true,
	labels: [
		{ keyword: "Work", name: "Work", tone: 1 },
		{ keyword: "Home", name: "Home", tone: 2 },
	],
} as const satisfies Partial<MessageSummary>;

function row(m: MessageSummary, selected = false) {
	const view_ = render(
		withQuery(
			<ul>
				<MessageRow
					message={m}
					selected={selected}
					view={view}
					datePart="time"
				/>
			</ul>,
		),
	);
	const item = view_.container.querySelector("li");
	if (item === null) {
		throw new Error("no row");
	}
	return { ...view_, item, link: screen.getByRole("link") };
}
/** The classes of `element` that set a height, at any variant. */
const heights = (element: Element) =>
	element.className
		.split(/\s+/)
		.filter((name) => /(^|:)h-[\w./]+$/.test(name))
		.sort();

describe("MessageRow", () => {
	it("links to the message and keeps the list's own parameters", () => {
		const { link } = row(summary());

		expect(link).toHaveAttribute(
			"href",
			`/app/mail/inbox/${ID}?page=2&filter=unread&q=x`,
		);
		expect(link).toHaveAttribute("data-message-id", ID);
		expect(link).not.toHaveAttribute("aria-current");
		expect(screen.getByText("Hello")).toBeInTheDocument();
		expect(screen.getByText("preview")).toBeInTheDocument();
	});

	it("holds the link and then the two buttons as siblings, never one inside the other", () => {
		const { item, link, container } = row(summary());

		expect(container.querySelector("a button")).toBeNull();
		expect(container.querySelector("button a")).toBeNull();
		expect(link.parentElement).toBe(item);
		// The order of the page is the order of the keyboard: nothing sets a tabindex.
		const stops = Array.from(
			item.querySelectorAll<HTMLElement>("a, button"),
		);
		expect(stops.map((stop) => stop.tagName)).toEqual([
			"A",
			"BUTTON",
			"BUTTON",
		]);
		expect(stops.slice(1).map((stop) => stop.textContent)).toEqual([
			"markImportant",
			"star",
		]);
		expect(item.querySelector("[tabindex]")).toBeNull();
	});

	it("isolates each text of the message with bdi so it cannot reorder its neighbours", () => {
		const { link } = row(summary());

		// The initials are made of the sender's name, so they are text of the message too.
		expect(
			Array.from(link.querySelectorAll("bdi")).map((b) => b.textContent),
		).toEqual(["AP", "Ana Pérez", "Hello", "preview"]);
	});

	it("isolates each label's name in the sentence a screen reader hears", () => {
		const { link } = row(summary({ labels: EVERYTHING.labels }));
		const said = link.querySelector(".sr-only");

		expect(
			Array.from(said?.querySelectorAll("bdi") ?? []).map(
				(name) => name.textContent,
			),
		).toEqual(["Work", "Home"]);
		expect(said?.textContent).toBe("stateLabelsWork, Home.");
	});

	it("says every state once in words, in a fixed order", () => {
		const { link } = row(summary(EVERYTHING), true);

		expect(link.querySelector(".sr-only")?.textContent).toBe(
			"stateUnread, stateFlagged, stateImportant, stateAnswered, stateForwarded, stateDraft, hasAttachment, stateLabelsWork, Home.",
		);
		expect(link).toHaveAttribute("aria-current", "true");
	});

	it("has no state text for a read, plain message", () => {
		expect(row(summary()).link.querySelector(".sr-only")).toBeNull();
	});

	it("marks an unread message two ways that are not a colour: weight and a dot before the sender", () => {
		const { item, link } = row(summary({ unread: true }));
		const dot = link.querySelector('[data-slot="unread-dot"]');

		expect(screen.getByText("Ana Pérez")).toHaveClass("font-semibold");
		expect(screen.getByText("Hello")).toHaveClass("font-medium");
		expect(dot).toHaveClass("absolute", "start-2", "rounded-full");
		// Before the initials and the sender in the page too.
		expect(
			dot?.compareDocumentPosition(screen.getByText("Ana Pérez")),
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
		// It stands on the pane like a read one: the pane has one surface.
		expect(item.className).not.toMatch(/(^|\s)bg-/);
	});

	it("leaves a read message on the pane's surface, lighter and with no dot", () => {
		const { item, link } = row(summary());

		expect(item).not.toHaveClass("bg-surface");
		expect(item).not.toHaveClass("bg-accent");
		expect(link.querySelector('[data-slot="unread-dot"]')).toBeNull();
		expect(screen.getByText("Ana Pérez")).not.toHaveClass("font-semibold");
		expect(screen.getByText("Ana Pérez")).toHaveClass(
			"text-muted-foreground",
		);
	});

	it("hands the star and the important mark to their buttons", () => {
		row(summary({ flagged: true, important: true }));

		expect(screen.getByRole("button", { name: "unstar" })).toHaveAttribute(
			"data-set",
			"true",
		);
		expect(
			screen.getByRole("button", { name: "unmarkImportant" }),
		).toHaveAttribute("data-set", "true");
	});

	it("puts the answered and the forwarded icon before the subject", () => {
		const { link } = row(summary({ answered: true, forwarded: true }));
		const subject = screen.getByText("Hello");
		const line = subject.parentElement;

		expect(
			Array.from(line?.children ?? []).map(
				(child) => child.getAttribute("data-slot") ?? child.tagName,
			),
		).toEqual(["answered-icon", "forwarded-icon", "BDI"]);
		expect(
			link.querySelectorAll('svg[aria-hidden="true"]').length,
		).toBeGreaterThanOrEqual(2);
		cleanup();

		const plain = row(summary()).link;
		expect(plain.querySelector('[data-slot="answered-icon"]')).toBeNull();
		expect(plain.querySelector('[data-slot="forwarded-icon"]')).toBeNull();
	});

	it("writes the word for a draft before the name, once for the eye and once for the ear", () => {
		row(summary({ draft: true }));
		const sender = screen.getByText("Ana Pérez");
		const badge = sender.previousElementSibling;

		expect(badge).toHaveAttribute("data-slot", "badge");
		expect(badge?.textContent).toBe("stateDraft");
		expect(badge).toHaveAttribute("aria-hidden", "true");
		cleanup();

		row(summary());
		expect(screen.getByText("Ana Pérez").previousElementSibling).toBeNull();
	});

	it("puts the clip of an attachment beside the date", () => {
		const { link } = row(summary({ hasAttachment: true }));
		const time = link.querySelector("time");

		expect(time?.previousElementSibling).toHaveAttribute(
			"data-slot",
			"attachment-icon",
		);
		cleanup();
		expect(
			row(summary()).link.querySelector("time")?.previousElementSibling,
		).toBeNull();
	});

	it("puts the labels after the subject, on its line", () => {
		row(summary({ labels: EVERYTHING.labels }));

		expect(screen.getByText("Hello").nextElementSibling).toHaveAttribute(
			"data-slot",
			"label-chips",
		);
	});

	it("marks the open message with the accent surface and a mark at its start edge", () => {
		const { item, link } = row(summary({ unread: true }), true);

		expect(link).toHaveAttribute("aria-current", "true");
		expect(item).toHaveAttribute("data-open", "true");
		expect(item).toHaveClass(
			"bg-accent",
			"before:absolute",
			"before:bg-primary",
		);
		// No side is named by hand.
		expect(item.className).not.toMatch(/(^|[\s:])(left|right)-/);
	});

	it("draws the open row's mark inside the focus ring, so the ring keeps its start side", () => {
		const { item, link } = row(summary(), true);

		// The ring is the row's two outer pixels; the mark starts after them.
		expect(link).toHaveClass(
			"focus-visible:outline-2",
			"focus-visible:-outline-offset-2",
		);
		expect(item).toHaveClass("before:start-0.5", "before:w-1");
		expect(item).not.toHaveClass("before:start-0");
		expect(item).toHaveClass("before:pointer-events-none");
	});

	it("gives the open row a look of its own under the pointer and pressed", () => {
		const open = row(summary(), true);

		expect(open.item).toHaveClass(
			"hover:bg-accent/50",
			"active:bg-accent/25",
		);
		// Not the fills of any other row, which would be the open surface itself.
		expect(open.item).not.toHaveClass("hover:bg-muted");
		expect(open.item).not.toHaveClass("hover:bg-accent");
		expect(open.item).not.toHaveClass("active:bg-accent");
		expect(screen.getByText("Hello")).toHaveClass(
			"group-data-[open=true]/row:group-hover/row:underline",
		);
		cleanup();

		const closed = row(summary());
		expect(closed.item).toHaveAttribute("data-open", "false");
		expect(closed.item).toHaveClass("hover:bg-muted", "active:bg-accent");
	});

	it("keeps a least width for the subject in every case, and lets the sender give way first", () => {
		row(summary());
		const C = "group-data-[density=compact]/list:";

		expect(screen.getByText("Hello")).toHaveClass(
			"flex-1",
			"min-w-24",
			"pointer-fine:@sm/row:min-w-40",
			`${C}min-w-20`,
			`${C}@xs/row:min-w-24`,
			`${C}@sm/row:min-w-40`,
			`pointer-fine:${C}@sm/row:min-w-48`,
			`${C}@2xl/row:min-w-32`,
		);
		expect(screen.getByText("Hello")).not.toHaveClass("min-w-0");
		expect(screen.getByText("Ana Pérez")).toHaveClass(
			"min-w-12",
			"truncate",
		);
		// The clip and the date keep their width.
		expect(
			screen.getByText("Hello").closest("a")?.querySelector("time")
				?.parentElement,
		).toHaveClass("shrink-0");
	});

	it("hides the initials where the row is too narrow for them, by the row's own width", () => {
		const { link } = row(summary());
		const C = "group-data-[density=compact]/list:";

		expect(link.querySelector('[data-slot="avatar"]')).toHaveClass(
			"hidden",
			"@xs/row:flex",
			`${C}hidden`,
			`${C}@sm/row:flex`,
		);
	});

	it("keeps one height whatever the state: 72 px, and 40 or 44 px when compact", () => {
		const plain = row(summary());
		const expected = heights(plain.item);
		const lines = Array.from(plain.link.children).flatMap(heights);

		expect(expected).toEqual([
			"group-data-[density=compact]/list:h-10",
			"h-18",
			"pointer-coarse:group-data-[density=compact]/list:h-11",
		]);
		cleanup();

		for (const state of [
			{ unread: true },
			{ flagged: true, important: true },
			{ draft: true },
			{ labels: EVERYTHING.labels },
			EVERYTHING,
		] as const) {
			for (const selected of [false, true]) {
				const each = row(summary(state), selected);

				expect(heights(each.item)).toEqual(expected);
				// The lines inside are as tall with a badge, an icon or a chip.
				expect(Array.from(each.link.children).flatMap(heights)).toEqual(
					lines,
				);
				expect(each.item).not.toHaveClass("min-h-14");
				cleanup();
			}
		}
		expect(lines).toContain("h-5");
		expect(lines).toContain("h-4");
		expect(lines).toContain("group-data-[density=compact]/list:h-4");
	});

	it("raises the row under the pointer or with the focus one step, and no other", () => {
		const { item } = row(summary({ flagged: true }));

		expect(item).toHaveClass("relative", "hover:z-1", "focus-within:z-1");
		// At rest it has no layer: one step is under a date heading's ten.
		expect(
			item.className.split(/\s+/).filter((name) => /^z-/.test(name)),
		).toEqual([]);
	});

	it("falls back to the address, then to a placeholder, and to a placeholder for no subject", () => {
		row(
			summary({
				from: { name: null, email: "x@example.org" },
				subject: "",
			}),
		);
		expect(screen.getByText("x@example.org")).toBeInTheDocument();
		expect(screen.getByText("noSubject")).toBeInTheDocument();
		cleanup();

		row(summary({ from: null }));
		expect(screen.getByText("noSender")).toBeInTheDocument();
	});

	it("stands the sender's initials at the start of the row, as decoration", () => {
		const { link } = row(summary());
		const avatar = link.querySelector('[data-slot="avatar"]');

		expect(avatar).toHaveAttribute("aria-hidden", "true");
		expect(avatar?.textContent).toBe("AP");
		// A mark, not a control: the checkbox it may become is not built yet.
		expect(avatar?.closest("button")).toBeNull();
	});

	it("prints the part of the date it is asked for in a time element with the whole date", () => {
		const { link } = row(summary());
		const time = link.querySelector("time");

		expect(time).toHaveAttribute("dateTime", "2026-11-12T10:00:00Z");
		expect(time).toHaveAttribute("data-date-part", "time");
	});

	it("puts no style attribute in the page", () => {
		const { container } = row(summary(EVERYTHING), true);

		expect(container.querySelector("[style]")).toBeNull();
	});
});
