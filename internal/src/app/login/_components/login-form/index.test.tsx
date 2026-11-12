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
mock.module("@/lib/auth/actions/login", () => ({
	login: async (_state: LoginState, data: FormData): Promise<LoginState> => {
		calls.push(data);
		return result;
	},
}));

const { LoginForm } = await import(".");

afterEach(() => {
	cleanup();
	calls.length = 0;
});

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
});
