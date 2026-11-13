import { afterEach, describe, expect, it, spyOn } from "bun:test";
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
import { answerConfirm } from "@/test/confirm-dialog";
import { testQueryClient, withQuery } from "@/test/query-wrapper";

const SECRET = "JBSWY3DPEHPK3PXP";
const URI = `otpauth://totp/example.org:alice?secret=${SECRET}&issuer=example.org`;
const cookies = mockRequestCookies();
const { TotpSection } = await import(".");

afterEach(() => {
	cleanup();
	clearToasts();
});

const enrolled = { body: { secret: SECRET, otpauth_uri: URI } };
const click = (name: string) =>
	act(async () => {
		fireEvent.click(screen.getByRole("button", { name }));
	});

function setup(client = testQueryClient()) {
	render(
		withQuery(
			<>
				<TotpSection name="alice" />
				<Toaster label="toasts" closeLabel="close" />
			</>,
			client,
		),
	);
	return client;
}

describe("TotpSection", () => {
	useActionEnvironment(cookies);

	it("asks before enrolling, and does nothing when declined", async () => {
		setup();

		await click("totpEnroll");
		expect(await screen.findByRole("alertdialog")).toHaveTextContent(
			"totpEnrollConfirm",
		);
		await answerConfirm(false);

		expect(sentRequests()).toHaveLength(0);
		expect(screen.queryByText(SECRET)).toBeNull();
	});

	it("shows the new secret and its URI once confirmed, with the warning", async () => {
		stubRoutes([["POST", /totp$/, enrolled]]);
		setup();

		await click("totpEnroll");
		await answerConfirm(true);

		expect(await screen.findByText(SECRET)).toBeInTheDocument();
		expect(screen.getByText(URI)).toBeInTheDocument();
		expect(screen.getByText("totpSecretWarning")).toBeInTheDocument();
		expect(screen.getByRole("status")).toHaveTextContent("totpSecretTitle");
	});

	it("keeps the secret out of the query cache, the toasts and the log", async () => {
		stubRoutes([["POST", /totp$/, enrolled]]);
		const logs = (["log", "error", "warn", "info"] as const).map((m) =>
			spyOn(console, m).mockImplementation(() => {}),
		);
		const client = setup();

		await click("totpEnroll");
		await answerConfirm(true);
		await screen.findByText(SECRET);

		expect(client.getQueryCache().getAll()).toHaveLength(0);
		expect(client.getMutationCache().getAll()).toHaveLength(0);
		expect(
			logs
				.flatMap((spy) => spy.mock.calls)
				.flat()
				.join("\n"),
		).not.toContain(SECRET);
		expect(
			screen.getByRole("region", { name: "toasts" }).textContent,
		).not.toContain(SECRET);
		for (const spy of logs) {
			spy.mockRestore();
		}
	});

	it("takes the secret off the screen when asked, and when the section is left", async () => {
		stubRoutes([["POST", /totp$/, enrolled]]);
		setup();
		await click("totpEnroll");
		await answerConfirm(true);
		await screen.findByText(SECRET);

		await click("totpHide");

		expect(screen.queryByText(SECRET)).toBeNull();
		await click("totpEnroll");
		await answerConfirm(true);
		await screen.findByText(SECRET);
		cleanup();
		expect(document.body.innerHTML).not.toContain(SECRET);
	});

	it("asks before turning two-factor off, then does it with DELETE and reports it", async () => {
		stubRoutes([["DELETE", /totp$/, { body: { updated: "alice" } }]]);
		setup();
		await click("totpDisable");
		await answerConfirm(false);
		expect(sentRequests()).toHaveLength(0);

		await click("totpDisable");
		await answerConfirm(true);

		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"totpDisabled",
			),
		);
		expect(sentRequests()[0]?.method).toBe("DELETE");
	});

	it("hides a secret already shown when two-factor is turned off", async () => {
		stubRoutes([
			["POST", /totp$/, enrolled],
			["DELETE", /totp$/, { body: { updated: "alice" } }],
		]);
		setup();
		await click("totpEnroll");
		await answerConfirm(true);
		await screen.findByText(SECRET);

		await click("totpDisable");
		await answerConfirm(true);

		await waitFor(() => expect(screen.queryByText(SECRET)).toBeNull());
	});

	it("reports an account that is gone as a toast, for both actions", async () => {
		stubRoutes([
			[
				"POST",
				/totp$/,
				{
					status: 404,
					body: { error: { code: "not_found", message: "x" } },
				},
			],
			[
				"DELETE",
				/totp$/,
				{
					status: 404,
					body: { error: { code: "not_found", message: "x" } },
				},
			],
		]);
		setup();

		await click("totpEnroll");
		await answerConfirm(true);
		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("refusedGone"),
		);
		clearToasts();
		await click("totpDisable");
		await answerConfirm(true);
		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("refusedGone"),
		);
		expect(screen.queryByText(SECRET)).toBeNull();
	});

	it("reports an unreachable server as an error toast and shows no secret", async () => {
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();
		setup();

		await click("totpEnroll");
		await answerConfirm(true);

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("unavailable"),
		);
		await click("totpDisable");
		await answerConfirm(true);
		await waitFor(() =>
			expect(screen.getAllByRole("alert").length).toBeGreaterThan(0),
		);
		expect(screen.queryByRole("status")).toBeNull();
		errors.mockRestore();
	});
});
