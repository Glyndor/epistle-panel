import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

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
/** What a script does when it submits without the browser's own validation. */
const submitPastTheBrowser = () =>
	act(async () => {
		fireEvent.submit(
			screen
				.getByRole("button", { name: "submit" })
				.closest("form") as HTMLFormElement,
		);
	});
const type = (field: HTMLElement, value: string) =>
	act(async () => {
		fireEvent.change(field, { target: { value } });
	});
const verifyCalls = () =>
	sentRequests().filter((r) => r.url.endsWith("/auth/verify"));

describe("LoginForm", () => {
	it("labels both fields, marks them required and bounded, with the right autocomplete", () => {
		render(<LoginForm captcha={null} />);

		expect(name()).toHaveAttribute("autocomplete", "username");
		expect(name()).toBeRequired();
		// One over the schema's 254 and 1024: a cut paste is over the limit.
		expect(name()).toHaveAttribute("maxlength", "255");
		expect(password()).toHaveAttribute("type", "password");
		expect(password()).toHaveAttribute("autocomplete", "current-password");
		expect(password()).toBeRequired();
		expect(password()).toHaveAttribute("maxlength", "1025");
	});

	it("shows no error before the first attempt and leaves the browser's own check on", () => {
		const { container } = render(<LoginForm captcha={null} />);

		expect(screen.queryByRole("alert")).toBeNull();
		expect(container.querySelector("form")).not.toHaveAttribute(
			"novalidate",
		);
	});

	it("the browser stops an empty form before any script, and nothing is sent", async () => {
		render(<LoginForm captcha={null} />);

		expect(name().validity.valueMissing).toBe(true);
		await submit();

		expect(name().checkValidity()).toBe(false);
		expect(screen.queryByText("nameRequired")).toBeNull();
		expect(verifyCalls()).toHaveLength(0);
	});

	it("a form submitted past the browser's check is stopped by the schema, which names the empty fields and focuses the first", async () => {
		render(<LoginForm captcha={null} />);

		await submitPastTheBrowser();

		expect(await screen.findByText("nameRequired")).toBeInTheDocument();
		expect(screen.getByText("passwordRequired")).toBeInTheDocument();
		expect(verifyCalls()).toHaveLength(0);
		expect(name()).toHaveFocus();
		expect(name()).toHaveAttribute("aria-invalid", "true");
		expect(name()).toHaveAccessibleDescription("nameRequired");
	});

	it("clears a field's message as soon as it is corrected", async () => {
		render(<LoginForm captcha={null} />);
		await submitPastTheBrowser();
		await screen.findByText("nameRequired");

		await type(name(), "ops");

		await waitFor(() =>
			expect(screen.queryByText("nameRequired")).toBeNull(),
		);
		expect(screen.getByText("passwordRequired")).toBeInTheDocument();
		expect(name()).not.toHaveAttribute("aria-invalid");
	});

	it("refuses a password over the cap in the schema too, and sends nothing", async () => {
		render(<LoginForm captcha={null} />);
		await type(name(), "ops");
		await type(password(), "p".repeat(1025));

		await submitPastTheBrowser();

		expect(await screen.findByText("passwordTooLong")).toBeInTheDocument();
		expect(verifyCalls()).toHaveLength(0);
	});

	it("submits valid credentials through the action and announces a refusal with the one generic message", async () => {
		render(<LoginForm captcha={null} />);
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
		render(<LoginForm captcha={null} />);
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
		// The promise is made here, not when `fetch` is called: the button says
		// pending before the action reaches `fetch`, and opening in that gap must
		// still answer the request.
		let open: () => void = () => {};
		const held = new Promise<Response>((resolve) => {
			open = () =>
				resolve(
					new Response(
						JSON.stringify({ valid: false, admin: false }),
						{
							headers: { "content-type": "application/json" },
						},
					),
				);
		});
		globalThis.fetch = mock(() => held) as unknown as typeof fetch;
		render(<LoginForm captcha={null} />);
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
