import type { Addr, SeedMessage } from "./messages";

/** What the stand-in recorded of one message it was asked to send. */
export interface SentRecord {
	to: string[];
	cc: string[];
	bcc: string[];
	subject: string;
	text: string;
	attachments: string[];
	/** Whether the copy kept in Sent still carries a Bcc header, which it must not. */
	sentCopyHasBcc: boolean;
}

/** The address the stand-in's account sends from. */
export const IDENTITY: Addr & { id: string } = { id: "admin@example.test", name: "Admin", email: "admin@example.test" };

/** Recipients whose domain refuses, to exercise a refusal. */
const REFUSED_DOMAIN = "@blocked.test";

/**
 * The composing half of the stand-in: uploads, `Email/set` create, `Identity/get`
 * and `EmailSubmission/set`, with the refusals epistle gives (`forbiddenFrom`,
 * `noRecipients`, `tooManyRecipients`, `forbiddenToSend`). It keeps a record of
 * what was sent, with the Bcc kept off the copy in Sent as epistle does.
 */
export function createCompose(
	messages: () => SeedMessage[],
	replace: (next: SeedMessage[]) => void,
	freshId: () => string,
) {
	let blobs = new Map<string, { type: string; content: string }>();
	let sent: SentRecord[] = [];
	let uploads = 0;

	const attachmentContent = (blobId: string): { type: string; content: string } | null => {
		const stored = blobs.get(blobId);
		if (stored) {
			return stored;
		}
		return null;
	};

	return {
		identities() {
			return { accountId: "admin", state: "0", notFound: [], list: [{ ...IDENTITY, replyTo: null, bcc: null, textSignature: "", htmlSignature: "", mayDelete: false }] };
		},
		upload(bytes: Uint8Array, type: string) {
			uploads += 1;
			const blobId = `00000000-0000-4000-a000-${uploads.toString(16).padStart(12, "0")}`;
			blobs.set(blobId, { type: type || "application/octet-stream", content: new TextDecoder().decode(bytes) });
			return { accountId: "admin", blobId, type, size: bytes.byteLength };
		},
		blob: (blobId: string) => attachmentContent(blobId),
		emailCreate(args: Record<string, unknown>, fallback: (a: Record<string, unknown>) => unknown) {
			const created: Record<string, { id: string }> = {};
			const notCreated: Record<string, { type: string }> = {};
			for (const [creation, spec] of Object.entries(args["create"] as Record<string, Record<string, any>>)) {
				const box = Object.entries(spec["mailboxIds"] ?? {}).find(([, on]) => on)?.[0] ?? "INBOX";
				const values = (spec["bodyValues"] ?? {}) as Record<string, { value: string }>;
				const text = values[spec["textBody"]?.[0]?.partId ?? ""]?.value;
				if (text === undefined || !Array.isArray(spec["from"]) || spec["from"].length === 0) {
					notCreated[creation] = { type: "invalidProperties" };
					continue;
				}
				const files = ((spec["attachments"] ?? []) as Array<{ blobId: string; name: string; type: string }>).map((a) => {
					const found = attachmentContent(a.blobId) ?? stored(messages(), a.blobId);
					return found ? { name: a.name, type: a.type, content: found.content } : null;
				});
				if (files.includes(null)) {
					notCreated[creation] = { type: "invalidProperties" };
					continue;
				}
				const id = freshId();
				replace([
					...messages(),
					{
						id,
						mailbox: box,
						receivedAt: new Date().toISOString().replace(/\.\d+Z$/, "Z"),
						subject: spec["subject"] ?? "",
						from: spec["from"],
						to: spec["to"] ?? [],
						cc: spec["cc"] ?? [],
						bcc: spec["bcc"] ?? [],
						keywords: spec["keywords"] ?? {},
						text,
						attachments: files.flatMap((f) => (f ? [{ ...f, disposition: "attachment" as const }] : [])),
					},
				]);
				created[creation] = { id };
			}
			const rest = { ...args };
			delete rest["create"];
			const other = (rest["update"] || rest["destroy"]) ? (fallback(rest) as Record<string, unknown>) : {};
			return { accountId: "admin", oldState: "0", newState: "1", created, notCreated, updated: {}, notUpdated: {}, destroyed: [], notDestroyed: {}, ...other };
		},
		submit(args: Record<string, unknown>) {
			const created: Record<string, unknown> = {};
			const notCreated: Record<string, { type: string; description?: string }> = {};
			for (const [creation, spec] of Object.entries((args["create"] ?? {}) as Record<string, { emailId?: string }>)) {
				const message = messages().find((m) => m.id === spec.emailId);
				if (!message) {
					notCreated[creation] = { type: "notFound" };
					continue;
				}
				const all = [...message.to, ...(message.cc ?? []), ...(message.bcc ?? [])];
				if (message.from[0]?.email !== IDENTITY.email) {
					notCreated[creation] = { type: "forbiddenFrom" };
				} else if (all.length === 0) {
					notCreated[creation] = { type: "noRecipients" };
				} else if (all.length > 100) {
					notCreated[creation] = { type: "tooManyRecipients" };
				} else if (all.some((a) => a.email.endsWith(REFUSED_DOMAIN))) {
					notCreated[creation] = { type: "forbiddenToSend", description: "every recipient is on the suppression list" };
				} else {
					sent.push({
						to: message.to.map((a) => a.email),
						cc: (message.cc ?? []).map((a) => a.email),
						bcc: (message.bcc ?? []).map((a) => a.email),
						subject: message.subject,
						text: message.text ?? "",
						attachments: (message.attachments ?? []).map((a) => a.name),
						sentCopyHasBcc: false,
					});
					replace([...messages(), { ...message, id: freshId(), mailbox: "Sent", keywords: { $seen: true }, bcc: undefined as never }]);
					created[creation] = { id: `sub-${sent.length}`, sendAt: null };
				}
			}
			return { accountId: "admin", oldState: "0", newState: "0", created, notCreated };
		},
		sent: () => sent,
		reset() {
			blobs = new Map();
			sent = [];
			uploads = 0;
		},
	};
}

/** The octets of a part of a stored message, named `<message>.<part>`. */
function stored(all: SeedMessage[], blobId: string): { content: string } | null {
	const [id, part] = blobId.split(".");
	const message = all.find((m) => m.id === id);
	const index = Number(part) - (message?.attachments ? 2 : 0);
	const file = message?.attachments?.[index];
	return file ? { content: file.content } : null;
}
