import "server-only";

import { ADMIN_ID_VARIABLE, readAdminIdState } from "@/lib/config/admin-id";

/**
 * Settle the admin area when the server starts. No id logs one warning and the
 * panel starts with the admin area off. An id that is set but unusable (not a
 * lower-case UUID v4, or a file that cannot be read) is a mistake an operator
 * must hear about, and a server that kept running would answer 404 to every
 * admin path with nothing but a stack in its log, so it logs the message, which
 * names the variable and never the value, and stops with a non-zero status.
 * Next does not stop on its own when the instrumentation hook throws.
 */
export async function checkAdminIdAtStart(
	warn: (message: string) => void = console.warn,
	fail: (message: string) => never = (message) => {
		console.error(message);
		process.exit(1);
	},
): Promise<void> {
	let state: Awaited<ReturnType<typeof readAdminIdState>>;
	try {
		state = await readAdminIdState();
	} catch (error) {
		return fail(
			error instanceof Error
				? error.message
				: `${ADMIN_ID_VARIABLE} is unusable`,
		);
	}
	if (state.state === "disabled") {
		warn(
			`${ADMIN_ID_VARIABLE} is not set: the admin area is off and every path under /app except /app/mail answers 404`,
		);
	}
}
