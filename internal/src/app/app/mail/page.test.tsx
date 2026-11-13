import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { emailFixture, stubJmap } from "@/features/mail/test-support/jmap-stub";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { withQuery } from "@/test/query-wrapper";
import { firstPaint, resolveServerTree } from "@/test/server-tree";

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
/**
 * The same folder with its message already read. The reader marks an unread
 * message as read when it opens; a case that opens the reader and ends would
 * leave that call on its way, to land in the stub of the next case.
 */
const readFolder = {
	...folder,
	"Email/get": {
		list: [
			emailFixture({
				id: ID,
				subject: "Listed",
				keywords: { $seen: true },
			}),
		],
	},
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
		stubJmap({ ...mailboxes, ...readFolder });
		await renderPage({ msg: ID });
		expect(
			await screen.findByRole("heading", { level: 2, name: "Listed" }),
		).toBeInTheDocument();
		expect(screen.queryByText("readerEmpty")).toBeNull();
	});

	it("sends the frame of the three panes and a skeleton in each before the mail server is asked anything", async () => {
		// A token of its own: a call another case left on its way carries the
		// usual one, so only what this page asks is counted.
		process.env["EPISTLE_API_TOKEN"] = "frame-only-token";
		clearSecretCache();
		const seen = stubJmap({ ...mailboxes, ...readFolder });
		const asked = () =>
			seen.filter((r) => r.authorization === "Bearer frame-only-token");
		const tree = await MailPage({
			searchParams: Promise.resolve({ msg: ID }),
		});

		expect(asked()).toHaveLength(0);
		// Every boundary gives way to its fallback and is not run; what is left of
		// the frame (it has server components of its own) is then resolved.
		const { container } = render(
			withQuery(await resolveServerTree(firstPaint(tree))),
		);
		expect(
			screen.getByRole("region", { name: "listLabel" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("region", { name: "readerLabel" }),
		).toBeInTheDocument();
		// The folders (the side pane; the sheet holds its copy until opened), the list and the reader.
		expect(
			container.querySelectorAll('[aria-busy="true"]').length,
		).toBeGreaterThanOrEqual(3);
		expect(screen.getByText("loading")).toBeInTheDocument();
		expect(screen.getByText("readerLoading")).toBeInTheDocument();
		expect(screen.queryByText("Listed")).toBeNull();
		expect(asked()).toHaveLength(0);

		// The control: run the boundaries and the same counter sees their calls.
		cleanup();
		render(withQuery(await resolveServerTree(tree)));
		expect(asked().length).toBeGreaterThan(0);
	});

	it("opens a folder named in the address without waiting for the folder tree", async () => {
		// The folders cannot be read; the list of the named folder still is.
		const seen = stubJmap(folder);
		await renderPage({ box: "Sent" });

		expect(screen.getByText("Listed")).toBeInTheDocument();
		const filters = seen
			.flatMap((r) => r.calls)
			.filter((c) => c[0] === "Email/query")
			.map((c) => c[1]["filter"]);
		expect(filters).toContainEqual({ inMailbox: "Sent" });
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
