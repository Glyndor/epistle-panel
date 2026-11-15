/**
 * Values that are not a shipped locale but look like one, or try to carry
 * something else along: what a tampered cookie or a forged form field holds.
 * Every reader and writer of the language must treat each of them as no
 * choice.
 */
export const HOSTILE_LOCALE_VALUES: readonly string[] = [
	"",
	"ja",
	"xx",
	// Case and neighbours of a shipped code.
	"ES",
	"Pt",
	"DE",
	"pt-BR",
	"fr-FR",
	"en ",
	" en",
	"en\n",
	"en\0",
	// Path and cookie-attribute injection.
	"../en",
	"../../etc/passwd",
	"en/../es",
	"es; Path=/",
	"es\r\nSet-Cookie: a=b",
	// Prototype keys, which an object lookup would accept.
	"__proto__",
	"constructor",
	"toString",
	// Far longer than any code.
	"e".repeat(10_000),
	`${"../".repeat(2_000)}en`,
];
