import { afterEach, describe, expect, it, mock } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { clearToasts, Toaster } from "@/components/ui/toaster";
import { useActionEnvironment } from "@/features/account-detail/test-support/action-checks";
import { stubRoutes } from "@/features/account-detail/test-support/stub-routes";
import { sentRequests, stubFetchReject } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { withQuery } from "@/test/query-wrapper";

const cookies = mockRequestCookies();
const { DeleteAccountDialog } = await import(".");

afterEach(() => {
	cleanup();
	clearToasts();
});

const removed = (left: number, discarded: number) => ({
	body: {
		removed: "alice",
		mailbox_files: 1,
		masked_addresses: 0,
		app_passwords: 0,
		suppressed_addresses: 0,
		correspondent_addresses: 0,
		queued_messages_discarded: discarded,
		queued_messages_left: left,
		bayes_tokens_removed: 0,
	},
});
const deletes = () => sentRequests().filter((r) => r.method === "DELETE");
const confirm = () =>
	act(async () => {
		fireEvent.click(screen.getByRole("button", { name: "deleteConfirm" }));
	});

function setup() {
	const onOpenChange = mock((_open: boolean) => {});
	render(
		withQuery(
			<>
				<DeleteAccountDialog
					name="alice"
					open
					onOpenChange={onOpenChange}
				/>
				<Toaster label="toasts" closeLabel="close" />
			</>,
		),
	);
	return onOpenChange;
}

describe("DeleteAccountDialog", () => {
	useActionEnvironment(cookies);

	it("asks in an alert dialog, with letting queued mail be delivered chosen to start with", () => {
		setup();

		expect(
			screen.getByRole("alertdialog", { name: "deleteTitle" }),
		).toHaveAccessibleDescription("deleteHelp");
		expect(
			screen.getByRole("radiogroup", { name: "queueLegend" }),
		).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: "queueDrain" })).toBeChecked();
		expect(
			screen.getByRole("radio", { name: "queueDiscard" }),
		).not.toBeChecked();
		expect(deletes()).toHaveLength(0);
	});

	it("deletes with the safe choice by default and says how many messages will still be delivered", async () => {
		stubRoutes([["DELETE", /accounts\/alice$/, removed(2, 0)]]);
		const onOpenChange = setup();

		await confirm();

		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
		expect(screen.getByText("deletedLeft")).toBeInTheDocument();
		const [call, ...rest] = deletes();
		expect(rest).toHaveLength(0);
		expect(call?.url).toBe(
			"http://127.0.0.1:8025/api/v1/accounts/alice?queue=drain",
		);
	});

	it("drops the queued mail only when that is chosen, and says how many were dropped", async () => {
		stubRoutes([["DELETE", /accounts\/alice$/, removed(0, 3)]]);
		setup();

		fireEvent.click(screen.getByRole("radio", { name: "queueDiscard" }));
		await confirm();

		expect(await screen.findByText("deletedDiscarded")).toBeInTheDocument();
		expect(deletes()[0]?.url).toBe(
			"http://127.0.0.1:8025/api/v1/accounts/alice?queue=discard",
		);
	});

	it("says plainly that it is deleted when nothing was queued", async () => {
		stubRoutes([["DELETE", /accounts\/alice$/, removed(0, 0)]]);
		setup();

		await confirm();

		expect(await screen.findByText("deleted")).toBeInTheDocument();
	});

	it("says the account is not there, or not the API's to delete, on a 404", async () => {
		stubRoutes([]);
		const onOpenChange = setup();

		await confirm();

		expect(await screen.findByText("deleteGone")).toBeInTheDocument();
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});

	it("reports a server that does not answer, and closes", async () => {
		stubFetchReject();
		const onOpenChange = setup();

		await confirm();

		expect(await screen.findByText("unavailable")).toBeInTheDocument();
		await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
	});

	it("does nothing on Cancel", () => {
		const onOpenChange = setup();

		fireEvent.click(screen.getByRole("button", { name: "deleteCancel" }));

		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(deletes()).toHaveLength(0);
	});
});
