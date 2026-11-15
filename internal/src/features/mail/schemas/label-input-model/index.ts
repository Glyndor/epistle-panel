/**
 * Most messages one label request names. A selection longer than this is sent
 * in several requests, each a bounded read and a bounded write of whole
 * keyword sets. Kept apart from the schema, which brings zod: the browser
 * cuts a selection to this size and must not carry the schema to do it.
 */
export const LABEL_BATCH = 50;
