import { afterAll, describe, expect, test } from "bun:test";

import { apiErrorSchema, deliveriesSchema } from "../../../internal/src/lib/api/schemas";
import { createStandIn } from "./index";

const TOKEN = "stand-in-deliveries-token";
const { server } = createStandIn({ token: TOKEN });
const base = `http://127.0.0.1:${server.port}`;
const auth = { Authorization: `Bearer ${TOKEN}` };

afterAll(() => server.stop(true));

const list = (query = "") => fetch(`${base}/api/v1/deliveries${query}`, { headers: auth });
const recipients = async (query = "") =>
	deliveriesSchema.parse(await (await list(query)).json()).entries.map((e) => e.recipient);

describe("deliveries endpoint", () => {
	test("answers records that match the panel's schema, oldest first within the page", async () => {
		const page = deliveriesSchema.parse(await (await list()).json());
		expect(page.entries).toHaveLength(5);
		const times = page.entries.map((e) => e.time);
		expect([...times].sort((a, b) => a - b)).toEqual(times);
	});

	test("narrows by outcome, recipient, account and a since duration", async () => {
		expect(await recipients("?outcome=failed")).toEqual(["missing@example.net"]);
		expect(await recipients("?recipient=ok@example.net")).toEqual(["ok@example.net"]);
		expect(await recipients("?account=ops")).toEqual(["blocked@example.net", "slow@example.net"]);
		expect(await recipients("?since=24h")).toEqual([
			"missing@example.net",
			"slow@example.net",
			"ok@example.net",
		]);
		expect(await recipients("?since=15m")).toEqual(["slow@example.net", "ok@example.net"]);
	});

	test("cuts the limit to 1 to 100", async () => {
		expect(await recipients("?limit=1")).toHaveLength(1);
		expect(await recipients("?limit=0")).toHaveLength(1);
		expect(await recipients("?limit=5000")).toHaveLength(5);
	});

	test("refuses an unknown outcome and a since that is not a duration with 400", async () => {
		for (const query of ["?outcome=wonky", "?since=../x", "?since=24"]) {
			const response = await list(query);
			expect(response.status).toBe(400);
			expect(apiErrorSchema.parse(await response.json()).error.code).toBe("invalid_input");
		}
	});

	test("has no cursor and takes no write", async () => {
		const page = (await (await list()).json()) as Record<string, unknown>;
		expect(Object.keys(page)).toEqual(["entries"]);
		const response = await fetch(`${base}/api/v1/deliveries`, { method: "DELETE", headers: auth });
		expect(response.status).toBe(404);
	});

	test("needs the bearer token", async () => {
		expect((await fetch(`${base}/api/v1/deliveries`)).status).toBe(401);
	});
});
