import "server-only";

import { cookies } from "next/headers";

import {
	PAGE_SIZE_COOKIE,
	type PageSizeChoice,
	parsePageSizeChoice,
} from "@/features/mail/config/page-size";
import { readOperatorPageSize } from "@/lib/config/page-size";

/**
 * The page size this request chose, from the `page-size` cookie. The cookie
 * comes from the browser, so anything that is not exactly one of the list reads
 * as the default.
 */
export async function readPageSizePreference(): Promise<PageSizeChoice> {
	return parsePageSizeChoice((await cookies()).get(PAGE_SIZE_COOKIE)?.value);
}

/**
 * The page size every list of this request uses: the operator's when they
 * fixed one, and the person's otherwise.
 */
export async function readEffectivePageSize(): Promise<PageSizeChoice> {
	const operatorSize = readOperatorPageSize();
	if (operatorSize !== null) {
		return operatorSize;
	}
	return readPageSizePreference();
}
