import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

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

describe("FolderPane", () => {
	it("waits, then shows the tree with the active folder marked", async () => {
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
		const { container } = render(
			withQuery(<FolderPane activeId="INBOX" />),
		);
		expect(container.querySelector("[aria-busy=true]")).not.toBeNull();
		expect(
			await screen.findByRole("navigation", { name: "folders" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /role_inbox/ }),
		).toHaveAttribute("aria-current", "page");
	});

	it("says the server is unreachable", async () => {
		stubJmap({});
		render(withQuery(<FolderPane activeId="INBOX" />));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"unavailable",
		);
	});
});
