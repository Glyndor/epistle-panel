import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

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

	const domainNames = () =>
		screen
			.getAllByRole("row")
			.slice(1)
			.map((row) => row.querySelector("td")?.textContent);

	it("says which domains take mail and which the server has switched off", async () => {
		stubFetchJson({
			domains: ["a.example", "b.example"],
			disabled: ["b.example"],
		});

		render(withQuery(<DomainsTable />));

		const [, a, b] = await screen.findAllByRole("row");
		expect(a).toHaveTextContent("stateActive");
		expect(a).not.toHaveTextContent("stateDisabled");
		expect(b).toHaveTextContent("stateDisabled");
		expect(b).not.toHaveTextContent("stateActive");
	});

	it("narrows by the state, from the Filters menu", async () => {
		stubFetchJson({
			domains: ["a.example", "b.example", "c.example"],
			disabled: ["b.example"],
		});
		render(withQuery(<DomainsTable />));
		await screen.findByText("a.example");

		fireEvent.keyDown(
			await screen.findByRole("button", {
				name: /filters/,
				expanded: false,
			}),
			{ key: "Enter" },
		);
		const group = await screen.findByRole("group", { name: "state" });
		expect(
			[...group.querySelectorAll('[role="menuitemcheckbox"]')].map(
				(item) => item.textContent,
			),
		).toEqual(["stateActive", "stateDisabled"]);

		fireEvent.click(
			screen.getByRole("menuitemcheckbox", { name: "stateDisabled" }),
		);
		expect(domainNames()).toEqual(["b.example"]);

		fireEvent.click(
			screen.getByRole("menuitemcheckbox", { name: "stateDisabled" }),
		);
		fireEvent.click(
			screen.getByRole("menuitemcheckbox", { name: "stateActive" }),
		);
		expect(domainNames()).toEqual(["a.example", "c.example"]);
	});

	it("does not match the text filter against the key behind the state", async () => {
		stubFetchJson({
			domains: ["a.example", "b.example"],
			disabled: ["b.example"],
		});
		render(withQuery(<DomainsTable />));
		await screen.findByText("a.example");

		// "disabled" is the key of the state column, in no domain name.
		fireEvent.change(screen.getByRole("searchbox", { name: "filter" }), {
			target: { value: "disabled" },
		});

		// No row is left, so the table offers to take the filter off.
		expect(
			await screen.findByRole("button", { name: "clearFilters" }),
		).toBeInTheDocument();
		expect(screen.queryByText("b.example")).toBeNull();
	});

	it("shows 25 domains a page", async () => {
		stubFetchJson({
			domains: Array.from(
				{ length: 30 },
				(_, index) => `d${String(index + 1).padStart(2, "0")}.example`,
			),
		});
		render(withQuery(<DomainsTable />));
		await screen.findByText("d01.example");

		expect(domainNames()).toHaveLength(25);
		fireEvent.click(screen.getByRole("button", { name: "next" }));
		expect(domainNames()).toHaveLength(5);
		expect(domainNames().at(0)).toBe("d26.example");
	});
});
