import { describe, expect, it } from "bun:test";

import { messageListInputSchema } from "@/features/mail/schemas/mail-input";
import { type Rng, runCases } from "@/test/prng";

import {
	CONDITION_NAMES,
	conditionDaySchema,
	conditionLabelSchema,
	conditionsToQuery,
	conditionTextSchema,
	EMPTY_CONDITIONS,
	hasConditions,
	LIST_ORDERS,
	type ListConditions,
	listConditionsSchema,
	parseListConditions,
	withoutCondition,
} from ".";

const char = (code: number) => String.fromCodePoint(code);

/**
 * Characters a search may hold, chosen to stress the address: the ones a query
 * string gives a meaning to, white space, letters outside ASCII written
 * composed and decomposed, a pair of surrogates, a text-direction override,
 * and the controls and separators the rule refuses.
 */
const TEXT_ALPHABET = [
	..."abcXYZ019 &=?#+%/;.",
	"ñ",
	"é",
	`e${char(0x301)}`,
	"漢",
	char(0x1f600),
	char(0x202e),
	char(0xa0),
	char(0x09),
	char(0x0a),
	char(0x00),
	char(0x7f),
	char(0x2028),
	char(0x2029),
];
const REFUSED = new Set([0x09, 0x0a, 0x00, 0x7f, 0x2028, 0x2029].map(char));
const KEPT_ALPHABET = TEXT_ALPHABET.filter((part) => !REFUSED.has(part));

/** Text of any length around the limit, with or without a refused character. */
function rawText(rng: Rng, alphabet = TEXT_ALPHABET): string {
	const length = rng.chance(0.3) ? rng.int(195, 205) : rng.int(0, 30);
	let text = "";
	while (text.length < length) {
		text += rng.pick(alphabet);
	}
	return text;
}

/** A text condition as the schema keeps it, or none. */
function text(rng: Rng): string {
	if (rng.chance(0.3)) {
		return "";
	}
	const parsed = conditionTextSchema.safeParse(rawText(rng, KEPT_ALPHABET));
	return parsed.success ? parsed.data : "";
}

function rawDay(rng: Rng): string {
	const pad = (value: number, width: number) =>
		String(value).padStart(width, "0");
	return `${pad(rng.int(1965, 9999), 4)}-${pad(rng.int(0, 13), 2)}-${pad(rng.int(0, 32), 2)}`;
}

function day(rng: Rng): string | null {
	if (rng.chance(0.3)) {
		return null;
	}
	const raw = rawDay(rng);
	return conditionDaySchema.safeParse(raw).success ? raw : null;
}

const LABEL_ALPHABET = "abcXYZ019_.-+!~'&=?#$";

function rawLabel(rng: Rng): string {
	return rng.chance(0.2)
		? rng.pick(["$seen", "Junk", "", "a b", "x".repeat(65)])
		: rng.string(LABEL_ALPHABET, rng.int(1, 66));
}

function label(rng: Rng): string | null {
	if (rng.chance(0.3)) {
		return null;
	}
	const raw = rawLabel(rng);
	return conditionLabelSchema.safeParse(raw).success ? raw : null;
}

/** A valid set of conditions: built through the schemas, with an ordered range. */
function conditions(rng: Rng): ListConditions {
	let [after, before] = [day(rng), day(rng)];
	if (after !== null && before !== null && after > before) {
		[after, before] = [before, after];
	}
	return {
		q: text(rng),
		from: text(rng),
		to: text(rng),
		subject: text(rng),
		after,
		before,
		label: label(rng),
		order: rng.pick(LIST_ORDERS),
	};
}

describe("conditionsToQuery and parseListConditions", () => {
	it("read back every valid set of conditions with nothing rejected", async () => {
		const seen = { text: 0, day: 0, label: 0, order: 0, none: 0 };
		await runCases("round trip", 3000, (rng) => {
			const written = conditions(rng);
			const query = conditionsToQuery(written);
			expect(parseListConditions(Object.fromEntries(query))).toEqual({
				conditions: written,
				rejected: [],
			});
			// The same through an encoded address, as a link or a form sends it.
			const address = new URLSearchParams(query).toString();
			expect(
				parseListConditions(
					Object.fromEntries(new URLSearchParams(address)),
				),
			).toEqual({ conditions: written, rejected: [] });

			seen.text += written.q === "" ? 0 : 1;
			seen.day +=
				written.after !== null && written.before !== null ? 1 : 0;
			seen.label += written.label === null ? 0 : 1;
			seen.order += written.order === "newest" ? 0 : 1;
			seen.none += query.length === 0 ? 1 : 0;
		});
		// Each kind of condition must be exercised, or the property is vacuous.
		expect(seen.text).toBeGreaterThan(500);
		expect(seen.day).toBeGreaterThan(200);
		expect(seen.label).toBeGreaterThan(500);
		expect(seen.order).toBeGreaterThan(1000);
		expect(seen.none).toBeGreaterThan(0);
	});

	it("are what the strict schema accepts and gives back unchanged", async () => {
		await runCases("schema fixed point", 1000, (rng) => {
			const written = conditions(rng);
			expect(listConditionsSchema.parse(written)).toEqual(written);
		});
	});

	it("take off one condition at a time and still read back", async () => {
		await runCases("without one", 500, (rng) => {
			const written = conditions(rng);
			const name = rng.pick(CONDITION_NAMES);
			const left = withoutCondition(written, name);
			expect(left[name]).toBe(EMPTY_CONDITIONS[name]);
			expect(listConditionsSchema.parse(left)).toEqual(left);
			expect(
				parseListConditions(
					Object.fromEntries(conditionsToQuery(left)),
				),
			).toEqual({ conditions: left, rejected: [] });
		});
	});
});

describe("parseListConditions over anything an address holds", () => {
	it("gives conditions the strict schema accepts, and rejects only what was given", async () => {
		const seen = { rejected: 0, kept: 0 };
		await runCases("any query", 3000, (rng) => {
			const raw: Record<string, string | string[]> = {};
			for (const name of CONDITION_NAMES) {
				if (rng.chance(0.5)) {
					continue;
				}
				const value =
					name === "after" || name === "before"
						? rawDay(rng)
						: name === "label"
							? rawLabel(rng)
							: name === "order"
								? rng.pick([...LIST_ORDERS, "biggest", ""])
								: rawText(rng);
				raw[name] = rng.chance(0.1) ? [value, rawText(rng)] : value;
			}
			const parsed = parseListConditions(raw);
			expect(listConditionsSchema.parse(parsed.conditions)).toEqual(
				parsed.conditions,
			);
			for (const name of parsed.rejected) {
				const given = raw[name];
				expect([name, given !== undefined && given !== ""]).toEqual([
					name,
					true,
				]);
			}
			seen.rejected += parsed.rejected.length > 0 ? 1 : 0;
			seen.kept += hasConditions(parsed.conditions) ? 1 : 0;
		});
		expect(seen.rejected).toBeGreaterThan(500);
		expect(seen.kept).toBeGreaterThan(500);
	});
});

describe("a text condition", () => {
	it("follows the rule the list's q has always had", async () => {
		const seen = { accepted: 0, refused: 0 };
		await runCases("same as q", 4000, (rng) => {
			const raw = rawText(rng);
			const ours = conditionTextSchema.safeParse(raw);
			const listQ = messageListInputSchema.shape.q.safeParse(raw);
			expect([raw, ours.success, ours.data]).toEqual([
				raw,
				listQ.success,
				listQ.data,
			]);
			if (ours.success) {
				seen.accepted++;
			} else {
				seen.refused++;
			}
		});
		expect(seen.accepted).toBeGreaterThan(500);
		expect(seen.refused).toBeGreaterThan(500);
	});

	it("is refused for a character the rule names", () => {
		for (const refused of REFUSED) {
			expect(conditionTextSchema.safeParse(`a${refused}b`).success).toBe(
				false,
			);
		}
	});
});
