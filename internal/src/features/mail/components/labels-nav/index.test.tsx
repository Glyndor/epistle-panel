import { afterEach, describe, expect, it, mock } from "bun:test";
import type { QueryClient } from "@tanstack/react-query";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";

import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { LABEL_TONES } from "@/features/mail/labels/label-tone";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import type {
	LabelView,
	MailboxView,
	MessageListView,
} from "@/features/mail/schemas/mail-view";
import { summary } from "@/features/mail/test-support/fixtures";
import { testQueryClient, withQuery } from "@/test/query-wrapper";

let pathname = "/app/mail/inbox";
let search = "";
mock.module("next/navigation", () => ({
	usePathname: () => pathname,
	useSearchParams: () => new URLSearchParams(search),
}));

const { LabelsNav } = await import(".");

afterEach(() => {
	cleanup();
	pathname = "/app/mail/inbox";
	search = "";
});

const label = (
	keyword: string,
	name = keyword,
	tone: LabelView["tone"] = 1,
): LabelView => ({ keyword, name, tone });

const list = (
	items: { id: string; labels: LabelView[] }[],
): MessageListView => ({
	items: items.map((item) => summary(item)),
	page: 1,
	total: items.length,
	hasNext: false,
	partial: false,
	today: "2026-11-15",
});

const FOLDERS: MailboxView[] = [
	{
		id: "INBOX",
		name: "INBOX",
		role: "inbox",
		parentId: null,
		depth: 0,
		unread: 0,
		total: 0,
	},
	{
		id: "Work",
		name: "Work",
		role: null,
		parentId: null,
		depth: 0,
		unread: 0,
		total: 0,
	},
];

function fill(client: QueryClient, items: Parameters<typeof list>[0]) {
	client.setQueryData(
		mailKeys.list("INBOX", 1, EMPTY_CONDITIONS),
		list(items),
	);
	client.setQueryData(mailKeys.mailboxes, FOLDERS);
}

function renderNav(
	items: Parameters<typeof list>[0] | null,
	{ open = true, closed = false } = {},
) {
	const client = testQueryClient();
	if (items !== null) {
		fill(client, items);
	}
	const view = render(
		withQuery(
			<SidebarProvider
				defaultOpen={open}
				defaultClosedGroups={closed ? ["labels"] : []}
			>
				<LabelsNav />
			</SidebarProvider>,
			client,
		),
	);
	return { client, ...view };
}

const WORK = label("Work");
const TODO = label("To_20do", "To do", 4);

describe("LabelsNav", () => {
	it("draws nothing while the browser has loaded no label", () => {
		renderNav(null);

		expect(screen.queryByRole("navigation")).toBeNull();
		expect(document.querySelector("[data-slot='labels-nav']")).toBeNull();
	});

	it("draws nothing when the messages loaded carry no label", () => {
		renderNav([{ id: "a", labels: [] }]);

		expect(screen.queryByRole("navigation")).toBeNull();
		expect(document.querySelector("[data-slot='labels-nav']")).toBeNull();
	});

	it("is a named navigation under a heading that says the labels are the recent ones", () => {
		renderNav([{ id: "a", labels: [WORK] }]);

		const nav = screen.getByRole("navigation", { name: "labelsNav" });
		expect(nav).toBeInTheDocument();
		const heading = screen.getByRole("button", { name: "labelsNav" });
		expect(heading).toHaveAttribute("aria-expanded", "true");
		expect(nav).toContainElement(heading);
	});

	it("links each label to the messages of the folder that carry it, by name", () => {
		renderNav([
			{ id: "a", labels: [WORK, TODO] },
			{ id: "b", labels: [WORK] },
		]);

		const links = screen.getAllByRole("link");
		expect(links.map((link) => link.textContent)).toEqual([
			"To do",
			"Work",
		]);
		expect(screen.getByRole("link", { name: "To do" })).toHaveAttribute(
			"href",
			"/app/mail/inbox?label=To_20do",
		);
		expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute(
			"href",
			"/app/mail/inbox?label=Work",
		);
	});

	it("opens the labels in the folder the person is in", () => {
		pathname = "/app/mail/folder/Work";
		renderNav([{ id: "a", labels: [WORK] }]);

		expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute(
			"href",
			"/app/mail/folder/Work?label=Work",
		);
	});

	it("opens the labels in the inbox from the composer, and marks none", () => {
		pathname = "/app/mail/compose";
		search = "label=Work";
		renderNav([{ id: "a", labels: [WORK] }]);

		const link = screen.getByRole("link", { name: "Work" });
		expect(link).toHaveAttribute("href", "/app/mail/inbox?label=Work");
		expect(link).not.toHaveAttribute("aria-current");
	});

	it("marks the label the list is narrowed by, whichever way the address spells it", () => {
		search = "label=work";
		renderNav([{ id: "a", labels: [WORK, TODO] }]);

		expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute(
			"aria-current",
			"page",
		);
		expect(screen.getByRole("link", { name: "To do" })).not.toHaveAttribute(
			"aria-current",
		);
	});

	it("marks none when the list is not narrowed by a label", () => {
		renderNav([{ id: "a", labels: [WORK] }]);

		expect(screen.getByRole("link", { name: "Work" })).not.toHaveAttribute(
			"aria-current",
		);
	});

	it("gives every label a dot of its tone that assistive technology skips", () => {
		const labels = Array.from({ length: LABEL_TONES }, (_, n) =>
			label(`L${n + 1}`, `L${n + 1}`, (n + 1) as LabelView["tone"]),
		);
		renderNav([{ id: "a", labels }]);

		for (const [index, link] of screen.getAllByRole("link").entries()) {
			const dot = link.querySelector("svg");
			expect(dot).toHaveAttribute("aria-hidden", "true");
			expect(dot).toHaveClass(`fill-label-${index + 1}`);
			expect(dot).toHaveClass("forced-color-adjust-none");
		}
	});

	it("keeps a name as the message wrote it: isolated, never reordering what is beside it", () => {
		const hostile = label("exe_E2_80_AEgpj", "exe‮gpj");
		renderNav([{ id: "a", labels: [hostile] }]);

		const link = screen.getByRole("link");
		const name = link.querySelector("bdi");
		expect(name).toHaveTextContent("exe‮gpj");
		expect(name?.parentElement).toHaveClass("truncate", "min-w-0");
	});

	it("describes the list for assistive technology in a sentence", () => {
		renderNav([{ id: "a", labels: [WORK] }]);

		const hint = screen.getByText("labelsNavHint");
		expect(hint).toHaveClass("sr-only");
		expect(screen.getByRole("list")).toHaveAttribute(
			"aria-describedby",
			hint.id,
		);
	});

	it("opens and closes under its heading, and says which it is", () => {
		renderNav([{ id: "a", labels: [WORK] }]);
		const heading = screen.getByRole("button", { name: "labelsNav" });

		fireEvent.click(heading);
		expect(heading).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("link", { name: "Work" })).toBeNull();

		fireEvent.click(heading);
		expect(heading).toHaveAttribute("aria-expanded", "true");
		expect(screen.getByRole("link", { name: "Work" })).toBeInTheDocument();
	});

	it("starts closed when the group was left closed, with only the current label drawn", () => {
		search = "label=Work";
		renderNav([{ id: "a", labels: [WORK, TODO] }], { closed: true });

		expect(
			screen.getByRole("button", { name: "labelsNav" }),
		).toHaveAttribute("aria-expanded", "false");
		const links = screen.getAllByRole("link");
		expect(links.map((link) => link.textContent)).toEqual(["Work"]);
		expect(links[0]).toHaveAttribute("aria-current", "page");
	});

	it("draws no entry while closed and no label is current", () => {
		renderNav([{ id: "a", labels: [WORK] }], { closed: true });

		expect(screen.queryAllByRole("link")).toHaveLength(0);
	});

	it("follows the lists the browser loads: a label appears when a page with it arrives", () => {
		const { client } = renderNav(null);
		expect(screen.queryByRole("navigation")).toBeNull();

		act(() => {
			fill(client, [{ id: "a", labels: [WORK] }]);
		});

		expect(screen.getByRole("link", { name: "Work" })).toBeInTheDocument();

		act(() => {
			fill(client, [{ id: "a", labels: [] }]);
		});

		expect(screen.queryByRole("navigation")).toBeNull();
	});

	it("names a label in a tooltip while the rail is collapsed to icons", () => {
		renderNav([{ id: "a", labels: [WORK] }], { open: false });

		fireEvent.pointerEnter(screen.getByRole("link", { name: "Work" }));

		expect(
			document.querySelector("[data-slot='sidebar-tooltip']"),
		).toHaveTextContent("Work");
	});
});
