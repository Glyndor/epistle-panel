import { describe, expect, it } from "bun:test";

import { createRng } from "@/test/prng";

import { mutatePayload, responseGenerators, responseModels } from ".";

describe("response payload support", () => {
	it("generates payloads its own reference parser accepts, for every schema", () => {
		const rng = createRng(5);
		for (const [name, generate] of Object.entries(responseGenerators)) {
			for (let i = 0; i < 50; i++) {
				const value = generate(rng);
				expect([
					name,
					responseModels[name]?.(value) !== undefined,
				]).toEqual([name, true]);
			}
		}
	});

	it("mutates payloads into ones the reference parser refuses often enough to matter", () => {
		const rng = createRng(6);
		let refused = 0;
		for (let i = 0; i < 200; i++) {
			const value = mutatePayload(responseGenerators.domains?.(rng), rng);
			if (
				responseModels.domains?.(
					JSON.parse(JSON.stringify(value) ?? "null"),
				) === undefined
			) {
				refused++;
			}
		}
		expect(refused).toBeGreaterThan(40);
	});
});
