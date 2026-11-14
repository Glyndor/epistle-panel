/**
 * Values that are not a list density but look like one, or try to carry
 * something else along: what a tampered cookie or a forged action argument
 * holds. Every reader of the density must treat each of them as no choice.
 */
export const HOSTILE_DENSITY_VALUES: readonly string[] = [
	"",
	"dense",
	"cozy",
	// Case and neighbours of a density.
	"Compact",
	"COMPACT",
	"Comfortable",
	"compact ",
	" compact",
	"compact\n",
	"compact\0",
	"compact comfortable",
	"compact,comfortable",
	// Attribute, markup and cookie-attribute injection.
	'compact" onload="alert(1)',
	'"><script>alert(1)</script>',
	"compact; Path=/",
	"compact\r\nSet-Cookie: a=b",
	"../compact",
	// Prototype keys, which an object lookup would accept.
	"__proto__",
	"constructor",
	"toString",
	// Far longer than any density.
	"c".repeat(10_000),
];
