import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { currentMailSession, interimProvider, setMailCredentialProvider } =
	await import(".");

beforeEach(() => {
	cookies.reset();
	process.env["EPISTLE_API_TOKEN"] = "operator-token";
});
afterEach(() => {
	process.env = { ...savedEnv };
	setMailCredentialProvider(interimProvider);
});

describe("the interim provider", () => {
	it("names the signed-in account and presents the panel's API token", async () => {
		await cookies.signIn("ana");
		expect(await currentMailSession()).toEqual({
			accountId: "ana",
			bearer: "operator-token",
		});
	});

	it("never presents the operator's token for a session of another role", async () => {
		await cookies.signIn("ana", "user");
		expect(await currentMailSession()).toBeNull();
	});

	it("gives nothing without a session or without a token", async () => {
		expect(await currentMailSession()).toBeNull();
		await cookies.signIn("ana");
		delete process.env["EPISTLE_API_TOKEN"];
		delete process.env["EPISTLE_API_TOKEN_FILE"];
		expect(await currentMailSession()).toBeNull();
		process.env["EPISTLE_API_TOKEN_FILE"] = "/nonexistent/token";
		expect(await currentMailSession()).toBeNull();
	});
});

describe("setMailCredentialProvider", () => {
	it("lets the end-user sign-in replace where the session comes from", async () => {
		setMailCredentialProvider({
			current: async () => ({ accountId: "bo", bearer: "user-token" }),
		});
		expect(await currentMailSession()).toEqual({
			accountId: "bo",
			bearer: "user-token",
		});
	});
});
