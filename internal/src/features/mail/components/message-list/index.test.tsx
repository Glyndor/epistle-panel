import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { withQuery } from "@/test/query-wrapper";
import { emailFixture, stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { MessageList } = await import(".");

const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000a2";
const view = { box: "INBOX", page: 1, filter: "all", q: "" } as const;

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
});
