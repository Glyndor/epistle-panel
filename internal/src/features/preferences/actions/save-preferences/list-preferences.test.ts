import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const VARIABLES = {
	pageSize: "EPISTLE_PANEL_PAGE_SIZE",
	refresh: "EPISTLE_PANEL_REFRESH",
} as const;
const saved = {
	pageSize: process.env[VARIABLES.pageSize],
	refresh: process.env[VARIABLES.refresh],
};
const { savePreferences } = await import(".");

beforeEach(() => {
	cookies.reset();
	delete process.env[VARIABLES.pageSize];
	delete process.env[VARIABLES.refresh];
});
afterEach(() => {
	cookies.reset();
	for (const field of ["pageSize", "refresh"] as const) {
		const value = saved[field];
		if (value === undefined) delete process.env[VARIABLES[field]];
		else process.env[VARIABLES[field]] = value;
	}
});

type Posted = Record<string, string | string[] | File | undefined>;
function form(fields: Posted) {
	const data = new FormData();
	data.set("language", "en");
	data.set("theme", "system");
	data.set("density", "comfortable");
	data.set("remoteImages", "ask");
	data.set("timeZone", "UTC");
	data.set("pageSize", "50");
	data.set("refresh", "normal");
	for (const [name, value] of Object.entries(fields)) {
		data.delete(name);
		for (const one of Array.isArray(value) ? value : [value]) {
			if (one !== undefined) data.append(name, one);
		}
	}
	return data;
}
const save = (fields: Posted) =>
	savePreferences({ outcome: "idle" }, form(fields));

const CASES = [
	{
		field: "pageSize",
		cookie: "page-size",
		good: ["25", "50", "100"],
		bad: ["10", "75", "050", "50.0", " 25", "<private-marker>"],
		fallback: "50",
	},
	{
		field: "refresh",
		cookie: "refresh",
		good: ["normal", "slow", "fast"],
		bad: ["off", "never", "0", "FAST", " slow", "<private-marker>"],
		fallback: "normal",
	},
] as const;

describe.each(CASES)("savePreferences $field", (c) => {
	it("writes every valid choice in its own private cookie under /app", async () => {
		await cookies.signIn();
		for (const choice of c.good) {
			cookies.writes.length = 0;

			const state = await save({ [c.field]: choice });

			expect(state).toMatchObject({
				outcome: "saved",
				values: { [c.field]: choice },
			});
			expect(
				cookies.writes.find((write) => write.name === c.cookie),
			).toEqual({
				name: c.cookie,
				value: choice,
				options: {
					httpOnly: true,
					secure: true,
					sameSite: "lax",
					path: "/app",
					maxAge: 31_536_000,
				},
			});
		}
	});

	it("refuses a missing, empty, repeated, file and off-list choice before any write", async () => {
		await cookies.signIn();
		const refusals: [Posted[string], string][] = [
			[undefined, "required"],
			["", "required"],
			[[c.good[0], c.good[1]], "notInList"],
			[[c.good[0], c.good[0]], "notInList"],
			[new File([c.good[0]], "choice"), "notInList"],
			...c.bad.map((value): [string, string] => [value, "notInList"]),
		];
		for (const [value, message] of refusals) {
			expect(await save({ [c.field]: value })).toEqual({
				outcome: "refused",
				fields: { [c.field]: message },
			});
			expect(cookies.writes).toEqual([]);
		}
	});

	it("refuses any posted choice when the operator fixed it, the same one too, and writes nothing", async () => {
		await cookies.signIn();
		for (const operator of c.good) {
			process.env[VARIABLES[c.field]] = operator;
			for (const chosen of [...c.good, "hostile"]) {
				expect(await save({ [c.field]: chosen })).toEqual({
					outcome: "refused",
					fields: { [c.field]: "notInList" },
				});
				expect(cookies.writes).toEqual([]);
			}
		}
	});

	it("saves the rest when the operator fixed it, says the operator's value, and leaves the cookie alone", async () => {
		await cookies.signIn();
		for (const operator of c.good) {
			cookies.writes.length = 0;
			process.env[VARIABLES[c.field]] = operator;
			cookies.jar.set(c.cookie, c.good[0]);

			const state = await save({ [c.field]: undefined });

			expect(state).toMatchObject({
				outcome: "saved",
				values: { [c.field]: operator },
			});
			expect(cookies.writes.map((write) => write.name)).not.toContain(
				c.cookie,
			);
			expect(cookies.jar.get(c.cookie)).toBe(c.good[0]);
		}
	});

	it("still checks the other fields when the operator fixed this one", async () => {
		await cookies.signIn();
		process.env[VARIABLES[c.field]] = c.good[1];

		expect(await save({ [c.field]: undefined, theme: "hostile" })).toEqual({
			outcome: "refused",
			fields: { theme: "notInList" },
		});
		expect(cookies.writes).toEqual([]);
	});

	it("writes nothing without a session", async () => {
		expect(await save({ [c.field]: c.good[1] })).toEqual({
			outcome: "failed",
		});
		expect(cookies.writes).toEqual([]);
	});
});

describe("savePreferences with both fixed", () => {
	it("names every fixed field that was posted, and only those", async () => {
		await cookies.signIn();
		process.env[VARIABLES.pageSize] = "25";
		process.env[VARIABLES.refresh] = "fast";

		expect(await save({})).toEqual({
			outcome: "refused",
			fields: { pageSize: "notInList", refresh: "notInList" },
		});
		expect(await save({ pageSize: undefined, refresh: "slow" })).toEqual({
			outcome: "refused",
			fields: { refresh: "notInList" },
		});
		expect(cookies.writes).toEqual([]);

		expect(
			await save({ pageSize: undefined, refresh: undefined }),
		).toMatchObject({
			outcome: "saved",
			values: { pageSize: "25", refresh: "fast" },
		});
	});
});
