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

	it("says the counters could not be read when the action fails, with no warning of its own", async () => {
		stubFetchReject();

		const { container } = render(withQuery(<StatusCards />));

		// Said once, for a screen reader; the page gives the one warning, with
		// the link to try again.
		expect(await screen.findByText("unavailable")).toHaveClass("sr-only");
		expect(screen.queryByRole("alert")).toBeNull();
		// The four cards stay where they were, each with its label and a dash,
		// so nothing under them moves.
		const cards = container.querySelectorAll("dl > *");
		expect(cards).toHaveLength(4);
		expect(Array.from(cards).map((card) => card.textContent)).toEqual([
			"versionnone",
			"domainsnone",
			"accountsnone",
			"queuenone",
		]);
		expect(container.querySelector("dl")).toHaveClass(
			"grid-cols-2",
			"@xl:grid-cols-4",
		);
		expect(container.querySelector("dd")).toHaveClass(
			"text-muted-foreground",
		);
	});

	it("says the same when the session has ended, and shows no counter", async () => {
		cookies.reset();
		stubFetchJson({});

		const { container } = render(withQuery(<StatusCards />));

		expect(await screen.findByText("unavailable")).toBeInTheDocument();
		expect(container.querySelectorAll("dl > *")).toHaveLength(4);
		expect(screen.getAllByText("none")).toHaveLength(4);
	});
});
