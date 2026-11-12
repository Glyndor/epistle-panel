import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { stubFetchJson, stubFetchReject } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { withQuery } from "@/test/query-wrapper";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { DomainsTable } = await import(".");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

describe("DomainsTable", () => {
	it("lists the domains in a sortable, filterable table", async () => {
		stubFetchJson({ domains: ["b.example", "a.example"] });

		render(withQuery(<DomainsTable />));

		expect(await screen.findByText("a.example")).toBeInTheDocument();
		expect(
			screen.getByRole("columnheader", { name: /name/ }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("searchbox", { name: "filter" }),
		).toBeInTheDocument();
	});

	it("shows the empty text when there are no domains", async () => {
		stubFetchJson({ domains: [] });

		render(withQuery(<DomainsTable />));

		expect(await screen.findByText("empty")).toBeInTheDocument();
	});

	it("shows the unreachable warning when the API cannot be read", async () => {
		stubFetchReject();

		render(withQuery(<DomainsTable />));

		expect(await screen.findByRole("alert")).toHaveClass("bg-warning");
	});
});
