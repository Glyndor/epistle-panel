import { expect } from "bun:test";

import type { Rng } from "@/test/prng";

/**
 * Reference parsers, generators and mutations for the response schemas, shared
 * by the generated-input tests. The parsers are written from the declared shape
 * of each payload, without zod, so they are an independent oracle.
 */

/** A JSON value. */
export type Json =
	| null
	| boolean
	| number
	| string
	| Json[]
	| { [key: string]: Json };
type Obj = Record<string, unknown>;

const UUID_RE =
	/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|0{8}-0{4}-0{4}-0{4}-0{12}|f{8}-f{4}-f{4}-f{4}-f{12})$/i;

function isObj(value: unknown): value is Obj {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reference parsers: the shape each schema declares, written without zod. */
const isString = (v: unknown): v is string => typeof v === "string";
const isCount = (v: unknown): v is number =>
	typeof v === "number" && Number.isSafeInteger(v) && v >= 0;

function listOf<T>(
	value: unknown,
	item: (v: unknown) => T | undefined,
): T[] | undefined {
	if (!Array.isArray(value)) {
		return undefined;
	}
	const out: T[] = [];
	for (const element of value) {
		const parsed = item(element);
		if (parsed === undefined) {
			return undefined;
		}
		out.push(parsed);
	}
	return out;
}

export type ResponseModel = (value: unknown) => unknown | undefined;

export const responseModels: Record<string, ResponseModel> = {
	accounts: (v) => {
		const accounts = isObj(v)
			? listOf(v["accounts"], (a) => {
					const addresses = isObj(a)
						? listOf(a["addresses"], (s) =>
								isString(s) ? s : undefined,
							)
						: undefined;
					return isObj(a) && isString(a["name"]) && addresses
						? { name: a["name"], addresses }
						: undefined;
				})
			: undefined;
		return accounts && { accounts };
	},
	apiError: (v) => {
		const e = isObj(v) ? v["error"] : undefined;
		return isObj(e) && isString(e["code"]) && isString(e["message"])
			? { error: { code: e["code"], message: e["message"] } }
			: undefined;
	},
	verify: (v) =>
		isObj(v) &&
		typeof v["valid"] === "boolean" &&
		typeof v["admin"] === "boolean"
			? { valid: v["valid"], admin: v["admin"] }
			: undefined,
	domains: (v) => {
		const domains = isObj(v)
			? listOf(v["domains"], (s) => (isString(s) ? s : undefined))
			: undefined;
		return domains && { domains };
	},
	queue: (v) => {
		if (!isObj(v)) {
			return undefined;
		}
		const entries = listOf(v["entries"], (e) => {
			const recipients = isObj(e)
				? listOf(e["recipients"], (s) => (isString(s) ? s : undefined))
				: undefined;
			return isObj(e) &&
				isString(e["id"]) &&
				UUID_RE.test(e["id"]) &&
				isString(e["reverse_path"]) &&
				recipients
				? { id: e["id"], reverse_path: e["reverse_path"], recipients }
				: undefined;
		});
		const cursor = v["next_cursor"];
		if (
			!entries ||
			(cursor !== undefined &&
				!(isString(cursor) && UUID_RE.test(cursor)))
		) {
			return undefined;
		}
		return cursor === undefined
			? { entries }
			: { entries, next_cursor: cursor };
	},
	deliveries: (v) => {
		const outcomes = [
			"delivered",
			"deferred",
			"failed",
			"suppressed",
			"canceled",
		];
		const maybeString = (x: unknown) => x === null || isString(x);
		const entries = isObj(v)
			? listOf(v["entries"], (e) => {
					if (!isObj(e)) {
						return undefined;
					}
					const time = e["time"];
					const attempt = e["attempt"];
					return isString(e["spool_id"]) &&
						UUID_RE.test(e["spool_id"]) &&
						typeof time === "number" &&
						Number.isSafeInteger(time) &&
						time >= 0 &&
						time <= 253_402_300_799 &&
						typeof attempt === "number" &&
						Number.isSafeInteger(attempt) &&
						attempt >= 0 &&
						maybeString(e["account"]) &&
						isString(e["from"]) &&
						isString(e["recipient"]) &&
						isString(e["outcome"]) &&
						outcomes.includes(e["outcome"]) &&
						maybeString(e["remote"]) &&
						maybeString(e["reply"])
						? {
								time,
								spool_id: e["spool_id"],
								account: e["account"],
								from: e["from"],
								recipient: e["recipient"],
								outcome: e["outcome"],
								remote: e["remote"],
								reply: e["reply"],
								attempt,
							}
						: undefined;
				})
			: undefined;
		return entries && { entries };
	},
	suppression: (v) => {
		if (!isObj(v)) {
			return undefined;
		}
		const addresses = listOf(v["addresses"], (s) =>
			isString(s) ? s : undefined,
		);
		const cursor = v["next_cursor"];
		if (!addresses || (cursor !== undefined && !isString(cursor))) {
			return undefined;
		}
		return cursor === undefined
			? { addresses }
			: { addresses, next_cursor: cursor };
	},
	removedAddress: (v) =>
		isObj(v) && isString(v["removed"])
			? { removed: v["removed"] }
			: undefined,
	removed: (v) =>
		isObj(v) && isString(v["removed"]) && UUID_RE.test(v["removed"])
			? { removed: v["removed"] }
			: undefined,
	status: (v) =>
		isObj(v) &&
		isString(v["version"]) &&
		isCount(v["domains"]) &&
		isCount(v["accounts"]) &&
		isCount(v["queue_size"])
			? {
					version: v["version"],
					domains: v["domains"],
					accounts: v["accounts"],
					queue_size: v["queue_size"],
				}
			: undefined,
};

function uuid(rng: Rng): string {
	const h = (n: number) => rng.string("0123456789abcdef", n);
	return `${h(8)}-${h(4)}-${rng.pick(Array.from("12345678"))}${h(3)}-${rng.pick(Array.from("89ab"))}${h(3)}-${h(12)}`;
}

function word(rng: Rng): string {
	return rng.string("abcdefXYZ019.-_@ é\u{1f600}", rng.int(0, 12));
}

export const responseGenerators: Record<string, (rng: Rng) => Json> = {
	accounts: (rng) => ({
		accounts: Array.from({ length: rng.int(0, 4) }, () => ({
			name: word(rng),
			addresses: Array.from({ length: rng.int(0, 3) }, () => word(rng)),
		})),
	}),
	apiError: (rng) => ({ error: { code: word(rng), message: word(rng) } }),
	verify: (rng) => ({ valid: rng.chance(), admin: rng.chance() }),
	domains: (rng) => ({
		domains: Array.from({ length: rng.int(0, 5) }, () => word(rng)),
	}),
	queue: (rng) => {
		const page: { [key: string]: Json } = {
			entries: Array.from({ length: rng.int(0, 4) }, () => ({
				id: uuid(rng),
				reverse_path: word(rng),
				recipients: Array.from({ length: rng.int(0, 3) }, () =>
					word(rng),
				),
			})),
		};
		if (rng.chance()) {
			page["next_cursor"] = uuid(rng);
		}
		return page;
	},
	deliveries: (rng) => ({
		entries: Array.from({ length: rng.int(0, 3) }, () => ({
			time: rng.int(0, 2_000_000_000),
			spool_id: uuid(rng),
			account: rng.chance() ? word(rng) : null,
			from: word(rng),
			recipient: word(rng),
			outcome: rng.pick([
				"delivered",
				"deferred",
				"failed",
				"suppressed",
				"canceled",
			]),
			remote: rng.chance() ? word(rng) : null,
			reply: rng.chance() ? word(rng) : null,
			attempt: rng.int(0, 9),
		})),
	}),
	suppression: (rng) => {
		const page: { [key: string]: Json } = {
			addresses: Array.from({ length: rng.int(0, 4) }, () => word(rng)),
		};
		if (rng.chance()) {
			page["next_cursor"] = word(rng);
		}
		return page;
	},
	removedAddress: (rng) => ({ removed: word(rng) }),
	removed: (rng) => ({ removed: uuid(rng) }),
	status: (rng) => ({
		version: word(rng),
		domains: rng.int(0, 1e6),
		accounts: rng.int(0, 1e6),
		queue_size: rng.int(0, 1e6),
	}),
};

/** Values a field is swapped for: wrong types, edge numbers and uuid near misses. */
function wrongValue(rng: Rng): unknown {
	return rng.pick<() => unknown>([
		() => null,
		() => true,
		() => 0,
		() => -1,
		() => 1.5,
		() => 2 ** 53,
		() => 1e300,
		() => "5",
		() => "",
		() => [],
		() => ["a"],
		() => ({}),
		() => ({ a: 1 }),
		() => "00000000-0000-0000-0000-000000000000",
		() => "ffffffff-ffff-ffff-ffff-ffffffffffff",
		() => "00000000-0000-0000-0000-00000000000",
		() => "{12345678-1234-4234-8234-123456789012}",
		() => "12345678-1234-0234-8234-123456789012",
		() => "12345678-1234-9234-8234-123456789012",
		() => "12345678-1234-4234-0234-123456789012",
		() => "12345678-1234-4234-c234-123456789012",
		() => "12345678-1234-4234-8234-12345678901g",
		() => "12345678-1234-4234-8234-123456789012\n",
		() => "ABCDEF12-1234-4234-8234-123456789012",
		() => Array.from({ length: rng.int(1, 3) }, () => wrongValue(rng)),
	])();
}

function nested(depth: number): unknown {
	let value: unknown = [];
	for (let i = 0; i < depth; i++) {
		value = [value];
	}
	return value;
}

/** Collect every object and array in `tree`, to pick a spot to mutate. */
function containers(
	tree: unknown,
	out: (Obj | unknown[])[] = [],
): (Obj | unknown[])[] {
	if (Array.isArray(tree)) {
		out.push(tree);
		for (const item of tree) {
			containers(item, out);
		}
	} else if (isObj(tree)) {
		out.push(tree);
		for (const item of Object.values(tree)) {
			containers(item, out);
		}
	}
	return out;
}

function setOwn(target: Obj, key: string, value: unknown): void {
	Object.defineProperty(target, key, {
		value,
		enumerable: true,
		configurable: true,
		writable: true,
	});
}

/** Apply one random mutation somewhere in `tree`; the root may be replaced. */
export function mutatePayload(tree: unknown, rng: Rng): unknown {
	const spots = containers(tree);
	if (spots.length === 0) {
		return tree;
	}
	const spot = rng.pick(spots);
	const op = rng.int(0, 7);
	if (op === 0) {
		return wrongValue(rng);
	}
	if (isObj(spot)) {
		const keys = Object.keys(spot);
		if (op === 1 && keys.length > 0) {
			delete spot[rng.pick(keys)];
		} else if (op === 2 && keys.length > 0) {
			setOwn(spot, rng.pick(keys), wrongValue(rng));
		} else if (op === 3) {
			const key = rng.pick([
				"__proto__",
				"constructor",
				"prototype",
				"toString",
				"hasOwnProperty",
				"extra",
			]);
			setOwn(
				spot,
				key,
				rng.pick<unknown>([
					{ polluted: true },
					{ constructor: { prototype: { polluted: true } } },
					[],
					null,
					1,
				]),
			);
		} else if (op === 4) {
			setOwn(spot, "deep", nested(rng.int(50, 3000)));
		} else if (op === 5 && keys.length > 0) {
			const key = rng.pick(keys);
			setOwn(
				spot,
				key.toUpperCase() === key
					? key.toLowerCase()
					: key.toUpperCase(),
				spot[key],
			);
			delete spot[key];
		} else if (keys.length > 0) {
			setOwn(spot, rng.pick(keys), undefined);
		}
	} else if (spot.length > 0 || op === 6) {
		if (op === 6) {
			// Repeat a small element only, so nested copies cannot multiply.
			const first = spot[0];
			const small =
				first !== undefined && JSON.stringify(first).length < 120;
			const item = small ? first : "x";
			const copies = rng.chance(0.3) ? 4000 : 20;
			for (let i = 0; i < copies; i++) {
				spot.push(item);
			}
		} else {
			spot[rng.int(0, spot.length - 1)] = wrongValue(rng);
		}
	}
	return tree;
}

const PROTOTYPES = [Object.prototype, Array.prototype, Function.prototype];
const baseline = PROTOTYPES.map((p) =>
	Object.getOwnPropertyNames(p).sort().join(","),
);

export function expectPrototypesClean(): void {
	PROTOTYPES.forEach((p, i) => {
		expect(Object.getOwnPropertyNames(p).sort().join(",")).toBe(
			baseline[i as number] as string,
		);
	});
	expect(({} as Obj)["polluted"]).toBeUndefined();
	expect(([] as unknown as Obj)["polluted"]).toBeUndefined();
}
