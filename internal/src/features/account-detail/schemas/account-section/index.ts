import type { Route } from "next";

/**
 * The sections the detail page of one account is divided into. Each is a part
 * of the page with its own code and its own data, so a visit loads the one the
 * address names and not the others.
 */
export const ACCOUNT_SECTIONS = [
	"overview",
	"profile",
	"security",
	"mailboxes",
	"masked",
	"archive",
] as const;
export type AccountSection = (typeof ACCOUNT_SECTIONS)[number];

export function accountSectionNeedsAccount(section: AccountSection): boolean {
	return (
		section === "overview" ||
		section === "profile" ||
		section === "security"
	);
}

/** The section shown when the address names none, or one that is not offered. */
export const DEFAULT_SECTION: AccountSection = "overview";

/**
 * Read the `section` query parameter of the account page. Next hands a
 * repeated parameter over as an array: the first value counts. Anything that
 * is not one of the sections on offer is the default, so no text from the
 * address reaches the page.
 */
export function parseSectionParam(
	value: string | string[] | undefined,
): AccountSection {
	const first = Array.isArray(value) ? value[0] : value;
	return (
		ACCOUNT_SECTIONS.find((section) => section === first) ?? DEFAULT_SECTION
	);
}

/**
 * The address of a section of the account page. The default section is the
 * bare path, so there is one address for it and not two.
 */
export function accountSectionHref(
	base: Route,
	section: AccountSection,
): Route {
	return section === DEFAULT_SECTION
		? base
		: (`${base}?section=${section}` as Route);
}
