import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { emailFixture, SESSION, stubJmap } from "../../test-support/jmap-stub";
import { attachmentsOf, loadMessage, MAX_HEADERS } from ".";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
beforeEach(() => {
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
});
afterEach(() => {
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
});

const ID = "00000000-0000-4000-8000-0000000000aa";
const part = (
	id: string,
	type: string,
	extra: Record<string, unknown> = {},
) => ({
	partId: id,
	blobId: `${ID}.${id}`,
	size: 10,
	type,
	...extra,
});

function serve(email: Record<string, unknown> | null) {
	return stubJmap({
		"Email/get": {
			list: email === null ? [] : [email],
			notFound: email === null ? [ID] : [],
		},
	});
}

describe("loadMessage", () => {
	it("returns null when the server has no such message", async () => {
		serve(null);
		expect(await loadMessage(SESSION, ID)).toBeNull();
	});

	it("asks for the bodies with a byte cap and the part properties the reader needs", async () => {
		const seen = serve(emailFixture({ id: ID }));
		await loadMessage(SESSION, ID);
		expect(seen[0]?.calls[0]?.[1]).toMatchObject({
			accountId: "admin",
			ids: [ID],
			fetchTextBodyValues: true,
			fetchHTMLBodyValues: true,
			maxBodyValueBytes: 1_048_576,
		});
	});

	it("shows a text body as safe text", async () => {
		serve(
			emailFixture({
				id: ID,
				textBody: [part("1", "text/plain")],
				bodyValues: {
					"1": {
						value: "line one\r\nline‮ two\u0000",
						isTruncated: false,
					},
				},
			}),
		);
		const detail = await loadMessage(SESSION, ID);
		expect(detail?.body).toEqual({
			kind: "text",
			text: "line one\nline two",
			truncated: false,
		});
	});

	it("reports an HTML body without sending its markup, with the remote images held back", async () => {
		serve(
			emailFixture({
				id: ID,
				htmlBody: [part("2", "text/html")],
				textBody: [part("1", "text/plain")],
				bodyValues: {
					"1": { value: "plain version" },
					"2": {
						value: '<p>hi <script>alert(1)</script></p><img src="https://t.example/p.gif"><img src="https://t.example/q.gif">',
						isTruncated: true,
					},
				},
			}),
		);
		const detail = await loadMessage(SESSION, ID);
		expect(detail?.body).toEqual({
			kind: "html",
			blockedImages: 2,
			truncated: true,
			alternativeText: "plain version",
		});
		expect(JSON.stringify(detail)).not.toContain("alert");
	});

	it("falls back to the text version when the HTML has nothing left after sanitising", async () => {
		serve(
			emailFixture({
				id: ID,
				htmlBody: [part("2", "text/html")],
				textBody: [part("1", "text/plain")],
				bodyValues: {
					"1": { value: "text" },
					"2": { value: "<script>x</script>" },
				},
			}),
		);
		expect((await loadMessage(SESSION, ID))?.body).toEqual({
			kind: "text",
			text: "text",
			truncated: false,
		});
	});

	it("ignores an HTML part listed as the text body and reports no body when there is none", async () => {
		serve(
			emailFixture({
				id: ID,
				textBody: [part("1", "text/html")],
				bodyValues: { "1": { value: "<b>x</b>" } },
			}),
		);
		expect((await loadMessage(SESSION, ID))?.body).toEqual({
			kind: "none",
		});
	});

	it("lists attachments with a clean name, skipping parts that cannot be downloaded", async () => {
		serve(
			emailFixture({
				id: ID,
				attachments: [
					part("3", "application/pdf", {
						name: "../../etc/passwd‮fdp.exe",
						size: 2048,
					}),
					{ partId: "4", blobId: null, type: "x/y" },
					{ partId: "../5", blobId: "b", type: "x/y" },
					{ partId: null, blobId: "b", type: "x/y" },
					part("6", "image/png", { name: null }),
				],
			}),
		);
		const detail = await loadMessage(SESSION, ID);
		expect(detail?.attachments).toEqual([
			{
				part: "3",
				name: "passwdfdp.exe",
				type: "application/pdf",
				size: 2048,
			},
			{ part: "6", name: "attachment", type: "image/png", size: 10 },
		]);
	});

	it("shows the headers of the root part as safe text, capped in number", async () => {
		const headers = Array.from({ length: MAX_HEADERS + 20 }, (_, i) => ({
			name: `X-${i}`,
			value: `v\r\nBcc: evil${i}`,
		}));
		serve(
			emailFixture({
				id: ID,
				bodyStructure: {
					partId: null,
					type: "multipart/mixed",
					headers,
				},
			}),
		);
		const detail = await loadMessage(SESSION, ID);
		expect(detail?.headers).toHaveLength(MAX_HEADERS);
		expect(detail?.headers[0]).toEqual({
			name: "X-0",
			value: "v Bcc: evil0",
		});
	});

	it("carries the addresses, the flags and the folder, all as safe text", async () => {
		serve(
			emailFixture({
				id: ID,
				subject: "Re:‮ hi",
				keywords: { $seen: true, $flagged: true },
				cc: [{ name: "C", email: "c@example.org" }],
				replyTo: [{ name: null, email: "r@example.org" }],
				messageId: ["<id@example.org>"],
				mailboxIds: { Sent: true },
			}),
		);
		const detail = await loadMessage(SESSION, ID);
		expect(detail).toMatchObject({
			subject: "Re: hi",
			unread: false,
			flagged: true,
			mailboxId: "Sent",
			messageId: "<id@example.org>",
			cc: [{ name: "C", email: "c@example.org" }],
			replyTo: [{ name: null, email: "r@example.org" }],
		});
	});

	it("handles a message with no id header, no folder and no headers", async () => {
		serve(
			emailFixture({
				id: ID,
				messageId: null,
				mailboxIds: {},
				bodyStructure: null,
			}),
		);
		const detail = await loadMessage(SESSION, ID);
		expect(detail).toMatchObject({
			messageId: null,
			mailboxId: null,
			headers: [],
		});
	});
});

describe("attachmentsOf", () => {
	it("returns nothing for a message with no attachment list", () => {
		expect(attachmentsOf({ id: "i", receivedAt: "x" })).toEqual([]);
	});
});
