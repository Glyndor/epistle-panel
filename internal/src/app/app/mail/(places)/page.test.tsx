import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { getBrand } from "@/features/branding/queries/brand";
import { emailFixture, stubJmap } from "@/features/mail/test-support/jmap-stub";
import {
	followRedirect,
	mockRequestCookies,
} from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { settled, withQuery } from "@/test/query-wrapper";
import { resolveServerTree } from "@/test/server-tree";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { default: MailHome, generateMetadata } = await import("./page");

const ID = "00000000-0000-4000-8000-0000000000c1";

const LISTED = "00000000-0000-4000-8000-0000000000c2";
const answers = {
	"Mailbox/get": {
		list: [
			{
				id: "Mail",
				name: "Mail",
				role: "inbox",
				totalEmails: 1,
				unreadEmails: 0,
			},
		],
	},
	"Email/query": { ids: [LISTED] },
	"Email/get": {
		list: [
			emailFixture({
				id: LISTED,
				subject: "Listed",
				keywords: { $seen: true },
			}),
		],
	},
};

/** Render the home with these parameters and say which folders were asked for. */
async function home(
	params: Record<string, string | string[] | undefined> = {},
) {
	const seen = stubJmap(answers);
	render(
		withQuery(
			await resolveServerTree(
				await MailHome({ searchParams: Promise.resolve(params) }),
			),
		),
	);
	return seen
		.flatMap((request) => request.calls)
		.filter((call) => call[0] === "Email/query")
		.map((call) => call[1]["filter"]);
}

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
});
afterEach(async () => {
	await settled();
	process.env = { ...savedEnv };
	cleanup();
	globalThis.fetch = originalFetch;
});

describe("/app/mail", () => {
	it("sends a visitor without a session to sign in, whatever the address held", async () => {
		cookies.reset();
		const signal = await followRedirect(
			MailHome({
				searchParams: Promise.resolve({ box: "Sent", msg: ID }),
			}).then(resolveServerTree),
		);
		expect(signal.target).toBe("/");
	});

	it("is the inbox itself, with no second trip, and its links are the inbox's own", async () => {
		expect(await home()).toContainEqual({ inMailbox: "Mail" });
		expect(screen.getByRole("link", { name: /Listed/ })).toHaveAttribute(
			"href",
			`/app/mail/inbox/${LISTED}`,
		);
		expect(await generateMetadata()).toEqual({
			title: `role_inbox · ${getBrand().name}`,
		});
	});

	it("keeps what narrows the list, which is no place", async () => {
		await home({ filter: "unread", q: "x", page: "1" });
		expect(screen.getByRole("searchbox")).toHaveValue("x");
		expect(document.querySelector("input[name=filter]")).toHaveValue(
			"unread",
		);
	});

	it("reads no folder and no message from the query: the proxy sends such an address on before it gets here", async () => {
		// Reached all the same, it is the inbox with no reader, never the folder named.
		const asked = await home({ box: "Sent", msg: ID });
		expect(asked).toContainEqual({ inMailbox: "Mail" });
		expect(asked).not.toContainEqual({ inMailbox: "Sent" });
		expect(screen.getByText("readerEmpty")).toBeInTheDocument();
	});
	it("paints the list pane in the density the reader chose, and the switch agrees", async () => {
		const pane = () => screen.getByRole("region", { name: "listLabel" });
		const toggle = () =>
			screen.getByRole("button", { name: "densityCompact" });

		await home();
		expect(pane()).toHaveAttribute("data-density", "comfortable");
		// The rows read the density through the pane's group, and are inside it.
		expect(pane()).toHaveClass("group/list");
		expect(
			pane().querySelector('[data-slot="message-row"]'),
		).not.toBeNull();
		expect(toggle()).toHaveAttribute("aria-pressed", "false");
		await settled();
		cleanup();

		cookies.jar.set("mail-density", "compact");
		await home();
		expect(pane()).toHaveAttribute("data-density", "compact");
		expect(toggle()).toHaveAttribute("aria-pressed", "true");
		await settled();
		cleanup();

		cookies.jar.set("mail-density", '"><script>');
		await home();
		expect(pane()).toHaveAttribute("data-density", "comfortable");
	});
});
