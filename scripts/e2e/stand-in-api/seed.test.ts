import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import {
	accountsSchema,
	domainsSchema,
	statusSchema,
} from "../../../internal/src/lib/api/schemas";
import { createStandIn } from "./index";
import { parseSeed, seededDomains } from "./seed";

const TOKEN = "stand-in-seed-token";
const { server } = createStandIn({ token: TOKEN });
const base = `http://127.0.0.1:${server.port}`;
const auth = { Authorization: `Bearer ${TOKEN}` };

afterAll(() => server.stop(true));
beforeEach(async () => {
	await fetch(`${base}/__control/reset`, { method: "POST" });
});

describe("parseSeed", () => {
	test("takes whole numbers from 0 to 500, and 0 for a count left out", () => {
		expect(parseSeed({ accounts: 40, domains: 30 })).toEqual({
			accounts: 40,
			domains: 30,
		});
		expect(parseSeed({ accounts: 500 })).toEqual({ accounts: 500, domains: 0 });
		expect(parseSeed({ domains: 0 })).toEqual({ accounts: 0, domains: 0 });
		expect(parseSeed({})).toEqual({ accounts: 0, domains: 0 });
	});

	test("refuses a count below 0, above 500, not whole or not a number", () => {
		for (const body of [
			{ accounts: -1 },
			{ accounts: 501 },
			{ domains: 1.5 },
			{ accounts: "40" },
			{ accounts: 10, domains: 9000 },
			{ domains: null },
		]) {
			expect([body, parseSeed(body)]).toEqual([body, null]);
		}
	});
});

describe("seededDomains", () => {
	test("names them d001 onwards under the stand-in's domain, every third one switched off", () => {
		expect(seededDomains(4)).toEqual([
			{ name: "d001.example.test", disabled: false },
			{ name: "d002.example.test", disabled: false },
			{ name: "d003.example.test", disabled: true },
			{ name: "d004.example.test", disabled: false },
		]);
		expect(seededDomains(0)).toEqual([]);
		expect(seededDomains(60).filter((domain) => domain.disabled)).toHaveLength(20);
	});
});

describe("POST /__control/seed", () => {
	test("seeded rows make the accounts and domains lists long, keep the panel's shapes, and leave on reset", async () => {
		const get = async (path: string) =>
			(await fetch(`${base}${path}`, { headers: auth })).json();
		const seed = (body: unknown) =>
			fetch(`${base}/__control/seed`, {
				method: "POST",
				body: JSON.stringify(body),
			});

		expect((await seed({ accounts: 40, domains: 30 })).status).toBe(200);

		const accounts = accountsSchema.parse(await get("/api/v1/accounts")).accounts;
		expect(accounts).toHaveLength(43);
		expect(accounts.at(3)?.name).toBe("seed-001");
		// Every fourth seeded account stands for one of the configuration file.
		expect(
			accounts.filter((account) => !account.dynamic).map((account) => account.name),
		).toEqual([
			"ops",
			"seed-004",
			"seed-008",
			"seed-012",
			"seed-016",
			"seed-020",
			"seed-024",
			"seed-028",
			"seed-032",
			"seed-036",
			"seed-040",
		]);
		const domains = domainsSchema.parse(await get("/api/v1/domains"));
		expect(domains.domains).toHaveLength(31);
		expect(domains.domains.slice(0, 2)).toEqual([
			"example.test",
			"d001.example.test",
		]);
		// Every third seeded domain is switched off, and each is a listed domain.
		expect(domains.disabled).toHaveLength(10);
		expect(domains.disabled?.at(0)).toBe("d003.example.test");
		for (const name of domains.disabled ?? []) {
			expect(domains.domains).toContain(name);
		}
		expect(statusSchema.parse(await get("/api/v1/status")).domains).toBe(31);

		await fetch(`${base}/__control/reset`, { method: "POST" });
		expect(accountsSchema.parse(await get("/api/v1/accounts")).accounts).toHaveLength(3);
		expect(domainsSchema.parse(await get("/api/v1/domains"))).toEqual({
			domains: ["example.test"],
			disabled: [],
		});
	});

	test("a seed outside 0 to 500, or not a whole number, is refused and adds nothing", async () => {
		for (const body of [
			{ accounts: -1 },
			{ accounts: 501 },
			{ domains: 1.5 },
			{ accounts: "40" },
			{ accounts: 10, domains: 9000 },
		]) {
			const response = await fetch(`${base}/__control/seed`, {
				method: "POST",
				body: JSON.stringify(body),
			});
			expect([body, response.status]).toEqual([body, 400]);
		}
		const accounts = await (
			await fetch(`${base}/api/v1/accounts`, { headers: auth })
		).json();
		expect(accountsSchema.parse(accounts).accounts).toHaveLength(3);
	});
});
