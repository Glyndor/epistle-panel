import { afterEach, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";

import { GLYPH_NAMES, Glyph } from ".";

afterEach(cleanup);

const STYLES = join(import.meta.dir, "..", "..", "styles");
const FILES = join(STYLES, "glyphs");
const css = readFileSync(join(STYLES, "glyphs.css"), "utf8");
const globals = readFileSync(
	join(import.meta.dir, "..", "..", "app", "globals.css"),
	"utf8",
);

/** The file a rule of the stylesheet names for `name`, from both the plain and the prefixed property. */
function maskFiles(name: string): string[] {
	const rule = new RegExp(`\\.glyph-${name}\\s*\\{([^}]*)\\}`).exec(css);
	const body = rule?.[1] ?? "";
	return [
		...body.matchAll(/mask-image:\s*url\("\.\/glyphs\/([^"]+)"\)/g),
	].map((match) => match[1] ?? "");
}

describe("Glyph", () => {
	it("is an empty, decorative span with the class of its drawing", () => {
		for (const name of GLYPH_NAMES) {
			const { container } = render(<Glyph name={name} />);
			const mark = container.firstElementChild;

			expect(mark?.tagName).toBe("SPAN");
			expect(mark).toHaveAttribute("aria-hidden", "true");
			expect(mark).toHaveAttribute("data-glyph", name);
			expect(mark).toHaveClass("glyph", `glyph-${name}`);
			expect(mark?.childElementCount).toBe(0);
			expect(mark?.textContent).toBe("");
			expect(container.querySelector("svg, [style]")).toBeNull();
			cleanup();
		}
	});

	it("paints in the text colour of its parent, at 16 px unless told otherwise", () => {
		const { container } = render(<Glyph name="clock" />);

		expect(container.firstElementChild).toHaveClass(
			"bg-current",
			"size-4",
			"shrink-0",
		);
	});

	it("stays in forced colours: it does not hide there and it keeps its own paint", () => {
		const { container } = render(<Glyph name="clock" />);
		const mark = container.firstElementChild;

		expect(mark).toHaveClass(
			"forced-color-adjust-none",
			"forced-colors:bg-[CanvasText]",
		);
		expect(mark?.className).not.toContain("forced-colors:hidden");
	});

	it("takes a class from the caller after its own", () => {
		const { container } = render(<Glyph name="globe" className="size-5" />);

		expect(container.firstElementChild).toHaveClass("size-5");
		expect(container.firstElementChild).not.toHaveClass("size-4");
	});

	it("has each drawing in the stylesheet with a file of its own, and no file the list does not name", () => {
		expect(GLYPH_NAMES.length).toBeGreaterThanOrEqual(10);
		const used: string[] = [];
		for (const name of GLYPH_NAMES) {
			const files = maskFiles(name);
			expect(files).toHaveLength(2);
			expect(files[0]).toBe(files[1] ?? "");
			expect(files[0]).toBe(`${name}.svg`);
			used.push(files[0] ?? "");
		}
		expect(new Set(used).size).toBe(used.length);
		expect(readdirSync(FILES).sort()).toEqual([...used].sort());
	});

	it("is in the global stylesheet, or no drawing is ever painted", () => {
		expect(globals).toContain('@import "../styles/glyphs.css";');
	});
});

describe("the glyph files", () => {
	const files = readdirSync(FILES);

	it("are small, one line, on the 24 px grid with the icon set's 2 px stroke", () => {
		expect(files.length).toBeGreaterThan(0);
		for (const file of files) {
			const text = readFileSync(join(FILES, file), "utf8");

			expect(text.length).toBeLessThan(500);
			expect(text.trim().split("\n")).toHaveLength(1);
			expect(text).toContain('viewBox="0 0 24 24"');
			expect(text).toContain('stroke-width="2"');
		}
	});

	it("hold shapes only: no script, style, link, image or event", () => {
		for (const file of files) {
			const text = readFileSync(join(FILES, file), "utf8");

			expect(text).not.toMatch(
				/<(script|style|image|use|foreignObject|a)[\s>]/i,
			);
			expect(text).not.toMatch(/\s(on[a-z]+|href|xlink:href|style)=/i);
			expect(text).not.toMatch(
				/url\(|https?:\/\/(?!www\.w3\.org\/2000\/svg)/,
			);
		}
	});

	it("carry no colour of their own: black, so the mask is the shape and the element paints", () => {
		for (const file of files) {
			const text = readFileSync(join(FILES, file), "utf8");
			const colours = [
				...text.matchAll(/(?:fill|stroke)="(#[0-9a-f]+|[a-z]+)"/gi),
			]
				.map((match) => match[1])
				.filter((value) => value !== "none");

			expect(colours).toContain("#000");
			expect(colours.every((value) => value === "#000")).toBe(true);
		}
	});
});
