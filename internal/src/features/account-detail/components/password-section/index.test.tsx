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
import { withQuery } from "@/test/query-wrapper";

const PASSWORD = "correct horse battery";
const cookies = mockRequestCookies();
const { PasswordSection } = await import(".");

afterEach(() => {
	cleanup();
	clearToasts();
});

const field = () => screen.getByLabelText("passwordLabel") as HTMLInputElement;
const type = (value: string) =>
	act(async () => {
		fireEvent.change(field(), { target: { value } });
	});
const submit = () =>
	act(async () => {
		fireEvent.click(screen.getByRole("button", { name: "passwordSubmit" }));
	});
const puts = () => sentRequests().filter((r) => r.method === "PUT");
const setup = () =>
	render(
		withQuery(
			<>
				<PasswordSection name="alice" />
				<Toaster label="toasts" closeLabel="close" />
			</>,
		),
	);

describe("PasswordSection", () => {
	useActionEnvironment(cookies);

	it("is a password field that browsers treat as a new password, bounded to 64", () => {
		setup();

		expect(field()).toHaveAttribute("type", "password");
		expect(field()).toHaveAttribute("autocomplete", "new-password");
		expect(field()).toHaveAttribute("maxlength", "64");
	});

	it("names a short, and a non-ASCII, password and sends nothing", async () => {
		setup();

		await type("short");
		await submit();
		expect(await screen.findByText("passwordTooShort")).toBeInTheDocument();
		await type(`${PASSWORD}é`);
		await submit();

		expect(await screen.findByText("passwordCharset")).toBeInTheDocument();
		expect(puts()).toHaveLength(0);
	});

	it("changes the password, announces it, and empties the field", async () => {
		stubRoutes([["PUT", /password$/, { body: { updated: "alice" } }]]);
		setup();

		await type(PASSWORD);
		await submit();

		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent(
				"passwordChanged",
			),
		);
		expect(JSON.parse(puts()[0]?.body ?? "")).toEqual({
			password: PASSWORD,
		});
		expect(field().value).toBe("");
		expect(document.body.innerHTML).not.toContain(PASSWORD);
	});

	it("shows the server's refusal under the field, empties it and puts the cursor there", async () => {
		stubRoutes([
			[
				"PUT",
				/password$/,
				{
					status: 400,
					body: {
						error: {
							code: "invalid_input",
							message: `${PASSWORD} is breached`,
						},
					},
				},
			],
		]);
		setup();

		await type(PASSWORD);
		await submit();

		expect(await screen.findByText("passwordRefused")).toBeInTheDocument();
		expect(field().value).toBe("");
		expect(document.body.innerHTML).not.toContain(PASSWORD);
		await waitFor(() =>
			expect(document.activeElement === field()).toBe(true),
		);
	});

	it("reports an account that is gone, and a server that cannot be reached, as toasts", async () => {
		stubRoutes([
			[
				"PUT",
				/password$/,
				{
					status: 404,
					body: { error: { code: "not_found", message: "x" } },
				},
			],
		]);
		setup();
		await type(PASSWORD);
		await submit();
		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("refusedGone"),
		);

		act(() => clearToasts());
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();
		await type(PASSWORD);
		await submit();
		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("unavailable"),
		);
		expect(field().value).toBe("");
		errors.mockRestore();
	});

	it("never writes the password to the page's logs", async () => {
		stubRoutes([["PUT", /password$/, { body: { updated: "alice" } }]]);
		const spies = (["log", "error", "warn", "info", "debug"] as const).map(
			(m) => spyOn(console, m).mockImplementation(() => {}),
		);
		setup();

		await type(PASSWORD);
		await submit();
		await waitFor(() =>
			expect(screen.getByRole("status")).toBeInTheDocument(),
		);

		expect(
			spies
				.flatMap((spy) => spy.mock.calls)
				.flat()
				.join("\n"),
		).not.toContain(PASSWORD);
		for (const spy of spies) {
			spy.mockRestore();
		}
	});
});
