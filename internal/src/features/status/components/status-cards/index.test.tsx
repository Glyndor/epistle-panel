import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { stubFetchJson, stubFetchReject } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { withQuery } from "@/test/query-wrapper";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { StatusCards } = await import(".");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

describe("StatusCards", () => {
	it("shows placeholders while loading, then a labelled counter each", async () => {
		stubFetchJson({
			version: "9.9.9",
			domains: 1,
			accounts: 2,
			queue_size: 3,
		});

		const { container } = render(withQuery(<StatusCards />));
		expect(container.querySelector("[aria-busy='true']")).not.toBeNull();

		expect(await screen.findByText("9.9.9")).toBeInTheDocument();
		for (const label of ["version", "domains", "accounts", "queue"]) {
			expect(screen.getByText(label)).toBeInTheDocument();
		}
		expect(container.querySelector("[aria-busy]")).toBeNull();
	});

	it("shows the unreachable warning when the action fails", async () => {
		stubFetchReject();

		render(withQuery(<StatusCards />));

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"unreachable",
		);
	});

	it("shows the unreachable warning when the session has ended", async () => {
		cookies.reset();
		stubFetchJson({});

		render(withQuery(<StatusCards />));

		expect(await screen.findByRole("alert")).toBeInTheDocument();
	});
});
