import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import type { MailboxView } from "@/features/mail/schemas/mail-view";

import { FolderTree } from ".";

afterEach(cleanup);

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

describe("FolderTree", () => {
	const boxes = [
		box({ id: "INBOX", name: "INBOX", role: "inbox", unread: 3 }),
		box({ id: "Sent", name: "Sent", role: "sent" }),
		box({ id: "Work", name: "Work‮" }),
		box({ id: "Work/Q4", name: "Q4", depth: 1, parentId: "Work" }),
		box({ id: "Deep", name: "Deep", depth: 9 }),
	];

	it("is a named navigation with one link per mailbox, system folders named by role", () => {
		render(<FolderTree boxes={boxes} activeId="INBOX" />);
		const nav = screen.getByRole("navigation", { name: "folders" });
		expect(nav).toBeInTheDocument();
		expect(screen.getAllByRole("link")).toHaveLength(5);
		expect(
			screen.getByRole("link", { name: /role_inbox/ }),
		).toHaveAttribute("href", "/app/mail?box=INBOX");
		expect(screen.getByText("role_sent")).toBeInTheDocument();
		expect(screen.getByText("Q4")).toBeInTheDocument();
	});

	it("marks the current folder and no other", () => {
		render(<FolderTree boxes={boxes} activeId="Sent" />);
		const current = screen
			.getAllByRole("link")
			.filter((link) => link.getAttribute("aria-current") === "page");
		expect(current).toHaveLength(1);
		expect(current[0]).toHaveTextContent("role_sent");
	});

	it("spells the unread count for assistive technology and only when there is one", () => {
		render(<FolderTree boxes={boxes} activeId="INBOX" />);
		expect(screen.getAllByText("unreadCount")).toHaveLength(1);
	});

	it("encodes a mailbox id in the link", () => {
		render(
			<FolderTree
				boxes={[box({ id: "A&b/c d", name: "A" })]}
				activeId=""
			/>,
		);
		expect(screen.getByRole("link")).toHaveAttribute(
			"href",
			"/app/mail?box=A%26b%2Fc+d",
		);
	});
});
