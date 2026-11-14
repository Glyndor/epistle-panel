/**
 * How tall a row of the message list is. This is the only list: the control
 * in the list's toolbar, the Server Action's schema, the cookie's reader and
 * the tests read it. `comfortable` is two lines and the preview; `compact` is
 * one line.
 */
export const LIST_DENSITIES = ["comfortable", "compact"] as const;
export type ListDensity = (typeof LIST_DENSITIES)[number];

/** The density when the cookie is missing or holds anything else. */
export const DEFAULT_LIST_DENSITY: ListDensity = "comfortable";

/** Name of the cookie that holds the chosen density. */
export const LIST_DENSITY_COOKIE = "mail-density";

/**
 * The attribute of the list pane that says the density. The rows, the date
 * headings and the skeleton read it through the pane's `group/list`, so the
 * server paints the choice with the first frame and a change needs no render
 * of the rows.
 */
export const LIST_DENSITY_ATTRIBUTE = "data-density";

/** Whether a value is one of the {@link LIST_DENSITIES}, exactly. */
export function isListDensity(value: unknown): value is ListDensity {
	return LIST_DENSITIES.includes(value as ListDensity);
}

/** A stored value as a density: anything that is not exactly one is the default. */
export function parseListDensity(value: unknown): ListDensity {
	return isListDensity(value) ? value : DEFAULT_LIST_DENSITY;
}
