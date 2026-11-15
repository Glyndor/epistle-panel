import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { SidebarProvider } from "@/components/ui/sidebar/provider";
import type { MailboxView } from "@/features/mail/schemas/mail-view";

let pathname = "/app/mail";
mock.module("next/navigation", () => ({ usePathname: () => pathname }));

const { FolderTree } = await import(".");

afterEach(() => {
	cleanup();
	pathname = "/app/mail";
	window.innerWidth = 1024;
});

const box = (over: Partial<MailboxView>): MailboxView => ({
	id: "X",
	name: "X",
	role: null,
	parentId: null,
	depth: 0,
	unread: 0,
	total: 0,
	...over,
});

function renderTree(list: readonly MailboxView[], open = true) {
	return render(
		<SidebarProvider defaultOpen={open}>
			<FolderTree boxes={list} />
		</SidebarProvider>,
	);
}

const current = () =>
	screen
		.getAllByRole("link")
		.filter((link) => link.getAttribute("aria-current") === "page");

describe("FolderTree", () => {
	const boxes = [
		box({ id: "INBOX", name: "INBOX", role: "inbox", unread: 3 }),
		box({ id: "Sent", name: "Sent", role: "sent" }),
		box({ id: "Work", name: "Work‮" }),
		box({ id: "Work/Q4", name: "Q4", depth: 1, parentId: "Work" }),
		box({ id: "Deep", name: "Deep", depth: 9 }),
	];

	it("is a named navigation with one link per mailbox, system folders named by role", () => {
		renderTree(boxes);
		const nav = screen.getByRole("navigation", { name: "folders" });
		expect(nav).toBeInTheDocument();
		expect(screen.getAllByRole("link")).toHaveLength(5);
		expect(
			screen.getByRole("link", { name: /role_inbox/ }),
		).toHaveAttribute("href", "/app/mail/inbox");
		expect(screen.getByRole("link", { name: /role_sent/ })).toHaveAttribute(
			"href",
			"/app/mail/sent",
		);
		expect(screen.getByRole("link", { name: "Q4" })).toHaveAttribute(
			"href",
			"/app/mail/folder/Work_2FQ4",
		);
		expect(screen.getByText("role_sent")).toBeInTheDocument();
		expect(screen.getByText("Q4")).toBeInTheDocument();
	});

	it("gives every folder an icon that assistive tech skips", () => {
		const { container } = renderTree(boxes);

		expect(
			container.querySelectorAll("a > svg[aria-hidden='true']"),
		).toHaveLength(5);
	});

	it("keeps a folder's own name apart from the direction of the text around it", () => {
		renderTree(boxes);

		expect(screen.getByText("Q4").tagName).toBe("BDI");
	});

	it("marks the folder the address shows, and no other", () => {
		for (const [path, name] of [
			["/app/mail", "role_inbox"],
			["/app/mail/inbox", "role_inbox"],
			["/app/mail/sent", "role_sent"],
			[
				"/app/mail/sent/0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b",
				"role_sent",
			],
			["/app/mail/folder/Work_2FQ4", "Q4"],
			[
				"/app/mail/folder/Work_2FQ4/0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b",
				"Q4",
			],
		] as const) {
			pathname = path;
			renderTree(boxes);
			expect([path, current().map((link) => link.textContent)]).toEqual([
				path,
				[expect.stringContaining(name)],
			]);
			cleanup();
		}
	});

	it("marks no folder on a page that is none, or for a role the account has no folder of", () => {
		for (const path of [
			"/app/mail/compose",
			"/app/mail/trash",
			"/app/mail/folder/Nowhere",
			"/app/elsewhere",
		]) {
			pathname = path;
			renderTree(boxes);
			expect([path, current()]).toEqual([path, []]);
			cleanup();
		}
	});

	it("spells the unread count for assistive technology and only when there is one", () => {
		renderTree(boxes);
		expect(screen.getAllByText("unreadCount")).toHaveLength(1);
	});

	it("draws the unread count with the panel's badge, at the size the pill always had", () => {
		renderTree(boxes);
		const pill = screen
			.getByText("unreadCount")
			.closest("[data-slot=badge]");
		expect(pill).not.toBeNull();
		// The pill keeps its old geometry: two units of padding, no vertical
		// padding, a regular weight; the badge's own defaults must not leak in.
		expect(pill).toHaveClass("px-2", "py-0", "font-normal", "bg-primary");
		expect(pill).not.toHaveClass("px-2.5", "py-0.5", "font-medium");
		// The number is drawn for the eye and the translated text is spoken.
		expect(pill?.querySelector("[aria-hidden=true]")?.textContent).toBe(
			"3",
		);
	});

	it("writes a mailbox id into one segment of the link", () => {
		renderTree([box({ id: "A&b/c d", name: "A" })]);
		expect(screen.getByRole("link")).toHaveAttribute(
			"href",
			"/app/mail/folder/A_26b_2Fc_20d",
		);
	});

	it("addresses by role only the first folder with that role", () => {
		renderTree([
			box({ id: "Sent", name: "Sent", role: "sent" }),
			box({ id: "Sent Items", name: "Sent Items", role: "sent" }),
		]);
		const links = screen.getAllByRole("link");
		expect(links[0]).toHaveAttribute("href", "/app/mail/sent");
		// The role's path would open the first one: the second keeps a path of its own.
		expect(links[1]).toHaveAttribute(
			"href",
			"/app/mail/folder/Sent_20Items",
		);
	});

	it("opens and closes under its heading, which says which it is", () => {
		renderTree(boxes);
		const heading = screen.getByRole("button", { name: "folders" });
		expect(heading).toHaveAttribute("aria-expanded", "true");

		fireEvent.click(heading);

		expect(heading).toHaveAttribute("aria-expanded", "false");
		// The inbox is the folder the address shows: it alone stays.
		expect(screen.queryAllByRole("link")).toHaveLength(1);
		expect(current()).toHaveLength(1);
	});

	it("indents a nested folder by a class, up to the deepest level it has one for", () => {
		renderTree(boxes);

		expect(screen.getByRole("link", { name: "Q4" })).toHaveClass("pl-5");
		expect(screen.getByRole("link", { name: "Deep" })).toHaveClass("pl-14");
		expect(
			screen.getByRole("link", { name: /role_inbox/ }).className,
		).not.toMatch(/(^|\s)pl-\d/);
	});

	it("collapsed to icons, names a folder in a tooltip, with what is unread", () => {
		// The composer is open: no folder is the current one.
		pathname = "/app/mail/compose";
		renderTree(boxes, false);
		const tip = () =>
			document.querySelector("[data-slot='sidebar-tooltip']");

		fireEvent.pointerEnter(screen.getByRole("link", { name: /role_sent/ }));
		expect(tip()).toHaveTextContent("role_sent");
		fireEvent.keyDown(screen.getByRole("link", { name: /role_sent/ }), {
			key: "Escape",
		});

		fireEvent.pointerEnter(
			screen.getByRole("link", { name: /role_inbox/ }),
		);
		expect(tip()).toHaveTextContent("folderWithUnread");
		// The tree has no room on the rail: every folder sits in one column.
		expect(screen.getByRole("link", { name: "Q4" })).toHaveClass(
			"group-data-[collapsible=icon]:pl-0",
		);
	});

	it("collapsed to icons, marks the open folder by more than its fill, and says so in its tooltip", () => {
		pathname = "/app/mail/sent";
		renderTree(boxes, false);
		const tip = () =>
			document.querySelector("[data-slot='sidebar-tooltip']");
		const open = screen.getByRole("link", { name: /role_sent/ });

		// A mark on its starting edge, drawn only on the rail and only for
		// the current entry: a fill alone is a colour.
		expect(open).toHaveAttribute("data-active", "true");
		expect(open).toHaveClass(
			"relative",
			"before:absolute",
			"before:start-0",
			"before:hidden",
			"before:bg-sidebar-foreground",
			"group-data-[collapsible=icon]:data-[active=true]:before:block",
		);
		fireEvent.pointerEnter(open);
		expect(tip()).toHaveTextContent("currentEntry");
		fireEvent.keyDown(open, { key: "Escape" });

		fireEvent.pointerEnter(screen.getByRole("link", { name: "Q4" }));
		expect(tip()).toHaveTextContent("Q4");
		expect(tip()).not.toHaveTextContent("currentEntry");
	});

	it("is served with its folders and no style attribute", () => {
		// What the policy refuses is a style in the served page. Once in the
		// browser the open group gets its size from script, which it allows.
		const html = renderToString(
			<SidebarProvider>
				<FolderTree boxes={boxes} />
			</SidebarProvider>,
		);

		expect(html).toContain('href="/app/mail/folder/Work_2FQ4"');
		expect(html).not.toContain("style=");
		expect(html).not.toContain("<style");
	});
	it("left closed, still draws the folder that is open, once, and no other", () => {
		pathname = "/app/mail/sent";
		render(
			<SidebarProvider defaultClosedGroups={["folders"]}>
				<FolderTree boxes={boxes} />
			</SidebarProvider>,
		);

		expect(screen.getByRole("button", { name: "folders" })).toHaveAttribute(
			"aria-expanded",
			"false",
		);
		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(1);
		expect(links[0]).toHaveAttribute("href", "/app/mail/sent");
		expect(links[0]).toHaveAttribute("aria-current", "page");

		// Opened, every folder is back and the open one is not repeated.
		fireEvent.click(screen.getByRole("button", { name: "folders" }));
		expect(screen.getAllByRole("link")).toHaveLength(5);
		expect(current()).toHaveLength(1);
	});

	it("left closed on a page that is no folder, draws its heading alone", () => {
		pathname = "/app/mail/compose";
		render(
			<SidebarProvider defaultClosedGroups={["folders"]}>
				<FolderTree boxes={boxes} />
			</SidebarProvider>,
		);

		expect(screen.queryAllByRole("link")).toHaveLength(0);
		expect(screen.getByRole("button", { name: "folders" })).toHaveAttribute(
			"aria-expanded",
			"false",
		);
	});
});
