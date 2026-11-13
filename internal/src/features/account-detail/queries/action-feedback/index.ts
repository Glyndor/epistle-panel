import { toast } from "@/components/ui/toaster";
import { ActionError } from "@/lib/query/action-result";

/** Where the browser goes when an action finds the session ended. */
function goToLogin(): void {
	window.location.assign("/login");
}

/**
 * Report an action that did not answer: a session that ended sends the person
 * to sign in again, anything else is the error toast with `message`. Queries do
 * the first through the query client; a change made outside Query needs it here.
 */
export function reportFailure(error: unknown, message: string): void {
	if (error instanceof ActionError && error.reason === "unauthenticated") {
		goToLogin();
		return;
	}
	toast.error(message);
}
