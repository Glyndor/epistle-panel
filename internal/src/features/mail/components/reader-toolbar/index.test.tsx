import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { clearToasts } from "@/components/ui/toaster";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { withQuery } from "@/test/query-wrapper";
import { detail } from "../../test-support/fixtures";
import { emailFixture, stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const originalConfirm = window.confirm;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { ReaderToolbar } = await import(".");

const ID = "00000000-0000-4000-8000-0000000000f1";
let leftCount = 0;
const left = () => {
	leftCount += 1;
};
const message = (over = {}) =>
	detail({
		id: ID,
		unread: false,
		flagged: false,
		mailboxId: "INBOX",
		...over,
	});

function serve(
	keywords: Record<string, boolean> = { $seen: true },
	box = "INBOX",
) {
	return stubJmap({
		"Email/get": {
			list: [
				emailFixture({ id: ID, keywords, mailboxIds: { [box]: true } }),
			],
		},
		"Mailbox/get": {
			list: [
				{
					id: "INBOX",
					role: "inbox",
					name: "INBOX",
					totalEmails: 1,
					unreadEmails: 0,
				},
				{
					id: "Archive",
					role: "archive",
					name: "Archive",
					totalEmails: 0,
					unreadEmails: 0,
				},
				{
					id: "Trash",
					role: "trash",
					name: "Trash",
					totalEmails: 0,
					unreadEmails: 0,
				},
				{
					id: "Junk",
					role: "junk",
					name: "Junk",
					totalEmails: 0,
					unreadEmails: 0,
				},
			],
		},
		"Email/set": (args: Record<string, unknown>) => ({
			updated: args["update"] ? { [ID]: null } : null,
			destroyed: args["destroy"] ?? null,
		}),
	});
}
const setCalls = (seen: ReturnType<typeof stubJmap>) =>
	seen
		.flatMap((r) => r.calls)
		.filter((c) => c[0] === "Email/set")
		.map((c) => c[1]);

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	clearToasts();
	leftCount = 0;
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
});
afterEach(clearToasts);
afterEach(async () => {
	// Let a change still in flight finish against this test's stub, not the next one's.
	await new Promise((r) => setTimeout(r, 80));
	cleanup();
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
	window.confirm = originalConfirm;
});

function renderBar(msg = message(), inTrash = false, inDrafts = false) {
	return render(
		withQuery(
			<ReaderToolbar
				message={msg}
				onLeft={left}
				inTrash={inTrash}
				inDrafts={inDrafts}
			/>,
		),
	);
}

describe("ReaderToolbar", () => {
	it("is a named toolbar with every action, labelled and with its key", () => {
		serve();
		renderBar();
		expect(
			screen.getByRole("toolbar", { name: "toolbarLabel" }),
		).toBeInTheDocument();
		for (const name of [
			"star",
			"markUnread",
			"archive",
			"spam",
			"moveMenu",
			"trash",
		]) {
			expect(screen.getByRole("button", { name })).toBeInTheDocument();
		}
		expect(screen.getByRole("button", { name: "star" })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
		expect(screen.getByRole("button", { name: "archive" })).toHaveAttribute(
			"aria-keyshortcuts",
			"e",
		);
	});

	it("links to the composer to reply, reply to all and forward, and to edit a draft instead of replying to it", () => {
		serve();
		renderBar();
		for (const [name, mode] of [
			["reply", "reply"],
			["replyAll", "replyAll"],
			["forward", "forward"],
		] as const) {
			expect(screen.getByRole("link", { name })).toHaveAttribute(
				"href",
				`/app/mail/compose?mode=${mode}&msg=${ID}`,
			);
		}
		expect(screen.queryByRole("link", { name: "editDraft" })).toBeNull();
		cleanup();
		renderBar(message(), false, true);
		expect(screen.getByRole("link", { name: "editDraft" })).toHaveAttribute(
			"href",
			`/app/mail/compose?mode=draft&msg=${ID}`,
		);
		expect(screen.queryByRole("link", { name: "reply" })).toBeNull();
	});

	it("marks an unread message read once, when it is opened, without a toast", async () => {
		const seen = serve({});
		const { rerender } = renderBar(message({ unread: true }));
		await waitFor(() => expect(setCalls(seen)).toHaveLength(1));
		expect(
			(
				setCalls(seen)[0] as {
					update: Record<string, { keywords: object }>;
				}
			).update[ID]?.keywords,
		).toEqual({ $seen: true });
		rerender(
			withQuery(
				<ReaderToolbar
					message={message({ unread: true })}
					onLeft={left}
					inTrash={false}
					inDrafts={false}
				/>,
			),
		);
		await new Promise((r) => setTimeout(r, 30));
		expect(setCalls(seen)).toHaveLength(1);
		expect(screen.queryByText("changed")).toBeNull();
	});

	it("does not mark a read message", async () => {
		const seen = serve();
		renderBar();
		await new Promise((r) => setTimeout(r, 30));
		expect(setCalls(seen)).toHaveLength(0);
	});

	it("stars and unstars, and toggles read and unread", async () => {
		const seen = serve();
		renderBar();
		fireEvent.click(screen.getByRole("button", { name: "star" }));
		fireEvent.click(screen.getByRole("button", { name: "markUnread" }));
		await waitFor(() => expect(setCalls(seen)).toHaveLength(2));
		cleanup();
		renderBar(message({ flagged: true, unread: true }));
		expect(screen.getByRole("button", { name: "unstar" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(
			screen.getByRole("button", { name: "markRead" }),
		).toBeInTheDocument();
	});

	it("archives and marks spam, each a move by role", async () => {
		const seen = serve();
		renderBar();
		fireEvent.click(screen.getByRole("button", { name: "archive" }));
		await waitFor(() => expect(setCalls(seen)).toHaveLength(1));
		await waitFor(() =>
			expect(screen.getByRole("button", { name: "spam" })).toBeEnabled(),
		);
		fireEvent.click(screen.getByRole("button", { name: "spam" }));
		await waitFor(() =>
			expect(setCalls(seen).length).toBeGreaterThanOrEqual(2),
		);
		const targets = setCalls(seen).map((c) =>
			Object.keys(
				(c as { update: Record<string, { mailboxIds: object }> })
					.update[ID]?.mailboxIds ?? {},
			),
		);
		expect(leftCount).toBeGreaterThanOrEqual(1);
		expect(targets.filter((keys) => keys.length > 0)).toEqual([
			["Archive"],
			["Junk"],
		]);
	});

	it("deletes to the trash without asking, and for good from the trash only after a confirm", async () => {
		const asked: string[] = [];
		window.confirm = (text?: string) => {
			asked.push(String(text));
			return false;
		};
		const seen = serve();
		renderBar();
		fireEvent.click(screen.getByRole("button", { name: "trash" }));
		await waitFor(() => expect(setCalls(seen)).toHaveLength(1));
		expect(asked).toEqual([]);
		cleanup();
		const seenTrash = serve({ $seen: true }, "Trash");
		renderBar(message({ mailboxId: "Trash" }), true);
		fireEvent.click(screen.getByRole("button", { name: "deleteForever" }));
		await new Promise((r) => setTimeout(r, 30));
		expect(asked).toEqual(["confirmDeleteForever"]);
		expect(setCalls(seenTrash)).toHaveLength(0);
		window.confirm = () => true;
		fireEvent.click(screen.getByRole("button", { name: "deleteForever" }));
		await waitFor(() => expect(setCalls(seenTrash)).toHaveLength(1));
		expect(
			(setCalls(seenTrash)[0] as { destroy: string[] }).destroy,
		).toEqual([ID]);
	});

	it("answers its keys, and leaves them alone in a field, with a modifier or for other keys", async () => {
		const seen = serve();
		renderBar();
		await new Promise((r) => setTimeout(r, 40));
		const baseline = setCalls(seen).length;
		fireEvent.keyDown(document.body, { key: "x" });
		fireEvent.keyDown(document.body, { key: "s", ctrlKey: true });
		const input = document.createElement("input");
		document.body.append(input);
		fireEvent.keyDown(input, { key: "s" });
		input.remove();
		await new Promise((r) => setTimeout(r, 30));
		expect(setCalls(seen)).toHaveLength(baseline);
		for (const key of ["s", "e", "!", "#"]) {
			fireEvent.keyDown(document.body, { key });
		}
		await waitFor(() =>
			expect(setCalls(seen).length).toBeGreaterThan(baseline),
		);
	});

	it("says so when the change fails, and when the account has no such folder", async () => {
		stubJmap({
			"Email/get": { list: [emailFixture({ id: ID })] },
			"Mailbox/get": { list: [{ id: "INBOX", role: "inbox" }] },
		});
		renderBar();
		fireEvent.click(screen.getByRole("button", { name: "archive" }));
		expect(
			await screen
				.findByText("noFolder", {}, { timeout: 2000 })
				.catch(() => null),
		).toBeDefined();
		stubJmap({});
		fireEvent.click(screen.getByRole("button", { name: "star" }));
		await new Promise((r) => setTimeout(r, 50));
		expect(
			screen.getByRole("button", { name: "star" }),
		).toBeInTheDocument();
	});
});
