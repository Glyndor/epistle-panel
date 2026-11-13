import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import {
	accountCreatedSchema,
	accountRemovedSchema,
	accountsSchema,
	apiErrorSchema,
} from "../../../../internal/src/lib/api/schemas";
import { createStandIn, type LoggedRequest } from "../index";
import { FILE_ACCOUNT } from "./index";
import { BREACHED_PASSWORD, MAX_ACCOUNTS } from "./lifecycle";

const TOKEN = "stand-in-lifecycle-token";
const PASSWORD = "correct horse battery";
const { server } = createStandIn({ token: TOKEN });
const base = `http://127.0.0.1:${server.port}`;
const auth = { Authorization: `Bearer ${TOKEN}` };

afterAll(() => server.stop(true));
beforeEach(async () => {
	await fetch(`${base}/__control/reset`, { method: "POST" });
});

const create = (body: unknown, headers: Record<string, string> = { "Content-Type": "application/json" }) =>
	fetch(`${base}/api/v1/accounts`, { method: "POST", headers: { ...auth, ...headers }, body: JSON.stringify(body) });
const remove = (name: string, query = "?queue=drain") =>
	fetch(`${base}/api/v1/accounts/${name}${query}`, { method: "DELETE", headers: auth });
const account = (over: Record<string, unknown> = {}) => ({
	name: "carol",
	addresses: ["carol@example.test"],
	password: PASSWORD,
	...over,
});
const listed = async () => accountsSchema.parse(await (await fetch(`${base}/api/v1/accounts`, { headers: auth })).json()).accounts;
const code = async (response: Response) => apiErrorSchema.parse(await response.json()).error.code;

describe("create", () => {
	test("stores the account lowercased and lists it as the API's, in the panel's shapes", async () => {
		const response = await create(account({ name: "Carol", display_name: " Carol C " }));

		expect(response.status).toBe(200);
		expect(accountCreatedSchema.parse(await response.json())).toEqual({ created: "carol" });
		expect((await listed()).find((a) => a.name === "carol")).toEqual({
			name: "carol",
			display_name: "Carol C",
			dynamic: true,
			addresses: ["carol@example.test"],
		});
	});

	test("refuses, with 400 invalid_input: an address outside the hosted domain, a name or an address in use, a weak or breached password, a malformed name", async () => {
		for (const body of [
			account({ addresses: ["carol@elsewhere.test"] }),
			account({ addresses: [] }),
			account({ name: "admin", addresses: ["new@example.test"] }),
			account({ addresses: ["admin@example.test"] }),
			account({ password: "short" }),
			account({ password: BREACHED_PASSWORD }),
			account({ name: "bad name" }),
		]) {
			const response = await create(body);
			expect([body, response.status, await code(response)]).toEqual([body, 400, "invalid_input"]);
		}
		expect((await listed()).some((a) => a.name === "carol")).toBe(false);
	});

	test("answers 409 conflict once it holds its account limit", async () => {
		const seeded = (await listed()).length;
		for (let n = seeded; n < MAX_ACCOUNTS; n++) {
			expect((await create(account({ name: `extra${n}`, addresses: [`extra${n}@example.test`] }))).status).toBe(200);
		}

		const response = await create(account());
		expect([response.status, await code(response)]).toEqual([409, "conflict"]);
	});

	test("wants JSON: another content type is 415 and a body that is not JSON is 400, both as plain text", async () => {
		expect((await create(account(), { "Content-Type": "text/plain" })).status).toBe(415);
		const broken = await fetch(`${base}/api/v1/accounts`, {
			method: "POST",
			headers: { ...auth, "Content-Type": "application/json" },
			body: "{not json",
		});
		expect(broken.status).toBe(400);
	});

	test("keeps the password out of its state and its log", async () => {
		await create(account());
		await create(account({ name: "dave", addresses: ["dave@example.test"], password: BREACHED_PASSWORD }));

		const dump =
			JSON.stringify(await (await fetch(`${base}/__control/accounts`)).json()) +
			JSON.stringify((await (await fetch(`${base}/__control/log`)).json()) as LoggedRequest[]);
		expect(dump).not.toContain(PASSWORD);
		expect(dump).not.toContain(BREACHED_PASSWORD);
	});
});

describe("delete", () => {
	test("removes an account the API made and reports nothing queued", async () => {
		await create(account());

		const response = await remove("carol");

		expect(accountRemovedSchema.parse(await response.json())).toEqual({
			removed: "carol",
			queued_messages_discarded: 0,
			queued_messages_left: 0,
		});
		expect((await listed()).some((a) => a.name === "carol")).toBe(false);
	});

	test("leaves the queued mail of a busy account with drain and drops it with discard", async () => {
		await create(account({ name: "busy-one", addresses: ["b1@example.test"] }));
		await create(account({ name: "busy-two", addresses: ["b2@example.test"] }));

		expect(accountRemovedSchema.parse(await (await remove("busy-one", "?queue=drain")).json())).toMatchObject({
			queued_messages_left: 2,
			queued_messages_discarded: 0,
		});
		expect(accountRemovedSchema.parse(await (await remove("busy-two", "?queue=discard")).json())).toMatchObject({
			queued_messages_left: 0,
			queued_messages_discarded: 2,
		});
	});

	test("needs the queue choice: without it, or with another value, it is 400 and nothing is removed", async () => {
		await create(account());

		expect((await remove("carol", "")).status).toBe(400);
		expect((await remove("carol", "?queue=all")).status).toBe(400);
		expect((await listed()).some((a) => a.name === "carol")).toBe(true);
	});

	test("answers 404 for an account of the configuration file and for one that is not there", async () => {
		const declared = await remove(FILE_ACCOUNT);
		expect([declared.status, await code(declared)]).toEqual([404, "not_found"]);
		expect((await remove("nobody")).status).toBe(404);
		expect((await listed()).some((a) => a.name === FILE_ACCOUNT && !a.dynamic)).toBe(true);
	});
});

describe("reset", () => {
	test("goes back to the seed accounts", async () => {
		const seeded = (await listed()).map((a) => a.name);
		await create(account());
		await fetch(`${base}/__control/reset`, { method: "POST" });

		expect((await listed()).map((a) => a.name)).toEqual(seeded);
	});
});
