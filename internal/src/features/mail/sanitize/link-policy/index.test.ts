import { describe, expect, it } from "bun:test";

import {
	MAX_DATA_IMAGE_LENGTH,
	MAX_URL_LENGTH,
	safeDataImage,
	safeHref,
	safeRemoteImage,
} from ".";

describe("safeHref", () => {
	it("keeps http, https, mailto and tel, written the way the URL parser writes them", () => {
		expect(safeHref("https://example.org")).toBe("https://example.org/");
		expect(safeHref("HTTP://Example.ORG/a b")).toBe(
			"http://example.org/a%20b",
		);
		expect(safeHref("mailto:a@example.org?subject=x")).toBe(
			"mailto:a@example.org?subject=x",
		);
		expect(safeHref("tel:+57123")).toBe("tel:+57123");
	});

	it("refuses every other scheme, including the ones disguised with white space or entities' decoded form", () => {
		for (const raw of [
			"javascript:alert(1)",
			"JAVASCRIPT:alert(1)",
			"java\tscript:alert(1)",
			"java\nscript:alert(1)",
			"\u0001javascript:alert(1)",
			"  javascript:alert(1)",
			"data:text/html,<script>alert(1)</script>",
			"vbscript:x",
			"file:///etc/passwd",
			"ftp://example.org/",
			"blob:https://example.org/x",
			"about:blank",
			"//example.org/x",
			"/relative",
			"relative",
			"",
			"   ",
		]) {
			expect(safeHref(raw)).toBeNull();
		}
	});

	it("refuses a user name or password in the URL", () => {
		expect(safeHref("https://bank.example@evil.example/")).toBeNull();
		expect(safeHref("https://user:pass@example.org/")).toBeNull();
	});

	it("refuses an address over the length cap", () => {
		expect(
			safeHref(`https://example.org/${"a".repeat(MAX_URL_LENGTH)}`),
		).toBeNull();
	});
});

describe("safeRemoteImage", () => {
	it("keeps http and https only", () => {
		expect(safeRemoteImage("https://img.example/a.png")).toBe(
			"https://img.example/a.png",
		);
		expect(safeRemoteImage("http://img.example/a.png")).toBe(
			"http://img.example/a.png",
		);
		expect(safeRemoteImage("mailto:a@example.org")).toBeNull();
		expect(safeRemoteImage("javascript:1")).toBeNull();
	});
});

describe("safeDataImage", () => {
	it("keeps raster base64 images and drops the white space inside", () => {
		expect(safeDataImage("data:image/png;base64,iVBOR w0KGgo=")).toBe(
			"data:image/png;base64,iVBORw0KGgo=",
		);
		expect(safeDataImage("data:image/jpeg;base64,AAAA")).not.toBeNull();
		expect(safeDataImage("data:image/webp;base64,AAAA")).not.toBeNull();
	});

	it("refuses SVG, HTML, non-base64 data, other schemes and an oversized image", () => {
		for (const raw of [
			"data:image/svg+xml;base64,PHN2Zz4=",
			"data:image/svg+xml,<svg onload=alert(1)>",
			"data:text/html;base64,PGI+",
			"data:image/png,abc",
			"data:image/png;base64,",
			"https://example.org/a.png",
			"",
		]) {
			expect(safeDataImage(raw)).toBeNull();
		}
		expect(
			safeDataImage(
				`data:image/png;base64,${"A".repeat(MAX_DATA_IMAGE_LENGTH)}`,
			),
		).toBeNull();
	});
});
