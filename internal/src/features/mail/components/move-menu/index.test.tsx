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
import { withQuery } from "@/test/query-wrapper";
import { stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { MoveMenu } = await import(".");

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

const folders = {
	"Mailbox/get": {
		list: [
			{
				id: "INBOX",
				name: "INBOX",
				role: "inbox",
				totalEmails: 1,
				unreadEmails: 0,
			},
			{
				id: "Work",
				name: "Work",
				role: null,
				totalEmails: 0,
				unreadEmails: 0,
			},
		],
	},
};

describe("MoveMenu", () => {
	it("opens a menu of the folders with the current one checked", async () => {
		stubJmap(folders);
		const moved: string[] = [];
		render(
			withQuery(
				<MoveMenu
					defaultOpen
					current="INBOX"
					disabled={false}
					onMove={(box) => moved.push(box)}
				/>,
			),
		);
		await new Promise((r) => setTimeout(r, 50));
		await screen.findByRole("menuitemradio", { name: "Work" });
		const items = screen.getAllByRole("menuitemradio");
		expect(items.map((i) => i.textContent)).toEqual(["role_inbox", "Work"]);
		expect(items[0]).toHaveAttribute("aria-checked", "true");
		fireEvent.click(items[1] as HTMLElement);
		await waitFor(() => expect(moved).toEqual(["Work"]));
	});

	it("does nothing when the current folder is chosen again", async () => {
		stubJmap(folders);
		const moved: string[] = [];
		render(
			withQuery(
				<MoveMenu
					defaultOpen
					current="INBOX"
					disabled={false}
					onMove={(box) => moved.push(box)}
				/>,
			),
		);
		fireEvent.click(
			await screen.findByRole("menuitemradio", { name: "role_inbox" }),
		);
		await new Promise((r) => setTimeout(r, 30));
		expect(moved).toEqual([]);
	});

	it("stays disabled when told to", async () => {
		stubJmap(folders);
		render(
			withQuery(<MoveMenu current={null} disabled onMove={() => {}} />),
		);
		await new Promise((r) => setTimeout(r, 30));
		expect(screen.getByRole("button", { name: "moveMenu" })).toBeDisabled();
	});
});
