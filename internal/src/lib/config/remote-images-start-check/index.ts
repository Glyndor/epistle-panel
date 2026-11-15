import "server-only";

import { readOperatorRemoteImagesMode } from "../remote-images";

export function checkRemoteImagesAtStart(
	fail: (message: string) => never = (message) => {
		console.error(message);
		process.exit(1);
	},
): void {
	try {
		readOperatorRemoteImagesMode();
	} catch (error) {
		fail(
			error instanceof Error
				? error.message
				: "the remote image mode is not usable",
		);
	}
}
