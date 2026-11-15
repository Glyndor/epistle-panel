import "server-only";

import { readSessionPolicy } from "../session-policy";

/**
 * Settle the session policy when the server starts.
 *
 * A lifetime that is not a whole number of minutes, or an idle timeout
 * outside the accepted range, is a mistake an operator must hear about: a
 * server that kept running would answer requests with a policy nobody chose,
 * and an idle timeout that does not parse must not turn into "no idle
 * timeout". So the start logs the message, which names the variable and never
 * the value, and stops with a non-zero status. Next does not stop on its own
 * when the instrumentation hook throws.
 */
export function checkSessionPolicyAtStart(
	fail: (message: string) => never = (message) => {
		console.error(message);
		process.exit(1);
	},
): void {
	try {
		readSessionPolicy();
	} catch (error) {
		fail(
			error instanceof Error
				? error.message
				: "the session policy is not usable",
		);
	}
}
