import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { clearToasts, Toaster } from "@/components/ui/toaster";
import { encodeLabelName } from "@/features/mail/labels/name-codec";
import { waitingLabelMessages } from "@/features/mail/queries/label-cache";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import { markGone } from "@/features/mail/queries/message-cache";
import { LABEL_BATCH } from "@/features/mail/schemas/label-input-model";
import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import type { LabelView } from "@/features/mail/schemas/mail-view";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { settled, testQueryClient } from "@/test/query-wrapper";
import { detail, summary } from "../../../test-support/fixtures";
import { emailFixture, stubJmap } from "../../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { useLabelChange } = await import(".");

const A = "00000000-0000-4000-8000-0000000000c1";
const B = "00000000-0000-4000-8000-0000000000c2";
const WORK: LabelView = { keyword: "Work", name: "Work", tone: 1 };

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

/** A server that keeps each message's keywords; the writes whose turn is listed are refused for the first message they name. */
function serve(refused: readonly number[] = []) {
	const kept: Record<string, Record<string, boolean>> = {
		[A]: { $seen: true },
		[B]: {},
	};
	let turn = 0;
	const seen = stubJmap({
		"Email/get": (args: Record<string, unknown>) => ({
			list: ((args["ids"] as string[]) ?? [])
				.filter((id) => id in kept)
				.map((id) => emailFixture({ id, keywords: kept[id] })),
		}),
		"Email/set": (args: Record<string, unknown>) => {
			const update = args["update"] as Record<
				string,
				{ keywords: Record<string, boolean> }
			>;
			turn += 1;
			if (refused.includes(turn)) {
				return {
					notUpdated: Object.fromEntries(
						Object.keys(update).map((id) => [id, { type: "x" }]),
					),
				};
			}
			for (const [id, one] of Object.entries(update)) {
				kept[id] = one.keywords;
			}
			return {
				updated: Object.fromEntries(
					Object.keys(update).map((id) => [id, null]),
				),
			};
		},
	});
	const requests = () =>
		seen.flatMap((r) => r.calls).filter((c) => c[0] === "Email/set").length;
	return { kept, requests };
}

function screenOf(scope = "scope") {
	const client = testQueryClient();
	client.setQueryData(mailKeys.message(A), detail({ id: A, labels: [] }));
	client.setQueryData(mailKeys.list("INBOX", 1, EMPTY_CONDITIONS), {
		items: [summary({ id: A }), summary({ id: B })],
		page: 1,
		total: 2,
		hasNext: false,
		partial: false,
		today: "2026-11-13",
	});
	const read: string[] = [];
	client.invalidateQueries = ((filters?: {
		queryKey?: readonly unknown[];
	}) => {
		read.push((filters?.queryKey ?? []).join("/"));
		return Promise.resolve();
	}) as typeof client.invalidateQueries;
	const wrapper = ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={client}>
			{children}
			<Toaster label="toasts" closeLabel="close" />
		</QueryClientProvider>
	);
	const hook = renderHook(() => useLabelChange(scope), { wrapper });
	const rowLabels = (id: string) =>
		(
			client.getQueryData(
				mailKeys.list("INBOX", 1, EMPTY_CONDITIONS),
			) as { items: { id: string; labels: LabelView[] }[] }
		).items
			.find((item) => item.id === id)
			?.labels.map((label) => label.name);
	return {
		client,
		hook,
		reads: () => read.filter((key) => key === "mail/list").length,
		rowLabels,
		message: () =>
			(
				client.getQueryData(mailKeys.message(A)) as {
					labels: LabelView[];
				}
			).labels.map((label) => label.name),
		toasts: () =>
			Array.from(document.querySelectorAll("[data-kind]")).map(
				(toast) =>
					`${toast.getAttribute("data-kind")}:${toast.querySelector("p")?.textContent}`,
			),
		idle: async () => {
			await waitFor(() => expect(client.isMutating()).toBe(0), {
				timeout: 5000,
			});
			await settled();
		},
	};
}

describe("useLabelChange", () => {
	it("shows the label at once and keeps it when the server makes the change, without a word", async () => {
		const server = serve();
		const screen = screenOf();

		await act(async () =>
			screen.hook.result.current.apply([A], WORK, true),
		);
		expect(screen.message()).toEqual(["Work"]);
		expect(screen.rowLabels(A)).toEqual(["Work"]);
		await screen.idle();

		expect(server.kept[A]).toEqual({ $seen: true, Work: true });
		expect(screen.message()).toEqual(["Work"]);
		expect(screen.toasts()).toEqual([]);
		expect(screen.reads()).toBe(1);
		expect(waitingLabelMessages(screen.client)).toBe(0);
	});

	it("takes the label off by its keyword", async () => {
		const server = serve();
		server.kept[A] = { Work: true };
		const screen = screenOf();
		act(() => screen.hook.result.current.apply([A], WORK, true));
		await screen.idle();
		await act(async () =>
			screen.hook.result.current.apply([A], WORK, false),
		);
		expect(screen.message()).toEqual([]);
		await screen.idle();
		expect(server.kept[A]).toEqual({});
	});

	it("puts the label back and says so when the server refuses the change", async () => {
		serve([1]);
		const screen = screenOf();

		await act(async () =>
			screen.hook.result.current.apply([A], WORK, true),
		);
		expect(screen.message()).toEqual(["Work"]);
		await screen.idle();

		expect(screen.message()).toEqual([]);
		expect(screen.rowLabels(A)).toEqual([]);
		expect(screen.toasts()).toEqual(["error:actionFailed"]);
		expect(waitingLabelMessages(screen.client)).toBe(0);
	});

	it("puts everything back and says so when the action itself fails", async () => {
		stubJmap({});
		const screen = screenOf();
		act(() => screen.hook.result.current.apply([A, B], WORK, true));
		await screen.idle();
		expect(screen.message()).toEqual([]);
		expect(screen.rowLabels(B)).toEqual([]);
		expect(screen.toasts()).toEqual(["error:actionFailed"]);
	});

	it("makes a label from a typed name under the keyword of its exact name", async () => {
		const server = serve();
		const screen = screenOf();
		let made = false;
		await act(async () => {
			made = screen.hook.result.current.create([A, B], "To do");
		});
		expect(made).toBe(true);
		expect(screen.message()).toEqual(["To do"]);
		expect(screen.rowLabels(B)).toEqual(["To do"]);
		await screen.idle();
		const keyword = encodeLabelName("To do") ?? "";
		expect(server.kept[A]).toEqual({ $seen: true, [keyword]: true });
		expect(server.kept[B]).toEqual({ [keyword]: true });
	});

	it("asks for nothing when the name is not one the shared rule takes", async () => {
		const server = serve();
		const screen = screenOf();
		let made = true;
		act(() => {
			made = screen.hook.result.current.create([A], "x".repeat(31));
		});
		expect(made).toBe(false);
		act(() => {
			made = screen.hook.result.current.create([A], "​");
		});
		expect(made).toBe(false);
		expect(server.requests()).toBe(0);
		expect(screen.message()).toEqual([]);
	});

	it("puts back only the messages the server did not change in a batch", async () => {
		// One write for both messages, refused for the second only.
		const kept: Record<string, Record<string, boolean>> = {
			[A]: {},
			[B]: {},
		};
		stubJmap({
			"Email/get": (args: Record<string, unknown>) => ({
				list: (args["ids"] as string[]).map((id) =>
					emailFixture({ id, keywords: kept[id] }),
				),
			}),
			"Email/set": () => ({
				updated: { [A]: null },
				notUpdated: { [B]: { type: "x" } },
			}),
		});
		const screen = screenOf();
		act(() => screen.hook.result.current.apply([A, B], WORK, true));
		await screen.idle();
		expect(screen.message()).toEqual(["Work"]);
		expect(screen.rowLabels(B)).toEqual([]);
		expect(screen.toasts()).toEqual(["error:labelsFailedSome"]);
	});

	it("sends a long selection in runs of the bounded size, one after the other", async () => {
		const ids = Array.from(
			{ length: LABEL_BATCH + 1 },
			(_, index) =>
				`00000000-0000-4000-8000-${(index + 100).toString(16).padStart(12, "0")}`,
		);
		const sizes: number[] = [];
		stubJmap({
			"Email/get": (args: Record<string, unknown>) => {
				sizes.push((args["ids"] as string[]).length);
				return {
					list: (args["ids"] as string[]).map((id) =>
						emailFixture({ id, keywords: {} }),
					),
				};
			},
			"Email/set": (args: Record<string, unknown>) => ({
				updated: Object.fromEntries(
					Object.keys(args["update"] as object).map((id) => [
						id,
						null,
					]),
				),
			}),
		});
		const screen = screenOf();
		act(() => screen.hook.result.current.apply(ids, WORK, true));
		await screen.idle();
		expect(sizes).toEqual([LABEL_BATCH, 1]);
		expect(screen.toasts()).toEqual([]);
	});

	it("keeps the runs that were written when a later one fails", async () => {
		const ids = Array.from(
			{ length: LABEL_BATCH + 1 },
			(_, index) =>
				`00000000-0000-4000-8000-${(index + 100).toString(16).padStart(12, "0")}`,
		);
		let gets = 0;
		stubJmap({
			"Email/get": (args: Record<string, unknown>) => {
				gets += 1;
				return gets === 2
					? { list: "broken" }
					: {
							list: (args["ids"] as string[]).map((id) =>
								emailFixture({ id, keywords: {} }),
							),
						};
			},
			"Email/set": (args: Record<string, unknown>) => ({
				updated: Object.fromEntries(
					Object.keys(args["update"] as object).map((id) => [
						id,
						null,
					]),
				),
			}),
		});
		const screen = screenOf();
		act(() => screen.hook.result.current.apply(ids, WORK, true));
		await screen.idle();
		expect(screen.toasts()).toEqual(["error:labelsFailedSome"]);
		expect(waitingLabelMessages(screen.client)).toBe(0);
	});

	it("writes nothing for a message that left its folder while the change waited", async () => {
		const server = serve();
		const screen = screenOf();
		act(() => screen.hook.result.current.apply([A], WORK, true));
		markGone(screen.client, A);
		await screen.idle();
		expect(server.requests()).toBe(0);
		expect(waitingLabelMessages(screen.client)).toBe(0);
	});

	it("does not read the lists again while another change waits, and does when the last one ends", async () => {
		serve();
		const screen = screenOf();
		act(() => {
			screen.hook.result.current.apply([A], WORK, true);
			screen.hook.result.current.apply([B], WORK, true);
		});
		await screen.idle();
		expect(screen.reads()).toBe(1);
	});

	it("reports a change as pending until it is answered", async () => {
		serve();
		const answer = globalThis.fetch;
		let release: () => void = () => undefined;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
			await held;
			return answer(...args);
		}) as typeof fetch;
		const screen = screenOf();
		expect(screen.hook.result.current.pending).toBe(false);
		act(() => screen.hook.result.current.apply([A], WORK, true));
		await waitFor(
			() => expect(screen.hook.result.current.pending).toBe(true),
			{ timeout: 5000 },
		);
		release();
		await screen.idle();
		expect(screen.hook.result.current.pending).toBe(false);
	});
});
