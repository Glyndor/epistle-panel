import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import type { PlaceRef } from "@/features/mail/queries/request-mail";
import { emailFixture, stubJmap } from "@/features/mail/test-support/jmap-stub";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { settled, withQuery } from "@/test/query-wrapper";
import { firstPaint, resolveServerTree } from "@/test/server-tree";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { MailPlace } = await import(".");

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
afterEach(async () => {
	// A pane whose data did not come from the server asks for it in the browser
	// as soon as it mounts. That call is let finish against this case's stub:
	// left on its way it lands in the next case's, with the next case's token
	// (the token is read when the call is made).
	await settled();
	process.env = { ...savedEnv };
	cleanup();
	globalThis.fetch = originalFetch;
});

const INBOX = { role: "inbox" } as const;

async function renderPlace(
	place: PlaceRef = INBOX,
	message: string | undefined = undefined,
	params: Record<string, string | string[] | undefined> = {},
) {
	return render(
		withQuery(
			await resolveServerTree(
				await MailPlace({
					place,
					message,
					searchParams: Promise.resolve(params),
				}),
			),
		),
	);
}

describe("MailPlace", () => {
	it("redirects to sign-in without a session", async () => {
		cookies.reset();
		const outcome = await MailPlace({
			place: INBOX,
			message: undefined,
			searchParams: Promise.resolve({}),
		}).catch((e) => e);
		expect(outcome).toBeInstanceOf(RedirectSignal);
	});

	it("opens the inbox by its role, prefetched, with its two named regions and no reader", async () => {
		const seen = stubJmap({ ...mailboxes, ...folder });
		await renderPlace();
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

	it("opens a folder by its role, and links stay on the role's path", async () => {
		const seen = stubJmap({ ...mailboxes, ...folder });
		await renderPlace({ role: "sent" });
		const filters = seen
			.flatMap((r) => r.calls)
			.filter((c) => c[0] === "Email/query")
			.map((c) => c[1]["filter"]);
		expect(filters).toContainEqual({ inMailbox: "Sent" });
		expect(screen.getByRole("link", { name: /Listed/ })).toHaveAttribute(
			"href",
			`/app/mail/sent/${ID}`,
		);
		expect(document.querySelector("form")).toHaveAttribute(
			"action",
			"/app/mail/sent",
		);
	});

	it("says so, and asks for no messages, when the account has no folder of the role", async () => {
		const seen = stubJmap({ ...mailboxes, ...folder });
		await renderPlace({ role: "junk" });
		expect(screen.getByText("noFolder")).toBeInTheDocument();
		expect(
			seen.flatMap((r) => r.calls).filter((c) => c[0] === "Email/query"),
		).toHaveLength(0);
		expect(screen.queryByRole("searchbox")).toBeNull();
	});

	it("says the server is unreachable, with a way to try again, when the folders could not be read for a role", async () => {
		const logged = spyOn(console, "error").mockImplementation(() => {});
		try {
			// No folder list: which folder is the sent one cannot be known.
			const seen = stubJmap(folder);
			await renderPlace({ role: "sent" });
			expect(screen.queryByText("noFolder")).toBeNull();
			expect(screen.getByText("unavailable")).toBeInTheDocument();
			expect(screen.getByRole("link", { name: "retry" })).toHaveAttribute(
				"href",
				"/app/mail/sent",
			);
			expect(
				seen
					.flatMap((r) => r.calls)
					.filter((c) => c[0] === "Email/query"),
			).toHaveLength(0);
		} finally {
			logged.mockRestore();
		}
	});

	it("keeps the filter and search from the address, dropping a bad parameter on its own", async () => {
		const seen = stubJmap({ ...mailboxes, ...folder });
		await renderPlace({ box: "Sent" }, undefined, {
			filter: "bogus",
			q: "x",
			// What used to name the folder and the message is no longer read here.
			box: "Mail",
			msg: ID,
		});
		expect(screen.getByText("readerEmpty")).toBeInTheDocument();
		const filters = seen
			.flatMap((r) => r.calls)
			.filter((c) => c[0] === "Email/query")
			.map((c) => c[1]["filter"]);
		expect(filters).toContainEqual({ inMailbox: "Sent" });
		expect(screen.getByRole("searchbox")).toHaveValue("x");
	});

	it("opens the reader for a message in the address", async () => {
		stubJmap({ ...mailboxes, ...readFolder });
		await renderPlace(INBOX, ID);
		expect(
			await screen.findByRole("heading", { level: 2, name: "Listed" }),
		).toBeInTheDocument();
		expect(screen.queryByText("readerEmpty")).toBeNull();
	});

	it("sends the frame of the two panes and a skeleton in each before the mail server is asked anything", async () => {
		// A token of its own: a call another case left on its way carries the
		// usual one, so only what this page asks is counted.
		process.env["EPISTLE_API_TOKEN"] = "frame-only-token";
		clearSecretCache();
		const seen = stubJmap({ ...mailboxes, ...readFolder });
		const asked = () =>
			seen.filter((r) => r.authorization === "Bearer frame-only-token");
		const tree = await MailPlace({
			place: INBOX,
			message: ID,
			searchParams: Promise.resolve({}),
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
		// The list and the reader; the folders are the sidebar's.
		expect(
			container.querySelectorAll('[aria-busy="true"]').length,
		).toBeGreaterThanOrEqual(2);
		expect(
			screen.queryByRole("navigation", { name: "folders" }),
		).toBeNull();
		expect(screen.getByText("loading")).toBeInTheDocument();
		expect(screen.getByText("readerLoading")).toBeInTheDocument();
		expect(screen.queryByText("Listed")).toBeNull();
		expect(asked()).toHaveLength(0);

		// The control: run the boundaries and the same counter sees their calls.
		cleanup();
		render(withQuery(await resolveServerTree(tree)));
		expect(asked().length).toBeGreaterThan(0);
	});

	it("names the folder in the page's one heading, which is not drawn", async () => {
		stubJmap({ ...mailboxes, ...folder });
		await renderPlace();
		const heading = screen.getByRole("heading", { level: 1 });
		expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
		expect(heading).toHaveTextContent("role_inbox");
		expect(heading).toHaveClass("sr-only");
		cleanup();

		// A folder with no role is named by the last part of its own name.
		await renderPlace({ box: "Work/Q4" });
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"Q4",
		);
		expect(
			screen.getByRole("heading", { level: 1 }).querySelector("bdi"),
		).not.toBeNull();
	});

	it("draws its panes as surfaces raised off the canvas, with a radius and no line", async () => {
		stubJmap({ ...mailboxes, ...folder });
		await renderPlace();

		for (const name of ["listLabel", "readerLabel"]) {
			const pane = screen.getByRole("region", { name });
			expect(pane).toHaveClass("bg-surface", "rounded-2xl", "min-h-0");
			expect(pane.className).not.toMatch(/(^|\s)(border|shadow)/);
		}
		// The reader scrolls on its own; the list's rows do, inside it.
		expect(screen.getByRole("region", { name: "readerLabel" })).toHaveClass(
			"overflow-y-auto",
		);
	});

	it("keeps the way into the composer in reach where the sidebar is a sheet", async () => {
		stubJmap({ ...mailboxes, ...folder });
		await renderPlace();

		const write = screen.getByRole("link", { name: "compose" });
		expect(write).toHaveAttribute("href", "/app/mail/compose");
		expect(write.closest("div")).toHaveClass("md:hidden");
	});

	it("opens a folder named in the address without waiting for the folder tree", async () => {
		// The folders cannot be read; the list of the named folder still is.
		const seen = stubJmap(folder);
		await renderPlace({ box: "Sent" });

		expect(screen.getByText("Listed")).toBeInTheDocument();
		const filters = seen
			.flatMap((r) => r.calls)
			.filter((c) => c[0] === "Email/query")
			.map((c) => c[1]["filter"]);
		expect(filters).toContainEqual({ inMailbox: "Sent" });
	});

	it("still renders when the mail server is down, falling back to INBOX", async () => {
		stubJmap({});
		await renderPlace();
		expect(
			screen.getByRole("region", { name: "listLabel" }),
		).toBeInTheDocument();
		expect(screen.getByRole("searchbox")).toBeInTheDocument();
	});

	it("still renders when there is no mail session at all", async () => {
		process.env["EPISTLE_API_TOKEN_FILE"] = "/nonexistent";
		delete process.env["EPISTLE_API_TOKEN"];
		const seen = stubJmap({});
		await renderPlace();
		expect(seen).toHaveLength(0);
	});
});
