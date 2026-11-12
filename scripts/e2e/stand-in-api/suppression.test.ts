import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import {
	apiErrorSchema,
	removedAddressSchema,
	suppressionPageSchema,
} from "../../../internal/src/lib/api/schemas";
import { createStandIn } from "./index";
import { SEED_SUPPRESSED } from "./suppression";

const TOKEN = "stand-in-suppression-token";
const { server } = createStandIn({ token: TOKEN });
const base = `http://127.0.0.1:${server.port}`;
const auth = { Authorization: `Bearer ${TOKEN}` };

afterAll(() => server.stop(true));
beforeEach(async () => {
	await fetch(`${base}/__control/reset`, { method: "POST" });
});

const list = (query = "") => fetch(`${base}/api/v1/suppression${query}`, { headers: auth });
const remove = (segment: string, query = "") =>
	fetch(`${base}/api/v1/suppression/${segment}${query}`, {
		method: "DELETE",
		headers: auth,
	});

describe("suppression endpoints", () => {
	test("pages by the after cursor until the last page has none, as the real API does", async () => {
		const seen: string[] = [];
		let after: string | undefined;
		for (let pages = 0; pages < 10; pages++) {
			const query = after ? `?after=${encodeURIComponent(after)}` : "";
			const page = suppressionPageSchema.parse(await (await list(query)).json());
			seen.push(...page.addresses);
			after = page.next_cursor;
			if (!after) {
				break;
			}
		}
		expect(seen).toEqual(SEED_SUPPRESSED);
		expect(after).toBeUndefined();
	});

	test("returns addresses strictly after the cursor, even when the cursor is not on the list", async () => {
		const page = suppressionPageSchema.parse(await (await list("?after=b&limit=1")).json());
		expect(page.addresses).toEqual(["bounce+tag@example.test"]);
		expect(page.next_cursor).toBe("bounce+tag@example.test");
	});

	test("caps the limit at 100 and refuses 0", async () => {
		const page = suppressionPageSchema.parse(await (await list("?limit=5000")).json());
		expect(page.addresses).toHaveLength(SEED_SUPPRESSED.length);
		expect(page.next_cursor).toBeUndefined();
		const refused = await list("?limit=0");
		expect(refused.status).toBe(400);
		expect(apiErrorSchema.parse(await refused.json()).error.code).toBe("invalid_input");
	});

	test("removal takes an address named by its encoded path and answers 200 the second time", async () => {
		const first = await remove("odd%2Fone%40example.test");
		expect(removedAddressSchema.parse(await first.json()).removed).toBe("odd/one@example.test");
		const second = await remove("odd%2Fone%40example.test");
		expect(second.status).toBe(200);
		const all = suppressionPageSchema.parse(await (await list("?limit=100")).json());
		expect(all.addresses).not.toContain("odd/one@example.test");
		expect(all.addresses).toHaveLength(SEED_SUPPRESSED.length - 1);
	});

	test("a slash that is not encoded does not reach a removal", async () => {
		expect((await remove("odd/one@example.test")).status).toBe(404);
		const all = suppressionPageSchema.parse(await (await list("?limit=100")).json());
		expect(all.addresses).toContain("odd/one@example.test");
	});

	test("the per-account list is not modelled and answers 404", async () => {
		expect((await list("?account=a@example.test")).status).toBe(404);
		expect((await remove("a%40b.test", "?account=a@example.test")).status).toBe(404);
	});

	test("reset restores the list", async () => {
		await remove("alpha%40example.test");
		await fetch(`${base}/__control/reset`, { method: "POST" });
		const all = suppressionPageSchema.parse(await (await list("?limit=100")).json());
		expect(all.addresses).toEqual(SEED_SUPPRESSED);
	});

	test("needs the bearer token", async () => {
		expect((await fetch(`${base}/api/v1/suppression`)).status).toBe(401);
	});
});
