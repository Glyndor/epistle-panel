import "server-only";

import { readDefaultLocale } from "../default-locale";

/**
 * Settle the default language when the server starts.
 *
 * A language the panel does not ship is a mistake an operator must hear
 * about: a server that kept running would answer every request in a language
 * nobody chose, or in English while the operator believed otherwise. So the
 * start logs the message, which names the variable and never the value, and
 * stops with a non-zero status.
 */
export function checkDefaultLocaleAtStart(
	fail: (message: string) => never = (message) => {
		console.error(message);
		process.exit(1);
	},
): void {
	try {
		readDefaultLocale();
	} catch (error) {
		fail(
			error instanceof Error
				? error.message
				: "the default language is not usable",
		);
	}
}
