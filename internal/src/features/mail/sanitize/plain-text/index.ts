import { type DefaultTreeAdapterMap, parseFragment } from "parse5";

import { safeBody } from "@/features/mail/sanitize/safe-text";
import { sanitizeHtml } from "@/features/mail/sanitize/sanitize-html";

type Node = DefaultTreeAdapterMap["node"];

/** Elements whose end starts a new line in the quoted text. */
const BLOCKS: ReadonlySet<string> = new Set([
	"p",
	"div",
	"li",
	"tr",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"blockquote",
	"pre",
	"table",
]);

/** Append the text of `node` and everything under it to `out`. */
function collect(node: Node, out: string[]): void {
	if (node.nodeName === "#text") {
		out.push((node as DefaultTreeAdapterMap["textNode"]).value);
		return;
	}
	if (node.nodeName === "br") {
		out.push("\n");
		return;
	}
	const children =
		(node as DefaultTreeAdapterMap["element"]).childNodes ??
		(node as DefaultTreeAdapterMap["documentFragment"]).childNodes ??
		[];
	for (const child of children) {
		collect(child, out);
	}
	if (BLOCKS.has(node.nodeName)) {
		out.push("\n");
	}
}

/**
 * The text of an HTML body, for quoting it in a reply. It goes through the
 * sanitiser first, so only allow-listed markup is ever looked at, and the
 * sanitised markup is parsed and read by its text nodes: no tag is removed with
 * a pattern, and the parser decodes the entities. Block ends and line breaks
 * become line breaks. The result is plain text for a text area: it is never put
 * back into a page as markup.
 */
export function plainTextOf(html: string): string {
	const { html: clean } = sanitizeHtml(html, { remoteImages: false });
	const out: string[] = [];
	collect(parseFragment(clean), out);
	return safeBody(out.join(""))
		.replace(/\n{3,}/gu, "\n\n")
		.trim();
}
