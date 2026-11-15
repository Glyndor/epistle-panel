import { beforeEach, describe, expect, it } from "bun:test";

import { HOSTILE_LOCALE_VALUES } from "@/features/locale/test-support/hostile-locales";
import { HOSTILE_DENSITY_VALUES } from "@/features/mail/test-support/hostile-densities";
import { INITIAL_PREFERENCES_STATE } from "@/features/preferences/schemas/preferences-state";
import { HOSTILE_THEME_VALUES } from "@/features/theme/test-support/hostile-choices";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { savePreferences } = await import(".");

beforeEach(() => {
	cookies.reset();
});

const GOOD = {
	language: "es",
	theme: "dark",
	density: "compact",
	remoteImages: "ask",
	timeZone: "UTC",
	pageSize: "50",
	refresh: "normal",
} as const;

/** A posted form: each name with the value, or the list of values it was sent with. */
function form(fields: Record<string, string | string[] | File | undefined>) {
	const data = new FormData();
	for (const [name, value] of Object.entries(fields)) {
		for (const one of Array.isArray(value) ? value : [value]) {
			if (one !== undefined) {
				data.append(name, one);
			}
		}
	}
	return data;
}

const save = (fields: Parameters<typeof form>[0]) =>
	savePreferences(INITIAL_PREFERENCES_STATE, form(fields));

describe("savePreferences", () => {
	it("stores the seven choices of a signed-in account of either role, each in its own cookie with its own attributes, and says what it stored", async () => {
		for (const role of ["admin", "user"] as const) {
			cookies.reset();
			await cookies.signIn("ana", role);

			expect(await save(GOOD)).toEqual({
				outcome: "saved",
				values: GOOD,
			});

			expect(cookies.writes).toEqual([
				{
					name: "locale",
					value: "es",
					options: {
						httpOnly: true,
						secure: true,
						sameSite: "lax",
						path: "/",
						maxAge: 31_536_000,
					},
				},
				{
					name: "theme",
					value: "dark",
					options: {
						httpOnly: false,
						secure: true,
						sameSite: "lax",
						path: "/",
						maxAge: 31_536_000,
					},
				},
				{
					name: "list-density",
					value: "compact",
					options: {
						httpOnly: true,
						secure: true,
						sameSite: "lax",
						path: "/app",
						maxAge: 31_536_000,
					},
				},
				{
					name: "__Host-remote-images",
					value: "ask",
					options: {
						httpOnly: true,
						secure: true,
						sameSite: "lax",
						path: "/",
						maxAge: 31536000,
					},
				},
				{
					name: "time-zone",
					value: "UTC",
					options: {
						httpOnly: true,
						secure: true,
						sameSite: "lax",
						path: "/app",
						maxAge: 31536000,
					},
				},
				{
					name: "page-size",
					value: "50",
					options: {
						httpOnly: true,
						secure: true,
						sameSite: "lax",
						path: "/app",
						maxAge: 31536000,
					},
				},
				{
					name: "refresh",
					value: "normal",
					options: {
						httpOnly: true,
						secure: true,
						sameSite: "lax",
						path: "/app",
						maxAge: 31536000,
					},
				},
			]);
		}
	});

	it("stores nothing without a session, with a session cookie that is not one, and answers the same for both", async () => {
		expect(await save(GOOD)).toEqual({ outcome: "failed" });
		expect(cookies.writes).toHaveLength(0);

		const token = await cookies.signIn();
		cookies.jar.set("__Host-epistle_session", `${token}x`);
		expect(await save(GOOD)).toEqual({ outcome: "failed" });
		expect(cookies.writes).toHaveLength(0);
	});

	it("stores nothing, and does not throw, when it is called with something that is no form", async () => {
		await cookies.signIn();
		const call = savePreferences as unknown as (
			...args: unknown[]
		) => Promise<unknown>;

		for (const args of [
			[],
			[form(GOOD)],
			[INITIAL_PREFERENCES_STATE],
			[INITIAL_PREFERENCES_STATE, GOOD],
			[INITIAL_PREFERENCES_STATE, null],
			[INITIAL_PREFERENCES_STATE, "language=es"],
		]) {
			expect(await call(...args)).toEqual({ outcome: "failed" });
		}
		expect(cookies.writes).toHaveLength(0);
	});

	it("refuses a value outside a list, names the field, and stores none of the others", async () => {
		await cookies.signIn();
		const hostile = {
			language: HOSTILE_LOCALE_VALUES,
			theme: HOSTILE_THEME_VALUES,
			density: HOSTILE_DENSITY_VALUES,
		} as const;

		for (const field of ["language", "theme", "density"] as const) {
			for (const value of hostile[field]) {
				const state = await save({ ...GOOD, [field]: value });

				expect([field, value.slice(0, 20), state]).toEqual([
					field,
					value.slice(0, 20),
					{
						outcome: "refused",
						fields: {
							[field]: value === "" ? "required" : "notInList",
						},
					},
				]);
			}
		}
		expect(cookies.writes).toHaveLength(0);
	});

	it("names every refused field at once, and tells a missing field from a wrong one", async () => {
		await cookies.signIn();

		expect(await save({ theme: "sepia", remoteImages: "ask" })).toEqual({
			outcome: "refused",
			fields: {
				language: "required",
				theme: "notInList",
				density: "required",
				timeZone: "required",
				pageSize: "required",
				refresh: "required",
			},
		});
		expect(cookies.writes).toHaveLength(0);
	});

	it("refuses a field sent twice, even when the first value is a good one, and a file in its place", async () => {
		await cookies.signIn();

		expect(await save({ ...GOOD, language: ["es", "de"] })).toEqual({
			outcome: "refused",
			fields: { language: "notInList" },
		});
		expect(
			await save({
				...GOOD,
				theme: new File(["dark"], "dark", { type: "text/plain" }),
			}),
		).toEqual({ outcome: "refused", fields: { theme: "notInList" } });
		expect(cookies.writes).toHaveLength(0);
	});

	it("ignores a field it does not know, and a previous state it was given", async () => {
		await cookies.signIn();

		const state = await savePreferences(
			{ outcome: "failed" },
			form({ ...GOOD, role: "admin", cookie: "a=b" }),
		);

		expect(state).toEqual({ outcome: "saved", values: GOOD });
		expect(cookies.writes.map((write) => write.name)).toEqual([
			"locale",
			"theme",
			"list-density",
			"__Host-remote-images",
			"time-zone",
			"page-size",
			"refresh",
		]);
	});

	it("is the same for a value in the case a list spells and in no other", async () => {
		await cookies.signIn();

		expect((await save({ ...GOOD, language: "ES" })).outcome).toBe(
			"refused",
		);
		expect((await save({ ...GOOD, theme: "Dark" })).outcome).toBe(
			"refused",
		);
		expect((await save({ ...GOOD, density: " compact" })).outcome).toBe(
			"refused",
		);
		expect(cookies.writes).toHaveLength(0);
	});
});
