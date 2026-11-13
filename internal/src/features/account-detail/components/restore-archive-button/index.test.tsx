import { afterEach, describe, expect, it, spyOn } from "bun:test";
import {
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

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";
const cookies = mockRequestCookies();
const { RestoreArchiveButton } = await import(".");

afterEach(() => {
	cleanup();
	clearToasts();
});

function setup() {
	render(
		withQuery(
			<>
				<RestoreArchiveButton name="alice" id={ID} mailbox="INBOX" />
				<Toaster label="toasts" closeLabel="close" />
			</>,
		),
	);
	fireEvent.click(
		screen.getByRole("button", { name: "archiveRestoreLabel" }),
	);
}

describe("RestoreArchiveButton", () => {
	useActionEnvironment(cookies);

	it("restores the message with POST and reports where it went", async () => {
		stubRoutes([
			["POST", /restore$/, { body: { id: ID, restored_to: "INBOX" } }],
		]);

		setup();

		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"archiveRestored",
			),
		);
		const [call] = sentRequests();
		expect([call?.method, call?.url]).toEqual([
			"POST",
			`http://127.0.0.1:8025/api/v1/accounts/alice/archive/${ID}/restore`,
		]);
	});

	it("reports a message that cannot be restored as an error", async () => {
		stubRoutes([
			[
				"POST",
				/restore$/,
				{
					status: 404,
					body: {
						error: {
							code: "not_found",
							message: "cannot restore: x",
						},
					},
				},
			],
		]);

		setup();

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("refusedGone"),
		);
	});

	it("reports an unreachable server as an error toast", async () => {
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		setup();

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("unavailable"),
		);
		errors.mockRestore();
	});
});
