/** A non-negative whole number of at most six digits. */
const DIGITS = /^[0-9]{1,6}$/u;

/** A language tag in the plain shape BCP 47 uses. */
const LANGUAGE = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8}){0,4}$/u;

type Check = (value: string) => string | null;

const digits: Check = (value) =>
	DIGITS.test(value.trim()) ? value.trim() : null;
const oneOf =
	(...allowed: string[]): Check =>
	(value) => {
		const lower = value.trim().toLowerCase();
		return allowed.includes(lower) ? lower : null;
	};
const text: Check = (value) => (value.length <= 512 ? value : null);

/** Attributes any kept element may carry, with the check each value must pass. */
const GLOBAL: Record<string, Check> = {
	dir: oneOf("ltr", "rtl", "auto"),
	lang: (value) => (LANGUAGE.test(value.trim()) ? value.trim() : null),
	title: text,
};

/**
 * Attributes a given element may carry besides the global ones. `href` and
 * `src` are not here: they go through the link policy in `sanitize-html`, so a
 * value is never copied as written. No `style`, `class`, `id`, `name`,
 * `srcset`, `background` or event handler is ever kept.
 */
const BY_TAG: Record<string, Record<string, Check>> = {
	img: { alt: text, width: digits, height: digits },
	table: {
		border: digits,
		cellpadding: digits,
		cellspacing: digits,
		width: digits,
	},
	td: {
		colspan: digits,
		rowspan: digits,
		align: oneOf("left", "right", "center", "justify"),
		width: digits,
	},
	th: {
		colspan: digits,
		rowspan: digits,
		align: oneOf("left", "right", "center", "justify"),
		width: digits,
	},
	col: { span: digits },
	colgroup: { span: digits },
	ol: { start: digits, type: oneOf("1", "a", "i") },
	li: { value: digits },
	p: { align: oneOf("left", "right", "center", "justify") },
	div: { align: oneOf("left", "right", "center", "justify") },
	time: { datetime: text },
	q: {},
	blockquote: {},
	hr: {},
};

/**
 * The checked value of attribute `name` on `tag`, or `null` when the attribute
 * is not allowed there or its value fails its check.
 */
export function checkedAttribute(
	tag: string,
	name: string,
	value: string,
): string | null {
	const check = BY_TAG[tag]?.[name] ?? GLOBAL[name];
	return check ? check(value) : null;
}
