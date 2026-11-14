import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { withQuery } from "@/test/query-wrapper";
import { stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { FolderPane } = await import(".");

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

const FOLDERS = [
	{
		id: "INBOX",
		name: "INBOX",
		role: "inbox" as const,
		parentId: null,
		depth: 0,
		unread: 1,
		total: 2,
	},
];

describe("FolderPane", () => {
	it("waits, then shows the tree", async () => {
		stubJmap({
			"Mailbox/get": {
				list: [
					{
						id: "INBOX",
						name: "INBOX",
						role: "inbox",
						totalEmails: 2,
						unreadEmails: 1,
					},
				],
			},
		});
		// The stand-in's address is `/`, which is no folder: the tree marks none.
		const { container } = render(
			withQuery(
				<SidebarProvider>
					<FolderPane boxes={undefined} />
				</SidebarProvider>,
			),
		);
		expect(container.querySelector("[aria-busy=true]")).not.toBeNull();
		expect(
			await screen.findByRole("navigation", { name: "folders" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /role_inbox/ }),
		).toHaveAttribute("href", "/app/mail/inbox");
	});

	it("shows the folders the server read, without waiting for the browser", () => {
		// The tree is in the page the server sends: the folders it read are
		// the tree's first paint, not only the state of a query.
		const { container } = render(
			withQuery(
				<SidebarProvider>
					<FolderPane boxes={FOLDERS} />
				</SidebarProvider>,
			),
		);
		expect(container.querySelector("[aria-busy=true]")).toBeNull();
		expect(
			screen.getByRole("navigation", { name: "folders" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /role_inbox/ }),
		).toHaveAttribute("href", "/app/mail/inbox");
	});

	it("says the server is unreachable", async () => {
		stubJmap({});
		render(withQuery(<FolderPane boxes={undefined} />));
		const notice = await screen.findByRole("alert");
		expect(notice).toHaveTextContent("unavailable");
		// The rail collapsed to icons has no room for the sentence.
		expect(
			notice.closest(".group-data-\\[collapsible\\=icon\\]\\:sr-only"),
		).not.toBeNull();
	});
});
