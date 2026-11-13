import { describe, expect, it } from "bun:test";

import { removeScriptsLeftInHead } from ".";

describe("removeScriptsLeftInHead", () => {
	it("takes the scripts out of the head, says how many, and leaves what is not a script", () => {
		const marker = document.createElement("meta");
		marker.setAttribute("name", "left-in-head-test");
		document.head.append(marker);
		for (const src of [
			"https://a.example/x.js",
			"https://b.example/y.js",
		]) {
			const script = document.createElement("script");
			script.setAttribute("data-src", src);
			document.head.append(script);
		}

		expect(removeScriptsLeftInHead()).toBe(2);
		expect(document.head.querySelectorAll("script")).toHaveLength(0);
		expect(marker.isConnected).toBe(true);
		expect(removeScriptsLeftInHead()).toBe(0);
		marker.remove();
	});

	it("is done before every case: a script the case before left is not here", () => {
		// The case above could have left its two scripts; the preload took them.
		const script = document.createElement("script");
		document.head.append(script);
		expect(document.head.querySelectorAll("script")).toHaveLength(1);
		// Left on purpose, for the next case.
	});

	it("starts with an empty head again", () => {
		expect(document.head.querySelectorAll("script")).toHaveLength(0);
	});
});
