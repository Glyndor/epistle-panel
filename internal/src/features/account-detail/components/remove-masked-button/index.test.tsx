import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
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

const ADDRESS = "news.abcdefgh@example.org";
const originalConfirm = window.confirm;
const cookies = mockRequestCookies();
const { RemoveMaskedButton } = await import(".");

afterEach(() => {
	cleanup();
	clearToasts();
	window.confirm = originalConfirm;
});

function setup() {
	render(
		withQuery(
			<>
				<RemoveMaskedButton name="alice" address={ADDRESS} />
				<Toaster label="toasts" closeLabel="close" />
			</>,
		),
	);
}
const click = () =>
	fireEvent.click(screen.getByRole("button", { name: "maskedRemoveLabel" }));

describe("RemoveMaskedButton", () => {
	useActionEnvironment(cookies);

	it("asks first and does nothing when the confirmation is declined", () => {
		const confirm = mock(() => false);
		window.confirm = confirm;
		setup();

		click();

		expect(confirm).toHaveBeenCalledWith("maskedRemoveConfirm");
		expect(sentRequests()).toHaveLength(0);
	});

	it("deletes the address once confirmed and reports success", async () => {
		window.confirm = mock(() => true);
		stubRoutes([["DELETE", /\/masked\//, { body: { removed: ADDRESS } }]]);
		setup();

		click();

		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"maskedRemoved",
			),
		);
		const [call] = sentRequests();
		expect([call?.method, call?.url]).toEqual([
			"DELETE",
			"http://127.0.0.1:8025/api/v1/accounts/alice/masked/news.abcdefgh%40example.org",
		]);
	});

	it("reports an address that is already gone as an error", async () => {
		window.confirm = mock(() => true);
		stubRoutes([
			[
				"DELETE",
				/\/masked\//,
				{
					status: 404,
					body: { error: { code: "not_found", message: "x" } },
				},
			],
		]);
		setup();

		click();

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("refusedGone"),
		);
	});

	it("reports an unreachable server as an error toast", async () => {
		window.confirm = mock(() => true);
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();
		setup();

		click();

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("unavailable"),
		);
		errors.mockRestore();
	});

	it("disables itself while the request is in flight", async () => {
		window.confirm = mock(() => true);
		globalThis.fetch = mock(
			() => new Promise<Response>(() => {}),
		) as unknown as typeof fetch;
		setup();

		click();

		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "maskedRemoveLabel" }),
			).toBeDisabled(),
		);
	});
});
