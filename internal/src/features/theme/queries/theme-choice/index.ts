import { cookies } from "next/headers";

import {
	parseThemeChoice,
	THEME_COOKIE,
	type ThemeChoice,
} from "@/features/theme/config/choices";

/**
 * The theme this request chose, from the `theme` cookie. The cookie is plain
 * and comes from the browser, so its value is never trusted: anything that is
 * not exactly a choice reads as `system`, and only the parsed choice, never
 * the cookie's text, reaches the page.
 */
export async function readThemeChoice(): Promise<ThemeChoice> {
	return parseThemeChoice((await cookies()).get(THEME_COOKIE)?.value);
}
