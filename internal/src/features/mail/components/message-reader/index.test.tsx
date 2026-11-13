import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { withQuery } from "@/test/query-wrapper";
import { emailFixture, stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const originalMatchMedia = window.matchMedia;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { MessageReader } = await import(".");

const ID = "00000000-0000-4000-8000-0000000000b1";
const view = { box: "INBOX", page: 2, filter: "unread", q: "x" } as const;

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
	window.matchMedia = ((query: string) => ({
		matches: true,
		media: query,
	})) as typeof window.matchMedia;
});
afterEach(() => {
	window.matchMedia = originalMatchMedia;
	process.env = { ...savedEnv };
	cleanup();
	globalThis.fetch = originalFetch;
});

describe("MessageReader", () => {
	it("shows the message and, when the reader is alone on screen, moves the focus to its heading", async () => {
		stubJmap({
			"Email/get": {
				list: [
					emailFixture({
						id: ID,
						subject: "Read me",
						textBody: [{ partId: "1", type: "text/plain" }],
						bodyValues: { "1": { value: "the body" } },
						attachments: [
							{
								partId: "2",
								blobId: `${ID}.2`,
								type: "application/pdf",
								name: "a.pdf",
								size: 10,
							},
						],
					}),
				],
			},
		});
		render(withQuery(<MessageReader id={ID} view={view} />));
		expect(
			await screen.findByRole("heading", { level: 2, name: "Read me" }),
		).toBeInTheDocument();
		expect(screen.getByText("the body")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "download" }),
		).toBeInTheDocument();
		expect(document.activeElement).toBe(
			screen.getByRole("heading", { level: 2 }),
		);
		expect(screen.getByRole("article")).toBeInTheDocument();
	});

	it("keeps the focus where it is on a wide screen and links back to the list with its own view", async () => {
		window.matchMedia = ((query: string) => ({
			matches: false,
			media: query,
		})) as typeof window.matchMedia;
		stubJmap({ "Email/get": { list: [emailFixture({ id: ID })] } });
		render(withQuery(<MessageReader id={ID} view={view} />));
		await screen.findByRole("heading", { level: 2 });
		expect(document.activeElement).toBe(document.body);
		expect(screen.getByRole("link", { name: "back" })).toHaveAttribute(
			"href",
			"/app/mail?box=INBOX&page=2&filter=unread&q=x",
		);
	});

	it("goes back to the list, through its own link, when the message leaves its folder", async () => {
		stubJmap({
			"Email/get": {
				list: [emailFixture({ id: ID, keywords: { $seen: true } })],
			},
			"Mailbox/get": {
				list: [
					{
						id: "INBOX",
						role: "inbox",
						name: "INBOX",
						totalEmails: 1,
						unreadEmails: 0,
					},
					{
						id: "Archive",
						role: "archive",
						name: "Archive",
						totalEmails: 0,
						unreadEmails: 0,
					},
				],
			},
			"Email/set": { updated: { [ID]: null } },
		});
		render(withQuery(<MessageReader id={ID} view={view} />));
		await screen.findByRole("heading", { level: 2 });
		let followed = 0;
		screen
			.getByRole("link", { name: "back" })
			.addEventListener("click", (event) => {
				event.preventDefault();
				followed += 1;
			});
		fireEvent.click(screen.getByRole("button", { name: "archive" }));
		await waitFor(() => expect(followed).toBe(1));
	});

	it("waits, then says the message no longer exists", async () => {
		stubJmap({ "Email/get": { list: [], notFound: [ID] } });
		render(withQuery(<MessageReader id={ID} view={view} />));
		expect(screen.getByText("readerLoading")).toBeInTheDocument();
		expect(await screen.findByText("readerNotFound")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "back" })).toBeInTheDocument();
	});

	it("says the server is unreachable and retries", async () => {
		stubJmap({});
		render(withQuery(<MessageReader id={ID} view={view} />));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"unavailable",
		);
		stubJmap({
			"Email/get": { list: [emailFixture({ id: ID, subject: "Again" })] },
		});
		fireEvent.click(screen.getByRole("button", { name: "retry" }));
		expect(
			await screen.findByRole("heading", { name: "Again" }),
		).toBeInTheDocument();
	});
});
