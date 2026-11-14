import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { HOSTILE_NAMES } from "@/features/account-detail/test-support/hostile";
import { stubRoutes } from "@/features/account-detail/test-support/stub-routes";
import {
	sentRequests,
	stubFetchJson,
	stubFetchReject,
} from "@/lib/api/test-support/fetch";
import {
	mockRequestCookies,
	NotFoundSignal,
} from "@/lib/auth/test-support/cookies";
import { withAdminArea } from "@/test/admin-routes";
import { resolveServerTree } from "@/test/server-tree";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();

const { default: AccountDetailPage } = await import("./page");

const account = {
	name: "alice",
	display_name: null,
	addresses: ["alice@example.org"],
	dynamic: true,
};
const api = () =>
	stubRoutes([
		["GET", /\/accounts$/, { body: { accounts: [account] } }],
		["GET", /mailboxes$/, { body: { mailboxes: [], tree: [] } }],
		["GET", /masked$/, { body: { addresses: [] } }],
		["GET", /archive$/, { body: { entries: [] } }],
	]);
const page = (name: string) =>
	AccountDetailPage({ params: Promise.resolve({ name }) });
const outcome = (name: string) =>
	page(name).then(
		() => undefined,
		(error: unknown) => error,
	);
const paths = () => sentRequests().map((r) => new URL(r.url).pathname);

beforeEach(async () => {
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "test-token";
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

describe("AccountDetailPage", () => {
	it("heads the page with the account and prefetches the list and every section", async () => {
		api();

		render(withAdminArea(await resolveServerTree(await page("alice"))));

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"heading",
		);
		expect(paths().sort()).toEqual([
			"/api/v1/accounts",
			"/api/v1/accounts/alice/archive",
			"/api/v1/accounts/alice/mailboxes",
			"/api/v1/accounts/alice/masked",
		]);
		expect(
			await screen.findByText("alice@example.org"),
		).toBeInTheDocument();
	});

	it("answers 404, not a redirect, without a session and never calls the API", async () => {
		cookies.reset();
		api();

		const error = await outcome("alice");

		expect(error).toBeInstanceOf(NotFoundSignal);
		expect(sentRequests()).toHaveLength(0);
	});

	it("answers 404 for a forged cookie too, and even for a hostile name", async () => {
		cookies.reset();
		cookies.jar.set("__Host-epistle_session", "forged.token");
		api();

		expect(await outcome("alice")).toBeInstanceOf(NotFoundSignal);
		expect(await outcome("../status")).toBeInstanceOf(NotFoundSignal);
		expect(sentRequests()).toHaveLength(0);
	});

	it("answers 404 for every hostile name without asking the API anything", async () => {
		api();

		for (const name of HOSTILE_NAMES) {
			expect([
				name,
				(await outcome(name)) instanceof NotFoundSignal,
			]).toEqual([name, true]);
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("answers 404 for a well-formed name that is not on the list, and asks for no section", async () => {
		api();

		expect(await outcome("bob")).toBeInstanceOf(NotFoundSignal);
		expect(paths()).toEqual(["/api/v1/accounts"]);
	});

	it("still renders, asking for no section, when the list cannot be read", async () => {
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		render(withAdminArea(await resolveServerTree(await page("alice"))));

		expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"unreachable",
		);
		errors.mockRestore();
	});

	it("does not pass a name through to the API before it is a name", async () => {
		stubFetchJson({ accounts: [] });

		await outcome("../../x");

		expect(sentRequests()).toHaveLength(0);
	});
});
