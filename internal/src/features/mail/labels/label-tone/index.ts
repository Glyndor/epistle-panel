/** How many label tones the theme has: `--label-1` to `--label-8`. */
export const LABEL_TONES = 8;

/** A tone of the theme's label palette, from 1 to {@link LABEL_TONES}. */
export type LabelTone = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/**
 * The tone a label is drawn in until its owner can choose one: a number that
 * depends only on the label, so it is the same in every browser and after
 * every reload. `key` is the label's key (see `labelKey`), so two spellings
 * the server holds as one keyword share a tone. FNV-1a over its UTF-16 units.
 */
export function labelTone(key: string): LabelTone {
	let hash = 0x811c9dc5;
	for (let index = 0; index < key.length; index += 1) {
		hash ^= key.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (((hash >>> 0) % LABEL_TONES) + 1) as LabelTone;
}
