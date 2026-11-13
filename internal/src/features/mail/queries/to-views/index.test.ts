import { describe, expect, it } from "bun:test";

import { toAddresses, toMailboxTree, toSummary } from ".";

const box = (id: string, extra: Record<string, unknown> = {}) => ({
	id,
	name: id,
	totalEmails: 0,
	unreadEmails: 0,
	...extra,
});

describe("toAddresses", () => {
	it("makes names and addresses safe and drops an entry with no address", () => {
		expect(
			toAddresses([
				{ name: "Ana‮\r\nBcc: x", email: "ana@example.org" },
				{ name: null, email: "bo@example.org" },
				{ name: "No address", email: " \u0000 " },
				{ name: "  ", email: "cy@example.org" },
			]),
		).toEqual([
			{ name: "Ana Bcc: x", email: "ana@example.org" },
			{ name: null, email: "bo@example.org" },
			{ name: null, email: "cy@example.org" },
		]);
		expect(toAddresses(null)).toEqual([]);
		expect(toAddresses(undefined)).toEqual([]);
	});
});

describe("toSummary", () => {
	it("reads the keywords and cleans every text", () => {
		const summary = toSummary({
			id: "i",
			receivedAt: "2026-11-12T10:00:00Z",
			subject: "Hi‮txt.exe\r\nX: y",
			from: [{ name: "A", email: "a@example.org" }],
			preview: "p\u0000q",
			keywords: {
				$seen: true,
				$flagged: true,
				$answered: true,
				$draft: true,
			},
			hasAttachment: true,
		});
		expect(summary).toEqual({
			id: "i",
			from: { name: "A", email: "a@example.org" },
			subject: "Hitxt.exe X: y",
			receivedAt: "2026-11-12T10:00:00Z",
			preview: "p q",
			unread: false,
			flagged: true,
			answered: true,
			draft: true,
			hasAttachment: true,
		});
	});

	it("treats a message with no keywords as unread and a missing sender as none", () => {
		const summary = toSummary({ id: "i", receivedAt: "x", subject: null });
		expect(summary.unread).toBe(true);
		expect(summary.from).toBeNull();
		expect(summary.subject).toBe("");
		expect(summary.hasAttachment).toBe(false);
	});
});

describe("toMailboxTree", () => {
	it("puts the system folders first in their order, then the rest by name, children under parents", () => {
		const tree = toMailboxTree([
			box("Zeta"),
			box("Trash", { role: "trash" }),
			box("Work/Q4", { name: "Q4", parentId: "Work" }),
			box("Work"),
			box("INBOX", { role: "inbox", unreadEmails: 3, totalEmails: 9 }),
			box("Sent", { role: "sent" }),
			box("Alpha"),
		]);
		expect(tree.map((m) => [m.id, m.depth])).toEqual([
			["INBOX", 0],
			["Sent", 0],
			["Trash", 0],
			["Alpha", 0],
			["Work", 0],
			["Work/Q4", 1],
			["Zeta", 0],
		]);
		expect(tree[0]).toMatchObject({ role: "inbox", unread: 3, total: 9 });
		expect(tree.find((m) => m.id === "Work/Q4")?.parentId).toBe("Work");
	});

	it("keeps a mailbox whose parent is missing at the top, and never loses one in a cycle", () => {
		const orphan = toMailboxTree([box("Child", { parentId: "Gone" })]);
		expect(orphan).toEqual([
			expect.objectContaining({ id: "Child", depth: 0, parentId: null }),
		]);
		const cycle = toMailboxTree([
			box("A", { parentId: "B" }),
			box("B", { parentId: "A" }),
			box("Self", { parentId: "Self" }),
		]);
		expect(cycle.map((m) => m.id).sort()).toEqual(["A", "B", "Self"]);
	});

	it("ignores a role it does not know and falls back to the id for an empty name", () => {
		const [view] = toMailboxTree([box("X", { name: "‮", role: "weird" })]);
		expect(view).toMatchObject({ name: "X", role: null });
	});
});
