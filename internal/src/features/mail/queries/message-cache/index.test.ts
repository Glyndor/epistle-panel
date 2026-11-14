import { describe, expect, it } from "bun:test";

import { QueryClient } from "@tanstack/react-query";

import { mailKeys } from "../mail-query-keys";
import { isKeywordOp, patchFlags } from ".";

const summary = (id: string, unread: boolean, flagged = false) => ({
	id,
	from: null,
	subject: "s",
	receivedAt: "x",
	preview: "",
	unread,
	flagged,
	important: false,
	answered: false,
	draft: false,
	hasAttachment: false,
});
const detail = (id: string, unread: boolean) =>
	({
		id,
		unread,
		flagged: false,
		important: false,
		mailboxId: "INBOX",
	}) as never;
const box = (id: string, unread: number) =>
	({
		id,
		name: id,
		role: null,
		parentId: null,
		depth: 0,
		unread,
		total: 5,
	}) as never;

function seeded() {
	const client = new QueryClient();
	client.setQueryData(mailKeys.message("a"), detail("a", true));
	client.setQueryData(mailKeys.list("INBOX", 1, "all", ""), {
		items: [summary("a", true), summary("b", true)],
		page: 1,
		total: 2,
		hasNext: false,
		partial: false,
		today: "2026-11-13",
	});
	client.setQueryData(mailKeys.list("INBOX", 1, "unread", ""), {
		items: [summary("a", true)],
		page: 1,
		total: 1,
		hasNext: false,
		partial: false,
		today: "2026-11-13",
	});
	client.setQueryData(mailKeys.mailboxes, [box("INBOX", 3), box("Sent", 0)]);
	return client;
}
const rows = (client: QueryClient, key: readonly unknown[]) =>
	(
		client.getQueryData(key) as {
			items: Array<{ id: string; unread: boolean; flagged: boolean }>;
		}
	).items;

describe("isKeywordOp", () => {
	it("is true for the flag operations only", () => {
		for (const op of [
			"read",
			"unread",
			"star",
			"unstar",
			"important",
			"unimportant",
		] as const) {
			expect(isKeywordOp(op)).toBe(true);
		}
		for (const op of [
			"archive",
			"trash",
			"spam",
			"inbox",
			"move",
		] as const) {
			expect(isKeywordOp(op)).toBe(false);
		}
	});
});

describe("patchFlags", () => {
	it("marks the message, its row in every cached page and the folder counter at once", () => {
		const client = seeded();
		patchFlags(client, "a", "read", "INBOX");
		expect(
			(client.getQueryData(mailKeys.message("a")) as { unread: boolean })
				.unread,
		).toBe(false);
		expect(
			rows(client, mailKeys.list("INBOX", 1, "all", ""))[0]?.unread,
		).toBe(false);
		expect(
			rows(client, mailKeys.list("INBOX", 1, "all", ""))[1]?.unread,
		).toBe(true);
		expect(
			rows(client, mailKeys.list("INBOX", 1, "unread", ""))[0]?.unread,
		).toBe(false);
		expect(
			(
				client.getQueryData(mailKeys.mailboxes) as Array<{
					unread: number;
				}>
			)[0]?.unread,
		).toBe(2);
	});

	it("puts everything back when undone", () => {
		const client = seeded();
		const undo = patchFlags(client, "a", "read", "INBOX");
		undo();
		expect(
			(client.getQueryData(mailKeys.message("a")) as { unread: boolean })
				.unread,
		).toBe(true);
		expect(
			rows(client, mailKeys.list("INBOX", 1, "all", ""))[0]?.unread,
		).toBe(true);
		expect(
			(
				client.getQueryData(mailKeys.mailboxes) as Array<{
					unread: number;
				}>
			)[0]?.unread,
		).toBe(3);
	});

	it("stars, unstars and marks unread, counting the folder only when the read state changes", () => {
		const client = seeded();
		patchFlags(client, "a", "star", "INBOX");
		expect(
			rows(client, mailKeys.list("INBOX", 1, "all", ""))[0]?.flagged,
		).toBe(true);
		patchFlags(client, "a", "unstar", "INBOX");
		expect(
			rows(client, mailKeys.list("INBOX", 1, "all", ""))[0]?.flagged,
		).toBe(false);
		expect(
			(
				client.getQueryData(mailKeys.mailboxes) as Array<{
					unread: number;
				}>
			)[0]?.unread,
		).toBe(3);
		patchFlags(client, "a", "read", "INBOX");
		patchFlags(client, "a", "unread", "INBOX");
		expect(
			(
				client.getQueryData(mailKeys.mailboxes) as Array<{
					unread: number;
				}>
			)[0]?.unread,
		).toBe(3);
		expect(
			(client.getQueryData(mailKeys.message("a")) as { unread: boolean })
				.unread,
		).toBe(true);
	});

	it("marks important and back in the message and its rows, leaving the other flags and the counter", () => {
		const client = seeded();
		const all = mailKeys.list("INBOX", 1, "all", "");
		const state = () => ({
			message: client.getQueryData(mailKeys.message("a")),
			row: rows(client, all)[0],
			other: rows(client, all)[1],
			boxes: client.getQueryData(mailKeys.mailboxes),
		});
		const before = state();
		const undo = patchFlags(client, "a", "important", "INBOX");
		expect(state().message).toMatchObject({
			important: true,
			unread: true,
			flagged: false,
		});
		expect(state().row).toMatchObject({
			important: true,
			unread: true,
			flagged: false,
		});
		expect(state().other).toEqual(before.other);
		expect(state().boxes).toEqual(before.boxes);
		patchFlags(client, "a", "unimportant", "INBOX");
		expect(state().message).toMatchObject({ important: false });
		expect(state().row).toMatchObject({ important: false });
		undo();
		expect(state()).toEqual(before);
	});

	it("takes back one change and leaves the ones made after it", () => {
		const client = seeded();
		const flags = () =>
			client.getQueryData(mailKeys.message("a")) as {
				flagged: boolean;
				important: boolean;
				unread: boolean;
			};
		// Two changes wait for the server; the first is refused.
		const undoStar = patchFlags(client, "a", "star", "INBOX");
		const undoImportant = patchFlags(client, "a", "important", "INBOX");

		undoStar();

		expect(flags()).toMatchObject({ flagged: false, important: true });
		expect(
			rows(client, mailKeys.list("INBOX", 1, "all", ""))[0],
		).toMatchObject({ flagged: false, important: true });

		undoImportant();
		expect(flags()).toMatchObject({ flagged: false, important: false });
	});

	it("takes nothing back for a change that changed nothing", () => {
		const client = seeded();
		const flagged = () =>
			(client.getQueryData(mailKeys.message("a")) as { flagged: boolean })
				.flagged;
		patchFlags(client, "a", "star", "INBOX");
		// Already starred: starring it again is no change.
		const undo = patchFlags(client, "a", "star", "INBOX");

		undo();

		// Taking the second back must not take the star the first one set.
		expect(flagged()).toBe(true);
		expect(
			rows(client, mailKeys.list("INBOX", 1, "all", ""))[0]?.flagged,
		).toBe(true);
	});

	it("never takes a counter below zero and leaves other operations alone", () => {
		const client = seeded();
		client.setQueryData(mailKeys.mailboxes, [box("INBOX", 0)]);
		patchFlags(client, "a", "read", "INBOX");
		expect(
			(
				client.getQueryData(mailKeys.mailboxes) as Array<{
					unread: number;
				}>
			)[0]?.unread,
		).toBe(0);
		patchFlags(client, "a", "archive", "INBOX");
		expect(
			rows(client, mailKeys.list("INBOX", 1, "all", ""))[0]?.flagged,
		).toBe(false);
	});

	it("copes with nothing cached", () => {
		const client = new QueryClient();
		const undo = patchFlags(client, "x", "read", null);
		undo();
		expect(client.getQueryData(mailKeys.mailboxes)).toBeUndefined();
	});

	it("reads the row's state when only the list is cached", () => {
		const client = new QueryClient();
		client.setQueryData(mailKeys.list("INBOX", 1, "all", ""), {
			items: [summary("a", true)],
			page: 1,
			total: 1,
			hasNext: false,
			partial: false,
		});
		client.setQueryData(mailKeys.list("INBOX", 2, "all", ""), undefined);
		client.setQueryData(mailKeys.mailboxes, [box("INBOX", 1)]);
		patchFlags(client, "a", "read", "INBOX");
		expect(
			(
				client.getQueryData(mailKeys.mailboxes) as Array<{
					unread: number;
				}>
			)[0]?.unread,
		).toBe(0);
	});
});
