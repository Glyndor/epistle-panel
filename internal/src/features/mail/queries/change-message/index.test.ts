import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { clearSecretCache } from "@/lib/config/secret";
import { emailFixture, SESSION, stubJmap } from "../../test-support/jmap-stub";
import { changeMessage, NoFolderError } from ".";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const ID = "00000000-0000-4000-8000-0000000000e1";
const BOXES = {
	list: [
		{ id: "INBOX", role: "inbox" },
		{ id: "Archive", role: "archive" },
		{ id: "Trash", role: "trash" },
		{ id: "Junk", role: "junk" },
	],
};

beforeEach(() => {
	clearSecretCache();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
});
afterEach(() => {
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
});

/** A server holding one message in `box` with `keywords`; `set` answers the Email/set. */
function serve(
	box: string,
	keywords: Record<string, boolean>,
	set: Record<string, unknown> | ((a: Record<string, unknown>) => unknown),
) {
	return stubJmap({
		"Email/get": {
			list: [
				emailFixture({ id: ID, keywords, mailboxIds: { [box]: true } }),
			],
		},
		"Mailbox/get": BOXES,
		"Email/set": set,
	});
}
/** The `Email/set` arguments the server saw, in the shape the tests read. */
type Sets = {
	update?: Record<
		string,
		{
			keywords: Record<string, boolean>;
			mailboxIds?: Record<string, boolean>;
		}
	>;
	destroy?: string[];
};
const sets = (seen: ReturnType<typeof stubJmap>) =>
	seen.flatMap((r) => r.calls).find((c) => c[0] === "Email/set")?.[1] as Sets;

describe("changeMessage: flags", () => {
	it("marks read by writing the whole keyword set, leaving the folder alone", async () => {
		const seen = serve(
			"INBOX",
			{ $flagged: true },
			{ updated: { [ID]: null } },
		);
		const outcome = await changeMessage(SESSION, { id: ID, op: "read" });
		expect(outcome).toEqual({
			left: false,
			movedTo: null,
			destroyed: false,
		});
		expect(sets(seen).update?.[ID]).toEqual({
			keywords: { $flagged: true, $seen: true },
		});
		expect(seen).toHaveLength(2);
		expect(seen[0]?.calls.map((c) => c[0])).toEqual(["Email/get"]);
	});

	it("marks unread, stars and unstars by adding or leaving out the keyword", async () => {
		const cases = [
			["unread", { $seen: true, $flagged: true }, { $flagged: true }],
			["star", { $seen: true }, { $seen: true, $flagged: true }],
			["unstar", { $seen: true, $flagged: true }, { $seen: true }],
		] as const;
		for (const [op, before, after] of cases) {
			const seen = serve("INBOX", before, { updated: { [ID]: null } });
			await changeMessage(SESSION, { id: ID, op });
			expect(sets(seen).update?.[ID]?.keywords).toEqual(after);
			expect(sets(seen).update?.[ID]?.mailboxIds).toBeUndefined();
		}
	});

	it("marks important and takes the mark off, whatever case the keyword was set in", async () => {
		const cases = [
			// Added once, in the spelling JMAP uses.
			["important", { $seen: true }, { $seen: true, $important: true }],
			// Already there as an IMAP client wrote it: nothing is added beside it.
			[
				"important",
				{ $seen: true, $Important: true },
				{ $seen: true, $Important: true },
			],
			["unimportant", { $seen: true, $important: true }, { $seen: true }],
			// Both spellings go, so the mark cannot survive in the other one.
			[
				"unimportant",
				{ $Important: true, $IMPORTANT: true, Work: true },
				{ Work: true },
			],
			// A label that only looks like it stays.
			[
				"unimportant",
				{ $important: true, important: true, $importants: true },
				{ important: true, $importants: true },
			],
		] as const;
		for (const [op, before, after] of cases) {
			const seen = serve("INBOX", before, { updated: { [ID]: null } });
			const outcome = await changeMessage(SESSION, { id: ID, op });
			expect(outcome.left).toBe(false);
			expect(sets(seen).update?.[ID]?.keywords).toEqual(after);
			expect(sets(seen).update?.[ID]?.mailboxIds).toBeUndefined();
		}
	});

	it("keeps every label and keyword it was not asked about", async () => {
		const seen = serve(
			"INBOX",
			{ $seen: true, Work: true, To_20do: true, $Forwarded: true },
			{ updated: { [ID]: null } },
		);
		await changeMessage(SESSION, { id: ID, op: "star" });
		expect(sets(seen).update?.[ID]?.keywords).toEqual({
			$seen: true,
			Work: true,
			To_20do: true,
			$Forwarded: true,
			$flagged: true,
		});
	});

	it("drops a keyword the server reports as false", async () => {
		const seen = serve(
			"INBOX",
			{ $seen: true, $junk: false },
			{ updated: { [ID]: null } },
		);
		await changeMessage(SESSION, { id: ID, op: "star" });
		expect(sets(seen).update?.[ID]?.keywords).toEqual({
			$seen: true,
			$flagged: true,
		});
	});
});

describe("changeMessage: moves", () => {
	it("archives, spams and returns to the inbox by the folder's role, naming one target", async () => {
		for (const [op, from, to] of [
			["archive", "INBOX", "Archive"],
			["spam", "INBOX", "Junk"],
			["inbox", "Archive", "INBOX"],
			["trash", "INBOX", "Trash"],
		] as const) {
			const seen = serve(from, {}, { updated: { [ID]: null } });
			const outcome = await changeMessage(SESSION, { id: ID, op });
			expect(outcome).toEqual({
				left: true,
				movedTo: to,
				destroyed: false,
			});
			expect(sets(seen).update?.[ID]?.mailboxIds).toEqual({
				[to]: true,
			});
			expect(seen[0]?.calls.map((c) => c[0])).toEqual([
				"Email/get",
				"Mailbox/get",
			]);
		}
	});

	it("moves to a named folder without asking for the mailboxes", async () => {
		const seen = serve("INBOX", {}, { updated: { [ID]: null } });
		const outcome = await changeMessage(SESSION, {
			id: ID,
			op: "move",
			box: "Work/Q4",
		});
		expect(outcome.movedTo).toBe("Work/Q4");
		expect(seen[0]?.calls.map((c) => c[0])).toEqual(["Email/get"]);
	});

	it("does not move a message that is already where it is asked to go", async () => {
		const seen = serve("Junk", {}, { updated: { [ID]: null } });
		expect(await changeMessage(SESSION, { id: ID, op: "spam" })).toEqual({
			left: false,
			movedTo: null,
			destroyed: false,
		});
		expect(sets(seen).update?.[ID]?.mailboxIds).toBeUndefined();
	});

	it("destroys a message that is deleted from the trash", async () => {
		const seen = serve("Trash", {}, { destroyed: [ID] });
		expect(await changeMessage(SESSION, { id: ID, op: "trash" })).toEqual({
			left: true,
			movedTo: null,
			destroyed: true,
		});
		expect(sets(seen).destroy).toEqual([ID]);
		expect(sets(seen).update).toBeUndefined();
	});

	it("says which folder is missing instead of failing blindly", async () => {
		stubJmap({
			"Email/get": { list: [emailFixture({ id: ID })] },
			"Mailbox/get": { list: [{ id: "INBOX", role: "inbox" }] },
		});
		const error = await changeMessage(SESSION, {
			id: ID,
			op: "archive",
		}).catch((e) => e);
		expect(error).toBeInstanceOf(NoFolderError);
		expect(error.role).toBe("archive");
	});
});

describe("changeMessage: refusals", () => {
	it("fails for a message the server does not have", async () => {
		stubJmap({ "Email/get": { list: [], notFound: [ID] } });
		expect(
			(
				await changeMessage(SESSION, { id: ID, op: "read" }).catch(
					(e) => e,
				)
			).message,
		).toBe("message not found");
	});

	it("fails when the server does not accept the update or the destroy", async () => {
		serve(
			"INBOX",
			{},
			{ updated: null, notUpdated: { [ID]: { type: "serverFail" } } },
		);
		expect(
			(
				await changeMessage(SESSION, { id: ID, op: "read" }).catch(
					(e) => e,
				)
			).message,
		).toBe("the server refused the change");
		serve("INBOX", {}, { updated: {} });
		expect(
			await changeMessage(SESSION, { id: ID, op: "read" }).catch(
				(e) => e,
			),
		).toBeInstanceOf(Error);
		serve(
			"Trash",
			{},
			{ destroyed: [], notDestroyed: { [ID]: { type: "notFound" } } },
		);
		expect(
			await changeMessage(SESSION, { id: ID, op: "trash" }).catch(
				(e) => e,
			),
		).toBeInstanceOf(Error);
	});
});
