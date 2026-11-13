import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { emailFixture, stubJmap } from "@/features/mail/test-support/jmap-stub";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { withQuery } from "@/test/query-wrapper";
import { resolveServerTree } from "@/test/server-tree";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { default: MailPage } = await import("./page");

const ID = "00000000-0000-4000-8000-0000000000c1";
const mailboxes = {
	"Mailbox/get": {
		list: [
			{
				id: "Mail",
				name: "Mail",
				role: "inbox",
				totalEmails: 1,
				unreadEmails: 1,
			},
			{
				id: "Sent",
				name: "Sent",
				role: "sent",
				totalEmails: 0,
				unreadEmails: 0,
			},
		],
	},
};
const folder = {
	"Email/query": { ids: [ID] },
	"Email/get": { list: [emailFixture({ id: ID, subject: "Listed" })] },
};

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
});
afterEach(() => {
	process.env = { ...savedEnv };
	cleanup();
	globalThis.fetch = originalFetch;
});

async function renderPage(
	params: Record<string, string | string[] | undefined> = {},
) {
	return render(
		withQuery(
			await resolveServerTree(
				await MailPage({ searchParams: Promise.resolve(params) }),
			),
		),
	);
}

describe("MailPage", () => {
	it("redirects to sign-in without a session", async () => {
		cookies.reset();
		const outcome = await MailPage({
			searchParams: Promise.resolve({}),
		}).catch((e) => e);
		expect(outcome).toBeInstanceOf(RedirectSignal);
	});

	it("opens the inbox by its role, prefetched, with the three named regions and no reader", async () => {
		const seen = stubJmap({ ...mailboxes, ...folder });
		await renderPage();
		expect(screen.getByText("Listed")).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: "listLabel" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: "readerLabel" }),
		).toBeInTheDocument();
		expect(screen.getByText("readerEmpty")).toBeInTheDocument();
		const filters = seen
			.flatMap((r) => r.calls)
			.filter((c) => c[0] === "Email/query")
			.map((c) => c[1]["filter"]);
		expect(filters).toContainEqual({ inMailbox: "Mail" });
	});

	it("keeps the folder, filter and search from the address, dropping a bad parameter on its own", async () => {
		const seen = stubJmap({ ...mailboxes, ...folder });
		await renderPage({ box: "Sent", filter: "bogus", q: "x" });
		const filters = seen
			.flatMap((r) => r.calls)
			.filter((c) => c[0] === "Email/query")
			.map((c) => c[1]["filter"]);
		expect(filters).toContainEqual({ inMailbox: "Sent" });
		expect(screen.getByRole("searchbox")).toHaveValue("x");
	});

	it("opens the reader for a message in the address", async () => {
		stubJmap({ ...mailboxes, ...folder });
		await renderPage({ msg: ID });
		expect(
			await screen.findByRole("heading", { level: 2, name: "Listed" }),
		).toBeInTheDocument();
		expect(screen.queryByText("readerEmpty")).toBeNull();
	});

	it("still renders when the mail server is down, falling back to INBOX", async () => {
		stubJmap({});
		await renderPage();
		expect(
			screen.getByRole("region", { name: "listLabel" }),
		).toBeInTheDocument();
		expect(screen.getByRole("searchbox")).toBeInTheDocument();
	});

	it("still renders when there is no mail session at all", async () => {
		process.env["EPISTLE_API_TOKEN_FILE"] = "/nonexistent";
		delete process.env["EPISTLE_API_TOKEN"];
		const seen = stubJmap({});
		await renderPage();
		expect(seen).toHaveLength(0);
	});
});
