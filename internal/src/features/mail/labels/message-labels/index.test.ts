import { expect, it } from "bun:test";
import { labelTone } from "../label-tone";
import { encodeLabelName } from "../name-codec";
import { messageLabels } from ".";

it("removes all system prefixes, including the standard system keywords", () => {
	const system = [
		"seen",
		"flagged",
		"draft",
		"answered",
		"forwarded",
		"junk",
		"notjunk",
		"important",
		"phishing",
		"mdnsent",
		"future",
	];
	expect(
		messageLabels(
			system.flatMap((name) => [
				`$${name}`,
				`$${name.toUpperCase()}`,
				`\\${name}`,
			]),
		),
	).toEqual([]);
});

it("decodes exact names, keeps unknown keywords raw and removable, and ignores invalid atoms", () => {
	const name = "  An\u0303o 🔥 ";
	const keyword = encodeLabelName(name) as string;
	expect(
		messageLabels([
			keyword,
			"Work_items",
			"ep1-ff",
			"Junk",
			"bad atom",
			"é",
			"x".repeat(65),
			"",
		]),
	).toEqual([
		{ keyword, name, raw: false, tone: labelTone(name) },
		{
			keyword: "Work_items",
			name: "Work_items",
			raw: true,
			tone: labelTone("Work_items"),
		},
		{
			keyword: "ep1-ff",
			name: "ep1-ff",
			raw: true,
			tone: labelTone("ep1-ff"),
		},
		{ keyword: "Junk", name: "Junk", raw: true, tone: labelTone("Junk") },
	]);
	expect(messageLabels([])).toEqual([]);
});

it("deduplicates keyword case while keeping the original removal identity", () => {
	const keyword = encodeLabelName("Work") as string;
	expect(
		messageLabels([keyword, keyword.toUpperCase(), "Raw", "RAW"]).map(
			(label) => label.keyword,
		),
	).toEqual([keyword, "Raw"]);
});

it("hashes the exact name deterministically with all eight tones well spread", () => {
	const counts = Array<number>(8).fill(0);
	for (let n = 0; n < 800; n++) {
		const name = `label-${n}`;
		const first = messageLabels([encodeLabelName(name) as string])[0];
		expect(first?.tone).toBe(labelTone(name));
		expect(messageLabels([encodeLabelName(name) as string])[0]).toEqual(
			first,
		);
		counts[(first?.tone ?? 0) - 1] =
			(counts[(first?.tone ?? 0) - 1] ?? 0) + 1;
	}
	for (const count of counts) expect(count).toBeGreaterThan(70);
	expect(messageLabels([encodeLabelName("work") as string])[0]?.tone).toBe(1);
});
