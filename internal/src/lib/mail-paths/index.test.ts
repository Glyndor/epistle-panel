import { describe, expect, it } from "bun:test";
import { messageIdSchema } from "@/features/mail/schemas/mail-input";
import { MAILBOX_ROLES } from "@/features/mail/schemas/mail-view";

import {
	isMailPath,
	isMessageId,
	legacyMailTarget,
	MAIL_PLACE_ROLES,
	MAILBOX_ID_PATTERN,
} from ".";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";

describe("MAIL_PLACE_ROLES", () => {
	it("is the roles a mailbox can have, so every folder with a role has a path", () => {
		expect([...MAIL_PLACE_ROLES]).toEqual([...MAILBOX_ROLES]);
	});
});

describe("MAILBOX_ID_PATTERN", () => {
	it("takes a name and refuses a control, a line break, a bidi control, nothing and too much", () => {
		for (const id of [
			"INBOX",
			"Work/Q4",
			"Facturación 2026",
			"a".repeat(256),
		]) {
			expect(MAILBOX_ID_PATTERN.test(id)).toBe(true);
		}
		for (const id of [
			"",
			"a".repeat(257),
			"a\nb",
			`a${String.fromCodePoint(0)}b`,
			`a${String.fromCodePoint(0x2028)}b`,
			`a${String.fromCodePoint(0x202e)}b`,
			`a${String.fromCodePoint(0x2066)}b`,
		]) {
			expect(MAILBOX_ID_PATTERN.test(id)).toBe(false);
		}
	});
});

describe("isMessageId", () => {
	it("reads an id exactly as the message schema does, for every version and variant", () => {
		const hex = "0123456789abcdefABCDEF";
		const ids: string[] = [
			"00000000-0000-0000-0000-000000000000",
			"ffffffff-ffff-ffff-ffff-ffffffffffff",
			"FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF",
			"00000000-0000-0000-0000-000000000001",
			"11111111-1111-1111-1111-111111111111",
			"",
			"x",
			`${ID}.1`,
			`${ID} `,
			ID.replaceAll("-", ""),
			`{${ID}}`,
		];
		for (const version of hex) {
			for (const variant of hex) {
				ids.push(
					`01890a5d-ac96-${version}74b-${variant}9aa-9be4c3bd6b0e`,
				);
			}
		}
		let taken = 0;
		for (const id of ids) {
			const wanted = messageIdSchema.safeParse(id).success;
			taken += wanted ? 1 : 0;
			expect([id, isMessageId(id)]).toEqual([id, wanted]);
		}
		// Eight versions by six spellings of the four variants, the nil id and the max id in lower case.
		expect(taken).toBe(8 * 6 + 2);
	});
});

describe("legacyMailTarget", () => {
	const target = (query: string, pathname = "/app/mail") =>
		legacyMailTarget(pathname, new URLSearchParams(query));

	it("sends an old address to the page it meant", () => {
		expect(target("box=Sent")).toBe("/app/mail/folder/Sent");
		expect(
			target("box=Work%2FQ4&page=2&filter=unread&q=a+b&msg=" + ID),
		).toBe(`/app/mail/folder/Work_2FQ4/${ID}?page=2&filter=unread&q=a+b`);
		expect(target(`msg=${ID}&filter=flagged`)).toBe(
			`/app/mail/inbox/${ID}?filter=flagged`,
		);
		expect(target("box=Sent", "/app/mail/")).toBe("/app/mail/folder/Sent");
	});

	it("is nothing for an address that names no folder and no message, or another page", () => {
		expect(target("")).toBeNull();
		expect(target("page=2&filter=unread&q=x")).toBeNull();
		expect(target("box=a%0Ab&msg=../x")).toBeNull();
		expect(target("box=&msg=")).toBeNull();
		expect(target("box=Sent", "/app/mail/inbox")).toBeNull();
		expect(target("box=Sent", "/app/mail/compose")).toBeNull();
		expect(target("box=Sent", "/")).toBeNull();
	});

	it("leaves out each value that fails its check and keeps the rest", () => {
		expect(target("box=Sent&msg=not-an-id")).toBe("/app/mail/folder/Sent");
		expect(target(`box=a%0Ab&msg=${ID}`)).toBe(`/app/mail/inbox/${ID}`);
		expect(target("box=Sent&page=-1&filter=Unread&q=a%00b")).toBe(
			"/app/mail/folder/Sent",
		);
		expect(target("box=Sent&page=12345")).toBe("/app/mail/folder/Sent");
		expect(target(`box=Sent&q=${"x".repeat(201)}`)).toBe(
			"/app/mail/folder/Sent",
		);
		// A repeated parameter is read once, the first.
		expect(target("box=Sent&box=Trash")).toBe("/app/mail/folder/Sent");
	});

	it("never leaves the mail area, whatever the old query asks for", () => {
		const panel = "https://panel.example";
		const hostile = [
			"//evil.example",
			"/\\evil.example",
			"https://evil.example/",
			"../../..",
			"..",
			".",
			"../../app/00000000-0000-4000-8000-000000000000",
			"?next=https://evil.example",
			"#fragment",
			"compose",
			"inbox/../..",
			"%2e%2e%2f",
			"a b\\c",
			"@evil.example",
			"x\tHost: evil.example",
		];
		for (const box of hostile) {
			for (const query of [
				new URLSearchParams({ box }),
				new URLSearchParams({ box, msg: ID }),
				new URLSearchParams({
					box,
					msg: box,
					q: box,
					filter: box,
					page: box,
				}),
			]) {
				const found = legacyMailTarget("/app/mail", query);
				if (found === null) {
					// A tab is a control: such a name is no folder, and nothing is redirected.
					expect(box).toContain("\t");
					continue;
				}
				const url = new URL(found, panel);
				expect([box, url.origin]).toEqual([box, panel]);
				expect([box, isMailPath(url.pathname)]).toEqual([box, true]);
				if (box.includes("\t")) {
					// No folder to name: only the message is left, in the inbox.
					expect(url.pathname).toBe(`/app/mail/inbox/${ID}`);
					continue;
				}
				expect([
					box,
					url.pathname.startsWith("/app/mail/folder/"),
				]).toEqual([box, true]);
				// One segment for the folder, one more for a message, and nothing else.
				const rest = url.pathname
					.slice("/app/mail/folder/".length)
					.split("/");
				expect([box, rest.length <= 2]).toEqual([box, true]);
				expect([box, /^[A-Za-z0-9._-]+$/.test(rest[0] ?? "")]).toEqual([
					box,
					true,
				]);
				expect(url.hash).toBe("");
				expect([box, isMailPath(url.pathname)]).toEqual([box, true]);
			}
		}
	});
});

describe("isMailPath", () => {
	it("takes the home, each role, a folder by its name, and a message under either", () => {
		for (const path of [
			"/app/mail",
			"/app/mail/inbox",
			"/app/mail/drafts",
			"/app/mail/sent",
			"/app/mail/archive",
			"/app/mail/junk",
			"/app/mail/trash",
			`/app/mail/inbox/${ID}`,
			`/app/mail/trash/${ID.toUpperCase()}`,
			"/app/mail/folder/Work",
			"/app/mail/folder/Work_2FQ4",
			`/app/mail/folder/Work_2FQ4/${ID}`,
			"/app/mail/folder/inbox",
			"/app/mail/folder/compose",
			"/app/mail/folder/_2E.",
			// One slash at the end is the same route.
			"/app/mail/",
			"/app/mail/inbox/",
			`/app/mail/folder/Work/${ID}/`,
		]) {
			expect([path, isMailPath(path)]).toEqual([path, true]);
		}
	});

	it("takes the routes that are no folder, spelled exactly", () => {
		for (const path of [
			"/app/mail/compose",
			"/app/mail/compose-message",
			"/app/mail/upload",
			`/app/mail/body/${ID}`,
			"/app/mail/body/anything-the-route-will-check",
			`/app/mail/attachment/${ID}/2`,
		]) {
			expect([path, isMailPath(path)]).toEqual([path, true]);
		}
	});

	it("is no route for anything else under the mail area", () => {
		for (const path of [
			"/app/mail//",
			"/app/mail/inbox//",
			"/app/mail//inbox",
			"/app/mail/Inbox",
			"/app/mail/INBOX",
			"/app/mail/spam",
			"/app/mail/label",
			"/app/mail/label/Work",
			"/app/mail/starred",
			"/app/mail/important",
			"/app/mail/search",
			"/app/mail/inbox/not-an-id",
			// Shaped like an id, and not one the page would read: version 0, variant c.
			"/app/mail/inbox/01890a5d-ac96-074b-b9aa-9be4c3bd6b0e",
			"/app/mail/inbox/01890a5d-ac96-774b-c9aa-9be4c3bd6b0e",
			"/app/mail/inbox/11111111-1111-9111-8111-111111111111",
			"/app/mail/folder/Work/00000000-0000-0000-0000-000000000001",
			`/app/mail/inbox/${ID}/more`,
			`/app/mail/inbox/${ID}.1`,
			"/app/mail/folder",
			"/app/mail/folder/",
			"/app/mail/folder/Work%2FQ4",
			"/app/mail/folder/Work/Q4",
			"/app/mail/folder/Work_2fQ4",
			"/app/mail/folder/_57ork",
			"/app/mail/folder/..",
			"/app/mail/folder/.",
			"/app/mail/folder/a_00b",
			"/app/mail/folder/a_0Ab",
			"/app/mail/folder/a_E2_80_AEb",
			`/app/mail/folder/${"a".repeat(257)}`,
			`/app/mail/folder/Work/${ID}/more`,
			"/app/mail/folder/Work/not-an-id",
			"/app/mail/compose/x",
			"/app/mail/Compose",
			"/app/mail/upload/x",
			"/app/mail/body",
			"/app/mail/body/",
			`/app/mail/body/${ID}/x`,
			"/app/mail/attachment",
			`/app/mail/attachment/${ID}`,
			`/app/mail/attachment/${ID}/`,
			`/app/mail/attachment/${ID}/2/x`,
			"/app/mail/constructor",
			"/app/mail/__proto__",
			"/app/mailbox",
			"/app/mail2",
			"/APP/MAIL/inbox",
			"/app/mail/inbox;x=1",
			"/app/mail%2Finbox",
			"/app/mail\\inbox",
			"",
			"/",
		]) {
			expect([path, isMailPath(path)]).toEqual([path, false]);
		}
	});
});
