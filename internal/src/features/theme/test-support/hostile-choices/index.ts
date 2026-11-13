/**
 * Values that are not a theme choice but look like one, or try to carry
 * something else along: what a tampered cookie or a forged action argument
 * holds. Every reader of the choice must treat each of them as no choice.
 */
export const HOSTILE_THEME_VALUES: readonly string[] = [
	"",
	"auto",
	"sepia",
	// Case and neighbours of a choice.
	"Dark",
	"DARK",
	"LIGHT",
	"System",
	"dark ",
	" dark",
	"dark\n",
	"dark\0",
	"light dark",
	"dark,light",
	// Attribute, markup and cookie-attribute injection.
	'dark" onload="alert(1)',
	'"><script>alert(1)</script>',
	"dark; Path=/",
	"dark\r\nSet-Cookie: a=b",
	"../dark",
	// Prototype keys, which an object lookup would accept.
	"__proto__",
	"constructor",
	"toString",
	// Far longer than any choice.
	"d".repeat(10_000),
];
