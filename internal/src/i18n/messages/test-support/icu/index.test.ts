import { describe, expect, it } from "bun:test";

import { icuArguments } from ".";

describe("icuArguments", () => {
	it("lists plain arguments in source order", () => {
		expect(icuArguments("Created {created}, {used} {created}")).toEqual([
			"created",
			"used",
			"created",
		]);
		expect(icuArguments("No arguments here.")).toEqual([]);
	});

	it("tells an argument from the text of a plural arm", () => {
		expect(
			icuArguments(
				"{total, plural, =0 {No rows} one {# row} other {{shown} of # rows}}",
			),
		).toEqual(["total:plural[=0|one|other]", "shown"]);
		// A one-word arm is text, not an argument.
		expect(
			icuArguments("{total, plural, =0 {None} other {# rows}}"),
		).toEqual(["total:plural[=0|other]"]);
	});

	it("reads typed arguments and selects", () => {
		expect(icuArguments("{n, number} {d, date, short}")).toEqual([
			"n:number",
			"d:date",
		]);
		expect(icuArguments("{kind, select, a {x {name}} other {y}}")).toEqual([
			"kind:select[a|other]",
			"name",
		]);
	});

	it("throws on unbalanced braces and malformed arms", () => {
		for (const bad of [
			"{name",
			"name}",
			"{n, plural, one {x}",
			"{n, plural, one x}",
			"{n, plural one {x}}",
			"{n, plural, {x}}",
		]) {
			expect(() => icuArguments(bad)).toThrow();
		}
	});
	it("lists the tags of rich text, once per opening tag, beside the arguments", () => {
		expect(icuArguments("Labels: <names></names>")).toEqual(["<names>"]);
		expect(icuArguments("{count} in <b>bold</b> and <br/>")).toEqual([
			"count",
			"<b>",
			"<br>",
		]);
		// Inside an arm too, where a translation is as likely to lose one.
		expect(
			icuArguments("{n, plural, one {<b>one</b>} other {many}}"),
		).toEqual(["n:plural[one|other]", "<b>"]);
	});

	it("does not take a lone less-than sign or a closing tag for a tag", () => {
		expect(icuArguments("a < b and 1<2")).toEqual([]);
		expect(icuArguments("stray </names>")).toEqual([]);
	});
});
