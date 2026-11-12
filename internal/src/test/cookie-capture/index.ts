/**
 * Record what a component writes to `document.cookie`, and put the document's
 * own cookie behaviour back afterwards. happy-dom keeps no cookies without a
 * URL, and an accessor deleted instead of restored leaves `document.cookie`
 * undefined for every later test file, which made the global-error page loop
 * forever when the suite ran in a different order.
 */
export function captureCookieWrites(): { writes: string[]; restore(): void } {
	const own = Object.getOwnPropertyDescriptor(document, "cookie");
	const writes: string[] = [];
	Object.defineProperty(document, "cookie", {
		configurable: true,
		get: () => writes.join("; "),
		set: (value: string) => {
			writes.push(value);
		},
	});
	return {
		writes,
		restore() {
			if (own) {
				Object.defineProperty(document, "cookie", own);
			} else {
				delete (document as { cookie?: string }).cookie;
			}
		},
	};
}
