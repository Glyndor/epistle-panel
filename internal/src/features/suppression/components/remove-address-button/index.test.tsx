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
import { suppressionKeys } from "@/features/suppression/queries/suppression-query";
import type { SuppressionPageView } from "@/features/suppression/schemas/suppression-view";
import {
	sentRequests,
	stubFetchJson,
	stubFetchReject,
} from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { testQueryClient, withQuery } from "@/test/query-wrapper";

const A = "a@example.org";
const B = "b@example.org";
const originalFetch = globalThis.fetch;
const originalConfirm = window.confirm;
const cookies = mockRequestCookies();
const { RemoveAddressButton } = await import(".");

const page: SuppressionPageView = {
	entries: [{ address: A }, { address: B }],
	nextCursor: null,
};

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	clearToasts();
	globalThis.fetch = originalFetch;
	window.confirm = originalConfirm;
});

function setup(client: QueryClient = testQueryClient()) {
	client.setQueryData(suppressionKeys.page(undefined), page);
	render(
		withQuery(
			<>
				<RemoveAddressButton address={A} after={undefined} />
				<Toaster label="toasts" closeLabel="close" />
			</>,
			client,
		),
	);
	return client;
}

const click = () =>
	fireEvent.click(screen.getByRole("button", { name: "removeLabel" }));
const cached = (client: QueryClient) =>
	client
		.getQueryData<SuppressionPageView>(suppressionKeys.page(undefined))
		?.entries.map((e) => e.address);

describe("RemoveAddressButton", () => {
	it("does nothing when the confirmation is declined", () => {
		window.confirm = mock(() => false);
		stubFetchJson({ removed: A });
		setup();

		click();

		expect(sentRequests()).toHaveLength(0);
	});

	it("deletes the address once confirmed, takes the row out of the cache and reports success", async () => {
		window.confirm = mock(() => true);
		stubFetchJson({ removed: A });
		const client = setup();

		click();

		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("removed"),
		);
		const deletes = sentRequests().filter((r) => r.method === "DELETE");
		expect(deletes).toHaveLength(1);
		expect(deletes[0]?.url).toEndWith(
			"/api/v1/suppression/a%40example.org",
		);
		expect(cached(client)).not.toContain(A);
	});

	it("puts the row back and reports an error when the server cannot be reached", async () => {
		window.confirm = mock(() => true);
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();
		const client = setup();

		click();

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("removeError"),
		);
		expect(cached(client)).toContain(A);
		errors.mockRestore();
	});

	it("shows the pending label and disables itself while the request is in flight", async () => {
		window.confirm = mock(() => true);
		let release: () => void = () => {};
		globalThis.fetch = mock(
			() =>
				new Promise<Response>((resolve) => {
					release = () =>
						resolve(
							new Response(JSON.stringify({ removed: A }), {
								headers: { "content-type": "application/json" },
							}),
						);
				}),
		) as unknown as typeof fetch;
		setup();

		click();

		const button = await screen.findByRole("button", {
			name: "removeLabel",
		});
		await waitFor(() => expect(button).toBeDisabled());
		expect(button).toHaveTextContent("removing");
		await act(async () => release());
	});

	it("asks for confirmation naming the address", () => {
		const confirm = mock(() => false);
		window.confirm = confirm;
		setup();

		click();

		expect(confirm).toHaveBeenCalledTimes(1);
	});
});
