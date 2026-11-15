import "server-only";

import { readOperatorTimeZone } from "../time-zone";

export function checkTimeZoneAtStart(
	fail: (message: string) => never = (message) => {
		console.error(message);
		process.exit(1);
	},
): void {
	try {
		readOperatorTimeZone();
	} catch (error) {
		fail(
			error instanceof Error
				? error.message
				: "the time zone is not usable",
		);
	}
}
