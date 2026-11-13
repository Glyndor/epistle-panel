import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { stubFetchJson, stubFetchReject } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { withQuery } from "@/test/query-wrapper";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";
const ID2 = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0f";
const NEXT = "01890a5d-ac96-774b-b9aa-9be4c3bd6b10";
const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { QueueTable } = await import(".");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

const body = {
	entries: [
		{
			id: ID,
			reverse_path: "zed@example.org",
			recipients: ["r1@example.net"],
		},
		{
			id: ID2,
			reverse_path: "amy@example.org",
			recipients: ["r2@example.net", "r3@example.net"],
		},
	],
	next_cursor: NEXT,
};

const senders = () =>
	screen
		.getAllByRole("row")
		.slice(1)
		.map((row) => row.querySelector("td")?.textContent);

describe("QueueTable", () => {
	it("lists the entries with their recipients and a remove control each", async () => {
		stubFetchJson(body);

		render(withQuery(<QueueTable cursor={undefined} />));

		expect(await screen.findByText("zed@example.org")).toBeInTheDocument();
		expect(
			screen.getByText("r2@example.net, r3@example.net"),
		).toBeInTheDocument();
		expect(
			screen.getAllByRole("button", { name: "removeLabel" }),
		).toHaveLength(2);
	});

	it("sorts by sender and filters the page on screen", async () => {
		stubFetchJson(body);
		render(withQuery(<QueueTable cursor={undefined} />));
		await screen.findByText("zed@example.org");

		fireEvent.click(screen.getByRole("button", { name: /from/ }));
		expect(senders()).toEqual(["amy@example.org", "zed@example.org"]);

		fireEvent.change(screen.getByRole("searchbox", { name: "filter" }), {
			target: { value: "r3@" },
		});
		await screen.findByText("amy@example.org");
		expect(senders()).toEqual(["amy@example.org"]);
	});

	it("links to the next page through the API's cursor, and to the first page when on a later one", async () => {
		stubFetchJson(body);
		render(withQuery(<QueueTable cursor={ID} />));

		expect(
			await screen.findByRole("link", { name: "next" }),
		).toHaveAttribute("href", `/app/queue?cursor=${NEXT}`);
		expect(screen.getByRole("link", { name: "first" })).toHaveAttribute(
			"href",
			"/app/queue",
		);
	});

	it("shows neither link on a single first page", async () => {
		stubFetchJson({
			entries: [{ id: ID, reverse_path: "", recipients: ["a@b"] }],
		});

		render(withQuery(<QueueTable cursor={undefined} />));

		expect(await screen.findByText("<>")).toBeInTheDocument();
		expect(screen.queryByRole("link")).toBeNull();
	});

	it("shows the empty text for an empty queue and the warning when unreachable", async () => {
		stubFetchJson({ entries: [] });
		render(withQuery(<QueueTable cursor={undefined} />));
		expect(await screen.findByText("empty")).toBeInTheDocument();
		cleanup();

		stubFetchReject();
		render(withQuery(<QueueTable cursor={undefined} />));
		expect(await screen.findByRole("alert")).toHaveClass("bg-warning");
	});
});
