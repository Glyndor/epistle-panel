import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import {
	sentRequests,
	stubFetchJson,
	stubFetchReject,
} from "@/lib/api/test-support/fetch";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";
import { withQuery } from "@/test/query-wrapper";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();

const { default: HomePage } = await import("./page");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

describe("HomePage", () => {
	it("renders a card per counter at once from the server prefetch", async () => {
		stubFetchJson({
			version: "0.1.0",
			domains: 2,
			accounts: 5,
			queue_size: 3,
		});

		render(withQuery(await HomePage()));

		// No wait: the data was dehydrated into the page, so the first render has it.
		expect(screen.getByText("0.1.0")).toBeInTheDocument();
		expect(screen.getByText("2")).toBeInTheDocument();
		expect(screen.getByText("5")).toBeInTheDocument();
		expect(screen.getByText("3")).toBeInTheDocument();
		expect(sentRequests()).toHaveLength(1);
	});

	it("renders the unreachable notice, as a warning, when the API errors", async () => {
		stubFetchReject();

		render(withQuery(await HomePage()));

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("unreachable");
		expect(alert).toHaveClass("bg-warning");
	});

	it("redirects to the login page without a session and never calls the API", async () => {
		cookies.reset();
		stubFetchJson({});

		const outcome = await (async () => await HomePage())().catch(
			(error) => error,
		);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/login");
		expect(sentRequests()).toHaveLength(0);
	});
});
