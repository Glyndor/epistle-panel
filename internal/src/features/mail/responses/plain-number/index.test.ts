import { expect, it } from "bun:test";
import { declaredLength, plainNumber } from ".";

it("parses one through fifteen decimal digits exactly including leading zeros", () => {
	for (const [value, expected] of [
		["0", 0],
		["1", 1],
		["000000000000001", 1],
		["999999999999999", 999999999999999],
	] as const)
		expect(plainNumber(value)).toBe(expected);
});
it("refuses missing nondecimal and overlong numbers", () => {
	for (const value of [
		null,
		"",
		"1e3",
		"0x64",
		"0b10",
		"0o10",
		"+1",
		"-1",
		"1.0",
		" 1 ",
		"1\n",
		"1_0",
		"Infinity",
		"NaN",
		"١",
		"0000000000000001",
	])
		expect([value, plainNumber(value)]).toEqual([value, null]);
});
it("requires a strictly positive declared length", () => {
	for (const value of [null, "", "0", "000", "1e3"])
		expect(declaredLength(value)).toBeNull();
	expect(declaredLength("0001")).toBe(1);
	expect(declaredLength("999999999999999")).toBe(999999999999999);
});
