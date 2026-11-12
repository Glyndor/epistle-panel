import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

import { stubFetchJson, stubFetchReject } from "@/lib/api/test-fetch";
import { createSession } from "@/lib/auth/session";

const revalidatePath = mock(() => {});
mock.module("next/cache", () => ({ revalidatePath }));

let sessionToken: string | undefined;
mock.module("next/headers", () => ({
	cookies: async () => ({
		get: () => (sessionToken ? { value: sessionToken } : undefined),
	}),
}));

const { removeEntry } = await import("./actions");

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
