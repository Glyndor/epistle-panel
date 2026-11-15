import { afterEach, describe, expect, it } from "bun:test";

import { ConfigError } from "../config-error";

import {
	DEFAULT_SESSION_MAX_AGE_MINUTES,
	MAX_SESSION_MINUTES,
	readSessionPolicy,
	SESSION_ADMIN_MAX_AGE_VARIABLE,
	SESSION_IDLE_TIMEOUT_VARIABLE,
	SESSION_USER_MAX_AGE_VARIABLE,
	sessionPolicy,
} from ".";

const variables = [
	SESSION_USER_MAX_AGE_VARIABLE,
	SESSION_ADMIN_MAX_AGE_VARIABLE,
	SESSION_IDLE_TIMEOUT_VARIABLE,
];

afterEach(() => {
	for (const name of variables) {
		delete process.env[name];
	}
});

describe("readSessionPolicy", () => {
	it("never confuses an unset variable with the invalid literal undefined in the cache", () => {
		for (const variable of variables) {
			expect(sessionPolicy()).toBeDefined();
			process.env[variable] = "undefined";
			expect(sessionPolicy()).toBeUndefined();
			expect(() => readSessionPolicy()).toThrow(variable);
			delete process.env[variable];
		}
	});
	it("gives both roles eight hours and no idle timeout when nothing is set", () => {
		const policy = readSessionPolicy();

		expect(policy.userMaxAgeSeconds).toBe(8 * 60 * 60);
		expect(policy.adminMaxAgeSeconds).toBe(8 * 60 * 60);
		expect(policy.idleTimeoutSeconds).toBeUndefined();
		expect(DEFAULT_SESSION_MAX_AGE_MINUTES).toBe(480);
	});

	it("reads an empty value as unset, the way the secrets read one", () => {
		process.env[SESSION_USER_MAX_AGE_VARIABLE] = "";
		process.env[SESSION_ADMIN_MAX_AGE_VARIABLE] = "   ";
		process.env[SESSION_IDLE_TIMEOUT_VARIABLE] = "";

		const policy = readSessionPolicy();

		expect(policy.userMaxAgeSeconds).toBe(8 * 60 * 60);
		expect(policy.adminMaxAgeSeconds).toBe(8 * 60 * 60);
		expect(policy.idleTimeoutSeconds).toBeUndefined();
	});

	it("gives each role the lifetime the operator set, in minutes", () => {
		process.env[SESSION_USER_MAX_AGE_VARIABLE] = "15";
		process.env[SESSION_ADMIN_MAX_AGE_VARIABLE] = "1440";

		const policy = readSessionPolicy();

		expect(policy.userMaxAgeSeconds).toBe(15 * 60);
		expect(policy.adminMaxAgeSeconds).toBe(24 * 60 * 60);
	});

	it("reads the idle timeout in minutes, and leaves it off when it is unset", () => {
		process.env[SESSION_IDLE_TIMEOUT_VARIABLE] = "5";

		expect(readSessionPolicy().idleTimeoutSeconds).toBe(5 * 60);
	});

	it("accepts the ends of the range", () => {
		process.env[SESSION_USER_MAX_AGE_VARIABLE] = "1";
		process.env[SESSION_ADMIN_MAX_AGE_VARIABLE] =
			String(MAX_SESSION_MINUTES);

		const policy = readSessionPolicy();

		expect(policy.userMaxAgeSeconds).toBe(60);
		expect(policy.adminMaxAgeSeconds).toBe(MAX_SESSION_MINUTES * 60);
	});

	it("refuses a value that is not a whole number of minutes", () => {
		for (const value of ["0", "-1", "-30", "1.5", "1e3", "30m", "half"]) {
			process.env[SESSION_USER_MAX_AGE_VARIABLE] = value;

			expect(() => readSessionPolicy(), value).toThrow(ConfigError);
		}
	});

	it("refuses a value outside the accepted range", () => {
		for (const value of [
			"0",
			String(MAX_SESSION_MINUTES + 1),
			"99999999999999999999",
			"1".repeat(400),
		]) {
			process.env[SESSION_ADMIN_MAX_AGE_VARIABLE] = value;

			expect(() => readSessionPolicy(), value).toThrow(ConfigError);
		}
	});

	it("refuses an idle timeout outside the accepted range too", () => {
		for (const value of [
			"0",
			"-5",
			"1.5",
			String(MAX_SESSION_MINUTES + 1),
		]) {
			process.env[SESSION_IDLE_TIMEOUT_VARIABLE] = value;

			expect(() => readSessionPolicy(), value).toThrow(ConfigError);
		}
	});

	it("names the variable at fault and never the value", () => {
		process.env[SESSION_USER_MAX_AGE_VARIABLE] = "999999";

		expect(() => readSessionPolicy()).toThrow(
			SESSION_USER_MAX_AGE_VARIABLE,
		);
		try {
			readSessionPolicy();
		} catch (error) {
			expect((error as Error).message).not.toContain("999999");
		}

		process.env[SESSION_USER_MAX_AGE_VARIABLE] = "";
		process.env[SESSION_IDLE_TIMEOUT_VARIABLE] = "888888";

		expect(() => readSessionPolicy()).toThrow(
			SESSION_IDLE_TIMEOUT_VARIABLE,
		);
		try {
			readSessionPolicy();
		} catch (error) {
			expect((error as Error).message).not.toContain("888888");
		}
	});

	it("reads the value again when the environment changes", () => {
		expect(readSessionPolicy().userMaxAgeSeconds).toBe(8 * 60 * 60);

		process.env[SESSION_USER_MAX_AGE_VARIABLE] = "10";

		expect(readSessionPolicy().userMaxAgeSeconds).toBe(10 * 60);
	});
});

describe("sessionPolicy", () => {
	it("gives the policy when every value can be used", () => {
		process.env[SESSION_USER_MAX_AGE_VARIABLE] = "10";

		expect(sessionPolicy()?.userMaxAgeSeconds).toBe(10 * 60);
	});

	it("gives nothing when a value cannot be used, so the routes stay locked", () => {
		process.env[SESSION_IDLE_TIMEOUT_VARIABLE] = "not-a-number";

		expect(sessionPolicy()).toBeUndefined();
	});
});
