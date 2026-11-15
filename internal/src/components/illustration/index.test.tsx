import { afterEach, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";

import { ILLUSTRATION_NAMES, Illustration } from ".";

afterEach(cleanup);

const STYLES = join(import.meta.dir, "..", "..", "styles");
const FILES = join(STYLES, "illustrations");
const css = readFileSync(join(STYLES, "illustrations.css"), "utf8");
const globals = readFileSync(
	join(import.meta.dir, "..", "..", "app", "globals.css"),
	"utf8",
);

/** The file a rule of the stylesheet names for `name`, from both the plain and the prefixed property. */
function maskFiles(name: string): string[] {
	const rule = new RegExp(`\\.illustration-${name}\\s*\\{([^}]*)\\}`).exec(
		css,
	);
	const body = rule?.[1] ?? "";
	return [
		...body.matchAll(/mask-image:\s*url\("\.\/illustrations\/([^"]+)"\)/g),
	].map((match) => match[1] ?? "");
}

describe("Illustration", () => {
	it("is an empty, decorative span with the class of its drawing", () => {
		for (const name of ILLUSTRATION_NAMES) {
			const { container } = render(<Illustration name={name} />);
			const mark = container.firstElementChild;

			expect(mark?.tagName).toBe("SPAN");
			expect(mark).toHaveAttribute("aria-hidden", "true");
			expect(mark).toHaveAttribute("data-illustration", name);
			expect(mark).toHaveClass("illustration", `illustration-${name}`);
			expect(mark?.childElementCount).toBe(0);
			expect(mark?.textContent).toBe("");
			cleanup();
		}
	});

	it("paints in the muted text colour, at a fixed size, and is gone in forced colours", () => {
		const { container } = render(<Illustration name="tray" />);
		const mark = container.firstElementChild;

		expect(mark).toHaveClass(
			"bg-muted-foreground",
			"size-24",
			"shrink-0",
			"forced-colors:hidden",
		);
		expect(container.querySelector("[style]")).toBeNull();
	});

	it("takes a class from the caller after its own", () => {
		const { container } = render(
			<Illustration name="globe" className="size-16" />,
		);

		expect(container.firstElementChild).toHaveClass("size-16");
		expect(container.firstElementChild).not.toHaveClass("size-24");
	});

	it("has a handful of drawings, each in the stylesheet with a file of its own", () => {
		expect(ILLUSTRATION_NAMES.length).toBeGreaterThanOrEqual(4);
		expect(ILLUSTRATION_NAMES.length).toBeLessThanOrEqual(8);
		const used: string[] = [];
		for (const name of ILLUSTRATION_NAMES) {
			// Both the standard and the prefixed property, on the same file.
			const files = maskFiles(name);
			expect(files).toHaveLength(2);
			expect(files[0]).toBe(files[1] ?? "");
			used.push(files[0] ?? "");
		}
		expect(new Set(used).size).toBe(used.length);
		expect(readdirSync(FILES).sort()).toEqual([...used].sort());
	});

	it("is in the global stylesheet, or no drawing is ever painted", () => {
		expect(globals).toContain('@import "../styles/illustrations.css";');
	});
});

describe("the drawing files", () => {
	const files = readdirSync(FILES);

	it("are small, one line, on a 96 px grid", () => {
		expect(files.length).toBeGreaterThan(0);
		for (const file of files) {
			const text = readFileSync(join(FILES, file), "utf8");

			expect(text.length).toBeLessThan(700);
			expect(text.trim().split("\n")).toHaveLength(1);
			expect(text).toContain('viewBox="0 0 96 96"');
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

			expect(colours.every((value) => value === "#000")).toBe(true);
		}
	});
});
