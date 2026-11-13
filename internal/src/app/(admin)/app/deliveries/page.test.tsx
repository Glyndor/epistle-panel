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
const { default: DeliveriesPage } = await import("./page");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

const record = {
	time: 1_700_000_000,
	spool_id: "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e",
	account: "alice",
	from: "a@example.org",
	recipient: "r@example.net",
	outcome: "failed",
	remote: null,
	reply: "550 no",
	attempt: 3,
	extra: {},
};

const open = async (searchParams: Record<string, string | string[]> = {}) =>
	render(
		withQuery(
			await DeliveriesPage({
				searchParams: Promise.resolve(searchParams),
			}),
		),
	);

describe("DeliveriesPage", () => {
	it("titles the page, shows the filters and lists the records", async () => {
		stubFetchJson({ entries: [record] });

		await open();

		expect(
			screen.getByRole("heading", { level: 1, name: "heading" }),
		).toBeInTheDocument();
		expect(screen.getByLabelText("outcome")).toBeInTheDocument();
		expect(screen.getByText("r@example.net")).toBeInTheDocument();
		expect(screen.getByText("550 no")).toBeInTheDocument();
	});

	it("forwards valid filters from the URL to the API", async () => {
		stubFetchJson({ entries: [] });

		await open({
			outcome: "failed",
			since: "24h",
			recipient: "r@example.net",
		});

		expect(sentRequests()).toHaveLength(1);
		expect(sentRequests()[0]?.url).toEndWith(
			"/api/v1/deliveries?outcome=failed&since=24h&recipient=r%40example.net&limit=100",
		);
		expect(screen.getByLabelText("outcome")).toHaveValue("failed");
	});

	it("drops hostile filters instead of forwarding them", async () => {
		stubFetchJson({ entries: [] });

		for (const params of [
			{ outcome: "failed&account=x" },
			{ since: "../x" },
			{ recipient: "a@b.org\nBcc: c@d.org" },
			{ outcome: ["wonky", "failed"] },
			{ recipient: "a".repeat(5000) },
		]) {
			await open(params);
		}

		for (const call of sentRequests()) {
			expect(call.url).toEndWith("/api/v1/deliveries?limit=100");
		}
		expect(sentRequests()).toHaveLength(5);
	});

	it("shows the unreachable notice as a warning when the API errors", async () => {
		stubFetchReject();

		await open();

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("unreachable");
		expect(alert).toHaveClass("bg-warning");
	});

	it("redirects to the login page without a session and never calls the API", async () => {
		cookies.reset();
		stubFetchJson({});

		const outcome = await (async () =>
			await DeliveriesPage({
				searchParams: Promise.resolve({}),
			}))().catch((error) => error);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/login");
		expect(sentRequests()).toHaveLength(0);
	});
});
