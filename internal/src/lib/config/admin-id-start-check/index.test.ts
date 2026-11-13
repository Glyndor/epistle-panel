import { afterEach, describe, expect, it, spyOn } from "bun:test";

import { TEST_ADMIN_ID } from "../test-support/admin-id";

import { checkAdminIdAtStart } from ".";

afterEach(() => {
	process.env["EPISTLE_PANEL_ADMIN_ID"] = TEST_ADMIN_ID;
	delete process.env["EPISTLE_PANEL_ADMIN_ID_FILE"];
});

/** Run the check with recorders for the warning and the failure. */
async function run() {
	const warnings: string[] = [];
	const failures: string[] = [];
	await checkAdminIdAtStart(
		(message) => warnings.push(message),
		(message) => {
			failures.push(message);
			// `fail` never returns in production; the stand-in must not either.
			throw new Error("exit");
		},
	).catch((error) => {
		if (!(error instanceof Error) || error.message !== "exit") {
			throw error;
		}
	});
	return { warnings, failures };
}

describe("checkAdminIdAtStart", () => {
	it("is silent for a valid id", async () => {
		expect(await run()).toEqual({ warnings: [], failures: [] });
	});

	it("warns once, and does not fail, when no id is set", async () => {
		delete process.env["EPISTLE_PANEL_ADMIN_ID"];

		const { warnings, failures } = await run();

		expect(failures).toEqual([]);
		expect(warnings).toHaveLength(1);
		expect(warnings[0]).toContain("EPISTLE_PANEL_ADMIN_ID is not set");
	});

	it("fails with a message that names the variable and not the value for a malformed id", async () => {
		for (const value of [
			"Not-A-Uuid",
			TEST_ADMIN_ID.toUpperCase(),
			"6ba7b810-9dad-11d1-80b4-00c04fd430c8",
		]) {
			process.env["EPISTLE_PANEL_ADMIN_ID"] = value;

			const { warnings, failures } = await run();

			expect(warnings).toEqual([]);
			expect(failures).toHaveLength(1);
			expect(failures[0]).toContain("EPISTLE_PANEL_ADMIN_ID");
			expect(failures[0]).not.toContain(value);
		}
	});

	it("fails for an id file that cannot be read, naming the variable only", async () => {
		delete process.env["EPISTLE_PANEL_ADMIN_ID"];
		process.env["EPISTLE_PANEL_ADMIN_ID_FILE"] = "/nonexistent/admin-id";

		const { failures } = await run();

		expect(failures).toHaveLength(1);
		expect(failures[0]).toContain("EPISTLE_PANEL_ADMIN_ID_FILE");
		expect(failures[0]).not.toContain("/nonexistent");
	});

	it("by default logs the message and exits with status 1 for a malformed id", async () => {
		process.env["EPISTLE_PANEL_ADMIN_ID"] = "Not-A-Uuid";
		const error = spyOn(console, "error").mockImplementation(() => {});
		const exit = spyOn(process, "exit").mockImplementation((() => {
			throw new Error("exit");
		}) as never);
		try {
			await checkAdminIdAtStart().catch(() => {});

			expect(exit).toHaveBeenCalledWith(1);
			expect(String(error.mock.calls[0]?.[0])).toContain(
				"EPISTLE_PANEL_ADMIN_ID",
			);
			expect(String(error.mock.calls[0]?.[0])).not.toContain(
				"Not-A-Uuid",
			);
		} finally {
			error.mockRestore();
			exit.mockRestore();
		}
	});
});
