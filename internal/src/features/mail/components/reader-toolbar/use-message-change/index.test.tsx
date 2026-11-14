import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { clearToasts, Toaster } from "@/components/ui/toaster";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { settled, testQueryClient } from "@/test/query-wrapper";
import { detail, summary } from "../../../test-support/fixtures";
import { emailFixture, stubJmap } from "../../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { useMessageChange } = await import(".");

const A = "00000000-0000-4000-8000-0000000000d1";
const B = "00000000-0000-4000-8000-0000000000d2";

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	clearToasts();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
});
afterEach(async () => {
	await settled();
	cleanup();
	clearToasts();
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
});

/** A server that keeps each message's keywords and refuses the writes whose turn is listed. */
function serve(refused: readonly number[] = []) {
	const kept: Record<string, Record<string, boolean>> = {
		[A]: {},
		[B]: { $seen: true },
	};
	let turn = 0;
	const seen = stubJmap({
		"Email/get": (args: Record<string, unknown>) => ({
			list: ((args["ids"] as string[] | undefined) ?? []).map((id) =>
				emailFixture({
					id,
					keywords: kept[id] ?? {},
					mailboxIds: { INBOX: true },
				}),
			),
		}),
		"Mailbox/get": {
			list: [
				{
					id: "INBOX",
					role: "inbox",
					name: "INBOX",
					totalEmails: 2,
					unreadEmails: 1,
				},
				{
					id: "Archive",
					role: "archive",
					name: "Archive",
					totalEmails: 0,
					unreadEmails: 0,
				},
			],
		},
		"Email/set": (args: Record<string, unknown>) => {
			const update = args["update"] as Record<
				string,
				{ keywords?: Record<string, boolean> }
			>;
			const [id] = Object.keys(update);
			turn += 1;
			if (id === undefined || refused.includes(turn)) {
				return { notUpdated: { [id ?? ""]: { type: "forbidden" } } };
			}
			if (update[id]?.keywords) {
				kept[id] = update[id].keywords;
			}
			return { updated: { [id]: null } };
		},
	});
	const writes = () =>
		seen.flatMap((r) => r.calls).filter((c) => c[0] === "Email/set").length;
	return { kept, writes };
}

/** A screen with message A (unread, in a folder that counts 3 unread) and B cached, and one hook per message. */
function screenOf() {
	const client = testQueryClient();
	client.setQueryData(
		mailKeys.message(A),
		detail({ id: A, unread: true, mailboxId: "INBOX" }),
	);
	client.setQueryData(mailKeys.list("INBOX", 1, "all", ""), {
		items: [summary({ id: A, unread: true }), summary({ id: B })],
		page: 1,
		total: 2,
		hasNext: false,
		partial: false,
		today: "2026-11-13",
	});
	client.setQueryData(mailKeys.mailboxes, [
		{
			id: "INBOX",
			name: "INBOX",
			role: "inbox",
			parentId: null,
			depth: 0,
			unread: 3,
			total: 5,
		},
	]);
	const read: string[] = [];
	const invalidate = client.invalidateQueries.bind(client);
	client.invalidateQueries = ((filters?: {
		queryKey?: readonly unknown[];
	}) => {
		read.push((filters?.queryKey ?? []).join("/"));
		// The lists are not read again here: the cache is what the test looks at.
		return Promise.resolve();
	}) as typeof client.invalidateQueries;
	void invalidate;
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>
			{children}
			<Toaster label="toasts" closeLabel="close" />
		</QueryClientProvider>
	);
	const hook = renderHook(
		() => ({
			a: useMessageChange({ id: A, mailboxId: "INBOX" }),
			b: useMessageChange({ id: B, mailboxId: "INBOX" }),
		}),
		{ wrapper },
	);
	return {
		client,
		hook,
		lists: () => read.filter((key) => key === "mail/list").length,
		message: () =>
			client.getQueryData(mailKeys.message(A)) as {
				flagged: boolean;
				important: boolean;
				unread: boolean;
			},
		counter: () =>
			(
				client.getQueryData(mailKeys.mailboxes) as Array<{
					unread: number;
				}>
			)[0]?.unread,
		toasts: () =>
			Array.from(document.querySelectorAll("[data-kind]")).map(
				(toast) =>
					`${toast.getAttribute("data-kind")}:${toast.querySelector("p")?.textContent}`,
			),
		idle: async () => {
			await waitFor(() => expect(client.isMutating()).toBe(0));
			await settled();
		},
	};
}

describe("useMessageChange", () => {
	it("ends without a star when a star and its removal are both refused", async () => {
		const server = serve([1, 2]);
		const screen = screenOf();

		act(() => {
			screen.hook.result.current.a.change("star", { quiet: "success" });
			screen.hook.result.current.a.change("unstar", { quiet: "success" });
		});
		await screen.idle();

		expect(server.writes()).toBe(2);
		expect(server.kept[A]).toEqual({});
		// What the screen shows is what the server holds.
		expect(screen.message().flagged).toBe(false);
		expect(screen.toasts()).toEqual([
			"error:actionFailed",
			"error:actionFailed",
		]);
	});

	it("leaves the read state and the counter as they were when read and then unread are both refused", async () => {
		serve([1, 2]);
		const screen = screenOf();

		act(() => {
			screen.hook.result.current.a.change("read", { quiet: "success" });
			screen.hook.result.current.a.change("unread", { quiet: "success" });
		});
		await screen.idle();

		expect(screen.message().unread).toBe(true);
		expect(screen.counter()).toBe(3);
	});

	it("takes back the first change alone when it is refused and the second is made", async () => {
		const server = serve([1]);
		const screen = screenOf();

		act(() => {
			screen.hook.result.current.a.change("star", { quiet: "success" });
			screen.hook.result.current.a.change("important", {
				quiet: "success",
			});
		});
		await screen.idle();

		expect(server.kept[A]).toEqual({ $important: true });
		expect(screen.message()).toMatchObject({
			flagged: false,
			important: true,
		});
		expect(screen.toasts()).toEqual(["error:actionFailed"]);
	});

	it("keeps the first change when the second, on the same flag, is refused", async () => {
		const server = serve([2]);
		const screen = screenOf();

		act(() => {
			screen.hook.result.current.a.change("star", { quiet: "success" });
			screen.hook.result.current.a.change("unstar", { quiet: "success" });
		});
		await screen.idle();

		expect(server.kept[A]).toEqual({ $flagged: true });
		expect(screen.message().flagged).toBe(true);
	});

	it("does not read the lists while a change to another message still waits", async () => {
		serve();
		const screen = screenOf();

		act(() => {
			screen.hook.result.current.a.change("star", { quiet: "success" });
			screen.hook.result.current.b.change("star", { quiet: "success" });
			screen.hook.result.current.b.change("important", {
				quiet: "success",
			});
		});
		await screen.idle();

		// Three changes, two messages: read once, after the last. Read when
		// the first message was answered, the list would have come back
		// without the mark still waiting on the second.
		expect(screen.lists()).toBe(1);
	});

	it("drops what waited behind a move without asking the server or saying it failed, and reads the lists at the move", async () => {
		const server = serve();
		const screen = screenOf();

		act(() => {
			screen.hook.result.current.a.change("archive");
			screen.hook.result.current.a.change("star", { quiet: "success" });
		});
		await screen.idle();

		// One write, the move: the star was never sent to an id that is gone.
		expect(server.writes()).toBe(1);
		expect(screen.toasts()).toEqual(["success:moved"]);
		// Read at the move, though the star still waited, and again after it.
		expect(screen.lists()).toBe(2);
	});

	it("says which change is still not answered: any, or one that moves the message", async () => {
		serve();
		// Every answer waits until the case has looked at the hook.
		let release = () => {};
		const hold = () => {
			const held = new Promise<void>((resolve) => {
				release = resolve;
			});
			const answer = globalThis.fetch;
			globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
				await held;
				return answer(...args);
			}) as typeof fetch;
			return () => {
				globalThis.fetch = answer;
			};
		};
		const screen = screenOf();
		expect(screen.hook.result.current.a).toMatchObject({
			pending: false,
			moving: false,
		});

		let free = hold();
		act(() => screen.hook.result.current.a.change("star"));
		await waitFor(() =>
			expect(screen.hook.result.current.a.pending).toBe(true),
		);
		expect(screen.hook.result.current.a.moving).toBe(false);
		release();
		await screen.idle();
		free();

		free = hold();
		act(() => screen.hook.result.current.a.change("archive"));
		await waitFor(() =>
			expect(screen.hook.result.current.a.moving).toBe(true),
		);
		expect(screen.hook.result.current.a.pending).toBe(true);
		release();
		await screen.idle();
		free();
		expect(screen.hook.result.current.a.moving).toBe(false);
	});
});
