/** Largest body the composer sends, in characters. No schema library here, so a client component can import it cheaply. */
export const MAX_COMPOSE_TEXT = 1_000_000;

/** Most attachments one message carries. */
export const MAX_COMPOSE_ATTACHMENTS = 20;

/** Largest file the composer attaches, in bytes: epistle's message size cap, 25 MiB. */
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
