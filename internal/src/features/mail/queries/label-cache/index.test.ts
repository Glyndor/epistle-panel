import { describe, expect, it } from "bun:test";

import { QueryClient } from "@tanstack/react-query";

import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import type { LabelView } from "@/features/mail/schemas/mail-view";

import { mailKeys } from "../mail-query-keys";
import { patchLabels, waitingLabelMessages } from ".";

const WORK: LabelView = { keyword: "Work", name: "Work", tone: 1 };
const HOME: LabelView = { keyword: "Home", name: "Home", tone: 2 };
const ZED: LabelView = { keyword: "Zed", name: "Zed", tone: 3 };

const row = (id: string, labels: readonly LabelView[]) => ({
	id,
	from: null,
	subject: "s",
	receivedAt: "x",
	preview: "",
	unread: false,
	flagged: false,
	important: false,
	answered: false,
	forwarded: false,
	draft: false,
	hasAttachment: false,
	labels,
});

/** Messages `a` (open, carries Home) and `b`, both in a cached list. */
function seeded() {
	const client = new QueryClient();
	client.setQueryData(mailKeys.message("a"), {
		id: "a",
		labels: [HOME],
		mailboxId: "INBOX",
	});
	client.setQueryData(mailKeys.list("INBOX", 1, EMPTY_CONDITIONS), {
		items: [row("a", [HOME]), row("b", [])],
		page: 1,
		total: 2,
		hasNext: false,
		partial: false,
		today: "2026-11-13",
	});
	return client;
}
const names = (labels: readonly LabelView[] | undefined) =>
	(labels ?? []).map((label) => label.name);
const onRow = (client: QueryClient, id: string) =>
	names(
		client
			.getQueryData<{ items: ReturnType<typeof row>[] }>(
				mailKeys.list("INBOX", 1, EMPTY_CONDITIONS),
			)
			?.items.find((item) => item.id === id)?.labels,
	);
const onMessage = (client: QueryClient) =>
	names(
		client.getQueryData<{ labels: LabelView[] }>(mailKeys.message("a"))
			?.labels,
	);
const writeOf = (
	writes: ReturnType<typeof patchLabels>,
	id: string,
): ReturnType<typeof patchLabels> extends ReadonlyMap<string, infer W>
	? W
	: never => {
	const write = writes.get(id);
	if (write === undefined) {
		throw new Error(`no write for ${id}`);
	}
	return write;
};

describe("patchLabels", () => {
	it("shows a label at once on the open message and on its row, in its place by name", () => {
		const client = seeded();
		patchLabels(client, ["a"], WORK, true);
		expect(onMessage(client)).toEqual(["Home", "Work"]);
		expect(onRow(client, "a")).toEqual(["Home", "Work"]);
		expect(onRow(client, "b")).toEqual([]);
		patchLabels(client, ["a"], ZED, true);
		patchLabels(client, ["a"], HOME, false);
		expect(onRow(client, "a")).toEqual(["Work", "Zed"]);
	});

	it("puts a label on several messages at once and ends each message on its own", () => {
		const client = seeded();
		const writes = patchLabels(client, ["a", "b"], WORK, true);
		expect(onRow(client, "b")).toEqual(["Work"]);
		writeOf(writes, "a").confirm();
		writeOf(writes, "b").refuse();
		expect(onRow(client, "a")).toEqual(["Home", "Work"]);
		expect(onRow(client, "b")).toEqual([]);
		expect(waitingLabelMessages(client)).toBe(0);
	});

	it("puts a refused change back, the label coming back or going", () => {
		const client = seeded();
		patchLabels(client, ["a"], HOME, false).get("a")?.refuse();
		expect(onMessage(client)).toEqual(["Home"]);
		patchLabels(client, ["a"], WORK, true).get("a")?.refuse();
		expect(onMessage(client)).toEqual(["Home"]);
		expect(onRow(client, "a")).toEqual(["Home"]);
	});

	it("takes back a refused change by what the server last confirmed, not by its opposite", () => {
		const client = seeded();
		// On, then off, both refused: the opposite of the second, computed over
		// the first, would leave a label the server does not have.
		const first = patchLabels(client, ["a"], WORK, true);
		const second = patchLabels(client, ["a"], WORK, false);
		expect(onMessage(client)).toEqual(["Home"]);
		writeOf(first, "a").refuse();
		expect(onMessage(client)).toEqual(["Home"]);
		writeOf(second, "a").refuse();
		expect(onMessage(client)).toEqual(["Home"]);
		expect(waitingLabelMessages(client)).toBe(0);
	});

	it("leaves the label at what the change still waiting asked for when an earlier one is refused", () => {
		const client = seeded();
		const first = patchLabels(client, ["a"], WORK, true);
		const second = patchLabels(client, ["a"], WORK, true);
		writeOf(first, "a").refuse();
		expect(onMessage(client)).toEqual(["Home", "Work"]);
		writeOf(second, "a").confirm();
		expect(onMessage(client)).toEqual(["Home", "Work"]);
	});

	it("shows a confirmed change again when the message was read from the server while it waited", () => {
		const client = seeded();
		const write = writeOf(patchLabels(client, ["a"], WORK, true), "a");
		// A refresh with what the server held before the change.
		client.setQueryData(mailKeys.message("a"), {
			id: "a",
			labels: [HOME],
			mailboxId: "INBOX",
		});
		write.confirm();
		expect(onMessage(client)).toEqual(["Home", "Work"]);
	});

	it("leaves a change that was never written without putting anything back", () => {
		const client = seeded();
		patchLabels(client, ["a"], WORK, true).get("a")?.drop();
		expect(onMessage(client)).toEqual(["Home", "Work"]);
		expect(waitingLabelMessages(client)).toBe(0);
	});

	it("keeps two labels and two messages apart, and holds two spellings of a keyword as one", () => {
		const client = seeded();
		const work = patchLabels(client, ["a"], WORK, true);
		patchLabels(client, ["a"], ZED, true);
		patchLabels(client, ["b"], WORK, true);
		expect(waitingLabelMessages(client)).toBe(2);
		const spelled = { ...WORK, keyword: "WORK" };
		patchLabels(client, ["a"], spelled, false);
		expect(onMessage(client)).toEqual(["Home", "Zed"]);
		writeOf(work, "a").refuse();
		expect(onMessage(client)).toEqual(["Home", "Zed"]);
	});

	it("shows a message that no cache holds as nothing and answers without error", () => {
		const client = new QueryClient();
		const write = writeOf(patchLabels(client, ["x"], WORK, true), "x");
		write.refuse();
		write.confirm();
		expect(waitingLabelMessages(client)).toBe(0);
	});
});
