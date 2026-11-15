/**
 * How many messages one page of the message list holds: a closed list, spelled
 * as the preferences form posts it (a text), so the form, the schema, the cookie
 * and the operator's variable all say the same three words. The size is read
 * with {@link pageSizeOf}, never by parsing a cookie.
 */
export const PAGE_SIZE_CHOICES = ["25", "50", "100"] as const;
export type PageSizeChoice = (typeof PAGE_SIZE_CHOICES)[number];

/** What the list held before the person could choose: 50 messages. */
export const DEFAULT_PAGE_SIZE_CHOICE: PageSizeChoice = "50";

export const PAGE_SIZE_COOKIE = "page-size";
export const PAGE_SIZE_COOKIE_PATH = "/app";

export function isPageSizeChoice(value: unknown): value is PageSizeChoice {
	return PAGE_SIZE_CHOICES.some((choice) => choice === value);
}

/** The choice for a value that may come from a cookie: anything off the list is the default. */
export function parsePageSizeChoice(value: unknown): PageSizeChoice {
	return isPageSizeChoice(value) ? value : DEFAULT_PAGE_SIZE_CHOICE;
}

/** The number of messages a page holds for `choice`. */
export function pageSizeOf(choice: PageSizeChoice): number {
	return Number(choice);
}
