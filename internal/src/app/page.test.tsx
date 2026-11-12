import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { stubFetchJson, stubFetchReject } from "@/lib/api/test-support/fetch";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";

// Translations: echo the key so assertions stay locale-independent.
mock.module("next-intl/server", () => ({
	getTranslations: async () => (key: string) => key,
	getFormatter: async () => ({ number: (value: number) => String(value) }),
}));

const cookies = mockRequestCookies();

const { default: HomePage } = await import("./page");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(cleanup);

describe("HomePage", () => {
	it("renders a card per counter when the API responds", async () => {
		stubFetchJson({
			version: "0.1.0",
			domains: 2,
			accounts: 5,
			queue_size: 3,
		});

		render(await HomePage());

		expect(screen.getByText("0.1.0")).toBeInTheDocument();
		expect(screen.getByText("2")).toBeInTheDocument();
		expect(screen.getByText("5")).toBeInTheDocument();
		expect(screen.getByText("3")).toBeInTheDocument();
	});

	it("renders the unreachable notice when the API errors", async () => {
		stubFetchReject();

		render(await HomePage());

		expect(screen.getByRole("alert")).toHaveTextContent("unreachable");
		// An unreachable API is a warning, not a destructive state.
		expect(screen.getByRole("alert")).toHaveClass("bg-warning");
	});

	it("redirects to the login page without a session and never calls the API", async () => {
		cookies.reset();
		stubFetchJson({});
		const before = globalThis.fetch;

		const outcome = await (async () => await HomePage())().catch(
			(error) => error,
		);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/login");
		expect(
			(before as unknown as { mock: { calls: unknown[] } }).mock.calls,
		).toHaveLength(0);
	});
});
