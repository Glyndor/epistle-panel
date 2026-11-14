/**
 * Make an input's `pattern` attribute mean what it means in a browser.
 *
 * The HTML standard compiles the attribute with the `v` flag and matches it
 * against the whole value, as `^(?:pattern)$`; a pattern that does not compile
 * is ignored, and an empty value never mismatches. happy-dom compiles it with
 * no flag and no anchors and removes the first match from the value. So a
 * Unicode class such as `\p{Cc}` was read as the letters `p`, `C` and `c`, and
 * a field that every browser accepts stopped the submit in a test (measured:
 * the display name `Alice` against `[^\p{Cc}]*`), while a pattern that only a
 * browser refuses to compile passed.
 */
export function patternMismatch(pattern: string, value: string): boolean {
	if (value === "") {
		return false;
	}
	let compiled: RegExp;
	try {
		compiled = new RegExp(`^(?:${pattern})$`, "v");
	} catch {
		return false;
	}
	return !compiled.test(value);
}

/** Install the standard's reading of `pattern` on the registered DOM. Call it once, after the DOM is registered. */
export function installBrowserPattern(): void {
	const validity = Object.getPrototypeOf(
		document.createElement("input").validity,
	) as object;
	Object.defineProperty(validity, "patternMismatch", {
		configurable: true,
		get(this: { element: Element & { value: string } }) {
			const pattern = this.element.getAttribute("pattern");
			return pattern === null
				? false
				: patternMismatch(pattern, this.element.value);
		},
	});
}
