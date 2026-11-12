import { afterEach, describe, expect, it } from "bun:test";

import { queueEntryIdSchema } from "@/features/queue/schemas/queue-input";
import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";

import { loadQueue } from ".";

const ID = queueEntryIdSchema.parse("01890a5d-ac96-774b-b9aa-9be4c3bd6b0e");
const NEXT = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0f";
const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("loadQueue", () => {
	it("maps the API's fields to the table's, with the next cursor", async () => {
		stubFetchJson({
			entries: [
				{
					id: ID,
					reverse_path: "a@example.org",
					recipients: ["b@example.org"],
				},
			],
			next_cursor: NEXT,
		});

		expect(await loadQueue()).toEqual({
			entries: [
				{
					id: ID,
					from: "a@example.org",
					recipients: ["b@example.org"],
				},
			],
			nextCursor: NEXT,
		});
	});

	it("shows an empty envelope sender as <> and a last page as no next cursor", async () => {
		stubFetchJson({
			entries: [{ id: ID, reverse_path: "", recipients: [] }],
		});

		const page = await loadQueue();

		expect(page.entries[0]?.from).toBe("<>");
		expect(page.nextCursor).toBeNull();
	});

	it("asks the API for the cursor it was given, and for none otherwise", async () => {
		stubFetchJson({ entries: [] });
		await loadQueue(ID);
		await loadQueue();

		const [withCursor, without] = sentRequests();
		expect(withCursor?.url).toEndWith(`/api/v1/queue?cursor=${ID}`);
		expect(without?.url).toEndWith("/api/v1/queue");
	});
});
