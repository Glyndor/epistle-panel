import { afterEach, expect, it } from "bun:test";
import type { ComposeInput } from "@/features/mail/schemas/compose-input";
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
// #255 row 6: test the MIME on the outgoing Email/set, not just the schema.
async function outgoingType(type: string, expected: string) {
	clearSecretCache();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	const seen = stubJmap({
		"Identity/get": { list: [{ id: "a", email: "a@example.org" }] },
		"Mailbox/get": { list: [{ id: "Drafts", role: "drafts" }] },
		"Email/set": { created: { c: { id: "new-1" } } },
	});
	const attachment = {
		blobId: "00000000-0000-4000-a000-000000000001",
		name: "file",
		type,
		size: 1,
	};
	// Malformed claims cannot enter through the schema. Call the query directly
	// to verify its own defense against callers that already hold ComposeInput.
	const input: ComposeInput = {
		op: "draft",
		to: [],
		cc: [],
		bcc: [],
		subject: "s",
		text: "t",
		attachments: [attachment],
	};
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
				attachments: [
					{
						blobId: attachment.blobId,
						name: attachment.name,
						type: expected,
						disposition: "attachment",
					},
				],
			},
		},
	});
}
it("#255 row 6: neutralizes active attachment MIME in Email/set", async () => {
	for (const type of [
		"text/html",
		"image/svg+xml",
		"application/javascript",
		"application/xhtml+xml",
	]) {
		await outgoingType(type, "application/octet-stream");
	}
});
it("preserves ordinary attachment MIME in Email/set", async () => {
	for (const type of [
		"application/pdf",
		"image/png",
		"application/zip",
		"text/plain",
		"text/csv",
		"message/rfc822",
	]) {
		await outgoingType(type, type);
	}
});
it("neutralizes malformed attachment MIME in Email/set", async () => {
	for (const type of [
		"text/plain; charset=utf-8",
		"text/plain\r\nX-Evil: yes",
		"",
		`text/${"a".repeat(102)}`,
	]) {
		await outgoingType(type, "application/octet-stream");
	}
});
