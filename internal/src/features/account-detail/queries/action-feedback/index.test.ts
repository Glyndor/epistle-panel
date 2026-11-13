import { afterEach, describe, expect, it } from "bun:test";

import { clearToasts } from "@/components/ui/toaster";
import { ActionError } from "@/lib/query/action-result";

import { reportFailure } from ".";

afterEach(clearToasts);

describe("reportFailure", () => {
	it("sends the browser to sign in again when the session ended", () => {
		const original = window.location.assign;
		const targets: string[] = [];
		window.location.assign = ((target: string) => {
			targets.push(target);
		}) as typeof window.location.assign;

		reportFailure(new ActionError("unauthenticated"), "message");

		window.location.assign = original;
		expect(targets).toEqual(["/login"]);
	});

	it("does not leave the page for any other failure", () => {
		const original = window.location.assign;
		const targets: string[] = [];
		window.location.assign = ((target: string) => {
			targets.push(target);
		}) as typeof window.location.assign;

		reportFailure(new ActionError("unavailable"), "message");
		reportFailure(new TypeError("network"), "message");

		window.location.assign = original;
		expect(targets).toEqual([]);
	});
});
