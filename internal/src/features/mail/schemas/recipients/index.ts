import { safeLine } from "@/features/mail/sanitize/safe-text";

/** Most recipients one field takes: epistle's default `max-recipients` is 100 for the whole message. */
export const MAX_RECIPIENTS = 100;

/** An address as the composer reads it: one `@`, no space, control, format or bidi character, at most 254 characters. */
const ADDRESS = /^[^\s@\p{C}<>(),;:"[\]\\]+@[^\s@\p{C}<>(),;:"[\]\\]+$/u;

/** One recipient: an address and an optional name. */
export interface Recipient {
	readonly name?: string | undefined;
	readonly email: string;
}

/** Whether `value` is an address the composer accepts. */
export function isAddress(value: string): boolean {
	return value.length <= 254 && ADDRESS.test(value);
}

/** The result of reading a recipient field. */
export interface ParsedRecipients {
	readonly recipients: Recipient[];
	/** The pieces that were not addresses, as typed, for the field to name. */
	readonly invalid: string[];
}

/**
 * Read a recipient field: addresses separated by commas, semicolons or line
 * breaks, each either `a@b` or `Name <a@b>`. Nothing is guessed: a piece that is
 * not one of those two forms is reported, not repaired. A name is cleaned of
 * controls and bidi characters and cut at 200 characters, and quotes around it
 * are dropped.
 */
export function parseRecipients(text: string): ParsedRecipients {
	const recipients: Recipient[] = [];
	const invalid: string[] = [];
	for (const raw of splitList(text)) {
		const piece = raw.trim();
		if (piece === "") {
			continue;
		}
		const angle = /^([\s\S]*)<([^<>]*)>$/u.exec(piece);
		const email = (angle ? angle[2] : piece)?.trim() ?? "";
		if (!isAddress(email)) {
			invalid.push(piece);
			continue;
		}
		const name = angle
			? safeLine(angle[1] ?? "")
					.replace(/^"(.*)"$/u, "$1")
					.trim()
					.slice(0, 200)
			: "";
		recipients.push(name === "" ? { email } : { name, email });
	}
	return { recipients, invalid };
}

/** Split on commas, semicolons and line breaks that are not inside a quoted name. */
function splitList(text: string): string[] {
	const pieces: string[] = [];
	let current = "";
	let quoted = false;
	for (const char of text) {
		if (char === '"') {
			quoted = !quoted;
		}
		if (!quoted && (char === "," || char === ";" || char === "\n")) {
			pieces.push(current);
			current = "";
		} else {
			current += char;
		}
	}
	pieces.push(current);
	return pieces;
}

/** Write recipients back as the text of a field. */
export function formatRecipients(list: readonly Recipient[]): string {
	return list
		.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email))
		.join(", ");
}
