import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { getBrand } from "@/features/branding/queries/brand";
import { emailFixture, stubJmap } from "@/features/mail/test-support/jmap-stub";
import {
	mockRequestCookies,
	NotFoundSignal,
} from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { settled, withQuery } from "@/test/query-wrapper";
import { resolveServerTree } from "@/test/server-tree";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const role = await import("./[role]/page");
const roleMessage = await import("./[role]/[id]/page");
const folder = await import("./folder/[name]/page");
const folderMessage = await import("./folder/[name]/[id]/page");

const ID = "00000000-0000-4000-8000-0000000000c1";
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
			{
				id: "Work/Q4",
				name: "Q4",
				role: null,
				totalEmails: 1,
				unreadEmails: 0,
			},
		],
	},
	"Email/query": { ids: [ID] },
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
const none = Promise.resolve({});
const asked = (seen: ReturnType<typeof stubJmap>) =>
	seen
		.flatMap((request) => request.calls)
		.filter((call) => call[0] === "Email/query")
		.map((call) => call[1]["filter"]);
const show = async (tree: Promise<React.ReactNode>) =>
	render(withQuery(await resolveServerTree(await tree)));
const refused = (tree: Promise<unknown>) => tree.catch((error) => error);

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

describe("/app/mail/<role>", () => {
	it("opens the account's folder of that role", async () => {
		const seen = stubJmap(answers);
		await show(
			role.default({
				params: Promise.resolve({ role: "inbox" }),
				searchParams: none,
			}),
		);
		expect(asked(seen)).toContainEqual({ inMailbox: "Mail" });
		expect(screen.getByText("Listed")).toBeInTheDocument();
		expect(screen.getByText("readerEmpty")).toBeInTheDocument();
	});

	it("is no page for a segment that is not a role, and asks the mail server nothing", async () => {
		const seen = stubJmap(answers);
		for (const segment of [
			"Inbox",
			"INBOX",
			"inbox ",
			"mail",
			"label",
			"starred",
			"important",
			"search",
			"constructor",
			"__proto__",
			"",
		]) {
			expect([
				segment,
				await refused(
					role.default({
						params: Promise.resolve({ role: segment }),
						searchParams: none,
					}),
				),
			]).toEqual([segment, expect.any(NotFoundSignal)]);
		}
		expect(seen).toHaveLength(0);
	});

	it("opens a message of the folder in the reader", async () => {
		stubJmap(answers);
		await show(
			roleMessage.default({
				params: Promise.resolve({ role: "inbox", id: ID }),
				searchParams: none,
			}),
		);
		expect(
			await screen.findByRole("heading", { level: 2, name: "Listed" }),
		).toBeInTheDocument();
	});

	it("is no page when the role or the message's id is not one", async () => {
		const seen = stubJmap(answers);
		for (const params of [
			{ role: "inbox", id: "x" },
			{ role: "inbox", id: `${ID}.1` },
			{ role: "inbox", id: "../compose" },
			{ role: "nope", id: ID },
		]) {
			expect(
				await refused(
					roleMessage.default({
						params: Promise.resolve(params),
						searchParams: none,
					}),
				),
			).toBeInstanceOf(NotFoundSignal);
		}
		expect(seen).toHaveLength(0);
	});
});

describe("/app/mail/folder/<name>", () => {
	it("opens the folder its segment names, slash and all, without waiting for the folders", async () => {
		// No folder list at all: the named folder is still read.
		const seen = stubJmap({
			"Email/query": answers["Email/query"],
			"Email/get": answers["Email/get"],
		});
		await show(
			folder.default({
				params: Promise.resolve({ name: "Work_2FQ4" }),
				searchParams: none,
			}),
		);
		expect(asked(seen)).toContainEqual({ inMailbox: "Work/Q4" });
		expect(screen.getByRole("link", { name: /Listed/ })).toHaveAttribute(
			"href",
			`/app/mail/folder/Work_2FQ4/${ID}`,
		);
	});

	it("is no page for a segment the panel does not write or a name no folder can have", async () => {
		const seen = stubJmap(answers);
		for (const name of [
			"Work%2FQ4",
			"Work/Q4",
			"Work_2fQ4",
			"_57ork",
			"..",
			".",
			"a_",
			// A control, a line break and a text-direction override, each written the panel's way.
			"a_00b",
			"a_0Ab",
			"a_E2_80_AEb",
			"a".repeat(257),
			"",
		]) {
			expect([
				name,
				await refused(
					folder.default({
						params: Promise.resolve({ name }),
						searchParams: none,
					}),
				),
			]).toEqual([name, expect.any(NotFoundSignal)]);
		}
		expect(seen).toHaveLength(0);
	});

	it("opens a message of the folder, and is no page for an id that is not one", async () => {
		stubJmap(answers);
		await show(
			folderMessage.default({
				params: Promise.resolve({ name: "Work_2FQ4", id: ID }),
				searchParams: none,
			}),
		);
		expect(
			await screen.findByRole("heading", { level: 2, name: "Listed" }),
		).toBeInTheDocument();
		for (const params of [
			{ name: "Work_2FQ4", id: "x" },
			{ name: "Work%2FQ4", id: ID },
		]) {
			expect(
				await refused(
					folderMessage.default({
						params: Promise.resolve(params),
						searchParams: none,
					}),
				),
			).toBeInstanceOf(NotFoundSignal);
		}
	});
});

describe("the title of a place", () => {
	const brand = getBrand().name;

	it("names a folder with a role in the reader's language", async () => {
		expect(
			await role.generateMetadata({
				params: Promise.resolve({ role: "junk" }),
				searchParams: none,
			}),
		).toEqual({ title: `role_junk · ${brand}` });
		expect(
			await roleMessage.generateMetadata({
				params: Promise.resolve({ role: "sent", id: ID }),
				searchParams: none,
			}),
		).toEqual({ title: `role_sent · ${brand}` });
	});

	it("names any other folder by the last part of its name", async () => {
		expect(
			await folder.generateMetadata({
				params: Promise.resolve({ name: "Work_2FQ4" }),
				searchParams: none,
			}),
		).toEqual({ title: `Q4 · ${brand}` });
		expect(
			await folderMessage.generateMetadata({
				params: Promise.resolve({ name: "Work", id: ID }),
				searchParams: none,
			}),
		).toEqual({ title: `Work · ${brand}` });
		// A name that ends in a slash has no last part: the whole name stands.
		expect(
			await folder.generateMetadata({
				params: Promise.resolve({ name: "Work_2F" }),
				searchParams: none,
			}),
		).toEqual({ title: `Work/ · ${brand}` });
	});

	it("adds nothing for a path that is no place", async () => {
		expect(
			await role.generateMetadata({
				params: Promise.resolve({ role: "nope" }),
				searchParams: none,
			}),
		).toEqual({});
		expect(
			await folder.generateMetadata({
				params: Promise.resolve({ name: ".." }),
				searchParams: none,
			}),
		).toEqual({});
	});
});
