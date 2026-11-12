import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { stubFetchJson, stubFetchReject } from "@/lib/api/test-support/fetch";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();

const { default: DomainsPage } = await import("./page");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(cleanup);

describe("DomainsPage", () => {
	it("lists each configured domain", async () => {
		stubFetchJson({ domains: ["example.org", "example.net"] });

		render(await DomainsPage());

		expect(screen.getByText("example.org")).toBeInTheDocument();
		expect(screen.getByText("example.net")).toBeInTheDocument();
	});

	it("shows the empty state when there are no domains", async () => {
		stubFetchJson({ domains: [] });

		render(await DomainsPage());

		expect(screen.getByText("empty")).toBeInTheDocument();
	});

	it("shows the unreachable notice when the API errors", async () => {
		stubFetchReject();

		render(await DomainsPage());

		expect(screen.getByRole("alert")).toHaveTextContent("unreachable");
	});

	it("redirects to the login page without a session and never calls the API", async () => {
		cookies.reset();
		stubFetchJson({});
		const before = globalThis.fetch;

		const outcome = await (async () => await DomainsPage())().catch(
			(error) => error,
		);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/login");
		expect(
			(before as unknown as { mock: { calls: unknown[] } }).mock.calls,
		).toHaveLength(0);
	});
});
