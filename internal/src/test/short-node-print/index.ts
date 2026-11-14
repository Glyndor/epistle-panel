/**
 * Make a DOM node print as one short line wherever a value is formatted, a
 * failed assertion above all.
 *
 * Without it Bun formats the whole happy-dom object behind a node (listeners,
 * owner document, window): a failed `expect(node).toBeNull()` built a message
 * of 248 MB in about 4 s, and a failed jest-dom matcher took about 7 s
 * (measured). Inside `waitFor` that one failed poll is longer than the whole
 * second `waitFor` waits, so a test that would have passed on its next poll
 * failed instead, at random, depending on whether the first poll came before
 * or after the thing it waited for. Tests failed that way for weeks.
 *
 * The print names the element the way a person would look for it: its tag, id,
 * role and accessible name, and the start of its text.
 */
const INSPECT = Symbol.for("nodejs.util.inspect.custom");

/** Longest text of a node kept in its print, in characters. */
const TEXT_MAX = 40;

function describeNode(node: Node): string {
	if (node.nodeType !== 1) {
		return `[${node.nodeName}]`;
	}
	const element = node as Element;
	const attributes = ["id", "role", "name", "aria-label", "data-slot"]
		.map((name) => [name, element.getAttribute(name)] as const)
		.filter(([, value]) => value !== null && value !== "")
		.map(([name, value]) => ` ${name}="${value}"`)
		.join("");
	const text = (element.textContent ?? "").replace(/\s+/gu, " ").trim();
	const shown = text.length > TEXT_MAX ? `${text.slice(0, TEXT_MAX)}…` : text;
	return `<${element.tagName.toLowerCase()}${attributes}>${shown}`;
}

/** Install the short print on every node of the registered DOM. Call it once, after the DOM is registered. */
export function installShortNodePrint(): void {
	Object.defineProperty(window.Node.prototype, INSPECT, {
		configurable: true,
		enumerable: false,
		value(this: Node) {
			return describeNode(this);
		},
	});
}
