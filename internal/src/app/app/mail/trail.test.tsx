import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";

import { emailFixture, stubJmap } from "@/features/mail/test-support/jmap-stub";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { firstPaint, resolveServerTree } from "@/test/server-tree";

/**
 * The trail of the header is a page of its own beside each page of the mail
 * area (the `trail` slot of the layout), read from the same address by the
 * same rules. These are those pages: what each names, and that a message's
 * subject streams in behind a bar without holding the folder back.
 */
const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const home = (await import("./@trail/page")).default;
const role = (await import("./@trail/[role]/page")).default;
const roleMessage = (await import("./@trail/[role]/[id]/page")).default;
const folder = (await import("./@trail/folder/[name]/page")).default;
const folderMessage = (await import("./@trail/folder/[name]/[id]/page"))
	.default;
const compose = (await import("./@trail/compose/page")).default;
const fallback = (await import("./@trail/default")).default;

const ID = "00000000-0000-4000-8000-0000000000c1";
const message = {
	"Email/get": {
		list: [
			emailFixture({
				id: ID,
				subject: "Quarterly numbers",
				keywords: { $seen: true },
			}),
		],
	},
};
const none = Promise.resolve({});
const at = <T,>(segments: T) => Promise.resolve(segments);

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

const show = async (tree: React.ReactNode | Promise<React.ReactNode>) =>
	render(await resolveServerTree(await tree));
const trail = () => screen.getByRole("navigation", { name: "breadcrumb" });
const steps = () =>
	within(trail())
		.getAllByRole("listitem")
		.map((item) => item.textContent);
const links = () =>
	within(trail())
		.queryAllByRole("link")
		.map((link) => link.getAttribute("href"));
const current = () =>
	[...trail().querySelectorAll('[aria-current="page"]')].map(
		(step) => step.textContent,
	);

describe("the trail of a folder's page", () => {
	it("names the inbox on the mail area's home, and asks the mail server nothing", async () => {
		const seen = stubJmap({});
		await show(home({ searchParams: none }));

		expect(steps()).toEqual(["heading", "role_inbox"]);
		expect(current()).toEqual(["role_inbox"]);
		expect(links()).toEqual(["/app/mail"]);
		expect(seen).toHaveLength(0);
	});

	it("names a folder the account has by role", async () => {
		const seen = stubJmap({});
		await show(role({ params: at({ role: "sent" }), searchParams: none }));

		expect(steps()).toEqual(["heading", "role_sent"]);
		expect(current()).toEqual(["role_sent"]);
		expect(seen).toHaveLength(0);
	});

	it("names any other folder by the last part of its own name", async () => {
		const seen = stubJmap({});
		await show(
			folder({ params: at({ name: "Work_2FQ4" }), searchParams: none }),
		);

		expect(steps()).toEqual(["heading", "Q4"]);
		expect(current()).toEqual(["Q4"]);
		expect(seen).toHaveLength(0);
	});

	it("names nothing but the mail for a segment that is no role and no folder", async () => {
		for (const tree of [
			role({ params: at({ role: "Inbox" }), searchParams: none }),
			role({ params: at({ role: "starred" }), searchParams: none }),
			folder({ params: at({ name: "a%2Fb" }), searchParams: none }),
			folder({ params: at({ name: "_zz" }), searchParams: none }),
			roleMessage({
				params: at({ role: "inbox", id: "not-an-id" }),
				searchParams: none,
			}),
			roleMessage({
				params: at({ role: "nope", id: ID }),
				searchParams: none,
			}),
			folderMessage({
				params: at({ name: "Work_2FQ4", id: "../x" }),
				searchParams: none,
			}),
			folderMessage({
				params: at({ name: "%00", id: ID }),
				searchParams: none,
			}),
		]) {
			const seen = stubJmap(message);
			await show(tree);
			expect(steps()).toEqual(["heading"]);
			expect(seen).toHaveLength(0);
			cleanup();
		}
	});

	it("redirects to sign-in without a session, like the page beside it", async () => {
		cookies.reset();

		expect(
			await Promise.resolve(home({ searchParams: none }))
				.then((tree) => resolveServerTree(tree))
				.catch((e) => e),
		).toBeInstanceOf(RedirectSignal);
	});
});

describe("the trail of an open message", () => {
	it("sends the folder at once, as a link, and a bar for the subject, before the mail server is asked", async () => {
		const seen = stubJmap(message);
		// The page is one server component: run it alone, so the boundary it
		// returns can give way to its fallback without being run.
		const page = (await roleMessage({
			params: at({ role: "inbox", id: ID }),
			searchParams: none,
		})) as React.ReactElement<Record<string, unknown>>;
		const boundary = await (
			page.type as (props: unknown) => Promise<React.ReactNode>
		)(page.props);
		render(await resolveServerTree(firstPaint(boundary)));

		expect(steps()).toEqual(["heading", "role_inbox", ""]);
		expect(links()).toEqual(["/app/mail", "/app/mail/inbox"]);
		expect(current()).toEqual([]);
		expect(trail().querySelector('[data-slot="skeleton"]')).not.toBeNull();
		expect(seen).toHaveLength(0);
	});

	it("then names the subject as the current page, in a folder by role and in a folder by name", async () => {
		stubJmap(message);
		await show(
			roleMessage({
				params: at({ role: "inbox", id: ID }),
				searchParams: none,
			}),
		);
		expect(steps()).toEqual(["heading", "role_inbox", "Quarterly numbers"]);
		expect(current()).toEqual(["Quarterly numbers"]);
		cleanup();

		await show(
			folderMessage({
				params: at({ name: "Work_2FQ4", id: ID }),
				searchParams: none,
			}),
		);
		expect(steps()).toEqual(["heading", "Q4", "Quarterly numbers"]);
		expect(links()).toEqual(["/app/mail", "/app/mail/folder/Work_2FQ4"]);
	});

	it("keeps what narrows the list in the way back to the folder, a bad parameter dropped on its own", async () => {
		stubJmap(message);
		await show(
			roleMessage({
				params: at({ role: "inbox", id: ID }),
				searchParams: Promise.resolve({
					page: "2",
					filter: "bogus",
					q: "invoice",
				}),
			}),
		);

		expect(links()).toEqual([
			"/app/mail",
			"/app/mail/inbox?page=2&q=invoice",
		]);
	});

	it("names nothing for a message the server does not have, or cannot be asked for", async () => {
		const logged = spyOn(console, "error").mockImplementation(() => {});
		try {
			for (const answers of [{ "Email/get": { list: [] } }, {}]) {
				stubJmap(answers);
				await show(
					roleMessage({
						params: at({ role: "inbox", id: ID }),
						searchParams: none,
					}),
				);
				expect(steps()).toEqual(["heading", "role_inbox"]);
				expect(current()).toEqual([]);
				expect(links()).toEqual(["/app/mail", "/app/mail/inbox"]);
				cleanup();
			}
		} finally {
			logged.mockRestore();
		}
	});

	it("says a message has no subject in the panel's own words", async () => {
		stubJmap({
			"Email/get": { list: [emailFixture({ id: ID, subject: "" })] },
		});
		await show(
			roleMessage({
				params: at({ role: "inbox", id: ID }),
				searchParams: none,
			}),
		);

		expect(current()).toEqual(["noSubject"]);
	});
});

describe("the trail of the composer and of what has none", () => {
	it("names what the composer was opened for, by the rule the page reads its address with", async () => {
		for (const [params, title] of [
			[{}, "composeTitle"],
			[{ mode: "reply", msg: ID }, "replyTitle"],
			[{ mode: "replyAll", msg: ID }, "replyTitle"],
			[{ mode: "forward", msg: ID }, "forwardTitle"],
			[{ mode: "draft", msg: ID }, "editDraftTitle"],
			[{ mode: "reply", msg: "nope" }, "composeTitle"],
		] as const) {
			await show(compose({ searchParams: Promise.resolve(params) }));
			expect(steps()).toEqual(["heading", title]);
			expect(current()).toEqual([title]);
			expect(links()).toEqual(["/app/mail"]);
			cleanup();
		}
	});

	it("is the mail area alone for an address with no trail of its own", async () => {
		await show(fallback());

		expect(steps()).toEqual(["heading"]);
	});
});
