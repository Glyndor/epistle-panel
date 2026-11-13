import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";
import type { QueryClient } from "@tanstack/react-query";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { clearToasts, Toaster } from "@/components/ui/toaster";
import { queueKeys } from "@/features/queue/queries/queue-query";
import { queueEntryIdSchema } from "@/features/queue/schemas/queue-input";
import type { QueuePageView } from "@/features/queue/schemas/queue-view";
import {
	sentRequests,
	stubFetchJson,
	stubFetchReject,
} from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { answerConfirm, settle } from "@/test/confirm-dialog";
import { testQueryClient, withQuery } from "@/test/query-wrapper";

const ID = queueEntryIdSchema.parse("01890a5d-ac96-774b-b9aa-9be4c3bd6b0e");
const OTHER = queueEntryIdSchema.parse("01890a5d-ac96-774b-b9aa-9be4c3bd6b0f");
const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { RemoveEntryButton } = await import(".");

const page: QueuePageView = {
	entries: [
		{ id: ID, from: "a@x", recipients: ["r@x"] },
		{ id: OTHER, from: "b@x", recipients: ["s@x"] },
	],
	nextCursor: null,
};

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(async () => {
	await settle();
	cleanup();
	clearToasts();
	globalThis.fetch = originalFetch;
});

function setup(client: QueryClient = testQueryClient()) {
	client.setQueryData(queueKeys.page(undefined), page);
	render(
		withQuery(
			<>
				<RemoveEntryButton
					id={ID}
					recipients="r@x"
					cursor={undefined}
				/>
				<Toaster label="toasts" closeLabel="close" />
			</>,
			client,
		),
	);
	return client;
}

const click = () =>
	fireEvent.click(screen.getByRole("button", { name: "removeLabel" }));

describe("RemoveEntryButton", () => {
	it("does nothing when the confirmation is declined", async () => {
		stubFetchJson({ removed: ID });
		setup();

		click();
		await answerConfirm(false);

		expect(sentRequests()).toHaveLength(0);
	});

	it("deletes the entry once confirmed, takes the row out of the cache and reports success", async () => {
		stubFetchJson({ removed: ID });
		const client = setup();

		click();
		await answerConfirm(true);

		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("removed"),
		);
		const deletes = sentRequests().filter((r) => r.method === "DELETE");
		expect(deletes).toHaveLength(1);
		expect(deletes[0]?.url).toEndWith(`/api/v1/queue/${ID}`);
		expect(
			client
				.getQueryData<QueuePageView>(queueKeys.page(undefined))
				?.entries.map((e) => e.id),
		).not.toContain(ID);
	});

	it("puts the row back and reports an error when the server cannot be reached", async () => {
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();
		const client = setup();

		click();
		await answerConfirm(true);

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("removeError"),
		);
		expect(
			client
				.getQueryData<QueuePageView>(queueKeys.page(undefined))
				?.entries.map((e) => e.id),
		).toContain(ID);
		errors.mockRestore();
	});

	it("shows the pending label and disables itself while the request is in flight", async () => {
		let release: () => void = () => {};
		globalThis.fetch = mock(
			() =>
				new Promise<Response>((resolve) => {
					release = () =>
						resolve(
							new Response(JSON.stringify({ removed: ID }), {
								headers: { "content-type": "application/json" },
							}),
						);
				}),
		) as unknown as typeof fetch;
		setup();

		click();
		await answerConfirm(true);

		const button = await screen.findByRole("button", {
			name: "removeLabel",
		});
		await waitFor(() => expect(button).toBeDisabled());
		expect(button).toHaveTextContent("removing");
		await act(async () => release());
	});

	it("keeps the confirm text with the recipients", async () => {
		setup();

		click();
		await answerConfirm(false);
	});
});
