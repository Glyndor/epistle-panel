import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import {
	sentRequests,
	stubFetchJson,
	stubFetchReject,
} from "@/lib/api/test-support/fetch";
import { createSession } from "@/lib/auth/session";

const revalidatePath = mock(() => {});
mock.module("next/cache", () => ({ revalidatePath }));

let sessionToken: string | undefined;
mock.module("next/headers", () => ({
	cookies: async () => ({
		get: () => (sessionToken ? { value: sessionToken } : undefined),
	}),
}));

const { removeEntry } = await import(".");

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";

beforeEach(async () => {
	sessionToken = await createSession("admin");
});
afterEach(() => revalidatePath.mockClear());

describe("removeEntry", () => {
	it("removes the entry, revalidates, and reports success", async () => {
		stubFetchJson({ removed: ID });
		const form = new FormData();
		form.set("id", ID);

		const result = await removeEntry(null, form);

		expect(result).toEqual({ ok: true });
		expect(revalidatePath).toHaveBeenCalledWith("/queue");
	});

	it("reports failure and does not revalidate when removal errors", async () => {
		stubFetchReject();
		const form = new FormData();
		form.set("id", ID);

		const result = await removeEntry(null, form);

		expect(result).toEqual({ ok: false });
		expect(revalidatePath).not.toHaveBeenCalled();
	});

	it("refuses an id that is not a UUID before any API call, whatever it holds", async () => {
		stubFetchJson({ removed: ID });
		const fetchStub = globalThis.fetch as unknown as ReturnType<
			typeof mock
		>;

		for (const id of [
			"../status",
			"..%2Fstatus",
			"",
			ID.toUpperCase().slice(0, -1),
			`${ID}/extra`,
			`${ID}?x=1`,
			"not-a-uuid",
		]) {
			const form = new FormData();
			form.set("id", id);
			expect(await removeEntry(null, form), id).toEqual({ ok: false });
		}
		expect(await removeEntry(null, new FormData())).toEqual({ ok: false });
		expect(fetchStub).not.toHaveBeenCalled();
		expect(revalidatePath).not.toHaveBeenCalled();
	});

	it("sends the DELETE for the exact id it was given", async () => {
		stubFetchJson({ removed: ID });
		const form = new FormData();
		form.set("id", ID);

		await removeEntry(null, form);

		expect(sentRequests().map(({ method, url }) => [method, url])).toEqual([
			["DELETE", `http://127.0.0.1:8025/api/v1/queue/${ID}`],
		]);
	});

	it("refuses without a valid session and never calls the API", async () => {
		stubFetchJson({ removed: ID });
		const fetchStub = globalThis.fetch as unknown as ReturnType<
			typeof mock
		>;
		const form = new FormData();
		form.set("id", ID);

		for (const token of [undefined, "forged.token"]) {
			sessionToken = token;
			expect(await removeEntry(null, form)).toEqual({ ok: false });
		}

		expect(fetchStub).not.toHaveBeenCalled();
		expect(revalidatePath).not.toHaveBeenCalled();
	});
});
