import { describe, expect, it } from "bun:test";

import { sniffImage } from ".";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

describe("sniffImage", () => {
	it("recognises the raster formats by their magic bytes", () => {
		expect(
			sniffImage(
				bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0),
			),
		).toBe("image/png");
		expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
		expect(sniffImage(bytes(0, 0, 1, 0, 1, 0))).toBe("image/x-icon");
		expect(
			sniffImage(
				bytes(
					0x52,
					0x49,
					0x46,
					0x46,
					0,
					0,
					0,
					0,
					0x57,
					0x45,
					0x42,
					0x50,
				),
			),
		).toBe("image/webp");
	});

	it("rejects an unterminated-comment prefix quickly", () => {
		const hostile = new TextEncoder().encode("<!--".repeat(50_000));
		const started = performance.now();
		expect(sniffImage(hostile)).toBeUndefined();
		expect(performance.now() - started).toBeLessThan(500);
	});

	it("accepts a plain SVG, with or without an XML prolog and comments", () => {
		for (const svg of [
			'<svg xmlns="http://www.w3.org/2000/svg"></svg>',
			'  \n<?xml version="1.0"?>\n<!-- logo -->\n<svg viewBox="0 0 1 1"></svg>',
		]) {
			expect(sniffImage(text(svg))).toBe("image/svg+xml");
		}
	});

	it("refuses an SVG that can run script or embed HTML", () => {
		for (const svg of [
			"<svg><script>alert(1)</script></svg>",
			'<svg onload="alert(1)"></svg>',
			'<svg><a href="javascript:alert(1)"></a></svg>',
			"<svg><foreignObject><div/></foreignObject></svg>",
			"<svg><SCRIPT>x</SCRIPT></svg>",
		]) {
			expect(sniffImage(text(svg))).toBeUndefined();
		}
	});

	it("refuses text that is not an SVG, HTML, and binary that is not an image", () => {
		for (const input of [
			text("<html><svg></svg></html>"),
			text("hello"),
			text(""),
			bytes(0x00, 0x01, 0x02),
			bytes(0xff, 0xfe, 0xfd),
		]) {
			expect(sniffImage(input)).toBeUndefined();
		}
	});
});
