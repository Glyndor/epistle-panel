import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { ZodError } from "zod";

import { ConfigError } from "@/lib/config/config-error";

import { getStatus } from "../client";
import { EpistleApiError, EpistleApiTimeoutError } from "../error";
import { stubFetchJson } from "../test-support/fetch";
import { describeFailure, logApiFailure } from ".";

describe("describeFailure", () => {
	it("keeps the status and code of an API error and drops its message", () => {
		const error = new EpistleApiError(
			404,
			"not_found",
			"queue q-7 for bob@example.org is gone",
		);
		const line = describeFailure("queue fetch", error);
		expect(line).toBe("queue fetch failed: status=404 code=not_found");
		expect(line).not.toContain("bob@example.org");
	});

	it("does not log an API code that reads like prose", () => {
		const error = new EpistleApiError(
			500,
			"disk full at /var/lib/epistle",
			"x",
		);
		const line = describeFailure("status fetch", error);
		expect(line).toBe("status fetch failed: status=500 code=invalid");
	});

	it("logs only the class of a network error, not its text or URL", () => {
		const error = new TypeError(
			"fetch failed: connect ECONNREFUSED http://127.0.0.1:8025/api/v1/queue",
		);
		const line = describeFailure("queue fetch", error);
		expect(line).toBe("queue fetch failed: error=TypeError");
		expect(line).not.toContain("127.0.0.1");
	});

	it("logs only the class of a schema error", () => {
		const error = new ZodError([
			{
				code: "custom",
				path: ["to"],
				message: "bob@example.org",
				input: "x",
			},
		]);
		expect(describeFailure("queue fetch", error)).toBe(
			"queue fetch failed: error=ZodError",
		);
	});

	it("names a timeout", () => {
		expect(
			describeFailure("status fetch", new EpistleApiTimeoutError()),
		).toBe("status fetch failed: error=EpistleApiTimeoutError");
	});

	it("keeps the message of a configuration error, which names a variable only", () => {
		const error = new ConfigError("EPISTLE_API_URL must use http or https");
		expect(describeFailure("status fetch", error)).toBe(
			"status fetch failed: EPISTLE_API_URL must use http or https",
		);
	});

	it("handles a thrown value that is not an Error", () => {
		expect(describeFailure("status fetch", "boom")).toBe(
			"status fetch failed: error=unknown",
		);
	});
});

describe("logApiFailure", () => {
	let spy: ReturnType<typeof spyOn<Console, "error">>;

	beforeEach(() => {
		spy = spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		spy.mockRestore();
	});

	it("writes one line and never the error object", () => {
		const error = new EpistleApiError(
			502,
			"bad_gateway",
			"secret internals",
		);
		logApiFailure("domains fetch", error);
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy.mock.calls[0]).toEqual([
			"domains fetch failed: status=502 code=bad_gateway",
		]);
	});

	it("keeps the message of a real API failure out of the log", async () => {
		stubFetchJson(
			{
				error: {
					code: "upstream",
					message: "secret internals bob@example.org",
				},
			},
			502,
		);
		const error = await getStatus().catch((e) => e);
		logApiFailure("status fetch", error);
		const logged = JSON.stringify(spy.mock.calls);
		expect(logged).toContain("status=502 code=upstream");
		expect(logged).not.toContain("secret internals");
		expect(logged).not.toContain("bob@example.org");
		expect(logged).not.toContain("127.0.0.1");
	});
});
