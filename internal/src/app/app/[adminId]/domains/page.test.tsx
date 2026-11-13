import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import {
	sentRequests,
	stubFetchJson,
	stubFetchReject,
} from "@/lib/api/test-support/fetch";
import {
	mockRequestCookies,
	NotFoundSignal,
} from "@/lib/auth/test-support/cookies";

import { withAdminArea } from "@/test/admin-routes";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();

const { default: DomainsPage } = await import("./page");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

describe("DomainsPage", () => {
	it("lists each configured domain", async () => {
		stubFetchJson({ domains: ["example.org", "example.net"] });

		render(withAdminArea(await DomainsPage()));

		expect(screen.getByText("example.org")).toBeInTheDocument();
		expect(screen.getByText("example.net")).toBeInTheDocument();
	});

	it("puts domains in a table with a labelled column", async () => {
		stubFetchJson({ domains: ["example.org", "example.net"] });

		render(withAdminArea(await DomainsPage()));

		expect(screen.getByRole("table")).toBeInTheDocument();
		const headers = screen.getAllByRole("columnheader");
		expect(headers).toHaveLength(1);
		expect(headers[0]).toHaveTextContent("name");
		expect(screen.getAllByRole("row")).toHaveLength(3);
	});

	it("shows the empty state when there are no domains", async () => {
		stubFetchJson({ domains: [] });

		render(withAdminArea(await DomainsPage()));

		expect(screen.getByText("empty")).toBeInTheDocument();
	});

	it("shows the unreachable notice when the API errors", async () => {
		stubFetchReject();

		render(withAdminArea(await DomainsPage()));

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("unreachable");
		// An unreachable API is a warning, not a destructive state.
		expect(alert).toHaveClass("bg-warning");
	});

	it("answers 404, not a redirect, without a session and never calls the API", async () => {
		cookies.reset();
		stubFetchJson({});

		const outcome = await (async () => await DomainsPage())().catch(
			(error) => error,
		);

		expect(outcome).toBeInstanceOf(NotFoundSignal);
		expect(sentRequests()).toHaveLength(0);
	});
});
