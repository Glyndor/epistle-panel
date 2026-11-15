import { describe, expect, it } from "bun:test";

import { LABEL_NAME_MAX } from "@/features/mail/labels/name-codec";
import type { LabelView } from "@/features/mail/schemas/mail-view";
import {
	checkOf,
	creation,
	knownLabels,
	labelOptions,
	rememberLabels,
} from ".";

const label = (name: string, keyword = name): LabelView => ({
	keyword,
	name,
	tone: 1,
});
const WORK = label("Work");
const HOME = label("Home");
const ZED = label("Zed");

describe("knownLabels", () => {
	it("joins the labels seen in the loaded messages and the ones on the targets, by name", () => {
		const known = knownLabels(
			[[{ id: "a", labels: [WORK, ZED] }], [{ id: "b", labels: [WORK] }]],
			[[HOME]],
		);
		expect(known.map((one) => one.name)).toEqual(["Home", "Work", "Zed"]);
	});

	it("holds two spellings of one keyword as one label and offers a label of a target that no list shows", () => {
		const known = knownLabels(
			[[{ id: "a", labels: [WORK] }]],
			[[label("Work", "WORK"), HOME]],
		);
		expect(known.map((one) => one.keyword)).toEqual(["Home", "Work"]);
		expect(knownLabels([], [])).toEqual([]);
	});
});

describe("checkOf", () => {
	it("says all, some or none of the targets carry the label", () => {
		expect(checkOf(WORK, [[WORK], [WORK, HOME]])).toBe("all");
		expect(checkOf(WORK, [[WORK], [HOME]])).toBe("some");
		expect(checkOf(WORK, [[HOME], []])).toBe("none");
		expect(checkOf(WORK, [])).toBe("none");
	});

	it("finds the label without regard to the case of its keyword, as the server does", () => {
		expect(checkOf(WORK, [[label("Work", "WORK")]])).toBe("all");
	});
});

describe("labelOptions", () => {
	const known = [HOME, WORK, label("Network")];

	it("keeps the labels whose name holds the text, without regard to case or to spaces at its ends", () => {
		expect(
			labelOptions(known, [[WORK]], "  WOR ").map((o) => o.label.name),
		).toEqual(["Work", "Network"]);
		expect(labelOptions(known, [], "zzz")).toEqual([]);
	});

	it("lists everything for no text, each with how much of the selection carries it", () => {
		expect(
			labelOptions(known, [[WORK], [WORK, HOME]], "").map((o) => [
				o.label.name,
				o.check,
			]),
		).toEqual([
			["Home", "some"],
			["Work", "all"],
			["Network", "none"],
		]);
	});
});

describe("creation", () => {
	const known = [WORK];

	it("offers the exact text, spaces and case included", () => {
		expect(creation("work", known)).toEqual({ kind: "ok", name: "work" });
		expect(creation(" Work", known)).toEqual({
			kind: "ok",
			name: " Work",
		});
	});

	it("offers nothing for nothing, a blank, or a name that already is a label", () => {
		expect(creation("", known)).toEqual({ kind: "none" });
		expect(creation("   ", known)).toEqual({ kind: "none" });
		expect(creation("Work", known)).toEqual({ kind: "none" });
	});

	it("offers nothing for a name that would show as nothing or cannot be kept", () => {
		expect(creation("​", known)).toEqual({ kind: "none" });
		expect(creation("\ud800", known)).toEqual({ kind: "none" });
	});

	it("offers nothing for a name with a control or a direction mark in it, not even a length message", () => {
		for (const hidden of ["\u202e", "\u2066", "\t", "\u200f", "\u0000"]) {
			expect(creation(`x${hidden}yz`, known)).toEqual({ kind: "none" });
		}
	});

	it("says a name is too long, by its bytes, at the limit and a byte over it", () => {
		expect(creation("a".repeat(LABEL_NAME_MAX), known).kind).toBe("ok");
		expect(creation("a".repeat(LABEL_NAME_MAX + 1), known)).toEqual({
			kind: "tooLong",
			bytes: LABEL_NAME_MAX + 1,
		});
		// Within the limit in characters, over it in bytes.
		expect(creation("ñ".repeat(LABEL_NAME_MAX), known)).toEqual({
			kind: "tooLong",
			bytes: LABEL_NAME_MAX * 2,
		});
	});
});

describe("rememberLabels", () => {
	it("keeps a label that left the current ones, so it can be put back", () => {
		const kept = rememberLabels([], [HOME, WORK]);
		expect(kept.map((one) => one.name)).toEqual(["Home", "Work"]);
		expect(rememberLabels(kept, [HOME]).map((one) => one.name)).toEqual([
			"Home",
			"Work",
		]);
	});

	it("adds a label that is new, in its place by name, and holds spellings of a keyword as one", () => {
		const kept = rememberLabels([WORK], [ZED, label("Work", "WORK"), HOME]);
		expect(kept.map((one) => one.keyword)).toEqual(["Home", "Work", "Zed"]);
	});

	it("answers the very array it was given when nothing is new, so a render can compare by identity", () => {
		const kept = [HOME, WORK];
		expect(rememberLabels(kept, [WORK])).toBe(kept);
		expect(rememberLabels(kept, [])).toBe(kept);
	});
});
