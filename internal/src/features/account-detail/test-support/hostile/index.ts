/**
 * Values a hostile or confused caller sends where an account name is expected:
 * path steps, escapes, a header split, a look-alike letter, a different case,
 * a name too long and an empty one. Every one of them has to be refused before
 * it can become part of an API path.
 */
export const HOSTILE_NAMES: readonly string[] = [
	"..",
	".",
	"../status",
	"../../api/v1/queue",
	"alice/../bob",
	"alice/password",
	"alice%2fpassword",
	"%2e%2e",
	"%2e%2e%2fstatus",
	"alice%00",
	"alice\0",
	"alice\r\nHost: evil.test",
	"alice\nX-Admin: 1",
	"Alice",
	"ALICE",
	"ålice",
	"аlice",
	"alice‮",
	"alice ",
	" alice",
	"alice?queue=drain",
	"alice#frag",
	"-alice",
	"a".repeat(65),
	"",
];

/** The same names as a UUID is expected: anything that is not one. */
export const HOSTILE_IDS: readonly string[] = [
	"..",
	"../status",
	"x",
	"01890a5d-ac96-774b-b9aa-9be4c3bd6b0e/../..",
	"01890a5d-ac96-774b-b9aa-9be4c3bd6b0e\n",
	"",
];
