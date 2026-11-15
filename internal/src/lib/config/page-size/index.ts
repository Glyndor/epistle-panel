import "server-only";

import {
	isPageSizeChoice,
	type PageSizeChoice,
} from "@/features/mail/config/page-size";

import { ConfigError } from "../config-error";

export const PAGE_SIZE_VARIABLE = "EPISTLE_PANEL_PAGE_SIZE";

/**
 * The page size the operator fixed for everyone, or `null` when they fixed
 * none. A value that is not one of the list stops the server: a panel that
 * kept running would page the list at a size nobody chose. The error names the
 * variable and never its value.
 */
export function readOperatorPageSize(): PageSizeChoice | null {
	const value = (process.env[PAGE_SIZE_VARIABLE] ?? "").trim();
	if (value === "") {
		return null;
	}
	if (!isPageSizeChoice(value)) {
		throw new ConfigError(
			`${PAGE_SIZE_VARIABLE} is set to a page size the panel does not support`,
		);
	}
	return value;
}
