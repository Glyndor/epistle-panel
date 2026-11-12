import { afterEach, describe, expect, it } from "bun:test";

import { captureCookieWrites } from ".";

const before = Object.getOwnPropertyDescriptor(document, "cookie");
let capture: ReturnType<typeof captureCookieWrites> | undefined;

afterEach(() => capture?.restore());

describe("captureCookieWrites", () => {
	it("records each write instead of storing it", () => {
		capture = captureCookieWrites();

		// biome-ignore lint/suspicious/noDocumentCookie: the helper under test intercepts this write
		document.cookie = "a=1";
		// biome-ignore lint/suspicious/noDocumentCookie: the helper under test intercepts this write
		document.cookie = "b=2";

		expect(capture.writes).toEqual(["a=1", "b=2"]);
	});

	it("puts the document's own cookie behaviour back", () => {
		capture = captureCookieWrites();
		capture.restore();

		expect(Object.getOwnPropertyDescriptor(document, "cookie")).toEqual(
			before,
		);
		expect(typeof document.cookie).toBe("string");
	});
});
