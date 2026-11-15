import "server-only";

import { readCopyrightNotice } from "../copyright-notice";

/**
 * Settle the copyright line when the server starts.
 *
 * A line that cannot be shown is a mistake an operator must hear about: a
 * server that kept running would show a notice nobody chose, or none at all
 * while the operator believed otherwise. So the start logs the message, which
 * names the variable and never the value, and stops with a non-zero status.
 */
export function checkCopyrightNoticeAtStart(
	fail: (message: string) => never = (message) => {
		console.error(message);
		process.exit(1);
	},
): void {
	try {
		readCopyrightNotice();
	} catch (error) {
		fail(
			error instanceof Error
				? error.message
				: "the copyright line is not usable",
		);
	}
}
