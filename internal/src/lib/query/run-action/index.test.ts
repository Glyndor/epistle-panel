import { beforeEach, describe, expect, it, spyOn } from "bun:test";

import { z } from "zod";

import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { runAction, runValidatedAction } = await import(".");

beforeEach(() => {
	cookies.reset();
});

describe("runAction", () => {
	it("returns the data for a signed-in admin", async () => {
		await cookies.signIn();

		expect(await runAction("x", async () => 5)).toEqual({
			ok: true,
			data: 5,
		});
	});

	it("does not run the body without a session, or with a forged one", async () => {
		let ran = 0;
		const body = async () => {
			ran++;
			return 1;
		};

		expect(await runAction("x", body)).toEqual({
			ok: false,
			reason: "unauthenticated",
		});
		cookies.jar.set("__Host-epistle_admin_session", "forged.token");
		expect(await runAction("x", body)).toEqual({
			ok: false,
			reason: "unauthenticated",
		});
		expect(ran).toBe(0);
	});

	it("reports a failure as unavailable, logs the operation, and leaks nothing of the error", async () => {
		await cookies.signIn();
		const errors = spyOn(console, "error").mockImplementation(() => {});

		const result = await runAction("queue fetch", async () => {
			throw new Error("secret detail for ops@example.org");
		});

		expect(result).toEqual({ ok: false, reason: "unavailable" });
		const logged = String(errors.mock.calls[0]?.[0]);
		expect(logged).toBe("queue fetch failed: error=Error");
		expect(logged).not.toContain("secret");
		errors.mockRestore();
	});
});

describe("runValidatedAction", () => {
	const schema = z.strictObject({ n: z.number() });

	it("hands the body the parsed input", async () => {
		await cookies.signIn();

		expect(
			await runValidatedAction(
				"x",
				schema,
				{ n: 2 },
				async (d) => d.n * 2,
			),
		).toEqual({
			ok: true,
			data: 4,
		});
	});

	it("refuses input that does not parse, an unknown field included, without running the body", async () => {
		await cookies.signIn();
		let ran = 0;
		const body = async () => {
			ran++;
		};

		for (const input of [
			undefined,
			null,
			{},
			{ n: "1" },
			{ n: 1, extra: true },
		]) {
			expect(await runValidatedAction("x", schema, input, body)).toEqual({
				ok: false,
				reason: "invalid",
			});
		}
		expect(ran).toBe(0);
	});

	it("checks the session before the input, so an anonymous caller learns nothing about the schema", async () => {
		expect(
			await runValidatedAction("x", schema, "garbage", async () => 1),
		).toEqual({
			ok: false,
			reason: "unauthenticated",
		});
	});

	it("reports a failing body as unavailable", async () => {
		await cookies.signIn();
		const errors = spyOn(console, "error").mockImplementation(() => {});

		expect(
			await runValidatedAction("op", schema, { n: 1 }, async () => {
				throw new Error("boom");
			}),
		).toEqual({ ok: false, reason: "unavailable" });
		errors.mockRestore();
	});
});
