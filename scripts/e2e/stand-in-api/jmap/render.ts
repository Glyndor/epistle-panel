import type { Addr, SeedMessage } from "./messages";

interface Part {
	partId: string | null;
	blobId: string | null;
	size: number;
	name: string | null;
	type: string;
	charset: string | null;
	disposition: string | null;
	cid: string | null;
	headers?: Array<{ name: string; value: string }>;
	subParts?: Part[];
	/** The octets of a leaf, kept aside for the download and the body values. */
	content?: string;
}

/** The structure of a message as epistle's MIME walk would number it. */
export function buildParts(m: SeedMessage): Part {
	let next = 0;
	const leaf = (type: string, content: string, extra: Partial<Part> = {}): Part => {
		const index = next++;
		return {
			partId: String(index),
			blobId: `${m.id}.${index}`,
			size: content.length,
			name: null,
			type,
			charset: type.startsWith("text/") ? "utf-8" : null,
			disposition: null,
			cid: null,
			content,
			...extra,
		};
	};
	const multipart = (type: string, build: () => Part[]): Part => {
		const index = next++;
		void index;
		return { partId: null, blobId: null, size: 0, name: null, type, charset: null, disposition: null, cid: null, subParts: build() };
	};
	const body = (): Part => {
		if (m.text !== undefined && m.html !== undefined) {
			return multipart("multipart/alternative", () => [
				leaf("text/plain", m.text ?? ""),
				leaf("text/html", m.html ?? ""),
			]);
		}
		return m.html !== undefined ? leaf("text/html", m.html) : leaf("text/plain", m.text ?? "");
	};
	if ((m.attachments ?? []).length > 0) {
		return multipart("multipart/mixed", () => [
			body(),
			...(m.attachments ?? []).map((a) =>
				leaf(a.type, a.content, { name: a.name, disposition: a.disposition ?? "attachment", charset: null }),
			),
		]);
	}
	return body();
}

function flatten(part: Part): Part[] {
	return [part, ...(part.subParts ?? []).flatMap(flatten)];
}

const address = (a: Addr) => (a.name === null ? a.email : `${a.name} <${a.email}>`);

/** The headers of the root part, raw, as the message would carry them. */
function rootHeaders(m: SeedMessage): Array<{ name: string; value: string }> {
	return [
		{ name: "From", value: m.from.map(address).join(", ") },
		{ name: "To", value: m.to.map(address).join(", ") },
		...(m.cc ? [{ name: "Cc", value: m.cc.map(address).join(", ") }] : []),
		{ name: "Subject", value: m.subject },
		{ name: "Date", value: new Date(m.receivedAt).toUTCString() },
		{ name: "Message-ID", value: `<${m.id}@example.test>` },
	];
}

const project = (part: Part): Record<string, unknown> => {
	const { content: _content, subParts, ...rest } = part;
	return { ...rest, ...(subParts ? { subParts: subParts.map(project) } : {}) };
};

/** An Email object as `Email/get` answers it for `m`. */
export function toEmail(m: SeedMessage, args: Record<string, unknown>): Record<string, unknown> {
	const root = buildParts(m);
	const leaves = flatten(root).filter((p) => p.partId !== null);
	const texts = leaves.filter((p) => p.type === "text/plain" && p.disposition === null);
	const htmls = leaves.filter((p) => p.type === "text/html" && p.disposition === null);
	const attachments = leaves.filter((p) => p.disposition === "attachment");
	const wantAll = args["fetchAllBodyValues"] === true;
	const bodyValues: Record<string, unknown> = {};
	const max = typeof args["maxBodyValueBytes"] === "number" ? (args["maxBodyValueBytes"] as number) : 0;
	for (const [flag, parts] of [["fetchTextBodyValues", texts], ["fetchHTMLBodyValues", htmls]] as const) {
		if (args[flag] === true || wantAll) {
			for (const part of parts) {
				const value = part.content ?? "";
				const truncated = max > 0 && value.length > max;
				bodyValues[part.partId ?? ""] = { value: truncated ? value.slice(0, max) : value, isEncodingProblem: false, isTruncated: truncated };
			}
		}
	}
	const rootNode = { ...project(root), headers: rootHeaders(m) };
	return {
		id: m.id,
		blobId: m.id,
		threadId: m.id,
		mailboxIds: { [m.mailbox]: true },
		keywords: m.keywords,
		size: 1000,
		receivedAt: m.receivedAt,
		subject: m.subject,
		from: m.from,
		to: m.to,
		cc: m.cc ?? null,
		bcc: null,
		replyTo: null,
		sender: null,
		messageId: [`${m.id}@example.test`],
		bodyStructure: rootNode,
		textBody: (texts.length > 0 ? texts : htmls).map(project),
		htmlBody: (htmls.length > 0 ? htmls : texts).map(project),
		attachments: attachments.map(project),
		hasAttachment: attachments.length > 0,
		preview: (m.text ?? m.html?.replace(/<[^>]*>/g, " ") ?? "").replace(/\s+/g, " ").trim().slice(0, 256),
		bodyValues,
	};
}

/** The octets and type of one part, by blob id, or `null`. */
export function partBlob(m: SeedMessage, blobId: string): { type: string; content: string } | null {
	const found = flatten(buildParts(m)).find((p) => p.blobId === blobId);
	return found?.content === undefined ? null : { type: found.type, content: found.content };
}
