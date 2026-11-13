import type { Rng } from "@/test/prng";

import type { Json, ResponseModel } from "../payloads";

/**
 * Reference parsers and generators for the per-account response schemas, written
 * from the declared shape of each payload without zod, as the ones in
 * `../payloads` are, so they are an independent oracle.
 */

type Obj = Record<string, unknown>;

const UUID_RE =
	/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|0{8}-0{4}-0{4}-0{4}-0{12}|f{8}-f{4}-f{4}-f{4}-f{12})$/i;

const isObj = (v: unknown): v is Obj =>
	typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";
const isCount = (v: unknown): v is number =>
	typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const isUuid = (v: unknown): v is string => isString(v) && UUID_RE.test(v);

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

/** One-field object holding a string, the shape of `updated`, `removed` and `address`. */
function stringField(key: string): ResponseModel {
	return (v) =>
		isObj(v) && isString(v[key]) ? { [key]: v[key] } : undefined;
}

export const accountResponseModels: Record<string, ResponseModel> = {
	updated: stringField("updated"),
	maskedCreated: stringField("address"),
	maskedRemoved: stringField("removed"),
	displayName: (v) =>
		isObj(v) && (v["display_name"] === null || isString(v["display_name"]))
			? { display_name: v["display_name"] }
			: undefined,
	totpEnrolled: (v) =>
		isObj(v) && isString(v["secret"]) && isString(v["otpauth_uri"])
			? { secret: v["secret"], otpauth_uri: v["otpauth_uri"] }
			: undefined,
	mailboxes: (v) => {
		if (!isObj(v)) {
			return undefined;
		}
		const mailboxes = listOf(v["mailboxes"], (s) =>
			isString(s) ? s : undefined,
		);
		const tree = listOf(v["tree"], (e) =>
			isObj(e) &&
			isString(e["id"]) &&
			isString(e["name"]) &&
			(e["parent_id"] === null || isString(e["parent_id"]))
				? { id: e["id"], name: e["name"], parent_id: e["parent_id"] }
				: undefined,
		);
		return mailboxes && tree && { mailboxes, tree };
	},
	maskedList: (v) => {
		const addresses = isObj(v)
			? listOf(v["addresses"], (a) => {
					if (
						!isObj(a) ||
						!isString(a["address"]) ||
						!isString(a["label"]) ||
						typeof a["enabled"] !== "boolean" ||
						!isCount(a["created_at"])
					) {
						return undefined;
					}
					const last = a["last_used_at"];
					if (last !== undefined && !isCount(last)) {
						return undefined;
					}
					const row = {
						address: a["address"],
						label: a["label"],
						enabled: a["enabled"],
						created_at: a["created_at"],
					};
					return last === undefined
						? row
						: { ...row, last_used_at: last };
				})
			: undefined;
		return addresses && { addresses };
	},
	archiveList: (v) => {
		const entries = isObj(v)
			? listOf(v["entries"], (e) =>
					isObj(e) &&
					isUuid(e["id"]) &&
					isString(e["mailbox"]) &&
					isCount(e["deleted_at"])
						? {
								id: e["id"],
								mailbox: e["mailbox"],
								deleted_at: e["deleted_at"],
							}
						: undefined,
				)
			: undefined;
		return entries && { entries };
	},
	restored: (v) =>
		isObj(v) && isUuid(v["id"]) && isString(v["restored_to"])
			? { id: v["id"], restored_to: v["restored_to"] }
			: undefined,
};

function uuid(rng: Rng): string {
	const h = (n: number) => rng.string("0123456789abcdef", n);
	return `${h(8)}-${h(4)}-4${h(3)}-${rng.pick(Array.from("89ab"))}${h(3)}-${h(12)}`;
}

function word(rng: Rng): string {
	return rng.string("abcdefXYZ019.-_@ é\u{1f600}/", rng.int(0, 12));
}

export const accountResponseGenerators: Record<string, (rng: Rng) => Json> = {
	updated: (rng) => ({ updated: word(rng) }),
	maskedCreated: (rng) => ({ address: word(rng) }),
	maskedRemoved: (rng) => ({ removed: word(rng) }),
	displayName: (rng) => ({ display_name: rng.chance() ? word(rng) : null }),
	totpEnrolled: (rng) => ({ secret: word(rng), otpauth_uri: word(rng) }),
	mailboxes: (rng) => ({
		mailboxes: Array.from({ length: rng.int(0, 4) }, () => word(rng)),
		tree: Array.from({ length: rng.int(0, 4) }, () => ({
			id: word(rng),
			name: word(rng),
			parent_id: rng.chance() ? word(rng) : null,
		})),
	}),
	maskedList: (rng) => ({
		addresses: Array.from({ length: rng.int(0, 4) }, () => {
			const row: { [key: string]: Json } = {
				address: word(rng),
				label: word(rng),
				enabled: rng.chance(),
				created_at: rng.int(0, 1e9),
			};
			if (rng.chance()) {
				row["last_used_at"] = rng.int(0, 1e9);
			}
			return row;
		}),
	}),
	archiveList: (rng) => ({
		entries: Array.from({ length: rng.int(0, 4) }, () => ({
			id: uuid(rng),
			mailbox: word(rng),
			deleted_at: rng.int(0, 1e9),
		})),
	}),
	restored: (rng) => ({ id: uuid(rng), restored_to: word(rng) }),
};
