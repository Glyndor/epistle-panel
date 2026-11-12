import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import {
	LOGIN_NAME_MAX,
	LOGIN_PASSWORD_MAX,
} from "@/features/auth/schemas/login";
import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import { resetLoginLimiter } from "@/lib/auth/login-limiter";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

// The real action runs here, with `fetch` stubbed and the response floor at
// zero. Nothing mocks the action's module: `mock.module` is process-wide, and
// the form test that did so made the action's own tests fail in some orders.
const originalFetch = globalThis.fetch;
mockRequestCookies();
const { LoginForm } = await import(".");

beforeEach(() => {
	process.env["EPISTLE_PANEL_LOGIN_MIN_MS"] = "0";
	resetLoginLimiter();
	stubFetchJson({ valid: false, admin: false });
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
	delete process.env["EPISTLE_PANEL_LOGIN_MIN_MS"];
});

const name = () => screen.getByLabelText("name") as HTMLInputElement;
const password = () => screen.getByLabelText("password") as HTMLInputElement;
const submit = () =>
	act(async () => {
		fireEvent.click(screen.getByRole("button", { name: "submit" }));
	});
const type = (field: HTMLElement, value: string) =>
	act(async () => {
		fireEvent.change(field, { target: { value } });
	});
const verifyCalls = () =>
	sentRequests().filter((r) => r.url.endsWith("/auth/verify"));

describe("LoginForm", () => {
	it("labels both fields, marks them required and bounded, with the right autocomplete", () => {
		render(<LoginForm />);

		expect(name()).toHaveAttribute("autocomplete", "username");
		expect(name()).toBeRequired();
		expect(name()).toHaveAttribute("maxlength", String(LOGIN_NAME_MAX));
		expect(password()).toHaveAttribute("type", "password");
		expect(password()).toHaveAttribute("autocomplete", "current-password");
		expect(password()).toBeRequired();
		expect(password()).toHaveAttribute(
			"maxlength",
			String(LOGIN_PASSWORD_MAX),
		);
	});

	it("shows no error before the first attempt and switches off the browser's own bubbles once hydrated", async () => {
		const { container } = render(<LoginForm />);

		expect(screen.queryByRole("alert")).toBeNull();
		await waitFor(() =>
			expect(container.querySelector("form")).toHaveAttribute(
				"novalidate",
			),
		);
	});

	it("names the empty fields, sends nothing, and focuses the first one", async () => {
		render(<LoginForm />);

		await submit();

		expect(await screen.findByText("nameRequired")).toBeInTheDocument();
		expect(screen.getByText("passwordRequired")).toBeInTheDocument();
		expect(verifyCalls()).toHaveLength(0);
		expect(name()).toHaveFocus();
		expect(name()).toHaveAttribute("aria-invalid", "true");
		expect(name()).toHaveAccessibleDescription("nameRequired");
	});

	it("clears a field's message as soon as it is corrected", async () => {
		render(<LoginForm />);
		await submit();
		await screen.findByText("nameRequired");

		await type(name(), "ops");

		await waitFor(() =>
			expect(screen.queryByText("nameRequired")).toBeNull(),
		);
		expect(screen.getByText("passwordRequired")).toBeInTheDocument();
		expect(name()).not.toHaveAttribute("aria-invalid");
	});

	it("refuses a password over the cap on the client too, and sends nothing", async () => {
		render(<LoginForm />);
		await type(name(), "ops");
		await type(password(), "p".repeat(LOGIN_PASSWORD_MAX + 1));

		await submit();

		expect(await screen.findByText("passwordTooLong")).toBeInTheDocument();
		expect(verifyCalls()).toHaveLength(0);
	});

	it("submits valid credentials through the action and announces a refusal with the one generic message", async () => {
		render(<LoginForm />);
		await type(name(), "  admin ");
		await type(password(), "secret");

		await submit();

		const alert = await waitFor(() => {
			const element = document.getElementById("login-error");
			expect(element).not.toBeNull();
			return element as HTMLElement;
		});
		expect(alert).toHaveTextContent("error");
		expect(JSON.parse(verifyCalls()[0]?.body ?? "{}")).toEqual({
			name: "admin",
			password: "secret",
		});
	});

	it("after a refusal keeps the name, clears the password, focuses it, and ties both fields to the error", async () => {
		render(<LoginForm />);
		await type(name(), "admin");
		await type(password(), "secret");

		await submit();

		await waitFor(() =>
			expect(document.getElementById("login-error")).not.toBeNull(),
		);
		await waitFor(() => expect(password()).toHaveValue(""));
		expect(name()).toHaveValue("admin");
		expect(password()).toHaveFocus();
		for (const field of [name(), password()]) {
			expect(field).toHaveAttribute("aria-invalid", "true");
			expect(field).toHaveAttribute("aria-describedby", "login-error");
		}
	});

	it("disables the button and says so while the attempt is pending", async () => {
		let open: () => void = () => {};
		globalThis.fetch = mock(
			() =>
				new Promise<Response>((resolve) => {
					open = () =>
						resolve(
							new Response(
								JSON.stringify({ valid: false, admin: false }),
								{
									headers: {
										"content-type": "application/json",
									},
								},
							),
						);
				}),
		) as unknown as typeof fetch;
		render(<LoginForm />);
		await type(name(), "a");
		await type(password(), "b");

		await submit();

		const busy = await screen.findByRole("button", { name: "pending" });
		expect(busy).toBeDisabled();
		expect(busy).toHaveAttribute("aria-busy", "true");
		open();
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "submit" }),
			).toBeEnabled(),
		);
	});
});
