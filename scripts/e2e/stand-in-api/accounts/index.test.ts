import { afterAll, beforeEach, describe, expect, test } from "bun:test";

import {
	accountsSchema,
	archiveListSchema,
	displayNameSchema,
	mailboxesSchema,
	maskedCreatedSchema,
	maskedListSchema,
	maskedRemovedSchema,
	restoredSchema,
	totpEnrolledSchema,
	updatedSchema,
} from "../../../../internal/src/lib/api/schemas";
import { apiErrorSchema } from "../../../../internal/src/lib/api/schemas";
import { createStandIn, type LoggedRequest } from "../index";
import { MASKED_LIMIT, STAND_IN_TOTP_SECRET } from "./index";

const TOKEN = "stand-in-accounts-token";
const { server } = createStandIn({ token: TOKEN });
const base = `http://127.0.0.1:${server.port}`;
const auth = { Authorization: `Bearer ${TOKEN}` };
const json = { ...auth, "Content-Type": "application/json" };
const ARCHIVED = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

afterAll(() => server.stop(true));
beforeEach(async () => {
	await fetch(`${base}/__control/reset`, { method: "POST" });
});

const call = (method: string, path: string, body?: unknown) =>
	fetch(`${base}/api/v1/accounts/${path}`, {
		method,
		headers: json,
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
const state = async () => (await fetch(`${base}/__control/accounts`)).json() as Promise<Record<string, any>>;
const errorCode = async (response: Response) => apiErrorSchema.parse(await response.json()).error.code;

describe("accounts listing", () => {
	test("carries the display name and the dynamic flag the panel's schema requires", async () => {
		const list = accountsSchema.parse(await (await fetch(`${base}/api/v1/accounts`, { headers: auth })).json());
		expect(list.accounts.find((a) => a.name === "admin")).toMatchObject({
			display_name: "Admin Person",
			dynamic: true,
		});
		expect(list.accounts.find((a) => a.name === "ops")?.display_name).toBeNull();
	});
});

describe("per-account endpoints", () => {
	test("mailboxes answer a tree in the panel's shape", async () => {
		const parsed = mailboxesSchema.parse(await (await call("GET", "admin/mailboxes")).json());
		expect(parsed.tree.find((m) => m.id === "INBOX/Work")?.parent_id).toBe("INBOX");
	});

	test("an unknown account answers 404 not_found on every endpoint", async () => {
		for (const [method, path] of [
			["GET", "nobody/mailboxes"],
			["GET", "nobody/masked"],
			["GET", "nobody/archive"],
			["PUT", "nobody/password"],
			["POST", "nobody/totp"],
		] as const) {
			const response = await call(method, path, method === "GET" ? undefined : {});
			expect([path, response.status, await errorCode(response)]).toEqual([path, 404, "not_found"]);
		}
	});

	test("the display name is trimmed, cleared by an empty value and checked", async () => {
		expect(displayNameSchema.parse(await (await call("PUT", "ops/display_name", { display_name: "  Op  " })).json())).toEqual({ display_name: "Op" });
		expect(displayNameSchema.parse(await (await call("PUT", "ops/display_name", { display_name: "" })).json())).toEqual({ display_name: null });
		expect((await call("PUT", "ops/display_name", { display_name: "a\nb" })).status).toBe(400);
		expect((await call("PUT", "ops/display_name", { nope: 1 })).status).toBe(422);
		expect((await state())["ops"].displayName).toBeNull();
	});

	test("the password policy is applied, and the password is counted, never kept", async () => {
		const good = await call("PUT", "ops/password", { password: "a perfectly fine pass" });
		expect(updatedSchema.parse(await good.json())).toEqual({ updated: "ops" });
		for (const password of ["short", "a".repeat(65), "password1234", "café café café"]) {
			const bad = await call("PUT", "ops/password", { password });
			expect([password, bad.status, await errorCode(bad)]).toEqual([password, 400, "invalid_input"]);
		}
		expect((await call("PUT", "ops/password", {})).status).toBe(422);
		const snapshot = JSON.stringify(await state());
		expect(snapshot).toContain('"passwordChanges":1');
		expect(snapshot).not.toContain("perfectly");
	});

	test("two-factor enrols with a fixed public secret and turns off", async () => {
		const enrolled = totpEnrolledSchema.parse(await (await call("POST", "ops/totp")).json());
		expect(enrolled.secret).toBe(STAND_IN_TOTP_SECRET);
		expect((await state())["ops"].totp).toBe(true);
		expect(updatedSchema.parse(await (await call("DELETE", "ops/totp")).json())).toEqual({ updated: "ops" });
		expect((await state())["ops"].totp).toBe(false);
	});

	test("masked addresses are minted, listed, capped and removed by their encoded address", async () => {
		const made = maskedCreatedSchema.parse(await (await call("POST", "ops/masked", { label: "My Shop!" })).json());
		expect(made.address).toMatch(/^my-shop\.[a-z2-7]{8}@example\.test$/);
		const listed = maskedListSchema.parse(await (await call("GET", "ops/masked")).json());
		expect(listed.addresses.map((a) => a.address)).toEqual([made.address]);

		expect((await call("POST", "ops/masked", { label: "---" })).status).toBe(400);
		for (let i = 1; i < MASKED_LIMIT; i++) {
			expect((await call("POST", "ops/masked", { label: `l${i}` })).status).toBe(201);
		}
		const full = await call("POST", "ops/masked", { label: "one more" });
		expect([full.status, await errorCode(full)]).toEqual([409, "conflict"]);

		const removed = await call("DELETE", `ops/masked/${encodeURIComponent(made.address)}`);
		expect(maskedRemovedSchema.parse(await removed.json()).removed).toBe(made.address);
		expect((await call("DELETE", `ops/masked/${encodeURIComponent(made.address)}`)).status).toBe(404);
	});

	test("the archive lists for admin, answers 404 elsewhere, and restores once", async () => {
		const listed = archiveListSchema.parse(await (await call("GET", "admin/archive")).json());
		expect(listed.entries).toHaveLength(2);
		const off = await call("GET", "ops/archive");
		expect([off.status, await errorCode(off)]).toEqual([404, "not_found"]);

		const restored = restoredSchema.parse(await (await call("POST", `admin/archive/${ARCHIVED}/restore`)).json());
		expect(restored).toEqual({ id: ARCHIVED, restored_to: "INBOX" });
		expect((await call("POST", `admin/archive/${ARCHIVED}/restore`)).status).toBe(404);
		expect((await state())["admin"].archive).toHaveLength(1);
	});

	test("reset puts the state back", async () => {
		await call("POST", "ops/totp");
		await fetch(`${base}/__control/reset`, { method: "POST" });
		expect((await state())["ops"].totp).toBe(false);
	});

	test("the request log holds method and path only: no password, no secret, no label", async () => {
		await call("PUT", "ops/password", { password: "a perfectly fine pass" });
		await call("POST", "ops/totp");
		await call("POST", "ops/masked", { label: "private label" });

		const dump = JSON.stringify(((await (await fetch(`${base}/__control/log`)).json()) as LoggedRequest[]));
		expect(dump).toContain("/api/v1/accounts/ops/password");
		for (const secret of ["perfectly", STAND_IN_TOTP_SECRET, "private label"]) {
			expect(dump).not.toContain(secret);
		}
	});
});
