import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { type Rng, runCases } from "@/test/prng";

import {
	admitAttempt,
	FREE_ATTEMPTS,
	resetLoginLimiter,
	trackedNames,
} from ".";

const NOW = 1_700_000_000_000;

beforeEach(resetLoginLimiter);
afterEach(resetLoginLimiter);

/** Spellings that Unicode compatibility folding maps to the plain text beside them. */
const COMPAT: [plain: string, variants: string[]][] = [
	["a", ["A", "ª", "ａ", "Ａ"]],
	["k", ["K", "K", "ｋ", "Ｋ"]],
	["fi", ["ﬁ", "FI", "ｆｉ"]],
	["iv", ["ⅳ", "Ⅳ", "IV"]],
	["2", ["²", "２", "₂", "②"]],
	["kg", ["㎏", "KG", "ｋｇ"]],
	["å", ["å", "Å", "Å", "Å"]],
	["é", ["é", "É", "É"]],
	["ñ", ["ñ", "Ñ"]],
	["ṩ", ["ṩ", "ṩ", "Ṩ"]],
	["...", ["…"]],
	["(1)", ["⑴"]],
];
const PLAIN = "bcdeghjlmnopqrstuvwxyz013456789-_.@";
const PADDING = [" ", "\t", "\n", "\r", " ", " ", "　", "﻿", " "];

/** One base name as a list of units, each with the spellings that fold to it. */
function baseName(rng: Rng): { plain: string; variants: string[] }[] {
	return Array.from({ length: rng.int(1, 10) }, () => {
		if (rng.chance(0.4)) {
			const [plain, variants] = rng.pick(COMPAT);
			return { plain, variants: [plain, ...variants] };
		}
		const ch = rng.string(PLAIN, 1);
		return { plain: ch, variants: [ch, ch.toUpperCase()] };
	});
}

function spell(units: { variants: string[] }[], rng: Rng): string {
	const body = units.map((u) => rng.pick(u.variants)).join("");
	const pad = () =>
		rng.string(PADDING.join(""), rng.chance(0.5) ? rng.int(1, 4) : 0);
	return pad() + body + pad();
}

/** Admit `name` and free its slot, returning whether it was let in. */
function admit(name: string, at = NOW): boolean {
	const result = admitAttempt(name, at);
	if (result.allowed) {
		result.settle("error", at);
	}
	return result.allowed;
}

describe("login limiter keys on generated names", () => {
	it("counts every spelling of one name against the same counter", async () => {
		await runCases("equivalent spellings", 1500, (rng) => {
			resetLoginLimiter();
			const units = baseName(rng);
			// FREE_ATTEMPTS pass, the next one is admitted and sets the lock, the
			// one after is refused: only possible if every spelling hit one record.
			for (let i = 0; i < FREE_ATTEMPTS + 1; i++) {
				expect(admit(spell(units, rng))).toBe(true);
			}
			expect(trackedNames()).toBe(1);
			const refused = admitAttempt(spell(units, rng), NOW);
			expect(refused.allowed).toBe(false);
			if (!refused.allowed) {
				expect(refused.retryAfterMs).toBeGreaterThan(0);
			}
		});
	});

	it("keeps different names apart, however alike they look", async () => {
		await runCases("different names", 1500, (rng) => {
			resetLoginLimiter();
			const units = baseName(rng);
			const other = units.map((u) => ({ ...u }));
			// Change one unit to a plain letter that no folding turns into the old one.
			const at = rng.int(0, other.length - 1);
			const old = (other[at] as { plain: string }).plain;
			let ch = rng.string("bcdeghjlmnopqrstuvwxyz013456789", 1);
			while (old.includes(ch) || ch === old) {
				ch = rng.string("bcdeghjlmnopqrstuvwxyz013456789", 1);
			}
			other[at] = { plain: ch, variants: [ch, ch.toUpperCase()] };
			const first = spell(units, rng);
			const second = spell(other, rng);
			if (first.trim().toLowerCase() === second.trim().toLowerCase()) {
				return;
			}
			for (let i = 0; i < FREE_ATTEMPTS + 2; i++) {
				admit(first);
			}
			// The first name is locked; the second has not been counted at all.
			expect(admitAttempt(first, NOW).allowed).toBe(false);
			for (let i = 0; i < FREE_ATTEMPTS + 1; i++) {
				expect(admit(second)).toBe(true);
			}
			expect(trackedNames()).toBe(2);
		});
	});

	it("does not let padding or case turn one name into two, nor merge two names", () => {
		for (const [a, b, same] of [
			["admin", "  ADMIN　", true],
			["admin", "ａｄｍｉｎ", true],
			["jürgen", "JÜRGEN", true],
			["admin", "admin1", false],
			["admin", "admın", false],
			["admin", "ad min", false],
			["admin", "admin​", false],
		] as const) {
			resetLoginLimiter();
			admit(a);
			admit(b);
			expect([a, b, trackedNames() === 1]).toEqual([a, b, same]);
		}
	});

	it("keys on the first 256 characters only, as documented", () => {
		const stem = "n".repeat(255);
		resetLoginLimiter();
		admit(`${stem}a`);
		admit(`${stem}b`);
		expect(trackedNames()).toBe(2);
		resetLoginLimiter();
		admit(`${stem}na`);
		admit(`${stem}nb`);
		expect(trackedNames()).toBe(1);
	});
});
