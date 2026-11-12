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

const { default: SuppressionPage } = await import("./page");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

const open = async (searchParams: { after?: string | string[] } = {}) =>
	render(
		withQuery(
			await SuppressionPage({
				searchParams: Promise.resolve(searchParams),
			}),
		),
	);

describe("SuppressionPage", () => {
	it("titles the page and lists each address with a remove control", async () => {
		stubFetchJson({ addresses: ["bob@example.net"] });

		await open();

		expect(
			screen.getByRole("heading", { level: 1, name: "heading" }),
		).toBeInTheDocument();
		expect(screen.getByText("bob@example.net")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "removeLabel" }),
		).toBeInTheDocument();
		const headers = screen.getAllByRole("columnheader");
		expect(headers).toHaveLength(2);
		expect(headers[1]).toHaveTextContent("actions");
	});

	it("renders a next-page link when the API returns a cursor", async () => {
		stubFetchJson({ addresses: ["a@b.org"], next_cursor: "a@b.org" });

		await open();

		expect(screen.getByRole("link", { name: "next" })).toHaveAttribute(
			"href",
			"/suppression?after=a%40b.org",
		);
	});

	it("shows the empty state for an empty list", async () => {
		stubFetchJson({ addresses: [] });

		await open();

		expect(screen.getByText("empty")).toBeInTheDocument();
	});

	it("shows the unreachable notice, as a warning, when the API errors", async () => {
		stubFetchReject();

		await open({ after: "a@b.org" });

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("unreachable");
		expect(alert).toHaveClass("bg-warning");
	});

	it("redirects to the login page without a session and never calls the API", async () => {
		cookies.reset();
		stubFetchJson({});

		const outcome = await (async () =>
			await SuppressionPage({
				searchParams: Promise.resolve({}),
			}))().catch((error) => error);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/login");
		expect(sentRequests()).toHaveLength(0);
	});

	it("forwards only the first value of a repeated cursor parameter", async () => {
		stubFetchJson({ addresses: [] });

		await open({ after: ["a@b.org", "c@d.org"] });

		expect(sentRequests()[0]?.url).toEndWith(
			"/api/v1/suppression?after=a%40b.org",
		);
	});

	it("drops a cursor that is not an address instead of forwarding it", async () => {
		stubFetchJson({ addresses: [] });

		for (const after of [
			"../x",
			"a@b.org\nBcc: c@d.org",
			["bad", "a@b.org"],
		]) {
			await open({ after });
		}

		for (const call of sentRequests()) {
			expect(call.url).toEndWith("/api/v1/suppression");
		}
		expect(sentRequests()).toHaveLength(3);
	});
});
