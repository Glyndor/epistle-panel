import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { patternMismatch } from ".";

afterEach(cleanup);

describe("patternMismatch", () => {
	it("matches the whole value, not a part of it", () => {
		expect(patternMismatch("[a-z]+", "abc")).toBe(false);
		expect(patternMismatch("[a-z]+", "abc1")).toBe(true);
		expect(patternMismatch("a|b", "ab")).toBe(true);
	});

	it("reads a Unicode class as a class", () => {
		expect(patternMismatch("[^\\p{Cc}]*", "Alice")).toBe(false);
		expect(patternMismatch("[^\\p{Cc}]*", "Ali\u0007ce")).toBe(true);
	});

	it("never mismatches an empty value", () => {
		expect(patternMismatch("[a-z]+", "")).toBe(false);
	});

	it("ignores a pattern a browser cannot compile", () => {
		// A bare hyphen at the end of a class is an error under the `v` flag.
		expect(patternMismatch("[a-z0-9-]{1,4}", "!!")).toBe(false);
	});
});

describe("the registered DOM", () => {
	const input = (pattern: string, value: string) => {
		const { container } = render(
			<input pattern={pattern} defaultValue={value} />,
		);
		return container.querySelector("input") as HTMLInputElement;
	};

	it("reports a field's pattern the way a browser does", () => {
		expect(input("[^\\p{Cc}]*", "Alice").validity.patternMismatch).toBe(
			false,
		);
		expect(input("[^\\p{Cc}]*", "Alice").checkValidity()).toBe(true);
		const partial = input("[a-z]+", "abc1");
		expect(partial.validity.patternMismatch).toBe(true);
		expect(partial.validity.valid).toBe(false);
		expect(partial.checkValidity()).toBe(false);
	});
});
