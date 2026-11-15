import "server-only";

import { readOperatorRefreshPace } from "../refresh";

export function checkRefreshAtStart(
	fail: (message: string) => never = (message) => {
		console.error(message);
		process.exit(1);
	},
): void {
	try {
		readOperatorRefreshPace();
	} catch (error) {
		fail(
			error instanceof Error
				? error.message
				: "the refresh pace is not usable",
		);
	}
}
