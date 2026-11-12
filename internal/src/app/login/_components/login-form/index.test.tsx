import { afterEach, describe, expect, it, mock } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import type { LoginState } from "@/lib/auth/actions/login";

mock.module("next-intl", () => ({
	useTranslations: () => (key: string) => key,
}));

const calls: FormData[] = [];
let result: LoginState = { error: true };
/** When set, the next attempt waits for it: the form stays pending. */
let gate: Promise<void> | null = null;
mock.module("@/lib/auth/actions/login", () => ({
	login: async (_state: LoginState, data: FormData): Promise<LoginState> => {
		calls.push(data);
		await gate;
		return result;
	},
}));

const { LoginForm } = await import(".");

afterEach(() => {
	cleanup();
	calls.length = 0;
	gate = null;
});

/** Fill both required fields so the browser lets the form submit. */
function fillCredentials() {
	fireEvent.change(screen.getByLabelText("name"), { target: { value: "a" } });
	fireEvent.change(screen.getByLabelText("password"), {
		target: { value: "b" },
	});
}

describe("LoginForm", () => {
	it("labels both fields and marks them required with the right autocomplete", () => {
		render(<LoginForm />);

		const name = screen.getByLabelText("name");
		const password = screen.getByLabelText("password");
		expect(name).toHaveAttribute("autocomplete", "username");
		expect(name).toBeRequired();
		expect(password).toHaveAttribute("type", "password");
		expect(password).toHaveAttribute("autocomplete", "current-password");
		expect(password).toBeRequired();
	});

	it("shows no error before the first attempt", () => {
		render(<LoginForm />);

		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("submits the typed credentials and announces a failed attempt", async () => {
		result = { error: true };
		render(<LoginForm />);

		fireEvent.change(screen.getByLabelText("name"), {
			target: { value: "admin" },
		});
		fireEvent.change(screen.getByLabelText("password"), {
			target: { value: "secret" },
		});
		fireEvent.click(screen.getByRole("button", { name: "submit" }));

		const alert = await waitFor(() => screen.getByRole("alert"));
		expect(alert).toHaveTextContent("error");
		expect(calls).toHaveLength(1);
		expect(calls[0]?.get("name")).toBe("admin");
		expect(calls[0]?.get("password")).toBe("secret");
	});

	it("marks both fields invalid and ties them to the error after a failed attempt", async () => {
		result = { error: true };
		render(<LoginForm />);

		expect(screen.getByLabelText("name")).not.toHaveAttribute(
			"aria-invalid",
		);
		fillCredentials();
		fireEvent.click(screen.getByRole("button", { name: "submit" }));

		const alert = await waitFor(() => screen.getByRole("alert"));
		for (const field of ["name", "password"]) {
			const input = screen.getByLabelText(field);
			expect(input).toHaveAttribute("aria-invalid", "true");
			expect(input).toHaveAttribute("aria-describedby", alert.id);
		}
	});

	it("disables the button and says so while the attempt is pending", async () => {
		let open = () => {};
		gate = new Promise<void>((resolve) => {
			open = resolve;
		});
		result = { error: false };
		render(<LoginForm />);

		fillCredentials();
		fireEvent.click(screen.getByRole("button", { name: "submit" }));

		const busy = await waitFor(() =>
			screen.getByRole("button", { name: "pending" }),
		);
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
