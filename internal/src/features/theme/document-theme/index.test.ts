import { afterEach, describe, expect, it, mock } from "bun:test";

import { HOSTILE_THEME_VALUES } from "@/features/theme/test-support/hostile-choices";
import {
	activeColorScheme,
	applyThemeChoice,
	documentThemeChoice,
	subscribeDocumentTheme,
} from ".";

const root = () => document.documentElement;
const originalMatchMedia = window.matchMedia;

afterEach(() => {
	root().removeAttribute("data-theme");
	window.matchMedia = originalMatchMedia;
});

/** Make the browser prefer `scheme`, as far as `matchMedia` tells. */
function prefer(scheme: "light" | "dark") {
	window.matchMedia = ((query: string) => ({
		matches: query === `(prefers-color-scheme: ${scheme})`,
	})) as unknown as typeof window.matchMedia;
}

describe("the document's theme", () => {
	it("is system without the attribute", () => {
		expect(documentThemeChoice()).toBe("system");
	});

	it("pins light and dark with the attribute, and removes it for system", () => {
		applyThemeChoice("dark");
		expect(root().getAttribute("data-theme")).toBe("dark");
		expect(documentThemeChoice()).toBe("dark");

		applyThemeChoice("light");
		expect(root().getAttribute("data-theme")).toBe("light");
		expect(documentThemeChoice()).toBe("light");

		applyThemeChoice("system");
		expect(root().hasAttribute("data-theme")).toBe(false);
		expect(documentThemeChoice()).toBe("system");
	});

	it("reads an attribute that is not a theme as system", () => {
		for (const value of HOSTILE_THEME_VALUES) {
			root().setAttribute("data-theme", value);

			expect(documentThemeChoice()).toBe("system");
		}
	});

	it("tells a subscriber about each change of the attribute, until it stops", async () => {
		const listener = mock(() => {});
		const stop = subscribeDocumentTheme(listener);

		applyThemeChoice("dark");
		await Promise.resolve();
		expect(listener).toHaveBeenCalledTimes(1);

		// Another attribute is not the theme.
		root().setAttribute("data-other", "dark");
		await Promise.resolve();
		expect(listener).toHaveBeenCalledTimes(1);

		stop();
		applyThemeChoice("light");
		await Promise.resolve();
		expect(listener).toHaveBeenCalledTimes(1);
		root().removeAttribute("data-other");
	});
});

describe("activeColorScheme", () => {
	it("is the pinned theme, whatever the browser prefers", () => {
		prefer("light");
		applyThemeChoice("dark");
		expect(activeColorScheme()).toBe("dark");

		prefer("dark");
		applyThemeChoice("light");
		expect(activeColorScheme()).toBe("light");
	});

	it("follows the browser when no theme is pinned", () => {
		prefer("dark");
		expect(activeColorScheme()).toBe("dark");

		prefer("light");
		expect(activeColorScheme()).toBe("light");
	});
});
