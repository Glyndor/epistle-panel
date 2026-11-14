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
import {
	forgetListMemory,
	listMemory,
} from "@/features/mail/components/message-list/list-memory";
import { useKeptFocus } from "@/features/mail/components/message-list/use-kept-focus";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
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
	conditions: { ...EMPTY_CONDITIONS, unread: true, q: "x" },
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
	forgetListMemory();
	globalThis.fetch = originalFetch;
});

/** The folders of an account that can archive, and what holds the open message. */
const boxes = (holder: "inbox" | "trash" = "inbox") => ({
	list: [
		{
			id: "INBOX",
			role: holder,
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
});
/** Count the times the reader follows its own link back, without leaving the page. */
function watchBack() {
	const seen = { followed: 0 };
	screen
		.getByRole("link", { name: "back" })
		.addEventListener("click", (event) => {
			event.preventDefault();
			seen.followed += 1;
		});
	return seen;
}

/** Rows that keep the focus the way the list does, beside the reader. */
function Rows({ ids }: { ids: readonly string[] }) {
	const focus = useKeptFocus(ids);
	return (
		<div ref={focus.list} data-slot="message-list">
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
			"/app/mail/inbox?page=2&q=x&unread=1",
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
			"Mailbox/get": boxes(),
			"Email/set": { updated: { [ID]: null } },
		});
		render(withQuery(<MessageReader id={ID} view={view} />));
		await screen.findByRole("heading", { level: 2 });
		const back = watchBack();
		fireEvent.click(screen.getByRole("button", { name: "archive" }));
		await waitFor(() => expect(back.followed).toBe(1));
	});

	describe("the focus and the list", () => {
		const NEXT = "00000000-0000-4000-8000-0000000000b2";
		const leaving = (holder: "inbox" | "trash" = "inbox") =>
			stubJmap({
				"Email/get": {
					list: [emailFixture({ id: ID, keywords: { $seen: true } })],
				},
				"Mailbox/get": boxes(holder),
				"Email/set":
					holder === "trash"
						? { destroyed: [ID] }
						: { updated: { [ID]: null } },
			});
		const page = (
			ids: readonly string[],
			reader: boolean,
			client = testQueryClient(),
			beside: React.ReactNode = null,
		) =>
			withQuery(
				<>
					<Rows ids={ids} />
					{beside}
					{reader ? <MessageReader id={ID} view={view} /> : null}
				</>,
				client,
			);

		it.each([768, 360])(
			"returns archive focus to the next row after the hidden list is redrawn at %i px",
			async (width) => {
				leaving();
				window.matchMedia = ((query: string) => ({
					matches: width < 1024,
					media: query,
				})) as typeof window.matchMedia;
				const client = testQueryClient();
				const shown = render(page([ID, NEXT], true, client));
				const title = await screen.findByRole("heading", { level: 2 });
				expect(document.activeElement).toBe(title);
				const back = watchBack();

				// Layout is not computed by happy-dom: model the browser
				// refusing focus on a link inside the hidden list pane.
				const next = screen.getByRole("link", { name: "row next" });
				next.focus = () => {};
				fireEvent.click(
					screen.getByRole("button", { name: "archive" }),
				);
				await waitFor(() => expect(back.followed).toBe(1));
				// The refreshed list arrives before the next page. Its hidden
				// control cannot take focus, so the handoff must survive it.
				shown.rerender(page([NEXT], true, client));
				expect(document.activeElement).toBe(document.body);
				expect(listMemory.held).toEqual({ id: NEXT, mark: null });
				shown.unmount();
				render(page([NEXT], false, client));

				expect(document.activeElement).toBe(
					screen.getByRole("link", { name: "row next" }),
				);
			},
		);

		it("takes the focus from a row of the list, where the person opened the message", async () => {
			leaving();
			render(page([ID, NEXT], true));
			const row = screen.getByRole("link", { name: "row open" });
			row.focus();

			const title = await screen.findByRole("heading", { level: 2 });

			await waitFor(() => expect(document.activeElement).toBe(title));
		});

		it("leaves the focus in a field the person went to while the message was on its way", async () => {
			leaving();
			render(
				page(
					[ID, NEXT],
					true,
					testQueryClient(),
					<input aria-label="a field" />,
				),
			);
			const field = screen.getByRole("textbox", { name: "a field" });
			field.focus();

			await screen.findByRole("heading", { level: 2 });
			await settled();

			expect(document.activeElement).toBe(field);
		});

		it("stays out of the focus while the search field has it, though the field went with its page", async () => {
			leaving();
			// The person went to the search field and typed; the page of
			// the message then took the field away and left the focus on
			// the page, which is not the person letting go of it.
			listMemory.search = { text: "sal", max: 200 };
			render(page([ID, NEXT], true));

			await screen.findByRole("heading", { level: 2 });
			await settled();

			expect(document.activeElement).toBe(document.body);
		});

		it("hands the focus over when the person goes back to the list", async () => {
			leaving();
			render(page([ID, NEXT], true));
			await screen.findByRole("heading", { level: 2 });
			watchBack();

			fireEvent.click(screen.getByRole("link", { name: "back" }));

			expect(listMemory.held).toEqual({ id: ID, mark: null });
			expect(listMemory.acted).toBe(ID);
		});

		it("hands the focus over from the dialog that asks before deleting for good", async () => {
			leaving();
			render(
				page(
					[ID, NEXT],
					true,
					testQueryClient(),
					<div role="alertdialog">
						<button type="button">proceed</button>
					</div>,
				),
			);
			await screen.findByRole("heading", { level: 2 });
			const back = watchBack();
			// The dialog is drawn outside the reader, and has the focus
			// when the answer comes.
			screen.getByRole("button", { name: "proceed" }).focus();

			fireEvent.click(screen.getByRole("button", { name: "archive" }));
			await waitFor(() => expect(back.followed).toBe(1));

			expect(listMemory.held).toEqual({ id: ID, mark: null });
			expect(document.activeElement).toBe(document.body);
		});

		it("hands the focus over when the dialog has closed and left it on the page", async () => {
			leaving("trash");
			render(page([ID, NEXT], true));
			await screen.findByRole("heading", { level: 2 });
			const back = watchBack();

			fireEvent.click(
				screen.getByRole("button", { name: "deleteForever" }),
			);
			fireEvent.click(
				await screen.findByRole("button", { name: "proceed" }),
			);
			await waitFor(() => expect(back.followed).toBe(1));

			expect(listMemory.held).toEqual({ id: ID, mark: null });
		});

		it("does not take the focus from a field or another dialog when the message leaves", async () => {
			leaving();
			render(
				page(
					[ID, NEXT],
					true,
					testQueryClient(),
					<div role="dialog">
						<input aria-label="a field" />
					</div>,
				),
			);
			await screen.findByRole("heading", { level: 2 });
			const back = watchBack();
			const field = screen.getByRole("textbox", { name: "a field" });
			field.focus();

			fireEvent.click(screen.getByRole("button", { name: "archive" }));
			await waitFor(() => expect(back.followed).toBe(1));

			expect(document.activeElement).toBe(field);
		});
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
