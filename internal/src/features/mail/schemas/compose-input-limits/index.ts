/** Largest body the composer sends, in characters. No schema library here, so a client component can import it cheaply. */
export const MAX_COMPOSE_TEXT = 1_000_000;

/** Longest recipient field (To, Cc, Bcc) the composer reads, in characters. */
export const MAX_RECIPIENTS_TEXT = 20_000;

/** Longest subject, in characters: the line length limit of a message header (RFC 5322). */
export const MAX_SUBJECT = 998;

/** Most attachments one message carries. */
export const MAX_COMPOSE_ATTACHMENTS = 20;

/** Largest file the composer attaches, in bytes: epistle's message size cap, 25 MiB. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
