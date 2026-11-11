import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { stubFetchJson, stubFetchReject } from "@/lib/api/test-fetch";

mock.module("next-intl/server", () => ({
	getTranslations: async () => (key: string) => key,
}));
// RemoveButton (a client component) is rendered in the list.
mock.module("next-intl", () => ({
	useTranslations: () => (key: string) => key,
}));
mock.module("next/cache", () => ({ revalidatePath: () => {} }));

const { default: QueuePage } = await import("./page");

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";
const NEXT = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0f";

afterEach(cleanup);

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

		render(await QueuePage({ searchParams: Promise.resolve({}) }));

		expect(screen.getByText(/sender@example.org/)).toBeInTheDocument();
		expect(screen.getByText(/rcpt@elsewhere.example/)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "removeLabel" }),
		).toBeInTheDocument();
	});

	it("renders a next-page link when the API returns a cursor", async () => {
		stubFetchJson({
			entries: [
				{ id: ID, reverse_path: "", recipients: ["a@b.example"] },
			],
			next_cursor: NEXT,
		});

		render(await QueuePage({ searchParams: Promise.resolve({}) }));

		// A null reverse_path renders as the placeholder envelope sender.
		expect(screen.getByText(/<>/)).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "next" })).toHaveAttribute(
			"href",
			`/queue?cursor=${NEXT}`,
		);
	});

	it("shows the empty state for an empty queue", async () => {
		stubFetchJson({ entries: [] });

		render(await QueuePage({ searchParams: Promise.resolve({}) }));

		expect(screen.getByText("empty")).toBeInTheDocument();
	});

	it("shows the unreachable notice when the API errors", async () => {
		stubFetchReject();

		render(
			await QueuePage({ searchParams: Promise.resolve({ cursor: ID }) }),
		);

		expect(screen.getByRole("alert")).toHaveTextContent("unreachable");
	});
});
