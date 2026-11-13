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

const { default: QueuePage } = await import("./page");

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";
const NEXT = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0f";

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

describe("QueuePage", () => {
	it("lists each queued message with a remove control", async () => {
		stubFetchJson({
			entries: [
				{
					id: ID,
					reverse_path: "sender@example.org",
					recipients: ["rcpt@elsewhere.example"],
				},
			],
		});

		render(
			withQuery(await QueuePage({ searchParams: Promise.resolve({}) })),
		);

		expect(screen.getByText(/sender@example.org/)).toBeInTheDocument();
		expect(screen.getByText(/rcpt@elsewhere.example/)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "removeLabel" }),
		).toBeInTheDocument();
	});

	it("puts the queue in a table whose action column has a name", async () => {
		stubFetchJson({
			entries: [
				{
					id: ID,
					reverse_path: "a@example.org",
					recipients: ["b@example.org"],
				},
			],
		});

		render(
			withQuery(await QueuePage({ searchParams: Promise.resolve({}) })),
		);

		const headers = screen.getAllByRole("columnheader");
		expect(headers).toHaveLength(3);
		expect(headers[0]).toHaveTextContent("from");
		expect(headers[1]).toHaveTextContent("to");
		expect(headers[2]).toHaveTextContent("actions");
		expect(screen.getAllByRole("row")).toHaveLength(2);
	});

	it("renders a next-page link when the API returns a cursor", async () => {
		stubFetchJson({
			entries: [
				{ id: ID, reverse_path: "", recipients: ["a@b.example"] },
			],
			next_cursor: NEXT,
		});

		render(
			withQuery(await QueuePage({ searchParams: Promise.resolve({}) })),
		);

		// A null reverse_path renders as the placeholder envelope sender.
		expect(screen.getByText(/<>/)).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "next" })).toHaveAttribute(
			"href",
			`/app/queue?cursor=${NEXT}`,
		);
	});

	it("shows the empty state for an empty queue", async () => {
		stubFetchJson({ entries: [] });

		render(
			withQuery(await QueuePage({ searchParams: Promise.resolve({}) })),
		);

		expect(screen.getByText("empty")).toBeInTheDocument();
	});

	it("shows the unreachable notice when the API errors", async () => {
		stubFetchReject();

		render(
			withQuery(
				await QueuePage({
					searchParams: Promise.resolve({ cursor: ID }),
				}),
			),
		);

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("unreachable");
		// An unreachable API is a warning, not a destructive state.
		expect(alert).toHaveClass("bg-warning");
	});

	it("redirects to the login page without a session and never calls the API", async () => {
		cookies.reset();
		stubFetchJson({});

		const outcome = await (async () =>
			await QueuePage({ searchParams: Promise.resolve({}) }))().catch(
			(error) => error,
		);

		expect(outcome).toBeInstanceOf(RedirectSignal);
		expect(outcome.target).toBe("/login");
		expect(sentRequests()).toHaveLength(0);
	});

	it("forwards only the first value of a repeated cursor parameter", async () => {
		stubFetchJson({ entries: [] });

		render(
			withQuery(
				await QueuePage({
					searchParams: Promise.resolve({ cursor: [ID, NEXT] }),
				}),
			),
		);

		const calls = sentRequests();
		expect(calls).toHaveLength(1);
		expect(calls[0]?.url).toEndWith(`/api/v1/queue?cursor=${ID}`);
	});

	it("drops a cursor that is not a UUID instead of forwarding it", async () => {
		stubFetchJson({ entries: [] });

		render(
			withQuery(
				await QueuePage({
					searchParams: Promise.resolve({ cursor: ["a", "b"] }),
				}),
			),
		);

		expect(sentRequests()[0]?.url).toEndWith("/api/v1/queue");
	});
});
