import { cookies } from "next/headers";

import {
	LIST_DENSITY_COOKIE,
	type ListDensity,
	parseListDensity,
} from "@/features/mail/config/list-density";

/**
 * The density of the message list this request chose, from the
 * `mail-density` cookie. The cookie comes from the browser, so its value is
 * never trusted: anything that is not exactly a density reads as the default,
 * and only the parsed density, never the cookie's text, reaches the page.
 */
export async function readListDensity(): Promise<ListDensity> {
	return parseListDensity((await cookies()).get(LIST_DENSITY_COOKIE)?.value);
}
