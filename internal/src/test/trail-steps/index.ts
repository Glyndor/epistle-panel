/**
 * What a step of a trail says, as the page shows it at one width. A step that
 * is not drawn where the bar is narrow writes its words twice, once as the
 * link of a wide bar and once as the plain text of a narrow one, and a
 * stylesheet shows one of the two. A test has no stylesheet, so it reads the
 * step without the copy kept for the narrow bar.
 */
export function stepText(step: Element): string {
	const copy = step.cloneNode(true) as Element;
	for (const narrow of copy.querySelectorAll(
		"[data-slot='breadcrumb-narrow']",
	)) {
		narrow.remove();
	}
	return copy.textContent ?? "";
}

/** The words a step keeps for the narrow bar, or `null` for a step drawn at every width. */
export function narrowText(step: Element): string | null {
	return (
		step.querySelector("[data-slot='breadcrumb-narrow']")?.textContent ??
		null
	);
}
