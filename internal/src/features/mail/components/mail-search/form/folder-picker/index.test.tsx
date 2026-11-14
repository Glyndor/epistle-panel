import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { settled, withQuery } from "@/test/query-wrapper";
import { stubJmap } from "../../../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { FolderPicker } = await import(".");

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

const BOXES = {
	"Mailbox/get": {
		list: [
			{
				id: "INBOX",
				name: "INBOX",
				role: "inbox",
				totalEmails: 2,
				unreadEmails: 1,
			},
			{
				id: "Work_1",
				name: "Work",
				role: null,
				totalEmails: 5,
				unreadEmails: 0,
			},
		],
	},
};

const options = () =>
	screen.getAllByRole("option").map((option) => option.getAttribute("value"));

describe("FolderPicker", () => {
	it("lists the folders the server reads, after the choice of the page's own", async () => {
		stubJmap(BOXES);
		render(withQuery(<FolderPicker value="" />));

		expect(
			await screen.findByRole("option", { name: "Work" }),
		).toBeInTheDocument();
		expect(options()).toEqual(["", "INBOX", "Work_1"]);
	});

	it("keeps the folder the address names, even before the folders are read", async () => {
		stubJmap(BOXES);
		render(withQuery(<FolderPicker value="Gone_9" />));

		expect(options()).toEqual(["", "Gone_9"]);
		expect(screen.getByRole("combobox")).toHaveValue("Gone_9");
		await settled();
	});

	it("does not list a named folder twice once the folders are read", async () => {
		stubJmap(BOXES);
		render(withQuery(<FolderPicker value="Work_1" />));

		await screen.findByRole("option", { name: "Work" });
		expect(options().filter((value) => value === "Work_1")).toHaveLength(1);
	});

	it("sends its choice in a plain GET form under the name `folder`", async () => {
		stubJmap(BOXES);
		render(withQuery(<FolderPicker value="" />));

		expect(screen.getByRole("combobox")).toHaveAttribute("name", "folder");
		await settled();
	});
});
