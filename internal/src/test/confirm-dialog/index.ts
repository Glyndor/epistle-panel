import { expect } from "bun:test";
import {
	act,
	fireEvent,
	screen,
	waitFor,
	within,
} from "@testing-library/react";

/**
 * Answer the alert dialog a `ConfirmAction` opens: wait for it, press Continue
 * or Cancel (the test catalog returns the message keys, `proceed` and
 * `cancel`) and wait for it to close.
 */
export async function answerConfirm(accept: boolean): Promise<void> {
	const dialog = await screen.findByRole("alertdialog");
	fireEvent.click(
		within(dialog).getByRole("button", {
			name: accept ? "proceed" : "cancel",
		}),
	);
	await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
}

/**
 * Let the work a test left in flight (a request that answers after the last
 * assertion, and the toast it raises) finish before the test cleans up, so
 * nothing lands in the next test's shared toast store.
 */
export async function settle(): Promise<void> {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 20));
	});
}
