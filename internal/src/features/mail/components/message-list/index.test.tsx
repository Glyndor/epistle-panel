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
import { settled, withQuery } from "@/test/query-wrapper";
import { emailFixture, stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { MessageList } = await import(".");

const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000a2";
const view = {
	box: "INBOX",
	role: "inbox",
	page: 1,
	filter: "all",
	q: "",
} as const;

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
});
afterEach(async () => {
	// What the page remembers of the focus goes with a press on nothing.
	fireEvent.pointerDown(document.body);
	await settled();
	process.env = { ...savedEnv };
	cleanup();
	globalThis.fetch = originalFetch;
});

describe("MessageList", () => {
	it("lists the page's messages and marks the selected one", async () => {
		stubJmap({
			"Email/query": { ids: [A, B] },
			"Email/get": {
				list: [
					emailFixture({ id: A, subject: "First" }),
					emailFixture({ id: B, subject: "Second" }),
				],
			},
		});
		render(withQuery(<MessageList view={view} selectedId={B} />));
		expect(await screen.findByText("First")).toBeInTheDocument();
		const links = screen
			.getAllByRole("link")
			.filter((l) => l.hasAttribute("data-message-id"));
		expect(links).toHaveLength(2);
		expect(links[1]).toHaveAttribute("aria-current", "true");
		expect(
			screen.getByRole("navigation", { name: "pagination" }),
		).toBeInTheDocument();
	});

	it("says the folder is empty, and says no message matches for a filter or a search", async () => {
		stubJmap({ "Email/query": { ids: [] }, "Email/get": { list: [] } });
		render(withQuery(<MessageList view={view} selectedId={undefined} />));
		expect(await screen.findByText("emptyFolder")).toBeInTheDocument();
		cleanup();
		render(
			withQuery(
				<MessageList
					view={{ ...view, q: "x" }}
					selectedId={undefined}
				/>,
			),
		);
		expect(
			await screen.findByText("emptyMatches emptyHint"),
		).toBeInTheDocument();
	});

	it("shows a waiting state first", () => {
		stubJmap({ "Email/query": { ids: [] }, "Email/get": { list: [] } });
		render(withQuery(<MessageList view={view} selectedId={undefined} />));
		expect(screen.getByText("loading")).toBeInTheDocument();
	});

	it("says the server is unreachable and retries on demand", async () => {
		stubJmap({});
		render(withQuery(<MessageList view={view} selectedId={undefined} />));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"unavailable",
		);
		stubJmap({
			"Email/query": { ids: [A] },
			"Email/get": { list: [emailFixture({ id: A, subject: "Back" })] },
		});
		fireEvent.click(screen.getByRole("button", { name: "retry" }));
		expect(await screen.findByText("Back")).toBeInTheDocument();
	});

	it("draws the page under date headings, each naming its own list", async () => {
		stubJmap({
			"Email/query": { ids: [A, B] },
			"Email/get": {
				list: [
					emailFixture({ id: A, receivedAt: "2020-03-05T10:00:00Z" }),
					emailFixture({ id: B, receivedAt: "2019-07-01T10:00:00Z" }),
				],
			},
		});
		render(withQuery(<MessageList view={view} selectedId={undefined} />));

		// Two months of years gone by, whatever day the test runs on.
		const headings = await screen.findAllByRole("heading", { level: 3 });
		expect(headings.map((h) => h.textContent)).toEqual([
			"2020-03-01T00:00:00.000Z",
			"2019-07-01T00:00:00.000Z",
		]);
		for (const heading of headings) {
			expect(
				screen.getByRole("list", { name: heading.textContent ?? "" }),
			).toBeInTheDocument();
		}
	});

	it("stars a message from its row, and the row shows it before the server answers", async () => {
		// The server as it is: starred once the change was written.
		let starred = false;
		const seen = stubJmap({
			"Email/query": { ids: [A] },
			"Email/get": () => ({
				list: [
					emailFixture({
						id: A,
						keywords: starred
							? { $seen: true, $flagged: true }
							: { $seen: true },
					}),
				],
			}),
			"Email/set": () => {
				starred = true;
				return { updated: { [A]: null } };
			},
		});
		const sets = () =>
			seen.flatMap((r) => r.calls).filter((c) => c[0] === "Email/set");
		render(withQuery(<MessageList view={view} selectedId={undefined} />));
		const star = await screen.findByRole("button", { name: "star" });
		await settled();
		// From here every answer waits until the case has looked at the row.
		let release = () => {};
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});
		const answer = globalThis.fetch;
		globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
			await held;
			return answer(...args);
		}) as typeof fetch;

		fireEvent.click(star);

		// Nothing was written yet: what shows is the list's own cache.
		const filled = await screen.findByRole("button", { name: "unstar" });
		expect(filled).toHaveAttribute("data-set", "true");
		expect(sets()).toHaveLength(0);

		release();
		await waitFor(() => expect(sets()).toHaveLength(1));
		await settled();
		expect(
			screen.getByRole("button", { name: "unstar" }),
		).toBeInTheDocument();
	});
	it("draws the list's own heading around every state, and an empty list that can show the focus", async () => {
		stubJmap({ "Email/query": { ids: [] }, "Email/get": { list: [] } });
		const { container } = render(
			withQuery(<MessageList view={view} selectedId={undefined} />),
		);

		// Waiting, and then empty: the heading is there both times.
		const heading = () => screen.getByRole("heading", { level: 2 });
		expect(heading()).toHaveTextContent("listLabel");
		expect(await screen.findByText("emptyFolder")).toBeInTheDocument();
		expect(heading()).toHaveClass("sr-only");
		// The heading is for assistive technology and takes no focus. The
		// notice does, in view and with the ring.
		expect(heading()).not.toHaveAttribute("tabindex");
		const notice = container.querySelector('[data-slot="empty-list"]');
		expect(notice).toHaveAttribute("tabindex", "-1");
		expect(notice).toHaveClass(
			"outline-ring",
			"focus-visible:outline-2",
			"focus-visible:-outline-offset-2",
		);
		expect(notice?.className).not.toContain("sr-only");
		expect(notice).toHaveTextContent("emptyFolder");
	});

	it("keeps the focus in the list when taking the star off removes the row under the starred filter", async () => {
		// The server as it is: a message without its star leaves the starred list.
		let starred = [A, B];
		stubJmap({
			"Email/query": () => ({ ids: starred }),
			"Email/get": (args: Record<string, unknown>) => ({
				list: ((args["ids"] as string[] | undefined) ?? starred).map(
					(id) =>
						emailFixture({
							id,
							subject: id === A ? "First" : "Second",
							keywords: starred.includes(id)
								? { $seen: true, $flagged: true }
								: { $seen: true },
						}),
				),
			}),
			"Email/set": () => {
				starred = [B];
				return { updated: { [A]: null } };
			},
		});
		render(
			withQuery(
				<MessageList
					view={{ ...view, filter: "flagged" }}
					selectedId={undefined}
				/>,
			),
		);
		const [first] = await screen.findAllByRole("button", {
			name: "unstar",
		});
		first?.focus();

		fireEvent.click(first as HTMLElement);

		await waitFor(() => expect(screen.queryByText("First")).toBeNull());
		// One row left: the focus is on its star, not on the page.
		const left = screen.getByRole("button", { name: "unstar" });
		await waitFor(() => expect(document.activeElement).toBe(left));
	});
	it("puts the focus on the notice when the last starred message loses its star", async () => {
		let starred = [A];
		stubJmap({
			"Email/query": () => ({ ids: starred }),
			"Email/get": (args: Record<string, unknown>) => ({
				list: ((args["ids"] as string[] | undefined) ?? starred).map(
					(id) =>
						emailFixture({
							id,
							keywords: starred.includes(id)
								? { $seen: true, $flagged: true }
								: { $seen: true },
						}),
				),
			}),
			"Email/set": () => {
				starred = [];
				return { updated: { [A]: null } };
			},
		});
		const { container } = render(
			withQuery(
				<MessageList
					view={{ ...view, filter: "flagged" }}
					selectedId={undefined}
				/>,
			),
		);
		const star = await screen.findByRole("button", { name: "unstar" });
		star.focus();

		fireEvent.click(star);

		await waitFor(() =>
			expect(document.activeElement).toBe(
				container.querySelector('[data-slot="empty-list"]'),
			),
		);
		expect(document.activeElement).toHaveTextContent(
			"emptyMatches emptyHint",
		);
	});
});
