import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { stubFetchJson, stubFetchReject } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { withQuery } from "@/test/query-wrapper";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { SuppressionTable } = await import(".");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

const body = {
	addresses: ["zed@example.org", "amy@example.net"],
	next_cursor: "amy@example.net",
};

const addresses = () =>
	screen
		.getAllByRole("row")
		.slice(1)
		.map((row) => row.querySelector("td")?.textContent);

describe("SuppressionTable", () => {
	it("lists the addresses with a remove control each", async () => {
		stubFetchJson(body);

		render(withQuery(<SuppressionTable after={undefined} />));

		expect(await screen.findByText("zed@example.org")).toBeInTheDocument();
		expect(screen.getByText("amy@example.net")).toBeInTheDocument();
		expect(
			screen.getAllByRole("button", { name: "removeLabel" }),
		).toHaveLength(2);
	});

	it("sorts by address and filters the page on screen", async () => {
		stubFetchJson(body);
		render(withQuery(<SuppressionTable after={undefined} />));
		await screen.findByText("zed@example.org");

		fireEvent.click(screen.getByRole("button", { name: /address/ }));
		expect(addresses()).toEqual(["amy@example.net", "zed@example.org"]);

		fireEvent.change(screen.getByRole("searchbox", { name: "filter" }), {
			target: { value: "zed@" },
		});
		await screen.findByText("zed@example.org");
		expect(addresses()).toEqual(["zed@example.org"]);
	});

	it("links to the next page through the API's cursor, encoded, and to the first page when on a later one", async () => {
		stubFetchJson({ addresses: ["a+b@x.org"], next_cursor: "a+b@x.org" });
		render(withQuery(<SuppressionTable after="z@x.org" />));

		expect(
			await screen.findByRole("link", { name: "next" }),
		).toHaveAttribute("href", "/suppression?after=a%2Bb%40x.org");
		expect(screen.getByRole("link", { name: "first" })).toHaveAttribute(
			"href",
			"/suppression",
		);
	});

	it("shows neither link on a single first page", async () => {
		stubFetchJson({ addresses: ["a@b.org"] });

		render(withQuery(<SuppressionTable after={undefined} />));

		expect(await screen.findByText("a@b.org")).toBeInTheDocument();
		expect(screen.queryByRole("link")).toBeNull();
	});

	it("shows the empty text for an empty list and the warning when unreachable", async () => {
		stubFetchJson({ addresses: [] });
		render(withQuery(<SuppressionTable after={undefined} />));
		expect(await screen.findByText("empty")).toBeInTheDocument();
		cleanup();

		stubFetchReject();
		render(withQuery(<SuppressionTable after={undefined} />));
		expect(await screen.findByRole("alert")).toHaveClass("bg-warning");
	});
});
