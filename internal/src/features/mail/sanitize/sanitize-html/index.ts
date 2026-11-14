import { type DefaultTreeAdapterMap, parse } from "parse5";

import { safeDataImage, safeHref, safeRemoteImage } from "../link-policy";
import { stripBidi } from "../safe-text";
import { checkedAttribute } from "./attributes";
import { ALLOWED_TAGS, DROPPED_TAGS, VOID_TAGS } from "./tags";

type Node = DefaultTreeAdapterMap["node"];
type Element = DefaultTreeAdapterMap["element"];
type ParentNode = DefaultTreeAdapterMap["parentNode"];

/** The namespace of ordinary HTML. An element of any other (svg, math) is dropped with its content. */
const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

/** Deepest nesting of written elements kept; an element below it is dropped. The walk's recursion is bounded by {@link MAX_NESTING}. */
export const MAX_DEPTH = 64;

/** Most elements kept in one body; the rest of the message is cut. */
export const MAX_ELEMENTS = 20_000;

/**
 * How many element levels the walk descends, counting every element, those
 * written and those unwrapped alike. {@link MAX_DEPTH} counts only written
 * elements, so a body of thousands of nested unknown tags (`<x><x><x>…`) would
 * otherwise recurse without bound and throw; this cap stops the walk first.
 */
export const MAX_NESTING = 512;

/** Largest HTML input read, in UTF-16 code units. Past it the message is shown as text only. */
export const MAX_INPUT_LENGTH = 1_048_576;

/** What the sanitiser was asked for. */
export interface SanitizeOptions {
	/** Keep `http` and `https` images. Off by default: a remote image tells the sender the message was read. */
	readonly remoteImages: boolean;
}

/** The sanitised markup and what was held back. */
export interface SanitizedHtml {
	/** A fragment: the content that goes inside `<body>`. Only the allow-list of `tags.ts` and `attributes.ts`. */
	readonly html: string;
	/** Remote images not loaded, so the interface can offer to load them. */
	readonly blockedImages: number;
	/** Whether the body was cut for its size or depth. */
	readonly truncated: boolean;
}

interface State {
	out: string[];
	elements: number;
	/** Element levels the walk is inside right now, written or unwrapped. */
	nesting: number;
	blockedImages: number;
	truncated: boolean;
	remoteImages: boolean;
}

function escapeText(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function escapeAttribute(value: string): string {
	return escapeText(value).replaceAll('"', "&quot;");
}

/** The attributes of `element` that pass the allow-list, as ` name="value"` text. */
function keptAttributes(element: Element): string {
	let result = "";
	for (const { name, value } of element.attrs) {
		const checked = checkedAttribute(
			element.tagName,
			name.toLowerCase(),
			stripBidi(value),
		);
		if (checked !== null) {
			result += ` ${name.toLowerCase()}="${escapeAttribute(checked)}"`;
		}
	}
	return result;
}

function attribute(element: Element, name: string): string {
	return element.attrs.find((attr) => attr.name === name)?.value ?? "";
}

function emitImage(element: Element, state: State): void {
	const source = attribute(element, "src");
	const inline = safeDataImage(source);
	const remote = inline === null ? safeRemoteImage(source) : null;
	const alt = stripBidi(attribute(element, "alt"));
	if (inline !== null || (remote !== null && state.remoteImages)) {
		const target = inline ?? remote;
		state.out.push(
			`<img src="${escapeAttribute(target ?? "")}"${keptAttributes(element)} referrerpolicy="no-referrer" loading="lazy">`,
		);
		return;
	}
	if (remote !== null) {
		state.blockedImages += 1;
	}
	// Whatever the image would have shown, its description stays as text.
	if (alt !== "") {
		state.out.push(`<span>${escapeText(alt)}</span>`);
	}
}

function emitElement(element: Element, depth: number, state: State): void {
	const tag = element.tagName;
	if (element.namespaceURI !== HTML_NAMESPACE || DROPPED_TAGS.has(tag)) {
		return;
	}
	if (!ALLOWED_TAGS.has(tag)) {
		walk(element, depth, state);
		return;
	}
	if (depth >= MAX_DEPTH || state.elements >= MAX_ELEMENTS) {
		state.truncated = true;
		return;
	}
	state.elements += 1;
	if (tag === "img") {
		emitImage(element, state);
		return;
	}
	if (tag === "a") {
		const href = safeHref(attribute(element, "href"));
		if (href === null) {
			walk(element, depth, state);
			return;
		}
		state.out.push(
			`<a href="${escapeAttribute(href)}"${keptAttributes(element)} target="_blank" rel="noopener noreferrer nofollow">`,
		);
		walk(element, depth + 1, state);
		state.out.push("</a>");
		return;
	}
	if (tag === "body") {
		walk(element, depth, state);
		return;
	}
	state.out.push(`<${tag}${keptAttributes(element)}>`);
	if (!VOID_TAGS.has(tag)) {
		walk(element, depth + 1, state);
		state.out.push(`</${tag}>`);
	}
}

function walk(parent: ParentNode, depth: number, state: State): void {
	if (state.nesting >= MAX_NESTING) {
		state.truncated = true;
		return;
	}
	state.nesting += 1;
	for (const child of parent.childNodes as Node[]) {
		if (child.nodeName === "#text" && "value" in child) {
			state.out.push(
				escapeText(stripBidi(child.value).replaceAll("\u0000", "")),
			);
		} else if ("tagName" in child) {
			emitElement(child, depth, state);
		}
	}
	state.nesting -= 1;
}

function findBody(document: ParentNode): ParentNode | null {
	for (const top of document.childNodes as Node[]) {
		if ("tagName" in top && top.tagName === "html") {
			for (const section of top.childNodes as Node[]) {
				if ("tagName" in section && section.tagName === "body") {
					return section;
				}
			}
		}
	}
	return null;
}

/**
 * Reduce a message's HTML to a fragment that is safe to show.
 *
 * The input is parsed the way a browser parses it (parse5 follows the HTML
 * standard), and the output is written from the tree by this function, never
 * with the parser's own serialiser: only elements and attributes on the
 * allow-lists are written, every text and attribute value is escaped, and
 * nothing that switches the parsing mode (svg, math, template, noscript, the
 * raw-text elements) is ever written, so what the browser parses back from
 * the output is the tree that was checked (the mutation-XSS class of attack
 * relies on the two differing). There is no `style`, no event handler, no
 * form, frame, object or script; links keep only `http`, `https`, `mailto`
 * and `tel` targets and open in a new window with `noopener noreferrer`;
 * images are `data:` rasters, or remote ones only when `remoteImages` is on.
 */
export function sanitizeHtml(
	input: string,
	options: SanitizeOptions,
): SanitizedHtml {
	const state: State = {
		out: [],
		elements: 0,
		nesting: 0,
		blockedImages: 0,
		truncated: input.length > MAX_INPUT_LENGTH,
		remoteImages: options.remoteImages,
	};
	const document = parse(
		input.length > MAX_INPUT_LENGTH
			? input.slice(0, MAX_INPUT_LENGTH)
			: input,
	);
	const body = findBody(document);
	if (body !== null) {
		walk(body, 0, state);
	}
	return {
		html: state.out.join(""),
		blockedImages: state.blockedImages,
		truncated: state.truncated,
	};
}
