import type { EmailRecord } from "@/features/mail/jmap/responses";
import { hasKeyword, readLabels } from "@/features/mail/labels/read-keywords";
import { safeLine } from "@/features/mail/sanitize/safe-text";
import type {
	AddressView,
	MailboxRole,
	MailboxView,
	MessageSummary,
} from "@/features/mail/schemas/mail-view";
import { MAILBOX_ROLES } from "@/features/mail/schemas/mail-view";

type AddressRecord = NonNullable<EmailRecord["from"]>[number];

/** Longest subject, name or address shown in a list row. */
const ROW_TEXT = 240;

/** Make the addresses of a JMAP header safe to show, dropping an entry with no address left. */
export function toAddresses(
	list: readonly AddressRecord[] | null | undefined,
): AddressView[] {
	const views: AddressView[] = [];
	for (const entry of list ?? []) {
		const email = safeLine(entry.email, 320);
		if (email === "") {
			continue;
		}
		const name = safeLine(entry.name ?? "", ROW_TEXT);
		views.push({ name: name === "" ? null : name, email });
	}
	return views;
}

/** A row of the message list from an Email. */
export function toSummary(email: EmailRecord): MessageSummary {
	const keywords = email.keywords ?? {};
	return {
		id: email.id,
		from: toAddresses(email.from)[0] ?? null,
		subject: safeLine(email.subject ?? "", ROW_TEXT),
		receivedAt: email.receivedAt,
		preview: safeLine(email.preview ?? "", ROW_TEXT),
		unread: keywords["$seen"] !== true,
		flagged: keywords["$flagged"] === true,
		important: hasKeyword(keywords, "$important"),
		answered: keywords["$answered"] === true,
		forwarded: hasKeyword(keywords, "$forwarded"),
		draft: keywords["$draft"] === true,
		hasAttachment: email.hasAttachment === true,
		labels: readLabels(keywords),
	};
}

function isRole(value: string | null | undefined): value is MailboxRole {
	return (MAILBOX_ROLES as readonly (string | null | undefined)[]).includes(
		value,
	);
}

interface MailboxRecord {
	readonly id: string;
	readonly name: string;
	readonly parentId?: string | null | undefined;
	readonly role?: string | null | undefined;
	readonly totalEmails: number;
	readonly unreadEmails: number;
}

/**
 * The folder tree in display order: the system folders first in the order of
 * {@link MAILBOX_ROLES}, then the rest by name, each followed by its children.
 * A parent that is not in the list (or a cycle) leaves the mailbox at the top
 * level, so no mailbox is ever lost from the tree.
 */
export function toMailboxTree(
	records: readonly MailboxRecord[],
): MailboxView[] {
	const ids = new Set(records.map((record) => record.id));
	const parentOf = (record: MailboxRecord) =>
		record.parentId &&
		record.parentId !== record.id &&
		ids.has(record.parentId)
			? record.parentId
			: null;
	const rank = (record: MailboxRecord) => {
		const index = isRole(record.role)
			? MAILBOX_ROLES.indexOf(record.role)
			: -1;
		return index === -1 ? MAILBOX_ROLES.length : index;
	};
	const byOrder = (a: MailboxRecord, b: MailboxRecord) =>
		rank(a) - rank(b) || a.name.localeCompare(b.name);
	const out: MailboxView[] = [];
	const seen = new Set<string>();
	const place = (record: MailboxRecord, depth: number) => {
		if (seen.has(record.id)) {
			return;
		}
		seen.add(record.id);
		out.push({
			id: record.id,
			name:
				safeLine(record.name, ROW_TEXT) ||
				safeLine(record.id, ROW_TEXT),
			role: isRole(record.role) ? record.role : null,
			parentId: parentOf(record),
			depth,
			unread: record.unreadEmails,
			total: record.totalEmails,
		});
		for (const child of records
			.filter((other) => parentOf(other) === record.id)
			.sort(byOrder)) {
			place(child, depth + 1);
		}
	};
	for (const record of records
		.filter((r) => parentOf(r) === null)
		.sort(byOrder)) {
		place(record, 0);
	}
	// A cycle never reaches the top level; keep whatever it left out.
	for (const record of records) {
		place(record, 0);
	}
	return out;
}
