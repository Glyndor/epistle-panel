import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import type { ComposeInput } from "@/features/mail/schemas/compose-input";
import { clearSecretCache } from "@/lib/config/secret";
import { emailFixture, SESSION, stubJmap } from "../../test-support/jmap-stub";
import { composeMessage, refusalOf } from ".";

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
	bcc: [{ email: "hidden@x.org" }],
	subject: "Hi",
	text: "body",
	attachments: [],
	...over,
});

/** The Email object the composer asks to create, as the tests read it. */
type Created = Record<string, unknown>;

interface Server {
	sender?: boolean;
	created?: Record<string, unknown>;
	submission?: Record<string, unknown>;
	drafts?: string;
}

function serve(options: Server = {}) {
	return stubJmap({
		"Identity/get": {
			list:
				options.sender === false
					? []
					: [{ id: "a", name: "Ana", email: "a@x.org" }],
		},
		"Mailbox/get": {
			list: [
				{ id: options.drafts ?? "Drafts", role: "drafts" },
				{ id: "INBOX", role: "inbox" },
			],
		},
		"Email/get": (args: Record<string, unknown>) => ({
			list: (args["ids"] as string[])
				.filter((id) => id === "old-1")
				.map((id) =>
					emailFixture({
						id,
						keywords: { $draft: true, $seen: true },
						mailboxIds: { [options.drafts ?? "Drafts"]: true },
					}),
				),
		}),
		"Email/set": (args: Record<string, unknown>) =>
			args["create"]
				? (options.created ?? { created: { c: { id: "new-1" } } })
				: { destroyed: args["destroy"] },
		"EmailSubmission/set": options.submission ?? {
			created: { s: { id: "s1" } },
		},
	});
}
const calls = (seen: ReturnType<typeof stubJmap>, name: string) =>
	seen
		.flatMap((r) => r.calls)
		.filter((c) => c[0] === name)
		.map((c) => c[1]);

describe("refusalOf", () => {
	it("maps the SetError types it knows and everything else to a server failure", () => {
		expect(refusalOf("forbiddenFrom")).toBe("forbiddenFrom");
		expect(refusalOf("invalidProperties")).toBe("invalid");
		expect(refusalOf("noRecipients")).toBe("noRecipients");
		expect(refusalOf("whatever")).toBe("serverFail");
		expect(refusalOf("constructor")).toBe("serverFail");
	});
});

describe("composeMessage: drafts", () => {
	it("stores a draft in the drafts folder from the account's own identity, as the sender cannot be chosen", async () => {
		const seen = serve();
		const result = await composeMessage(SESSION, input({ op: "draft" }));
		expect(result).toEqual({ kind: "draft", id: "new-1" });
		const create = (
			calls(seen, "Email/set")[0] as {
				create: { c: Created };
			}
		).create.c;
		expect(create["mailboxIds"]).toEqual({ Drafts: true });
		expect(create["keywords"]).toEqual({ $draft: true, $seen: true });
		expect(create["from"]).toEqual([{ name: "Ana", email: "a@x.org" }]);
		expect(create["bcc"]).toEqual([{ email: "hidden@x.org" }]);
		expect(create["bodyValues"]).toEqual({ t: { value: "body" } });
		expect(create["attachments"]).toBeUndefined();
		expect(calls(seen, "EmailSubmission/set")).toHaveLength(0);
	});

	it("replaces the previous draft after the new one exists", async () => {
		const seen = serve();
		await composeMessage(SESSION, input({ op: "draft", draftId: "old-1" }));
		const sets = calls(seen, "Email/set");
		expect(sets).toHaveLength(2);
		expect((sets[1] as { destroy: string[] }).destroy).toEqual(["old-1"]);
	});

	it("carries attachments by blob id, the reply headers without brackets, and a nameless sender", async () => {
		const seen = stubJmap({
			"Identity/get": { list: [{ id: "a", email: "a@x.org" }] },
			"Mailbox/get": { list: [{ id: "INBOX", role: "inbox" }] },
			"Email/set": { created: { c: { id: "n" } } },
		});
		await composeMessage(
			SESSION,
			input({
				op: "draft",
				attachments: [
					{
						blobId: "00000000-0000-4000-a000-000000000001",
						name: "a.pdf",
						type: "application/pdf",
					},
				],
				inReplyTo: "<orig@x.org>",
				references: ["<r1@x.org>", "r2@x.org"],
			}),
		);
		const create = (
			calls(seen, "Email/set")[0] as {
				create: { c: Created };
			}
		).create.c;
		expect(create["attachments"]).toEqual([
			{
				blobId: "00000000-0000-4000-a000-000000000001",
				type: "application/pdf",
				name: "a.pdf",
				disposition: "attachment",
			},
		]);
		expect(create["inReplyTo"]).toEqual(["orig@x.org"]);
		expect(create["references"]).toEqual(["r1@x.org", "r2@x.org"]);
		expect(create["from"]).toEqual([{ email: "a@x.org" }]);
		expect(create["mailboxIds"]).toEqual({ Drafts: true });
	});

	it("says why a draft could not be stored", async () => {
		serve({ created: { notCreated: { c: { type: "overQuota" } } } });
		expect(await composeMessage(SESSION, input({ op: "draft" }))).toEqual({
			kind: "refused",
			reason: "overQuota",
			draftId: null,
		});
		serve({ created: {} });
		expect(await composeMessage(SESSION, input({ op: "draft" }))).toEqual({
			kind: "refused",
			reason: "serverFail",
			draftId: null,
		});
	});

	it("stops without an identity", async () => {
		const seen = serve({ sender: false });
		expect(await composeMessage(SESSION, input())).toEqual({
			kind: "noSender",
		});
		expect(calls(seen, "Email/set")).toHaveLength(0);
	});
});

describe("composeMessage: sending", () => {
	it("stores, submits with no envelope of its own, then removes the working copy and the old draft", async () => {
		const seen = serve();
		expect(
			await composeMessage(SESSION, input({ draftId: "old-1" })),
		).toEqual({ kind: "sent" });
		expect(calls(seen, "EmailSubmission/set")[0]).toEqual({
			accountId: "admin",
			create: { s: { emailId: "new-1" } },
		});
		const destroyed = calls(seen, "Email/set").flatMap(
			(c) => (c as { destroy?: string[] }).destroy ?? [],
		);
		expect(destroyed).toEqual(["new-1", "old-1"]);
	});

	it("keeps the work as a draft and says why when the server refuses to send", async () => {
		const seen = serve({
			submission: {
				notCreated: {
					s: {
						type: "forbiddenToSend",
						description: "words from the server",
					},
				},
			},
		});
		const result = await composeMessage(
			SESSION,
			input({ draftId: "old-1" }),
		);
		expect(result).toEqual({
			kind: "refused",
			reason: "forbiddenToSend",
			draftId: "new-1",
		});
		expect(JSON.stringify(result)).not.toContain("words");
		const destroyed = calls(seen, "Email/set").flatMap(
			(c) => (c as { destroy?: string[] }).destroy ?? [],
		);
		expect(destroyed).toEqual(["old-1"]);
	});

	it("reads an unknown refusal as a server failure", async () => {
		serve({ submission: {} });
		expect(await composeMessage(SESSION, input())).toEqual({
			kind: "refused",
			reason: "serverFail",
			draftId: "new-1",
		});
	});

	it("is not undone by a failure to clean up", async () => {
		stubJmap({
			"Identity/get": {
				list: [{ id: "a", name: "Ana", email: "a@x.org" }],
			},
			"Mailbox/get": { list: [] },
			"Email/get": {
				list: [
					emailFixture({
						id: "old-1",
						keywords: { $draft: true },
						mailboxIds: { Drafts: true },
					}),
				],
			},
			"Email/set": (args: Record<string, unknown>) => {
				if (args["destroy"]) {
					throw new Error("down");
				}
				return { created: { c: { id: "n" } } };
			},
			"EmailSubmission/set": { created: { s: {} } },
		});
		expect(
			await composeMessage(SESSION, input({ draftId: "old-1" })),
		).toEqual({ kind: "sent" });
	});
});

describe("composeMessage: the message it answers or forwards", () => {
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

describe("composeMessage: only a draft is replaced", () => {
	const serveWith = (email: Record<string, unknown> | null) =>
		stubJmap({
			"Identity/get": {
				list: [{ id: "a", name: "Ana", email: "a@x.org" }],
			},
			"Mailbox/get": {
				list: [
					{ id: "Drafts", role: "drafts" },
					{ id: "INBOX", role: "inbox" },
				],
			},
			"Email/get": {
				list: email === null ? [] : [email],
				notFound: email === null ? ["victim"] : [],
			},
			"Email/set": { created: { c: { id: "new-1" } } },
			"EmailSubmission/set": { created: { s: {} } },
		});
	const writes = (seen: ReturnType<typeof stubJmap>) =>
		seen
			.flatMap((r) => r.calls)
			.filter(
				(c) => c[0] === "Email/set" || c[0] === "EmailSubmission/set",
			);

	it("refuses a draft id that names an ordinary message, and writes and destroys nothing", async () => {
		for (const op of ["draft", "send"] as const) {
			const seen = serveWith(
				emailFixture({
					id: "victim",
					keywords: { $seen: true },
					mailboxIds: { INBOX: true },
				}),
			);
			expect(
				await composeMessage(SESSION, input({ op, draftId: "victim" })),
			).toEqual({ kind: "refused", reason: "invalid", draftId: null });
			expect(writes(seen)).toHaveLength(0);
		}
	});

	it("refuses a message that has $draft but is not in the drafts folder, and one in drafts without $draft", async () => {
		for (const email of [
			emailFixture({
				id: "victim",
				keywords: { $draft: true },
				mailboxIds: { INBOX: true },
			}),
			emailFixture({
				id: "victim",
				keywords: { $seen: true },
				mailboxIds: { Drafts: true },
			}),
			emailFixture({
				id: "victim",
				keywords: { $draft: false },
				mailboxIds: { Drafts: true },
			}),
			emailFixture({
				id: "victim",
				keywords: undefined,
				mailboxIds: undefined,
			}),
		]) {
			const seen = serveWith(email);
			expect(
				await composeMessage(SESSION, input({ draftId: "victim" })),
			).toMatchObject({ kind: "refused", reason: "invalid" });
			expect(writes(seen)).toHaveLength(0);
		}
	});

	it("refuses an id the account does not have, which is what another account's message looks like to this one", async () => {
		const seen = serveWith(null);
		expect(
			await composeMessage(
				SESSION,
				input({ op: "draft", draftId: "victim" }),
			),
		).toEqual({ kind: "refused", reason: "invalid", draftId: null });
		expect(writes(seen)).toHaveLength(0);
	});

	it("asks the server about the draft id only when one is given", async () => {
		const seen = serve();
		await composeMessage(SESSION, input({ op: "draft" }));
		expect(
			seen.flatMap((r) => r.calls).filter((c) => c[0] === "Email/get"),
		).toHaveLength(0);
	});
});

describe("composeMessage: attachment names", () => {
	const nameOf = async (name: string) => {
		const seen = serve();
		await composeMessage(
			SESSION,
			input({
				op: "draft",
				attachments: [
					{
						blobId: "00000000-0000-4000-a000-000000000001",
						name,
						type: "application/pdf",
					},
				],
			}),
		);
		const create = (
			calls(seen, "Email/set")[0] as {
				create: { c: { attachments: Array<{ name: string }> } };
			}
		).create.c;
		return create.attachments[0]?.name;
	};

	it("cleans a name that would reach a MIME header: line breaks, NUL, bidi and path separators", async () => {
		expect(await nameOf("a.pdf\r\nContent-Type: text/html")).toBe("html");
		expect(await nameOf("evil\u0000.pdf")).toBe("evil .pdf");
		expect(await nameOf("../../etc/passwd")).toBe("passwd");
		expect(await nameOf("C:\\dir\\x.exe")).toBe("x.exe");
		expect(await nameOf("photo\u202Egpj.exe")).toBe("photogpj.exe");
		expect(await nameOf('a"; filename="b.exe')).not.toMatch(/["\\/;]/u);
	});

	it("falls back to a fixed name when nothing is left, and cuts 255 multibyte characters", async () => {
		expect(await nameOf("")).toBe("attachment");
		expect(await nameOf("..")).toBe("attachment");
		expect(await nameOf("\u202E\u0000")).toBe("attachment");
		const long = await nameOf(`${"é".repeat(250)}.pdf`);
		expect(long?.length).toBeLessThanOrEqual(120);
		expect(long?.endsWith(".pdf")).toBe(true);
	});

	it("keeps an ordinary name", async () => {
		expect(await nameOf("Quarterly report 2026.pdf")).toBe(
			"Quarterly report 2026.pdf",
		);
	});
});
