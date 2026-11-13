import { expect } from "bun:test";
import { type DefaultTreeAdapterMap, parse } from "parse5";

import { ALLOWED_TAGS } from "../../sanitize-html/tags";

type Node = DefaultTreeAdapterMap["node"];
type Parent = DefaultTreeAdapterMap["parentNode"];

const ATTRIBUTES = new Set([
	"dir",
	"lang",
	"title",
	"alt",
	"width",
	"height",
	"border",
	"cellpadding",
	"cellspacing",
	"colspan",
	"rowspan",
	"align",
	"span",
	"start",
	"type",
	"value",
	"datetime",
	"href",
	"src",
	"target",
	"rel",
	"referrerpolicy",
	"loading",
]);

/** Every element of `html` once parsed back, in document order. */
function elementsOf(html: string): DefaultTreeAdapterMap["element"][] {
	const found: DefaultTreeAdapterMap["element"][] = [];
	const visit = (parent: Parent) => {
		for (const child of parent.childNodes as Node[]) {
			if ("tagName" in child) {
				found.push(child);
				visit(child);
			}
		}
	};
	visit(parse(html));
	return found;
}

/**
 * Parse `html` the way a browser would and check that what comes back is
 * inside the allow-list: no element but the allowed ones, no attribute but
 * the allowed ones, links and images with safe targets, links that open in a
 * new window without an opener. Checked on the parsed-back tree, not on the
 * string, so a payload that re-parses into something else (mutation XSS)
 * fails here.
 */
export function assertSafeOutput(html: string): void {
	for (const element of elementsOf(html)) {
		const tag = element.tagName;
		expect(String(element.namespaceURI)).toBe(
			"http://www.w3.org/1999/xhtml",
		);
		expect(
			ALLOWED_TAGS.has(tag) || ["html", "head", "body"].includes(tag),
		).toBe(true);
		for (const { name, value } of element.attrs) {
			expect(ATTRIBUTES.has(name)).toBe(true);
			expect(name.startsWith("on")).toBe(false);
			if (name === "href") {
				expect(/^(?:https?:|mailto:|tel:)/iu.test(value)).toBe(true);
			}
			if (name === "src") {
				expect(
					/^(?:https?:|data:image\/(?:png|jpe?g|gif|webp);base64,)/iu.test(
						value,
					),
				).toBe(true);
			}
		}
		if (tag === "a") {
			const attrs = Object.fromEntries(
				element.attrs.map((a) => [a.name, a.value]),
			);
			expect(attrs["target"]).toBe("_blank");
			expect(attrs["rel"]).toContain("noopener");
			expect(attrs["rel"]).toContain("noreferrer");
		}
	}
}
