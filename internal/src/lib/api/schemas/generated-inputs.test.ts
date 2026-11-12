import { describe, expect, it } from "bun:test";
import { ZodError, type z } from "zod";

import { type Rng, runCases } from "@/test/prng";

import {
	expectPrototypesClean,
	type Json,
	mutatePayload,
	type ResponseModel,
	responseGenerators,
	responseModels,
} from "../test-support/payloads";
import {
	accountsSchema,
	apiErrorSchema,
	deliveriesSchema,
	domainsSchema,
	queuePageSchema,
	removedAddressSchema,
	removedSchema,
	statusSchema,
	suppressionPageSchema,
	verifyResultSchema,
} from ".";

type Obj = Record<string, unknown>;

const schemas: Record<string, z.ZodType> = {
	accounts: accountsSchema,
	apiError: apiErrorSchema,
	verify: verifyResultSchema,
	domains: domainsSchema,
	queue: queuePageSchema,
	suppression: suppressionPageSchema,
	deliveries: deliveriesSchema,
	removedAddress: removedAddressSchema,
	removed: removedSchema,
	status: statusSchema,
};

describe("response schemas on generated payloads", () => {
	for (const name of Object.keys(schemas)) {
		it(`${name}: parses into the declared shape or throws ZodError, and pollutes nothing`, async () => {
			const schema = schemas[name] as z.ZodType;
			const model = responseModels[name] as ResponseModel;
			const generate = responseGenerators[name] as (rng: Rng) => Json;
			let accepted = 0;
			let refused = 0;
			await runCases(`schema ${name}`, 900, (rng) => {
				let value: unknown = generate(rng);
				const mutations = rng.int(0, 3);
				// Parsing the text back is what the client does with a response,
				// and it is what turns a `__proto__` key into an own property.
				for (let i = 0; i < mutations; i++) {
					value = mutatePayload(value, rng);
				}
				const text = JSON.stringify(value);
				const input: unknown =
					text === undefined ? undefined : JSON.parse(text);
				const want = model(input);
				if (want !== undefined) {
					accepted++;
					expect(schema.parse(input)).toEqual(want);
					const parsed = schema.parse(input) as Obj;
					expect(Object.getPrototypeOf(parsed)).toBe(
						Object.prototype,
					);
				} else {
					refused++;
					expect(schema.safeParse(input).success).toBe(false);
					let thrown: unknown;
					try {
						schema.parse(input);
					} catch (error) {
						thrown = error;
					}
					expect(thrown).toBeInstanceOf(ZodError);
				}
				expectPrototypesClean();
			});
			expect(accepted).toBeGreaterThan(100);
			expect(refused).toBeGreaterThan(100);
		});
	}

	it("ignores a __proto__ key in the text of a response", () => {
		const text =
			'{"__proto__":{"polluted":true},"domains":["a.example"],"constructor":{"prototype":{"polluted":true}}}';
		expect(domainsSchema.parse(JSON.parse(text))).toEqual({
			domains: ["a.example"],
		});
		expectPrototypesClean();
	});
});
