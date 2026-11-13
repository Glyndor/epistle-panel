import { describe, expect, it } from "bun:test";

import { firstUnreachable } from ".";

/** A read the test answers by hand. */
function read() {
	let answer: (unreachable: boolean) => void = () => {};
	let fail: (error: Error) => void = () => {};
	const promise = new Promise<boolean>((resolve, reject) => {
		answer = resolve;
		fail = reject;
	});
	return { promise, answer, fail };
}

/** What a promise has resolved to so far, or `"waiting"`. */
async function stateOf(
	promise: Promise<boolean>,
): Promise<boolean | "waiting"> {
	let state: boolean | "waiting" = "waiting";
	void promise.then((value) => {
		state = value;
	});
	// A turn of the event loop: every promise already answered has run.
	await new Promise((resolve) => setImmediate(resolve));
	return state;
}

describe("firstUnreachable", () => {
	it("is false once every read has answered", async () => {
		const [a, b] = [read(), read()];
		const result = firstUnreachable([a.promise, b.promise]);

		a.answer(false);
		expect(await stateOf(result)).toBe("waiting");
		b.answer(false);
		expect(await stateOf(result)).toBe(false);
	});

	it("is true at the first read that failed, without waiting for the others", async () => {
		const [slow, failed] = [read(), read()];
		const result = firstUnreachable([slow.promise, failed.promise]);

		failed.answer(true);

		// The slow read never answers in this test.
		expect(await stateOf(result)).toBe(true);
	});

	it("stays true when a later read answers", async () => {
		const [a, b] = [read(), read()];
		const result = firstUnreachable([a.promise, b.promise]);

		a.answer(true);
		b.answer(false);

		expect(await result).toBe(true);
	});

	it("is true when the last read is the one that failed", async () => {
		const [a, b] = [read(), read()];
		const result = firstUnreachable([a.promise, b.promise]);

		a.answer(false);
		b.answer(true);

		expect(await result).toBe(true);
	});

	it("counts a read that rejects as failed", async () => {
		const [a, b] = [read(), read()];
		const result = firstUnreachable([a.promise, b.promise]);

		a.fail(new Error("refused"));

		expect(await stateOf(result)).toBe(true);
	});

	it("has nothing to fail with no read", async () => {
		expect(await firstUnreachable([])).toBe(false);
	});
});
