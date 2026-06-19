import { afterEach, describe, expect, it, mock } from "bun:test";

import { stubFetchJson, stubFetchReject } from "@/lib/api/test-fetch";

const revalidatePath = mock(() => {});
mock.module("next/cache", () => ({ revalidatePath }));

const { removeEntry } = await import("./actions");

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";

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
});
