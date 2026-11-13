import { describe, expect, it } from "bun:test";

import { createJmapStore, MAIL_ACCOUNT } from ".";
import { IDS } from "./messages";

const store = createJmapStore();

async function call(calls: unknown[]) {
	const request = new Request("http://x/jmap/api", {
		method: "POST",
		body: JSON.stringify({ methodCalls: calls }),
	});
	const response = await store.handle(request, new URL(request.url));
	return (await response?.json()) as { methodResponses: Array<[string, Record<string, any>, string]> };
}

describe("the stand-in JMAP", () => {
	it("lists the mailboxes with counters", async () => {
		const { methodResponses } = await call([["Mailbox/get", { accountId: MAIL_ACCOUNT, ids: null }, "a"]]);
		const inbox = methodResponses[0]?.[1]["list"].find((b: { id: string }) => b.id === "INBOX");
		expect(inbox.totalEmails).toBe(68);
		expect(inbox.unreadEmails).toBeGreaterThan(0);
	});

	it("queries a mailbox newest first with every id, as epistle does", async () => {
		const { methodResponses } = await call([["Email/query", { accountId: MAIL_ACCOUNT, filter: { inMailbox: "INBOX" } }, "q"]]);
		const ids = methodResponses[0]?.[1]["ids"] as string[];
		expect(ids).toHaveLength(68);
		expect(ids[0]).toBe(IDS.welcome);
	});

	it("gets emails with body values, attachments and the root headers", async () => {
		const { methodResponses } = await call([
			["Email/get", { accountId: MAIL_ACCOUNT, ids: [IDS.attachments, IDS.hostileHtml, "missing"], fetchTextBodyValues: true, fetchHTMLBodyValues: true, maxBodyValueBytes: 10 }, "g"],
		]);
		const result = methodResponses[0]?.[1];
		expect(result["notFound"]).toEqual(["missing"]);
		const [files, hostile] = result["list"];
		expect(files.attachments.map((a: { partId: string }) => a.partId)).toEqual(["2", "3", "4"]);
		expect(files.hasAttachment).toBe(true);
		expect(files.bodyStructure.headers.some((h: { name: string }) => h.name === "Subject")).toBe(true);
		expect(hostile.bodyValues[hostile.htmlBody[0].partId].isTruncated).toBe(true);
	});

	it("answers errors the way JMAP does", async () => {
		const { methodResponses } = await call([
			["Email/get", { accountId: "someone", ids: [] }, "a"],
			["Nope/get", { accountId: MAIL_ACCOUNT }, "b"],
			["Email/get", { accountId: MAIL_ACCOUNT, ids: Array.from({ length: 501 }, String) }, "c"],
		]);
		expect(methodResponses.map((r) => r[1]["type"])).toEqual(["accountNotFound", "unknownMethod", "requestTooLarge"]);
	});

	it("downloads a part with its own type and no content disposition, and 404s otherwise", async () => {
		const get = async (path: string) => {
			const request = new Request(`http://x${path}`);
			return store.handle(request, new URL(request.url));
		};
		const ok = await get(`/jmap/download/admin/${IDS.attachments}.3/x`);
		expect(ok?.headers.get("content-type")).toBe("text/html");
		expect(ok?.headers.get("content-disposition")).toBeNull();
		expect((await get(`/jmap/download/other/${IDS.attachments}.3/x`))?.status).toBe(404);
		expect((await get(`/jmap/download/admin/${IDS.attachments}.99/x`))?.status).toBe(404);
		expect(await get("/other")).toBeNull();
	});

	it("sets keywords whole, moves a message to a new id and destroys on request", async () => {
		const set = async (args: Record<string, unknown>) =>
			(await call([["Email/set", { accountId: MAIL_ACCOUNT, ...args }, "s"]])).methodResponses[0]?.[1] as Record<string, any>;
		const kept = await set({ update: { [IDS.welcome]: { keywords: { $seen: true, $flagged: true, $junk: false } } } });
		expect(kept["updated"]).toEqual({ [IDS.welcome]: null });
		expect(store.snapshot().find((m) => m.id === IDS.welcome)?.keywords).toEqual({ $seen: true, $flagged: true });
		await set({ update: { [IDS.welcome]: { mailboxIds: { Trash: true } } } });
		const moved = store.snapshot().find((m) => m.subject === "Welcome to your mailbox");
		expect(moved?.mailbox).toBe("Trash");
		expect(moved?.id).not.toBe(IDS.welcome);
		const gone = await set({ update: { [IDS.welcome]: { keywords: {} } }, destroy: [moved?.id, "nope"] });
		expect(gone["notUpdated"]).toEqual({ [IDS.welcome]: { type: "notFound" } });
		expect(gone["destroyed"]).toEqual([moved?.id]);
		expect(gone["notDestroyed"]).toEqual({ nope: { type: "notFound" } });
		store.reset();
	});

	it("keeps a snapshot and goes back to the seed on reset", () => {
		expect(store.snapshot()).toHaveLength(69);
		store.reset();
		expect(store.snapshot()).toHaveLength(69);
	});
});
