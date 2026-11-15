import { json } from "../responses";
import { MAILBOXES, type SeedMessage, seedMessages } from "./messages";
import { partBlob, toEmail } from "./render";
import { createCompose } from "./compose";

/** The account the stand-in keeps a mailbox for; the others answer `accountNotFound`. */
export const MAIL_ACCOUNT = "admin";

type Call = [string, Record<string, unknown>, string];

/** Size of the blob the stand-in sends in its oversize mode, in MiB: over the 25 the panel relays. */
export const OVERSIZE_MEGABYTES = 27;

/** The limit `Quota/get` reports, in bytes: small, so the seeded mailbox reads as a visible share of it. */
export const QUOTA_LIMIT = 100_000;

/**
 * The limits the session resource publishes, as epistle's does: the largest
 * upload, the largest request, and how many objects one call may name.
 */
export const SESSION_LIMITS = {
	maxSizeUpload: 26_214_400,
	maxSizeRequest: 10_000_000,
	maxObjectsInGet: 500,
	maxObjectsInSet: 500,
};

/** The session resource, as epistle answers it. */
export function sessionResource(): Record<string, unknown> {
	return {
		capabilities: {
			"urn:ietf:params:jmap:core": { ...SESSION_LIMITS },
			"urn:ietf:params:jmap:mail": { maxSizeAttachmentsPerEmail: 24_000_000 },
		},
		accounts: { [MAIL_ACCOUNT]: { name: MAIL_ACCOUNT, isPersonal: true, isReadOnly: false, accountCapabilities: {} } },
		primaryAccounts: {},
		username: "",
		apiUrl: "/jmap/api",
		downloadUrl: "/jmap/download/{accountId}/{blobId}/{name}",
		uploadUrl: "/jmap/upload/{accountId}",
	};
}

/**
 * How `Quota/get` answers: `limited` is the seeded account under its limit,
 * `unlimited` the same quota with a `limit` of `null`, `none` an empty list, as
 * a server that keeps no quota for the account answers.
 */
export const QUOTA_MODES = ["limited", "unlimited", "none"] as const;
export type QuotaMode = (typeof QUOTA_MODES)[number];

/** A stream of `count` chunks of 1 MiB, sent as they are asked for, with no total declared. */
function megabytes(count: number): ReadableStream<Uint8Array> {
	let sent = 0;
	return new ReadableStream<Uint8Array>({
		pull(controller) {
			if (sent === count) {
				controller.close();
				return;
			}
			sent += 1;
			controller.enqueue(new Uint8Array(1_048_576));
		},
	});
}

/**
 * The JMAP part of the stand-in: `Mailbox/get`, `Email/query` (a mailbox filter
 * only, every id, newest first, as epistle answers it), `Email/get` and the blob
 * download, which sends no `Content-Disposition`, as epistle does. It keeps its
 * state in memory and `reset` puts the seed back.
 */
export function createJmapStore() {
	let messages: SeedMessage[] = seedMessages();
	let fresh = 0;
	let oversize = false;
	let quotaMode: QuotaMode = "limited";
	const freshId = () => `00000000-0000-4000-9000-${(++fresh).toString(16).padStart(12, "0")}`;

	const byMailbox = (box: string) =>
		messages
			.filter((m) => m.mailbox === box)
			.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));

	function mailboxGet(args: Record<string, unknown>) {
		return {
			accountId: MAIL_ACCOUNT,
			state: "0",
			notFound: [],
			list: MAILBOXES.filter((box) => !Array.isArray(args["ids"]) || (args["ids"] as string[]).includes(box.id)).map((box) => ({
				...box,
				totalEmails: byMailbox(box.id).length,
				unreadEmails: byMailbox(box.id).filter((m) => !m.keywords["$seen"]).length,
			})),
		};
	}

	/**
	 * `Quota/get` as epistle answers it: one quota for the account, in octets, with what the seeded messages weigh.
	 * In the `unlimited` mode its `limit` is `null`; in the `none` mode the list is empty.
	 */
	function quotaGet() {
		const used = messages.reduce((sum, m) => sum + (m.text?.length ?? 0) + (m.html?.length ?? 0) + (m.attachments ?? []).reduce((all, a) => all + a.content.length, 0), 0);
		return {
			accountId: MAIL_ACCOUNT,
			state: "0",
			notFound: [],
			list: quotaMode === "none" ? [] : [{ id: "mail", resourceType: "octets", used, scope: "account", name: "Mail storage", types: ["Mail"], limit: quotaMode === "unlimited" ? null : QUOTA_LIMIT }],
		};
	}

	function emailQuery(args: Record<string, unknown>) {
		const filter = args["filter"] as { inMailbox?: string } | undefined;
		const ids = byMailbox(filter?.inMailbox ?? "INBOX").map((m) => m.id);
		return { accountId: MAIL_ACCOUNT, queryState: "0", canCalculateChanges: false, position: 0, total: ids.length, ids };
	}

	function emailGet(args: Record<string, unknown>) {
		const wanted = Array.isArray(args["ids"]) ? (args["ids"] as string[]) : [];
		if (wanted.length > 500) {
			return null;
		}
		const found = wanted.map((id) => messages.find((m) => m.id === id));
		return {
			accountId: MAIL_ACCOUNT,
			state: "0",
			list: found.filter((m): m is SeedMessage => m !== undefined).map((m) => toEmail(m, args)),
			notFound: wanted.filter((_, i) => found[i] === undefined),
		};
	}

	/**
	 * `Email/set` as epistle does it: `keywords` replaces the whole set; a
	 * `mailboxIds` update is a move to the first key set, which gives the message a
	 * new id and drops the old one; `destroy` removes it.
	 */
	function emailSet(args: Record<string, unknown>) {
		const updated: Record<string, null> = {};
		const notUpdated: Record<string, { type: string }> = {};
		for (const [id, patch] of Object.entries((args["update"] ?? {}) as Record<string, Record<string, unknown>>)) {
			const message = messages.find((m) => m.id === id);
			if (!message) {
				notUpdated[id] = { type: "notFound" };
				continue;
			}
			if (patch["keywords"] !== undefined) {
				message.keywords = Object.fromEntries(Object.entries(patch["keywords"] as Record<string, boolean>).filter(([, on]) => on === true));
			}
			const target = Object.entries((patch["mailboxIds"] ?? {}) as Record<string, boolean>).find(([, on]) => on)?.[0];
			if (target !== undefined && target !== message.mailbox) {
				message.mailbox = target;
				message.id = freshId();
			}
			updated[id] = null;
		}
		const destroyed: string[] = [];
		const notDestroyed: Record<string, { type: string }> = {};
		for (const id of (args["destroy"] ?? []) as string[]) {
			const index = messages.findIndex((m) => m.id === id);
			if (index < 0) {
				notDestroyed[id] = { type: "notFound" };
			} else {
				messages.splice(index, 1);
				destroyed.push(id);
			}
		}
		return { accountId: MAIL_ACCOUNT, oldState: "0", newState: "1", created: {}, notCreated: {}, updated, notUpdated, destroyed, notDestroyed };
	}

	const compose = createCompose(() => messages, (next) => {
		messages = next;
	}, () => freshId());

	function method([name, args, id]: Call) {
		if (args["accountId"] !== MAIL_ACCOUNT) {
			return ["error", { type: "accountNotFound" }, id];
		}
		const result =
			name === "Mailbox/get" ? mailboxGet(args) : name === "Email/query" ? emailQuery(args) : name === "Email/get" ? emailGet(args) : name === "Email/set" ? (args["create"] ? compose.emailCreate(args, emailSet) : emailSet(args)) : name === "Identity/get" ? compose.identities() : name === "Quota/get" ? quotaGet() : name === "EmailSubmission/set" ? compose.submit(args) : undefined;
		if (result === undefined) {
			return ["error", { type: "unknownMethod" }, id];
		}
		return result === null ? ["error", { type: "requestTooLarge" }, id] : [name, result, id];
	}

	async function handle(request: Request, url: URL, note?: (names: string[]) => void): Promise<Response | null> {
		if (url.pathname === "/jmap/session" && request.method === "GET") {
			return json(sessionResource());
		}
		if (url.pathname === "/jmap/api" && request.method === "POST") {
			const body = (await request.json()) as { methodCalls?: Call[] };
			note?.((body.methodCalls ?? []).map(([name]) => name));
			return json({ methodResponses: (body.methodCalls ?? []).map(method), sessionState: "0" });
		}
		const upload = /^\/jmap\/upload\/([^/]+)$/.exec(url.pathname);
		if (upload && request.method === "POST") {
			return decodeURIComponent(upload[1] ?? "") === MAIL_ACCOUNT
				? json(compose.upload(new Uint8Array(await request.arrayBuffer()), request.headers.get("content-type") ?? ""))
				: json({ type: "urn:ietf:params:jmap:error:notFound" }, 404);
		}
		const download = /^\/jmap\/download\/([^/]+)\/([^/]+)\/[^/]*$/.exec(url.pathname);
		if (download && request.method === "GET") {
			const [account, blobId] = [decodeURIComponent(download[1] ?? ""), decodeURIComponent(download[2] ?? "")];
			const message = messages.find((m) => m.id === blobId.split(".")[0]);
			const uploaded = account === MAIL_ACCOUNT ? compose.blob(blobId) : null;
			const blob = uploaded ?? (account === MAIL_ACCOUNT && message ? partBlob(message, blobId) : null);
			if (blob && oversize) {
				return new Response(megabytes(OVERSIZE_MEGABYTES), { headers: { "Content-Type": blob.type } });
			}
			return blob
				? new Response(blob.content, { headers: { "Content-Type": blob.type } })
				: json({ type: "urn:ietf:params:jmap:error:notFound" }, 404);
		}
		return null;
	}

	return {
		handle,
		sent: () => compose.sent(),
		/** Answer every blob with 27 MiB and no declared size, past what the panel relays, or put the real blobs back. */
		oversizeBlobs(on: boolean) {
			oversize = on;
		},
		/** Answer `Quota/get` with a limit, with none, or with no quota at all, until the reset. */
		quota(mode: QuotaMode) {
			quotaMode = mode;
		},
		reset() {
			messages = seedMessages();
			fresh = 0;
			oversize = false;
			quotaMode = "limited";
			compose.reset();
		},
		snapshot: () => messages.map((m) => ({ id: m.id, mailbox: m.mailbox, keywords: m.keywords, subject: m.subject })),
	};
}
