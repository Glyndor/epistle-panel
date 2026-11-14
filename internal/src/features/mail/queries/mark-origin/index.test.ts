import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import { composeMessage } from "@/features/mail/queries/compose-message";
import type { ComposeInput } from "@/features/mail/schemas/compose-input";
import { clearSecretCache } from "@/lib/config/secret";
import { emailFixture, SESSION, stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
beforeEach(() => {
	clearSecretCache();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
});
afterEach(() => {
	globalThis.fetch = originalFetch;
});

const input = (over: Partial<ComposeInput> = {}): ComposeInput => ({
	op: "send",
	to: [{ email: "b@x.org" }],
	cc: [],
	bcc: [],
	subject: "Hi",
	text: "body",
	attachments: [],
	...over,
});
const calls = (seen: ReturnType<typeof stubJmap>, name: string) =>
	seen
		.flatMap((r) => r.calls)
		.filter((c) => c[0] === name)
		.map((c) => c[1]);

describe("markOrigin, through a send", () => {
	const ORIGIN = "00000000-0000-4000-8000-0000000000aa";

	/** A server that holds the original with `keywords`, or not at all. */
	function withOrigin(
		keywords: Record<string, boolean> | null,
		options: {
			submission?: Record<string, unknown>;
			failUpdate?: boolean;
		} = {},
	) {
		return stubJmap({
			"Identity/get": {
				list: [{ id: "a", name: "Ana", email: "a@x.org" }],
			},
			"Mailbox/get": { list: [{ id: "Drafts", role: "drafts" }] },
			"Email/get": (args: Record<string, unknown>) => ({
				list:
					keywords !== null &&
					(args["ids"] as string[]).includes(ORIGIN)
						? [emailFixture({ id: ORIGIN, keywords })]
						: [],
			}),
			"Email/set": (args: Record<string, unknown>) => {
				if (args["update"] && options.failUpdate) {
					throw new Error("down");
				}
				return args["create"]
					? { created: { c: { id: "new-1" } } }
					: args["update"]
						? { updated: { [ORIGIN]: null } }
						: { destroyed: args["destroy"] };
			},
			"EmailSubmission/set": options.submission ?? {
				created: { s: { id: "s1" } },
			},
		});
	}
	const updates = (seen: ReturnType<typeof stubJmap>) =>
		calls(seen, "Email/set")
			.map((c) => (c as { update?: Record<string, unknown> }).update)
			.filter((update) => update !== undefined);

	it("marks the original answered once the reply is sent, keeping every keyword it had", async () => {
		const seen = withOrigin({
			$seen: true,
			Work: true,
			$flagged: true,
			off: false,
		});
		expect(
			await composeMessage(
				SESSION,
				input({ origin: { id: ORIGIN, as: "answered" } }),
			),
		).toEqual({ kind: "sent" });
		expect(updates(seen)).toEqual([
			{
				[ORIGIN]: {
					keywords: {
						$seen: true,
						Work: true,
						$flagged: true,
						$answered: true,
					},
				},
			},
		]);
		// Marked after the message was queued, never before.
		const order = seen.flatMap((r) => r.calls).map((c) => c[0]);
		expect(order.indexOf("EmailSubmission/set")).toBeLessThan(
			order.lastIndexOf("Email/set"),
		);
	});

	it("marks the original forwarded for a forward", async () => {
		const seen = withOrigin({ $seen: true });
		await composeMessage(
			SESSION,
			input({ origin: { id: ORIGIN, as: "forwarded" } }),
		);
		expect(updates(seen)).toEqual([
			{ [ORIGIN]: { keywords: { $seen: true, $forwarded: true } } },
		]);
	});

	it("writes nothing when the original already carries the mark, in any case", async () => {
		for (const [as, keywords] of [
			["answered", { $answered: true }],
			["forwarded", { $Forwarded: true }],
			["forwarded", { $FORWARDED: true, $seen: true }],
		] as const) {
			const seen = withOrigin(keywords);
			await composeMessage(
				SESSION,
				input({ origin: { id: ORIGIN, as } }),
			);
			expect(updates(seen)).toEqual([]);
		}
	});

	it("writes nothing for a message the account does not have", async () => {
		const seen = withOrigin(null);
		expect(
			await composeMessage(
				SESSION,
				input({ origin: { id: ORIGIN, as: "answered" } }),
			),
		).toEqual({ kind: "sent" });
		expect(updates(seen)).toEqual([]);
	});

	it("marks nothing for a draft, a refused send, or a message with no original", async () => {
		const draft = withOrigin({ $seen: true });
		await composeMessage(
			SESSION,
			input({ op: "draft", origin: { id: ORIGIN, as: "answered" } }),
		);
		expect(updates(draft)).toEqual([]);

		const refused = withOrigin(
			{ $seen: true },
			{ submission: { notCreated: { s: { type: "forbiddenToSend" } } } },
		);
		expect(
			(
				await composeMessage(
					SESSION,
					input({ origin: { id: ORIGIN, as: "answered" } }),
				)
			).kind,
		).toBe("refused");
		expect(updates(refused)).toEqual([]);

		const plain = withOrigin({ $seen: true });
		await composeMessage(SESSION, input());
		expect(updates(plain)).toEqual([]);
		expect(calls(plain, "Email/get")).toEqual([]);
	});

	it("is sent all the same when the mark cannot be written, and says so in the log only", async () => {
		const logged = spyOn(console, "error").mockImplementation(() => {});
		try {
			withOrigin({ $seen: true }, { failUpdate: true });
			expect(
				await composeMessage(
					SESSION,
					input({ origin: { id: ORIGIN, as: "answered" } }),
				),
			).toEqual({ kind: "sent" });
			expect(logged).toHaveBeenCalledTimes(1);
			expect(String(logged.mock.calls[0]?.[0])).toContain(
				"mail mark origin",
			);
		} finally {
			logged.mockRestore();
		}
	});
});
