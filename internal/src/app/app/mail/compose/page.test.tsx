import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { emailFixture, stubJmap } from "@/features/mail/test-support/jmap-stub";
import {
	mockRequestCookies,
	RedirectSignal,
} from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { resolveServerTree } from "@/test/server-tree";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { default: ComposePage } = await import("./page");

const ID = "00000000-0000-4000-8000-0000000000d1";
const known = {
	"Identity/get": { list: [{ id: "a", name: "Me", email: "me@x.org" }] },
	"Email/get": {
		list: [
			emailFixture({
				id: ID,
				keywords: { $draft: true },
				subject: "Plans",
				from: [{ name: "Ana", email: "ana@x.org" }],
				to: [{ email: "me@x.org" }, { email: "bo@x.org" }],
				textBody: [{ partId: "1", type: "text/plain" }],
				bodyValues: { "1": { value: "see you" } },
			}),
		],
	},
};

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
});
afterEach(() => {
	cleanup();
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
});

async function page(
	params: Record<string, string | string[] | undefined> = {},
) {
	return render(
		await resolveServerTree(
			await ComposePage({ searchParams: Promise.resolve(params) }),
		),
	);
}

describe("ComposePage", () => {
	it("redirects to sign-in without a session", async () => {
		cookies.reset();
		expect(
			await ComposePage({ searchParams: Promise.resolve({}) }).catch(
				(e) => e,
			),
		).toBeInstanceOf(RedirectSignal);
	});

	it("opens an empty composer with a way back", async () => {
		const seen = stubJmap({});
		await page();
		expect(
			screen.getByRole("heading", { level: 1, name: "composeTitle" }),
		).toBeInTheDocument();
		expect(screen.getByLabelText("fieldTo")).toHaveValue("");
		expect(
			screen.getByRole("link", { name: "backToMail" }),
		).toHaveAttribute("href", "/app/mail/inbox");
		expect(seen).toHaveLength(0);
	});

	it("opens a reply filled from the message, with the sender chosen on the server", async () => {
		stubJmap(known);
		await page({ mode: "reply", msg: ID });
		expect(
			screen.getByRole("heading", { level: 1, name: "replyTitle" }),
		).toBeInTheDocument();
		expect(screen.getByLabelText("fieldTo")).toHaveValue("Ana <ana@x.org>");
		expect(screen.getByLabelText("fieldSubject")).toHaveValue("Re: Plans");
		expect(
			(screen.getByLabelText("fieldBody") as HTMLTextAreaElement).value,
		).toContain("> see you");
	});

	it("opens reply all, a forward and a draft", async () => {
		stubJmap(known);
		await page({ mode: "replyAll", msg: ID });
		expect(screen.getByLabelText("fieldCc")).toHaveValue("bo@x.org");
		cleanup();
		await page({ mode: "forward", msg: ID });
		expect(
			screen.getByRole("heading", { level: 1, name: "forwardTitle" }),
		).toBeInTheDocument();
		expect(screen.getByLabelText("fieldSubject")).toHaveValue("Fwd: Plans");
		cleanup();
		await page({ mode: "draft", msg: ID });
		expect(
			screen.getByRole("heading", { level: 1, name: "editDraftTitle" }),
		).toBeInTheDocument();
		expect(screen.getByLabelText("fieldSubject")).toHaveValue("Plans");
	});

	it("opens an empty composer for a mode or an id that is not valid, a missing message, no session or a failing server", async () => {
		const seen = stubJmap(known);
		await page({ mode: "delete", msg: ID });
		expect(
			screen.getByRole("heading", { level: 1, name: "composeTitle" }),
		).toBeInTheDocument();
		cleanup();
		await page({ mode: "reply", msg: "../x" });
		expect(screen.getByLabelText("fieldTo")).toHaveValue("");
		expect(seen).toHaveLength(0);
		cleanup();
		stubJmap({ "Email/get": { list: [], notFound: [ID] } });
		await page({ mode: "reply", msg: ID });
		expect(screen.getByLabelText("fieldTo")).toHaveValue("");
		cleanup();
		stubJmap({});
		await page({ mode: "reply", msg: ID });
		expect(screen.getByLabelText("fieldTo")).toHaveValue("");
		cleanup();
		delete process.env["EPISTLE_API_TOKEN"];
		process.env["EPISTLE_API_TOKEN_FILE"] = "/nonexistent";
		clearSecretCache();
		await page({ mode: "reply", msg: ID });
		expect(screen.getByLabelText("fieldTo")).toHaveValue("");
	});

	it("opens an empty composer, with no draft id, for mode=draft on a message that is not a draft", async () => {
		stubJmap(known);
		await page({ mode: "draft", msg: ID });
		expect(
			screen.getByRole("heading", { level: 1, name: "editDraftTitle" }),
		).toBeInTheDocument();
		expect(screen.getByLabelText("fieldSubject")).toHaveValue("Plans");
		cleanup();
		stubJmap({
			...known,
			"Email/get": {
				list: [
					emailFixture({
						id: ID,
						subject: "Not a draft",
						keywords: { $seen: true },
					}),
				],
			},
		});
		await page({ mode: "draft", msg: ID });
		expect(screen.getByLabelText("fieldSubject")).toHaveValue("");
		expect(screen.getByLabelText("fieldTo")).toHaveValue("");
	});

	it("uses the first value of a repeated parameter", async () => {
		stubJmap(known);
		await page({ mode: ["reply", "forward"], msg: [ID, "x"] });
		expect(screen.getByLabelText("fieldTo")).toHaveValue("Ana <ana@x.org>");
	});
});
