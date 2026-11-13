import { json } from "../responses";
import { MAILBOXES, type SeedMessage, seedMessages } from "./messages";
import { partBlob, toEmail } from "./render";

/** The account the stand-in keeps a mailbox for; the others answer `accountNotFound`. */
export const MAIL_ACCOUNT = "admin";

type Call = [string, Record<string, unknown>, string];

/**
 * The JMAP part of the stand-in: `Mailbox/get`, `Email/query` (a mailbox filter
 * only, every id, newest first, as epistle answers it), `Email/get` and the blob
 * download, which sends no `Content-Disposition`, as epistle does. It keeps its
 * state in memory and `reset` puts the seed back.
 */
export function createJmapStore() {
	let messages: SeedMessage[] = seedMessages();
	let fresh = 0;
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

	function method([name, args, id]: Call) {
		if (args["accountId"] !== MAIL_ACCOUNT) {
			return ["error", { type: "accountNotFound" }, id];
		}
		const result =
			name === "Mailbox/get" ? mailboxGet(args) : name === "Email/query" ? emailQuery(args) : name === "Email/get" ? emailGet(args) : name === "Email/set" ? emailSet(args) : undefined;
		if (result === undefined) {
			return ["error", { type: "unknownMethod" }, id];
		}
		return result === null ? ["error", { type: "requestTooLarge" }, id] : [name, result, id];
	}

	async function handle(request: Request, url: URL): Promise<Response | null> {
		if (url.pathname === "/jmap/api" && request.method === "POST") {
			const body = (await request.json()) as { methodCalls?: Call[] };
			return json({ methodResponses: (body.methodCalls ?? []).map(method), sessionState: "0" });
		}
		const download = /^\/jmap\/download\/([^/]+)\/([^/]+)\/[^/]*$/.exec(url.pathname);
		if (download && request.method === "GET") {
			const [account, blobId] = [decodeURIComponent(download[1] ?? ""), decodeURIComponent(download[2] ?? "")];
			const message = messages.find((m) => m.id === blobId.split(".")[0]);
			const blob = account === MAIL_ACCOUNT && message ? partBlob(message, blobId) : null;
			return blob
				? new Response(blob.content, { headers: { "Content-Type": blob.type } })
				: json({ type: "urn:ietf:params:jmap:error:notFound" }, 404);
		}
		return null;
	}

	return {
		handle,
		reset() {
			messages = seedMessages();
			fresh = 0;
		},
		snapshot: () => messages.map((m) => ({ id: m.id, mailbox: m.mailbox, keywords: m.keywords, subject: m.subject })),
	};
}
