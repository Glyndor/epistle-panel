import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { clearToasts } from "@/components/ui/toaster";
import { useKeptFocus } from "@/features/mail/components/message-list/use-kept-focus";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { settled, testQueryClient, withQuery } from "@/test/query-wrapper";
import { detail } from "../../test-support/fixtures";
import { emailFixture, stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const originalMatchMedia = window.matchMedia;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { MessageReader } = await import(".");

const ID = "00000000-0000-4000-8000-0000000000b1";
const view = {
	box: "INBOX",
	role: "inbox",
	page: 2,
	filter: "unread",
	q: "x",
} as const;

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
afterEach(clearToasts);
afterEach(async () => {
	// The reader marks an unread message as read when it opens: that call is
	// let finish against this case's stub.
	await settled();
	window.matchMedia = originalMatchMedia;
	process.env = { ...savedEnv };
	cleanup();
	globalThis.fetch = originalFetch;
});

/** Rows that keep the focus the way the list does, beside the reader. */
function Rows({ ids }: { ids: readonly string[] }) {
	const focus = useKeptFocus(ids);
	return (
		<div ref={focus.list}>
			{ids.map((id) => (
				<div key={id} data-slot="message-row">
					<a href={`#${id}`} data-message-id={id}>
						row {id === ID ? "open" : "next"}
					</a>
				</div>
			))}
		</div>
	);
}

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

	it("moves the focus to the title of a message the person opened, also where the list is beside the reader", async () => {
		window.matchMedia = ((query: string) => ({
			matches: false,
			media: query,
		})) as typeof window.matchMedia;
		stubJmap({ "Email/get": { list: [emailFixture({ id: ID })] } });
		// Drawn in the page by something done in it: a press on a row, a key.
		render(withQuery(<MessageReader id={ID} view={view} />));

		const title = await screen.findByRole("heading", { level: 2 });
		expect(document.activeElement).toBe(title);
		expect(title).toHaveAttribute("tabindex", "-1");
		expect(screen.getByRole("link", { name: "back" })).toHaveAttribute(
			"href",
			"/app/mail/inbox?page=2&filter=unread&q=x",
		);
	});

	/** The reader as it comes with the page: drawn on the server, then taken over in the browser. */
	function withThePage(alone: boolean) {
		window.matchMedia = ((query: string) => ({
			matches: alone,
			media: query,
		})) as typeof window.matchMedia;
		const client = testQueryClient();
		client.setQueryData(
			mailKeys.message(ID),
			detail({ id: ID, subject: "Read me" }),
		);
		client.setQueryData(mailKeys.mailboxes, []);
		const ui = withQuery(<MessageReader id={ID} view={view} />, client);
		const container = document.createElement("div");
		document.body.append(container);
		container.innerHTML = renderToString(ui);
		render(ui, { container, hydrate: true });
		return { client, container };
	}

	it("leaves the focus alone for a message that came with the page, where the list is beside the reader", () => {
		const { container } = withThePage(false);

		expect(
			screen.getByRole("heading", { level: 2, name: "Read me" }),
		).toBeInTheDocument();
		expect(document.activeElement).toBe(document.body);
		container.remove();
	});

	it("takes the focus for a message that came with the page where the reader is the only pane", () => {
		const { container } = withThePage(true);

		expect(document.activeElement).toBe(
			screen.getByRole("heading", { level: 2, name: "Read me" }),
		);
		container.remove();
	});

	it("takes the focus once per message, not each time the message is read again", async () => {
		stubJmap({ "Email/get": { list: [emailFixture({ id: ID })] } });
		const client = testQueryClient();
		render(withQuery(<MessageReader id={ID} view={view} />, client));
		const title = await screen.findByRole("heading", { level: 2 });
		const back = screen.getByRole("link", { name: "back" });
		back.focus();

		// A mark set from the list changes the message in the cache.
		act(() => {
			client.setQueryData(mailKeys.message(ID), (now: unknown) => ({
				...(now as object),
				flagged: true,
			}));
		});

		// Once the reader has drawn the change, the focus is where it was.
		expect(
			await screen.findByRole("button", { name: "unstar" }),
		).toBeInTheDocument();
		expect(document.activeElement).toBe(back);
		expect(document.activeElement).not.toBe(title);
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

	it("leaves the focus to the list when the message is archived with the focus in the reader", async () => {
		const NEXT = "00000000-0000-4000-8000-0000000000b2";
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
						totalEmails: 2,
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
		const client = testQueryClient();
		const page = (ids: readonly string[], reader: boolean) =>
			withQuery(
				<>
					<Rows ids={ids} />
					{reader ? <MessageReader id={ID} view={view} /> : null}
				</>,
				client,
			);
		const shown = render(page([ID, NEXT], true));
		const title = await screen.findByRole("heading", { level: 2 });
		expect(document.activeElement).toBe(title);
		let followed = 0;
		screen
			.getByRole("link", { name: "back" })
			.addEventListener("click", (event) => {
				event.preventDefault();
				followed += 1;
			});

		fireEvent.click(screen.getByRole("button", { name: "archive" }));
		await waitFor(() => expect(followed).toBe(1));
		// Back at the list: the reader is gone, and so is the message's row.
		shown.rerender(page([NEXT], false));

		expect(document.activeElement).toBe(
			screen.getByRole("link", { name: "row next" }),
		);
		fireEvent.pointerDown(document.body);
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
