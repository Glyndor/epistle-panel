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
const page = (name: string, section?: string) =>
	AccountDetailPage({
		params: Promise.resolve({ name }),
		searchParams: Promise.resolve(section === undefined ? {} : { section }),
	});
const outcome = (name: string, section?: string) =>
	page(name, section).then(
		() => undefined,
		(error: unknown) => error,
	);
const paths = () => sentRequests().map((r) => new URL(r.url).pathname);
const shown = async (name: string, section?: string) =>
	render(withAdminArea(await resolveServerTree(await page(name, section))));

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
	it("heads the page with the account and asks for the list alone", async () => {
		api();

		await shown("alice");

		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"heading",
		);
		expect(paths()).toEqual(["/api/v1/accounts"]);
	});

	it("offers the sections as links and marks the one on screen", async () => {
		api();

		await shown("alice", "profile");

		const links = screen.getAllByRole("link");
		expect(links.map((link) => link.textContent)).toEqual([
			"sectionOverview",
			"profileTitle",
			"sectionSecurity",
			"mailboxesTitle",
			"maskedTitle",
			"archiveTitle",
		]);
		expect(
			links.filter(
				(link) => link.getAttribute("aria-current") === "page",
			),
		).toHaveLength(1);
		expect(
			screen.getByRole("link", { name: "profileTitle" }),
		).toHaveAttribute("aria-current", "page");
	});

	it("shows the overview when the address names no section, or one that is not offered", async () => {
		api();

		await shown("alice");
		expect(
			screen.getByRole("link", { name: "sectionOverview" }),
		).toHaveAttribute("aria-current", "page");

		cleanup();
		await shown("alice", "nope");
		expect(
			screen.getByRole("link", { name: "sectionOverview" }),
		).toHaveAttribute("aria-current", "page");
		expect(paths()).toEqual(["/api/v1/accounts", "/api/v1/accounts"]);
	});

	it("asks for the dataset of the section on screen, and for no other", async () => {
		api();

		await shown("alice", "mailboxes");

		expect(paths().sort()).toEqual(["/api/v1/accounts/alice/mailboxes"]);
	});

	it("asks for the masked addresses only on their own section", async () => {
		api();

		await shown("alice", "masked");

		expect(paths().sort()).toEqual(["/api/v1/accounts/alice/masked"]);
	});

	it("asks for the archive only on its own section", async () => {
		api();

		await shown("alice", "archive");

		expect(paths().sort()).toEqual(["/api/v1/accounts/alice/archive"]);
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

		await shown("alice");

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
