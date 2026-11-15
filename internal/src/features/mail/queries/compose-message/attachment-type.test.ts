import { afterEach, expect, it } from "bun:test";
import { composeInputSchema } from "@/features/mail/schemas/compose-input";
import { clearSecretCache } from "@/lib/config/secret";
import { SESSION, stubJmap } from "../../test-support/jmap-stub";
import { composeMessage } from ".";

const env = { ...process.env };
const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
afterEach(() => {
	process.env = { ...env };
	clearSecretCache();
	if (fetchDescriptor)
		Object.defineProperty(globalThis, "fetch", fetchDescriptor);
});
// Audit 6, REAL DEFECT: the earlier upload's octet-stream type is never looked up.
it.each(["text/html", "image/svg+xml", "application/javascript"])(
	"currently trusts the composer's replacement MIME %s",
	async (type) => {
		clearSecretCache();
		process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
		const seen = stubJmap({
			"Identity/get": { list: [{ id: "a", email: "a@example.org" }] },
			"Mailbox/get": { list: [{ id: "Drafts", role: "drafts" }] },
			"Email/set": { created: { c: { id: "new-1" } } },
		});
		const attachment = {
			blobId: "00000000-0000-4000-a000-000000000001",
			name: "x.html",
			type,
		};
		const input = composeInputSchema.parse({
			op: "draft",
			to: [],
			cc: [],
			bcc: [],
			subject: "s",
			text: "t",
			attachments: [attachment],
		});
		expect(await composeMessage(SESSION, input)).toEqual({
			kind: "draft",
			id: "new-1",
		});
		const creates = seen
			.flatMap((r) => r.calls)
			.filter(([name]) => name === "Email/set");
		expect(creates).toHaveLength(1);
		expect(creates[0]?.[1]).toMatchObject({
			create: {
				c: {
					attachments: [{ ...attachment, disposition: "attachment" }],
				},
			},
		});
		expect(seen.every((r) => new URL(r.url).pathname === "/jmap/api")).toBe(
			true,
		);
	},
);

// Run with bun test --todo: active types currently pass the composer schema.
it.todo("#255, row 6: rejects executable attachment types supplied by the composer", () => {
	for (const type of [
		"text/html",
		"image/svg+xml",
		"application/javascript",
	]) {
		expect(
			composeInputSchema.safeParse({
				op: "draft",
				to: [],
				cc: [],
				bcc: [],
				subject: "s",
				text: "t",
				attachments: [
					{
						blobId: "00000000-0000-4000-a000-000000000001",
						name: "x.html",
						type,
					},
				],
			}).success,
		).toBe(false);
	}
});
