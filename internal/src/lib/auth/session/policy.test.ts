import { afterEach, describe, expect, it, setSystemTime } from "bun:test";
import { clearRevocations } from "../revocation";
import { nowSeconds, payloadOf, signRaw } from "../test-support/token";
import {
	checkSession,
	createSession,
	revokeSession,
	sessionMaxAgeSeconds,
	verifySession,
} from ".";

afterEach(() => {
	setSystemTime();
	clearRevocations();
});

describe("the operator's session policy", () => {
	const START = new Date("2026-03-01T12:00:00Z");
	const minutes = (value: number) => value * 60;

	afterEach(() => {
		delete process.env["EPISTLE_PANEL_SESSION_USER_MAX_AGE_MINUTES"];
		delete process.env["EPISTLE_PANEL_SESSION_ADMIN_MAX_AGE_MINUTES"];
		delete process.env["EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES"];
	});

	it("mints a user session with the lifetime the operator gives a user", async () => {
		process.env["EPISTLE_PANEL_SESSION_USER_MAX_AGE_MINUTES"] = "15";
		setSystemTime(START);

		const token = await createSession("ana", "user");

		expect(payloadOf(token).exp).toBe(
			Math.floor(START.getTime() / 1000) + minutes(15),
		);
		expect(sessionMaxAgeSeconds("user")).toBe(minutes(15));
	});

	it("mints an admin session with the lifetime the operator gives an admin", async () => {
		process.env["EPISTLE_PANEL_SESSION_ADMIN_MAX_AGE_MINUTES"] = "1440";
		setSystemTime(START);

		const token = await createSession("ops", "admin");

		expect(payloadOf(token).exp).toBe(
			Math.floor(START.getTime() / 1000) + minutes(1440),
		);
		expect(sessionMaxAgeSeconds("admin")).toBe(minutes(1440));
	});

	it("gives each role its own lifetime, not the longest of the two", async () => {
		process.env["EPISTLE_PANEL_SESSION_USER_MAX_AGE_MINUTES"] = "15";
		process.env["EPISTLE_PANEL_SESSION_ADMIN_MAX_AGE_MINUTES"] = "1440";
		setSystemTime(START);

		const user = payloadOf(await createSession("ana", "user"));
		const admin = payloadOf(await createSession("ops", "admin"));

		expect(user.exp).toBeLessThan(admin.exp as number);
	});

	it("refuses a session whose expiry is beyond the lifetime of its role", async () => {
		process.env["EPISTLE_PANEL_SESSION_USER_MAX_AGE_MINUTES"] = "15";
		const token = await signRaw({
			sub: "ana",
			role: "user",
			exp: nowSeconds() + minutes(16),
		});

		expect(await verifySession(token)).toBeNull();
	});

	it("keeps a session alive for its whole life while no idle timeout is set", async () => {
		setSystemTime(START);
		const token = await createSession("ana", "user");

		setSystemTime(new Date(START.getTime() + 7 * 3_600_000));

		expect(await verifySession(token)).toEqual({
			sub: "ana",
			role: "user",
		});
	});

	it("locks every route when the policy cannot be read", async () => {
		process.env["EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES"] =
			"not-a-number";
		const token = await signRaw({
			sub: "ana",
			role: "user",
			exp: nowSeconds() + 60,
		});

		expect(await verifySession(token)).toBeNull();
	});

	it("refuses to mint a session when the policy cannot be read", async () => {
		process.env["EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES"] =
			"not-a-number";

		expect(createSession("ana", "user")).rejects.toThrow(
			"EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES",
		);
	});

	it("revokes nothing when the policy cannot be read", async () => {
		process.env["EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES"] =
			"not-a-number";
		const token = await signRaw({
			sub: "ana",
			role: "user",
			exp: nowSeconds() + 60,
		});

		await revokeSession(token);

		expect(await verifySession(token)).toBeNull();
	});
});

describe("the idle timeout", () => {
	const START = new Date("2026-03-01T12:00:00Z");

	afterEach(() => {
		delete process.env["EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES"];
	});

	it("refuses a session nobody used for longer than the timeout", async () => {
		process.env["EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES"] = "30";
		setSystemTime(START);
		const token = await createSession("ana", "user");

		setSystemTime(new Date(START.getTime() + 29 * 60_000));
		expect(await verifySession(token)).toEqual({
			sub: "ana",
			role: "user",
		});

		setSystemTime(new Date(START.getTime() + 30 * 60_000));
		expect(await verifySession(token)).toBeNull();
	});

	it("carries the moment of the last activity in the token", async () => {
		process.env["EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES"] = "30";
		setSystemTime(START);

		const token = await createSession("ana", "user");

		expect(payloadOf(token).act).toBe(Math.floor(START.getTime() / 1000));
	});

	it("re-signs the token with the moment of this request, so the clock restarts", async () => {
		process.env["EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES"] = "30";
		setSystemTime(START);
		const token = await createSession("ana", "user");

		setSystemTime(new Date(START.getTime() + 20 * 60_000));
		const checked = await checkSession(token);

		expect(checked?.refreshed).toBeTruthy();
		expect(payloadOf(checked?.refreshed ?? "").act).toBe(
			Math.floor(START.getTime() / 1000) + 20 * 60,
		);
		expect(await verifySession(checked?.refreshed ?? "")).toEqual({
			sub: "ana",
			role: "user",
		});
	});

	it("keeps the absolute lifetime while the clock restarts", async () => {
		process.env["EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES"] = "30";
		setSystemTime(START);
		const token = await createSession("ana", "user");
		const expiry = payloadOf(token).exp;

		setSystemTime(new Date(START.getTime() + 20 * 60_000));
		const checked = await checkSession(token);

		expect(payloadOf(checked?.refreshed ?? "").exp).toBe(expiry);
		expect(checked?.expiresIn).toBe(
			(expiry as number) - (Math.floor(START.getTime() / 1000) + 20 * 60),
		);
	});

	it("leaves the token alone while the idle timeout is off", async () => {
		setSystemTime(START);
		const token = await createSession("ana", "user");

		const checked = await checkSession(token);

		expect(checked?.refreshed).toBeNull();
		expect(payloadOf(token).act).toBeUndefined();
	});

	it("refuses a token that carries no moment of activity, as one signed before the timeout was set", async () => {
		process.env["EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES"] = "30";
		const token = await signRaw({
			sub: "ana",
			role: "user",
			exp: nowSeconds() + 60,
		});

		expect(await verifySession(token)).toBeNull();
	});

	it("refuses a token whose moment of activity is in the future", async () => {
		process.env["EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES"] = "30";
		const token = await signRaw({
			sub: "ana",
			role: "user",
			exp: nowSeconds() + 600,
			act: nowSeconds() + 10,
		});

		expect(await verifySession(token)).toBeNull();
	});

	it("refuses a token whose moment of activity is older than the session itself", async () => {
		process.env["EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES"] = "30";
		const token = await signRaw({
			sub: "ana",
			role: "user",
			exp: nowSeconds() + 600,
			act: nowSeconds() - 10 * 3600,
		});

		expect(await verifySession(token)).toBeNull();
	});

	it("kills every token of a session that was re-signed, when it signs out", async () => {
		process.env["EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES"] = "30";
		setSystemTime(START);
		const first = await createSession("ana", "user");
		setSystemTime(new Date(START.getTime() + 60_000));
		const second = (await checkSession(first))?.refreshed ?? "";

		await revokeSession(second);

		expect(await verifySession(first)).toBeNull();
		expect(await verifySession(second)).toBeNull();
	});
});
