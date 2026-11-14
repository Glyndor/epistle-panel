import type { EmailRecord } from "@/features/mail/jmap/responses";
import { hasKeyword } from "@/features/mail/labels/read-keywords";
import type {
	ListConditions,
	ListOrder,
} from "@/features/mail/schemas/list-conditions-model";

const DAY_MS = 86_400_000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The instant a `YYYY-MM-DD` day starts in UTC, or `NaN` when it is not one. */
function dayStart(day: string): number {
	const match = ISO_DAY.exec(day);
	return match === null
		? Number.NaN
		: Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** A message's `receivedAt` in milliseconds, or `NaN` when it is not a date. */
function receivedTime(email: Pick<EmailRecord, "receivedAt">): number {
	return new Date(email.receivedAt).getTime();
}

/**
 * The search of `q`, kept as the list has always read it: the subject, the
 * preview and the names and addresses of the senders and recipients, joined,
 * lower-cased and searched for the text lower-cased. No composition is
 * applied here, unlike the field conditions below.
 */
function matchesWords(email: EmailRecord, needle: string): boolean {
	if (needle === "") {
		return true;
	}
	const haystack = [
		email.subject,
		email.preview,
		...[...(email.from ?? []), ...(email.to ?? [])].flatMap((a) => [
			a.name,
			a.email,
		]),
	]
		.filter((part): part is string => typeof part === "string")
		.join("\n")
		.toLowerCase();
	return haystack.includes(needle.toLowerCase());
}

/** Text as a field condition compares it: composed, then lower-cased, so `é` matches whichever way it was written. */
function fold(text: string): string {
	return text.normalize("NFC").toLowerCase();
}

/** Whether `text` holds `needle`, already folded. A missing text holds nothing. */
function holds(text: string | null | undefined, needle: string): boolean {
	return typeof text === "string" && fold(text).includes(needle);
}

/** Whether one address of the field has `needle` in its name or its address. */
function matchesAddresses(
	addresses: EmailRecord["from"],
	needle: string,
): boolean {
	if (needle === "") {
		return true;
	}
	const folded = fold(needle);
	return (addresses ?? []).some(
		(address) =>
			holds(address.name, folded) || holds(address.email, folded),
	);
}

/**
 * Whether the message was received inside the days, both included, read in
 * UTC. A message whose date does not parse is inside no range.
 */
function matchesDays(
	email: EmailRecord,
	after: string | null,
	before: string | null,
): boolean {
	if (after === null && before === null) {
		return true;
	}
	const time = receivedTime(email);
	if (Number.isNaN(time)) {
		return false;
	}
	// A comparison with `NaN` is false, so a day that is not one keeps nothing.
	return (
		(after === null || time >= dayStart(after)) &&
		(before === null || time < dayStart(before) + DAY_MS)
	);
}

/**
 * Whether a message was not read: the server marks a message read with
 * `$seen`, and a message that carries no keyword at all was not read either.
 */
function isUnread(email: EmailRecord): boolean {
	return email.keywords?.["$seen"] !== true;
}

/**
 * Whether a message is kept by every condition of a list. The order is not a
 * condition and is read by {@link compareBy}. A condition at its default keeps
 * every message.
 */
export function matchesConditions(
	email: EmailRecord,
	conditions: ListConditions,
): boolean {
	return (
		matchesWords(email, conditions.q) &&
		matchesAddresses(email.from, conditions.from) &&
		matchesAddresses(email.to, conditions.to) &&
		(conditions.subject === "" ||
			holds(email.subject, fold(conditions.subject))) &&
		matchesDays(email, conditions.after, conditions.before) &&
		(conditions.label === null ||
			hasKeyword(email.keywords, conditions.label)) &&
		(!conditions.unread || isUnread(email)) &&
		(!conditions.starred || hasKeyword(email.keywords, "$flagged")) &&
		(!conditions.important || hasKeyword(email.keywords, "$important")) &&
		(!conditions.attachment || email.hasAttachment === true)
	);
}

/**
 * What the list is sorted by. `EmailRecord` does not ask the server for `size`
 * yet, so the size is optional here and a message without one weighs nothing.
 */
export type SortableEmail = Pick<EmailRecord, "receivedAt"> & {
	readonly size?: number | undefined;
};

/**
 * Newest first with `direction` 1, oldest first with -1. A message whose date
 * does not parse goes last either way.
 */
function byDate(a: SortableEmail, b: SortableEmail, direction: 1 | -1): number {
	const [first, second] = [receivedTime(a), receivedTime(b)];
	const [firstBad, secondBad] = [Number.isNaN(first), Number.isNaN(second)];
	if (firstBad || secondBad) {
		return firstBad === secondBad ? 0 : firstBad ? 1 : -1;
	}
	return first === second ? 0 : (first < second ? 1 : -1) * direction;
}

/** A message's size in bytes; missing or not a number weighs nothing. */
function sizeOf(email: SortableEmail): number {
	const size = email.size;
	return size !== undefined && Number.isFinite(size) ? size : 0;
}

/**
 * The comparison that sorts a list in `order`, for `Array.prototype.sort`.
 * `newest` and `oldest` go by `receivedAt`, `largest` by `size` and then
 * newest first. A message whose date does not parse goes last in either date
 * order. It answers 0 only for two messages that tie on everything it reads,
 * so a stable sort keeps the server's order between them.
 */
export function compareBy(
	order: ListOrder,
): (a: SortableEmail, b: SortableEmail) => number {
	switch (order) {
		case "newest":
			return (a, b) => byDate(a, b, 1);
		case "oldest":
			return (a, b) => byDate(a, b, -1);
		case "largest":
			return (a, b) => {
				const [first, second] = [sizeOf(a), sizeOf(b)];
				return first === second
					? byDate(a, b, 1)
					: first < second
						? 1
						: -1;
			};
	}
}
