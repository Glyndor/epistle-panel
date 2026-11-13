import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { stubFetchJson, stubFetchReject } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { withQuery } from "@/test/query-wrapper";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { DeliveriesTable } = await import(".");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

const entry = (over: Record<string, unknown>) => ({
	time: 1_700_000_000,
	spool_id: "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e",
	account: "alice",
	from: "a@example.org",
	recipient: "r@example.net",
	outcome: "delivered",
	remote: "mx.example.net",
	reply: "250 ok",
	attempt: 1,
	extra: {},
	...over,
});

describe("DeliveriesTable", () => {
	it("shows the fields of a record, the time in UTC and the outcome as its label", async () => {
		stubFetchJson({ entries: [entry({})] });

		render(withQuery(<DeliveriesTable filters={{}} />));

		expect(
			await screen.findByText("2023-11-14 22:13:20"),
		).toBeInTheDocument();
		expect(screen.getByText("outcomes.delivered")).toBeInTheDocument();
		expect(screen.getByText("r@example.net")).toBeInTheDocument();
		expect(screen.getByText("alice")).toBeInTheDocument();
		expect(screen.getByText("mx.example.net")).toBeInTheDocument();
		expect(screen.getByText("250 ok")).toBeInTheDocument();
		expect(screen.getAllByRole("columnheader")).toHaveLength(8);
	});

	it("shows a placeholder for a bounce sender and for absent account, remote and reply", async () => {
		stubFetchJson({
			entries: [
				entry({ from: "", account: null, remote: null, reply: null }),
			],
		});

		render(withQuery(<DeliveriesTable filters={{}} />));

		expect(await screen.findByText("<>")).toBeInTheDocument();
		expect(screen.getAllByText("none")).toHaveLength(3);
	});

	it("renders a remote reply as text, never as markup", async () => {
		stubFetchJson({
			entries: [entry({ reply: "550 <script>alert(1)</script>" })],
		});

		const { container } = render(
			withQuery(<DeliveriesTable filters={{}} />),
		);

		expect(
			await screen.findByText("550 <script>alert(1)</script>"),
		).toBeInTheDocument();
		expect(container.querySelector("script")).toBeNull();
	});

	it("is read only: no control that changes anything", async () => {
		stubFetchJson({ entries: [entry({})] });

		render(withQuery(<DeliveriesTable filters={{}} />));
		await screen.findByText("r@example.net");

		expect(
			screen.queryByRole("button", { name: /remove|delete/i }),
		).toBeNull();
	});

	it("sorts by recipient and filters the records on screen", async () => {
		stubFetchJson({
			entries: [
				entry({ recipient: "zed@x.org", time: 2 }),
				entry({ recipient: "amy@x.org", time: 1 }),
			],
		});
		render(withQuery(<DeliveriesTable filters={{}} />));
		await screen.findByText("zed@x.org");

		fireEvent.click(screen.getByRole("button", { name: /recipient/ }));
		const recipients = () =>
			screen
				.getAllByRole("row")
				.slice(1)
				.map((row) => row.querySelectorAll("td")[2]?.textContent);
		expect(recipients()).toEqual(["amy@x.org", "zed@x.org"]);

		fireEvent.change(screen.getByRole("searchbox", { name: "filter" }), {
			target: { value: "zed" },
		});
		await screen.findByText("zed@x.org");
		expect(recipients()).toEqual(["zed@x.org"]);
	});

	it("warns that a full page may hide older records, and not otherwise", async () => {
		stubFetchJson({
			entries: Array.from({ length: 100 }, (_, i) =>
				entry({ time: i, recipient: `r${i}@x.org` }),
			),
		});
		render(withQuery(<DeliveriesTable filters={{}} />));
		expect(await screen.findByText("full")).toBeInTheDocument();
		cleanup();

		stubFetchJson({ entries: [entry({})] });
		render(withQuery(<DeliveriesTable filters={{}} />));
		await screen.findByText("r@example.net");
		expect(screen.queryByText("full")).toBeNull();
	});

	it("shows the empty text, the switched-off notice and the unreachable warning", async () => {
		stubFetchJson({ entries: [] });
		render(withQuery(<DeliveriesTable filters={{}} />));
		expect(await screen.findByText("empty")).toBeInTheDocument();
		cleanup();

		stubFetchJson(
			{ error: { code: "not_found", message: "disabled" } },
			404,
		);
		render(withQuery(<DeliveriesTable filters={{}} />));
		expect(await screen.findByRole("alert")).toHaveTextContent("disabled");
		cleanup();

		stubFetchReject();
		render(withQuery(<DeliveriesTable filters={{}} />));
		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("unreachable");
		expect(alert).toHaveClass("bg-warning");
	});

	it("shows 25 records a page, and narrows through its own form, not a Filters menu", async () => {
		stubFetchJson({
			entries: Array.from({ length: 30 }, (_, index) =>
				entry({
					spool_id: `01890a5d-ac96-774b-b9aa-9be4c3bd6c${String(index).padStart(2, "0")}`,
					recipient: `r${index}@example.net`,
					time: 1_700_000_000 - index,
				}),
			),
		});

		render(withQuery(<DeliveriesTable filters={{}} />));
		await screen.findByText("r0@example.net");

		expect(screen.getAllByRole("row").slice(1)).toHaveLength(25);
		expect(screen.queryByText("r25@example.net")).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "next" }));
		expect(screen.getAllByRole("row").slice(1)).toHaveLength(5);
		expect(screen.getByText("r25@example.net")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /filters/ })).toBeNull();
	});
});
