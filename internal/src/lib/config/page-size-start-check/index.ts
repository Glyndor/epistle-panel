import "server-only";

import { readOperatorPageSize } from "../page-size";

export function checkPageSizeAtStart(
	fail: (message: string) => never = (message) => {
		console.error(message);
		process.exit(1);
	},
): void {
	try {
		readOperatorPageSize();
	} catch (error) {
		fail(
			error instanceof Error
				? error.message
				: "the page size is not usable",
		);
	}
}
