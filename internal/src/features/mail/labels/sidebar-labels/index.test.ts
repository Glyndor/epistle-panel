import { expect, it } from "bun:test";
import { messageLabels } from "../message-labels";
import { encodeLabelName } from "../name-codec";
import { sidebarLabels } from ".";

it("counts messages once per keyword and sorts names independently of input order", () => {
	const a = messageLabels(["z", "a"]);
	const b = messageLabels(["A", "z"]);
	const result = sidebarLabels([a, [...b, ...b]]);
	expect(result.map(({ name, count }) => [name, count])).toEqual([
		["a", 2],
		["z", 2],
	]);
	expect(result[0]?.keyword).toBe("a");
	expect(sidebarLabels([])).toEqual([]);
	expect(sidebarLabels([[], a]).map(({ name }) => name)).toEqual(["a", "z"]);
});

it("keeps raw and encoded identities with equal names separate with a stable tie break", () => {
	const encoded = encodeLabelName("Work") as string;
	const labels = messageLabels(["Work", encoded, "aaa"]);
	const result = sidebarLabels([labels]);
	expect(result.map(({ keyword, count }) => [keyword, count])).toEqual([
		[encoded, 1],
		["Work", 1],
		["aaa", 1],
	]);
	expect(sidebarLabels([[...labels].reverse()])).toEqual(result);
	expect(labels.map(({ keyword }) => keyword)).toEqual([
		"Work",
		encoded,
		"aaa",
	]);
});
