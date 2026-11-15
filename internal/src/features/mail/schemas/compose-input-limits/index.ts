/**
 * The limits the composer works with, as one object that every layer reads:
 * the browser's attributes, the form's schema and the route's own checks. No
 * schema library here, so a client component can import it cheaply.
 */
export interface ComposeLimits {
	/** Largest body the composer sends, in characters. */
	readonly maxText: number;
	/** Longest recipient field (To, Cc, Bcc) the composer reads, in characters. */
	readonly maxRecipientsText: number;
	/** Longest subject, in characters: the line length limit of a message header (RFC 5322). */
	readonly maxSubject: number;
	/**
	 * Largest request the composer's route reads, in bytes of JSON. The body's
	 * limit above is in characters, and a character outside ASCII is two to four
	 * bytes, so a long message in another script can pass that limit and still
	 * be over this one: the form measures the request before it sends it.
	 */
	readonly maxRequestBytes: number;
	/** Largest file the composer attaches, in bytes. */
	readonly maxAttachmentBytes: number;
	/** Largest total of attachment bytes, or no total limit when unpublished. */
	readonly maxTotalAttachmentBytes: number | null;
	/** Most attachments one message carries. */
	readonly maxAttachments: number;
	/** Most recipients one recipient field takes. */
	readonly maxRecipients: number;
}

/**
 * What the JMAP session publishes, as far as the composer cares. A number that
 * is not there is not a limit, and the panel keeps the one it held.
 */
export interface SessionLimits {
	/** The largest upload the server accepts, in bytes (`maxSizeUpload`). */
	readonly maxSizeUpload: number | null;
	/** The largest request the server accepts, in bytes (`maxSizeRequest`). */
	readonly maxSizeRequest: number | null;
	/** The total attachment budget, absent on servers that publish none. */
	readonly maxSizeAttachmentsPerEmail?: number | null;
}

/**
 * Most recipients one recipient field takes: epistle's default
 * `max-recipients` is 100 for the whole message. The session does not publish
 * it, so this is the panel's own number.
 */
export const MAX_RECIPIENTS = 100;

/**
 * The limits the panel works with when the mail server publishes none: the
 * numbers the composer held before it asked the server (25 MiB of attachment,
 * 1.5 MB of request, 20 attachments, 100 recipients). They are the floor that
 * works with any epistle, not a policy of their own.
 */
export const FALLBACK_COMPOSE_LIMITS: ComposeLimits = {
	maxText: 1_000_000,
	maxRecipientsText: 20_000,
	maxSubject: 998,
	maxRequestBytes: 1_500_000,
	maxAttachmentBytes: 25 * 1024 * 1024,
	maxTotalAttachmentBytes: null,
	maxAttachments: 20,
	maxRecipients: MAX_RECIPIENTS,
};

/**
 * The limits the composer works with: the server's numbers when it publishes
 * them, the panel's own when it does not.
 *
 * The server is the gate, so the panel takes its numbers: it must never refuse
 * what the server accepts nor let through what the server refuses. Two limits
 * are the panel's own, because the session does not publish them: how many
 * attachments a message may carry and how many recipients a field may take.
 * The session says nothing about either, so the panel keeps what it had.
 */
export function composeLimits(published: SessionLimits | null): ComposeLimits {
	if (published === null) {
		return FALLBACK_COMPOSE_LIMITS;
	}
	return {
		...FALLBACK_COMPOSE_LIMITS,
		maxTotalAttachmentBytes: published.maxSizeAttachmentsPerEmail ?? null,
		maxRequestBytes:
			published.maxSizeRequest ?? FALLBACK_COMPOSE_LIMITS.maxRequestBytes,
		maxAttachmentBytes:
			published.maxSizeUpload ??
			FALLBACK_COMPOSE_LIMITS.maxAttachmentBytes,
	};
}
