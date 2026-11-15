import { describe, expect, it } from "bun:test";

import { openLazily } from ".";

describe("openLazily", () => {
	it("hands over what loaded, and does not say it failed", async () => {
		const seen: string[] = [];
		await openLazily(
			async () => "code",
			(value) => seen.push(`loaded:${value}`),
			() => seen.push("failed"),
		);
		expect(seen).toEqual(["loaded:code"]);
	});

	it("says it failed, hands nothing over, and does not throw", async () => {
		const seen: string[] = [];
		await openLazily(
			async () => {
				throw new Error("ChunkLoadError");
			},
			() => seen.push("loaded"),
			() => seen.push("failed"),
		);
		expect(seen).toEqual(["failed"]);
	});

	it("asks for the code again on the next call, so a returned network is enough", async () => {
		let calls = 0;
		const load = async () => {
			calls++;
			if (calls === 1) {
				throw new Error("offline");
			}
			return "code";
		};
		const seen: string[] = [];
		const opened = (value: string) => seen.push(`loaded:${value}`);
		const failed = () => seen.push("failed");

		await openLazily(load, opened, failed);
		await openLazily(load, opened, failed);

		expect(calls).toBe(2);
		expect(seen).toEqual(["failed", "loaded:code"]);
	});

	it("does not take a failure in the handover for a failure to load", async () => {
		const seen: string[] = [];
		await expect(
			openLazily(
				async () => "code",
				() => {
					throw new Error("the handover broke");
				},
				() => seen.push("failed"),
			),
		).rejects.toThrow("the handover broke");
		expect(seen).toEqual([]);
	});
});
