import {
	type ForcedTheme,
	forcedTheme,
	parseThemeChoice,
	THEME_ATTRIBUTE,
	type ThemeChoice,
} from "@/features/theme/config/choices";

/**
 * The theme the document shows, read from and written to the one place the
 * stylesheet looks at: the {@link THEME_ATTRIBUTE} of `<html>`. Every theme
 * control reads this, so two of them on one page cannot disagree. Browser
 * only.
 */
export function documentThemeChoice(): ThemeChoice {
	// No attribute is `system`; so is a value the stylesheet does not know.
	return parseThemeChoice(
		document.documentElement.getAttribute(THEME_ATTRIBUTE),
	);
}

/** Show a choice at once: pin the attribute, or remove it for `system`. */
export function applyThemeChoice(choice: ThemeChoice): void {
	const forced = forcedTheme(choice);
	if (forced === undefined) {
		document.documentElement.removeAttribute(THEME_ATTRIBUTE);
	} else {
		document.documentElement.setAttribute(THEME_ATTRIBUTE, forced);
	}
}

/** Call `listener` whenever the document's theme attribute changes. Returns the way to stop. */
export function subscribeDocumentTheme(listener: () => void): () => void {
	const observer = new MutationObserver(listener);
	observer.observe(document.documentElement, {
		attributes: true,
		attributeFilter: [THEME_ATTRIBUTE],
	});
	return () => observer.disconnect();
}

/**
 * The colour scheme in effect: the pinned theme, or what the browser prefers
 * when none is pinned. For a widget from elsewhere that has to be told.
 */
export function activeColorScheme(): ForcedTheme {
	return (
		forcedTheme(documentThemeChoice()) ??
		(window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light")
	);
}
