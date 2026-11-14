import { describe, expect, it } from "bun:test";

import { attachmentHref, bodyHref, composeHref, mailHref } from ".";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";

describe("mailHref", () => {
	it("is the inbox for the default view", () => {
		expect<string>(mailHref({})).toBe("/app/mail/inbox");
		expect<string>(mailHref({ page: 1, filter: "all", q: "" })).toBe(
			"/app/mail/inbox",
		);
	});

	it("names a folder with a role by the role, whatever its id is", () => {
		expect<string>(mailHref({ box: "INBOX", role: "inbox" })).toBe(
			"/app/mail/inbox",
		);
		expect<string>(mailHref({ box: "Papelera", role: "trash" })).toBe(
			"/app/mail/trash",
		);
		expect<string>(mailHref({ role: "junk" })).toBe("/app/mail/junk");
	});

	it("names any other folder by its id as one segment", () => {
		expect<string>(mailHref({ box: "Work" })).toBe("/app/mail/folder/Work");
		expect<string>(mailHref({ box: "Work/Q4", role: null })).toBe(
			"/app/mail/folder/Work_2FQ4",
		);
		// A folder that is called like a fixed path stays under `folder/`.
		expect<string>(mailHref({ box: "compose" })).toBe(
			"/app/mail/folder/compose",
		);
		expect<string>(mailHref({ box: "inbox" })).toBe(
			"/app/mail/folder/inbox",
		);
		expect<string>(mailHref({ box: "../../x" })).toBe(
			"/app/mail/folder/_2E._2F.._2Fx",
		);
	});

	it("puts the open message after the folder and what narrows the list in the query", () => {
		expect<string>(
			mailHref({
				box: "Work/Q4 & more",
				page: 3,
				filter: "unread",
				q: "a b&c=d",
				msg: ID,
			}),
		).toBe(
			`/app/mail/folder/Work_2FQ4_20_26_20more/${ID}?page=3&filter=unread&q=a+b%26c%3Dd`,
		);
		expect<string>(mailHref({ role: "sent", msg: ID })).toBe(
			`/app/mail/sent/${ID}`,
		);
		// An id is a UUID; one that is not cannot add a segment.
		expect<string>(mailHref({ role: "sent", msg: "a/b?c" })).toBe(
			"/app/mail/sent/a%2Fb%3Fc",
		);
	});
});

describe("attachmentHref and bodyHref", () => {
	it("encode the id and the part so neither can change the path", () => {
		expect<string>(attachmentHref(ID, "2")).toBe(
			`/app/mail/attachment/${ID}/2`,
		);
		expect<string>(attachmentHref("../x", "1/2")).toBe(
			"/app/mail/attachment/..%2Fx/1%2F2",
		);
		expect<string>(bodyHref(ID, false)).toBe(`/app/mail/body/${ID}`);
		expect<string>(bodyHref(ID, true)).toBe(
			`/app/mail/body/${ID}?images=1`,
		);
		expect<string>(bodyHref("a/b", false)).toBe("/app/mail/body/a%2Fb");
		expect<string>(bodyHref(ID, false, "dark")).toBe(
			`/app/mail/body/${ID}?theme=dark`,
		);
		expect<string>(bodyHref(ID, true, "light")).toBe(
			`/app/mail/body/${ID}?images=1&theme=light`,
		);
		expect<string>(bodyHref(ID, false, undefined)).toBe(
			`/app/mail/body/${ID}`,
		);
	});
});

describe("composeHref", () => {
	it("is the bare composer, or one opened from a message with the mode and the id encoded", () => {
		expect<string>(composeHref()).toBe("/app/mail/compose");
		expect<string>(composeHref("reply")).toBe("/app/mail/compose");
		expect<string>(composeHref("replyAll", ID)).toBe(
			`/app/mail/compose?mode=replyAll&msg=${ID}`,
		);
		expect<string>(composeHref("draft", "a/b")).toBe(
			"/app/mail/compose?mode=draft&msg=a%2Fb",
		);
	});
});
